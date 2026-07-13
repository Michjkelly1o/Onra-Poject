"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Add Guest (`/customer/classes/[id]/book/guest?index=N`) — brief §5.13
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen step off the booking confirmation. Capture guest name + email
// FIRST; the "Guest payment" group only appears once both are filled, and the
// "Use from their package" option is enabled only when the entered email
// resolves to an active member who holds class credits (the booking member is
// never charged for a guest). Save returns to the confirmation with the guest
// listed; the trash icon removes the guest (when editing) and returns.

import { Suspense, useState, type ComponentType, type SVGProps } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BankNote01, ChevronLeft, CoinsStacked03, Link03, Trash01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { bookingDraft, DROP_IN_PRICE_AED, ensureBookingDraft, type GuestPayment } from "@/lib/customer/booking-flow";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

export default function AddGuestPage() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <AddGuest />
        </Suspense>
    );
}

const INPUT =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[#667085] focus:border-[var(--brand-primary)] focus:outline-none";

function FeaturedIcon({ icon: Icon }: { icon: IconType }) {
    return (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <Icon className="size-4 text-[#475467]" aria-hidden />
        </span>
    );
}

function AddGuest() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const customers = useAppStore((s) => s.customers);
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    const scrolled = useMainScrolled();

    ensureBookingDraft(id);
    const index = Math.max(0, parseInt(search.get("index") ?? "0", 10) || 0);
    const existing = bookingDraft.guests[index];

    const [name, setName] = useState(existing?.name ?? "");
    const [email, setEmail] = useState(existing?.email ?? "");
    const [payment, setPayment] = useState<GuestPayment | null>(existing?.payment ?? null);

    // Payment only appears once name + email are entered.
    const detailsDone = name.trim().length > 0 && email.trim().length > 0;

    // Resolve the entered email → an active member who holds class credits.
    const guestMember = customers.find(
        (c) => c.status === "active" && c.email.toLowerCase() === email.trim().toLowerCase(),
    );
    const guestHasCredits =
        !!guestMember && typeof guestMember.creditsRemaining === "number" && guestMember.creditsRemaining > 0;
    // If the package option was picked but the email no longer qualifies, void it.
    const effectivePayment: GuestPayment | null =
        payment === "guest_package" && !guestHasCredits ? null : payment;

    const canSave = detailsDone && !!effectivePayment;

    function save() {
        if (!canSave || !effectivePayment) return;
        const guests = [...bookingDraft.guests];
        guests[index] = { name: name.trim(), email: email.trim(), payment: effectivePayment };
        bookingDraft.guests = guests;
        router.back();
    }

    function removeAndBack() {
        if (existing) {
            bookingDraft.guests = bookingDraft.guests.filter((_, i) => i !== index);
            showToast("Guest removed", "The guest has been removed from this class.", "success");
        }
        router.back();
    }

    const options: { value: GuestPayment; icon: IconType; label: string; sub: string; disabled?: boolean }[] = [
        { value: "drop_in", icon: BankNote01, label: "Guest pays drop-in", sub: `AED ${DROP_IN_PRICE_AED} per class` },
        {
            value: "guest_package",
            icon: CoinsStacked03,
            label: "Use from their package",
            sub: guestHasCredits ? "1 credit deducted" : "No eligible package for this email",
            disabled: !guestHasCredits,
        },
        { value: "invite_link", icon: Link03, label: "Send invite link", sub: "Friend pays & books themselves" },
    ];

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
                    Guest {index + 1}
                </p>
                <button
                    type="button"
                    onClick={removeAndBack}
                    aria-label="Remove guest"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <Trash01 className="size-5 text-[#b42318]" aria-hidden />
                </button>
            </header>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-6 pt-6">
                <div className="flex w-full flex-col gap-4">
                    <label className="flex w-full flex-col gap-1.5">
                        <span className="text-sm font-medium leading-5 text-[#344054]">Guest name</span>
                        <input
                            className={INPUT}
                            placeholder="Enter guest name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
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
                </div>

                {detailsDone && (
                    <>
                        <div className="h-px w-full bg-[#e4e7ec]" />
                        <div className="flex w-full flex-col gap-3">
                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Guest payment</p>
                            {options.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    disabled={o.disabled}
                                    onClick={() => setPayment(o.value)}
                                    className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                                        o.disabled
                                            ? "border border-[#e4e7ec] bg-[#f9fafb] opacity-60"
                                            : effectivePayment === o.value
                                              ? "border-2 border-[var(--brand-primary)] bg-white"
                                              : "border border-[#e4e7ec] bg-white"
                                    }`}
                                >
                                    <FeaturedIcon icon={o.icon} />
                                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{o.label}</span>
                                        <span className="text-sm font-normal leading-5 text-[#667085]">{o.sub}</span>
                                    </div>
                                    <RadioDot checked={effectivePayment === o.value} />
                                </button>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="primary"
                    size="xl"
                    className="w-full rounded-full"
                    disabled={!canSave}
                    onClick={save}
                >
                    Save
                </Button>
            </div>
        </div>
    );
}
