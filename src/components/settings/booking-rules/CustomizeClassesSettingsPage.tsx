"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customize classes settings (/settings/booking-rules/customize)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4580:28480 (chrome) + 7228:47871 (Step 1 default — Inform everyone
// selected, Notify disabled) + 7228:47894 (Step 1 with "Auto-book first"
// selected — Notify enabled) + 7228:47925 (Step 2 SMS cutoff) + 7228:47933
// (Step 3 Overbooking). Toast: 4580:30293.
//
// All inputs come from the existing DS primitives so focus states, dropdown
// popovers (NOT native <select>), and stepper handles match every other
// module the project ships:
//   • `NumberWithUnitInput` — compound "[number] [unit ▾]" (Booking
//     open / close, Auto-submit, Notify waitlist, SMS cutoff, Auto-cancel)
//   • `NumericInput`         — number + stepper handle (Max waiting spots,
//     Overbooking fixed value, Overbooking percentage)
//   • `SelectInput`          — single-select dropdown (Refund timing)
//   • `Textarea`             — multi-line input (Cutoff note for customers)
//
// Local draft state holds the in-flight edits; Save writes the whole patch
// to `updateClassesSettings` so the landing summary and every downstream
// consumer reflect on the same render. X close discards.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Percent01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/NumericInput";
import { NumberWithUnitInput } from "@/components/ui/NumberWithUnitInput";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore } from "@/lib/store";
import {
    FormHeader, StepSidebar, SectionHeader, Field, Textarea,
} from "@/components/settings/business/StudioProfileFormPage";
import type { ClassesSettings } from "@/lib/store";

const RETURN_ROUTE = "/admin/settings/booking-rules";

const STEPS = [
    { n: 1, label: "Booking window"    },
    { n: 2, label: "SMS cutoff window" },
    { n: 3, label: "Overbooking"       },
];

const BOOKING_OPEN_UNITS  = [
    { value: "days",    label: "days"    },
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];
const HOURS_MINUTES = [
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];

const REFUND_OPTIONS: { value: ClassesSettings["refund_class_session"]; label: string }[] = [
    { value: "immediately",       label: "Immediately"       },
    { value: "after_class_ends",  label: "After class ends"  },
    { value: "next_business_day", label: "Next business day" },
];

