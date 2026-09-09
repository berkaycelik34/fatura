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
    /** Harf aralığı (piksel/nokta). */
    spacing: number;
    color: string;
}

export interface HeaderLayout {
    box: Rect;
    fillBackground: boolean;
    logo: Rect | null;
    items: TextItem[];
    /** Bloğu çerçeveleyen yatay çizgiler. */
    rules: Rect[];
    ruleColor: string;
}

/** Metin genişliğini ölçen fonksiyon; canvas ve PDF için ayrı ayrı verilir. */
export type Measure = (text: string, size: number, bold: boolean, spacing: number) => number;

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
function shrinkToFit(
    text: string,
    size: number,
    bold: boolean,
    spacing: number,
    maxWidth: number,
    measure: Measure,
): number {
    if (maxWidth <= 0) return size;
    const width = measure(text, size, bold, spacing);
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
 * Tüm ölçüler piksel/nokta cinsinden, sol-üst köşe orijinlidir.
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
        rules: [],
        ruleColor: cfg.ruleColor,
    };

    // Çizgiler kutunun üst/alt kenarına oturur; içerik onların arasında kalır.
    const ruleH = Math.max(0, cfg.ruleThickness * box.h);
    const inset = cfg.ruleInset * box.w;
    if (cfg.ruleTop && ruleH > 0) {
        layout.rules.push({ x: box.x + inset, y: box.y, w: Math.max(0, box.w - inset * 2), h: ruleH });
    }
    if (cfg.ruleBottom && ruleH > 0) {
        layout.rules.push({
            x: box.x + inset,
            y: box.y + box.h - ruleH,
            w: Math.max(0, box.w - inset * 2),
            h: ruleH,
        });
    }

    const content: Rect = {
        x: box.x,
        y: box.y + (cfg.ruleTop ? ruleH : 0),
        w: box.w,
        h: box.h - (cfg.ruleTop ? ruleH : 0) - (cfg.ruleBottom ? ruleH : 0),
    };
    if (content.h <= 0) return layout;

    const pad = cfg.padding * box.h;
    const inner: Rect = { x: content.x + pad, y: content.y + pad, w: content.w - pad * 2, h: content.h - pad * 2 };
    if (inner.w <= 0 || inner.h <= 0) return layout;

    let textArea: Rect = inner;

    if (cfg.logo && cfg.logoPosition !== "none") {
        const gap = cfg.logoGap * box.h;
        if (cfg.logoPosition === "top") {
            const area: Rect = { x: inner.x, y: inner.y, w: inner.w, h: inner.h * cfg.logoScale };
            const placed = fitLogo(cfg.logo.ratio, area);
            if (cfg.align === "center") placed.x = inner.x + (inner.w - placed.w) / 2;
            if (cfg.align === "right") placed.x = inner.x + inner.w - placed.w;
            layout.logo = placed;
            textArea = { x: inner.x, y: area.y + area.h + gap, w: inner.w, h: inner.h - area.h - gap };
        } else {
            const width = inner.w * cfg.logoScale;
            const onLeft = cfg.logoPosition === "left";
            const area: Rect = { x: onLeft ? inner.x : inner.x + inner.w - width, y: inner.y, w: width, h: inner.h };
            const placed = fitLogo(cfg.logo.ratio, area);
            if (!onLeft) placed.x = area.x + area.w - placed.w;
            layout.logo = placed;
            textArea = {
                x: onLeft ? placed.x + placed.w + gap : inner.x,
                y: inner.y,
                w: inner.w - placed.w - gap,
                h: inner.h,
            };
        }

        layout.logo.x += cfg.logoOffsetX * box.h;
        layout.logo.y += cfg.logoOffsetY * box.h;
    }

    if (textArea.w <= 0 || textArea.h <= 0) return layout;
    textArea = {
        x: textArea.x + cfg.textOffsetX * box.h,
        y: textArea.y + cfg.textOffsetY * box.h,
        w: textArea.w,
        h: textArea.h,
    };

    const name = cfg.nameUppercase ? cfg.companyName.trim().toLocaleUpperCase("tr") : cfg.companyName.trim();
    const lines = cfg.lines.map((line) => line.trim()).filter((line) => line !== "");

    const nameSpacing = cfg.nameSpacing * box.h;
    const lineSpacing = cfg.lineSpacing * box.h;

    const nameSize =
        name === "" ? 0 : shrinkToFit(name, cfg.nameSize * box.h, cfg.nameBold, nameSpacing, textArea.w, measure);
    const lineSizes = lines.map((line) =>
        shrinkToFit(line, cfg.lineSize * box.h, false, lineSpacing, textArea.w, measure),
    );

    const nameBlock = name === "" ? 0 : nameSize * cfg.lineGap + (lines.length > 0 ? cfg.nameGap * box.h : 0);
    const rawHeight = nameBlock + lineSizes.reduce((sum, size) => sum + size * cfg.lineGap, 0);

    // Metin kutuya dikey olarak sığmıyorsa tüm blok orantılı küçültülür.
    const squeeze = rawHeight > textArea.h && rawHeight > 0 ? textArea.h / rawHeight : 1;
    const blockHeight = rawHeight * squeeze;

    const x = anchor(textArea, cfg.align);
    let top = textArea.y;
    if (cfg.verticalAlign === "middle") top += Math.max(0, (textArea.h - blockHeight) / 2);
    if (cfg.verticalAlign === "bottom") top += Math.max(0, textArea.h - blockHeight);

    if (name !== "") {
        const size = nameSize * squeeze;
        layout.items.push({
            text: name,
            x,
            top,
            size,
            bold: cfg.nameBold,
            align: cfg.align,
            spacing: nameSpacing * squeeze,
            color: cfg.nameColor,
        });
        top += size * cfg.lineGap + (lines.length > 0 ? cfg.nameGap * box.h * squeeze : 0);
    }

    lines.forEach((line, index) => {
        const size = lineSizes[index] * squeeze;
        layout.items.push({
            text: line,
            x,
            top,
            size,
            bold: false,
            align: cfg.align,
            spacing: lineSpacing * squeeze,
            color: cfg.textColor,
        });
        top += size * cfg.lineGap;
    });

    return layout;
}
