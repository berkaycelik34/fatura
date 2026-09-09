import { useMemo, useState, type ChangeEvent } from "react";
import type { PdfMode } from "../lib/exportPdf";
import { FONTS, fontById } from "../lib/fonts";
import type { Section } from "../lib/sections";
import type { Align, HeaderConfig, LogoPosition, PageAudit, VerticalAlign } from "../lib/types";
import {
    AlertIcon,
    CropIcon,
    DownloadIcon,
    DropperIcon,
    ImageIcon,
    InvoiceIcon,
    LayersIcon,
    MoveIcon,
    PagesIcon,
    ResetIcon,
    RuleIcon,
    SparkIcon,
    TrashIcon,
    TypeIcon,
} from "./Icon";

type Tab = "content" | "position" | "style" | "output";

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
    onPickSection: (section: Section) => void;
    selected: boolean;
    matchNote: string | null;
    audit: PageAudit[];
    excluded: number[];
    onExcludedChange: (pages: number[]) => void;
    autoDrop: boolean;
    onAutoDropChange: (value: boolean) => void;
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

interface NumberFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    onChange: (value: number) => void;
}

/** Yüzde cinsinden ince ayar alanı; ok tuşlarıyla da değiştirilebilir. */
function NumberField({ label, value, min, max, step = 0.1, onChange }: NumberFieldProps) {
    return (
        <label className="number-field">
            <span>{label}</span>
            <input
                type="number"
                value={Number((value * 100).toFixed(1))}
                min={min}
                max={max}
                step={step}
                onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)) / 100);
                }}
            />
        </label>
    );
}

interface SegmentedProps<T extends string> {
    value: T;
    options: { value: T; label: string }[];
    onChange: (value: T) => void;
}

