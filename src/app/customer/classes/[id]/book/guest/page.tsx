"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Reserve to (`/customer/classes/[id]/book/guest?index=N`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen step off the booking confirmation. Capture the person the booking
// is being reserved FOR (name + optional email). The seat is booked under the
// member's account but flagged with this name and paid from the member's own
// plan — so a customer can reserve a class for someone else instead of
// themselves. Save returns to the confirmation; the trash icon clears the
// reservee and reverts the booking back to the member.

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Trash01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { bookingDraft, ensureBookingDraft } from "@/lib/customer/booking-flow";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";
import { splitPhone } from "@/components/customers/CustomerFormPage";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { Button } from "@/components/ui/button";

export default function ReserveToPage() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <ReserveTo />
        </Suspense>
    );
}

const INPUT =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[#667085] focus:border-[var(--brand-primary)] focus:outline-none";

function ReserveTo() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    const scrolled = useMainScrolled();

    ensureBookingDraft(id);
    const index = Math.max(0, parseInt(search.get("index") ?? "0", 10) || 0);
    const existing = bookingDraft.guests[index];

    const seedPhone = splitPhone(existing?.phone);
    const [name, setName] = useState(existing?.name ?? "");
    const [phone, setPhone] = useState(seedPhone.number);
    const [phoneCountry, setPhoneCountry] = useState(seedPhone.country);
    const [email, setEmail] = useState(existing?.email ?? "");

    const canSave = name.trim().length > 0;

    function save() {
        if (!canSave) return;
        const guests = [...bookingDraft.guests];
        const fullPhone = phone.trim() ? `${phoneCountry.dial} ${phone.trim()}` : "";
        // Reserved seat, paid from the member's own plan (booker_credit).
        guests[index] = { name: name.trim(), phone: fullPhone, email: email.trim(), payment: "booker_credit" };
        bookingDraft.guests = guests;
        router.back();
    }

    function removeAndBack() {
        if (existing) {
            bookingDraft.guests = bookingDraft.guests.filter((_, i) => i !== index);
            showToast("Reservee removed", "This booking is back under your name.", "success");
        }
        router.back();
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Reserve to
                </p>
                {existing ? (
                    <button
                        type="button"
                        onClick={removeAndBack}
                        aria-label="Remove reservee"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <Trash01 className="size-5 text-[#b42318]" aria-hidden />
                    </button>
                ) : (
                    <span aria-hidden className="size-10 shrink-0" />
                )}
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-6">
                <p className="text-sm font-normal leading-5 text-[#475467]">
                    Book this class for someone else. The seat is reserved in their name and paid from your plan.
                </p>
                <div className="flex w-full flex-col gap-4">
                    <label className="flex w-full flex-col gap-1.5">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Full name</span>
                        <input
                            className={INPUT}
                            placeholder="Enter their name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </label>
                    <label className="flex w-full flex-col gap-1.5">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Phone number (optional)</span>
                        <div className="flex items-stretch gap-2">
                            <PhoneCountrySheet value={phoneCountry} onChange={setPhoneCountry} />
                            <input
                                className={`${INPUT} flex-1`}
                                type="tel"
                                inputMode="tel"
                                placeholder="Enter phone number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                            />
                        </div>
                    </label>
                    <label className="flex w-full flex-col gap-1.5">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Email (optional)</span>
                        <input
                            className={INPUT}
                            type="email"
                            placeholder="Enter email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </label>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button variant="primary" size="xl" className="w-full rounded-full" disabled={!canSave} onClick={save}>
                    Save
                </Button>
            </div>
        </div>
    );
}
