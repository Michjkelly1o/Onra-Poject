"use client";

// Onra Studio — Edit existing policy route (full-page modal)
import { useParams } from "next/navigation";
import { PolicyFormPage } from "@/components/settings/booking-rules/PolicyFormPage";

export default function EditPolicyRoute() {
    const params = useParams<{ id: string }>();
    return <PolicyFormPage policyId={params.id} />;
}
