"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Private sessions (/admin/products/private)
// ─────────────────────────────────────────────────────────────────────────────
//
// Its own route under the Products nav group (URL-consistency refactor). Renders
// the shared Services list scoped to `type = "private"` via the `fixedType`
// prop — same module, same chrome as the umbrella /admin/services list.

import { Suspense } from "react";
import { ServicesPageInner } from "@/components/services/ServicesListView";

export default function PrivateSessionsPage() {
    return (
        <Suspense fallback={null}>
            <ServicesPageInner fixedType="private" />
        </Suspense>
    );
}
