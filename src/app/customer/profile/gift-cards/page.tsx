"use client";

// Customer — Gift card (`/customer/profile/gift-cards`). Redeem a code → opens the
// redeem modal; lists previously-redeemed cards.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Gift01 } from "@untitledui/icons";
import { isRedeemed, lookupGift, useRedeemedGiftCards } from "@/lib/customer/gift-cards";
import { aed, shortDate } from "@/lib/customer/profile-format";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { Button } from "@/components/ui/button";

export default function GiftCardPage() {
    const router = useRouter();
    const redeemed = useRedeemedGiftCards();
    const [code, setCode] = useState("");
    const [error, setError] = useState<string | null>(null);

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
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">Gift card</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-8 pt-[80px]">
                <div className="flex flex-col items-center text-center">
                    <div className="relative flex size-16 items-center justify-center">
                        <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            {[44, 60, 76].map((sz, i) => (
                                <div
                                    key={sz}
                                    className="absolute rounded-[10px] border border-[#b2ddff]"
                                    style={{ width: sz, height: sz, transform: "rotate(45deg)", opacity: 0.55 - i * 0.16 }}
                                />
                            ))}
                        </div>
                        <div className="relative flex size-11 rotate-45 items-center justify-center rounded-xl bg-[#eff8ff]">
                            <Gift01 className="size-6 -rotate-45 text-[#1570ef]" aria-hidden />
                        </div>
                    </div>
                    <p className="mt-3 text-lg font-semibold leading-7 text-[#101828]">Redeem gift code</p>
                    <p className="mt-1 text-sm leading-5 text-[#475467]">Enter the digit code to redeem your gift card</p>
                </div>

                <div className="mt-5">
                    <div
                        className={`flex items-center gap-2 rounded-lg border bg-white px-3.5 py-2.5 ${
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
                            className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[#101828] outline-none placeholder:text-[#667085]"
                        />
                    </div>
                    {error && <p className="mt-1.5 text-sm leading-5 text-[#d92d20]">{error}</p>}
                    <Button
                        variant="primary"
                        size="xl"
                        disabled={!code.trim()}
                        className="mt-3 w-full rounded-full"
                        onClick={confirm}
                    >
                        Confirm
                    </Button>
                </div>

                <p className="mb-3 mt-8 text-sm font-semibold leading-5 text-[#101828]">Redeemed gift card</p>
                {redeemed.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {redeemed.map((r) => (
                            <div key={r.id} className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf3] text-[#067647]">
                                        <Gift01 className="size-5" aria-hidden />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-base font-semibold leading-6 text-[#101828]">Gift card</p>
                                        <p className="truncate text-sm leading-5 text-[#475467]">Code: {r.code}</p>
                                    </div>
                                    <p className="shrink-0 text-base font-semibold leading-6 text-[#067647]">{aed(r.faceValue)}</p>
                                </div>
                                <div className="mt-3 rounded-xl bg-[#f9fafb] p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium leading-5 text-[#344054]">
                                            AED {r.balance}/{r.faceValue} left
                                        </span>
                                        <span className="text-sm leading-5 text-[#475467]">End {shortDate(r.expiresISO)}</span>
                                    </div>
                                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#eaecf0]">
                                        <div
                                            className="h-full rounded-full bg-[#658774]"
                                            style={{ width: `${(r.balance / r.faceValue) * 100}%` }}
                                        />
                                    </div>
                                </div>
                                <Button
                                    variant="secondary-gray"
                                    size="lg"
                                    className="mt-3 w-full rounded-full"
                                    onClick={() => router.push("/customer/products")}
                                >
                                    Use gift card
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center py-8">
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
