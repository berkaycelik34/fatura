import { useMemo, type ChangeEvent } from "react";
import type { PdfMode } from "../lib/exportPdf";
import { FONTS } from "../lib/fonts";
import type { Section } from "../lib/sections";
import type { Align, Box, HeaderConfig, LogoPosition } from "../lib/types";
import {
    CropIcon,
    DropperIcon,
    ImageIcon,
    InvoiceIcon,
    LayersIcon,
    AlertIcon,
    PagesIcon,
    ResetIcon,
    SparkIcon,
    TrashIcon,
    TypeIcon,
} from "./Icon";

interface Props {
    config: HeaderConfig;
    onChange: (patch: Partial<HeaderConfig>) => void;
    onLogoFile: (file: File | null) => void;
    onResetBox: () => void;
    picking: boolean;
    onTogglePicking: () => void;
    pdfMode: PdfMode;
    onPdfModeChange: (mode: PdfMode) => void;
    pageCount: number;
    firstPageOnly: boolean;
    onFirstPageOnlyChange: (value: boolean) => void;
    sections: Section[];
    selectMode: "section" | "free";
    onSelectModeChange: (mode: "section" | "free") => void;
    onPickSection: (box: Box) => void;
}

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    display?: (value: number) => string;
    onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, display, onChange }: SliderProps) {
    return (
        <label className="field">
            <span className="field-label">
                {label}
                <em>{display ? display(value) : `${Math.round(value * 100)}%`}</em>
            </span>
            <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </label>
    );
}

interface SwitchProps {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}

function Switch({ label, checked, onChange }: SwitchProps) {
    return (
        <label className="switch">
            <span>{label}</span>
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            <span className="switch-track" />
        </label>
    );
}

