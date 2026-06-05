"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `/settings` segment layout
// ─────────────────────────────────────────────────────────────────────────────
//
// Sub-pages under `/settings/*` (Branding → Design / Portal, Agreements →
// Create / Edit, Referral → Edit) intentionally live OUTSIDE `/admin/` so
// they render as full-page modals without the Sidebar + Header chrome.
//
// One side-effect of that: the global `<Toast />` renderer lived inside
// `app/admin/layout.tsx`, so toasts fired from /settings pages were
// captured into the store state but never rendered visually until the user
// navigated back into `/admin/*`.
//
// This thin segment-level layout fixes that — every /settings page now has
// its own Toast portal, so save confirmations, "customer portal not built
// yet" hand-off toasts, and any other inline notifications appear in the
// page the user is actually looking at.
//
// NB: copy actions deliberately do NOT go through the toast anymore — they
// use the inline "Copied!" tooltip on the CopyButton primitive for tighter
// per-button feedback.

import { Toast } from "@/components/ui/Toast";

export default function SettingsSegmentLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            {children}
            <Toast />
        </>
    );
}
