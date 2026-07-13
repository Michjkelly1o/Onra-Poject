"use client";

// Customer — Appointment promo detail (`/customer/appointments/[id]/book/promo/[promoId]`)
// The full voucher + Apply; sets the appointment-origin promo and returns to checkout.

import type { ComponentType } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Clock, MarkerPin01, Percent03, Sale04, Tag01, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { ensurePurchaseCart, purchaseCart, usePromos } from "@/lib/customer/purchase";
import { PromoBanner } from "@/components/customer/products/PromoCard";
import { Button } from "@/components/ui/button";

function TermRow({ icon: Icon, children }: { icon: ComponentType<{ className?: string }>; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className="flex items-center py-0.5">
                <Icon className="size-4 shrink-0 text-[#475467]" />
            </span>
            <p className="flex-1 text-sm font-normal leading-5 text-[#475467]">{children}</p>
        </div>
    );
}

export default function AppointmentPromoDetailPage() {
    const router = useRouter();
    const { id, promoId } = useParams<{ id: string; promoId: string }>();
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();
    const promo = usePromos("appointment").find((p) => p.id === promoId) ?? null;
    const showToast = useAppStore((s) => s.showToast);

    const CHECKOUT = `/customer/appointments/${id}/book`;
    ensurePurchaseCart(`appointment-${id}`);

    function apply() {
        if (!promo || !promo.applicable) return;
        purchaseCart.promoId = promo.id;
        showToast("Promotion applied", `${promo.label} has been applied.`, "success");
        router.replace(CHECKOUT);
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
                    Promo detail
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            {!promo ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm font-normal text-[#475467]">This promo is no longer available.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-1 flex-col gap-8 px-4 pb-6 pt-2">
                        <PromoBanner promo={promo} rounded />

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{promo.label}</p>
                                <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2">
                                    <Sale04 className="size-3 text-[var(--brand-primary)]" aria-hidden />
                                    <span className="text-xs font-medium leading-[18px] text-[var(--brand-primary)]">1x</span>
                                </span>
                            </div>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{promo.description}</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <TermRow icon={Tag01}>
                                {promo.applicable
                                    ? "Eligible for appointment bookings"
                                    : "Not valid for appointments — this voucher applies to class packages"}
                            </TermRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={Percent03}>
                                Discount:{" "}
                                {promo.discountType === "fixed"
                                    ? `AED ${promo.discountValue} off`
                                    : `${promo.discountValue}% off`}
                            </TermRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={Ticket01}>Promotion: {promo.code}</TermRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={MarkerPin01}>Applicable for {promo.locations}</TermRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={Clock}>
                                Valid until <span className="font-medium text-[var(--brand-text)]">{promo.validUntil}</span>
                            </TermRow>
                        </div>
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
                            disabled={!promo.applicable}
                            onClick={apply}
                        >
                            Apply promo
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
