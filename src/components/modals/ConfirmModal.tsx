"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ConfirmModal
// ─────────────────────────────────────────────────────────────────────────────
//
// Consolidates the ~20+ ActionModal / DeleteConfirmModal / ToggleConfirmModal
// variants scattered across the admin pages. Same chrome every time:
//   • Centered icon circle (tone-coloured background + icon)
//   • Title + description
//   • Cancel + Confirm buttons (Confirm tone driven by `tone` prop)
//
// Tone matrix (from the audit):
//   • danger  → red (Delete / Deactivate / Cancel destructive flows)
//   • success → green / sage (Archive / Recover / Reactivate)
//   • warning → amber (Pending confirmations)
//   • info    → blue (read-only confirmations)
//
// Bulk variant: passing `count` switches the chrome into bulk-action mode
// (matches the existing ActionModal "bulk" branch used by the customer list,
// products list, agreements list, etc.).

import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Modal } from "./Modal";

export type ConfirmTone = "danger" | "success" | "warning" | "info";

const TONE_STYLES: Record<ConfirmTone, { iconBg: string; iconColor: string }> = {
    danger:  { iconBg: "bg-[#fee4e2]", iconColor: "text-[#d92d20]" },
    success: { iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]" },
    warning: { iconBg: "bg-[#fef0c7]", iconColor: "text-[#dc6803]" },
    info:    { iconBg: "bg-[#eff8ff]", iconColor: "text-[#175cd3]" },
};

export interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    icon: ElementType;
    /** Drives the icon circle palette + the confirm-button variant. */
    tone: ConfirmTone;
    title: string;
    description: React.ReactNode;
    confirmLabel: string;
    cancelLabel?: string;
    onConfirm: () => void;
    /** Show a count badge in the title (e.g. "Delete 3 customers?"). */
    count?: number;
    /** Disable the confirm button — used for async-pending states. */
    confirmDisabled?: boolean;
    /** Container max-width in pixels. Default 440 (canonical). */
    maxWidth?: number;
    /** Override the Modal's z-index. Default 300 (above slide panels). */
    zIndex?: number;
    /** Extra rendered between description and footer (e.g. the "Refund?"
     *  toggle on CancelClassModal). */
    extraContent?: React.ReactNode;
}

export function ConfirmModal({
    open,
    onClose,
    icon,
    tone,
    title,
    description,
    confirmLabel,
    cancelLabel = "Cancel",
    onConfirm,
    count,
    confirmDisabled = false,
    maxWidth = 440,
    zIndex = 300,
    extraContent,
}: ConfirmModalProps) {
    const palette = TONE_STYLES[tone];
    // Convert the count, when present, into the displayed title prefix.
    const displayedTitle = count != null && count > 1
        ? title.replace(/\?$/, ` ${count}?`).replace(/the$/, "these")
        : title;

    return (
        <Modal
            open={open}
            onClose={onClose}
            maxWidth={maxWidth}
            zIndex={zIndex}
        >
            <Modal.Header
                title={displayedTitle}
                subtitle={description}
                onClose={onClose}
                icon={icon}
                iconBg={palette.iconBg}
                iconColor={palette.iconColor}
                centered
            />

            {extraContent && (
                <>
                    <div className="h-5 shrink-0" />
                    <div className="h-px w-full bg-[#e4e7ec]" />
                    {extraContent}
                </>
            )}

            <Modal.Footer layout="full" className={cn(extraContent ? "pt-6" : "pt-6")}>
                <Button variant="secondary-gray" size="lg" onClick={onClose}>
                    {cancelLabel}
                </Button>
                <Button
                    variant={tone === "danger" ? "destructive" : "primary"}
                    size="lg"
                    disabled={confirmDisabled}
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            </Modal.Footer>
        </Modal>
    );
}
