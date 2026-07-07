"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ShareSheet (shared) — reusable share bottom sheet
// ─────────────────────────────────────────────────────────────────────────────
//
// A bottom sheet with common share targets (Messages · WhatsApp · Email · Copy
// link). Reused by the Referral flow and the Class / Appointment detail share
// action. Each target opens the platform intent with the composed message + link
// prefilled; Copy link writes the same text to the clipboard.

import type { ReactNode } from "react";
import { Link01, Mail01, MessageChatCircle } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { CustomerSheet } from "./CustomerSheet";
import { SheetToolbar } from "./SheetToolbar";

function WhatsAppGlyph({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
            <path d="M17.6 6.32A7.85 7.85 0 0 0 12 4a7.94 7.94 0 0 0-6.9 11.9L4 20l4.2-1.1a7.9 7.9 0 0 0 3.8 1 7.94 7.94 0 0 0 5.6-13.58ZM12 18.5a6.6 6.6 0 0 1-3.36-.92l-.24-.14-2.5.65.67-2.43-.16-.25A6.6 6.6 0 1 1 12 18.5Zm3.62-4.94c-.2-.1-1.17-.58-1.35-.64s-.31-.1-.44.1-.5.64-.62.77-.23.15-.43.05a5.4 5.4 0 0 1-1.6-.99 6 6 0 0 1-1.1-1.37c-.12-.2 0-.31.09-.41l.3-.35a1.3 1.3 0 0 0 .2-.34.37.37 0 0 0-.02-.35c-.05-.1-.44-1.06-.6-1.45s-.32-.33-.44-.34h-.38a.72.72 0 0 0-.52.24 2.2 2.2 0 0 0-.68 1.63 3.8 3.8 0 0 0 .8 2.02 8.7 8.7 0 0 0 3.35 2.96c.47.2.83.32 1.11.41.47.15.9.13 1.23.08.38-.06 1.17-.48 1.33-.94s.17-.86.12-.94-.18-.14-.38-.24Z" />
        </svg>
    );
}

export interface ShareSheetProps {
    open: boolean;
    onClose: () => void;
    /** Sheet title + email subject. Default "Share". */
    title?: string;
    /** The message body (already composed / resolved). */
    message: string;
    /** A link appended to the shared text + copied by "Copy link". */
    url?: string;
    /** Optional preview block above the targets (e.g. referral message + code). */
    preview?: ReactNode;
}

export function ShareSheet({ open, onClose, title = "Share", message, url, preview }: ShareSheetProps) {
    const showToast = useAppStore((s) => s.showToast);
    const full = url ? `${message}\n\n${url}` : message;
    const enc = encodeURIComponent(full);

    function openIntent(href: string) {
        try {
            window.open(href, "_blank");
        } catch {
            /* ignore — demo environment */
        }
        onClose();
    }
    function copyLink() {
        navigator.clipboard
            ?.writeText(full)
            .then(() => showToast("Copied to clipboard", "Share it with your friends.", "success"))
            .catch(() => showToast("Couldn't copy", "Please try again.", "error"));
        onClose();
    }

    const targets: { key: string; label: string; bg: string; icon: ReactNode; run: () => void }[] = [
        {
            key: "messages",
            label: "Messages",
            bg: "#0a84ff",
            icon: <MessageChatCircle className="size-6 text-white" aria-hidden />,
            run: () => openIntent(`sms:?&body=${enc}`),
        },
        {
            key: "whatsapp",
            label: "WhatsApp",
            bg: "#25d366",
            icon: <WhatsAppGlyph className="size-6 text-white" />,
            run: () => openIntent(`https://wa.me/?text=${enc}`),
        },
        {
            key: "email",
            label: "Email",
            bg: "#667085",
            icon: <Mail01 className="size-6 text-white" aria-hidden />,
            run: () => openIntent(`mailto:?subject=${encodeURIComponent(title)}&body=${enc}`),
        },
        {
            key: "copy",
            label: "Copy link",
            bg: "#344054",
            icon: <Link01 className="size-6 text-white" aria-hidden />,
            run: copyLink,
        },
    ];

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title={title} onClose={onClose} />
            <div className="flex flex-col gap-5 pt-1">
                {preview}
                <div className="grid grid-cols-4 gap-2">
                    {targets.map((t) => (
                        <button key={t.key} type="button" onClick={t.run} className="flex flex-col items-center gap-2">
                            <span
                                className="flex size-14 items-center justify-center rounded-full transition-transform active:scale-95"
                                style={{ backgroundColor: t.bg }}
                            >
                                {t.icon}
                            </span>
                            <span className="text-center text-xs font-medium leading-4 text-[#344054]">{t.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        </CustomerSheet>
    );
}
