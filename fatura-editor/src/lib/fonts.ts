import regularUrl from "../assets/Roboto-Regular.ttf?url";
import boldUrl from "../assets/Roboto-Bold.ttf?url";

/** Önizleme ile PDF çıktısının birebir aynı olması için ikisi de aynı yazı tipini kullanır. */
export const FONT_FAMILY = "FaturaSans";

let loading: Promise<void> | null = null;

export function loadFonts(): Promise<void> {
    if (!loading) {
        loading = Promise.all([
            new FontFace(FONT_FAMILY, `url(${regularUrl})`, { weight: "400" }).load(),
            new FontFace(FONT_FAMILY, `url(${boldUrl})`, { weight: "700" }).load(),
        ]).then((faces) => {
            faces.forEach((face) => document.fonts.add(face));
        });
    }
    return loading;
}

export function canvasFont(size: number, bold: boolean): string {
    return `${bold ? "700" : "400"} ${size}px ${FONT_FAMILY}, Arial, sans-serif`;
}

let bytesCache: Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> | null = null;

/** PDF'e gömmek için yazı tipi baytları. */
export function fontBytes(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
    if (!bytesCache) {
        bytesCache = Promise.all([
            fetch(regularUrl).then((res) => res.arrayBuffer()),
            fetch(boldUrl).then((res) => res.arrayBuffer()),
        ]).then(([regular, bold]) => ({ regular, bold }));
    }
    return bytesCache;
}
