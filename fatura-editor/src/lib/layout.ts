import type { Align, HeaderConfig } from "./types";

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface TextItem {
    text: string;
    /** Hizalamaya göre çapa noktası (sol/orta/sağ). */
    x: number;
    /** Yazının üst kenarı. */
    top: number;
    size: number;
    bold: boolean;
    align: Align;
}

export interface HeaderLayout {
    box: Rect;
    fillBackground: boolean;
    logo: Rect | null;
    items: TextItem[];
}

/** Metin genişliğini ölçen fonksiyon; canvas ve PDF için ayrı ayrı verilir. */
export type Measure = (text: string, size: number, bold: boolean) => number;

function fitLogo(ratio: number, area: Rect): Rect {
    let w = area.w;
    let h = w / ratio;
    if (h > area.h) {
        h = area.h;
        w = h * ratio;
    }
    return { x: area.x, y: area.y + (area.h - h) / 2, w, h };
}

/** Satır kutuya sığmıyorsa yazı boyutunu küçültür. */
function shrinkToFit(text: string, size: number, bold: boolean, maxWidth: number, measure: Measure): number {
    if (maxWidth <= 0) return size;
    const width = measure(text, size, bold);
    if (width <= maxWidth) return size;
    return Math.max(1, (size * maxWidth) / width);
}

function anchor(area: Rect, align: Align): number {
    if (align === "center") return area.x + area.w / 2;
    if (align === "right") return area.x + area.w;
    return area.x;
}

/**
 * Başlık kutusunun yerleşimini hesaplar. Saf bir fonksiyondur: hem ekrandaki
 * önizleme hem de PDF çıktısı bunu kullanır, böylece ikisi birebir aynı olur.
 * Tüm ölçüler piksel/nokta cinsinden, sol-üst köşe orijinli döner.
 */
export function layoutHeader(cfg: HeaderConfig, pageW: number, pageH: number, measure: Measure): HeaderLayout | null {
    const box: Rect = {
        x: cfg.box.x * pageW,
        y: cfg.box.y * pageH,
        w: cfg.box.w * pageW,
        h: cfg.box.h * pageH,
    };
    if (box.w <= 0 || box.h <= 0) return null;

    const layout: HeaderLayout = {
        box,
        fillBackground: !cfg.transparentBackground,
        logo: null,
        items: [],
    };

    const pad = cfg.padding * box.h;
    const inner: Rect = { x: box.x + pad, y: box.y + pad, w: box.w - pad * 2, h: box.h - pad * 2 };
    if (inner.w <= 0 || inner.h <= 0) return layout;

    let textArea: Rect = inner;

    if (cfg.logo && cfg.logoPosition !== "none") {
        const gap = inner.h * 0.06;
        if (cfg.logoPosition === "left") {
            const placed = fitLogo(cfg.logo.ratio, { x: inner.x, y: inner.y, w: inner.w * cfg.logoScale, h: inner.h });
            layout.logo = placed;
            textArea = { x: placed.x + placed.w + gap, y: inner.y, w: inner.w - placed.w - gap, h: inner.h };
        } else {
            const area: Rect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h * cfg.logoScale };
            const placed = fitLogo(cfg.logo.ratio, area);
            if (cfg.align === "center") placed.x = inner.x + (inner.w - placed.w) / 2;
            if (cfg.align === "right") placed.x = inner.x + inner.w - placed.w;
            layout.logo = placed;
            textArea = { x: inner.x, y: area.y + area.h + gap, w: inner.w, h: inner.h - area.h - gap };
        }
    }

    if (textArea.w <= 0 || textArea.h <= 0) return layout;

    const name = cfg.companyName.trim();
    const lines = cfg.addressText.split("\n").filter((line) => line.trim() !== "");

    const nameSize = name === "" ? 0 : shrinkToFit(name, cfg.nameSize * box.h, cfg.bold, textArea.w, measure);
    const lineSizes = lines.map((line) => shrinkToFit(line, cfg.lineSize * box.h, false, textArea.w, measure));

    const rawHeight =
        (name === "" ? 0 : nameSize * cfg.lineGap) + lineSizes.reduce((sum, size) => sum + size * cfg.lineGap, 0);

    // Metin kutuya dikey olarak sığmıyorsa tüm blok orantılı küçültülür; böylece
    // hiçbir satır kutunun dışına taşmaz.
    const squeeze = rawHeight > textArea.h && rawHeight > 0 ? textArea.h / rawHeight : 1;
    const blockHeight = rawHeight * squeeze;

    const x = anchor(textArea, cfg.align);
    let top = textArea.y + Math.max(0, (textArea.h - blockHeight) / 2);

    if (name !== "") {
        const size = nameSize * squeeze;
        layout.items.push({ text: name, x, top, size, bold: cfg.bold, align: cfg.align });
        top += size * cfg.lineGap;
    }
    lines.forEach((line, index) => {
        const size = lineSizes[index] * squeeze;
        layout.items.push({ text: line, x, top, size, bold: false, align: cfg.align });
        top += size * cfg.lineGap;
    });

    return layout;
}
