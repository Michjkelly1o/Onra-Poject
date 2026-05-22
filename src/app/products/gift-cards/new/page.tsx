"use client";

// Create-gift-card route — thin wrapper around the shared GiftCardFormPage in
// create mode. The same component powers edit mode via mode="edit" with
// prefilled initial state. Lives at the top-level /products namespace so the
// 3-step flow takes over the whole viewport (outside the admin sidebar chrome),
// matching /products/new and /class-types/new.

import { GiftCardFormPage } from "@/components/products/GiftCardFormPage";

export default function CreateGiftCardRoute() {
    return <GiftCardFormPage mode="create" />;
}
