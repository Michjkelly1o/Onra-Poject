"use client";

// Customer — Redeem gift card (`/customer/profile/gift-cards/redeem/[code]`).
// Full-page modal: shows the sender's gift → Redeem → balance card → Close.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle, Gift01, XClose } from "@untitledui/icons";
import { isRedeemed, lookupGift, redeemGift } from "@/lib/customer/gift-cards";
import { aed } from "@/lib/customer/profile-format";
import { Button } from "@/components/ui/button";

export default function RedeemGiftCardPage() {
    const router = useRouter();
    const { code } = useParams<{ code: string }>();
    const decoded = decodeURIComponent(code);
    const gift = lookupGift(decoded);
    const [done, setDone] = useState(() => isRedeemed(decoded));

    function close() {
        router.push("/customer/profile/gift-cards");
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
                        <div className="flex aspect-[1.7] w-full max-w-[320px] flex-col rounded-2xl bg-gradient-to-br from-[#d7ffe9] to-[#a6f4c5] p-5">
                            {done ? (
                                <>
                                    <div className="flex items-center justify-between">
                                        <span className="text-base font-semibold leading-6 text-[#067647]">Forma</span>
                                        <CheckCircle className="size-5 text-[#067647]" aria-hidden />
                                    </div>
                                    <div className="mt-auto">
                                        <p className="text-2xl font-bold leading-8 text-[#101828]">{aed(gift.faceValue)}</p>
                                        <p className="text-sm leading-5 text-[#475467]">Gift Card</p>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-1 items-center justify-center">
                                    <div className="flex size-16 items-center justify-center rounded-full bg-white/60">
                                        <Gift01 className="size-8 text-[#067647]" aria-hidden />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold leading-7 text-[#101828]">{gift.senderName} sent you a gift</p>
                            <p className="mt-1 text-sm leading-5 text-[#475467]">{gift.message}</p>
                        </div>
                    </>
                )}
            </div>

            {gift && (
                <div className="px-6 pb-10">
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
