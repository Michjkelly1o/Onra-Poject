"use client";

// Create-marketing route — thin wrapper around the shared MarketingFormPage
// in create mode. The same component powers edit mode via mode="edit" with
// prefilled initial state. Lives at the top-level /marketing namespace so the
// 2-step flow takes over the whole viewport (outside the admin sidebar chrome),
// matching /products/promo-codes/new.

import { MarketingFormPage } from "@/components/marketing/MarketingFormPage";

export default function CreateMarketingRoute() {
    return <MarketingFormPage mode="create" />;
}
