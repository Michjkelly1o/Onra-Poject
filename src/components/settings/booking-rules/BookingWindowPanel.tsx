"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Booking window side panel (Figma 7631:393661 / 7644:81487)
// ─────────────────────────────────────────────────────────────────────────────
//
// Portal to document.body. 600 px wide slide-in from the right, same
// chrome as the Referral module modals.
//
// Body sections:
//   1. Booking window — Bookings open (numeric + unit dropdown).
//   2. Booking cutoff — "Allow bookings until the class starts" toggle.
//        • Toggle OFF (default) → Bookings close picker visible.
//        • Toggle ON → picker HIDDEN entirely (member books until start).

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings } from "@/lib/store";

const OPEN_UNIT_OPTIONS = [
    { value: "days",    label: "days"    },
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];
const CLOSE_UNIT_OPTIONS = [
    { value: "minutes", label: "minutes" },
    { value: "hours",   label: "hours"   },
    { value: "days",    label: "days"    },
];

/** Numeric input that strips leading zeros and renders placeholder when
 *  the value is zero — matches the project-wide convention used by the
 *  Referral module inputs. */
function NumberField({ value, onChange, ariaLabel, suffixSlot }: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    suffixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all">
            <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={ariaLabel}
                value={value === 0 ? "" : value}
                placeholder="0"
                onChange={e => {
                    const raw = e.target.value;
                    if (raw === "") { onChange(0); return; }
                    const stripped = raw.replace(/^0+(?=\d)/, "");
                    const parsed = parseInt(stripped, 10);
                    if (!Number.isNaN(parsed)) onChange(parsed);
                }}
                className="flex-1 min-w-0 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent"
            />
            {suffixSlot}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
            {children}
        </div>
    );
}

function Field({ label, children, subtitle }: {
    label: string; children: React.ReactNode; subtitle?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {subtitle && <p className="text-[13px] text-[#667085] leading-[18px]">{subtitle}</p>}
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

export function BookingWindowPanel({ open, onClose }: {
    open: boolean; onClose: () => void;
}) {
    const settings              = useAppStore(s => s.classesSettings);
    const updateClassesSettings = useAppStore(s => s.updateClassesSettings);
    const showToast             = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);

    // Local edit buffer — committed on Save.
    const [openValue, setOpenValue] = useState<number>(settings.booking_open_value);
    const [openUnit,  setOpenUnit]  = useState<ClassesSettings["booking_open_unit"]>(settings.booking_open_unit);
    const [cutoffOn,  setCutoffOn]  = useState<boolean>(settings.booking_cutoff_enabled);
    const [closeValue, setCloseValue] = useState<number>(settings.booking_close_value);
    const [closeUnit,  setCloseUnit]  = useState<ClassesSettings["booking_close_unit"]>(settings.booking_close_unit);

    useEffect(() => {
        if (open) {
            setOpenValue(settings.booking_open_value);
            setOpenUnit(settings.booking_open_unit);
            setCutoffOn(settings.booking_cutoff_enabled);
            setCloseValue(settings.booking_close_value);
            setCloseUnit(settings.booking_close_unit);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, settings]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    function handleSave() {
        updateClassesSettings({
            booking_open_value:     openValue,
            booking_open_unit:      openUnit,
            booking_cutoff_enabled: cutoffOn,
            booking_close_value:    cutoffOn ? settings.booking_close_value : closeValue,
            booking_close_unit:     cutoffOn ? settings.booking_close_unit  : closeUnit,
        });
        showToast(
            "Booking window updated",
            "The new booking window is now live.",
            "success", "check",
        );
        onClose();
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            <div
                style={{ right: shown ? 0 : -600 }}
                className={cn(
                    "fixed top-0 w-[600px] max-w-[100vw] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 border-b border-[#e4e7ec] shrink-0 py-4 select-none">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-[18px] text-[#101828]">Booking window</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Define when bookings open and the cutoff time before the scheduled start.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-8 select-text">
                    <Section title="Booking window">
                        <Field label="Bookings open">
                            <NumberField
                                value={openValue}
                                onChange={setOpenValue}
                                ariaLabel="Bookings open value"
                                suffixSlot={
                                    <UnitSuffixSelect
                                        value={openUnit}
                                        onChange={v => setOpenUnit(v as ClassesSettings["booking_open_unit"])}
                                        options={OPEN_UNIT_OPTIONS}
                                    />
                                }
                            />
                        </Field>
                    </Section>

                    <Section title="Booking cutoff">
                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex items-start gap-4 bg-white transition-colors",
                            cutoffOn ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">
                                    Allow bookings until the class starts
                                </p>
                                <p className="text-[14px] text-[#667085] leading-[20px]">
                                    Member can book right up to the last minute.
                                </p>
                            </div>
                            <Toggle
                                on={cutoffOn}
                                onChange={setCutoffOn}
                                ariaLabel="Allow bookings until the class starts"
                            />
                        </div>

                        {/* Bookings close picker — only visible when the
                            cutoff toggle is OFF (the toggle being ON
                            means "no cutoff", so no picker needed). */}
                        {!cutoffOn && (
                            <Field label="Bookings close" subtitle="Before the class starts">
                                <NumberField
                                    value={closeValue}
                                    onChange={setCloseValue}
                                    ariaLabel="Bookings close value"
                                    suffixSlot={
                                        <UnitSuffixSelect
                                            value={closeUnit}
                                            onChange={v => setCloseUnit(v as ClassesSettings["booking_close_unit"])}
                                            options={CLOSE_UNIT_OPTIONS}
                                        />
                                    }
                                />
                            </Field>
                        )}
                    </Section>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[#e4e7ec] shrink-0 select-none">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
