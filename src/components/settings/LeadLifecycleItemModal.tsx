"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Lead lifecycle item modal (shared by sources + stages)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-27 — creation + rename for Customer sources and
// Follow-up stages now go through a modal (previously inline row-edit).
// Same chrome as the DS TaxRateModal so the two settings surfaces read
// consistent.
//
// One modal handles four flows via the `kind` × `mode` matrix:
//   source × create → "Add customer source"
//   source × edit   → "Edit customer source"
//   stage  × create → "Add follow-up stage"
//   stage  × edit   → "Edit follow-up stage"

import { useEffect, useRef, useState } from "react";
import { XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

export type LeadLifecycleKind = "source" | "stage";
export type LeadLifecycleMode = "create" | "edit";

export interface LeadLifecycleItemModalProps {
    kind: LeadLifecycleKind;
    mode: LeadLifecycleMode;
    /** The row being edited — required when mode === "edit". */
    existingId?: string;
    existingLabel?: string;
    onClose: () => void;
    /** Called with the saved id after a successful create / rename. */
    onSaved?: (id: string) => void;
}

/** Copy per (kind, mode) so the header + primary button + placeholder
 *  read correctly without a jungle of ternaries in the render. */
const COPY: Record<LeadLifecycleKind, Record<LeadLifecycleMode, {
    title: string;
    subtitle: string;
    inputLabel: string;
    placeholder: string;
    submit: string;
}>> = {
    source: {
        create: {
            title: "Add customer source",
            subtitle: "Sources appear on lead intake and the customer profile.",
            inputLabel: "Source name",
            placeholder: "e.g. Facebook Ads",
            submit: "Create source",
        },
        edit: {
            title: "Edit customer source",
            subtitle: "Rename this source. Every customer already tagged with it updates to the new name.",
            inputLabel: "Source name",
            placeholder: "e.g. Facebook Ads",
            submit: "Save changes",
        },
    },
    stage: {
        create: {
            title: "Add follow-up stage",
            subtitle: "Stages define your funnel — staff move each lead through them.",
            inputLabel: "Stage name",
            placeholder: "e.g. Waiting on payment",
            submit: "Create stage",
        },
        edit: {
            title: "Edit follow-up stage",
            subtitle: "Rename this stage. Every customer currently on it updates to the new name.",
            inputLabel: "Stage name",
            placeholder: "e.g. Waiting on payment",
            submit: "Save changes",
        },
    },
};

const MAX_STAGES = 8;

export function LeadLifecycleItemModal({
    kind, mode, existingId, existingLabel, onClose, onSaved,
}: LeadLifecycleItemModalProps) {
    const leadSources        = useAppStore(s => s.leadSources);
    const followUpStages     = useAppStore(s => s.followUpStages);
    const addLeadSource      = useAppStore(s => s.addLeadSource);
    const renameLeadSource   = useAppStore(s => s.renameLeadSource);
    const addFollowUpStage   = useAppStore(s => s.addFollowUpStage);
    const renameFollowUpStage = useAppStore(s => s.renameFollowUpStage);
    const showToast          = useAppStore(s => s.showToast);

    const [label, setLabel] = useState(existingLabel ?? "");
    const [touched, setTouched] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const copy = COPY[kind][mode];

    // Autofocus + escape-to-close, matching TaxRateModal.
    useEffect(() => {
        const t = setTimeout(() => inputRef.current?.focus(), 30);
        return () => clearTimeout(t);
    }, []);
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    const trimmed = label.trim();
    const list = kind === "source" ? leadSources : followUpStages;

    // Validation — required + collision (case-insensitive) + stage cap
    // for create mode.
    const error = (() => {
        if (!trimmed) return `${copy.inputLabel} is required.`;
        const collision = list.some(
            r => r.id !== existingId && r.label.toLowerCase() === trimmed.toLowerCase(),
        );
        if (collision) return "This name is already used.";
        if (kind === "stage" && mode === "create" && list.length >= MAX_STAGES) {
            return `Maximum ${MAX_STAGES} stages — remove one first.`;
        }
        return null;
    })();
    const showError = touched && !!error;
    const canSave = !error;

    function handleSubmit() {
        setTouched(true);
        if (!canSave) return;
        if (kind === "source") {
            if (mode === "create") {
                const id = addLeadSource(trimmed);
                if (id) {
                    showToast("Source added", `"${trimmed}" is now available on lead intake.`, "success", "check");
                    onSaved?.(id);
                    onClose();
                }
            } else if (existingId) {
                const ok = renameLeadSource(existingId, trimmed);
                if (ok) {
                    showToast("Source renamed", `Updated to "${trimmed}".`, "success", "check");
                    onSaved?.(existingId);
                    onClose();
                }
            }
        } else {
            if (mode === "create") {
                const id = addFollowUpStage(trimmed);
                if (id) {
                    showToast("Stage added", `"${trimmed}" is now available on the Follow-up status dropdown.`, "success", "check");
                    onSaved?.(id);
                    onClose();
                }
            } else if (existingId) {
                const ok = renameFollowUpStage(existingId, trimmed);
                if (ok) {
                    showToast("Stage renamed", `Every customer on this stage now shows "${trimmed}".`, "success", "check");
                    onSaved?.(existingId);
                    onClose();
                }
            }
        }
    }

    const inputCls = [
        "h-10 w-full px-[14px] border-1 rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] transition-all",
        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white",
        showError
            ? "border-[#fda29b] focus:border-[#f04438]"
            : "border-[var(--colors-border-primary)] focus:border-[var(--colors-secondary-500)]",
    ].join(" ");

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[480px] max-h-[90vh] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex flex-col">
                    <div className="px-6 pt-6 flex items-start gap-4">
                        <div className="flex-1 flex flex-col gap-1">
                            <h3 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">
                                {copy.title}
                            </h3>
                            <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">
                                {copy.subtitle}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-[12px] top-[12px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors"
                    >
                        <XClose className="w-6 h-6 text-[var(--colors-text-quaternary)]" />
                    </button>
                    <div className="h-5 shrink-0" />
                    <div className="h-px bg-[var(--colors-bg-quaternary)] w-full" />
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)] leading-[20px]">
                            {copy.inputLabel}
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            onBlur={() => setTouched(true)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmit();
                            }}
                            placeholder={copy.placeholder}
                            className={inputCls}
                        />
                        {showError && (
                            <p className="text-[14px] text-[#b42318] leading-[20px]">{error}</p>
                        )}
                    </div>
                </div>

                {/* Footer — full-width buttons (client 2026-07-27) so
                    the two actions balance the modal edge-to-edge, same
                    weight as the ConfirmModal footer layout. */}
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center gap-3">
                    <Button variant="secondary-gray" size="md" onClick={onClose} className="flex-1">
                        Cancel
                    </Button>
                    <Button variant="primary" size="md" disabled={!canSave} onClick={handleSubmit} className="flex-1">
                        {copy.submit}
                    </Button>
                </div>
            </div>
        </div>
    );
}
