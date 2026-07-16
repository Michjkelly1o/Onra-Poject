"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Marketing detail (`/customer/marketing/[id]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened by tapping a What's on banner on Home. Reuses the Promo detail layout
// (sticky header · hero banner · title + copy · term rows · sticky CTA) and
// shows the SAME info/terms as the admin Marketing card — Type · Action ·
// Locations · "Valid until". The sticky CTA adapts to the campaign's action:
//   • book_event   → "Book now"        → opens the linked class
//   • buy_ticket   → "Buy ticket — AED X" (simulated) · toast
//   • external_link→ "Learn more"      → opens the external URL
//   • no_action    → no CTA (info-only announcement)

import type { ComponentType } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Clock, CursorBox, MarkerPin01, Tag01, Ticket01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { useMarketingItem } from "@/lib/customer/marketing-data";
import { MarketingBanner } from "@/components/customer/home/MarketingBanner";
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

export default function MarketingDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();
    const item = useMarketingItem(id);
    const showToast = useAppStore((s) => s.showToast);

    function onCta() {
        if (!item) return;
        switch (item.actionType) {
            case "book_event":
                if (item.ctaClassId) router.push(`/customer/classes/${item.ctaClassId}`);
                else router.push("/customer/search");
                break;
            case "buy_ticket":
                showToast(
                    "Ticket reserved",
                    `Your ticket for ${item.title} has been reserved.`,
                    "success",
                );
                break;
            case "external_link":
                if (item.externalUrl) window.open(item.externalUrl, "_blank", "noopener,noreferrer");
                break;
        }
    }

    const ctaLabel =
        item?.actionType === "book_event"
            ? "Book now"
            : item?.actionType === "buy_ticket"
              ? `Buy ticket${item.ticketPrice != null ? ` — AED ${item.ticketPrice}` : ""}`
              : item?.actionType === "external_link"
                ? "Learn more"
                : null;

    return (
        // min-h-[100dvh] guarantees the flex-1 body fills the viewport so the CTA
        // stays pinned to the bottom even when the campaign has few detail rows.
        <div className="flex min-h-[100dvh] flex-col">
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
                    Campaign detail
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            {!item ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm font-normal text-[#475467]">This campaign is no longer available.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-1 flex-col gap-8 px-4 pb-6 pt-2">
                        <MarketingBanner
                            title={item.title}
                            image={item.image}
                            countdown={item.countdown}
                            expiryISO={item.expiryISO}
                        />

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{item.title}</p>
                                <span className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] py-0.5 pl-1.5 pr-2">
                                    <Tag01 className="size-3 text-[var(--brand-primary)]" aria-hidden />
                                    <span className="text-xs font-medium leading-[18px] text-[var(--brand-primary)]">
                                        {item.typeLabel}
                                    </span>
                                </span>
                            </div>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{item.description}</p>
                        </div>

                        <div className="flex flex-col gap-4">
                            <TermRow icon={CursorBox}>{item.actionLabel}</TermRow>
                            {item.actionType === "buy_ticket" && item.ticketPrice != null && (
                                <>
                                    <div className="h-px w-full bg-[#e4e7ec]" />
                                    <TermRow icon={Ticket01}>
                                        Ticket price:{" "}
                                        <span className="font-medium text-[var(--brand-text)]">AED {item.ticketPrice}</span>
                                    </TermRow>
                                </>
                            )}
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={MarkerPin01}>Applicable for {item.locationsLabel}</TermRow>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            <TermRow icon={Clock}>
                                Valid until <span className="font-medium text-[var(--brand-text)]">{item.validUntil}</span>
                            </TermRow>
                        </div>
                    </div>

                    {ctaLabel && (
                        <div
                            className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                                scrollable ? "bg-white" : ""
                            }`}
                        >
                            <Button variant="primary" size="xl" className="w-full rounded-full" onClick={onCta}>
                                {ctaLabel}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
