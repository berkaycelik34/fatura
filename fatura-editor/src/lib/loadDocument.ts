import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { LoadedDocument, Logo, RenderedPage } from "./types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Önizlemenin net görünmesi için hedeflenen genişlik. */
const TARGET_WIDTH = 1600;
const MAX_SCALE = 4;

export function loadImageElement(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Görsel okunamadı."));
        image.src = src;
    });
}

async function renderImage(bytes: Uint8Array, type: string): Promise<RenderedPage> {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
    try {
        const image = await loadImageElement(url);
        const canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas oluşturulamadı.");
        ctx.drawImage(image, 0, 0);
        return { canvas, widthPt: image.naturalWidth, heightPt: image.naturalHeight, rotation: 0 };
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function loadPdf(file: File, bytes: Uint8Array): Promise<LoadedDocument> {
    // pdf.js verilen tamponu devralır; orijinal baytları çıktı için saklıyoruz.
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const cache = new Map<number, RenderedPage>();

    // Sayfalar istendiğinde çizilir: önizleme için sadece ilk sayfa yeterli,
    // böylece kalın faturalar da anında açılır.
    const renderPage = async (index: number): Promise<RenderedPage> => {
        const cached = cache.get(index);
        if (cached) return cached;

        const page = await doc.getPage(index + 1);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(MAX_SCALE, Math.max(1, TARGET_WIDTH / base.width));
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas oluşturulamadı.");
        await page.render({ canvasContext: ctx, viewport }).promise;

        const rendered: RenderedPage = {
            canvas,
            widthPt: base.width,
            heightPt: base.height,
            rotation: ((page.rotate % 360) + 360) % 360,
        };
        cache.set(index, rendered);
        return rendered;
    };

    return {
        kind: "pdf",
        fileName: file.name,
        bytes,
        pageCount: doc.numPages,
        first: await renderPage(0),
        renderPage,
        destroy: () => {
            cache.clear();
            void doc.destroy();
        },
    };
}

export async function loadDocument(file: File): Promise<LoadedDocument> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) return loadPdf(file, bytes);

    const first = await renderImage(bytes, file.type || "image/png");
    return {
        kind: "image",
        fileName: file.name,
        bytes,
        pageCount: 1,
        first,
        renderPage: async () => first,
        destroy: () => {},
    };
}

/** Logoyu hem ekranda çizmek hem PDF'e gömmek için hazırlar. */
export async function loadLogo(file: File): Promise<Logo> {
    const buffer = await file.arrayBuffer();
    const type = file.type || "image/png";
    // Panelde önizleme için adres canlı kalmalı; logo değiştiğinde serbest bırakılır.
    const previewUrl = URL.createObjectURL(new Blob([buffer], { type }));
    const image = await loadImageElement(previewUrl);
    const ratio = image.naturalWidth / image.naturalHeight || 1;

    if (type === "image/png" || type === "image/jpeg") {
        const format = type === "image/png" ? "png" : "jpg";
        return { image, bytes: new Uint8Array(buffer), format, ratio, previewUrl };
    }

    // SVG/WebP gibi biçimleri PDF'e gömebilmek için PNG'ye çeviriyoruz.
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || 512;
    canvas.height = image.naturalHeight || Math.round(512 / ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas oluşturulamadı.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("Logo dönüştürülemedi.");
    URL.revokeObjectURL(previewUrl);
    const convertedUrl = URL.createObjectURL(blob);
    const converted = await loadImageElement(convertedUrl);
    return {
        image: converted,
        bytes: new Uint8Array(await blob.arrayBuffer()),
        format: "png",
        ratio,
        previewUrl: convertedUrl,
    };
}
