"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shift create / edit form (Shift management module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single-step form (Figma 7412:557790) — Shift name + Branch location +
// Shift hour (start + end) + Shift days (Mon..Sun pill row).
//
// Submit creates via `addShift` (mode="create") or patches via
// `updateShift` (mode="edit"). On success the user lands back on the
// Staff & shift route → Shift management sub-tab via `returnTo`.
//
// Validation gates submit when:
//   • Name is blank
//   • Branch is unselected
//   • Start ≥ End (end must be strictly after start)
//   • No days picked

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Clock, MarkerPin01, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore } from "@/lib/store";

// ─── Time picker option list (15-min steps, 12-hour display) ────────────────

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

// Day labels — display Mon..Sun (Figma order) but persist as the
// [Sun..Sat] boolean array the rest of the codebase expects.
const DAY_PILLS: { label: string; index: number }[] = [
    { label: "Mon", index: 1 },
    { label: "Tue", index: 2 },
    { label: "Wed", index: 3 },
    { label: "Thu", index: 4 },
    { label: "Fri", index: 5 },
    { label: "Sat", index: 6 },
    { label: "Sun", index: 0 },
];

// ─── Form value ─────────────────────────────────────────────────────────────

interface FormValue {
    name: string;
    branchId: string;
    startTime: string;
    endTime: string;
    workingDays: boolean[]; // length 7, [Sun..Sat]
}

const EMPTY_FORM: FormValue = {
    name: "",
    branchId: "",
    startTime: "07:00",
    endTime: "12:00",
    workingDays: [false, false, false, false, false, false, false],
};

// ─── Page ───────────────────────────────────────────────────────────────────

export interface ShiftFormPageProps {
    mode: "create" | "edit";
    shiftId?: string;
    returnTo?: string;
}

