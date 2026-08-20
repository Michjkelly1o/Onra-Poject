"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Recovery (/admin/products/recovery)
// ─────────────────────────────────────────────────────────────────────────────
//
// Its own route under the Products nav group (URL-consistency refactor). Renders
// the shared Services list scoped to `type = "recovery"` via the `fixedType`
// prop — same module, same chrome as the umbrella /admin/services list.

import { Suspense } from "react";
import { ServicesPageInner } from "@/components/services/ServicesListView";

export default function RecoveryPage() {
    return (
        <Suspense fallback={null}>
            <ServicesPageInner fixedType="recovery" />
        </Suspense>
    );
}
