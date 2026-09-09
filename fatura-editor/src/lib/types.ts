export type Align = "left" | "center" | "right";
export type LogoPosition = "left" | "top" | "none";

/** Sayfa üzerindeki dikdörtgen; değerler sayfa ölçüsüne oranlıdır (0..1). */
export interface Box {
    x: number;
    y: number;
    w: number;
    h: number;
}

export interface Logo {
    image: HTMLImageElement;
    /** PDF'e gömmek için ham veri. */
    bytes: Uint8Array;
    format: "png" | "jpg";
    ratio: number;
}

export interface HeaderConfig {
    companyName: string;
    /** Adres/iletişim satırları, satır sonlarıyla ayrılmış. */
    addressText: string;
    logo: Logo | null;
    logoPosition: LogoPosition;
    /** Logonun kutu içindeki payı (0..1). */
    logoScale: number;
    box: Box;
    background: string;
    /** Şeffaf seçilirse eski içerik kapatılmaz, üzerine yazılır. */
    transparentBackground: boolean;
    textColor: string;
    /** Yazı boyutları kutu yüksekliğine oranlıdır; her fatura ölçeğinde aynı görünür. */
    nameSize: number;
    lineSize: number;
    lineGap: number;
    padding: number;
    align: Align;
    bold: boolean;
}

/** Yüklenen belgenin ekranda gösterilen tek bir sayfası. */
export interface RenderedPage {
    canvas: HTMLCanvasElement;
    /** PDF nokta (pt) cinsinden gerçek sayfa ölçüsü. */
    widthPt: number;
    heightPt: number;
    /** Sayfanın PDF'teki dönüş açısı (0/90/180/270). */
    rotation: number;
}

export interface LoadedDocument {
    kind: "pdf" | "image";
    fileName: string;
    /** Orijinal dosya baytları; PDF çıktısı bunun üzerine çizilir. */
    bytes: Uint8Array;
    pages: RenderedPage[];
}

export const defaultHeaderConfig = (): HeaderConfig => ({
    companyName: "",
    addressText: "",
    logo: null,
    logoPosition: "left",
    logoScale: 0.3,
    box: { x: 0.04, y: 0.03, w: 0.46, h: 0.13 },
    background: "#ffffff",
    transparentBackground: false,
    textColor: "#111111",
    nameSize: 0.22,
    lineSize: 0.14,
    lineGap: 1.3,
    padding: 0.08,
    align: "left",
    bold: true,
});
