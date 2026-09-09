import type { ChangeEvent } from "react";
import type { PdfMode } from "../lib/exportPdf";
import type { Align, HeaderConfig, LogoPosition } from "../lib/types";

interface Props {
    config: HeaderConfig;
    onChange: (patch: Partial<HeaderConfig>) => void;
    onLogoFile: (file: File | null) => void;
    onResetBox: () => void;
    picking: boolean;
    onTogglePicking: () => void;
    pdfMode: PdfMode;
    onPdfModeChange: (mode: PdfMode) => void;
}

interface SliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    suffix?: string;
    onChange: (value: number) => void;
}

function Slider({ label, value, min, max, step, suffix, onChange }: SliderProps) {
    return (
        <label className="field">
            <span className="field-label">
                {label}
                <em>
                    {Math.round(value * 100) / 100}
                    {suffix ?? ""}
                </em>
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

export default function ControlPanel({
    config,
    onChange,
    onLogoFile,
    onResetBox,
    picking,
    onTogglePicking,
    pdfMode,
    onPdfModeChange,
}: Props) {
    function handleLogo(event: ChangeEvent<HTMLInputElement>) {
        onLogoFile(event.target.files?.[0] ?? null);
        event.target.value = "";
    }

    return (
        <div className="panel">
            <section>
                <h2>Yeni başlık</h2>
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
                    <span className="field-label">Adres / iletişim</span>
                    <textarea
                        rows={4}
                        value={config.addressText}
                        placeholder={"Atatürk Cad. No: 12 Kat: 3\nŞişli / İstanbul\nVD: Mecidiyeköy  VKN: 1234567890"}
                        onChange={(event) => onChange({ addressText: event.target.value })}
                    />
                </label>
            </section>

            <section>
                <h2>Logo</h2>
                <div className="row">
                    <label className="file-button">
                        <input type="file" accept="image/*" onChange={handleLogo} />
                        {config.logo ? "Logoyu değiştir" : "Logo seç"}
                    </label>
                    {config.logo && (
                        <button type="button" className="ghost" onClick={() => onLogoFile(null)}>
                            Kaldır
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

            <section>
                <h2>Alan ve renkler</h2>
                <p className="muted small">
                    Fatura üzerinde sürükleyerek yeni alan çizebilir, köşelerden boyutlandırabilirsiniz.
                </p>
                <div className="row">
                    <button type="button" className="ghost" onClick={onResetBox}>
                        Sol üste sıfırla
                    </button>
                    <button type="button" className={picking ? "ghost active" : "ghost"} onClick={onTogglePicking}>
                        {picking ? "Renk seçiliyor…" : "Faturadan renk al"}
                    </button>
                </div>
                <div className="row">
                    <label className="field compact">
                        <span className="field-label">Arka plan</span>
                        <input
                            type="color"
                            value={config.background}
                            disabled={config.transparentBackground}
                            onChange={(event) => onChange({ background: event.target.value })}
                        />
                    </label>
                    <label className="field compact">
                        <span className="field-label">Yazı rengi</span>
                        <input
                            type="color"
                            value={config.textColor}
                            onChange={(event) => onChange({ textColor: event.target.value })}
                        />
                    </label>
                </div>
                <label className="check">
                    <input
                        type="checkbox"
                        checked={config.transparentBackground}
                        onChange={(event) => onChange({ transparentBackground: event.target.checked })}
                    />
                    Arka planı kapatma (eski içerik görünsün)
                </label>
            </section>

            <section>
                <h2>Yazı ayarları</h2>
                <div className="segmented">
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
                <label className="check">
                    <input
                        type="checkbox"
                        checked={config.bold}
                        onChange={(event) => onChange({ bold: event.target.checked })}
                    />
                    Firma adı kalın
                </label>
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

            <section>
                <h2>PDF çıktısı</h2>
                <label className="field">
                    <select value={pdfMode} onChange={(event) => onPdfModeChange(event.target.value as PdfMode)}>
                        <option value="vector">Orijinali koru (en yüksek kalite)</option>
                        <option value="flatten">Eski yazıyı tamamen sil</option>
                    </select>
                </label>
                <p className="muted small">
                    {pdfMode === "vector"
                        ? "Fatura olduğu gibi kalır, sadece seçtiğiniz alan yeni başlıkla kapatılır. Eski adres görünmez ama PDF içinde metin olarak durmaya devam eder."
                        : "Değiştirdiğiniz sayfa görüntüye çevrilir; eski adres kopyalanamaz hâle gelir. Yeni başlık yine net kalır, diğer sayfalara dokunulmaz."}
                </p>
            </section>
        </div>
    );
}
