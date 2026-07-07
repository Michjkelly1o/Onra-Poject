"use client";

// Customer — Redeem gift card (`/customer/profile/gift-cards/redeem/[code]`) —
// Figma 4095:90135. Full-page modal: sender's gift → Redeem → balance card → Close.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { isRedeemed, lookupGift, redeemGift } from "@/lib/customer/gift-cards";
import { GiftCardArt } from "@/components/customer/products/GiftCardArt";
import { Button } from "@/components/ui/button";

export default function RedeemGiftCardPage() {
    const router = useRouter();
    const { code } = useParams<{ code: string }>();
    const decoded = decodeURIComponent(code);
    const gift = lookupGift(decoded);
    const [done, setDone] = useState(() => isRedeemed(decoded));

    function close() {
        // Pop back to the Gift card page (which re-reads the store and shows the
        // newly-redeemed card) rather than pushing a fresh entry — otherwise the
        // Gift card page's Back would return here instead of to Profile.
        router.back();
    }
    function redeem() {
        if (gift) {
            redeemGift(gift);
            setDone(true);
        }
    }

    return (
        <div className="flex min-h-full flex-col bg-white">
            <div className="flex items-center justify-end px-4 pt-4">
                <button
                    type="button"
                    onClick={close}
                    aria-label="Close"
                    className="flex size-10 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-8">
                {!gift ? (
                    <p className="text-base leading-6 text-[#475467]">Gift card not found.</p>
                ) : (
                    <>
                        <GiftCardArt
                            variant={done ? "redeemed" : "sent"}
                            value={gift.faceValue}
                            className="max-w-[335px]"
                        />
                        <div className="text-center">
                            <p className="text-lg font-semibold leading-7 text-[#101828]">{gift.senderName} sent you a gift</p>
                            <p className="mt-1 text-sm leading-5 text-[#475467]">{gift.message}</p>
                        </div>
                    </>
                )}
            </div>

            {gift && (
                <div className="px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                    {done ? (
                        <Button variant="secondary-gray" size="xl" className="w-full rounded-full" onClick={close}>
                            Close
                        </Button>
                    ) : (
                        <Button variant="primary" size="xl" className="w-full rounded-full" onClick={redeem}>
                            Redeem gift card
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
