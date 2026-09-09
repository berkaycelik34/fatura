import fontkit from "@pdf-lib/fontkit";
import {
    PDFDocument,
    concatTransformationMatrix,
    popGraphicsState,
    pushGraphicsState,
    rgb,
    type PDFFont,
    type PDFImage,
    type PDFPage,
} from "pdf-lib";
import { fontBytes } from "./fonts";
import { layoutHeader, type Measure } from "./layout";
import type { HeaderConfig, LoadedDocument, RenderedPage } from "./types";

/**
 * "vector": orijinal PDF olduğu gibi korunur, seçilen alan yeni başlıkla kapatılır.
 * Kalite en yüksektir ama eski yazı PDF'in metin katmanında (görünmez şekilde) kalır.
 * "flatten": sadece değiştirilen sayfalar görüntüye çevrilir, böylece eski adres
 * metin olarak da kalmaz; yeni başlık üstüne vektörel çizilir.
 */
export type PdfMode = "vector" | "flatten";

const A4 = { width: 595.28, height: 841.89 };

function hexToRgb(hex: string) {
    const value = hex.replace("#", "");
    const full = value.length === 3 ? value.replace(/./g, (ch) => ch + ch) : value;
    const int = Number.parseInt(full, 16);
    if (Number.isNaN(int)) return rgb(0, 0, 0);
    return rgb(((int >> 16) & 255) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255);
}

/**
 * Sayfanın dönüş açısına göre, sol-üst orijinli "görünüm" koordinatlarını
 * PDF kullanıcı uzayına taşıyan dönüşüm matrisi.
 */
type Matrix = [number, number, number, number, number, number];

function viewTransform(rotation: number, width: number, height: number) {
    switch (rotation) {
        case 90:
            return { matrix: [0, 1, -1, 0, width, 0] as Matrix, viewW: height, viewH: width };
        case 180:
            return { matrix: [-1, 0, 0, -1, width, height] as Matrix, viewW: width, viewH: height };
        case 270:
            return { matrix: [0, -1, 1, 0, 0, height] as Matrix, viewW: height, viewH: width };
        default:
            return { matrix: null, viewW: width, viewH: height };
    }
}

interface DrawContext {
    regular: PDFFont;
    bold: PDFFont;
    logo: PDFImage | null;
}

/** Yeni başlığı PDF sayfasına vektörel olarak çizer; sayfanın kalanına dokunulmaz. */
function drawHeaderOnPage(page: PDFPage, cfg: HeaderConfig, ctx: DrawContext): void {
    const { width, height } = page.getSize();
    const rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const { matrix, viewW, viewH } = viewTransform(rotation, width, height);

    const measure: Measure = (text, size, bold) => (bold ? ctx.bold : ctx.regular).widthOfTextAtSize(text, size);
    const layout = layoutHeader(cfg, viewW, viewH, measure);
    if (!layout) return;

    if (matrix) {
        const [a, b, c, d, e, f] = matrix;
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(a, b, c, d, e, f));
    }

    if (layout.fillBackground) {
        page.drawRectangle({
            x: layout.box.x,
            y: viewH - (layout.box.y + layout.box.h),
            width: layout.box.w,
            height: layout.box.h,
            color: hexToRgb(cfg.background),
        });
    }

    if (layout.logo && ctx.logo) {
        page.drawImage(ctx.logo, {
            x: layout.logo.x,
            y: viewH - (layout.logo.y + layout.logo.h),
            width: layout.logo.w,
            height: layout.logo.h,
        });
    }

    const color = hexToRgb(cfg.textColor);
    for (const item of layout.items) {
        const font = item.bold ? ctx.bold : ctx.regular;
        const ascent = font.heightAtSize(item.size, { descender: false });
        const textWidth = font.widthOfTextAtSize(item.text, item.size);
        const x =
            item.align === "center" ? item.x - textWidth / 2 : item.align === "right" ? item.x - textWidth : item.x;
        page.drawText(item.text, { x, y: viewH - (item.top + ascent), size: item.size, font, color });
    }

    if (matrix) {
        page.pushOperators(popGraphicsState());
    }
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("Sayfa görüntüye çevrilemedi."));
                return;
            }
            blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
        }, "image/png");
    });
}

async function buildContext(pdfDoc: PDFDocument, cfg: HeaderConfig): Promise<DrawContext> {
    const fonts = await fontBytes();
    const [regular, bold] = await Promise.all([
        pdfDoc.embedFont(fonts.regular, { subset: true }),
        pdfDoc.embedFont(fonts.bold, { subset: true }),
    ]);

    let logo: PDFImage | null = null;
    if (cfg.logo && cfg.logoPosition !== "none") {
        const bytes = cfg.logo.bytes;
        logo = cfg.logo.format === "png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    }

    return { regular, bold, logo };
}

function toBlob(bytes: Uint8Array): Blob {
    return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

/** Düzleştirilen sayfanın ölçüsü: döndürülmüş sayfalarda en/boy yer değiştirir. */
function pageViewSize(page: RenderedPage): { width: number; height: number } {
    const swapped = page.rotation === 90 || page.rotation === 270;
    return swapped ? { width: page.heightPt, height: page.widthPt } : { width: page.widthPt, height: page.heightPt };
}

/**
 * Yüklenen belgeyi, sol üstteki başlık değiştirilmiş halde PDF olarak üretir.
 * PDF girdilerinde orijinal dosya yeniden çizilmez; metin ve çizgiler vektörel
 * kalır, sadece seçilen alan yeni başlıkla kapatılır.
 */
export async function exportPdf(
    doc: LoadedDocument,
    cfg: HeaderConfig,
    targetPages: number[],
    mode: PdfMode = "vector",
): Promise<Blob> {
    const targets = new Set(targetPages);

    if (doc.kind === "pdf") {
        const source = await PDFDocument.load(doc.bytes.slice());

        if (mode === "vector") {
            source.registerFontkit(fontkit);
            const ctx = await buildContext(source, cfg);
            source.getPages().forEach((page, index) => {
                if (targets.has(index)) drawHeaderOnPage(page, cfg, ctx);
            });
            return toBlob(await source.save());
        }

        const output = await PDFDocument.create();
        output.registerFontkit(fontkit);
        const ctx = await buildContext(output, cfg);

        for (let index = 0; index < source.getPageCount(); index += 1) {
            if (!targets.has(index)) {
                const [copied] = await output.copyPages(source, [index]);
                output.addPage(copied);
                continue;
            }
            const rendered = await doc.renderPage(index);
            const image = await output.embedPng(await canvasToPngBytes(rendered.canvas));
            const size = pageViewSize(rendered);
            const page = output.addPage([size.width, size.height]);
            page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
            drawHeaderOnPage(page, cfg, ctx);
        }

        return toBlob(await output.save());
    }

    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const ctx = await buildContext(pdfDoc, cfg);

    const source = doc.first;
    const isJpg = /\.jpe?g$/i.test(doc.fileName);
    const image = isJpg ? await pdfDoc.embedJpg(doc.bytes.slice()) : await pdfDoc.embedPng(doc.bytes.slice());

    const ratio = source.widthPt / source.heightPt;
    const size = ratio > 1 ? { width: A4.height, height: A4.width } : A4;
    const page = pdfDoc.addPage([size.width, size.height]);
    page.drawImage(image, { x: 0, y: 0, width: size.width, height: size.height });
    if (targets.has(0)) drawHeaderOnPage(page, cfg, ctx);

    return toBlob(await pdfDoc.save());
}
