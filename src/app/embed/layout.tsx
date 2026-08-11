"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Embed layout
// ─────────────────────────────────────────────────────────────────────────────
//
// The public embed pages (/embed/schedule, /embed/classes/[id]) render on the
// bare root layout — no admin sidebar / customer phone frame — so they stay
// iframe-safe.
//
// We wrap them in <BrandTokens> so the studio's LIVE brand colours (Settings →
// Branding) paint the `--brand-*` CSS variables that the reused customer
// components read (SpotPicker's selected spot, the branch location card, etc.).
// This keeps the embed in lock-step with the app-wide brand colour the same way
// admin / customer / instructor / attendee are — change the brand once and every
// side, including the embed, follows.

import { BrandTokens } from "@/components/customer/shell/BrandTokens";

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
    return <BrandTokens>{children}</BrandTokens>;
}
