import type { Box, TextSpan } from "./types";

/** Algılanan bir bölüm: faturanın mantıksal olarak bir arada duran parçası. */
/** Bölümü sınırlayan yatay çizgiler; seçildiğinde aynısı yeniden çizilir. */
export interface SectionRules {
    top: boolean;
    bottom: boolean;
    /** Kutu yüksekliğine oranla çizgi kalınlığı. */
    thickness: number;
    color: string;
}

export interface Section {
    box: Box;
    label: string;
    /** "block": üstünde/altında çizgi olan tam blok, "group": tek bir satır kümesi. */
    level: "block" | "group";
    rules: SectionRules | null;
    /**
     * Bölümdeki özgün yazının tipik boyu (sayfa yüksekliğine oran). Yeni başlık
     * bu ölçüye eşitlenir, böylece punto faturanın kendi puntosuyla uyuşur.
     */
    textHeight: number;
    /**
     * Komşu içeriğe dokunmadan kapatma alanının dışa taşabileceği pay
     * (sayfa yüksekliğine oran).
     */
    safeBleed: number;
}

/** Çözümleme bu genişliğe küçültülerek yapılır; hız ve tutarlılık için. */
const WORK_WIDTH = 900;

interface Grid {
    lum: Uint8Array;
    /** Renk örneklemek için ham piksel verisi (RGBA). */
    data: Uint8ClampedArray;
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

    return { lum, data, w, h, bg };
}

const INK_THRESHOLD = 34;

/**
 * Kenar yumuşatma izleri için daha duyarlı eşik. Bir kutu bu eşikle dışa doğru
 * büyütülür; aksi hâlde soluk gri kenar pikselleri kapatmanın dışında kalır ve
 * çıktıda "kaçak" olarak görünür.
 */
const FAINT_THRESHOLD = 6;

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

/** Bir çizgi satırının yatay uzanımını ve rengini ölçer. */
function measureRule(grid: Grid, rule: Range): { left: number; right: number; color: string } {
    const { lum, data, w, bg } = grid;
    let left = w;
    let right = -1;
    let darkest = 255;
    let color = "#111111";

    for (let y = rule.start; y <= rule.end; y += 1) {
        const base = y * w;
        for (let x = 0; x < w; x += 1) {
            if (Math.abs(lum[base + x] - bg) <= INK_THRESHOLD) continue;
            if (x < left) left = x;
            if (x > right) right = x;
            if (lum[base + x] < darkest) {
                darkest = lum[base + x];
                const offset = (base + x) * 4;
                color = `#${[data[offset], data[offset + 1], data[offset + 2]]
                    .map((value) => value.toString(16).padStart(2, "0"))
                    .join("")}`;
            }
        }
    }

    return { left: Math.min(left, w - 1), right: Math.max(right, 0), color };
}

/**
 * Yatay çizgileri bulur. Ölçüt, satırdaki toplam mürekkep değil kesintisiz en
 * uzun parçadır: böylece yalnızca bir sütun genişliğindeki çizgiler de bulunur,
 * yoğun yazı satırları ise (parçaları kısa olduğu için) çizgi sayılmaz.
 */
