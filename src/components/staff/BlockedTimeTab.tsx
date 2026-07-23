"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Blocked time tab (Staff & shift module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the Blocked time table (Figma 7413:239407).
//
// Columns:
//   • Date & time — "Sat, 27 Feb 2025" line + small "01:00 – 02:00 PM" line.
//   • Title       — falls back to "Blocked" when empty.
//   • Staff       — overlapping avatars + count (e.g. "2 staffs").
//   • Note        — single-line truncated, "—" when blank.
//   • Actions     — Edit time off · Delete time off.
//
// Toolbar inputs (Select location + Search) come from the parent
// StaffPermissionsPage, identical to how the Shift management tab is wired.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    DotsVertical, XClose, Check, ChevronDown,
    Edit02, Trash01, Trash02, Calendar, AlarmClockOff,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore, type BlockedTime, type Staff } from "@/lib/store";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { Pagination } from "@/components/ui/Pagination";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { TimeOffMonthView } from "@/components/staff/TimeOffMonthView";

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtTime12(t: string): string {
    const [h, m] = t.split(":").map(Number);
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${String(hh).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
}

function fmtDate(iso: string): string {
    // ISO "YYYY-MM-DD" → "Sat, 27 Feb 2025"
    const [y, m, d] = iso.split("-").map(Number);
    const date = new Date(y, (m - 1), d);
    return date.toLocaleDateString(undefined, { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

/** Whole-day span between two ISO dates (inclusive). Single-day = 1. */
function spanDays(fromISO: string, toISO: string): number {
    const [fy, fm, fd] = fromISO.split("-").map(Number);
    const [ty, tm, td] = toISO.split("-").map(Number);
    const from = new Date(fy, fm - 1, fd);
    const to   = new Date(ty, tm - 1, td);
    return Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
}

/** "YYYY-MM-DD" for local today — matches the form's `todayISO`. */
function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Reason-chip palette + label. Matches the form's REASON_OPTIONS.
 *  Palette pulls the same tag colours used across the app (sage green,
 *  blue, purple, amber) so the tone reads consistent with sibling
 *  chrome (StatusBadge / SessionTypeTag). */
const REASON_STYLE: Record<
    "sick" | "vacation" | "training" | "other",
    { label: string; className: string }
> = {
    sick:     { label: "Sick",     className: "bg-[#fef3f2] border-[#fecdca] text-[#b42318]" },
    vacation: { label: "Vacation", className: "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]" },
    training: { label: "Training", className: "bg-[#f4f3ff] border-[#d9d6fe] text-[#5925dc]" },
    other:    { label: "Other",    className: "bg-[#f9fafb] border-[#e4e7ec] text-[#344054]" },
};

function ReasonChip({ reason }: { reason: BlockedTime["reason"] | undefined }) {
    const spec = REASON_STYLE[reason ?? "other"];
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium border-1 whitespace-nowrap",
            spec.className,
        )}>
            {spec.label}
        </span>
    );
}

// Stacked avatars — leftmost on top, capped at MAX_VISIBLE; rest summarised.
const MAX_VISIBLE = 3;
function StackedAvatars({ staffList }: { staffList: Staff[] }) {
    const visible = staffList.slice(0, MAX_VISIBLE);
    return (
        <div className="flex items-center">
            <div className="flex -space-x-2">
                {visible.map(s => (
                    s.imageUrl ? (
                        <img key={s.id} src={s.imageUrl} alt={s.fullName}
                            className="w-7 h-7 rounded-full object-cover border-2 border-white" />
                    ) : (
                        <div key={s.id}
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-white"
                            style={{ backgroundColor: s.color }}>
                            {s.initials}
                        </div>
                    )
                ))}
            </div>
            <span className="ml-2 text-[14px] text-[#344054] whitespace-nowrap">
                {staffList.length} {staffList.length === 1 ? "staff" : "staff"}
            </span>
        </div>
    );
}

// ─── Row action menu ──────────────────────────────────────────────────────

function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={200}>
                <button type="button" onClick={() => { setOpen(false); onEdit(); }}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Edit02 className="w-4 h-4 text-[#667085]" />Edit time off
                </button>
                <button type="button" onClick={() => { setOpen(false); onDelete(); }}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                    <Trash01 className="w-4 h-4 text-[#b42318]" />Delete time off
                </button>
            </FixedDropdown>
        </div>
    );
}

// ─── Confirmation modal — Delete only ─────────────────────────────────────

