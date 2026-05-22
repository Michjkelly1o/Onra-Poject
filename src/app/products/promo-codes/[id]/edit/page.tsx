"use client";

// Edit-promo route — reads the promo from the store, maps the persisted
// `promo_codes` row back into the form's working shape, and hands it to the
// shared PromoFormPage in edit mode. Saving patches the same row via
// `updatePromoCode`, so the detail page reflects the change immediately.

import { useParams } from "next/navigation";
import { PromoFormPage } from "@/components/products/PromoFormPage";
import { useAppStore } from "@/lib/store";

/** Split an ISO "2026-02-20T12:00:00Z" into "2026-02-20" + "12:00". */
function splitIso(iso?: string): { date: string; time: string } {
    if (!iso) return { date: "", time: "" };
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
    if (!m) return { date: iso.slice(0, 10), time: "" };
    return { date: m[1], time: m[2] };
}

export default function EditPromoRoute() {
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const promo = useAppStore(s => s.promoCodes.find(p => p.id === id));

    if (!promo) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Promo not found</p>
            </div>
        );
    }

    const start = splitIso(promo.valid_from);
    const end = splitIso(promo.valid_until);
    const offer = promo.offer_type;
    const branchIds = promo.branch_ids ?? [];
    const multiLocation = promo.multi_location ?? (branchIds.length !== 1);

    return (
        <PromoFormPage
            mode="edit"
            promoId={id}
            initial={{
                bannerPreview: promo.banner_image_url ?? "",
                name: promo.name ?? "",
                description: promo.description ?? "",
                action: promo.action ?? "",
                startDate: start.date,
                startTime: start.time,
                endDate: end.date,
                endTime: end.time,
                countdown: promo.countdown ?? false,
                bookOffer: offer === "free_trial" ? "free_trial" : "free_class",
                packageOffer: offer === "fixed_amount" ? "fixed_amount" : "percentage",
                discountValue: promo.discount_value ? String(promo.discount_value) : "",
                code: promo.code,
                firstTimeOnly: promo.first_time_only ?? false,
                totalLimit: promo.usage_limit != null ? String(promo.usage_limit) : "",
                hasUsageLimit: promo.per_customer_limit != null,
                perCustomerLimit: promo.per_customer_limit != null ? String(promo.per_customer_limit) : "",
                multiLocation,
                branchIds,
                singleBranchId: multiLocation ? null : (branchIds[0] ?? null),
                productIds: promo.applies_to_product_ids ?? [],
                classIds: promo.applies_to_class_ids ?? [],
                customerTargeting: promo.customer_targeting ?? "",
            }}
        />
    );
}
