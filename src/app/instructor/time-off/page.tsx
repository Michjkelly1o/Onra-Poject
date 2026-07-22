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
    sick:     { label: "Sick",     className: "bg-[#fef3f2] border-[#fecdca] text-[#b42318]" },
    vacation: { label: "Vacation", className: "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]" },
    training: { label: "Training", className: "bg-[#f4f3ff] border-[#d9d6fe] text-[#5925dc]" },
    other:    { label: "Other",    className: "bg-[#f9fafb] border-[#e4e7ec] text-[#344054]" },
};

function ReasonChip({ reason }: { reason: Reason | undefined }) {
    const spec = REASON_STYLE[reason ?? "other"];
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
    { value: "sick",     label: "Sick"     },
    { value: "vacation", label: "Vacation" },
    { value: "training", label: "Training" },
    { value: "other",    label: "Other"    },
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
    startTime: "09:00", endTime: "10:00", reason: "vacation", note: "",
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
            <div className="shrink-0 px-6 py-4 border-b border-[#e4e7ec] flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[18px] font-semibold text-[#101828]">
                        {mode === "edit" ? "Edit time off" : "Add time off"}
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors text-[#667085]">
                    <XClose className="w-5 h-5" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-[6px]">
                    <label className="text-[14px] font-medium text-[#344054]">Reason</label>
                    <SelectInput
                        placeholder="Select a reason"
                        value={form.reason}
                        onChange={v => set({ reason: v as Reason })}
                        options={REASON_OPTIONS}
                        width="w-full"
                    />
                </div>

                <div className="flex flex-col gap-[6px]">
                    <label className="text-[14px] font-medium text-[#344054]">Title (optional)</label>
                    <input
                        type="text" value={form.title}
                        onChange={e => set({ title: e.target.value })}
                        placeholder="Enter title"
                        className="h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-[6px]">
                        <label className="text-[14px] font-medium text-[#344054]">From</label>
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
                        <label className="text-[14px] font-medium text-[#344054]">To</label>
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

                <div className="flex items-center gap-3 rounded-[12px] border-1 border-[#e4e7ec] bg-white p-3">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={form.allDay}
                        aria-label="All day"
                        onClick={() => set({ allDay: !form.allDay })}
                        className={cn(
                            "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                            form.allDay ? "bg-[#658774]" : "bg-[#f2f4f7]",
                        )}
                    >
                        <span className={cn(
                            "w-5 h-5 rounded-full bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.15)] transition-transform",
                            form.allDay ? "translate-x-5" : "translate-x-0",
                        )} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-semibold text-[#101828] leading-5">All day</p>
                        <p className="text-[13px] text-[#667085] leading-[18px] mt-0.5">Runs full days across the picked range.</p>
                    </div>
                </div>

                {!form.allDay && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="flex flex-col gap-[6px]">
                            <label className="text-[14px] font-medium text-[#344054]">Start time</label>
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
                            <label className="text-[14px] font-medium text-[#344054]">End time</label>
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
                    <label className="text-[14px] font-medium text-[#344054]">
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
                        className="w-full px-[14px] py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y"
                    />
                    {missingOtherNote && (
                        <p className="text-[13px] text-[#b42318]">A note is required when the reason is Other.</p>
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 border-t border-[#e4e7ec] flex justify-end gap-3">
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
                className="w-8 h-8 flex items-center justify-center rounded-[6px] text-[#667085] hover:bg-[#f9fafb] transition-colors">
                <DotsVertical className="w-4 h-4" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={160}>
                <div className="py-1.5">
                    <button type="button"
                        onClick={() => { setOpen(false); onEdit(); }}
                        className="w-full px-4 py-2.5 flex items-center gap-2 text-[14px] text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit
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
    const meStaffId = instructor_profile.staff_profile_id;

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

    return (
        <div className="flex flex-col gap-5 h-full">
            {/* Toolbar — page title comes from the layout Header, not
                repeated here (client 2026-07-22 audit fix). Right-side
                Add button opens the SlidePanel. */}
            <div className="flex items-center justify-end gap-3">
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => setPanel({ open: true, mode: "create" })}>
                    Add time off
                </Button>
            </div>

            {/* Table card — matches admin table chrome (border + rounded).
                Client 2026-07-22 audit: was a stacked list of soft cards;
                a real table is easier to scan and matches the admin. */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
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
                                    <th className={cn(TH, "w-[280px]")}>Date &amp; time</th>
                                    <th className={cn(TH, "w-[120px]")}>Reason</th>
                                    <th className={TH}>Note</th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {myEntries.map(b => {
                                    const fromISO = b.date_from_iso ?? b.date;
                                    const toISO   = b.date_to_iso   ?? b.date;
                                    const days = spanDays(fromISO, toISO);
                                    const isRange = days > 1;
                                    const isPast = toISO < todayISO();
                                    const isShared = b.staff_ids.length > 1;
                                    const otherCount = b.staff_ids.length - 1;
                                    return (
                                        <tr key={b.id} className={cn("transition-colors hover:bg-[#f9fafb]", isPast && "opacity-70")}>
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
                                                        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium border-1 bg-[#f2f4f7] border-[#e4e7ec] text-[#475467] whitespace-nowrap">
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
                                            <td className={cn(TD, "text-[#667085] max-w-[400px] truncate")}>
                                                {b.note.trim() || "—"}
                                                {isShared && (
                                                    <span className="ml-1 text-[#98a2b3]">· Managed by admin</span>
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
                            <p className="text-[18px] font-semibold text-[#101828]">Delete this time off?</p>
                            <p className="text-[14px] text-[#667085]">
                                This will remove the entry from your schedule and from admin&apos;s view. This can&apos;t be undone.
                            </p>
                        </div>
                        <div className="px-6 py-4 border-t border-[#e4e7ec] flex justify-end gap-3">
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
