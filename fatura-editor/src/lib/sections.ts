import type { Box, TextSpan } from "./types";

/** Algılanan bir bölüm: faturanın mantıksal olarak bir arada duran parçası. */
export interface Section {
    box: Box;
    label: string;
    /** "block": üstünde/altında çizgi olan tam blok, "group": tek bir satır kümesi. */
    level: "block" | "group";
}

/** Çözümleme bu genişliğe küçültülerek yapılır; hız ve tutarlılık için. */
const WORK_WIDTH = 900;

interface Grid {
    lum: Uint8Array;
    w: number;
    h: number;
    bg: number;
}

function toGrid(canvas: HTMLCanvasElement): Grid | null {
    const scale = Math.min(1, WORK_WIDTH / canvas.width);
    const w = Math.max(1, Math.round(canvas.width * scale));
    const h = Math.max(1, Math.round(canvas.height * scale));

    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    const ctx = work.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(canvas, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    const lum = new Uint8Array(w * h);
    const histogram = new Uint32Array(256);

    for (let i = 0; i < w * h; i += 1) {
        const offset = i * 4;
        // Saydam pikseller arka plan sayılır.
        const value =
            data[offset + 3] < 16
                ? 255
                : (data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114) | 0;
        lum[i] = value;
        histogram[value] += 1;
    }

    // En sık görülen parlaklık, sayfanın arka planıdır.
    let bg = 255;
    let bestCount = 0;
    for (let value = 0; value < 256; value += 1) {
        if (histogram[value] > bestCount) {
            bestCount = histogram[value];
            bg = value;
        }
    }

    return { lum, w, h, bg };
}

const INK_THRESHOLD = 34;

function rowProfile(grid: Grid): Uint32Array {
    const { lum, w, h, bg } = grid;
    const counts = new Uint32Array(h);
    for (let y = 0; y < h; y += 1) {
        const base = y * w;
        let count = 0;
        for (let x = 0; x < w; x += 1) {
            if (Math.abs(lum[base + x] - bg) > INK_THRESHOLD) count += 1;
        }
        counts[y] = count;
    }
    return counts;
}

interface Range {
    start: number;
    end: number;
}

/** Sayfa genişliğinin büyük bölümünü kaplayan satırlar: yatay çizgiler. */
function findRules(counts: Uint32Array, grid: Grid): Range[] {
    const limit = grid.w * 0.4;
    const rules: Range[] = [];
    let start = -1;
    for (let y = 0; y < grid.h; y += 1) {
        const isRule = counts[y] > limit;
        if (isRule && start < 0) start = y;
        if (!isRule && start >= 0) {
            rules.push({ start, end: y - 1 });
            start = -1;
        }
    }
    if (start >= 0) rules.push({ start, end: grid.h - 1 });
    // Çok kalın "çizgiler" aslında dolu alanlardır; onları saymıyoruz.
    return rules.filter((rule) => rule.end - rule.start < grid.h * 0.02);
}

/** Ardışık yazı satırlarını, aralarındaki boşluğa göre kümelere ayırır. */
function findGroups(counts: Uint32Array, grid: Grid, rules: Range[]): Range[] {
    const isRule = new Uint8Array(grid.h);
    for (const rule of rules) {
        for (let y = rule.start; y <= rule.end; y += 1) isRule[y] = 1;
    }

    const minInk = Math.max(2, grid.w * 0.002);
    const gapTolerance = Math.max(3, Math.round(grid.h * 0.009));

    const groups: Range[] = [];
    let start = -1;
    let blank = 0;

    for (let y = 0; y < grid.h; y += 1) {
        const hasText = !isRule[y] && counts[y] > minInk;
        if (hasText) {
            if (start < 0) start = y;
            blank = 0;
            continue;
        }
        if (start < 0) continue;
        blank += 1;
        if (blank > gapTolerance) {
            groups.push({ start, end: y - blank });
            start = -1;
            blank = 0;
        }
    }
    if (start >= 0) groups.push({ start, end: grid.h - 1 - blank });
    return groups;
}

/** Satır kümesi içindeki sütunları, geniş boşluklardan ayırır. */
function findColumns(grid: Grid, rows: Range[]): Range[] {
    const { lum, w, bg } = grid;
    const counts = new Uint32Array(w);
    for (const range of rows) {
        for (let y = range.start; y <= range.end; y += 1) {
            const base = y * w;
            for (let x = 0; x < w; x += 1) {
                if (Math.abs(lum[base + x] - bg) > INK_THRESHOLD) counts[x] += 1;
            }
        }
    }

    const gapTolerance = Math.max(6, Math.round(w * 0.022));
    const columns: Range[] = [];
    let start = -1;
    let blank = 0;

    for (let x = 0; x < w; x += 1) {
        if (counts[x] > 0) {
            if (start < 0) start = x;
            blank = 0;
            continue;
        }
        if (start < 0) continue;
        blank += 1;
        if (blank > gapTolerance) {
            columns.push({ start, end: x - blank });
            start = -1;
            blank = 0;
        }
    }
    if (start >= 0) columns.push({ start, end: w - 1 - blank });
    return columns;
}

/** Verilen dikdörtgeni, içindeki mürekkebe göre daraltır. */
function tighten(grid: Grid, rows: Range, columns: Range): Box | null {
    const { lum, w, bg } = grid;
    let top = -1;
    let bottom = -1;
    let left = columns.end;
    let right = columns.start;

    for (let y = rows.start; y <= rows.end; y += 1) {
        const base = y * w;
        let found = false;
        for (let x = columns.start; x <= columns.end; x += 1) {
            if (Math.abs(lum[base + x] - bg) > INK_THRESHOLD) {
                found = true;
                if (x < left) left = x;
                if (x > right) right = x;
            }
        }
        if (found) {
            if (top < 0) top = y;
            bottom = y;
        }
    }

    if (top < 0 || right < left) return null;
    return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

/** Kutuyu biraz genişletip sayfa oranlarına çevirir. */
function toFraction(box: Box, grid: Grid): Box {
    const padX = Math.max(2, grid.w * 0.005);
    const padY = Math.max(2, grid.h * 0.003);
    const x = Math.max(0, box.x - padX);
    const y = Math.max(0, box.y - padY);
    const right = Math.min(grid.w, box.x + box.w + padX);
    const bottom = Math.min(grid.h, box.y + box.h + padY);
    return { x: x / grid.w, y: y / grid.h, w: (right - x) / grid.w, h: (bottom - y) / grid.h };
}

function overlapRatio(a: Box, b: Box): number {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);
    if (right <= x || bottom <= y) return 0;
    const overlap = (right - x) * (bottom - y);
    return overlap / (a.w * a.h + b.w * b.h - overlap);
}

/** Kutunun içine düşen ilk yazı satırından bir etiket üretir. */
function labelFor(box: Box, spans: TextSpan[], index: number): string {
    const inside = spans
        .filter(
            (span) =>
                span.x + span.w / 2 >= box.x &&
                span.x + span.w / 2 <= box.x + box.w &&
                span.y + span.h / 2 >= box.y &&
                span.y + span.h / 2 <= box.y + box.h,
        )
        .sort((a, b) => a.y - b.y || a.x - b.x);

    const text = inside
        .slice(0, 3)
        .map((span) => span.text.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

    if (text === "") return `Bölüm ${index + 1}`;
    return text.length > 46 ? `${text.slice(0, 45)}…` : text;
}

/**
 * Faturanın çizilmiş hâlinden mantıksal bölümleri çıkarır: yatay çizgiler
 * arasındaki bloklar ve bunların sütunları. Böylece "üstünde ve altında çizgi
 * olan adres bloğu" gibi alanlar tek tıkla seçilebilir.
 */
export function detectSections(canvas: HTMLCanvasElement, spans: TextSpan[] = []): Section[] {
    const grid = toGrid(canvas);
    if (!grid) return [];

    const counts = rowProfile(grid);
    const rules = findRules(counts, grid);
    const groups = findGroups(counts, grid, rules);
    if (groups.length === 0) return [];

    const minArea = 0.0006;
    const minHeight = Math.max(4, grid.h * 0.004);
    const candidates: { box: Box; level: Section["level"]; area: number }[] = [];

    const push = (box: Box | null, level: Section["level"]): void => {
        if (!box || box.h < minHeight) return;
        const fraction = toFraction(box, grid);
        const area = fraction.w * fraction.h;
        if (area < minArea) return;
        candidates.push({ box: fraction, level, area });
    };

    // Çizgilerle sınırlanmış bölgeler: aradaki tüm satır kümeleri tek blok sayılır.
    const boundaries = [0, ...rules.map((rule) => (rule.start + rule.end) / 2), grid.h - 1];
    for (let i = 0; i < boundaries.length - 1; i += 1) {
        const top = boundaries[i];
        const bottom = boundaries[i + 1];
        if (bottom - top > grid.h * 0.5) continue;

        const inside = groups.filter((group) => group.start >= top - 1 && group.end <= bottom + 1);
        if (inside.length === 0) continue;

        const span: Range = {
            start: Math.min(...inside.map((group) => group.start)),
            end: Math.max(...inside.map((group) => group.end)),
        };
        for (const column of findColumns(grid, inside)) {
            push(tighten(grid, span, column), "block");
        }
    }

    // Tek tek satır kümeleri: çizgi olmayan faturalarda da bölüm çıkarır.
    for (const group of groups) {
        for (const column of findColumns(grid, [group])) {
            push(tighten(grid, group, column), "group");
        }
    }

    // Blok seviyesi öncelikli, birbirinin aynısı olanlar teke indirilir.
    const ordered = candidates.sort((a, b) => (a.level === b.level ? b.area - a.area : a.level === "block" ? -1 : 1));
    const unique: { box: Box; level: Section["level"] }[] = [];
    for (const candidate of ordered) {
        if (unique.some((kept) => overlapRatio(kept.box, candidate.box) > 0.82)) continue;
        unique.push({ box: candidate.box, level: candidate.level });
    }

    return unique
        .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
        .slice(0, 40)
        .map((item, index) => ({ ...item, label: labelFor(item.box, spans, index) }));
}

/** İmlecin altındaki en küçük bölüm; bloklar satır kümelerine göre önceliklidir. */
export function sectionAt(sections: Section[], x: number, y: number): Section | null {
    const containing = sections.filter(
        (section) =>
            x >= section.box.x &&
            x <= section.box.x + section.box.w &&
            y >= section.box.y &&
            y <= section.box.y + section.box.h,
    );
    if (containing.length === 0) return null;

    const blocks = containing.filter((section) => section.level === "block");
    const pool = blocks.length > 0 ? blocks : containing;
    return pool.reduce((best, section) => (section.box.w * section.box.h < best.box.w * best.box.h ? section : best));
}
