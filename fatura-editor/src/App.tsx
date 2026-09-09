import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import ControlPanel from "./components/ControlPanel";
import PagePreview from "./components/PagePreview";
import PasswordGate from "./components/PasswordGate";
import { composePage } from "./lib/canvasDraw";
import { exportPdf, type PdfMode } from "./lib/exportPdf";
import { loadFonts } from "./lib/fonts";
import { loadDocument, loadLogo } from "./lib/loadDocument";
import { defaultHeaderConfig, type Box, type HeaderConfig, type LoadedDocument } from "./lib/types";

type Scope = "current" | "all";

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
    const [pageIndex, setPageIndex] = useState(0);
    const [config, setConfig] = useState<HeaderConfig>(defaultHeaderConfig);
    const [scope, setScope] = useState<Scope>("current");
    const [pdfMode, setPdfMode] = useState<PdfMode>("vector");
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [fontsReady, setFontsReady] = useState(false);

    useEffect(() => {
        loadFonts().then(
            () => setFontsReady(true),
            () => setFontsReady(true),
        );
    }, []);

    const patchConfig = useCallback((patch: Partial<HeaderConfig>) => {
        setConfig((previous) => ({ ...previous, ...patch }));
    }, []);

    const setBox = useCallback((box: Box) => patchConfig({ box }), [patchConfig]);

    const openFile = useCallback(async (file: File | undefined | null) => {
        if (!file) return;
        setBusy("Fatura okunuyor…");
        setError(null);
        try {
            const loaded = await loadDocument(file);
            setDoc(loaded);
            setPageIndex(0);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Dosya açılamadı.");
        } finally {
            setBusy(null);
        }
    }, []);

    async function handleLogoFile(file: File | null) {
        if (!file) {
            patchConfig({ logo: null });
            return;
        }
        try {
            patchConfig({ logo: await loadLogo(file) });
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Logo yüklenemedi.");
        }
    }

    const targetPages = useMemo(() => {
        if (!doc) return [];
        return scope === "all" ? doc.pages.map((_, index) => index) : [pageIndex];
    }, [doc, scope, pageIndex]);

    async function downloadPdf() {
        if (!doc) return;
        setBusy("PDF hazırlanıyor…");
        setError(null);
        try {
            const blob = await exportPdf(doc, config, targetPages, pdfMode);
            download(blob, `${baseName(doc.fileName)}-duzenlenmis.pdf`);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "PDF oluşturulamadı.");
        } finally {
            setBusy(null);
        }
    }

    function downloadPng() {
        if (!doc) return;
        const canvas = composePage(doc.pages[pageIndex].canvas, config, targetPages.includes(pageIndex));
        canvas.toBlob((blob) => {
            if (blob) download(blob, `${baseName(doc.fileName)}-sayfa-${pageIndex + 1}.png`);
        }, "image/png");
    }

    function onDrop(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        void openFile(event.dataTransfer.files?.[0]);
    }

    function onSelect(event: ChangeEvent<HTMLInputElement>) {
        void openFile(event.target.files?.[0]);
        event.target.value = "";
    }

    if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

    const page = doc?.pages[pageIndex];

    return (
        <div className="app">
            <header className="topbar">
                <div className="brand">
                    <strong>Fatura Başlık Düzenleyici</strong>
                    <span className="muted small">
                        {doc ? `${doc.fileName} · ${doc.pages.length} sayfa` : "Fatura yükleyin"}
                    </span>
                </div>
                <div className="row">
                    <label className="file-button">
                        <input type="file" accept="application/pdf,image/*" onChange={onSelect} />
                        {doc ? "Başka fatura yükle" : "Fatura seç"}
                    </label>
                    {doc && (
                        <>
                            <button type="button" className="ghost" onClick={() => setConfig(defaultHeaderConfig())}>
                                Başlığı sıfırla
                            </button>
                            <button type="button" className="ghost" onClick={downloadPng}>
                                PNG indir
                            </button>
                            <button type="button" className="primary" onClick={downloadPdf} disabled={busy !== null}>
                                PDF indir
                            </button>
                        </>
                    )}
                </div>
            </header>

            {error && <div className="banner error">{error}</div>}
            {busy && <div className="banner">{busy}</div>}
            {!fontsReady && <div className="banner">Yazı tipi yükleniyor…</div>}

            {!doc ? (
                <div className="dropzone" onDrop={onDrop} onDragOver={(event) => event.preventDefault()}>
                    <p className="dropzone-title">Faturayı buraya sürükleyin</p>
                    <p className="muted">PDF, PNG veya JPG · dosya bilgisayarınızdan çıkmaz</p>
                    <label className="file-button">
                        <input type="file" accept="application/pdf,image/*" onChange={onSelect} />
                        Dosya seç
                    </label>
                </div>
            ) : (
                <main className="workspace">
                    <div className="stage">
                        {doc.pages.length > 1 && (
                            <div className="pager">
                                <button
                                    type="button"
                                    className="ghost"
                                    disabled={pageIndex === 0}
                                    onClick={() => setPageIndex((index) => index - 1)}
                                >
                                    ‹
                                </button>
                                <span>
                                    Sayfa {pageIndex + 1} / {doc.pages.length}
                                </span>
                                <button
                                    type="button"
                                    className="ghost"
                                    disabled={pageIndex === doc.pages.length - 1}
                                    onClick={() => setPageIndex((index) => index + 1)}
                                >
                                    ›
                                </button>
                                <select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
                                    <option value="current">Sadece bu sayfaya uygula</option>
                                    <option value="all">Tüm sayfalara uygula</option>
                                </select>
                            </div>
                        )}
                        {page && (
                            <PagePreview
                                page={page}
                                config={config}
                                showHeader={targetPages.includes(pageIndex)}
                                picking={picking}
                                onBoxChange={setBox}
                                onPickColor={(hex) => {
                                    patchConfig({ background: hex, transparentBackground: false });
                                    setPicking(false);
                                }}
                            />
                        )}
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
                        />
                    </aside>
                </main>
            )}
        </div>
    );
}
