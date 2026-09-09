import { useCallback, useEffect, useRef, useState } from "react";
import { drawHeaderOnCanvas } from "../lib/canvasDraw";
import type { Box, HeaderConfig, RenderedPage } from "../lib/types";

/** Önizlemenin çizildiği en büyük genişlik; büyük taramalarda akıcılığı korur. */
const MAX_PREVIEW_WIDTH = 1400;
const MIN_SIZE = 0.02;

type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
type Mode = { type: "move" } | { type: "draw" } | { type: "resize"; handle: Handle };

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

interface Props {
    page: RenderedPage;
    config: HeaderConfig;
    showHeader: boolean;
    picking: boolean;
    onBoxChange: (box: Box) => void;
    onPickColor: (hex: string) => void;
}

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function toHex(r: number, g: number, b: number): string {
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export default function PagePreview({ page, config, showHeader, picking, onBoxChange, onPickColor }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [drag, setDrag] = useState<{ mode: Mode; origin: Box; startX: number; startY: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const scale = Math.min(1, MAX_PREVIEW_WIDTH / page.canvas.width);
        canvas.width = Math.round(page.canvas.width * scale);
        canvas.height = Math.round(page.canvas.height * scale);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(page.canvas, 0, 0, canvas.width, canvas.height);
        if (showHeader) drawHeaderOnCanvas(ctx, config, canvas.width, canvas.height);
    }, [page, config, showHeader]);

    const pointerFraction = useCallback((clientX: number, clientY: number) => {
        const rect = wrapRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return { x: clamp((clientX - rect.left) / rect.width), y: clamp((clientY - rect.top) / rect.height) };
    }, []);

    function pickColorAt(clientX: number, clientY: number) {
        const point = pointerFraction(clientX, clientY);
        const ctx = page.canvas.getContext("2d");
        if (!ctx) return;
        const x = Math.min(page.canvas.width - 1, Math.round(point.x * page.canvas.width));
        const y = Math.min(page.canvas.height - 1, Math.round(point.y * page.canvas.height));
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        onPickColor(toHex(r, g, b));
    }

    function startDrag(event: React.PointerEvent, mode: Mode) {
        event.preventDefault();
        event.stopPropagation();
        (event.target as Element).setPointerCapture?.(event.pointerId);
        const point = pointerFraction(event.clientX, event.clientY);
        const origin = mode.type === "draw" ? { x: point.x, y: point.y, w: MIN_SIZE, h: MIN_SIZE } : { ...config.box };
        if (mode.type === "draw") onBoxChange(origin);
        setDrag({ mode, origin, startX: point.x, startY: point.y });
    }

    useEffect(() => {
        if (!drag) return;

        function move(event: PointerEvent) {
            if (!drag) return;
            const point = pointerFraction(event.clientX, event.clientY);
            const dx = point.x - drag.startX;
            const dy = point.y - drag.startY;
            const base = drag.origin;

            if (drag.mode.type === "move") {
                onBoxChange({
                    ...base,
                    x: clamp(Math.min(base.x + dx, 1 - base.w)),
                    y: clamp(Math.min(base.y + dy, 1 - base.h)),
                });
                return;
            }

            if (drag.mode.type === "draw") {
                const x = Math.min(drag.startX, point.x);
                const y = Math.min(drag.startY, point.y);
                onBoxChange({
                    x,
                    y,
                    w: Math.max(MIN_SIZE, Math.abs(point.x - drag.startX)),
                    h: Math.max(MIN_SIZE, Math.abs(point.y - drag.startY)),
                });
                return;
            }

            const handle = drag.mode.handle;
            let { x, y, w, h } = base;
            if (handle.includes("w")) {
                const nx = Math.min(base.x + dx, base.x + base.w - MIN_SIZE);
                w = base.x + base.w - clamp(nx);
                x = clamp(nx);
            }
            if (handle.includes("e")) w = Math.max(MIN_SIZE, Math.min(1 - base.x, base.w + dx));
            if (handle.includes("n")) {
                const ny = Math.min(base.y + dy, base.y + base.h - MIN_SIZE);
                h = base.y + base.h - clamp(ny);
                y = clamp(ny);
            }
            if (handle.includes("s")) h = Math.max(MIN_SIZE, Math.min(1 - base.y, base.h + dy));
            onBoxChange({ x, y, w, h });
        }

        function end() {
            setDrag(null);
        }

        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
        return () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", end);
            window.removeEventListener("pointercancel", end);
        };
    }, [drag, onBoxChange, pointerFraction]);

    const box = config.box;

    return (
        <div
            ref={wrapRef}
            className={`preview${picking ? " picking" : ""}`}
            onPointerDown={(event) => {
                if (picking) {
                    pickColorAt(event.clientX, event.clientY);
                    return;
                }
                startDrag(event, { type: "draw" });
            }}
        >
            <canvas ref={canvasRef} />
            {!picking && (
                <div
                    className="selection"
                    style={{
                        left: `${box.x * 100}%`,
                        top: `${box.y * 100}%`,
                        width: `${box.w * 100}%`,
                        height: `${box.h * 100}%`,
                    }}
                    onPointerDown={(event) => startDrag(event, { type: "move" })}
                >
                    <span className="selection-label">Değiştirilecek alan</span>
                    {HANDLES.map((handle) => (
                        <span
                            key={handle}
                            className={`handle handle-${handle}`}
                            onPointerDown={(event) => startDrag(event, { type: "resize", handle })}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
