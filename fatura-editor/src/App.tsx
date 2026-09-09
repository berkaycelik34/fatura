import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import ControlPanel from "./components/ControlPanel";
import { AlertIcon, DownloadIcon, ImageIcon, InvoiceIcon, ResetIcon, UploadIcon } from "./components/Icon";
import PagePreview from "./components/PagePreview";
import PasswordGate from "./components/PasswordGate";
import { composePage } from "./lib/canvasDraw";
import { exportPdf, type PdfMode } from "./lib/exportPdf";
import { ensureFont } from "./lib/fonts";
import { loadDocument, loadLogo } from "./lib/loadDocument";
import { detectSections, matchSection, sectionSignature, type Section } from "./lib/sections";
import { defaultHeaderConfig, type Box, type HeaderConfig, type LoadedDocument, type PageAudit } from "./lib/types";

/** Ok tuşlarıyla kaydırma adımı (sayfa oranı). */
const NUDGE = 0.002;
const NUDGE_FAST = 0.01;

function download(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

function baseName(fileName: string): string {
    return fileName.replace(/\.[^.]+$/, "");
}

export default function App() {
    const [unlocked, setUnlocked] = useState(false);
    const [doc, setDoc] = useState<LoadedDocument | null>(null);
    const [config, setConfig] = useState<HeaderConfig>(defaultHeaderConfig);
    const [firstPageOnly, setFirstPageOnly] = useState(false);
    const [pdfMode, setPdfMode] = useState<PdfMode>("vector");
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fontsReady, setFontsReady] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const [sections, setSections] = useState<Section[]>([]);
    const [selectMode, setSelectMode] = useState<"section" | "free">("section");
    // Bölüm algılanan faturalarda başlangıçta hiçbir alan seçili değildir; böylece
    // varsayılan bir kutu, seçmek istediğiniz bölümün üstünü kapatmaz.
    const [selected, setSelected] = useState(false);
    const [matchNote, setMatchNote] = useState<string | null>(null);
    const [audit, setAudit] = useState<PageAudit[]>([]);
    const [excluded, setExcluded] = useState<number[]>([]);
    // Açıkken, GİB amblemi/QR taşımayan sayfalar her faturada kendiliğinden çıkarılır.
    const [autoDrop, setAutoDrop] = useState(false);
    const docRef = useRef<LoadedDocument | null>(null);
    // Son seçilen bölümün metin imzası: yeni faturada eşleniğini bulmak için.
    const signatureRef = useRef<string | null>(null);
    const autoDropRef = useRef(false);

    useEffect(() => {
        autoDropRef.current = autoDrop;
    }, [autoDrop]);

    useEffect(() => {
        ensureFont(config.font).then(
            () => setFontsReady(true),
            () => setFontsReady(true),
        );
    }, [config.font]);

    const patchConfig = useCallback((patch: Partial<HeaderConfig>) => {
        setConfig((previous) => ({ ...previous, ...patch }));
    }, []);

    const setBox = useCallback(
        (box: Box) => {
            patchConfig({ box });
            setSelected(true);
        },
        [patchConfig],
    );

    /** Bölüm seçilince, o bölümü çerçeveleyen çizgiler de birebir yeniden kurulur. */
    const applySection = useCallback((section: Section) => {
        setConfig((previous) => ({
            ...previous,
            box: section.box,
            ruleTop: section.rules?.top ?? false,
            ruleBottom: section.rules?.bottom ?? false,
            ruleThickness: section.rules?.thickness ?? previous.ruleThickness,
            ruleColor: section.rules?.color ?? previous.ruleColor,
        }));
        setSelected(true);
    }, []);

    const pickSection = useCallback(
        (section: Section) => {
            signatureRef.current = sectionSignature(section.label) || null;
            setMatchNote(null);
            applySection(section);
        },
        [applySection],
    );

    const openFile = useCallback(
        async (file: File | undefined | null) => {
            if (!file) return;
            setBusy("Fatura okunuyor…");
            setError(null);
            try {
                const loaded = await loadDocument(file);
                docRef.current?.destroy();
                docRef.current = loaded;
                setDoc(loaded);
                setAudit([]);
                setExcluded([]);

                // Sayfa denetimi arka planda: önizleme beklemeden açılır.
                void loaded.auditPages().then((pages) => {
                    if (docRef.current !== loaded) return;
                    setAudit(pages);
                    if (autoDropRef.current) {
                        setExcluded(pages.filter((page) => !page.looksRelevant).map((page) => page.index));
                    }
                });

                // Bölümleri algıla; bulunamazsa kullanıcı alanı elle çizer.
                const found = detectSections(loaded.first.canvas, loaded.firstPageText);
                setSections(found);
                setSelectMode(found.length > 0 ? "section" : "free");

                // Önceki faturada seçilen bölümün eşleniğini içeriğinden ara: sabit
                // blok sayfanın başka bir yerine kaymış olsa da bulunur.
                const signature = signatureRef.current;
                const match = signature && found.length > 0 ? matchSection(found, signature) : null;
                if (match) {
                    applySection(match);
                    setMatchNote(`Önceki faturadaki bölümün eşleniği bulundu ve seçildi: "${match.label}"`);
                } else {
                    setSelected(found.length === 0);
                    setMatchNote(
                        signature && found.length > 0
                            ? "Önceki bölümün eşleniği bu faturada bulunamadı; bölümü seçin."
                            : null,
                    );
                }
            } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Dosya açılamadı.");
            } finally {
                setBusy(null);
            }
        },
        [applySection],
    );

    // Seçili alanı ok tuşlarıyla kaydırma (Shift ile hızlı).
    useEffect(() => {
        if (!selected || !doc) return;

        function onKeyDown(event: KeyboardEvent) {
            const target = event.target as HTMLElement | null;
            if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

            const step = event.shiftKey ? NUDGE_FAST : NUDGE;
            const deltas: Record<string, [number, number]> = {
                ArrowLeft: [-step, 0],
                ArrowRight: [step, 0],
                ArrowUp: [0, -step],
                ArrowDown: [0, step],
            };
            const delta = deltas[event.key];
            if (!delta) return;

            event.preventDefault();
            setConfig((previous) => ({
                ...previous,
                box: {
                    ...previous.box,
                    x: Math.min(1 - previous.box.w, Math.max(0, previous.box.x + delta[0])),
                    y: Math.min(1 - previous.box.h, Math.max(0, previous.box.y + delta[1])),
                },
            }));
        }

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [selected, doc]);

    async function handleLogoFile(file: File | null) {
        const previous = config.logo?.previewUrl;
        if (!file) {
            if (previous) URL.revokeObjectURL(previous);
            patchConfig({ logo: null });
            return;
        }
        try {
            const logo = await loadLogo(file);
            if (previous) URL.revokeObjectURL(previous);
            patchConfig({ logo });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Logo yüklenemedi.");
        }
    }

    const keepPages = useMemo(() => {
        if (!doc) return [];
        const dropped = new Set(excluded);
        return Array.from({ length: doc.pageCount }, (_, index) => index).filter((index) => !dropped.has(index));
    }, [doc, excluded]);

    // Başlık, kalan tüm sayfalarda aynı alana uygulanır; istenirse sadece ilkine.
    const targetPages = useMemo(() => {
        if (!doc || !selected) return [];
        if (firstPageOnly) return keepPages.slice(0, 1);
        return keepPages;
    }, [doc, firstPageOnly, selected, keepPages]);

    async function downloadPdf() {
        if (!doc) return;
        setBusy(targetPages.length > 1 ? `PDF hazırlanıyor… (${targetPages.length} sayfa)` : "PDF hazırlanıyor…");
        setError(null);
        try {
            const blob = await exportPdf(doc, config, {
                headerPages: targetPages,
                keepPages,
                mode: pdfMode,
            });
            download(blob, `${baseName(doc.fileName)}-duzenlenmis.pdf`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "PDF oluşturulamadı.");
        } finally {
            setBusy(null);
        }
    }

    function downloadPng() {
        if (!doc) return;
        const canvas = composePage(doc.first.canvas, config, selected);
        canvas.toBlob((blob) => {
            if (blob) download(blob, `${baseName(doc.fileName)}-sayfa-1.png`);
        }, "image/png");
    }

    function onDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setDragOver(false);
        void openFile(event.dataTransfer.files?.[0]);
    }

    function onSelect(event: ChangeEvent<HTMLInputElement>) {
        void openFile(event.target.files?.[0]);
        event.target.value = "";
    }

    if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

    const pageNote =
        doc === null
            ? "Başlamak için fatura yükleyin"
            : !selected
              ? `${doc.fileName} · değiştirilecek bölümü seçin`
              : doc.pageCount === 1
                ? `${doc.fileName} · 1 sayfa`
                : firstPageOnly
                  ? `${doc.fileName} · ${doc.pageCount} sayfa · sadece 1. sayfa`
                  : excluded.length > 0
                    ? `${doc.fileName} · ${keepPages.length}/${doc.pageCount} sayfa (${excluded.length} çıkarıldı)`
                    : `${doc.fileName} · ${doc.pageCount} sayfanın tümüne uygulanır`;

    return (
        <div className="app">
            <header className="topbar">
                <div className="topbar-left">
                    <span className="brand-mark sm">
                        <InvoiceIcon />
                    </span>
                    <span className="brand-text">
                        <strong>Fatura Başlık Düzenleyici</strong>
                        <span className="doc-chip">{pageNote}</span>
                    </span>
                </div>
                <div className="row">
                    <label className="btn btn-file">
                        <input type="file" accept="application/pdf,image/*" onChange={onSelect} />
                        <UploadIcon />
                        {doc ? "Başka fatura" : "Fatura seç"}
                    </label>
                    {doc && (
                        <>
                            <button
                                type="button"
                                className="btn btn-quiet"
                                onClick={() => {
                                    setConfig(defaultHeaderConfig());
                                    setSelected(sections.length === 0);
                                    setMatchNote(null);
                                }}
                            >
                                <ResetIcon />
                                Sıfırla
                            </button>
                            <span className="v-divider" />
                            <button type="button" className="btn" onClick={downloadPng}>
                                <ImageIcon />
                                PNG
                            </button>
                            <button
                                type="button"
                                className="btn btn-primary"
                                onClick={downloadPdf}
                                disabled={busy !== null}
                            >
                                <DownloadIcon />
                                PDF indir
                            </button>
                        </>
                    )}
                </div>
            </header>

            {(error || busy || !fontsReady) && (
                <div className="notices">
                    {error && (
                        <div className="notice notice-error">
                            <AlertIcon />
                            {error}
                        </div>
                    )}
                    {busy && (
                        <div className="notice">
                            <span className="spinner" />
                            {busy}
                        </div>
                    )}
                    {!fontsReady && (
                        <div className="notice">
                            <span className="spinner" />
                            Yazı tipi yükleniyor…
                        </div>
                    )}
                </div>
            )}

            {!doc ? (
                <div
                    className={dragOver ? "dropzone over" : "dropzone"}
                    onDrop={onDrop}
                    onDragOver={(event) => {
                        event.preventDefault();
                        setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                >
                    <span className="dropzone-badge">
                        <UploadIcon />
                    </span>
                    <h2>Faturayı buraya sürükleyin</h2>
                    <p className="muted">
                        Değiştirmek istediğiniz bölümü seçin, firma bilgilerini ve logoyu girin, çıktıyı PDF olarak
                        indirin. Dosya bilgisayarınızdan çıkmaz.
                    </p>
                    <label className="btn btn-primary btn-lg btn-file">
                        <input type="file" accept="application/pdf,image/*" onChange={onSelect} />
                        <UploadIcon />
                        Dosya seç
                    </label>
                    <div className="chips">
                        <span className="chip">PDF</span>
                        <span className="chip">PNG</span>
                        <span className="chip">JPG</span>
                    </div>
                </div>
            ) : (
                <main className="workspace">
                    <div className="stage">
                        <PagePreview
                            page={doc.first}
                            config={config}
                            showHeader={selected}
                            showSelection={selected}
                            picking={picking}
                            selectMode={selectMode}
                            sections={sections}
                            onBoxChange={setBox}
                            onPickSection={pickSection}
                            onPickColor={(hex) => {
                                patchConfig({ background: hex, transparentBackground: false });
                                setPicking(false);
                            }}
                        />
                    </div>
                    <aside className="sidebar">
                        <ControlPanel
                            config={config}
                            onChange={patchConfig}
                            onLogoFile={handleLogoFile}
                            onResetBox={() => setBox(defaultHeaderConfig().box)}
                            picking={picking}
                            onTogglePicking={() => setPicking((value) => !value)}
                            pdfMode={pdfMode}
                            onPdfModeChange={setPdfMode}
                            pageCount={doc.pageCount}
                            firstPageOnly={firstPageOnly}
                            onFirstPageOnlyChange={setFirstPageOnly}
                            sections={sections}
                            selectMode={selectMode}
                            onSelectModeChange={(mode) => {
                                setSelectMode(mode);
                                if (mode === "free") setSelected(true);
                            }}
                            onPickSection={pickSection}
                            selected={selected}
                            matchNote={matchNote}
                            audit={audit}
                            excluded={excluded}
                            onExcludedChange={setExcluded}
                            autoDrop={autoDrop}
                            onAutoDropChange={(value) => {
                                setAutoDrop(value);
                                if (value) {
                                    setExcluded(audit.filter((page) => !page.looksRelevant).map((page) => page.index));
                                } else {
                                    setExcluded([]);
                                }
                            }}
                        />
                    </aside>
                </main>
            )}
        </div>
    );
}
