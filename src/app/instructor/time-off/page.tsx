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

import { useEffect, useMemo, useState } from "react";
import { Plus, XClose, Edit02, Trash01, Clock, DotsVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { SlidePanel } from "@/components/ui/SlidePanel";
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
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    return `${String(hh).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${ampm}`;
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

// ─── Reason chip palette (matches admin BlockedTimeTab) ─────────────────

type Reason = BlockedTime["reason"];

const REASON_STYLE: Record<Reason, { label: string; className: string }> = {
    annual_leave:    { label: "Annual Leave",    className: "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]" },
    sick:            { label: "Sick",            className: "bg-[#fef3f2] border-[#fecdca] text-[#b42318]" },
    personal:        { label: "Personal",        className: "bg-[#f0f9f6] border-[#a6e0cd] text-[#107569]" },
    training:        { label: "Training",        className: "bg-[#f4f3ff] border-[#d9d6fe] text-[#5925dc]" },
    religious_leave: { label: "Religious Leave", className: "bg-[#fffaeb] border-[#fedf89] text-[#b54708]" },
    other:           { label: "Other",           className: "bg-[var(--colors-bg-secondary)] border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]" },
};

function ReasonChip({ reason }: { reason: Reason | undefined }) {
    const spec = REASON_STYLE[(reason ?? "other") as Reason] ?? REASON_STYLE.other;
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 whitespace-nowrap",
            spec.className,
        )}>
            {spec.label}
        </span>
    );
}

const REASON_OPTIONS: { value: Reason; label: string }[] = [
    { value: "annual_leave",    label: "Annual Leave"    },
    { value: "sick",            label: "Sick"            },
    { value: "personal",        label: "Personal"        },
    { value: "training",        label: "Training"        },
    { value: "religious_leave", label: "Religious Leave" },
    { value: "other",           label: "Other"           },
];

// ─── Form panel (SlidePanel) ─────────────────────────────────────────────

interface FormValue {
    title: string;
    dateFrom: string;
    dateTo:   string;
    allDay: boolean;
    startTime: string;
    endTime:   string;
    reason: Reason;
    note: string;
}

const EMPTY_FORM = (): FormValue => ({
    title: "", dateFrom: "", dateTo: "", allDay: false,
    startTime: "09:00", endTime: "10:00", reason: "annual_leave", note: "",
});

/** 15-minute time options (24h). */
const TIME_OPTIONS: { value: string; label: string }[] = (() => {
    const out: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const hh = String(h).padStart(2, "0");
            const mm = String(m).padStart(2, "0");
            const value = `${hh}:${mm}`;
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const period = h < 12 ? "AM" : "PM";
            out.push({ value, label: `${String(h12).padStart(2, "0")}:${mm} ${period}` });
        }
    }
    return out;
})();

