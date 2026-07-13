"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Blocked time create / edit form
// ─────────────────────────────────────────────────────────────────────────────
//
// Single-step form (Figma 7413:257445):
//   • Title (optional) — free text.
//   • Date — date picker; admin CANNOT pick a past date.
//   • Start time / End time — option lists are bounded by:
//       — Per the brief —
//       1. If ALL selected staff share a single shift → option list is
//          the shift's open window.
//       2. Otherwise (no staff yet, no shift, or mixed shifts across the
//          selection) → option list is the BRANCH working hours envelope.
//   • Note — optional, free text.
//   • Staffs — multi-select dropdown of staff at the branch (same chrome
//     as the staff form's Categories field).
//
// Success toast (Figma 7413:257605):
//   "Blocked time added successfully"
//   "The blocked time has been added and staff schedules have been updated."

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Clock, ChevronDown, Check, SearchMd,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type BlockedTime, type Staff } from "@/lib/store";

// ─── 15-minute time options (24h) ─────────────────────────────────────────

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
    const out: { value: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 15) {
            const hh = String(h).padStart(2, "0");
            const mm = String(m).padStart(2, "0");
            const value = `${hh}:${mm}`;
            const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const period = h < 12 ? "AM" : "PM";
            const label = `${String(h12).padStart(2, "0")}:${mm} ${period}`;
            out.push({ value, label });
        }
    }
    return out;
})();

// ─── Multi-staff dropdown — same chrome as Categories ─────────────────────

