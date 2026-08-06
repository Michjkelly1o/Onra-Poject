"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Customer → Lead lifecycle (v83 Phase 6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Two studio-editable lists on one page:
//   • Customer sources (top card) — the pool of drop-downs that feeds
//     Customer.sourceId + AddLead intake + the Details tab Source
//     field.
//   • Follow-up stages (bottom card) — the list of values behind the
//     Details tab Follow-up status dropdown + the header pill. Max
//     8 stages. `Won` + `Lost` labels can be renamed but the funnel
//     precedence rules resolve by stable id (stg_won / stg_lost) so
//     a rename doesn't disturb behaviour.
//
// Client 2026-07-27 — Create + rename now go through the DS
// LeadLifecycleItemModal (matches TaxRateModal chrome). Delete goes
// through the DS ConfirmModal.

import { useState } from "react";
import { Plus, Trash01, Edit02 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { LeadLifecycleItemModal, type LeadLifecycleMode } from "@/components/settings/LeadLifecycleItemModal";
import { cn } from "@/lib/utils";

/** Max stages guardrail — the plan's PDF §4.2 "keep it tight" ceiling.
 *  Mirrored in the store's addFollowUpStage so the two sides can't drift. */
const MAX_STAGES = 8;

export default function LeadLifecycleSettingsPage() {
    return (
        <div className="flex flex-col gap-6 pb-10">
            <LeadSourcesCard />
            <FollowUpStagesCard />
            <Toast />
        </div>
    );
}

// ─── Customer sources ────────────────────────────────────────────────────────

function LeadSourcesCard() {
    const leadSources = useAppStore(s => s.leadSources);
    const deleteLeadSource = useAppStore(s => s.deleteLeadSource);
    const showToast = useAppStore(s => s.showToast);

    const [editing, setEditing] = useState<{ mode: LeadLifecycleMode; id?: string; label?: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

    function handleDelete(id: string, label: string) {
        const result = deleteLeadSource(id);
        if (result.deleted) {
            showToast("Source deleted", `"${label}" removed from lead intake.`, "success", "check");
            setConfirmDelete(null);
            return;
        }
        if (result.reason === "in_use") {
            showToast(
                "Source in use",
                `${result.usageCount} customer${result.usageCount === 1 ? "" : "s"} still reference "${label}".`,
                "warning",
                "alert",
            );
        }
        setConfirmDelete(null);
    }

    return (
        <>
            <section className="rounded-[12px] border border-[var(--colors-border-secondary)] bg-white overflow-hidden">
                <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--colors-border-secondary)]">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Customer sources</p>
                        <p className="text-[13px] text-[var(--colors-text-quaternary)]">
                            Where new leads and customers come from. Powers the lead form + Details tab
                            Source field + Acquisition report.
                        </p>
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => setEditing({ mode: "create" })}
                    >
                        Add
                    </Button>
                </header>
                <ul className="divide-y divide-[var(--colors-bg-tertiary)]">
                    {leadSources.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                            <span className="flex-1 text-[14px] text-[var(--colors-text-primary)]">{s.label}</span>
                            <IconButton
                                label="Rename source"
                                onClick={() => setEditing({ mode: "edit", id: s.id, label: s.label })}
                                icon={<Edit02 className="w-4 h-4" />}
                            />
                            <IconButton
                                label="Delete source"
                                onClick={() => setConfirmDelete({ id: s.id, label: s.label })}
                                icon={<Trash01 className="w-4 h-4" />}
                                variant="danger"
                            />
                        </li>
                    ))}
                </ul>
            </section>

            {editing && (
                <LeadLifecycleItemModal
                    kind="source"
                    mode={editing.mode}
                    existingId={editing.id}
                    existingLabel={editing.label}
                    onClose={() => setEditing(null)}
                />
            )}

            <ConfirmModal
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                icon={Trash01}
                tone="danger"
                title="Delete source?"
                description={confirmDelete ? (
                    <>Remove <span className="font-medium text-[var(--colors-text-primary)]">&ldquo;{confirmDelete.label}&rdquo;</span> from the lead intake list. Customers already tagged with this source keep their history but the value stops appearing in the picker.</>
                ) : ""}
                confirmLabel="Delete"
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id, confirmDelete.label)}
            />
        </>
    );
}

