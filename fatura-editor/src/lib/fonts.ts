import interBoldUrl from "../assets/Inter-Bold.ttf?url";
import interRegularUrl from "../assets/Inter-Regular.ttf?url";
import montserratBoldUrl from "../assets/Montserrat-Bold.ttf?url";
import montserratRegularUrl from "../assets/Montserrat-Regular.ttf?url";
import openSansBoldUrl from "../assets/OpenSans-Bold.ttf?url";
import openSansRegularUrl from "../assets/OpenSans-Regular.ttf?url";
import ptSerifBoldUrl from "../assets/PTSerif-Bold.ttf?url";
import ptSerifRegularUrl from "../assets/PTSerif-Regular.ttf?url";
import robotoBoldUrl from "../assets/Roboto-Bold.ttf?url";
import robotoRegularUrl from "../assets/Roboto-Regular.ttf?url";

export type FontId = "inter" | "montserrat" | "roboto" | "opensans" | "ptserif";

export interface FontDefinition {
    id: FontId;
    label: string;
    note: string;
    /** Canvas'ta kullanılan aile adı; PDF'e gömülen dosyayla birebir aynı yazı tipi. */
    family: string;
    regular: string;
    bold: string;
}

/** Başlıkta kullanılabilecek yazı tipleri; hepsi Türkçe karakterlerin tümünü kapsar. */
export const FONTS: FontDefinition[] = [
    {
        id: "inter",
        label: "Inter · Modern",
        note: "Ferah ve çağdaş. Ekran ve baskıda nötr durur.",
        family: "FaturaInter",
        regular: interRegularUrl,
        bold: interBoldUrl,
    },
    {
        id: "montserrat",
        label: "Montserrat · Kurumsal",
        note: "Geniş ve geometrik. Firma adı büyük yazıldığında etkili.",
        family: "FaturaMontserrat",
        regular: montserratRegularUrl,
        bold: montserratBoldUrl,
    },
    {
        id: "roboto",
        label: "Roboto · Nötr",
        note: "Klasik fatura çıktılarına en yakın duran seçenek.",
        family: "FaturaRoboto",
        regular: robotoRegularUrl,
        bold: robotoBoldUrl,
    },
    {
        id: "opensans",
        label: "Open Sans · Okunur",
        note: "Küçük puntoda bile rahat okunur; uzun adresler için iyi.",
        family: "FaturaOpenSans",
        regular: openSansRegularUrl,
        bold: openSansBoldUrl,
    },
    {
        id: "ptserif",
        label: "PT Serif · Klasik",
        note: "Tırnaklı. Resmî ve köklü bir görünüm verir.",
        family: "FaturaPTSerif",
        regular: ptSerifRegularUrl,
        bold: ptSerifBoldUrl,
    },
];

export function fontById(id: FontId): FontDefinition {
    return FONTS.find((font) => font.id === id) ?? FONTS[0];
}

const faceCache = new Map<FontId, Promise<void>>();

/**
 * Seçilen yazı tipini tarayıcıya yükler. Tümü baştan indirilmez; hangisi
 * kullanılıyorsa yalnızca o alınır.
 */
export function ensureFont(id: FontId): Promise<void> {
    const cached = faceCache.get(id);
    if (cached) return cached;

    const font = fontById(id);
    const promise = Promise.all([
        new FontFace(font.family, `url(${font.regular})`, { weight: "400" }).load(),
        new FontFace(font.family, `url(${font.bold})`, { weight: "700" }).load(),
    ]).then((faces) => {
        faces.forEach((face) => document.fonts.add(face));
    });

    faceCache.set(id, promise);
    return promise;
}

export function canvasFont(size: number, bold: boolean, id: FontId): string {
    return `${bold ? "700" : "400"} ${size}px ${fontById(id).family}, Arial, sans-serif`;
}

const bytesCache = new Map<FontId, Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }>>();

/** PDF'e gömmek için yazı tipi baytları. */
export function fontBytes(id: FontId): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
    const cached = bytesCache.get(id);
    if (cached) return cached;

    const font = fontById(id);
    const promise = Promise.all([
        fetch(font.regular).then((res) => res.arrayBuffer()),
        fetch(font.bold).then((res) => res.arrayBuffer()),
    ]).then(([regular, bold]) => ({ regular, bold }));
    bytesCache.set(id, promise);
    return promise;
}
