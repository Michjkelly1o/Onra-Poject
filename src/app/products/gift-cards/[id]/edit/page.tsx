"use client";

// Edit-gift-card route — looks up the design by id, builds the initial form
// state from its persisted columns, and mounts the shared GiftCardFormPage in
// edit mode. Save writes through to updateGiftCardDesign on the store (see
// GiftCardFormPage's handleSubmit), then routes back to the detail page.
//
// Only active gift cards are editable (PRD 06). The list + detail surfaces
// only expose Edit on active cards; a direct visit to a non-active card's
// edit URL is caught here with a back-link guard.

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore, type GiftCardDesign } from "@/lib/store";
import {
    GiftCardFormPage,
    type GiftCardFormInitial,
} from "@/components/products/GiftCardFormPage";

// ─── GiftCardDesign → form initial state ─────────────────────────────────────

function designToInitial(g: GiftCardDesign): GiftCardFormInitial {
    const isCustom = g.value_type === "custom";
    return {
        basic: {
            name: g.name,
            description: g.description ?? "",
            price: g.price_aed != null ? String(g.price_aed) : "",
        },
        config: {
            giftCardNumber: g.gift_card_number ?? "",
            customAmount: isCustom,
            amount: !isCustom && g.fixed_value_aed != null ? String(g.fixed_value_aed) : "",
            minAmount: isCustom && g.min_value_aed != null ? String(g.min_value_aed) : "",
            maxAmount: isCustom && g.max_value_aed != null ? String(g.max_value_aed) : "",
        },
        duration: {
            noExpiration: !!g.no_expiry,
            issueDate: g.issue_date ?? "",
            expiryDate: g.valid_until_date ?? "",
        },
    };
}

// ─── Page ────────────────────────────────────────────────────────────────────

function EditGiftCardRouteInner() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products/gift-cards";

    const design = useAppStore(s => s.giftCardDesigns.find(g => g.id === id) ?? null);

    if (!design) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Gift card not found</p>
                <button type="button" onClick={() => router.push(returnTo)}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to gift cards
                </button>
            </div>
        );
    }

    // Only active gift cards can be edited — inactive/archived cards must be
    // reactivated/recovered first.
    if (design.status !== "active") {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">This gift card can&apos;t be edited</p>
                <p className="mt-1 text-[14px] text-[#475467]">
                    Only active gift cards are editable. Reactivate or recover it first.
                </p>
                <button type="button" onClick={() => router.push(`/products/gift-cards/${id}`)}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to gift card details
                </button>
            </div>
        );
    }

    return (
        <GiftCardFormPage mode="edit" designId={id} initial={designToInitial(design)} returnTo={returnTo} />
    );
}

export default function EditGiftCardRoute() {
    return (
        <Suspense fallback={null}>
            <EditGiftCardRouteInner />
        </Suspense>
    );
}