function MultiStaffDropdown({ options, selectedIds, onChange, placeholder }: {
    options: Staff[];
    selectedIds: string[];
    onChange: (next: string[]) => void;
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!open) return;
        function clickAway(e: MouseEvent) {
            const t = e.target as HTMLElement;
            if (!t.closest("[data-multi-staff-dropdown]")) setOpen(false);
        }
        function escape(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("mousedown", clickAway);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", clickAway);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    function toggle(id: string) {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    }
    function remove(id: string) { onChange(selectedIds.filter(x => x !== id)); }

    const filtered = options.filter(o => {
        if (!search) return true;
        const q = search.toLowerCase();
        return o.fullName.toLowerCase().includes(q) || o.email.toLowerCase().includes(q);
    });

    const selectedOptions = selectedIds
        .map(id => options.find(o => o.id === id))
        .filter((o): o is Staff => !!o);

    return (
        <div data-multi-staff-dropdown className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn(
                    "flex items-center gap-2 w-full min-h-[40px] px-[14px] py-[6px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all",
                    open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#aad4bd]",
                )}>
                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {selectedOptions.length === 0 ? (
                        <span className="text-[14px] text-[#667085]">{placeholder}</span>
                    ) : (
                        selectedOptions.map(o => (
                            <span key={o.id}
                                className="inline-flex items-center gap-1.5 pl-1 pr-1 py-[2px] rounded-full text-[13px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]">
                                {o.imageUrl ? (
                                    <img src={o.imageUrl} alt={o.fullName}
                                        className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: o.color }}>
                                        {o.initials}
                                    </span>
                                )}
                                {o.fullName}
                                <span role="button" tabIndex={0} aria-label={`Remove ${o.fullName}`}
                                    onClick={e => { e.stopPropagation(); remove(o.id); }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); remove(o.id); } }}
                                    className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#475467] hover:bg-[#f2f4f7] transition-colors text-[16px] leading-none cursor-pointer">×</span>
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col max-h-[320px] overflow-hidden">
                    {/* Search input — matches Figma 7413:257445 */}
                    <div className="px-3 pt-3 pb-2 shrink-0 border-b border-[#e4e7ec]">
                        <div className="relative">
                            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                            <input type="text" autoFocus value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search"
                                className="h-9 w-full pl-9 pr-3 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]" />
                        </div>
                    </div>
                    {/* List */}
                    <div className="flex-1 overflow-y-auto py-1.5">
                        {filtered.length === 0 ? (
                            <p className="px-4 py-3 text-[14px] text-[#667085]">No staff found.</p>
                        ) : filtered.map(s => {
                            const selected = selectedIds.includes(s.id);
                            return (
                                <button key={s.id} type="button" onClick={() => toggle(s.id)}
                                    className="flex items-center gap-3 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors text-left">
                                    <span className={cn(
                                        "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                        selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                                    )}>
                                        {selected && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                    {s.imageUrl ? (
                                        <img src={s.imageUrl} alt={s.fullName}
                                            className="w-7 h-7 rounded-full object-cover shrink-0" />
                                    ) : (
                                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold text-white shrink-0"
                                            style={{ backgroundColor: s.color }}>
                                            {s.initials}
                                        </span>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[14px] font-medium text-[#101828] truncate">{s.fullName}</span>
                                        <span className="text-[12px] text-[#667085] truncate">{s.email}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Form value ───────────────────────────────────────────────────────────

interface FormValue {
    title: string;
    date: string;          // ISO "YYYY-MM-DD"
    startTime: string;
    endTime: string;
    note: string;
    staffIds: string[];
}

function todayISO(): string {
    // Local-time date for the min-date attribute. Server-render mismatch is
    // fine here — the input is client-only.
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const EMPTY_FORM = (): FormValue => ({
    title: "", date: "", startTime: "", endTime: "", note: "", staffIds: [],
});

// ─── Page ────────────────────────────────────────────────────────────────

export interface BlockedTimeFormPageProps {
    mode: "create" | "edit";
    blockedTimeId?: string;
    returnTo?: string;
}

export function BlockedTimeFormPage({ mode, blockedTimeId, returnTo = "/admin/staff" }: BlockedTimeFormPageProps) {
    const router = useRouter();

    const blockedTimes      = useAppStore(s => s.blockedTimes);
    const staff             = useAppStore(s => s.staff);
    const shifts            = useAppStore(s => s.shifts);
    const businessHours     = useAppStore(s => s.businessHours);
    const addBlockedTime    = useAppStore(s => s.addBlockedTime);
    const updateBlockedTime = useAppStore(s => s.updateBlockedTime);
    const showToast         = useAppStore(s => s.showToast);

    const existing = mode === "edit" && blockedTimeId
        ? blockedTimes.find(b => b.id === blockedTimeId)
        : undefined;

    const [form, setForm] = useState<FormValue>(() => existing
        ? {
            title:     existing.title,
            date:      existing.date,
            startTime: existing.start_time,
            endTime:   existing.end_time,
            note:      existing.note,
            staffIds:  [...existing.staff_ids],
        }
        : EMPTY_FORM());

    useEffect(() => {
        if (mode !== "edit" || !existing) return;
        setForm({
            title:     existing.title,
            date:      existing.date,
            startTime: existing.start_time,
            endTime:   existing.end_time,
            note:      existing.note,
            staffIds:  [...existing.staff_ids],
        });
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }

    // ── Derive the branch from the selected staff (first one wins) ────────
    const selectedStaff = useMemo(
        () => form.staffIds.map(id => staff.find(s => s.id === id)).filter((s): s is Staff => !!s),
        [form.staffIds, staff],
    );
    const branchId = selectedStaff[0]?.branchId ?? null;

    // Available staff list — all active staff. Once a branch is implied by
    // the first selection, narrow to the same branch (an entry maps to ONE
    // branch).
    const availableStaff = useMemo(() => {
        const active = staff.filter(s => s.status === "active");
        if (!branchId) return active;
        return active.filter(s => s.branchId === branchId);
    }, [staff, branchId]);

    // ── Time-window envelope ──────────────────────────────────────────────
    //
    // 1) All selected staff share a single shift → use that shift's
    //    [start, end] as the option window.
    // 2) Otherwise → use the branch's working-hours envelope (widest open
    //    range across all open weekdays).
    // 3) Fallback (no staff yet) → 00:00 – 24:00.

    const timeWindow = useMemo<{ open: string; close: string; source: "shift" | "branch" | "none" }>(() => {
        if (selectedStaff.length > 0) {
            const sharedShiftId = selectedStaff.every(s => s.shiftId && s.shiftId === selectedStaff[0].shiftId)
                ? selectedStaff[0].shiftId
                : null;
            if (sharedShiftId) {
                const shift = shifts.find(x => x.id === sharedShiftId);
                if (shift) return { open: shift.start_time, close: shift.end_time, source: "shift" };
            }
            if (branchId) {
                const rows = businessHours.filter(h => h.branch_id === branchId && !h.is_closed);
                if (rows.length > 0) {
                    let open = rows[0].open_time, close = rows[0].close_time;
                    for (const r of rows) {
                        if (r.open_time  < open)  open  = r.open_time;
                        if (r.close_time > close) close = r.close_time;
                    }
                    return { open, close, source: "branch" };
                }
            }
        }
        return { open: "00:00", close: "24:00", source: "none" };
    }, [selectedStaff, shifts, branchId, businessHours]);

    const startOptions = useMemo(
        () => TIME_OPTIONS.filter(o => o.value >= timeWindow.open && o.value < timeWindow.close),
        [timeWindow],
    );
    const endOptions = useMemo(
        () => TIME_OPTIONS.filter(o => o.value > form.startTime && o.value <= timeWindow.close),
        [timeWindow, form.startTime],
    );

    // Snap stale picks back into the window whenever it shifts.
    useEffect(() => {
        if (timeWindow.source === "none") return;
        if (form.startTime && (form.startTime < timeWindow.open || form.startTime >= timeWindow.close)) {
            setForm(p => ({ ...p, startTime: timeWindow.open, endTime: "" }));
        } else if (form.endTime && (form.endTime > timeWindow.close || form.endTime <= form.startTime)) {
            setForm(p => ({ ...p, endTime: "" }));
        }
    }, [timeWindow]); // eslint-disable-line react-hooks/exhaustive-deps

    // Default start/end on entering once a window is known + nothing is picked.
    useEffect(() => {
        if (timeWindow.source === "none") return;
        if (!form.startTime) setForm(p => ({ ...p, startTime: timeWindow.open }));
    }, [timeWindow]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Validation ───────────────────────────────────────────────────────
    const todayDate = todayISO();
    const isPastDate = !!form.date && form.date < todayDate;

    const isValid = (() => {
        if (!form.date) return false;
        if (isPastDate) return false;
        if (!form.startTime || !form.endTime) return false;
        if (form.startTime >= form.endTime) return false;
        if (form.staffIds.length === 0) return false;
        return true;
    })();

    function handleSubmit() {
        if (!isValid) return;
        const finalBranchId = branchId!;
        if (mode === "edit" && existing) {
            updateBlockedTime(existing.id, {
                title:      form.title.trim(),
                date:       form.date,
                start_time: form.startTime,
                end_time:   form.endTime,
                note:       form.note.trim(),
                staff_ids:  form.staffIds,
                branch_id:  finalBranchId,
            });
            showToast(
                "Blocked time updated",
                "Staff schedules have been updated.",
                "success", "check",
            );
        } else {
            addBlockedTime({
                title:      form.title.trim(),
                date:       form.date,
                start_time: form.startTime,
                end_time:   form.endTime,
                note:       form.note.trim(),
                staff_ids:  form.staffIds,
                branch_id:  finalBranchId,
            });
            // Figma 7413:257605 — success copy verbatim.
            showToast(
                "Blocked time added successfully",
                "The blocked time has been added and staff schedules have been updated.",
                "success", "check",
            );
        }
        router.push(returnTo);
    }

    if (mode === "edit" && !existing) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center gap-3">
                <p className="font-semibold text-[18px] text-[#101828]">Blocked time not found</p>
                <p className="text-[14px] text-[#667085]">The entry you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={() => router.push(returnTo)}>
                    Back to list
                </Button>
            </div>
        );
    }

    const pageTitle = mode === "edit" ? "Edit blocked time" : "Add blocked time";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{pageTitle}</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 py-6 h-full items-start">
                    {/* Left rail */}
                    <div className="w-[260px] shrink-0 pt-2">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[#f5fffa]">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]">
                                1
                            </div>
                            <span className="text-[14px] font-semibold text-[#3b5446]">Blocked time details</span>
                        </div>
                    </div>

                    {/* Form card */}
                    <div className="flex-1 max-w-[628px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden self-stretch shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                            <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Blocked time details</h2>

                            <div className="grid grid-cols-2 gap-4">
                                {/* Title (optional) */}
                                <div className="flex flex-col gap-[6px]">
                                    <label className="text-[14px] font-medium text-[#344054]">Title (optional)</label>
                                    <input
                                        type="text" value={form.title}
                                        onChange={e => set({ title: e.target.value })}
                                        placeholder="Enter title"
                                        className="h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                                    />
                                </div>

                                {/* Date — uses the canonical DatePicker so the
                                    blocked-time form has the same calendar
                                    chrome as every other date input across
                                    the app (native browser pickers vary by
                                    OS/locale and don't match the design). */}
                                <div className="flex flex-col gap-[6px]">
                                    <label className="text-[14px] font-medium text-[#344054]">Date</label>
                                    <DatePicker
                                        value={form.date}
                                        onChange={iso => set({ date: iso })}
                                        placeholder="Select date"
                                        minDate={todayDate}
                                    />
                                    {isPastDate && (
                                        <p className="text-[13px] text-[#b42318]">Date can't be in the past.</p>
                                    )}
                                </div>
                            </div>

                            {/* Start / End time */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-[6px]">
                                    <label className="text-[14px] font-medium text-[#344054]">Start time</label>
                                    <SelectInput
                                        triggerIcon={<Clock className="w-4 h-4" />}
                                        placeholder="Select time"
                                        value={form.startTime}
                                        onChange={v => set({ startTime: v })}
                                        options={startOptions}
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
                                        options={endOptions}
                                        width="w-full"
                                    />
                                </div>
                            </div>
                            {/* Window hint */}
                            <p className="-mt-3 text-[13px] text-[#667085]">
                                {timeWindow.source === "shift"
                                    ? "Limited to the staff's shift hours."
                                    : timeWindow.source === "branch"
                                        ? "Limited to the branch's working hours."
                                        : "Pick at least one staff member to set the time range."}
                            </p>

                            {/* Note */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Note</label>
                                <textarea
                                    value={form.note}
                                    onChange={e => set({ note: e.target.value })}
                                    placeholder="Enter note..."
                                    rows={3}
                                    className="w-full px-[14px] py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y"
                                />
                            </div>

                            {/* Staffs */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Staffs</label>
                                <MultiStaffDropdown
                                    options={availableStaff}
                                    selectedIds={form.staffIds}
                                    onChange={ids => set({ staffIds: ids })}
                                    placeholder="Search and select staff members"
                                />
                                <p className="text-[13px] text-[#667085]">Search and select staff members</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                            <Button variant="primary" size="md" disabled={!isValid} onClick={handleSubmit}>
                                {mode === "create" ? "Add blocked time" : "Save changes"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