// ─── Follow-up stages ────────────────────────────────────────────────────────

function FollowUpStagesCard() {
    const followUpStages = useAppStore(s => s.followUpStages);
    const deleteFollowUpStage = useAppStore(s => s.deleteFollowUpStage);
    const showToast = useAppStore(s => s.showToast);

    const [editing, setEditing] = useState<{ mode: LeadLifecycleMode; id?: string; label?: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

    const atMax = followUpStages.length >= MAX_STAGES;

    function handleDelete(id: string, label: string) {
        const result = deleteFollowUpStage(id);
        if (result.deleted) {
            showToast("Stage deleted", `"${label}" removed from the funnel.`, "success", "check");
            setConfirmDelete(null);
            return;
        }
        if (result.reason === "in_use") {
            showToast(
                "Stage in use",
                `${result.usageCount} customer${result.usageCount === 1 ? "" : "s"} still sit on "${label}". Move them off first, then try again.`,
                "warning",
                "alert",
            );
        }
        setConfirmDelete(null);
    }

    return (
        <>
            <section className="rounded-[12px] border border-[var(--colors-border-secondary)] bg-white overflow-hidden">
                <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[var(--colors-border-secondary)]">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Follow-up stages</p>
                        <p className="text-[13px] text-[var(--colors-text-quaternary)]">
                            The funnel your staff moves each lead through. Keep it tight — max {MAX_STAGES} stages.
                        </p>
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => setEditing({ mode: "create" })}
                        disabled={atMax}
                    >
                        Add
                    </Button>
                </header>
                <ul className="divide-y divide-[var(--colors-bg-tertiary)]">
                    {followUpStages.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                            <span className="flex-1 text-[14px] text-[var(--colors-text-primary)]">{s.label}</span>
                            <IconButton
                                label="Rename stage"
                                onClick={() => setEditing({ mode: "edit", id: s.id, label: s.label })}
                                icon={<Edit02 className="w-4 h-4" />}
                            />
                            <IconButton
                                label="Delete stage"
                                onClick={() => setConfirmDelete({ id: s.id, label: s.label })}
                                icon={<Trash01 className="w-4 h-4" />}
                                variant="danger"
                            />
                        </li>
                    ))}
                </ul>
            </section>

            {editing && (
                <LeadLifecycleItemModal
                    kind="stage"
                    mode={editing.mode}
                    existingId={editing.id}
                    existingLabel={editing.label}
                    onClose={() => setEditing(null)}
                />
            )}

            <ConfirmModal
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                icon={Trash01}
                tone="danger"
                title="Delete stage?"
                description={confirmDelete ? (
                    <>Remove <span className="font-medium text-[var(--colors-text-primary)]">&ldquo;{confirmDelete.label}&rdquo;</span> from the funnel. Customers currently on this stage are checked first — if any are, the delete is blocked and you&apos;ll be asked to move them off.</>
                ) : ""}
                confirmLabel="Delete"
                onConfirm={() => confirmDelete && handleDelete(confirmDelete.id, confirmDelete.label)}
            />
        </>
    );
}

// ─── Row action button ──────────────────────────────────────────────────────

function IconButton({
    label, onClick, icon, disabled = false, variant = "neutral",
}: {
    label: string;
    onClick: () => void;
    icon: React.ReactNode;
    disabled?: boolean;
    variant?: "neutral" | "danger";
}) {
    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors",
                "text-[var(--colors-text-quaternary)]",
                !disabled && variant === "neutral" && "hover:bg-[var(--colors-bg-tertiary)] hover:text-[var(--colors-text-secondary)]",
                !disabled && variant === "danger" && "hover:bg-[#fef3f2] hover:text-[#b42318]",
                disabled && "opacity-40 cursor-not-allowed",
            )}
        >
            {icon}
        </button>
    );
}
