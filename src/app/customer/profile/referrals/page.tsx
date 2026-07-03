"use client";

// Customer — Invite friends / Referral (`/customer/profile/referrals`).
// Referral code + copy/share, the program steps, metrics, and referred customers.

import { useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy01, Gift01, ShoppingBag03, Upload01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

const STEPS: { icon: ComponentType<SVGProps<SVGSVGElement>>; text: string }[] = [
    { icon: Upload01, text: "Share your unique link to your friends to join the program." },
    { icon: ShoppingBag03, text: "Your friends signs up and makes a purchase of membership/product." },
    { icon: Gift01, text: "1 day after the purchase, you and your friend will both get 2 free class credits." },
];

function initialsOf(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

export default function ReferralsPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const showToast = useAppStore((s) => s.showToast);
    const referralSettings = useAppStore((s) => s.referralSettings);
    const referrals = useAppStore((s) => s.customerReferrals).filter((r) => r.referrerCustomerId === member?.id);
    const [shareOpen, setShareOpen] = useState(false);

    const code = member?.referralCode ?? "";
    const successful = referrals.length;
    const totalBonus = referrals.reduce((n, r) => n + (r.benefitCredits || 0), 0);
    const shareMessage =
        referralSettings.infoDescription || `Join me on Onra! Use my code ${code} and we both get 2 free credits.`;

    function copy() {
        navigator.clipboard
            ?.writeText(code)
            .then(() => showToast("Referral code copied", "Share it with your friends.", "success"))
            .catch(() => showToast("Couldn't copy", "Please try again.", "error"));
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">Invite friends</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-8 pt-[80px]">
                <div className="flex flex-col items-center text-center">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-[#ecfdf3]">
                        <Gift01 className="size-7 text-[#067647]" aria-hidden />
                    </div>
                    <p className="mt-3 text-xl font-semibold leading-7 text-[#101828]">Refer friends, get free credits</p>
                    <p className="mt-1 text-sm leading-5 text-[#475467]">Get 2 free credits for each you invite.</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex flex-1 items-center rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[#101828]">
                        {code}
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="lg"
                        leftIcon={<Copy01 className="size-4" aria-hidden />}
                        className="rounded-lg"
                        onClick={copy}
                    >
                        Copy
                    </Button>
                </div>
                <Button variant="primary" size="xl" className="w-full rounded-full" onClick={() => setShareOpen(true)}>
                    Share
                </Button>

                <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <div key={i} className={`flex gap-3 ${i > 0 ? "pt-4" : ""}`}>
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#ecfdf3] text-[#067647]">
                                    <Icon className="size-4" aria-hidden />
                                </div>
                                <p className="flex-1 pt-1 text-sm leading-5 text-[#344054]">{s.text}</p>
                            </div>
                        );
                    })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                        <p className="text-sm leading-5 text-[#475467]">Total bonus class</p>
                        <p className="mt-1 text-xl font-semibold leading-7 text-[#101828]">{totalBonus} class</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                        <p className="text-sm leading-5 text-[#475467]">Successful referrals</p>
                        <p className="mt-1 text-xl font-semibold leading-7 text-[#101828]">{successful}</p>
                    </div>
                </div>

                <div>
                    <p className="mb-3 text-sm font-semibold leading-5 text-[#101828]">Referred customers</p>
                    {referrals.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {referrals.map((r) => (
                                <div
                                    key={r.id}
                                    className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-3"
                                >
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e0e0e0] text-sm font-semibold text-[#475467]">
                                        {initialsOf(r.referredName)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-base font-medium leading-6 text-[#101828]">{r.referredName}</p>
                                        <p className="truncate text-sm leading-5 text-[#475467]">{r.referredEmail}</p>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-xs font-medium leading-5 text-[#067647] ring-1 ring-inset ring-[#abefc6]">
                                        Success
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-[#eaecf0] py-10 text-center">
                            <p className="text-base font-semibold leading-6 text-[#101828]">No referrals yet</p>
                            <p className="text-sm leading-5 text-[#475467]">refer friends and get free class!</p>
                        </div>
                    )}
                </div>
            </div>

            <CustomerSheet open={shareOpen} onClose={() => setShareOpen(false)}>
                <SheetToolbar title="Share" onClose={() => setShareOpen(false)} />
                <div className="flex flex-col gap-4 pt-1">
                    <div className="rounded-xl bg-[#f9fafb] p-4 text-sm leading-5 text-[#344054]">{shareMessage}</div>
                    <div className="flex items-center gap-2">
                        <div className="flex flex-1 items-center rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[#101828]">
                            {code}
                        </div>
                        <Button
                            variant="primary"
                            size="lg"
                            leftIcon={<Copy01 className="size-4" aria-hidden />}
                            className="rounded-lg"
                            onClick={copy}
                        >
                            Copy
                        </Button>
                    </div>
                </div>
            </CustomerSheet>
        </div>
    );
}