export function ShiftFormPage({ mode, shiftId, returnTo = "/admin/staff" }: ShiftFormPageProps) {
    const router = useRouter();

    const shifts        = useAppStore(s => s.shifts);
    const branches      = useAppStore(s => s.branches);
    const businessHours = useAppStore(s => s.businessHours);
    const addShift      = useAppStore(s => s.addShift);
    const updateShift   = useAppStore(s => s.updateShift);
    const showToast     = useAppStore(s => s.showToast);

    const existing = mode === "edit" && shiftId
        ? shifts.find(s => s.id === shiftId)
        : undefined;

    const [form, setForm] = useState<FormValue>(() => existing
        ? {
            name:        existing.name,
            branchId:    existing.branch_id,
            startTime:   existing.start_time,
            endTime:     existing.end_time,
            workingDays: [...existing.working_days],
        }
        : EMPTY_FORM);

    // Sync when the edit target lands asynchronously (rare — e.g. resume
    // from persist into a brand-new tab).
    useEffect(() => {
        if (mode !== "edit" || !existing) return;
        setForm({
            name:        existing.name,
            branchId:    existing.branch_id,
            startTime:   existing.start_time,
            endTime:     existing.end_time,
            workingDays: [...existing.working_days],
        });
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }
    function toggleDay(i: number) {
        const next = [...form.workingDays];
        next[i] = !next[i];
        set({ workingDays: next });
    }

    // Active branches only — the dropdown mirrors the customer + service
    // forms' "Select location" pattern.
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // ── Branch hours window ────────────────────────────────────────────────
    //
    // Shift hours must sit inside the branch's open window. We take the
    // WIDEST envelope across the days the branch is open (not strictly
    // per-day — a shift is a single time window; if Mon is 7-22 but Sun
    // is 8-20, the picker offers 7-22 and the admin can manually cover
    // both). When the branch hasn't been picked yet OR every day is
    // closed, fall back to the full 00:00-24:00 range so the picker
    // doesn't lock the user out.
    const branchHoursWindow = useMemo(() => {
        if (!form.branchId) return { open: "00:00", close: "24:00" };
        const branchRows = businessHours.filter(h => h.branch_id === form.branchId && !h.is_closed);
        if (branchRows.length === 0) return { open: "00:00", close: "24:00" };
        let open = branchRows[0].open_time;
        let close = branchRows[0].close_time;
        for (const r of branchRows) {
            if (r.open_time  < open)  open  = r.open_time;
            if (r.close_time > close) close = r.close_time;
        }
        return { open, close };
    }, [form.branchId, businessHours]);

    // Filter the global TIME_OPTIONS to the branch's window. Start ≥ open,
    // End ≤ close, End > Start.
    const startOptions = useMemo(
        () => TIME_OPTIONS.filter(o => o.value >= branchHoursWindow.open && o.value < branchHoursWindow.close),
        [branchHoursWindow],
    );
    const endOptions = useMemo(
        () => TIME_OPTIONS.filter(o => o.value > form.startTime && o.value <= branchHoursWindow.close),
        [branchHoursWindow, form.startTime],
    );

    // Snap stale picks to the new window whenever the branch changes — keeps
    // the picker honest without surprising the admin.
    useEffect(() => {
        if (!form.branchId) return;
        if (form.startTime < branchHoursWindow.open || form.startTime >= branchHoursWindow.close) {
            setForm(p => ({ ...p, startTime: branchHoursWindow.open }));
        }
        if (form.endTime > branchHoursWindow.close) {
            setForm(p => ({ ...p, endTime: branchHoursWindow.close }));
        }
    }, [branchHoursWindow]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Validation ─────────────────────────────────────────────────────────
    const isValid = (() => {
        if (!form.name.trim()) return false;
        if (!form.branchId)   return false;
        if (form.startTime >= form.endTime) return false;
        if (!form.workingDays.some(Boolean)) return false;
        return true;
    })();

    function handleSubmit() {
        if (!isValid) return;
        if (mode === "edit" && existing) {
            updateShift(existing.id, {
                name:         form.name.trim(),
                branch_id:    form.branchId,
                start_time:   form.startTime,
                end_time:     form.endTime,
                working_days: form.workingDays,
            });
            showToast(
                "Shift updated successfully",
                `${form.name.trim()} has been saved.`,
                "success", "check",
            );
        } else {
            addShift({
                name:         form.name.trim(),
                branch_id:    form.branchId,
                start_time:   form.startTime,
                end_time:     form.endTime,
                working_days: form.workingDays,
                status:       "active",
            });
            // Figma 7412:561525 — success copy verbatim.
            showToast(
                "New shift added successfully",
                "The new shift has been added now can be assigned to staff.",
                "success", "check",
            );
        }
        router.push(returnTo);
    }

    // Edit-mode safety — shift was deleted while the admin had the form open.
    if (mode === "edit" && !existing) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center gap-3">
                <p className="font-semibold text-[18px] text-[#101828]">Shift not found</p>
                <p className="text-[14px] text-[#667085]">The shift you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={() => router.push(returnTo)}>
                    Back to shifts
                </Button>
            </div>
        );
    }

    const pageTitle = mode === "edit" ? `Edit ${existing?.name ?? "shift"}` : "Add new shift";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — X close on the left, title beside. */}
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

            {/* Body — single-step layout. Left = step pill, center = form card. */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 py-6 h-full items-start">
                    {/* Left rail — single active step (Figma 7412:557790). */}
                    <div className="w-[260px] shrink-0 pt-2">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[#f5fffa]">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]">
                                1
                            </div>
                            <span className="text-[14px] font-semibold text-[#3b5446]">Shift details</span>
                        </div>
                    </div>

                    {/* Center form card */}
                    <div className="flex-1 max-w-[628px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden self-stretch shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                            <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Shift details</h2>

                            {/* Shift name */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Shift name</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => set({ name: e.target.value })}
                                    placeholder="Enter shift name"
                                    className="h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                                />
                            </div>

                            {/* Branch location */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Branch location</label>
                                <SelectInput
                                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                                    placeholder="Select branch"
                                    value={form.branchId}
                                    onChange={v => set({ branchId: v })}
                                    options={branchOptions}
                                    width="w-full"
                                />
                            </div>

                            {/* Shift hour — start / end constrained to the
                                selected branch's open window (admin can't
                                schedule a shift outside operating hours).
                                Falls back to the full 24h range when no
                                branch is picked yet. */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Shift hour</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <SelectInput
                                            triggerIcon={<Clock className="w-4 h-4" />}
                                            placeholder="Start"
                                            value={form.startTime}
                                            onChange={v => set({ startTime: v })}
                                            options={startOptions}
                                            width="w-full"
                                        />
                                    </div>
                                    <span className="text-[14px] text-[#667085] shrink-0">—</span>
                                    <div className="flex-1">
                                        <SelectInput
                                            triggerIcon={<Clock className="w-4 h-4" />}
                                            placeholder="End"
                                            value={form.endTime}
                                            onChange={v => set({ endTime: v })}
                                            options={endOptions}
                                            width="w-full"
                                        />
                                    </div>
                                </div>
                                {!form.branchId && (
                                    <p className="text-[13px] text-[#667085]">Select a branch first — shift hours follow the branch's working hours.</p>
                                )}
                                {form.branchId && form.startTime >= form.endTime && (
                                    <p className="text-[13px] text-[#b42318]">End time must be after start time.</p>
                                )}
                            </div>

                            {/* Shift days — pill multi-toggle in Mon..Sun visual order. */}
                            <div className="flex flex-col gap-[6px]">
                                <label className="text-[14px] font-medium text-[#344054]">Shift days</label>
                                <div className="flex flex-wrap gap-2">
                                    {DAY_PILLS.map(d => {
                                        const selected = form.workingDays[d.index];
                                        return (
                                            <button key={d.label} type="button"
                                                onClick={() => toggleDay(d.index)}
                                                className={cn(
                                                    "px-4 py-[8px] rounded-[8px] text-[14px] font-medium transition-all",
                                                    selected
                                                        ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                                        : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
                                                )}>
                                                {d.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {!form.workingDays.some(Boolean) && (
                                    <p className="text-[13px] text-[#475467]">Pick at least one day.</p>
                                )}
                            </div>
                        </div>

                        {/* Footer — primary action gated by `isValid`. No
                            top border per the spec — the form card's own
                            border surrounds everything. */}
                        <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                            <Button variant="primary" size="md" disabled={!isValid} onClick={handleSubmit}
                                leftIcon={<Check className="w-4 h-4" />}>
                                {mode === "create" ? "Add shift" : "Save changes"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
