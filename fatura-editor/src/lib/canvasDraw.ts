import { canvasFont } from "./fonts";
import { layoutHeader, type Measure } from "./layout";
import type { HeaderConfig } from "./types";

/** Yeni başlığı canvas üzerine çizer (önizleme ve PNG çıktısı için). */
export function drawHeaderOnCanvas(
    ctx: CanvasRenderingContext2D,
    cfg: HeaderConfig,
    pageW: number,
    pageH: number,
): void {
    const measure: Measure = (text, size, bold, spacing) => {
        ctx.font = canvasFont(size, bold, cfg.font);
        ctx.letterSpacing = `${spacing}px`;
        return ctx.measureText(text).width;
    };

    ctx.save();
    const layout = layoutHeader(cfg, pageW, pageH, measure);
    if (!layout) {
        ctx.restore();
        return;
    }

    ctx.beginPath();
    ctx.rect(layout.cover.x, layout.cover.y, layout.cover.w, layout.cover.h);
    ctx.clip();

    if (layout.fillBackground) {
        ctx.fillStyle = cfg.background;
        ctx.fillRect(layout.cover.x, layout.cover.y, layout.cover.w, layout.cover.h);
    }

    for (const rule of layout.rules) {
        ctx.fillStyle = layout.ruleColor;
        ctx.fillRect(rule.x, rule.y, rule.w, rule.h);
    }

    if (layout.logo && cfg.logo) {
        ctx.drawImage(cfg.logo.image, layout.logo.x, layout.logo.y, layout.logo.w, layout.logo.h);
    }

    ctx.textBaseline = "top";
    for (const item of layout.items) {
        ctx.font = canvasFont(item.size, item.bold, cfg.font);
        ctx.letterSpacing = `${item.spacing}px`;
        ctx.textAlign = item.align;
        ctx.fillStyle = item.color;
        ctx.fillText(item.text, item.x, item.top);
    }

    ctx.restore();
}

/** Sayfayı ve başlığı tek bir canvas'ta birleştirir. */
export function composePage(page: HTMLCanvasElement, cfg: HeaderConfig, withHeader: boolean): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = page.width;
    out.height = page.height;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas oluşturulamadı.");
    ctx.drawImage(page, 0, 0);
    if (withHeader) drawHeaderOnCanvas(ctx, cfg, out.width, out.height);
    return out;
}
