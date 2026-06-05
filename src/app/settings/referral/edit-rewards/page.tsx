"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EditReferralRewardsPage from "@/components/settings/EditReferralRewardsPage";

function Inner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/settings/referral";
    return <EditReferralRewardsPage returnTo={returnTo} />;
}

export default function EditReferralRewardsRoute() {
    return <Suspense fallback={null}><Inner /></Suspense>;
}