function DeleteModal({ count, subject, onCancel, onConfirm }: {
    count: number; subject: React.ReactNode; onCancel: () => void; onConfirm: () => void;
}) {
    const title = count === 1 ? "Delete this time off?" : `Delete ${count} time off entries?`;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[#fee4e2]">
                        <Trash02 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {subject} will be permanently removed and the staff schedule will revert to normal. This cannot be undone.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>Delete</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Checkbox cell ────────────────────────────────────────────────────────

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Main component ──────────────────────────────────────────────────────


export interface BlockedTimeTabProps {
    branchId: string;
    search: string;
    /** View mode driven by the parent's List / Month SegmentedTabs on
     *  the sub-tab row (client 2026-07-22 lifted from inline). */
    viewMode?: "list" | "month";
    /** Month cursor owned by the parent (client 2026-07-22). */
    monthCursor?: { year: number; month: number };
}

export function BlockedTimeTab({ branchId, search, viewMode = "list", monthCursor }: BlockedTimeTabProps) {
    const router = useRouter();
    const blockedTimes      = useAppStore(s => s.blockedTimes);
    const staff             = useAppStore(s => s.staff);
    const deleteBlockedTimes = useAppStore(s => s.deleteBlockedTimes);
    const showToast         = useAppStore(s => s.showToast);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingDelete, setPendingDelete] = useState<
        | { mode: "row"; row: BlockedTime }
        | { mode: "bulk"; rows: BlockedTime[] }
        | null
    >(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [branchId, search]);

    const staffById = useMemo(() => new Map(staff.map(s => [s.id, s] as const)), [staff]);

    // Sort entries by date descending (most-recent first), then by start time.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return blockedTimes
            .filter(b => {
                if (branchId && b.branch_id !== branchId) return false;
                if (!q) return true;
                if ((b.title || "Blocked").toLowerCase().includes(q)) return true;
                if (b.note.toLowerCase().includes(q)) return true;
                if (b.staff_ids.some(id => staffById.get(id)?.fullName.toLowerCase().includes(q))) return true;
                return false;
            })
            .sort((a, b) => {
                // Client 2026-07-22: upcoming shown first, past collapses
                // below. "Upcoming" = the range's END is today or later.
                // Within each group we sort chronologically ASC for
                // upcoming (nearest first), DESC for past (most recent
                // past first).
                const today = todayISO();
                const aFrom = a.date_from_iso ?? a.date;
                const aTo   = a.date_to_iso   ?? a.date;
                const bFrom = b.date_from_iso ?? b.date;
                const bTo   = b.date_to_iso   ?? b.date;
                const aUpcoming = aTo >= today;
                const bUpcoming = bTo >= today;
                if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
                if (aUpcoming) return aFrom.localeCompare(bFrom);
                return bFrom.localeCompare(aFrom);
            });
    }, [blockedTimes, branchId, search, staffById]);

    // ── Time off sort — Date & time / Reason / Staff count / Note. ─────
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<BlockedTime>(filtered, {
        date:   (a, b) => `${a.date_from_iso ?? a.date} ${a.start_time}`.localeCompare(`${b.date_from_iso ?? b.date} ${b.start_time}`),
        reason: (a, b) => (REASON_STYLE[a.reason ?? "other"].label).localeCompare(REASON_STYLE[b.reason ?? "other"].label),
        staff:  (a, b) => a.staff_ids.length - b.staff_ids.length,
        note:   (a, b) => a.note.localeCompare(b.note),
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const pageRows = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);
    const pageIds = pageRows.map(r => r.id);
    const allChecked  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someChecked = !allChecked && pageIds.some(id => selectedIds.has(id));

    function toggleAll(next: boolean) {
        setSelectedIds(prev => {
            const out = new Set(prev);
            if (next) pageIds.forEach(id => out.add(id));
            else      pageIds.forEach(id => out.delete(id));
            return out;
        });
    }
    function toggleOne(id: string) {
        setSelectedIds(prev => {
            const out = new Set(prev);
            if (out.has(id)) out.delete(id); else out.add(id);
            return out;
        });
    }
    function clearSelection() { setSelectedIds(new Set()); }

    function performDelete() {
        if (!pendingDelete) return;
        const ids = pendingDelete.mode === "row"
            ? [pendingDelete.row.id]
            : pendingDelete.rows.map(r => r.id);
        deleteBlockedTimes(ids);
        showToast(
            ids.length === 1 ? "Time off deleted" : `${ids.length} time off entries deleted`,
            "Staff schedules have been updated.",
            "success", "trash",
        );
        clearSelection();
        setPendingDelete(null);
    }

    const isTrulyEmpty = blockedTimes.length === 0
        || (branchId && blockedTimes.filter(b => b.branch_id === branchId).length === 0);
    const selectedRows = useMemo(
        () => filtered.filter(r => selectedIds.has(r.id)),
        [filtered, selectedIds],
    );

    return (
        <>
            {viewMode === "month" ? (
                <TimeOffMonthView branchId={branchId ?? ""} search={search} monthCursor={monthCursor} />
            ) : (
            <div className="flex flex-col">
                {filtered.length === 0 ? (
                    <div className="relative" style={{ minHeight: 400 }}>
                        <EmptyState
                            title={isTrulyEmpty ? "No time off yet" : "No time off found"}
                            subtitle={isTrulyEmpty
                                ? "Use Add new to block time for one or more staff members."
                                : "Try adjusting your search."}
                            icon={isTrulyEmpty ? AlarmClockOff : Calendar}
                        />
                    </div>
                ) : (
                    <div className="px-6">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAll}
                                                ariaLabel="Select all time off entries"
                                            />
                                        </th>
                                        <th className={cn(TH, "w-[240px]")}>
                                            <SortableHeader sortKey="date"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date &amp; time</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="reason" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Reason</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[200px]")}>
                                            <SortableHeader sortKey="staff"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Staff</SortableHeader>
                                        </th>
                                        <th className={TH}>
                                            <SortableHeader sortKey="note"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Note / Impact</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map(b => {
                                        const isSelected = selectedIds.has(b.id);
                                        const staffList = b.staff_ids
                                            .map(id => staffById.get(id))
                                            .filter((s): s is Staff => Boolean(s));
                                        const title = b.title.trim() || REASON_STYLE[b.reason ?? "other"].label;
                                        const note = b.note.trim() || "–";
                                        // Client 2026-07-22: date cell now
                                        // renders a RANGE for multi-day
                                        // entries and shows either the
                                        // "All day · N days" descriptor or
                                        // the time bounds beneath.
                                        const fromISO = b.date_from_iso ?? b.date;
                                        const toISO   = b.date_to_iso   ?? b.date;
                                        const days = spanDays(fromISO, toISO);
                                        const isRange = days > 1;
                                        const isAllDay = b.all_day ?? false;
                                        return (
                                            <tr key={b.id}
                                                className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD}>
                                                    <CheckboxCell checked={isSelected} onChange={() => toggleOne(b.id)}
                                                        ariaLabel={`Select ${title}`} />
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-[14px] font-medium text-[#101828] whitespace-nowrap">
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
                                                        <span className="text-[13px] text-[#667085] whitespace-nowrap">
                                                            {isAllDay
                                                                ? `All day${isRange ? ` · ${days} days` : ""}`
                                                                : `${fmtTime12(b.start_time)} – ${fmtTime12(b.end_time)}`}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <ReasonChip reason={b.reason} />
                                                </td>
                                                <td className={TD}>
                                                    {staffList.length === 0
                                                        ? <span className="text-[#667085]">—</span>
                                                        : <StackedAvatars staffList={staffList} />}
                                                </td>
                                                <td className={cn(TD, "text-[#667085] max-w-[400px] truncate")}>
                                                    {note}
                                                </td>
                                                <td className={TD}>
                                                    <RowMenu
                                                        onEdit={() => router.push(`/staff/blocked-time/${b.id}/edit?returnTo=${encodeURIComponent("/admin/staff?subtab=blocked-time")}`)}
                                                        onDelete={() => setPendingDelete({ mode: "row", row: b })}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination
                            page={clamped}
                            total={sortedRows.length}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={n => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                )}

                {/* Bulk delete action bar */}
                {selectedRows.length > 0 && (
                    <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                        <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                            <button type="button" onClick={clearSelection}
                                className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                                {selectedRows.length} selected
                                <XClose className="w-5 h-5 text-[#667085]" />
                            </button>
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => setPendingDelete({ mode: "bulk", rows: selectedRows })}>
                                Delete
                            </Button>
                        </div>
                    </div>
                )}
            </div>
            )}

            {pendingDelete && (
                <DeleteModal
                    count={pendingDelete.mode === "row" ? 1 : pendingDelete.rows.length}
                    subject={pendingDelete.mode === "row"
                        ? <span className="font-medium text-[#344054]">"{pendingDelete.row.title.trim() || "Blocked"}"</span>
                        : <>{pendingDelete.rows.length} selected entries</>}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={performDelete}
                />
            )}
        </>
    );
}
