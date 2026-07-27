"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Customer → Lead lifecycle (v83 Phase 6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Companion to `new-prd/customer-lead-management-implementation-plan.md`
// §Phase 6. Two studio-editable lists on one page, kept together so a
// studio owner tuning their funnel doesn't page-hop between them.
//
//   • Customer sources (top card) — the pool of drop-downs that feeds
//     Customer.sourceId + AddLead intake + the Details tab Source
//     field. System-seeded rows are locked (rename-only).
//   • Follow-up stages (bottom card) — the list of values behind the
//     Details tab Follow-up status dropdown + the header pill. Won
//     and Lost are locked (rename-only). Max 8 stages.
//
// Zero new UI primitives — reuses Button + DS list rows, Toast, and the
// existing inline-add-row pattern from tax / class-categories. Deletes
// go through a shared centred confirmation modal.

import { useState } from "react";
import { Plus, Lock01, Trash01, Edit02, Check, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

/** Max stages guardrail — the plan's PDF §4.2 "keep it tight" ceiling.
 *  Mirrored in the store's addFollowUpStage so the two sides can't drift. */
const MAX_STAGES = 8;

export default function LeadLifecycleSettingsPage() {
    return (
        <div className="flex flex-col gap-6 pb-10">
            <header className="flex flex-col gap-1">
                <h1 className="text-[20px] font-semibold text-[#101828] leading-[30px]">Lead lifecycle</h1>
                <p className="text-[14px] text-[#667085] max-w-[720px]">
                    Studio-editable lists that power the customer profile Follow-up section, the
                    lead pill on customer cards, and the AI-Agent lead migration flow.
                </p>
            </header>

            <LeadSourcesCard />
            <FollowUpStagesCard />

            <Toast />
        </div>
    );
}

// ─── Customer sources ────────────────────────────────────────────────────────

function LeadSourcesCard() {
    const leadSources = useAppStore(s => s.leadSources);
    const addLeadSource = useAppStore(s => s.addLeadSource);
    const renameLeadSource = useAppStore(s => s.renameLeadSource);
    const deleteLeadSource = useAppStore(s => s.deleteLeadSource);
    const showToast = useAppStore(s => s.showToast);

    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

    function handleAdd() {
        const clean = newLabel.trim();
        if (!clean) {
            setAdding(false);
            return;
        }
        const beforeCount = leadSources.length;
        addLeadSource(clean);
        const after = useAppStore.getState().leadSources.length;
        if (after > beforeCount) {
            showToast("Source added", `"${clean}" is now available on lead intake.`, "success", "check");
        } else {
            showToast("Already exists", `"${clean}" is already in the list.`, "warning", "alert");
        }
        setNewLabel("");
        setAdding(false);
    }

    function handleRename(id: string) {
        const clean = editLabel.trim();
        if (!clean) {
            setEditing(null);
            return;
        }
        const ok = renameLeadSource(id, clean);
        if (ok) {
            showToast("Source renamed", `Updated to "${clean}".`, "success", "check");
            setEditing(null);
        } else {
            showToast("Rename failed", "Another source already uses that name.", "warning", "alert");
        }
    }

    function handleDelete(id: string, label: string) {
        const result = deleteLeadSource(id);
        if (result.deleted) {
            showToast("Source deleted", `"${label}" removed from lead intake.`, "success", "check");
            setConfirmDelete(null);
            return;
        }
        if (result.reason === "locked") {
            showToast("Can't delete", "System sources can be renamed but not removed.", "warning", "alert");
        } else {
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
            <section className="rounded-[12px] border border-[#e4e7ec] bg-white overflow-hidden">
                <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#e4e7ec]">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[16px] font-semibold text-[#101828]">Customer sources</p>
                        <p className="text-[13px] text-[#667085]">
                            Where new leads and customers come from. Powers the lead form + Details tab
                            Source field + Acquisition report.
                        </p>
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => setAdding(true)}
                    >
                        Add source
                    </Button>
                </header>
                <ul className="divide-y divide-[#f2f4f7]">
                    {leadSources.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                            {editing === s.id ? (
                                <>
                                    <input
                                        autoFocus
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRename(s.id);
                                            if (e.key === "Escape") setEditing(null);
                                        }}
                                        className="flex-1 rounded-md border border-[#658774] px-3 py-1.5 text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#658774]/40"
                                    />
                                    <IconButton label="Save rename" onClick={() => handleRename(s.id)} icon={<Check className="w-4 h-4" />} />
                                    <IconButton label="Cancel rename" onClick={() => setEditing(null)} icon={<XClose className="w-4 h-4" />} />
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-[14px] text-[#101828]">{s.label}</span>
                                    {s.locked && (
                                        <span className="flex items-center gap-1 text-[12px] text-[#667085]">
                                            <Lock01 className="w-3.5 h-3.5" />
                                            System
                                        </span>
                                    )}
                                    <IconButton
                                        label="Rename source"
                                        onClick={() => {
                                            setEditLabel(s.label);
                                            setEditing(s.id);
                                        }}
                                        icon={<Edit02 className="w-4 h-4" />}
                                    />
                                    <IconButton
                                        label="Delete source"
                                        onClick={() => setConfirmDelete({ id: s.id, label: s.label })}
                                        icon={<Trash01 className="w-4 h-4" />}
                                        disabled={s.locked}
                                        variant="danger"
                                    />
                                </>
                            )}
                        </li>
                    ))}
                    {adding && (
                        <li className="flex items-center gap-3 px-6 py-3 bg-[#f9fafb]">
                            <input
                                autoFocus
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                    if (e.key === "Escape") { setNewLabel(""); setAdding(false); }
                                }}
                                placeholder="New source name…"
                                className="flex-1 rounded-md border border-[#658774] px-3 py-1.5 text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#658774]/40"
                            />
                            <IconButton label="Save new source" onClick={handleAdd} icon={<Check className="w-4 h-4" />} />
                            <IconButton label="Cancel new source" onClick={() => { setNewLabel(""); setAdding(false); }} icon={<XClose className="w-4 h-4" />} />
                        </li>
                    )}
                </ul>
            </section>

            {confirmDelete && (
                <ConfirmDeleteModal
                    title="Delete source?"
                    body={<>Remove <span className="font-medium text-[#101828]">&ldquo;{confirmDelete.label}&rdquo;</span> from the lead intake list. Customers already tagged with this source keep their history but the value stops appearing in the picker.</>}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => handleDelete(confirmDelete.id, confirmDelete.label)}
                />
            )}
        </>
    );
}

