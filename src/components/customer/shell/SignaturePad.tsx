"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — SignaturePad (canvas) — used by the booking Waiver ("Sign here")
// ─────────────────────────────────────────────────────────────────────────────
//
// A lightweight pointer-drawn signature field: a bordered white canvas the
// customer (or a minor's guardian) signs with finger / stylus / mouse. Reports
// whether any ink has been laid down via `onChange(signed)` so the parent can
// gate its "Agree & continue" action, and offers a "Clear" affordance once
// signed. Device-pixel-ratio aware so strokes stay crisp on retina phones.

import { useEffect, useRef, useState } from "react";
import { RefreshCcw01 } from "@untitledui/icons";

export function SignaturePad({
    onChange,
    ariaLabel = "Signature",
}: {
    /** Fired when the pad transitions between empty and signed. */
    onChange?: (signed: boolean) => void;
    ariaLabel?: string;
}) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const drawing = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [hasInk, setHasInk] = useState(false);

    // Size the backing store to the CSS box × devicePixelRatio for crisp strokes.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ratio = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * ratio));
        canvas.height = Math.max(1, Math.round(rect.height * ratio));
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.scale(ratio, ratio);
            ctx.lineWidth = 2.5;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.strokeStyle = "#1d2939";
        }
    }, []);

    function point(e: React.PointerEvent<HTMLCanvasElement>) {
        const rect = canvasRef.current!.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function start(e: React.PointerEvent<HTMLCanvasElement>) {
        e.preventDefault();
        drawing.current = true;
        last.current = point(e);
        canvasRef.current?.setPointerCapture(e.pointerId);
    }
    function move(e: React.PointerEvent<HTMLCanvasElement>) {
        if (!drawing.current) return;
        e.preventDefault();
        const ctx = canvasRef.current?.getContext("2d");
        const p = point(e);
        if (ctx && last.current) {
            ctx.beginPath();
            ctx.moveTo(last.current.x, last.current.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
        }
        last.current = p;
        if (!hasInk) {
            setHasInk(true);
            onChange?.(true);
        }
    }
    function end() {
        drawing.current = false;
        last.current = null;
    }

    function clear() {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
            const rect = canvas.getBoundingClientRect();
            ctx.clearRect(0, 0, rect.width, rect.height);
        }
        setHasInk(false);
        onChange?.(false);
    }

    return (
        <div className="relative w-full">
            <canvas
                ref={canvasRef}
                role="img"
                aria-label={ariaLabel}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={end}
                onPointerLeave={end}
                onPointerCancel={end}
                className="h-40 w-full touch-none rounded-xl border border-[#d0d5dd] bg-white"
            />
            {!hasInk && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-normal leading-5 text-[#98a2b3]">
                    Sign with your finger
                </span>
            )}
            {hasInk && (
                <button
                    type="button"
                    onClick={clear}
                    className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[#e4e7ec] bg-white/90 px-2.5 py-1 text-xs font-medium leading-[18px] text-[#344054] backdrop-blur-sm transition-colors active:bg-gray-50"
                >
                    <RefreshCcw01 className="size-3" aria-hidden />
                    Clear
                </button>
            )}
        </div>
    );
}