function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
    return (
        <div className="seg">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    className={value === option.value ? "active" : ""}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

const TABS: { id: Tab; label: string }[] = [
    { id: "content", label: "İçerik" },
    { id: "position", label: "Konum" },
    { id: "style", label: "Stil" },
    { id: "output", label: "Çıktı" },
];

export default function ControlPanel(props: Props) {
    const { config, onChange, onLogoFile } = props;
    const [tab, setTab] = useState<Tab>("content");
    const logoUrl = useMemo(() => config.logo?.previewUrl ?? null, [config.logo]);
    const irrelevant = useMemo(() => props.audit.filter((page) => !page.looksRelevant), [props.audit]);

    function handleLogo(event: ChangeEvent<HTMLInputElement>) {
        onLogoFile(event.target.files?.[0] ?? null);
        event.target.value = "";
    }

    function setLine(index: number, text: string) {
        onChange({ lines: config.lines.map((line, i) => (i === index ? text : line)) });
    }

    function addLine() {
        onChange({ lines: [...config.lines, ""] });
    }

    function removeLine(index: number) {
        const lines = config.lines.filter((_, i) => i !== index);
        onChange({ lines: lines.length > 0 ? lines : [""] });
    }

    function moveLine(index: number, delta: number) {
        const target = index + delta;
        if (target < 0 || target >= config.lines.length) return;
        const lines = [...config.lines];
        [lines[index], lines[target]] = [lines[target], lines[index]];
        onChange({ lines });
    }

    return (
        <div className="panel">
            <section className="card">
                <div className="card-head">
                    <CropIcon />
                    <h2>Bölüm seçimi</h2>
                </div>
                <Segmented
                    value={props.selectMode}
                    options={[
                        { value: "section" as const, label: "Bölüm seç" },
                        { value: "free" as const, label: "Serbest çiz" },
                    ]}
                    onChange={props.onSelectModeChange}
                />
                {props.sections.length === 0 ? (
                    <div className="mode-note warn">
                        <AlertIcon />
                        <p className="hint">
                            Bu faturada otomatik bölüm bulunamadı. Alanı fatura üzerinde sürükleyerek kendiniz
                            çizebilirsiniz — sonuç aynı şekilde çalışır.
                        </p>
                    </div>
                ) : props.selectMode === "section" ? (
                    <>
                        {props.matchNote && (
                            <div className="mode-note">
                                <SparkIcon />
                                <p className="hint">{props.matchNote}</p>
                            </div>
                        )}
                        <p className="hint">
                            {props.selected
                                ? `Başka bölüme geçmek için üzerine tıklayın. ${props.sections.length} bölüm bulundu.`
                                : `İmleci fatura üzerinde gezdirin; algılanan bölüm çerçevelenir, tıklayınca seçilir. ${props.sections.length} bölüm bulundu.`}
                        </p>
                        <div className="section-list">
                            {props.sections.map((section, index) => (
                                <button
                                    key={`${section.box.x}-${section.box.y}-${index}`}
                                    type="button"
                                    className="section-item"
                                    onClick={() => props.onPickSection(section)}
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

            <div className="tabs">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={tab === item.id ? "active" : ""}
                        onClick={() => setTab(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {tab === "content" && (
                <>
                    <section className="card">
                        <div className="card-head">
                            <InvoiceIcon />
                            <h2>Firma bilgileri</h2>
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

                        <div className="field">
                            <span className="field-label">
                                Adres ve iletişim satırları
                                <em>{config.lines.filter((line) => line.trim() !== "").length}</em>
                            </span>
                            <div className="line-editor">
                                {config.lines.map((line, index) => (
                                    <div className="line-row" key={index}>
                                        <input
                                            type="text"
                                            value={line}
                                            placeholder={
                                                index === 0
                                                    ? "Atatürk Cad. No: 12 Kat: 3"
                                                    : index === 1
                                                      ? "Şişli / İstanbul"
                                                      : "VD: Mecidiyeköy  VKN: 1234567890"
                                            }
                                            onChange={(event) => setLine(index, event.target.value)}
                                        />
                                        <div className="line-actions">
                                            <button
                                                type="button"
                                                className="btn btn-quiet btn-icon"
                                                title="Yukarı taşı"
                                                disabled={index === 0}
                                                onClick={() => moveLine(index, -1)}
                                            >
                                                ↑
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-quiet btn-icon"
                                                title="Aşağı taşı"
                                                disabled={index === config.lines.length - 1}
                                                onClick={() => moveLine(index, 1)}
                                            >
                                                ↓
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-quiet btn-icon"
                                                title="Satırı sil"
                                                onClick={() => removeLine(index)}
                                            >
                                                <TrashIcon />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button type="button" className="btn btn-quiet" onClick={addLine}>
                                + Satır ekle
                            </button>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <ImageIcon />
                            <h2>Logo</h2>
                        </div>
                        <div className="logo-row">
                            <span className="logo-thumb">
                                {logoUrl ? <img src={logoUrl} alt="" /> : <ImageIcon className="dim-icon" />}
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
                        {config.logo && <p className="hint">Logonun yeri ve boyutu "Konum" sekmesinden ayarlanır.</p>}
                    </section>
                </>
            )}

            {tab === "position" && (
                <>
                    <section className="card">
                        <div className="card-head">
                            <CropIcon />
                            <h2>Alan</h2>
                        </div>
                        <p className="hint">
                            Sayfa oranı olarak (%). Fatura üzerinde tutamaçlarla da ayarlayabilir, seçili alanı ok
                            tuşlarıyla kaydırabilirsiniz (Shift ile hızlı).
                        </p>
                        <div className="number-grid">
                            <NumberField
                                label="X"
                                value={config.box.x}
                                min={0}
                                max={100}
                                onChange={(x) => onChange({ box: { ...config.box, x } })}
                            />
                            <NumberField
                                label="Y"
                                value={config.box.y}
                                min={0}
                                max={100}
                                onChange={(y) => onChange({ box: { ...config.box, y } })}
                            />
                            <NumberField
                                label="Genişlik"
                                value={config.box.w}
                                min={1}
                                max={100}
                                onChange={(w) => onChange({ box: { ...config.box, w } })}
                            />
                            <NumberField
                                label="Yükseklik"
                                value={config.box.h}
                                min={1}
                                max={100}
                                onChange={(h) => onChange({ box: { ...config.box, h } })}
                            />
                        </div>
                        <button type="button" className="btn btn-quiet" onClick={props.onResetBox}>
                            <ResetIcon />
                            Sol üste sıfırla
                        </button>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <MoveIcon />
                            <h2>Yerleşim</h2>
                        </div>
                        <label className="field">
                            <span className="field-label">Yatay hizalama</span>
                            <Segmented
                                value={config.align}
                                options={[
                                    { value: "left" as Align, label: "Sol" },
                                    { value: "center" as Align, label: "Orta" },
                                    { value: "right" as Align, label: "Sağ" },
                                ]}
                                onChange={(align) => onChange({ align })}
                            />
                        </label>
                        <label className="field">
                            <span className="field-label">Dikey hizalama</span>
                            <Segmented
                                value={config.verticalAlign}
                                options={[
                                    { value: "top" as VerticalAlign, label: "Üst" },
                                    { value: "middle" as VerticalAlign, label: "Orta" },
                                    { value: "bottom" as VerticalAlign, label: "Alt" },
                                ]}
                                onChange={(verticalAlign) => onChange({ verticalAlign })}
                            />
                        </label>
                        <Slider
                            label="İç boşluk"
                            value={config.padding}
                            min={0}
                            max={0.3}
                            step={0.005}
                            onChange={(padding) => onChange({ padding })}
                        />
                        <Slider
                            label="Firma adı – adres arası"
                            value={config.nameGap}
                            min={0}
                            max={0.3}
                            step={0.005}
                            onChange={(nameGap) => onChange({ nameGap })}
                        />
                        <div className="number-grid">
                            <NumberField
                                label="Yazı ↔"
                                value={config.textOffsetX}
                                min={-50}
                                max={50}
                                onChange={(textOffsetX) => onChange({ textOffsetX })}
                            />
                            <NumberField
                                label="Yazı ↕"
                                value={config.textOffsetY}
                                min={-50}
                                max={50}
                                onChange={(textOffsetY) => onChange({ textOffsetY })}
                            />
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <RuleIcon />
                            <h2>Çerçeve çizgileri</h2>
                        </div>
                        <p className="hint">
                            Bloğun üstündeki ve altındaki yatay çizgiler. Algılanan bölümü seçtiğinizde kalınlık ve renk
                            faturadan alınır; buradan ince ayar yapabilirsiniz.
                        </p>
                        <Switch
                            label="Üst çizgi"
                            checked={config.ruleTop}
                            onChange={(ruleTop) => onChange({ ruleTop })}
                        />
                        <Switch
                            label="Alt çizgi"
                            checked={config.ruleBottom}
                            onChange={(ruleBottom) => onChange({ ruleBottom })}
                        />
                        {(config.ruleTop || config.ruleBottom) && (
                            <>
                                <Slider
                                    label="Kalınlık"
                                    value={config.ruleThickness}
                                    min={0.002}
                                    max={0.06}
                                    step={0.001}
                                    display={(value) => `${(value * 100).toFixed(1)}%`}
                                    onChange={(ruleThickness) => onChange({ ruleThickness })}
                                />
                                <Slider
                                    label="Yandan boşluk"
                                    value={config.ruleInset}
                                    min={0}
                                    max={0.3}
                                    step={0.005}
                                    onChange={(ruleInset) => onChange({ ruleInset })}
                                />
                                <label className="swatch">
                                    <input
                                        type="color"
                                        value={config.ruleColor}
                                        onChange={(event) => onChange({ ruleColor: event.target.value })}
                                    />
                                    <span>Çizgi rengi</span>
                                </label>
                            </>
                        )}
                    </section>

                    {config.logo && (
                        <section className="card">
                            <div className="card-head">
                                <ImageIcon />
                                <h2>Logo yerleşimi</h2>
                            </div>
                            <Segmented
                                value={config.logoPosition}
                                options={[
                                    { value: "left" as LogoPosition, label: "Sol" },
                                    { value: "top" as LogoPosition, label: "Üst" },
                                    { value: "right" as LogoPosition, label: "Sağ" },
                                    { value: "none" as LogoPosition, label: "Gizli" },
                                ]}
                                onChange={(logoPosition) => onChange({ logoPosition })}
                            />
                            <Slider
                                label="Logo boyutu"
                                value={config.logoScale}
                                min={0.08}
                                max={0.9}
                                step={0.01}
                                onChange={(logoScale) => onChange({ logoScale })}
                            />
                            <Slider
                                label="Logo – yazı arası"
                                value={config.logoGap}
                                min={0}
                                max={0.4}
                                step={0.005}
                                onChange={(logoGap) => onChange({ logoGap })}
                            />
                            <div className="number-grid">
                                <NumberField
                                    label="Logo ↔"
                                    value={config.logoOffsetX}
                                    min={-50}
                                    max={50}
                                    onChange={(logoOffsetX) => onChange({ logoOffsetX })}
                                />
                                <NumberField
                                    label="Logo ↕"
                                    value={config.logoOffsetY}
                                    min={-50}
                                    max={50}
                                    onChange={(logoOffsetY) => onChange({ logoOffsetY })}
                                />
                            </div>
                        </section>
                    )}
                </>
            )}

            {tab === "style" && (
                <>
                    <section className="card">
                        <div className="card-head">
                            <TypeIcon />
                            <h2>Yazı tipi</h2>
                        </div>
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
                        <p className="hint">{fontById(config.font).note}</p>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <InvoiceIcon />
                            <h2>Firma adı</h2>
                        </div>
                        <Slider
                            label="Boyut"
                            value={config.nameSize}
                            min={0.05}
                            max={0.6}
                            step={0.005}
                            onChange={(nameSize) => onChange({ nameSize })}
                        />
                        <Slider
                            label="Harf aralığı"
                            value={config.nameSpacing}
                            min={-0.01}
                            max={0.06}
                            step={0.002}
                            display={(value) => `${(value * 100).toFixed(1)}%`}
                            onChange={(nameSpacing) => onChange({ nameSpacing })}
                        />
                        <Switch
                            label="Kalın"
                            checked={config.nameBold}
                            onChange={(nameBold) => onChange({ nameBold })}
                        />
                        <Switch
                            label="BÜYÜK HARF"
                            checked={config.nameUppercase}
                            onChange={(nameUppercase) => onChange({ nameUppercase })}
                        />
                        <label className="swatch">
                            <input
                                type="color"
                                value={config.nameColor}
                                onChange={(event) => onChange({ nameColor: event.target.value })}
                            />
                            <span>Firma adı rengi</span>
                        </label>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <TypeIcon />
                            <h2>Adres satırları</h2>
                        </div>
                        <Slider
                            label="Boyut"
                            value={config.lineSize}
                            min={0.04}
                            max={0.4}
                            step={0.005}
                            onChange={(lineSize) => onChange({ lineSize })}
                        />
                        <Slider
                            label="Satır aralığı"
                            value={config.lineGap}
                            min={1}
                            max={2.2}
                            step={0.05}
                            display={(value) => `${value.toFixed(2)}×`}
                            onChange={(lineGap) => onChange({ lineGap })}
                        />
                        <Slider
                            label="Harf aralığı"
                            value={config.lineSpacing}
                            min={-0.008}
                            max={0.04}
                            step={0.002}
                            display={(value) => `${(value * 100).toFixed(1)}%`}
                            onChange={(lineSpacing) => onChange({ lineSpacing })}
                        />
                        <label className="swatch">
                            <input
                                type="color"
                                value={config.textColor}
                                onChange={(event) => onChange({ textColor: event.target.value })}
                            />
                            <span>Satır rengi</span>
                        </label>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <DropperIcon />
                            <h2>Arka plan</h2>
                        </div>
                        <div className="row">
                            <label className={config.transparentBackground ? "swatch disabled" : "swatch"}>
                                <input
                                    type="color"
                                    value={config.background}
                                    disabled={config.transparentBackground}
                                    onChange={(event) => onChange({ background: event.target.value })}
                                />
                                <span>Kapatma rengi</span>
                            </label>
                            <button
                                type="button"
                                className={props.picking ? "btn active" : "btn btn-quiet"}
                                onClick={props.onTogglePicking}
                            >
                                <DropperIcon />
                                {props.picking ? "Seçin…" : "Faturadan al"}
                            </button>
                        </div>
                        <Switch
                            label="Eski içerik görünsün (kapatma)"
                            checked={config.transparentBackground}
                            onChange={(transparentBackground) => onChange({ transparentBackground })}
                        />
                    </section>
                </>
            )}

            {tab === "output" && (
                <>
                    {props.pageCount > 1 && (
                        <section className="card">
                            <div className="card-head">
                                <PagesIcon />
                                <h2>Sayfalar</h2>
                            </div>
                            <p className="hint">
                                Bu fatura {props.pageCount} sayfa. Yeni başlık kalan her sayfada aynı alana tek seferde
                                uygulanır; önizlemede ilk sayfayı görüyorsunuz.
                            </p>
                            <Switch
                                label="Sadece ilk sayfaya uygula"
                                checked={props.firstPageOnly}
                                onChange={props.onFirstPageOnlyChange}
                            />

                            <Switch
                                label="QR kod / GİB işareti olmayan sayfaları çıkar"
                                checked={props.autoDrop}
                                onChange={props.onAutoDropChange}
                            />
                            {props.audit.length === 0 ? (
                                <p className="hint">Sayfalar inceleniyor…</p>
                            ) : (
                                <>
                                    {irrelevant.length > 0 && !props.autoDrop && (
                                        <div className="mode-note warn">
                                            <AlertIcon />
                                            <p className="hint">
                                                {irrelevant.length} sayfada QR kod / GİB amblemi bulunamadı. Yukarıdaki
                                                anahtarla çıkarabilir ya da aşağıdan tek tek seçebilirsiniz.
                                            </p>
                                        </div>
                                    )}
                                    <div className="page-list">
                                        {props.audit.map((page) => {
                                            const dropped = props.excluded.includes(page.index);
                                            return (
                                                <label
                                                    key={page.index}
                                                    className={dropped ? "page-row dropped" : "page-row"}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={!dropped}
                                                        onChange={(event) => {
                                                            const next = event.target.checked
                                                                ? props.excluded.filter((i) => i !== page.index)
                                                                : [...props.excluded, page.index];
                                                            props.onExcludedChange(next);
                                                        }}
                                                    />
                                                    <span className="page-row-label num">Sayfa {page.index + 1}</span>
                                                    <span
                                                        className={page.looksRelevant ? "page-tag ok" : "page-tag warn"}
                                                    >
                                                        {page.looksRelevant
                                                            ? page.images > 0
                                                                ? `${page.images} işaret`
                                                                : "e-fatura izi"
                                                            : "işaret yok"}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <p className="hint">
                                        İşareti kaldırdığınız sayfalar PDF çıktısından tamamen çıkarılır.
                                    </p>
                                </>
                            )}
                        </section>
                    )}

                    <section className="card">
                        <div className="card-head">
                            <LayersIcon />
                            <h2>PDF çıktısı</h2>
                        </div>
                        <select
                            value={props.pdfMode}
                            onChange={(event) => props.onPdfModeChange(event.target.value as PdfMode)}
                        >
                            <option value="vector">Orijinali koru — en yüksek kalite</option>
                            <option value="flatten">Eski yazıyı tamamen sil</option>
                        </select>
                        <div className="mode-note">
                            <SparkIcon />
                            <p className="hint">
                                {props.pdfMode === "vector"
                                    ? "Fatura olduğu gibi kalır, sadece seçtiğiniz alan yeni başlıkla kapatılır. Eski yazı görünmez ama PDF'in metin katmanında durmaya devam eder."
                                    : "Değiştirdiğiniz sayfa görüntüye çevrilir; eski yazı kopyalanamaz hâle gelir. Yeni başlık yine net kalır, diğer sayfalara dokunulmaz."}
                            </p>
                        </div>
                    </section>

                    <section className="card">
                        <div className="card-head">
                            <DownloadIcon />
                            <h2>Özet</h2>
                        </div>
                        <dl className="summary">
                            <div>
                                <dt>Yazı tipi</dt>
                                <dd>{fontById(config.font).label}</dd>
                            </div>
                            <div>
                                <dt>Satır</dt>
                                <dd className="num">{config.lines.filter((line) => line.trim() !== "").length} adet</dd>
                            </div>
                            <div>
                                <dt>Alan</dt>
                                <dd className="num">
                                    {Math.round(config.box.w * 100)}% × {Math.round(config.box.h * 100)}%
                                </dd>
                            </div>
                            <div>
                                <dt>Logo</dt>
                                <dd>{config.logo ? "var" : "yok"}</dd>
                            </div>
                            <div>
                                <dt>Çıkarılan sayfa</dt>
                                <dd className="num">{props.excluded.length}</dd>
                            </div>
                        </dl>
                    </section>
                </>
            )}
        </div>
    );
}
