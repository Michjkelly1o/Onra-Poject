"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → Edit (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reads the dynamic [id] segment and hands it to the shared ServiceFormPage
// in `edit` mode. The shared component prefills every step from the live
// store row and falls back to a "not found" panel if the id was deleted
// (e.g. another tab archived → deleted the service mid-edit).

import { useParams } from "next/navigation";
import { ServiceFormPage } from "@/components/services/ServiceFormPage";

export default function EditServiceRoute() {
    const params = useParams();
    const id = String(params.id);
    return <ServiceFormPage mode="edit" serviceId={id} />;
}
