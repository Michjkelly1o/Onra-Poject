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
import { XClose, Clock, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore } from "@/lib/store";

// ─── Time picker option list (15-min steps, 12-hour display) ────────────────
//
// Bounded to the studio's real operating window — the EARLIEST open time and
// LATEST close time across ALL branches (from the live `businessHours` slice),
// e.g. 06:00 → 22:00. No point offering 03:00 AM when no branch is ever open
// then. `"HH:MM"` strings sort lexically, so min/max compare directly.

/** Build 15-min "HH:MM" slots from `min`..`max` (both inclusive), 12-hour labels. */
function buildTimeOptions(min: string, max: string): { value: string; label: string }[] {
    const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
    const lo = toMin(min);
    const hi = toMin(max);
    const out: { value: string; label: string }[] = [];
    for (let mins = lo; mins <= hi; mins += 15) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        const mm = String(m).padStart(2, "0");
        const value = `${String(h).padStart(2, "0")}:${mm}`;
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        const period = h < 12 ? "AM" : "PM";
        const label = m === 0 ? `${h12} ${period}` : `${h12}.${mm} ${period}`;
        out.push({ value, label });
    }
    return out;
}

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
    /** Preserved but no longer edited — shifts are branch-agnostic (client
     *  2026-08): any shift can be assigned to any staff at any branch. */
    branchId: string;
    startTime: string;
    endTime: string;
    workingDays: boolean[]; // length 7, [Sun..Sat]
    /** true = recurring (repeats on workingDays); false = single (one-off, hours
     *  only — no weekday pattern). */
    recurring: boolean;
    /** "Repeat every N weeks" — recurring only. */
    repeatEvery: number;
}

const EMPTY_FORM: FormValue = {
    name: "",
    branchId: "",
    startTime: "07:00",
    endTime: "12:00",
    workingDays: [true, true, true, true, true, true, false], // Mon–Sat default
    recurring: true,
    repeatEvery: 1,
};

// ─── Page ───────────────────────────────────────────────────────────────────

export interface ShiftFormPageProps {
    mode: "create" | "edit";
    shiftId?: string;
    returnTo?: string;
    /** When provided the form renders as SIDE-PANEL content (header + fields +
     *  footer, no full-page chrome) and this closes the panel instead of
     *  navigating. Absent → legacy full-page route (edit). Client 2026-07-30. */
    onClose?: () => void;
}