// ─── Follow-up stages ────────────────────────────────────────────────────────

function FollowUpStagesCard() {
    const followUpStages = useAppStore(s => s.followUpStages);
    const addFollowUpStage = useAppStore(s => s.addFollowUpStage);
    const renameFollowUpStage = useAppStore(s => s.renameFollowUpStage);
    const deleteFollowUpStage = useAppStore(s => s.deleteFollowUpStage);
    const showToast = useAppStore(s => s.showToast);

    const [adding, setAdding] = useState(false);
    const [newLabel, setNewLabel] = useState("");
    const [editing, setEditing] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState("");
    const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

    const atMax = followUpStages.length >= MAX_STAGES;

    function handleAdd() {
        const clean = newLabel.trim();
        if (!clean) {
            setAdding(false);
            return;
        }
        if (atMax) {
            showToast("Max stages reached", `Keep the funnel tight — the maximum is ${MAX_STAGES} stages.`, "warning", "alert");
            return;
        }
        const id = addFollowUpStage(clean);
        if (id) {
            showToast("Stage added", `"${clean}" is now available on the Follow-up status dropdown.`, "success", "check");
        } else {
            showToast("Add failed", `Couldn't add "${clean}". You may already have this stage or hit the ${MAX_STAGES}-stage cap.`, "warning", "alert");
        }
        setNewLabel("");
        setAdding(false);
    }

    function handleRename(id: string) {
        const clean = editLabel.trim();
        if (!clean) {
            setEditing(null);
            return;
        }
        const ok = renameFollowUpStage(id, clean);
        if (ok) {
            showToast("Stage renamed", `Every customer on this stage now shows "${clean}".`, "success", "check");
            setEditing(null);
        } else {
            showToast("Rename failed", "Another stage already uses that name.", "warning", "alert");
        }
    }

    function handleDelete(id: string, label: string) {
        const result = deleteFollowUpStage(id);
        if (result.deleted) {
            showToast("Stage deleted", `"${label}" removed from the funnel.`, "success", "check");
            setConfirmDelete(null);
            return;
        }
        if (result.reason === "locked") {
            showToast("Can't delete", "Won and Lost close the funnel and can't be removed.", "warning", "alert");
        } else {
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
            <section className="rounded-[12px] border border-[#e4e7ec] bg-white overflow-hidden">
                <header className="flex items-start justify-between gap-3 px-6 py-4 border-b border-[#e4e7ec]">
                    <div className="flex flex-col gap-0.5">
                        <p className="text-[16px] font-semibold text-[#101828]">Follow-up stages</p>
                        <p className="text-[13px] text-[#667085]">
                            The funnel your staff moves each lead through. Won and Lost close the funnel
                            and can&apos;t be removed. Keep it tight — max {MAX_STAGES} stages.
                        </p>
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => setAdding(true)}
                        disabled={atMax}
                    >
                        Add stage
                    </Button>
                </header>
                <ul className="divide-y divide-[#f2f4f7]">
                    {followUpStages.map(s => (
                        <li key={s.id} className="flex items-center gap-3 px-6 py-3">
                            {editing === s.id ? (
                                <>
                                    <input
                                        autoFocus
                                        value={editLabel}
                                        onChange={(e) => setEditLabel(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleRename(s.id);
                                            if (e.key === "Escape") setEditing(null);
                                        }}
                                        className="flex-1 rounded-md border border-[#658774] px-3 py-1.5 text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#658774]/40"
                                    />
                                    <IconButton label="Save rename" onClick={() => handleRename(s.id)} icon={<Check className="w-4 h-4" />} />
                                    <IconButton label="Cancel rename" onClick={() => setEditing(null)} icon={<XClose className="w-4 h-4" />} />
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 text-[14px] text-[#101828]">{s.label}</span>
                                    {s.isTerminal && (
                                        <span className="flex items-center gap-1 text-[12px] text-[#667085]">
                                            Terminal
                                        </span>
                                    )}
                                    {s.locked && (
                                        <span className="flex items-center gap-1 text-[12px] text-[#667085]">
                                            <Lock01 className="w-3.5 h-3.5" />
                                            System
                                        </span>
                                    )}
                                    <IconButton
                                        label="Rename stage"
                                        onClick={() => {
                                            setEditLabel(s.label);
                                            setEditing(s.id);
                                        }}
                                        icon={<Edit02 className="w-4 h-4" />}
                                    />
                                    <IconButton
                                        label="Delete stage"
                                        onClick={() => setConfirmDelete({ id: s.id, label: s.label })}
                                        icon={<Trash01 className="w-4 h-4" />}
                                        disabled={s.locked}
                                        variant="danger"
                                    />
                                </>
                            )}
                        </li>
                    ))}
                    {adding && (
                        <li className="flex items-center gap-3 px-6 py-3 bg-[#f9fafb]">
                            <input
                                autoFocus
                                value={newLabel}
                                onChange={(e) => setNewLabel(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") handleAdd();
                                    if (e.key === "Escape") { setNewLabel(""); setAdding(false); }
                                }}
                                placeholder="New stage name…"
                                className="flex-1 rounded-md border border-[#658774] px-3 py-1.5 text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#658774]/40"
                            />
                            <IconButton label="Save new stage" onClick={handleAdd} icon={<Check className="w-4 h-4" />} />
                            <IconButton label="Cancel new stage" onClick={() => { setNewLabel(""); setAdding(false); }} icon={<XClose className="w-4 h-4" />} />
                        </li>
                    )}
                </ul>
            </section>

            {confirmDelete && (
                <ConfirmDeleteModal
                    title="Delete stage?"
                    body={<>Remove <span className="font-medium text-[#101828]">&ldquo;{confirmDelete.label}&rdquo;</span> from the funnel. Customers currently on this stage are checked first — if any are, the delete is blocked and you&apos;ll be asked to move them off.</>}
                    onCancel={() => setConfirmDelete(null)}
                    onConfirm={() => handleDelete(confirmDelete.id, confirmDelete.label)}
                />
            )}
        </>
    );
}

// ─── Building blocks ─────────────────────────────────────────────────────────

/** Small icon-button — kept inline because it's used only on this page
 *  and every other DS icon-button has extra layout the row-actions don't
 *  need. Composes onClick / disabled / variant only. */
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
                "text-[#667085]",
                !disabled && variant === "neutral" && "hover:bg-[#f2f4f7] hover:text-[#344054]",
                !disabled && variant === "danger" && "hover:bg-[#fef3f2] hover:text-[#b42318]",
                disabled && "opacity-40 cursor-not-allowed",
            )}
        >
            {icon}
        </button>
    );
}

/** Centred confirmation modal. Same visual shape as every other
 *  destructive-confirm modal (Delete customer, Delete class category
 *  etc.); kept inline so this file doesn't need a shared modal harness. */
function ConfirmDeleteModal({
    title, body, onCancel, onConfirm,
}: {
    title: string;
    body: React.ReactNode;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0c111d]/40 px-4">
            <div className="bg-white rounded-[16px] w-full max-w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] overflow-hidden">
                <div className="flex flex-col gap-2 px-6 pt-6">
                    <p className="text-[18px] font-semibold text-[#101828]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{body}</p>
                </div>
                <div className="flex items-center justify-end gap-2 px-6 pb-6 pt-6">
                    <Button variant="secondary-gray" size="md" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="md" onClick={onConfirm}>Delete</Button>
                </div>
            </div>
        </div>
    );
}
