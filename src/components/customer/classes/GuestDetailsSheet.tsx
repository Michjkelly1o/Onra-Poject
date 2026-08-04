"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Guest Details (bottom sheet) — Figma 4580-161234 (Guest details)
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from the Review & Book sheet's "Guest" tab. Collects the guest's name +
// email. Header has a BACK button only (no close) — returning lands back on the
// Review & Book sheet. Saving passes the guest up and the caller shows the guest
// card under the Guest tab. Hug-content height (a short sheet).

import { useEffect, useState } from "react";
import { ChevronLeft } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { Button } from "@/components/ui/button";

const INPUT =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[#667085] focus:border-[var(--brand-primary)] focus:outline-none";

export function GuestDetailsSheet({
    open,
    initial,
    onBack,
    onSave,
}: {
    open: boolean;
    initial: { name: string; email: string } | null;
    onBack: () => void;
    onSave: (guest: { name: string; email: string }) => void;
}) {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    // Seed from the existing guest each time the sheet opens.
    useEffect(() => {
        if (open) {
            setName(initial?.name ?? "");
            setEmail(initial?.email ?? "");
        }
    }, [open, initial]);

    const canSave = name.trim().length > 0;

    return (
        <CustomerSheet open={open} onClose={onBack}>
            {/* Header — Back only, no close */}
            <div className="relative flex shrink-0 items-center justify-center pb-4">
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Back"
                    className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Guest details</p>
            </div>

            <div className="flex flex-col gap-4 pt-1">
                <label className="flex w-full flex-col gap-1.5">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Guest name</span>
                    <input className={INPUT} placeholder="Enter guest name" value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="flex w-full flex-col gap-1.5">
                    <span className="text-sm font-medium leading-5 text-[#344054]">Email</span>
                    <input
                        className={INPUT}
                        type="email"
                        placeholder="Enter email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </label>

                <Button
                    variant="primary"
                    size="xl"
                    className="mt-2 w-full rounded-full"
                    disabled={!canSave}
                    onClick={() => onSave({ name: name.trim(), email: email.trim() })}
                >
                    Save
                </Button>
            </div>
        </CustomerSheet>
    );
}
