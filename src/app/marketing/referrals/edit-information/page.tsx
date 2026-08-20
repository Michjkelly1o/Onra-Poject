"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import EditReferralInformationPage from "@/components/settings/EditReferralInformationPage";

function Inner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/marketing/referrals";
    return <EditReferralInformationPage returnTo={returnTo} />;
}

export default function EditReferralInformationRoute() {
    return <Suspense fallback={null}><Inner /></Suspense>;
}
