import type { FontId } from "./fonts";

export type Align = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";
export type LogoPosition = "left" | "right" | "top" | "none";

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
    /** Panelde küçük önizleme için kalıcı adres; logo değişince serbest bırakılır. */
    previewUrl: string;
}

/**
 * Başlığın tüm ayarları. Ölçüler kutu yüksekliğine oranlıdır; böylece kutu
 * boyutu değişse de yerleşim aynı kalır ve her fatura ölçeğinde aynı görünür.
 */
export interface HeaderConfig {
    // İçerik
    companyName: string;
    lines: string[];
    logo: Logo | null;

    // Konum
    box: Box;
    padding: number;
    align: Align;
    verticalAlign: VerticalAlign;
    logoPosition: LogoPosition;
    logoScale: number;
    logoGap: number;
    logoOffsetX: number;
    logoOffsetY: number;
    textOffsetX: number;
    textOffsetY: number;

    // Görünüm
    font: FontId;
    nameSize: number;
    nameBold: boolean;
    nameUppercase: boolean;
    nameSpacing: number;
    nameColor: string;
    nameGap: number;
    lineSize: number;
    lineGap: number;
    lineSpacing: number;
    textColor: string;
    background: string;
    transparentBackground: boolean;

    // Bloğu çerçeveleyen yatay çizgiler
    ruleTop: boolean;
    ruleBottom: boolean;
    /** Kutu yüksekliğine oranla çizgi kalınlığı. */
    ruleThickness: number;
    ruleColor: string;
    /** Çizgilerin yanlardan boşluğu (kutu genişliğine oran). */
    ruleInset: number;
}

/** Fatura metin katmanından bir parça; bölüm etiketleri için kullanılır. */
export interface TextSpan {
    x: number;
    y: number;
    w: number;
    h: number;
    text: string;
}

/** Bir sayfanın "gerekli mi" denetimi: GİB amblemi/QR ve e-fatura izleri. */
export interface PageAudit {
    index: number;
    /** Sayfadaki gömülü görsel sayısı (GİB amblemi ve QR kod bunlardır). */
    images: number;
    /** Metinde e-fatura/GİB/ETTN izleri var mı. */
    hasInvoiceMarks: boolean;
    /** Bu sayfa faturaya ait görünüyor mu. */
    looksRelevant: boolean;
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
    pageCount: number;
    /** Önizlemede gösterilen ilk sayfa. */
    first: RenderedPage;
    /** İlk sayfanın metin parçaları (varsa); bölüm etiketleri için. */
    firstPageText: TextSpan[];
    /** İstenen sayfayı çizer (düzleştirme modunda gerekir); sonuç önbelleğe alınır. */
    renderPage: (index: number) => Promise<RenderedPage>;
    /** Sayfaların GİB işareti/QR taşıyıp taşımadığını inceler. */
    auditPages: () => Promise<PageAudit[]>;
    /** Belge kapatılırken pdf.js kaynaklarını serbest bırakır. */
    destroy: () => void;
}

export const defaultHeaderConfig = (): HeaderConfig => ({
    companyName: "",
    lines: [""],
    logo: null,

    box: { x: 0.04, y: 0.03, w: 0.46, h: 0.13 },
    padding: 0.08,
    align: "left",
    verticalAlign: "middle",
    logoPosition: "left",
    logoScale: 0.3,
    logoGap: 0.06,
    logoOffsetX: 0,
    logoOffsetY: 0,
    textOffsetX: 0,
    textOffsetY: 0,

    font: "inter",
    nameSize: 0.22,
    nameBold: true,
    nameUppercase: false,
    nameSpacing: 0,
    nameColor: "#111111",
    nameGap: 0.04,
    lineSize: 0.14,
    lineGap: 1.3,
    lineSpacing: 0,
    textColor: "#111111",
    background: "#ffffff",
    transparentBackground: false,

    ruleTop: false,
    ruleBottom: false,
    ruleThickness: 0.012,
    ruleColor: "#111111",
    ruleInset: 0,
});
