"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Time off (/instructor/time-off)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-22 revision — audit feedback:
//   • Page title reads "Time off" (was falling through to a generic
//     Dashboard title).
//   • Banner subtitle removed.
//   • Add / edit surface is a SlidePanel (matches every filter/panel
//     across admin, not a modal that steals focus).
//   • List rewritten as a real TABLE with proper column separation.
//   • Reason / Range / Group / Past pills all use the same fit-width
//     pill shape the app uses everywhere (rounded-full, non-uppercase).

import { useMemo, useState } from "react";
import { Plus, Edit02, Trash01, Clock, DotsVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { BlockedTimeFormPage } from "@/components/staff/BlockedTimeFormPage";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { useAppStore, type BlockedTime } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { useRef } from "react";

// ─── Helpers ──────────────────────────────────────────────────────────────

function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const mm = Number.isNaN(m) ? 0 : m;
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mm === 0 ? `${h12} ${period}` : `${h12}.${String(mm).padStart(2, "0")} ${period}`;
}

function fmtDate(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m - 1), d);
    return date.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function spanDays(fromISO: string, toISO: string): number {
    const [fy, fm, fd] = fromISO.split("-").map(Number);
    const [ty, tm, td] = toISO.split("-").map(Number);
    const from = new Date(fy, fm - 1, fd);
    const to   = new Date(ty, tm - 1, td);
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

// Reason is captured on the form but NOT surfaced in the instructor list — the
// table shows only Date & time + Note, matching the admin Time-off table (which
// also has no Reason column). Client 2026-08.

// ─── Row action menu ──────────────────────────────────────────────────────

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <>
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                aria-label="Row actions"
                className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[var(--colors-text-quaternary)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                <DotsVertical className="w-4 h-4" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={160}>
                <div className="py-1.5">
                    <button type="button"
                        onClick={() => { setOpen(false); onEdit(); }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-[14px] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <Edit02 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />Edit
                    </button>
                    <button type="button"
                        onClick={() => { setOpen(false); onDelete(); }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-[14px] text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <Trash01 className="w-4 h-4" />Delete
                    </button>
                </div>
            </FixedDropdown>
        </>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function InstructorTimeOffPage() {
    const currentUser = useAppStore(s => s.currentUser);
    // Persona-aware staff id (follows a persona switch) — matches the earnings
    // and account pages; falls back to the seed persona constant.
    const meStaffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;

    // Adds/edits go through the SHARED admin BlockedTimeFormPage (self-service
    // mode), so this page only needs the read + delete actions now.
    const blockedTimes       = useAppStore(s => s.blockedTimes);
    const deleteBlockedTimes = useAppStore(s => s.deleteBlockedTimes);
    const showToast          = useAppStore(s => s.showToast);

    const [panel, setPanel] = useState<{ open: boolean; mode: "create" | "edit"; row?: BlockedTime }>({ open: false, mode: "create" });
    const [pendingDelete, setPendingDelete] = useState<BlockedTime | null>(null);

    // Scope to me — upcoming first, then past.
    const myEntries = useMemo(() => {
        return blockedTimes
            .filter(b => b.staff_ids.includes(meStaffId))
            .sort((a, b) => {
                const today = todayISO();
                const aFrom = a.date_from_iso ?? a.date;
                const aTo   = a.date_to_iso   ?? a.date;
                const bFrom = b.date_from_iso ?? b.date;
                const bTo   = b.date_to_iso   ?? b.date;
                const aUp = aTo >= today;
                const bUp = bTo >= today;
                if (aUp !== bUp) return aUp ? -1 : 1;
                if (aUp) return aFrom.localeCompare(bFrom);
                return bFrom.localeCompare(aFrom);
            });
    }, [blockedTimes, meStaffId]);

    function handleDelete() {
        if (!pendingDelete) return;
        deleteBlockedTimes([pendingDelete.id]);
        showToast("Time off deleted", "The entry has been removed from your schedule.", "success", "trash");
        setPendingDelete(null);
    }

    // Sortable — same pattern the instructor earnings table uses so both
    // pages read as one voice (client 2026-07-22 audit).
    const { sorted: sortedEntries, sortKey, sortDir, toggle: toggleSort } = useSort<BlockedTime>(myEntries, {
        date:   (a, b) => (a.date_from_iso ?? a.date).localeCompare(b.date_from_iso ?? b.date),
        note:   (a, b) => a.note.localeCompare(b.note),
    });

    return (
        <div className="flex flex-col gap-5 h-full">
            {/* Toolbar — "Total N time off" counter on the left (matches the
                instructor earnings page layout); Add button on the right.
                Page title comes from the layout Header. Client 2026-07-22
                audit. */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-5">Total</p>
                    <p className="text-[16px] font-medium text-[var(--colors-text-primary)]">
                        {myEntries.length} time off
                    </p>
                </div>
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setPanel({ open: true, mode: "create" })}>
                    Add
                </Button>
            </div>

            {/* Table — client 2026-07-22 audit: dropped the outer bordered
                card + rounded corners. Table now sits flush on the layout
                chrome (same as the instructor earnings table). Sortable
                headers via the shared `SortableHeader` primitive. */}
            <div>
                {myEntries.length === 0 ? (
                    <div className="relative min-h-[400px]">
                        <EmptyState
                            title="No time off yet"
                            subtitle="Use Add time off to log annual leave, sick days, or training."
                            icon={Clock}
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[280px]")}>
                                        <SortableHeader sortKey="date"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date &amp; time</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="note"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Note</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {sortedEntries.map(b => {
                                    const fromISO = b.date_from_iso ?? b.date;
                                    const toISO   = b.date_to_iso   ?? b.date;
                                    const days = spanDays(fromISO, toISO);
                                    const isRange = days > 1;
                                    const isPast = toISO < todayISO();
                                    const isShared = b.staff_ids.length > 1;
                                    return (
                                        <tr key={b.id} className={cn("transition-colors hover:bg-[var(--colors-bg-secondary)]", isPast && "opacity-70")}>
                                            <td className={TD}>
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-[14px] font-medium text-[var(--colors-text-primary)] whitespace-nowrap">
                                                            {isRange
                                                                ? `${fmtDate(fromISO)} – ${fmtDate(toISO)}`
                                                                : fmtDate(fromISO)}
                                                        </span>
                                                        {isRange && (
                                                            <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[#fef4e1] border-[#fecc85] text-[#b54708] whitespace-nowrap">
                                                                Range
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[13px] text-[var(--colors-text-quaternary)] whitespace-nowrap">
                                                        {b.all_day
                                                            ? `All day${isRange ? ` · ${days} days` : ""}`
                                                            : `${fmtTime12(b.start_time)} – ${fmtTime12(b.end_time)}`}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className={cn(TD, "text-[var(--colors-text-quaternary)] max-w-[400px] truncate")}>
                                                {b.note.trim() || "—"}
                                                {isShared && (
                                                    <span className="ml-1 text-[var(--colors-fg-quaternary)]">· Managed by admin</span>
                                                )}
                                            </td>
                                            <td className={TD}>
                                                {!isShared && (
                                                    <RowMenu
                                                        onEdit={() => setPanel({ open: true, mode: "edit", row: b })}
                                                        onDelete={() => setPendingDelete(b)}
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Slide panel — REUSES the shared admin BlockedTimeFormPage in
                self-service mode (lockedStaffId), so the instructor form has the
                exact same fields / order / reason list as admin — just without
                the Staff picker — and writes to the same store (client 2026-08-13). */}
            <SlidePanel open={panel.open} onClose={() => setPanel({ open: false, mode: "create" })} width={480}>
                {panel.open && (
                    <BlockedTimeFormPage
                        mode={panel.mode}
                        blockedTimeId={panel.row?.id}
                        lockedStaffId={meStaffId}
                        onClose={() => setPanel({ open: false, mode: "create" })}
                    />
                )}
            </SlidePanel>

            {/* Delete confirm */}
            {pendingDelete && (
                <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center px-4">
                    <div className="bg-white rounded-[16px] w-full max-w-[420px] overflow-hidden flex flex-col shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)]">
                        <div className="px-6 py-5 flex flex-col gap-2">
                            <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">Delete this time off?</p>
                            <p className="text-[14px] text-[var(--colors-text-quaternary)]">
                                This will remove the entry from your schedule and from admin&apos;s view. This can&apos;t be undone.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-[var(--colors-border-secondary)] flex justify-end gap-3">
                            <Button variant="secondary-gray" size="md" onClick={() => setPendingDelete(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="md" onClick={handleDelete}>
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Toast />
        </div>
    );
}
