import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import ControlPanel from "./components/ControlPanel";
import { AlertIcon, DownloadIcon, ImageIcon, InvoiceIcon, ResetIcon, UploadIcon } from "./components/Icon";
import PagePreview from "./components/PagePreview";
import PasswordGate from "./components/PasswordGate";
import { composePage } from "./lib/canvasDraw";
import { exportPdf, type PdfMode } from "./lib/exportPdf";
import { loadFonts } from "./lib/fonts";
import { loadDocument, loadLogo } from "./lib/loadDocument";
import { defaultHeaderConfig, type Box, type HeaderConfig, type LoadedDocument } from "./lib/types";

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
    const docRef = useRef<LoadedDocument | null>(null);

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
            docRef.current?.destroy();
            docRef.current = loaded;
            setDoc(loaded);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Dosya açılamadı.");
        } finally {
            setBusy(null);
        }
    }, []);

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

    // Başlık, tüm sayfalarda aynı alana uygulanır; istenirse sadece ilk sayfaya.
    const targetPages = useMemo(() => {
        if (!doc) return [];
        if (firstPageOnly) return [0];
        return Array.from({ length: doc.pageCount }, (_, index) => index);
    }, [doc, firstPageOnly]);

    async function downloadPdf() {
        if (!doc) return;
        setBusy(targetPages.length > 1 ? `PDF hazırlanıyor… (${targetPages.length} sayfa)` : "PDF hazırlanıyor…");
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
        const canvas = composePage(doc.first.canvas, config, true);
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
            : doc.pageCount === 1
              ? `${doc.fileName} · 1 sayfa`
              : firstPageOnly
                ? `${doc.fileName} · ${doc.pageCount} sayfa · sadece 1. sayfa`
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
                                onClick={() => setConfig(defaultHeaderConfig())}
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
                        Sol üstteki firma bilgilerini ve logoyu değiştirin, çıktıyı PDF olarak indirin. Dosya
                        bilgisayarınızdan çıkmaz.
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
                            showHeader
                            picking={picking}
                            onBoxChange={setBox}
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
                        />
                    </aside>
                </main>
            )}
        </div>
    );
}
