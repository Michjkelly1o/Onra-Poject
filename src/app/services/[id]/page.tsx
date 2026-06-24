"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services → Detail (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Top-level route so the detail page renders edge-to-edge without the admin
// sidebar + header chrome (same pattern as /class-types/[id]). Reads the
// dynamic [id] and hands it to the shared ServiceDetailPage component.

import { useParams } from "next/navigation";
import { ServiceDetailPage } from "@/components/services/ServiceDetailPage";

export default function ServiceDetailRoute() {
    const params = useParams();
    const id = String(params.id);
    return <ServiceDetailPage serviceId={id} />;
}