export function CustomizeClassesSettingsPage() {
    const router          = useRouter();
    const classesSettings = useAppStore(s => s.classesSettings);
    const updateSettings  = useAppStore(s => s.updateClassesSettings);
    const showToast       = useAppStore(s => s.showToast);

    const [draft, setDraft] = useState<ClassesSettings>({ ...classesSettings });
    const [step,  setStep]  = useState<1 | 2 | 3>(1);

    function patchDraft(p: Partial<ClassesSettings>) {
        setDraft(prev => ({ ...prev, ...p }));
    }

    function handleClose() { router.push(RETURN_ROUTE); }
    function handleBack()  { setStep(prev => (prev === 1 ? 1 : (prev - 1) as 1 | 2)); }
    function handleNext()  { setStep(prev => (prev === 3 ? 3 : (prev + 1) as 2 | 3)); }
    function handleSave()  {
        updateSettings(draft);
        showToast(
            "Classes settings updated successfully",
            "Your class settings have been updated.",
            "success", "check",
        );
        router.push(RETURN_ROUTE);
    }

    const isLastStep = step === 3;

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <FormHeader title="Customize classes settings" onClose={handleClose} />

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">
                    <StepSidebar steps={STEPS} current={step} />

                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-8 px-1 -mx-1 min-h-0">
                                {step === 1 && <Step1BookingWindow draft={draft} patch={patchDraft} />}
                                {step === 2 && <Step2SmsCutoff      draft={draft} patch={patchDraft} />}
                                {step === 3 && <Step3Overbooking    draft={draft} patch={patchDraft} />}
                            </div>

                            <div className="shrink-0 flex items-center justify-between w-full">
                                {step > 1 ? (
                                    <Button variant="secondary-gray" size="md" onClick={handleBack}>
                                        Back
                                    </Button>
                                ) : <div />}
                                <Button
                                    variant="primary"
                                    size="md"
                                    onClick={isLastStep ? handleSave : handleNext}
                                >
                                    {isLastStep ? "Save changes" : "Continue"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1 — Booking window ────────────────────────────────────────────────

function Step1BookingWindow({ draft, patch }: {
    draft: ClassesSettings;
    patch: (p: Partial<ClassesSettings>) => void;
}) {
    const autoBook       = draft.waitlist_mode === "auto_book_first";
    const notifyDisabled = !draft.waitlist_enabled || !autoBook;

    return (
        <div className="flex flex-col gap-8">
            {/* ── Booking window ─────────────────────────────────────── */}
            <section className="flex flex-col gap-4">
                <SectionHeader title="Booking window" />
                <div className="grid grid-cols-2 gap-3">
                    <Field label="Bookings open">
                        <NumberWithUnitInput
                            value={draft.booking_open_value}
                            unit={draft.booking_open_unit}
                            units={BOOKING_OPEN_UNITS}
                            onValueChange={v => patch({ booking_open_value: v })}
                            onUnitChange={u => patch({ booking_open_unit: u as ClassesSettings["booking_open_unit"] })}
                        />
                    </Field>
                    <Field label="Bookings close">
                        <NumberWithUnitInput
                            value={draft.booking_close_value}
                            unit={draft.booking_close_unit}
                            units={HOURS_MINUTES}
                            onValueChange={v => patch({ booking_close_value: v })}
                            onUnitChange={u => patch({ booking_close_unit: u as ClassesSettings["booking_close_unit"] })}
                        />
                    </Field>
                </div>
            </section>

            {/* ── Auto-submit attendance ─────────────────────────────── */}
            <section className="flex flex-col gap-4">
                <SectionHeader title="Auto-submit attendance" />
                <div className="flex flex-col gap-1.5">
                    <Field label="Auto-submit attendance">
                        <NumberWithUnitInput
                            value={draft.auto_submit_attendance_value}
                            unit={draft.auto_submit_attendance_unit}
                            units={HOURS_MINUTES}
                            onValueChange={v => patch({ auto_submit_attendance_value: v })}
                            onUnitChange={u => patch({ auto_submit_attendance_unit: u as ClassesSettings["auto_submit_attendance_unit"] })}
                        />
                    </Field>
                    <p className="text-[14px] text-[#475467] leading-5">after the class start time</p>
                </div>
            </section>

            {/* ── Waitlist ───────────────────────────────────────────── */}
            <section className="flex flex-col gap-4">
                <SectionHeaderWithToggle
                    title="Waitlist"
                    description="If a booking is cancelled, the first person on the waitlist will be auto-booked until the cutoff time. After that, everyone on the waitlist will be notified."
                    on={draft.waitlist_enabled}
                    onToggle={() => patch({ waitlist_enabled: !draft.waitlist_enabled })}
                    ariaLabel="Toggle waitlist"
                />

                {draft.waitlist_enabled && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <RadioCard
                                selected={!autoBook}
                                onSelect={() => patch({ waitlist_mode: "inform_everyone" })}
                                label="Inform everyone on the waitlist when a spot becomes free."
                            />
                            <RadioCard
                                selected={autoBook}
                                onSelect={() => patch({ waitlist_mode: "auto_book_first" })}
                                label="Automatically book the first person on the waitlist until."
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <Field label="Notify the waitlist">
                                <NumberWithUnitInput
                                    value={draft.notify_waitlist_value}
                                    unit={draft.notify_waitlist_unit}
                                    units={HOURS_MINUTES}
                                    disabled={notifyDisabled}
                                    onValueChange={v => patch({ notify_waitlist_value: v })}
                                    onUnitChange={u => patch({ notify_waitlist_unit: u as ClassesSettings["notify_waitlist_unit"] })}
                                />
                            </Field>
                            <p className="text-[14px] text-[#475467] leading-5">before class when a spot opens.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Field label="Maximum waiting spots">
                                    <NumericInput
                                        value={draft.max_waiting_spots}
                                        onChange={v => patch({ max_waiting_spots: v })}
                                        min={0}
                                        max={999}
                                    />
                                </Field>
                                <p className="text-[14px] text-[#475467] leading-5">waiting spots.</p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Field label="Refund the class session to customer">
                                    <SelectInput
                                        value={draft.refund_class_session}
                                        onChange={v => patch({ refund_class_session: v as ClassesSettings["refund_class_session"] })}
                                        options={REFUND_OPTIONS}
                                        width="w-full"
                                    />
                                </Field>
                                <p className="text-[14px] text-[#475467] leading-5">after the class.</p>
                            </div>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

// ─── Step 2 — SMS cutoff window ─────────────────────────────────────────────

function Step2SmsCutoff({ draft, patch }: {
    draft: ClassesSettings;
    patch: (p: Partial<ClassesSettings>) => void;
}) {
    return (
        <div className="flex flex-col gap-4">
            <SectionHeaderWithToggle
                title="SMS cutoff window"
                description="Set a cutoff window before a class starts, after which SMS booking reminders and notifications will no longer be sent to customers."
                on={draft.sms_cutoff_enabled}
                onToggle={() => patch({ sms_cutoff_enabled: !draft.sms_cutoff_enabled })}
                ariaLabel="Toggle SMS cutoff"
            />

            {draft.sms_cutoff_enabled && (
                <>
                    <div className="flex flex-col gap-1.5">
                        <Field label="Do not send SMS reminders within">
                            <NumberWithUnitInput
                                value={draft.sms_cutoff_value}
                                unit={draft.sms_cutoff_unit}
                                units={HOURS_MINUTES}
                                onValueChange={v => patch({ sms_cutoff_value: v })}
                                onUnitChange={u => patch({ sms_cutoff_unit: u as ClassesSettings["sms_cutoff_unit"] })}
                            />
                        </Field>
                        <p className="text-[14px] text-[#475467] leading-5">before the class starts.</p>
                    </div>

                    <Field label="Cutoff note for customers">
                        <Textarea
                            value={draft.sms_cutoff_note}
                            onChange={v => patch({ sms_cutoff_note: v })}
                            placeholder="Add a customer-facing note explaining the cutoff window."
                            rows={4}
                        />
                    </Field>
                </>
            )}
        </div>
    );
}

// ─── Step 3 — Overbooking ───────────────────────────────────────────────────

function Step3Overbooking({ draft, patch }: {
    draft: ClassesSettings;
    patch: (p: Partial<ClassesSettings>) => void;
}) {
    const fixedDisabled      = !draft.overbooking_enabled || draft.overbooking_mode !== "fixed";
    const percentageDisabled = !draft.overbooking_enabled || draft.overbooking_mode !== "percentage";

    return (
        <div className="flex flex-col gap-8">
            {/* ── Overbooking ───────────────────────────────────────── */}
            <section className="flex flex-col gap-4">
                <SectionHeaderWithToggle
                    title="Overbooking"
                    description="Allow bookings beyond class capacity when you expect no-shows. Configure auto-cancellation rules for overbooking."
                    on={draft.overbooking_enabled}
                    onToggle={() => patch({ overbooking_enabled: !draft.overbooking_enabled })}
                    ariaLabel="Toggle overbooking"
                />

                {draft.overbooking_enabled && (
                    <div className="flex flex-col gap-3">
                        {/* Card 1 — fixed number of spots */}
                        <OverbookingRadioCard
                            selected={draft.overbooking_mode === "fixed"}
                            onSelect={() => patch({ overbooking_mode: "fixed" })}
                        >
                            <NumericInput
                                value={draft.overbooking_fixed_value}
                                onChange={v => patch({ overbooking_fixed_value: v })}
                                disabled={fixedDisabled}
                                min={0}
                                max={999}
                            />
                            <p className="text-[14px] text-[#475467] leading-5">extra spots beyond capacity.</p>
                        </OverbookingRadioCard>

                        {/* Card 2 — percentage of capacity */}
                        <OverbookingRadioCard
                            selected={draft.overbooking_mode === "percentage"}
                            onSelect={() => patch({ overbooking_mode: "percentage" })}
                        >
                            <NumericInput
                                value={draft.overbooking_percentage_value}
                                onChange={v => patch({ overbooking_percentage_value: v })}
                                disabled={percentageDisabled}
                                min={0}
                                max={100}
                                placeholder="Enter number"
                                suffix={<Percent01 className="w-5 h-5 text-[#667085]" />}
                            />
                            <p className="text-[14px] text-[#475467] leading-5">extra spots beyond capacity.</p>
                        </OverbookingRadioCard>
                    </div>
                )}
            </section>

            {/* ── Auto-cancel overbooked customers ─────────────────────── */}
            <section className="flex flex-col gap-4">
                <SectionHeaderWithToggle
                    title="Auto-cancel overbooked customers"
                    description="Automatically cancel the last-booked customer(s) when capacity is confirmed."
                    on={draft.auto_cancel_enabled}
                    onToggle={() => patch({ auto_cancel_enabled: !draft.auto_cancel_enabled })}
                    ariaLabel="Toggle auto-cancel"
                />

                {draft.auto_cancel_enabled && (
                    <div className="flex flex-col gap-1.5">
                        <Field label="Cancel">
                            <NumberWithUnitInput
                                value={draft.auto_cancel_value}
                                unit={draft.auto_cancel_unit}
                                units={HOURS_MINUTES}
                                onValueChange={v => patch({ auto_cancel_value: v })}
                                onUnitChange={u => patch({ auto_cancel_unit: u as ClassesSettings["auto_cancel_unit"] })}
                            />
                        </Field>
                        <p className="text-[14px] text-[#475467] leading-5">before class starts</p>
                    </div>
                )}
            </section>

            {/* ── Notify customers of overbooking cancellations ──────── */}
            <section>
                <SectionHeaderWithToggle
                    title="Notify customers of overbooking cancellations"
                    description="Send a notification when a booking is cancelled due to overbooking."
                    on={draft.notify_overbooked_enabled}
                    onToggle={() => patch({ notify_overbooked_enabled: !draft.notify_overbooked_enabled })}
                    ariaLabel="Toggle notify overbooked"
                />
            </section>
        </div>
    );
}

// ─── Local primitives ───────────────────────────────────────────────────────

/** Title + supporting paragraph + right-aligned toggle in one row. Used as
 *  the header for every collapsible / toggle-gated section in this page so
 *  the spacing + typography stay consistent. */
function SectionHeaderWithToggle({ title, description, on, onToggle, ariaLabel }: {
    title: string;
    description: string;
    on: boolean;
    onToggle: () => void;
    ariaLabel: string;
}) {
    return (
        <div className="flex items-center gap-10 w-full">
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-[18px] font-semibold text-[#101828] leading-7">{title}</p>
                <p className="text-[14px] text-[#6e776f] leading-5">{description}</p>
            </div>
            <Toggle on={on} onChange={onToggle} ariaLabel={ariaLabel} />
        </div>
    );
}

/** Wide bordered card with a radio in the top-right corner. Used in the
 *  Step 3 Overbooking section (Figma 7228:47940 / 7228:47941). The
 *  card content (input + helper text) lives below the "Allow up to" label. */
function OverbookingRadioCard({ selected, onSelect, children }: {
    selected: boolean;
    onSelect: () => void;
    children: React.ReactNode;
}) {
    return (
        // Native `<button role="radio">` so keyboard users can tab onto the
        // card, see the canonical focus ring, and pick fixed-vs-percentage
        // overbooking with Space/Enter — same a11y contract as the sibling
        // `RadioCard` used by the Waitlist mode picker.
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cn(
                "p-4 rounded-[12px] bg-white flex flex-col gap-3 w-full text-left cursor-pointer",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]",
                selected ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
            )}
        >
            <div className="flex items-center justify-between w-full">
                <p className="text-[14px] font-medium text-[#344054] leading-5">Allow up to</p>
                <RadioDot selected={selected} />
            </div>
            {/* Stop input clicks from re-toggling the radio — `onClick`
                bubbles from the inner controls up through this wrapper. */}
            <div className="flex flex-col gap-1.5" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </button>
    );
}

/** Single-line radio card for the Step 1 waitlist mode picker
 *  (Figma 7228:47888 / 7228:47889). Same visual contract as
 *  `OverbookingRadioCard` but the dot sits inline-left with the text. */
function RadioCard({ selected, onSelect, label }: {
    selected: boolean;
    onSelect: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "p-4 rounded-[12px] bg-white text-left flex items-start gap-2 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]",
                selected ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
            )}
        >
            <RadioDot selected={selected} className="mt-0.5" />
            <span className="flex-1 text-[14px] font-medium text-[#344054] leading-5">
                {label}
            </span>
        </button>
    );
}

function RadioDot({ selected, className }: { selected: boolean; className?: string }) {
    return (
        <span
            className={cn(
                "w-4 h-4 rounded-full shrink-0 flex items-center justify-center",
                selected ? "bg-[#658774]" : "bg-white border-1 border-[#d0d5dd]",
                className,
            )}
        >
            {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </span>
    );
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            onClick={onChange}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}
        >
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}