export function ShiftFormPage({ mode, shiftId, returnTo = "/admin/staff", onClose }: ShiftFormPageProps) {
    const router = useRouter();
    const panel = !!onClose;
    const exit = onClose ?? (() => router.push(returnTo));

    const shifts        = useAppStore(s => s.shifts);
    const addShift      = useAppStore(s => s.addShift);
    const updateShift   = useAppStore(s => s.updateShift);
    const showToast     = useAppStore(s => s.showToast);

    const existing = mode === "edit" && shiftId
        ? shifts.find(s => s.id === shiftId)
        : undefined;

    const fromExisting = (e: NonNullable<typeof existing>): FormValue => ({
        name:        e.name,
        branchId:    e.branch_id,
        startTime:   e.start_time,
        endTime:     e.end_time,
        workingDays: [...e.working_days],
        recurring:   (e.type ?? "recurring") === "recurring",
        repeatEvery: e.repeat_every ?? 1,
    });
    const [form, setForm] = useState<FormValue>(() => existing ? fromExisting(existing) : EMPTY_FORM);

    // Sync when the edit target lands asynchronously (rare — e.g. resume
    // from persist into a brand-new tab).
    useEffect(() => {
        if (mode !== "edit" || !existing) return;
        setForm(fromExisting(existing));
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }
    function toggleDay(i: number) {
        const next = [...form.workingDays];
        next[i] = !next[i];
        set({ workingDays: next });
    }

    // Shifts are branch-agnostic (client 2026-08) — but the shift-hour dropdowns
    // are clamped to the studio's real operating window: earliest open → latest
    // close across ALL branches (client 2026-08-12). An edited shift whose saved
    // times fall outside the current window is still offered so it never renders
    // blank.
    const businessHours = useAppStore(s => s.businessHours);
    const timeOptions = useMemo(() => {
        const openRows = businessHours.filter(b => !b.is_closed);
        const minOpen = openRows.reduce((m, b) => (b.open_time < m ? b.open_time : m), "23:59");
        const maxClose = openRows.reduce((m, b) => (b.close_time > m ? b.close_time : m), "00:00");
        const opts = buildTimeOptions(minOpen <= maxClose ? minOpen : "00:00", maxClose > "00:00" ? maxClose : "23:45");
        // Defensive: keep the record's own saved times selectable even if the
        // operating window later tightened past them.
        for (const t of [form.startTime, form.endTime]) {
            if (t && !opts.some(o => o.value === t)) {
                const [h, m] = t.split(":").map(Number);
                const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                const period = h < 12 ? "AM" : "PM";
                opts.push({ value: t, label: m === 0 ? `${h12} ${period}` : `${h12}.${String(m).padStart(2, "0")} ${period}` });
            }
        }
        return opts.sort((a, b) => a.value.localeCompare(b.value));
    }, [businessHours, form.startTime, form.endTime]);
    const startOptions = timeOptions;
    const endOptions = useMemo(
        () => timeOptions.filter(o => o.value > form.startTime),
        [timeOptions, form.startTime],
    );

    // ─── Validation ─────────────────────────────────────────────────────────
    const isValid = (() => {
        if (!form.name.trim()) return false;
        if (form.startTime >= form.endTime) return false;
        // Recurring needs ≥1 day; a single shift has no weekday pattern.
        if (form.recurring && !form.workingDays.some(Boolean)) return false;
        if (form.recurring && (!form.repeatEvery || form.repeatEvery < 1)) return false;
        return true;
    })();

    function handleSubmit() {
        if (!isValid) return;
        // A single shift is a one-off with no weekday pattern → store empty days.
        const finalDays = form.recurring ? form.workingDays : [false, false, false, false, false, false, false];
        const shiftType: "single" | "recurring" = form.recurring ? "recurring" : "single";
        // Branch-agnostic (client 2026-08) — new shifts carry no branch; edits
        // preserve whatever the row already had.
        const branchId = existing?.branch_id ?? "";
        const repeatEvery = form.recurring ? form.repeatEvery : undefined;
        if (mode === "edit" && existing) {
            updateShift(existing.id, {
                name:         form.name.trim(),
                branch_id:    branchId,
                type:         shiftType,
                repeat_every: repeatEvery,
                start_time:   form.startTime,
                end_time:     form.endTime,
                working_days: finalDays,
            });
            showToast(
                "Shift updated successfully",
                `${form.name.trim()} has been saved.`,
                "success", "check",
            );
        } else {
            addShift({
                name:            form.name.trim(),
                branch_id:       branchId,
                type:            shiftType,
                repeat_every:    repeatEvery,
                start_time:      form.startTime,
                end_time:        form.endTime,
                working_days:    finalDays,
                // Client 2026-07-22 spec: staffing target lives on the
                // list expand (edited inline). Form defaults to 1 so a
                // freshly created shift is immediately actionable.
                staffing_target: 1,
                status:          "active",
            });
            // Figma 7412:561525 — success copy verbatim.
            showToast(
                "New shift added successfully",
                "The new shift has been added now can be assigned to staff.",
                "success", "check",
            );
        }
        exit();
    }

    // Edit-mode safety — shift was deleted while the admin had the form open.
    if (mode === "edit" && !existing) {
        const notFound = (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <p className="font-heading font-semibold text-[18px] text-[var(--colors-text-primary)]">Shift not found</p>
                <p className="text-[14px] text-[var(--colors-text-quaternary)]">The shift you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={exit}>Back to shifts</Button>
            </div>
        );
        return panel
            ? <div className="flex h-full flex-col bg-white">{notFound}</div>
            : <div className="h-screen bg-white flex flex-col">{notFound}</div>;
    }

    const pageTitle = mode === "edit" ? `Edit ${existing?.name ?? "shift"}` : "Add new shift";

    // ── Field content — shared by the side-panel + full-page layouts. ──
    const fields = (
        <>
            <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Shift details</h2>

            {/* Recurring toggle — ON repeats on the picked days (shows Repeat
                every + Shift days); OFF makes it a single one-off shift (hours
                only). Highlighted card when on (Figma). */}
            <div className={cn(
                "flex items-center gap-4 border-1 rounded-[12px] px-4 py-3 transition-colors",
                form.recurring
                    ? "border-[var(--colors-secondary-500)] bg-[var(--colors-secondary-50)]"
                    : "border-[var(--colors-border-secondary)]",
            )}>
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--colors-text-primary)]">Recurring</p>
                    <p className="text-[13px] text-[var(--colors-text-quaternary)] mt-0.5">Repeat this shift on a regular schedule.</p>
                </div>
                <button type="button" role="switch" aria-checked={form.recurring} aria-label="Recurring shift"
                    onClick={() => set({ recurring: !form.recurring })}
                    className={cn(
                        "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                        form.recurring ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-quaternary)]",
                    )}>
                    <div className={cn(
                        "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                        form.recurring ? "translate-x-5" : "translate-x-0",
                    )} />
                </button>
            </div>

            {/* Repeat every N week(s) — recurring only. */}
            {form.recurring && (
            <div className="flex flex-col gap-[6px]">
                <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Repeat every</label>
                <div className="flex items-center h-10 w-full border-1 border-[var(--colors-border-primary)] rounded-[8px] pl-[14px] pr-3 bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all">
                    <input
                        type="number" min={1}
                        value={form.repeatEvery}
                        onChange={e => set({ repeatEvery: Math.max(1, Number(e.target.value) || 1) })}
                        className="flex-1 min-w-0 text-[14px] text-[var(--colors-text-primary)] outline-none bg-transparent"
                    />
                    <span className="text-[14px] text-[var(--colors-text-tertiary)] pl-2 shrink-0">week{form.repeatEvery > 1 ? "s" : ""}</span>
                </div>
            </div>
            )}

            {/* Shift hour — start / end, any time of day (shifts are
                branch-agnostic; no branch window to clamp to). */}
            <div className="flex flex-col gap-[6px]">
                <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Shift hour</label>
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
                    <span className="text-[14px] text-[var(--colors-text-quaternary)] shrink-0">—</span>
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
                {form.startTime >= form.endTime && (
                    <p className="text-[13px] text-[#b42318]">End time must be after start time.</p>
                )}
            </div>

            {/* Shift days — recurring only. A single shift is a one-off with no
                weekday pattern, so the day picker is hidden. Every weekday is
                selectable (no branch restriction). */}
            {form.recurring && (
            <div className="flex flex-col gap-[6px]">
                <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Shift days</label>
                <div className="flex flex-wrap gap-2">
                    {DAY_PILLS.map(d => {
                        const selected = form.workingDays[d.index];
                        return (
                            <button key={d.label} type="button"
                                onClick={() => toggleDay(d.index)}
                                className={cn(
                                    "px-4 py-[8px] rounded-[8px] text-[14px] font-medium transition-all",
                                    selected
                                        ? "bg-[var(--colors-secondary-50)] border-2 border-[var(--colors-secondary-500)] text-[var(--colors-text-secondary)]"
                                        : "bg-white border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                                )}>
                                {d.label}
                            </button>
                        );
                    })}
                </div>
                {!form.workingDays.some(Boolean) && (
                    <p className="text-[13px] text-[var(--colors-text-tertiary)]">Pick at least one day.</p>
                )}
            </div>
            )}

            {/* Shift name — last per Figma order. */}
            <div className="flex flex-col gap-[6px]">
                <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Shift name</label>
                <input
                    type="text"
                    value={form.name}
                    onChange={e => set({ name: e.target.value })}
                    placeholder="Enter shift name"
                    className="h-10 w-full px-[14px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                />
            </div>
        </>
    );

    const submitBtn = (
        <Button variant="primary" size="md" disabled={!isValid} onClick={handleSubmit}
            leftIcon={<Check className="w-4 h-4" />}>
            {mode === "create" ? "Add shift" : "Save changes"}
        </Button>
    );

    // ── Side-panel layout (create via the Staff & Shifts + Add menu) ──
    if (panel) {
        return (
            <>
                <div className="flex items-start justify-between px-6 py-4 border-b border-[var(--colors-border-secondary)] shrink-0">
                    <div className="flex flex-col gap-1 min-w-0">
                        <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">{pageTitle}</h2>
                        <p className="text-[14px] leading-[20px] text-[var(--colors-text-tertiary)]">Set the shift hours, days, and active period.</p>
                    </div>
                    <button type="button" onClick={exit} aria-label="Close"
                        className="w-9 h-9 shrink-0 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {fields}
                </div>
                <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" onClick={exit}>Cancel</Button>
                    {submitBtn}
                </div>
                <Toast />
            </>
        );
    }

    // ── Full-page layout (edit route) ──
    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={exit}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">{pageTitle}</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 py-6 h-full items-start">
                    <div className="w-[260px] shrink-0 pt-2">
                        <div className="flex items-center gap-3 px-4 py-3 rounded-[12px] bg-[#f5fffa]">
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#457175]">
                                1
                            </div>
                            <span className="text-[14px] font-semibold text-[#10373a]">Shift details</span>
                        </div>
                    </div>

                    <div className="flex-1 min-w-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden self-stretch shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                            {fields}
                        </div>
                        <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                            {submitBtn}
                        </div>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
