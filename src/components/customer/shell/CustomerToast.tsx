"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CustomerToast + CustomerToastHost (shared success feedback) — Figma 2191-11241
// ─────────────────────────────────────────────────────────────────────────────
//
// A top-anchored white toast card: a configurable 20px icon, a semibold title, an
// optional subtext, and auto-dismiss. <CustomerToast> is the presentational card
// (fully configurable); <CustomerToastHost> wires it to the store `toast` slice and
// owns the enter/exit animation + auto-dismiss, mounted once in the member shell.
//
// Trigger from anywhere via `useAppStore().showToast(title, message, type, icon)`,
// e.g. cancelling a booking → showToast("Booking cancelled", "Your credit has
// been returned to your account.", "success", "refresh").

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, SVGProps } from "react";
import { Archive, Bell01, Check, RefreshCcw01, SlashCircle01, Trash01 } from "@untitledui/icons";
import { useAppStore, type ToastData } from "@/lib/store";

const SUCCESS = "var(--brand-primary)";
const DANGER = "#d92d20";
const NEUTRAL = "#475467";

/** Map the store's icon key → an icon component + colour. */
function resolveIcon(icon: ToastData["icon"], type: ToastData["type"]): {
    Icon: ComponentType<SVGProps<SVGSVGElement>>;
    color: string;
} {
    switch (icon) {
        case "refresh":
            return { Icon: RefreshCcw01, color: DANGER };
        case "slash":
            return { Icon: SlashCircle01, color: DANGER };
        case "trash":
            return { Icon: Trash01, color: DANGER };
        case "archive":
            return { Icon: Archive, color: NEUTRAL };
        case "check":
            return { Icon: Check, color: SUCCESS };
        case "bell":
            return { Icon: Bell01, color: NEUTRAL };
        default:
            return { Icon: Check, color: type === "error" ? DANGER : SUCCESS };
    }
}

export interface CustomerToastProps {
    icon: ComponentType<SVGProps<SVGSVGElement>>;
    iconColor?: string;
    title: string;
    subtext?: string;
}

/** Presentational card — fully configurable, no store coupling. */
export function CustomerToast({ icon: Icon, iconColor = "var(--brand-text)", title, subtext }: CustomerToastProps) {
    return (
        <div className="flex w-full items-start gap-3 rounded-2xl border border-[var(--colors-bg-tertiary)] bg-white p-4 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
            <Icon className="size-5 shrink-0" style={{ color: iconColor }} aria-hidden />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm font-semibold leading-5 text-[var(--brand-text)] font-heading">{title}</p>
                {subtext && <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-secondary)]">{subtext}</p>}
            </div>
        </div>
    );
}

/** Store-driven host: renders the current toast at the top of the shell, animates
 *  it in, and auto-dismisses after `duration` ms (tap to dismiss early). */
export function CustomerToastHost({ duration = 4000 }: { duration?: number }) {
    const toast = useAppStore((s) => s.toast);
    const clearToast = useAppStore((s) => s.clearToast);
    const [shown, setShown] = useState(false);
    // Portal to <body> so the toast paints ABOVE bottom sheets (which are
    // themselves body-level portals) instead of behind their dim overlay.
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!toast) return;
        const enter = requestAnimationFrame(() => setShown(true));
        const hide = setTimeout(() => setShown(false), duration);
        const clear = setTimeout(clearToast, duration + 300); // after the exit transition
        return () => {
            cancelAnimationFrame(enter);
            clearTimeout(hide);
            clearTimeout(clear);
            setShown(false);
        };
    }, [toast?.id, duration, clearToast]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!toast || !mounted) return null;
    const { Icon, color } = resolveIcon(toast.icon, toast.type);

    // z-[120] clears the CustomerSheet portal (z-[60]); centred at the 402px
    // phone-frame width with 16px (px-4) side gutters so the card insets inside
    // the simulated device rather than spanning edge-to-edge.
    return createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] flex justify-center pt-[max(12px,env(safe-area-inset-top))]">
            <div
                role="status"
                aria-live="polite"
                onClick={() => {
                    setShown(false);
                    clearToast();
                }}
                className="pointer-events-auto w-full max-w-[402px] px-4 transition-all duration-300 ease-out"
                style={{ opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : "translateY(-8px)" }}
            >
                <CustomerToast icon={Icon} iconColor={color} title={toast.title} subtext={toast.message} />
            </div>
        </div>,
        document.body,
    );
}
