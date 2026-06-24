"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Booking Rules landing (/admin/settings/booking-rules)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4580:29847 (empty) + 4580:34127 (populated policies container) —
// two stacked white cards:
//   1. Classes  — read-only summary (Bookings open / Bookings close /
//      Auto-submit attendance / Waitlist enabled / Max waiting spots).
//      Top-right "Customize" navigates to /settings/booking-rules/customize.
//   2. Cancellation & no-show policies — Add new button + list of saved
//      policies with edit + delete row actions. Empty state when none.
//
// ── Phase 4 module reshuffle ────────────────────────────────────────────
// "Service categories" used to live here as the third card. It moved to
// its own page at /admin/categories under the Classes sidebar group so
// admins manage class taxonomy alongside Class templates / Schedule /
// Services instead of buried inside Settings. The data layer is
// unchanged — the new page reads the same `classCategories` slice and
// calls the same mutators.
//
// The delete confirm modal stays here for the policy delete flow.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Edit02, Plus, ShieldTick, Pencil01, Trash04, XClose,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings, CancellationPolicy } from "@/lib/store";

export default function BookingRulesPage() {
    const router          = useRouter();
    const classesSettings = useAppStore(s => s.classesSettings);
    const policies        = useAppStore(s => s.cancellationPolicies);
    const deletePolicy    = useAppStore(s => s.deleteCancellationPolicy);
    const showToast       = useAppStore(s => s.showToast);

    const [pendingDelete, setPendingDelete] = useState<CancellationPolicy | null>(null);

    function handleCustomize()             { router.push("/settings/booking-rules/customize"); }
    function handleAddPolicy()             { router.push("/settings/booking-rules/policies/new"); }
    function handleEditPolicy(id: string)  { router.push(`/settings/booking-rules/policies/${id}/edit`); }

    function confirmDelete() {
        if (!pendingDelete) return;
        const name = pendingDelete.name;
        deletePolicy(pendingDelete.id);
        showToast("Policy deleted", `"${name}" has been removed.`, "success", "trash");
        setPendingDelete(null);
    }

    return (
        <div className="flex flex-col gap-5 w-full">
            <ClassesCard settings={classesSettings} onCustomize={handleCustomize} />

            <PoliciesCard
                policies={policies}
                onAdd={handleAddPolicy}
                onEdit={handleEditPolicy}
                onDelete={p => setPendingDelete(p)}
            />

            {pendingDelete && (
                <DeleteConfirmModal
                    name={pendingDelete.name}
                    description="This policy will be removed from your booking rules. Existing bookings that referenced it keep their record. This can’t be undone."
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}

// ─── Card 1 — Classes summary ───────────────────────────────────────────────

function ClassesCard({ settings, onCustomize }: {
    settings: ClassesSettings;
    onCustomize: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">
                        Classes
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        Booking windows, waitlist, auto-attendance, and guest settings.
                    </p>
                </div>
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<Edit02 className="w-5 h-5" />}
                    onClick={onCustomize}
                >
                    Customize
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
                <SummaryTile
                    label="Bookings open"
                    value={`${settings.booking_open_value} ${settings.booking_open_unit} (before the class starts)`}
                />
                <SummaryTile
                    label="Bookings close"
                    value={`${settings.booking_close_value} ${settings.booking_close_unit} (before the class starts)`}
                />
                <SummaryTile
                    label="Auto-submit attendance"
                    value={`${settings.auto_submit_attendance_value} ${settings.auto_submit_attendance_unit}`}
                />
                <SummaryTileWithBadge
                    label="Waitlist"
                    enabled={settings.waitlist_enabled}
                />
                <SummaryTile
                    label="Max waiting spots"
                    value={`${settings.max_waiting_spots} spots`}
                />
                <div />
            </div>
        </div>
    );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5 truncate">{label}</p>
            <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">
                {value}
            </p>
        </div>
    );
}

function SummaryTileWithBadge({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5 truncate">{label}</p>
            <div className="flex items-start">
                <span
                    className={
                        enabled
                            ? "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
                            : "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]"
                    }
                >
                    {enabled ? "Enabled" : "Disabled"}
                </span>
            </div>
        </div>
    );
}

// ─── Card 2 — Cancellation & no-show policies (Phase 2 wired) ──────────────

function PoliciesCard({ policies, onAdd, onEdit, onDelete }: {
    policies: CancellationPolicy[];
    onAdd: () => void;
    onEdit: (id: string) => void;
    onDelete: (policy: CancellationPolicy) => void;
}) {
    const isEmpty = policies.length === 0;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">
                        Cancellation &amp; no-show policies
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        Manage the rules for cancellations and no-shows.
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-5 h-5" />}
                    onClick={onAdd}
                >
                    Add new
                </Button>
            </div>

            {isEmpty ? (
                <div className="relative flex-1" style={{ minHeight: 160 }}>
                    <EmptyState
                        title="No policy found"
                        subtitle="You haven’t created any policies yet."
                        icon={ShieldTick}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-4 w-full">
                    {policies.map(p => (
                        <PolicyRow
                            key={p.id}
                            policy={p}
                            onEdit={() => onEdit(p.id)}
                            onDelete={() => onDelete(p)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PolicyRow({ policy, onEdit, onDelete }: {
    policy: CancellationPolicy;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-[6px] bg-white border-1 border-[#e4e7ec] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex items-center justify-center shrink-0">
                <ShieldTick className="w-4 h-4 text-[#475467]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#344054] leading-5 truncate">
                    {policy.name}
                </p>
            </div>
            <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${policy.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors text-[#667085]"
            >
                <Pencil01 className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${policy.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#fef3f2] transition-colors text-[#d92d20]"
            >
                <Trash04 className="w-5 h-5" />
            </button>
        </div>
    );
}

// ─── Delete confirm modal (canonical destructive pattern) ───────────────────

/** Generic delete-confirm — `description` is the only thing that changes
 *  between callers (currently only the policy delete flow lives here;
 *  /admin/categories carries its own copy). */
function DeleteConfirmModal({ name, description, onCancel, onConfirm }: {
    name: string;
    description: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[400px] flex flex-col">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        "bg-[#fee4e2]",
                    )}>
                        <Trash04 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">
                            Delete &ldquo;{name}&rdquo;?
                        </p>
                        <p className="text-[14px] text-[#475467] leading-5 w-full">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 items-start p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        size="lg"
                        className="flex-1"
                        onClick={onConfirm}
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