export default function ControlPanel({
    config,
    onChange,
    onLogoFile,
    onResetBox,
    picking,
    onTogglePicking,
    pdfMode,
    onPdfModeChange,
    pageCount,
    firstPageOnly,
    onFirstPageOnlyChange,
    sections,
    selectMode,
    onSelectModeChange,
    onPickSection,
}: Props) {
    const logoUrl = useMemo(() => config.logo?.previewUrl ?? null, [config.logo]);

    function handleLogo(event: ChangeEvent<HTMLInputElement>) {
        onLogoFile(event.target.files?.[0] ?? null);
        event.target.value = "";
    }

    return (
        <div className="panel">
            <section className="card">
                <div className="card-head">
                    <CropIcon />
                    <h2>Bölüm seçimi</h2>
                </div>
                <div className="seg">
                    <button
                        type="button"
                        className={selectMode === "section" ? "active" : ""}
                        disabled={sections.length === 0}
                        onClick={() => onSelectModeChange("section")}
                    >
                        Bölüm seç
                    </button>
                    <button
                        type="button"
                        className={selectMode === "free" ? "active" : ""}
                        onClick={() => onSelectModeChange("free")}
                    >
                        Serbest çiz
                    </button>
                </div>
                {sections.length === 0 ? (
                    <div className="mode-note warn">
                        <AlertIcon />
                        <p className="hint">
                            Bu faturada otomatik bölüm bulunamadı. Alanı fatura üzerinde sürükleyerek kendiniz
                            çizebilirsiniz — sonuç aynı şekilde çalışır.
                        </p>
                    </div>
                ) : selectMode === "section" ? (
                    <>
                        <p className="hint">
                            Fatura üzerinde imleci gezdirin; algılanan bölüm çerçevelenir, tıklayınca seçilir.
                            {sections.length} bölüm bulundu.
                        </p>
                        <div className="section-list">
                            {sections.map((section, index) => (
                                <button
                                    key={`${section.box.x}-${section.box.y}-${index}`}
                                    type="button"
                                    className="section-item"
                                    onClick={() => onPickSection(section.box)}
                                    title={section.label}
                                >
                                    <span className="section-item-label">{section.label}</span>
                                    <span className="section-item-size num">
                                        {Math.round(section.box.w * 100)}×{Math.round(section.box.h * 100)}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <p className="hint">
                        Fatura üzerinde sürükleyerek alanı kendiniz çizin. Algılanan bölümlere dönmek için "Bölüm seç"e
                        geçin.
                    </p>
                )}
            </section>

            <section className="card">
                <div className="card-head">
                    <InvoiceIcon />
                    <h2>Yeni başlık</h2>
                </div>
                <label className="field">
                    <span className="field-label">Firma adı</span>
                    <input
                        type="text"
                        value={config.companyName}
                        placeholder="ÖRNEK TİCARET A.Ş."
                        onChange={(event) => onChange({ companyName: event.target.value })}
                    />
                </label>
                <label className="field">
                    <span className="field-label">Adres ve iletişim</span>
                    <textarea
                        rows={4}
                        value={config.addressText}
                        placeholder={"Atatürk Cad. No: 12 Kat: 3\nŞişli / İstanbul\nVD: Mecidiyeköy  VKN: 1234567890"}
                        onChange={(event) => onChange({ addressText: event.target.value })}
                    />
                </label>
            </section>

            <section className="card">
                <div className="card-head">
                    <ImageIcon />
                    <h2>Logo</h2>
                </div>
                <div className="logo-row">
                    <span className="logo-thumb">
                        {logoUrl ? <img src={logoUrl} alt="" /> : <ImageIcon style={{ width: 18, color: "#5f6678" }} />}
                    </span>
                    <label className="btn btn-file">
                        <input type="file" accept="image/*" onChange={handleLogo} />
                        {config.logo ? "Değiştir" : "Logo seç"}
                    </label>
                    {config.logo && (
                        <button
                            type="button"
                            className="btn btn-quiet btn-icon"
                            title="Logoyu kaldır"
                            onClick={() => onLogoFile(null)}
                        >
                            <TrashIcon />
                        </button>
                    )}
                </div>
                {config.logo && (
                    <>
                        <label className="field">
                            <span className="field-label">Konum</span>
                            <select
                                value={config.logoPosition}
                                onChange={(event) => onChange({ logoPosition: event.target.value as LogoPosition })}
                            >
                                <option value="left">Yazının solunda</option>
                                <option value="top">Yazının üstünde</option>
                                <option value="none">Gizle</option>
                            </select>
                        </label>
                        <Slider
                            label="Logo boyutu"
                            value={config.logoScale}
                            min={0.1}
                            max={0.9}
                            step={0.01}
                            onChange={(logoScale) => onChange({ logoScale })}
                        />
                    </>
                )}
            </section>

            <section className="card">
                <div className="card-head">
                    <CropIcon />
                    <h2>Alan ve renkler</h2>
                </div>
                <p className="hint">
                    Fatura üzerinde sürükleyerek yeni bir alan çizin, köşelerden boyutlandırın, ortasından tutup
                    taşıyın.
                </p>
                <div className="row">
                    <button type="button" className="btn btn-quiet" onClick={onResetBox}>
                        <ResetIcon />
                        Sol üste sıfırla
                    </button>
                    <button
                        type="button"
                        className={picking ? "btn active" : "btn btn-quiet"}
                        onClick={onTogglePicking}
                    >
                        <DropperIcon />
                        {picking ? "Renk seçin…" : "Faturadan renk al"}
                    </button>
                </div>
                <div className="row">
                    <label className={config.transparentBackground ? "swatch disabled" : "swatch"}>
                        <input
                            type="color"
                            value={config.background}
                            disabled={config.transparentBackground}
                            onChange={(event) => onChange({ background: event.target.value })}
                        />
                        <span>Arka plan</span>
                    </label>
                    <label className="swatch">
                        <input
                            type="color"
                            value={config.textColor}
                            onChange={(event) => onChange({ textColor: event.target.value })}
                        />
                        <span>Yazı rengi</span>
                    </label>
                </div>
                <Switch
                    label="Eski içerik görünsün (kapatma)"
                    checked={config.transparentBackground}
                    onChange={(transparentBackground) => onChange({ transparentBackground })}
                />
            </section>

            <section className="card">
                <div className="card-head">
                    <TypeIcon />
                    <h2>Yazı</h2>
                </div>
                <div className="seg">
                    {(["left", "center", "right"] as Align[]).map((align) => (
                        <button
                            key={align}
                            type="button"
                            className={config.align === align ? "active" : ""}
                            onClick={() => onChange({ align })}
                        >
                            {align === "left" ? "Sola" : align === "center" ? "Ortala" : "Sağa"}
                        </button>
                    ))}
                </div>
                <label className="field">
                    <span className="field-label">Yazı tipi</span>
                    <select
                        value={config.font}
                        onChange={(event) => onChange({ font: event.target.value as HeaderConfig["font"] })}
                    >
                        {FONTS.map((font) => (
                            <option key={font.id} value={font.id}>
                                {font.label}
                            </option>
                        ))}
                    </select>
                </label>
                <Switch label="Firma adı kalın" checked={config.bold} onChange={(bold) => onChange({ bold })} />
                <Slider
                    label="Firma adı boyutu"
                    value={config.nameSize}
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    onChange={(nameSize) => onChange({ nameSize })}
                />
                <Slider
                    label="Satır boyutu"
                    value={config.lineSize}
                    min={0.04}
                    max={0.35}
                    step={0.01}
                    onChange={(lineSize) => onChange({ lineSize })}
                />
                <Slider
                    label="Satır aralığı"
                    value={config.lineGap}
                    min={1}
                    max={2}
                    step={0.05}
                    display={(value) => `${value.toFixed(2)}×`}
                    onChange={(lineGap) => onChange({ lineGap })}
                />
                <Slider
                    label="İç boşluk"
                    value={config.padding}
                    min={0}
                    max={0.3}
                    step={0.01}
                    onChange={(padding) => onChange({ padding })}
                />
            </section>

            {pageCount > 1 && (
                <section className="card">
                    <div className="card-head">
                        <PagesIcon />
                        <h2>Sayfalar</h2>
                    </div>
                    <p className="hint">
                        Bu fatura {pageCount} sayfa. Yeni başlık, her sayfada aynı alana tek seferde uygulanır;
                        önizlemede ilk sayfayı görüyorsunuz.
                    </p>
                    <Switch
                        label="Sadece ilk sayfaya uygula"
                        checked={firstPageOnly}
                        onChange={onFirstPageOnlyChange}
                    />
                </section>
            )}

            <section className="card">
                <div className="card-head">
                    <LayersIcon />
                    <h2>PDF çıktısı</h2>
                </div>
                <select value={pdfMode} onChange={(event) => onPdfModeChange(event.target.value as PdfMode)}>
                    <option value="vector">Orijinali koru — en yüksek kalite</option>
                    <option value="flatten">Eski yazıyı tamamen sil</option>
                </select>
                <div className="mode-note">
                    <SparkIcon />
                    <p className="hint">
                        {pdfMode === "vector"
                            ? "Fatura olduğu gibi kalır, sadece seçtiğiniz alan yeni başlıkla kapatılır. Eski adres görünmez ama PDF'in metin katmanında durmaya devam eder."
                            : "Değiştirdiğiniz sayfa görüntüye çevrilir; eski adres kopyalanamaz hâle gelir. Yeni başlık yine net kalır, diğer sayfalara dokunulmaz."}
                    </p>
                </div>
            </section>
        </div>
    );
}
