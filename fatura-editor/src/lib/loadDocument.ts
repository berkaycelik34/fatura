import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { LoadedDocument, Logo, PageAudit, RenderedPage, TextSpan } from "./types";

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
        firstPageText: await readTextSpans(doc),
        renderPage,
        auditPages: () => auditPdfPages(doc),
        destroy: () => {
            cache.clear();
            void doc.destroy();
        },
    };
}

/** İncelenecek en fazla sayfa sayısı; çok kalın belgelerde bekleme olmasın. */
const AUDIT_LIMIT = 80;

const INVOICE_MARKS = /GİB|GIB|e-?ar[şs]iv|e-?fatura|ETTN|Gelir İdaresi/i;

/**
 * Her sayfada GİB amblemi/QR kod (gömülü görsel) ve e-fatura metin izleri
 * aranır. İkisi de yoksa sayfa büyük olasılıkla faturaya ait değildir.
 */
async function auditPdfPages(doc: pdfjs.PDFDocumentProxy): Promise<PageAudit[]> {
    const audits: PageAudit[] = [];
    const limit = Math.min(doc.numPages, AUDIT_LIMIT);

    for (let index = 0; index < limit; index += 1) {
        const page = await doc.getPage(index + 1);
        let images = 0;
        let hasInvoiceMarks = false;

        try {
            const ops = await page.getOperatorList();
            for (const fn of ops.fnArray) {
                if (
                    fn === pdfjs.OPS.paintImageXObject ||
                    fn === pdfjs.OPS.paintInlineImageXObject ||
                    fn === pdfjs.OPS.paintImageMaskXObject
                ) {
                    images += 1;
                }
            }
            const content = await page.getTextContent();
            const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
            hasInvoiceMarks = INVOICE_MARKS.test(text);
        } catch {
            // Okunamayan sayfa "gerekli" sayılır; kimse sessizce silinmez.
            images = 1;
        }

        // "Gerekli" ölçütü yalnızca QR kod / GİB amblemi gibi gömülü görseldir.
        // e-fatura metin izleri ekantlarda da geçebildiği için tek başına yeterli
        // sayılmaz; yalnızca bilgi olarak taşınır.
        audits.push({ index, images, hasInvoiceMarks, looksRelevant: images > 0 });
    }

    for (let index = limit; index < doc.numPages; index += 1) {
        audits.push({ index, images: 1, hasInvoiceMarks: false, looksRelevant: true });
    }

    return audits;
}

/** İlk sayfanın metin parçalarını sayfa oranlarına çevirir (bölüm etiketleri için). */
async function readTextSpans(doc: pdfjs.PDFDocumentProxy): Promise<TextSpan[]> {
    try {
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const content = await page.getTextContent();

        return content.items.flatMap((item) => {
            if (!("str" in item) || item.str.trim() === "") return [];
            const [, , , , e, f] = item.transform;
            const start = viewport.convertToViewportPoint(e, f);
            const end = viewport.convertToViewportPoint(e + item.width, f + item.height);
            const x = Math.min(start[0], end[0]);
            const y = Math.min(start[1], end[1]);
            return [
                {
                    x: x / viewport.width,
                    y: y / viewport.height,
                    w: Math.abs(end[0] - start[0]) / viewport.width,
                    h: Math.abs(end[1] - start[1]) / viewport.height,
                    text: item.str,
                },
            ];
        });
    } catch {
        // Metin katmanı okunamazsa bölümler etiketsiz kalır; algılama yine çalışır.
        return [];
    }
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
        firstPageText: [],
        renderPage: async () => first,
        auditPages: async () => [{ index: 0, images: 1, hasInvoiceMarks: false, looksRelevant: true }],
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