function TimeOffPanel({
    open, mode, existing, onClose, onSubmit,
}: {
    open: boolean;
    mode: "create" | "edit";
    existing?: BlockedTime;
    onClose: () => void;
    onSubmit: (v: FormValue) => void;
}) {
    const seedFromExisting = (): FormValue => existing
        ? {
            title:     existing.title,
            dateFrom:  existing.date_from_iso ?? existing.date,
            dateTo:    existing.date_to_iso   ?? existing.date,
            allDay:    existing.all_day       ?? false,
            startTime: existing.start_time,
            endTime:   existing.end_time,
            reason:    existing.reason        ?? "other",
            note:      existing.note,
        }
        : EMPTY_FORM();

    const [form, setForm] = useState<FormValue>(seedFromExisting);
    useEffect(() => {
        if (!open) return;
        setForm(seedFromExisting());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [existing?.id, open, mode]);

    function set(patch: Partial<FormValue>) {
        setForm(prev => ({ ...prev, ...patch }));
    }

    const today = todayISO();
    const isPast = !!form.dateFrom && form.dateFrom < today;
    const isInverted = !!form.dateFrom && !!form.dateTo && form.dateTo < form.dateFrom;
    const missingOtherNote = form.reason === "other" && !form.note.trim();
    const isValid = (() => {
        if (!form.dateFrom || !form.dateTo) return false;
        if (isPast || isInverted) return false;
        if (!form.allDay) {
            if (!form.startTime || !form.endTime) return false;
            if (form.startTime >= form.endTime) return false;
        }
        if (missingOtherNote) return false;
        return true;
    })();

    return (
        <SlidePanel open={open} onClose={onClose} width={440}>
            {/* Header */}
            <div className="shrink-0 px-6 py-4 border-b border-[var(--colors-border-secondary)] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">
                        {mode === "edit" ? "Edit time off" : "Add time off"}
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors text-[var(--colors-text-quaternary)]">
                    <XClose className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-[6px]">
                    <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Reason</label>
                    <SelectInput
                        placeholder="Select a reason"
                        value={form.reason}
                        onChange={v => set({ reason: v as Reason })}
                        options={REASON_OPTIONS}
                        width="w-full"
                    />
                </div>

                <div className="flex flex-col gap-[6px]">
                    <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Title (optional)</label>
                    <input
                        type="text" value={form.title}
                        onChange={e => set({ title: e.target.value })}
                        placeholder="Enter title"
                        className="h-10 w-full px-[14px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">From</label>
                        <DatePicker
                            value={form.dateFrom}
                            onChange={iso => {
                                const nextTo = form.dateTo && form.dateTo < iso ? iso : form.dateTo || iso;
                                set({ dateFrom: iso, dateTo: nextTo });
                            }}
                            placeholder="Select date"
                            minDate={today}
                        />
                        {isPast && (
                            <p className="text-[13px] text-[#b42318]">Date can&apos;t be in the past.</p>
                        )}
                    </div>
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">To</label>
                        <DatePicker
                            value={form.dateTo}
                            onChange={iso => set({ dateTo: iso })}
                            placeholder="Select date"
                            minDate={form.dateFrom || today}
                        />
                        {isInverted && (
                            <p className="text-[13px] text-[#b42318]">End date must be on or after the start date.</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 rounded-[12px] border-1 border-[var(--colors-border-secondary)] bg-white p-3">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={form.allDay}
                        aria-label="All day"
                        onClick={() => set({ allDay: !form.allDay })}
                        className={cn(
                            "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                            form.allDay ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]",
                        )}
                    >
                        <span className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.15)] transition-transform",
                            form.allDay ? "translate-x-5" : "translate-x-0",
                        )} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[var(--colors-text-primary)] leading-5">All day</p>
                        <p className="text-[13px] text-[var(--colors-text-quaternary)] leading-[18px] mt-0.5">Runs full days across the picked range.</p>
                    </div>
                </div>

                {!form.allDay && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-[6px]">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Start time</label>
                            <SelectInput
                                triggerIcon={<Clock className="w-4 h-4" />}
                                placeholder="Select time"
                                value={form.startTime}
                                onChange={v => set({ startTime: v })}
                                options={TIME_OPTIONS}
                                width="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-[6px]">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">End time</label>
                            <SelectInput
                                triggerIcon={<Clock className="w-4 h-4" />}
                                placeholder="Select time"
                                value={form.endTime}
                                onChange={v => set({ endTime: v })}
                                options={TIME_OPTIONS}
                                width="w-full"
                            />
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-[6px]">
                    <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                        {form.reason === "other" ? "Note" : "Note (optional)"}
                    </label>
                    <textarea
                        value={form.note}
                        onChange={e => set({ note: e.target.value })}
                        placeholder={form.reason === "other"
                            ? "Describe the reason..."
                            : "Enter note..."
                        }
                        rows={3}
                        className="w-full px-[14px] py-[10px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y"
                    />
                    {missingOtherNote && (
                        <p className="text-[13px] text-[#b42318]">A note is required when the reason is Other.</p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-[var(--colors-border-secondary)] flex justify-end gap-3">
                <Button variant="secondary-gray" size="md" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" size="md" disabled={!isValid}
                    onClick={() => onSubmit(form)}>
                    {mode === "edit" ? "Save changes" : "Add time off"}
                </Button>
            </div>
        </SlidePanel>
    );
}

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

    const blockedTimes       = useAppStore(s => s.blockedTimes);
    const addBlockedTime     = useAppStore(s => s.addBlockedTime);
    const updateBlockedTime  = useAppStore(s => s.updateBlockedTime);
    const deleteBlockedTimes = useAppStore(s => s.deleteBlockedTimes);
    const showToast          = useAppStore(s => s.showToast);
    const staff              = useAppStore(s => s.staff);

    const myBranchId = useMemo(() => {
        const me = staff.find(s => s.id === meStaffId);
        return me?.branchId ?? "";
    }, [staff, meStaffId]);

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

    function handleSubmit(form: FormValue) {
        const effStart = form.allDay ? "00:00" : form.startTime;
        const effEnd   = form.allDay ? "23:59" : form.endTime;
        const row = {
            title:         form.title.trim(),
            date:          form.dateFrom,
            date_from_iso: form.dateFrom,
            date_to_iso:   form.dateTo,
            all_day:       form.allDay,
            start_time:    effStart,
            end_time:      effEnd,
            reason:        form.reason,
            note:          form.note.trim(),
            staff_ids:     [meStaffId],
            branch_id:     myBranchId,
        };
        if (panel.mode === "edit" && panel.row) {
            updateBlockedTime(panel.row.id, row);
            showToast("Time off updated", "Admin can see your update right away.", "success", "check");
        } else {
            addBlockedTime(row);
            showToast(
                "Time off added",
                "Your time off is logged. Admin can see it right away — no approval needed.",
                "success", "check",
            );
        }
        setPanel({ open: false, mode: "create" });
    }

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
        reason: (a, b) => (a.reason ?? "other").localeCompare(b.reason ?? "other"),
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
                                    <th className={cn(TH, "w-[120px]")}>
                                        <SortableHeader sortKey="reason" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Reason</SortableHeader>
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
                                    const otherCount = b.staff_ids.length - 1;
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
                                            <td className={TD}>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <ReasonChip reason={b.reason} />
                                                    {isPast && (
                                                        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[var(--colors-bg-tertiary)] border-[var(--colors-border-secondary)] text-[var(--colors-text-tertiary)] whitespace-nowrap">
                                                            Past
                                                        </span>
                                                    )}
                                                    {isShared && (
                                                        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[#eff8ff] border-[#b2ddff] text-[#175cd3] whitespace-nowrap">
                                                            Group · {otherCount} other{otherCount === 1 ? "" : "s"}
                                                        </span>
                                                    )}
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

            {/* Slide panel — replaces the earlier centered modal
                (client 2026-07-22 audit: side panel, not modal). */}
            <TimeOffPanel
                open={panel.open}
                mode={panel.mode}
                existing={panel.row}
                onClose={() => setPanel({ open: false, mode: "create" })}
                onSubmit={handleSubmit}
            />

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