function findRules(grid: Grid): Range[] {
    const { lum, w, h, bg } = grid;
    const minRun = Math.max(24, w * 0.18);
    const rules: Range[] = [];
    let start = -1;

    for (let y = 0; y < h; y += 1) {
        const base = y * w;
        let run = 0;
        let longest = 0;
        for (let x = 0; x < w; x += 1) {
            if (Math.abs(lum[base + x] - bg) > INK_THRESHOLD) {
                run += 1;
                if (run > longest) longest = run;
            } else {
                run = 0;
            }
        }

        const isRule = longest >= minRun;
        if (isRule && start < 0) start = y;
        if (!isRule && start >= 0) {
            rules.push({ start, end: y - 1 });
            start = -1;
        }
    }
    if (start >= 0) rules.push({ start, end: h - 1 });

    // Çok kalın "çizgiler" aslında dolu alanlardır; onları saymıyoruz.
    return rules.filter((rule) => rule.end - rule.start < h * 0.02);
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

interface BandInk {
    faint: boolean;
    strong: boolean;
}

function scanBand(grid: Grid, x0: number, x1: number, y0: number, y1: number): BandInk {
    const { lum, w, h, bg } = grid;
    const left = Math.max(0, x0);
    const right = Math.min(w - 1, x1);
    const top = Math.max(0, y0);
    const bottom = Math.min(h - 1, y1);
    const result: BandInk = { faint: false, strong: false };
    if (left > right || top > bottom) return result;

    for (let y = top; y <= bottom; y += 1) {
        const base = y * w;
        for (let x = left; x <= right; x += 1) {
            const delta = Math.abs(lum[base + x] - bg);
            if (delta > INK_THRESHOLD) {
                result.strong = true;
                return result;
            }
            if (delta > FAINT_THRESHOLD) result.faint = true;
        }
    }
    return result;
}

/**
 * Yalnızca soluk kenar izi olan şerit: harf kuyruğunun/yumuşatmanın devamıdır,
 * komşu içerik değildir. Güçlü mürekkep görülürse büyüme durur.
 */
function bandIsHalo(grid: Grid, x0: number, x1: number, y0: number, y1: number): boolean {
    const band = scanBand(grid, x0, x1, y0, y1);
    return band.faint && !band.strong;
}

/**
 * Kutuyu, komşu şeritte mürekkep kalmayana kadar dışa büyütür. Böylece harf
 * kuyrukları ve yumuşatma izleri kapatmanın içinde kalır; büyüme sınırlıdır ki
 * komşu blok yutulmasın.
 */
function expandForInk(grid: Grid, box: Box, limit: number): Box {
    let { x, y, w, h } = box;

    for (let step = 0; step < limit && y > 0 && bandIsHalo(grid, x, x + w - 1, y - 1, y - 1); step += 1) {
        y -= 1;
        h += 1;
    }
    for (let step = 0; step < limit && y + h < grid.h && bandIsHalo(grid, x, x + w - 1, y + h, y + h); step += 1) {
        h += 1;
    }
    for (let step = 0; step < limit && x > 0 && bandIsHalo(grid, x - 1, x - 1, y, y + h - 1); step += 1) {
        x -= 1;
        w += 1;
    }
    for (let step = 0; step < limit && x + w < grid.w && bandIsHalo(grid, x + w, x + w, y, y + h - 1); step += 1) {
        w += 1;
    }

    return { x, y, w, h };
}

/**
 * Kutunun her yönünde, komşu içeriğe değmeden ne kadar taşabileceğini ölçer.
 * Kapatma dikdörtgeni bu kadar dışa taşırılabilir: kaçak kalmaz ama yandaki
 * tablo ya da yazı da örtülmez.
 */
function safeBleed(grid: Grid, box: Box, cap: number): number {
    const clear = (test: (step: number) => BandInk): number => {
        for (let step = 1; step <= cap; step += 1) {
            if (test(step).strong) return step - 1;
        }
        return cap;
    };

    return Math.min(
        clear((step) => scanBand(grid, box.x, box.x + box.w - 1, box.y - step, box.y - step)),
        clear((step) => scanBand(grid, box.x, box.x + box.w - 1, box.y + box.h - 1 + step, box.y + box.h - 1 + step)),
        clear((step) => scanBand(grid, box.x - step, box.x - step, box.y, box.y + box.h - 1)),
        clear((step) => scanBand(grid, box.x + box.w - 1 + step, box.x + box.w - 1 + step, box.y, box.y + box.h - 1)),
    );
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

/** Kutunun içindeki yazıların tipik boyu (sayfa oranı). */
function textHeightIn(box: Box, spans: TextSpan[]): number {
    const heights = spans
        .filter(
            (span) =>
                span.x + span.w / 2 >= box.x &&
                span.x + span.w / 2 <= box.x + box.w &&
                span.y + span.h / 2 >= box.y &&
                span.y + span.h / 2 <= box.y + box.h &&
                span.h > 0,
        )
        .map((span) => span.h)
        .sort((a, b) => a - b);

    if (heights.length === 0) return 0;
    return heights[Math.floor(heights.length / 2)];
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
    const rules = findRules(grid);
    const groups = findGroups(counts, grid, rules);
    if (groups.length === 0) return [];

    const minArea = 0.0006;
    const minHeight = Math.max(4, grid.h * 0.004);
    const candidates: {
        box: Box;
        level: Section["level"];
        rules: SectionRules | null;
        safeBleed: number;
        area: number;
    }[] = [];

    // Kaçak payı: harf kuyrukları ve yumuşatma izleri kadar, komşu bloğa
    // taşmayacak kadar.
    const expandLimit = Math.max(3, Math.round(grid.h * 0.01));
    // Taşma payı en fazla bu kadar olabilir (yaklaşık 6 pt).
    const bleedCap = Math.max(2, Math.round(grid.h * 0.0075));

    const push = (raw: Box | null, level: Section["level"], rules: SectionRules | null = null): void => {
        if (!raw || raw.h < minHeight) return;
        const box = expandForInk(grid, raw, expandLimit);
        const fraction = toFraction(box, grid);
        const area = fraction.w * fraction.h;
        if (area < minArea) return;
        // Çizgili bloklarda çizgi zaten kutunun kenarındadır; taşma payı ölçülürken
        // kendi çizgisini komşu saymaması için bir piksel içeriden bakılır.
        const probe = rules
            ? { x: box.x + 1, y: box.y + 1, w: Math.max(1, box.w - 2), h: Math.max(1, box.h - 2) }
            : box;
        candidates.push({ box: fraction, level, rules, safeBleed: safeBleed(grid, probe, bleedCap) / grid.h, area });
    };

    // Çizgiler yatay uzanımlarıyla birlikte tutulur: sağdaki bir tablonun kenarı,
    // soldaki bir bloğu ortadan kesmesin.
    const ruleInfos = rules.map((range) => ({ range, ...measureRule(grid, range) }));

    // Her satır kümesi sütunlarına ayrılır; bunlar en küçük seçilebilir parçalar.
    const cells: Box[] = [];
    for (const group of groups) {
        for (const column of findColumns(grid, [group])) {
            const box = tighten(grid, group, column);
            if (box) cells.push(box);
        }
    }
    for (const cell of cells) push(cell, "group");

    /**
     * İki kutunun yatay örtüşme oranı, genişinin üzerinden. Böylece sayfa boyu
     * uzanan bir satır, tek sütunluk bir bloğu yutmaz.
     */
    const shareX = (a: Box, b: Box): number => {
        const left = Math.max(a.x, b.x);
        const right = Math.min(a.x + a.w, b.x + b.w);
        if (right <= left) return 0;
        return (right - left) / Math.max(a.w, b.w);
    };

    const spansColumn = (rule: (typeof ruleInfos)[number], box: Box): boolean =>
        rule.right >= box.x + box.w * 0.25 && rule.left <= box.x + box.w * 0.75;

    /** İki kutu arasında, o sütunu kesen bir çizgi var mı. */
    const ruleBetween = (upper: Box, lower: Box): boolean =>
        ruleInfos.some(
            (rule) =>
                rule.range.start >= upper.y + upper.h - 1 &&
                rule.range.end <= lower.y + 1 &&
                spansColumn(rule, upper) &&
                spansColumn(rule, lower),
        );

    // Aynı sütundaki parçalar, aralarında çizgi yoksa tek bloğa birleştirilir.
    const mergeGap = grid.h * 0.022;
    const maxBlockHeight = grid.h * 0.4;
    const blocks: Box[] = [];

    for (const cell of [...cells].sort((a, b) => a.y - b.y)) {
        const previous = blocks[blocks.length - 1];
        const mergeable =
            previous &&
            shareX(previous, cell) > 0.5 &&
            cell.y - (previous.y + previous.h) <= mergeGap &&
            !ruleBetween(previous, cell) &&
            cell.y + cell.h - previous.y <= maxBlockHeight;

        if (mergeable) {
            const x = Math.min(previous.x, cell.x);
            const right = Math.max(previous.x + previous.w, cell.x + cell.w);
            blocks[blocks.length - 1] = {
                x,
                y: previous.y,
                w: right - x,
                h: cell.y + cell.h - previous.y,
            };
            continue;
        }
        blocks.push({ ...cell });
    }

    // Blokları çerçeveleyen çizgiler kutuya katılır ve aynısı yeniden çizilir.
    const nearRule = grid.h * 0.035;
    for (const block of blocks) {
        // Çizgi bloktan çok daha genişse o bloğun çerçevesi değildir (tek bir
        // kelimeyi, sütun boyu bir çizgiyle çerçevelemeyelim).
        const belongsTo = (rule: (typeof ruleInfos)[number]): boolean =>
            spansColumn(rule, block) && rule.right - rule.left <= block.w * 2.5;

        const above = ruleInfos
            .filter((rule) => rule.range.end <= block.y && block.y - rule.range.end <= nearRule && belongsTo(rule))
            .sort((a, b) => b.range.end - a.range.end)[0];
        const below = ruleInfos
            .filter(
                (rule) =>
                    rule.range.start >= block.y + block.h &&
                    rule.range.start - (block.y + block.h) <= nearRule &&
                    belongsTo(rule),
            )
            .sort((a, b) => a.range.start - b.range.start)[0];

        // Yalnızca dikeyde büyütülür: çizgiler bloğun genişliğinde yeniden çizilir,
        // kutu sayfa boyunca genişletilmez.
        let framed = { ...block };
        if (above) framed = { ...framed, y: above.range.start, h: framed.h + (framed.y - above.range.start) };
        if (below) framed = { ...framed, h: below.range.end - framed.y + 1 };

        const thicknessPx = Math.max(
            above ? above.range.end - above.range.start + 1 : 0,
            below ? below.range.end - below.range.start + 1 : 0,
        );

        push(
            framed,
            "block",
            above || below
                ? {
                      top: Boolean(above),
                      bottom: Boolean(below),
                      thickness: Math.max(0.0004, thicknessPx / grid.h),
                      color: above?.color ?? below?.color ?? "#111111",
                  }
                : null,
        );
    }

    // Blok seviyesi öncelikli, birbirinin aynısı olanlar teke indirilir.
    const ordered = candidates.sort((a, b) => (a.level === b.level ? b.area - a.area : a.level === "block" ? -1 : 1));
    const unique: { box: Box; level: Section["level"]; rules: SectionRules | null; safeBleed: number }[] = [];
    for (const candidate of ordered) {
        if (unique.some((kept) => overlapRatio(kept.box, candidate.box) > 0.82)) continue;
        unique.push({
            box: candidate.box,
            level: candidate.level,
            rules: candidate.rules,
            safeBleed: candidate.safeBleed,
        });
    }

    return unique
        .sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x)
        .slice(0, 40)
        .map((item, index) => ({
            ...item,
            label: labelFor(item.box, spans, index),
            textHeight: textHeightIn(item.box, spans),
        }));
}

/** Etiketi karşılaştırılabilir bir imzaya çevirir. */
export function sectionSignature(label: string): string {
    return label
        .toLocaleLowerCase("tr")
        .replace(/[^\p{L}\s]/gu, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2)
        .join(" ");
}

/**
 * Yeni faturada, daha önce seçilen bölümün eşleniğini içeriğinden bulur.
 * Konum hatırlanmaz: sabit blok (kendi firma bilgileriniz) sayfanın başka bir
 * yerine kaymış olsa da metni aynı olduğu için bulunur. Müşteri bloğu gibi her
 * faturada değişen alanlar ise eşleşmez — bu istenen davranıştır.
 */
export function matchSection(sections: Section[], signature: string): Section | null {
    const wanted = new Set(signature.split(" ").filter(Boolean));
    if (wanted.size === 0) return null;

    let best: { section: Section; score: number } | null = null;
    for (const section of sections) {
        const tokens = new Set(sectionSignature(section.label).split(" ").filter(Boolean));
        if (tokens.size === 0) continue;
        let shared = 0;
        for (const token of wanted) if (tokens.has(token)) shared += 1;
        const score = shared / Math.max(wanted.size, tokens.size);
        if (!best || score > best.score) best = { section, score };
    }

    return best && best.score >= 0.6 ? best.section : null;
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
