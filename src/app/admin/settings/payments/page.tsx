"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Legacy /admin/settings/payments redirect
// ─────────────────────────────────────────────────────────────────────────────
//
// The Payments module merged into the unified Integrations module (Figma
// 7564:188282 + 7632:17561 — two tabs: Payments + Apps). This route
// preserves the original URL so any back-links (release notes, sidebar
// history, deep-linked screenshots) keep working — it just bounces the
// user to /admin/settings/integrations?tab=payments where the same UI
// now lives as the default tab.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentsLegacyRedirect() {
    const router = useRouter();
    useEffect(() => {
        router.replace("/admin/settings/integrations?tab=payments");
    }, [router]);
    return null;
}
