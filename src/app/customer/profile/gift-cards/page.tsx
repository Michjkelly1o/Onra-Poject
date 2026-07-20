"use client";

// Customer — Gift card (`/customer/profile/gift-cards`) — Figma 4095:89991.
// Redeem a code → opens the redeem modal; lists previously-redeemed cards.

import { useEffect, useState } from "react";
import { useRequireCustomerAuth } from "@/lib/customer/use-require-auth";
import { useRouter } from "next/navigation";
import { ChevronLeft, Gift01 } from "@untitledui/icons";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { isRedeemed, lookupGift, useRedeemedGiftCards, type RedeemedGiftCard } from "@/lib/customer/gift-cards";
import { consumeGiftCardPickMode, requestGiftCardPayment } from "@/lib/customer/purchase";
import { aed, shortDate } from "@/lib/customer/profile-format";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { FeaturedIconHero } from "@/components/customer/profile/FeaturedIconHero";
import { GiftCardMark } from "@/components/customer/products/GiftCardArt";
import { Button } from "@/components/ui/button";

/** Validity period label (e.g. "1 month" / "9 months") from redeemed → expiry. */
function validityLabel(r: RedeemedGiftCard): string {
    const start = new Date(`${r.redeemedAtISO.slice(0, 10)}T00:00:00`).getTime();
    const end = new Date(`${r.expiresISO}T00:00:00`).getTime();
    const months = Math.max(1, Math.round((end - start) / (30 * 24 * 3600 * 1000)));
    return `${months} month${months === 1 ? "" : "s"}`;
}

export default function GiftCardPage() {
    useRequireCustomerAuth();
    const router = useRouter();
    const goBack = useCustomerBack("/customer/profile");
    const redeemed = useRedeemedGiftCards();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);
    // Opened as a payment-method picker from a checkout ("Add gift card")?
    const [pickMode, setPickMode] = useState(false);
    useEffect(() => {
        if (consumeGiftCardPickMode()) setPickMode(true);
    }, []);

    function useGiftCard() {
        if (pickMode) {
            // Apply the (combined) gift-card balance as the checkout payment method.
            requestGiftCardPayment();
            goBack();
        } else {
            router.push("/customer/products");
        }
    }

    function confirm() {
        const c = code.trim();
        if (!c) return;
        if (!lookupGift(c)) {
            setError("Gift card not found");
            return;
        }
        if (isRedeemed(c)) {
            setError("This gift card is already redeemed");
            return;
        }
        router.push(`/customer/profile/gift-cards/redeem/${encodeURIComponent(c)}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">Gift card</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="relative flex flex-1 flex-col px-4 pb-8 pt-[80px]">
                {/* Soft mint radial wash over the top (Figma gradient). */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
                    style={{ background: "radial-gradient(125% 78% at 50% -18%, #dff6ed 0%, rgba(255,255,255,0) 72%)" }}
                />

                {/* Hero — featured icon over the decorative pattern (shared w/ Invite friends). */}
                <FeaturedIconHero
                    icon={Gift01}
                    tileClassName="bg-[#dcfae5] shadow-[0px_4px_18px_0px_rgba(220,250,229,0.7),0px_2px_4px_0px_rgba(16,24,40,0.04)]"
                    iconClassName="size-[42px] text-[var(--brand-primary)]"
                    title="Redeem gift code"
                    subtitle="Enter the digit code to redeem your gift card"
                />

                {/* Code entry */}
                <div className="relative mt-6">
                    <div
                        className={`flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 shadow-[0px_1px_1px_0px_rgba(16,24,40,0.05)] ${
                            error ? "border-[#fda29b]" : "border-[#d0d5dd]"
                        }`}
                    >
                        <Gift01 className="size-5 shrink-0 text-[#667085]" aria-hidden />
                        <input
                            value={code}
                            onChange={(e) => {
                                setCode(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => e.key === "Enter" && confirm()}
                            placeholder="Enter gift card code"
                            className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                        />
                    </div>
                    {error && <p className="mt-1.5 text-sm leading-5 text-[#d92d20]">{error}</p>}
                    <Button
                        variant="primary"
                        size="xl"
                        disabled={!code.trim()}
                        className="mt-4 w-full rounded-full"
                        onClick={confirm}
                    >
                        Confirm
                    </Button>
                </div>

                {/* Redeemed */}
                <p className="relative mb-3 mt-8 text-base font-semibold leading-6 text-[var(--brand-text)]">Redeemed gift card</p>
                {redeemed.length > 0 ? (
                    <div className="relative flex flex-col gap-3">
                        {redeemed.map((r) => (
                            <div key={r.id} className="rounded-xl border border-[#e4e7ec] bg-white p-4">
                                <div className="flex items-center gap-3">
                                    <GiftCardMark />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">Gift card</p>
                                        <p className="truncate text-sm font-normal leading-5 text-[#667085]">Code: {r.code}</p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end">
                                        <p className="text-sm font-semibold leading-5 text-[var(--brand-primary)]">{aed(r.faceValue)}</p>
                                        <p className="text-sm font-normal leading-5 text-[#667085]">{validityLabel(r)}</p>
                                    </div>
                                </div>
                                <div className="mt-4 rounded-[10px] bg-[#f2f4f7] px-3 pb-4 pt-3">
                                    <div className="flex items-center justify-between text-sm font-normal leading-5 text-[#667085]">
                                        <span>
                                            AED {r.balance}/{r.faceValue} left
                                        </span>
                                        <span>End {shortDate(r.expiresISO)}</span>
                                    </div>
                                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[#e4e7ec]">
                                        <div
                                            className="h-full rounded-full bg-[var(--brand-primary)]"
                                            style={{ width: `${(r.balance / r.faceValue) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="secondary-gray"
                                    size="lg"
                                    disabled={r.balance <= 0}
                                    className="mt-4 w-full rounded-full"
                                    onClick={useGiftCard}
                                >
                                    Use gift card
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="relative flex flex-col items-center py-8">
                        <SearchEmptyState
                            icon={Gift01}
                            title="No redeemed gift card yet"
                            description="Redeemed gift cards will appear here."
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
