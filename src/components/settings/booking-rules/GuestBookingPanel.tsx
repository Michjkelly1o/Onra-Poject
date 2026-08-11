"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Guest bookings side panel (Booking rules → Guest bookings)
// ─────────────────────────────────────────────────────────────────────────────
//
// Portal to document.body. 600 px wide slide-in from the right — same chrome as
// the Waitlist / Cancellation policy panels. Everything about how members bring
// and pay for a guest is configured HERE; the Booking rules page shows a
// read-only summary and a "Customize" button that opens this panel.
//
// Settings (each gated by the one above):
//   1. Customers can use their plan for guests  (master)
//   2. Allow unlimited plans for guests          (only when 1 is ON) — when ON,
//        the "Maximum guest bookings" field appears DIRECTLY under the toggle
//        (client 2026-08-07). There is no separate "Limit guest bookings"
//        switch: allowing unlimited plans always caps the guest count, so an
//        unlimited membership can't book an unbounded number of guests.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

// ─── Primitives (mirror the Cancellation policy panel so both read as one) ──

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel, disabled = false }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string; disabled?: boolean;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => { if (!disabled) onChange(!on); }}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#164e52]" : "bg-[#f2f4f7]",
                disabled && "opacity-50 cursor-not-allowed",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

function NumberField({ value, onChange, ariaLabel, suffixSlot }: {
    value: number; onChange: (next: number) => void; ariaLabel: string; suffixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch h-10 w-full border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#94aeaf] focus-within:border-[#457175] transition-all">
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

/** A bordered setting card: title + subtitle on the left, toggle on the right,
 *  and optional revealed content below when ON. Mirrors the penalty card. */
function ToggleCard({ title, subtitle, on, onChange, ariaLabel, children }: {
    title: string; subtitle: string; on: boolean; onChange: (n: boolean) => void; ariaLabel: string;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
            on ? "border-[#457175]" : "border-[#e4e7ec]",
        )}>
            <div className="flex items-start gap-4">
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
                </div>
                <Toggle on={on} onChange={onChange} ariaLabel={ariaLabel} />
            </div>
            {on && children}
        </div>
    );
}

export function GuestBookingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const classesSettings = useAppStore(s => s.classesSettings);
    const updateClassesSettings = useAppStore(s => s.updateClassesSettings);
    const showToast = useAppStore(s => s.showToast);

    const [usePlan, setUsePlan]     = useState(true);
    const [unlimited, setUnlimited] = useState(false);
    const [maxGuests, setMaxGuests] = useState(2);
    const [shown, setShown] = useState(false);

    // Seed the draft from the store each time the panel opens, then animate in.
    useEffect(() => {
        if (open) {
            setUsePlan(classesSettings.guests_use_plan_enabled ?? true);
            setUnlimited(classesSettings.guests_allow_unlimited ?? false);
            setMaxGuests(classesSettings.guests_max_per_customer ?? 2);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, classesSettings]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Cascade — turning the master gate OFF collapses the nested setting.
    useEffect(() => { if (!usePlan && unlimited) setUnlimited(false); }, [usePlan, unlimited]);

    function handleSave() {
        updateClassesSettings({
            guests_use_plan_enabled: usePlan,
            // Snap the nested setting off when its gate is off so the persisted
            // config never carries an orphaned flag. Allowing unlimited plans
            // ALWAYS caps the guest count now (no separate toggle), so
            // `guests_limit_enabled` simply tracks `guests_allow_unlimited`.
            guests_allow_unlimited: usePlan && unlimited,
            guests_limit_enabled: usePlan && unlimited,
            guests_max_per_customer: Math.max(1, maxGuests || 1),
        });
        showToast("Guest bookings updated", "The new guest booking rules are now live.", "success", "check");
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
                        <p className="font-semibold text-[18px] text-[#101828]">Guest bookings</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Control how customers can bring and pay for a guest.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-4 select-text">
                    <ToggleCard
                        title="Customers can use their plan for guests"
                        subtitle="Pay for a guest with an eligible plan — 1 credit per guest."
                        on={usePlan}
                        onChange={setUsePlan}
                        ariaLabel="Customers can use their plan for guests"
                    />

                    {usePlan && (
                        <ToggleCard
                            title="Allow unlimited plans for guests"
                            subtitle="Unlimited memberships can also be used to book guests."
                            on={unlimited}
                            onChange={setUnlimited}
                            ariaLabel="Allow unlimited plans for guests"
                        >
                            {/* No separate "Limit guest bookings" toggle (client
                                2026-08-07) — allowing unlimited plans always caps
                                the guest count, so the Maximum guest bookings
                                field appears DIRECTLY under this toggle. */}
                            <Field label="Maximum guest bookings">
                                <NumberField
                                    value={maxGuests}
                                    onChange={setMaxGuests}
                                    ariaLabel="Maximum guest bookings"
                                    suffixSlot={
                                        <span className="px-3 flex items-center text-[14px] text-[#667085] border-l border-[#d0d5dd] bg-[#f9fafb]">
                                            {maxGuests === 1 ? "guest" : "guests"}
                                        </span>
                                    }
                                />
                            </Field>
                        </ToggleCard>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e4e7ec] shrink-0">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
