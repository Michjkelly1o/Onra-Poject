"use client";

// Edit-product route — looks up the membership/package by id, builds the
// initial form state from the persisted columns, and mounts the shared
// ProductFormPage in edit mode. Save writes through to
// updateMembership / updatePackage on the store (see ProductFormPage's
// handleSubmit), then routes back to /products/[id].

import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAppStore, type Membership, type Package } from "@/lib/store";
import {
    ProductFormPage,
    type ProductFormInitial,
} from "@/components/products/ProductFormPage";

// ─── Membership/Package → form initial state ─────────────────────────────

/** Pick the natural (n, unit) pair for a `duration_months` value so the
 *  Duration step shows e.g. "1 month" rather than "30 days". */
function monthsToDuration(months: number): { duration: string; unit: "day" | "month" | "year" } {
    if (months > 0 && months % 12 === 0) return { duration: String(months / 12), unit: "year"  };
    if (months > 0)                       return { duration: String(months),       unit: "month" };
    return { duration: "", unit: "month" };
}

/** Pick the natural (n, unit) pair for a `validity_days` value so the
 *  Duration step shows e.g. "1 month" rather than "30 days" where possible. */
function daysToDuration(days: number): { duration: string; unit: "day" | "month" | "year" } {
    if (days > 0 && days % 365 === 0) return { duration: String(days / 365), unit: "year"  };
    if (days > 0 && days % 30  === 0) return { duration: String(days / 30),  unit: "month" };
    if (days > 0)                      return { duration: String(days),       unit: "day"   };
    return { duration: "", unit: "day" };
}

function membershipToInitial(m: Membership): ProductFormInitial {
    const dur = monthsToDuration(m.duration_months);
    return {
        kind: "membership",
        basic: {
            name: m.name,
            description: m.description ?? "",
            welcomeMessage: m.welcome_message ?? "",
            price: String(m.price_aed),
        },
        config: {
            unlimitedCredits: m.credits === "unlimited",
            creditAmount: m.credits === "unlimited" ? "" : String(m.credits),
            multiLocation: m.branch_ids.length !== 1,
            branchIds: m.branch_ids.length !== 1 ? m.branch_ids : [],
            singleBranchId: m.branch_ids.length === 1 ? m.branch_ids[0] : null,
        },
        duration: {
            ...dur,
            activeOnFirstUse: m.active_on_first_use ?? false,
            autoRenew: m.auto_renew ?? false,
        },
        rules: m.purchase_rules,
    };
}

function packageToInitial(p: Package): ProductFormInitial {
    const dur = daysToDuration(p.validity_days);
    return {
        kind: "package",
        basic: {
            name: p.name,
            description: p.description ?? "",
            welcomeMessage: p.welcome_message ?? "",
            price: String(p.price_aed),
        },
        config: {
            creditAmount: String(p.credits),
            isIntroOffer: p.is_intro_offer ?? false,
            multiLocation: p.branch_ids.length !== 1,
            branchIds: p.branch_ids.length !== 1 ? p.branch_ids : [],
            singleBranchId: p.branch_ids.length === 1 ? p.branch_ids[0] : null,
        },
        duration: { ...dur, activeOnFirstUse: false, autoRenew: false },
        rules: p.purchase_rules,
    };
}

// ─── Page ────────────────────────────────────────────────────────────────

function EditProductRouteInner() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products";

    const membership = useAppStore(s => s.memberships.find(m => m.id === id) ?? null);
    const pkg        = useAppStore(s => membership ? null : (s.packages.find(p => p.id === id) ?? null));

    if (!membership && !pkg) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Product not found</p>
                <button type="button" onClick={() => router.push(returnTo)}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to memberships &amp; packages
                </button>
            </div>
        );
    }

    const initial = membership ? membershipToInitial(membership) : packageToInitial(pkg!);

    return (
        <ProductFormPage mode="edit" productId={id} initial={initial} returnTo={returnTo} />
    );
}

export default function EditProductRoute() {
    return (
        <Suspense fallback={null}>
            <EditProductRouteInner />
        </Suspense>
    );
}
