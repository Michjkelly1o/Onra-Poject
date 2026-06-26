"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Unified Integrations module
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Payments tab (default)     — 7564:188282
//   • Payments — Stripe connected — 7564:190092
//   • Apps tab                   — 7632:17561
//   • Apps — filter dropdown     — 7632:17561 (overlay state)
//   • Request integration modal  — 7603:113819 (empty) / 7603:114467 (filled)
//   • Success toast              — 7603:115419
//
// The Payments + Apps surfaces previously lived at separate sub-routes
// (/admin/settings/payments and /admin/settings/integrations). They now
// share a single page with SegmentedTabs at the top:
//
//   /admin/settings/integrations           → default tab "payments"
//   /admin/settings/integrations?tab=apps  → "apps" tab
//
// Legacy /admin/settings/payments redirects to ?tab=payments here so any
// back-links keep working. The Settings landing card (Platform) lists a
// single "Integrations" entry pointing to this page; the old "Payments"
// item was dropped since it merged in.
//
// Data shape, store actions, flow modals, and cascade rules are unchanged —
// this is purely a layout + entry-point merge.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { useAppStore } from "@/lib/store";
import { PaymentsTab } from "@/components/settings/integrations/PaymentsTab";
import { AppsTab } from "@/components/settings/integrations/AppsTab";

type TabKey = "payments" | "apps";

function IntegrationsPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const integrations = useAppStore(s => s.integrations);
    const paymentProviders = useAppStore(s => s.paymentProviders);

    // Active tab — `?tab=payments|apps`, defaults to "payments" per the
    // Figma (the screenshot shows the Payments tab highlighted as active).
    const initial: TabKey = searchParams.get("tab") === "apps" ? "apps" : "payments";
    const [activeTab, setActiveTab] = useState<TabKey>(initial);

    // Sync state to URL when the user clicks a tab — keeps the back button
    // honest and lets deep links re-open the same tab.
    useEffect(() => {
        const current = searchParams.get("tab") ?? "payments";
        if (current === activeTab) return;
        const params = new URLSearchParams(searchParams.toString());
        if (activeTab === "payments") params.delete("tab");
        else params.set("tab", activeTab);
        const qs = params.toString();
        router.replace(`/admin/settings/integrations${qs ? `?${qs}` : ""}`);
    }, [activeTab, router, searchParams]);

    // Tab counts — connected providers for Payments, total apps for Apps
    // (matches the Figma where "Payments 2" reflects the connected count
    // and "Apps 8" reflects total tools).
    const connectedPaymentCount = paymentProviders.filter(p => p.status === "connected").length;
    const appsCount = integrations.length;

    return (
        <div className="flex flex-col gap-6">
            {/* Tabs hug their content — each label sits beside a circular
                count badge rendered by SegmentedTabs (per Figma 7564:188282).
                "Payments 2" reflects connected providers; "Apps 8" reflects
                total tools. */}
            <SegmentedTabs
                tabs={[
                    { key: "payments", label: "Payments", count: connectedPaymentCount },
                    { key: "apps",     label: "Apps",     count: appsCount             },
                ]}
                activeKey={activeTab}
                onChange={k => setActiveTab(k as TabKey)}
            />

            {activeTab === "payments" ? <PaymentsTab /> : <AppsTab />}
        </div>
    );
}

// Suspense boundary required for `useSearchParams` per Next.js 14 docs.
export default function IntegrationsPage() {
    return (
        <Suspense fallback={null}>
            <IntegrationsPageInner />
        </Suspense>
    );
}
