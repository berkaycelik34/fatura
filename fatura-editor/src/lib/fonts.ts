import interBoldUrl from "../assets/Inter-Bold.ttf?url";
import interRegularUrl from "../assets/Inter-Regular.ttf?url";
import robotoBoldUrl from "../assets/Roboto-Bold.ttf?url";
import robotoRegularUrl from "../assets/Roboto-Regular.ttf?url";

export type FontId = "inter" | "roboto";

interface FontDefinition {
    id: FontId;
    label: string;
    note: string;
    /** Canvas'ta kullanılan aile adı; PDF'e gömülen dosyayla birebir aynı yazı tipi. */
    family: string;
    regular: string;
    bold: string;
}

/** Başlıkta kullanılabilecek yazı tipleri. Türkçe karakterlerin tümünü kapsarlar. */
export const FONTS: FontDefinition[] = [
    {
        id: "inter",
        label: "Modern",
        note: "Inter — arayüzdeki yazı tipi, ferah ve çağdaş görünür.",
        family: "FaturaInter",
        regular: interRegularUrl,
        bold: interBoldUrl,
    },
    {
        id: "roboto",
        label: "Nötr",
        note: "Roboto — klasik fatura çıktılarına daha yakın durur.",
        family: "FaturaRoboto",
        regular: robotoRegularUrl,
        bold: robotoBoldUrl,
    },
];

export function fontById(id: FontId): FontDefinition {
    return FONTS.find((font) => font.id === id) ?? FONTS[0];
}

let loading: Promise<void> | null = null;

/** Önizleme ile PDF çıktısının birebir aynı olması için tüm yazı tiplerini yükler. */
export function loadFonts(): Promise<void> {
    if (!loading) {
        const faces = FONTS.flatMap((font) => [
            new FontFace(font.family, `url(${font.regular})`, { weight: "400" }),
            new FontFace(font.family, `url(${font.bold})`, { weight: "700" }),
        ]);
        loading = Promise.all(faces.map((face) => face.load())).then((loaded) => {
            loaded.forEach((face) => document.fonts.add(face));
        });
    }
    return loading;
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
