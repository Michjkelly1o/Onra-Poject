"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CustomerConfirmModal — centered confirmation dialog
// ─────────────────────────────────────────────────────────────────────────────
//
// State-changing single-step actions (remove guest, etc.) use a centered modal
// with Cancel + Confirm. Rendered via a portal at the document root (z-[70]) so
// it escapes the member column's stacking context and sits above sheets + nav.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

export interface CustomerConfirmModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    confirmLabel: string;
    cancelLabel?: string;
    destructive?: boolean;
    onConfirm: () => void;
}

export function CustomerConfirmModal({
    open,
    onClose,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    destructive = false,
    onConfirm,
}: CustomerConfirmModalProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
            <button type="button" aria-label="Close" className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                className="relative z-10 flex w-full max-w-[360px] flex-col gap-5 rounded-2xl bg-white p-5 shadow-[0px_8px_24px_0px_rgba(16,24,40,0.18)]"
            >
                <div className="flex flex-col gap-1.5">
                    <p className="text-base font-semibold leading-6 text-[#101828]">{title}</p>
                    <p className="text-sm font-normal leading-5 text-[#475467]">{description}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="secondary-gray" size="lg" className="flex-1 rounded-full" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={destructive ? "destructive" : "primary"}
                        size="lg"
                        className="flex-1 rounded-full"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
