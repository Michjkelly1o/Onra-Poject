// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `branding_settings` seed (PRD 11 §5 / Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the studio's brand identity + customer-portal
// preferences. Powers:
//
//   1. /admin/settings/branding              — the landing card pair
//   2. /settings/branding/design             — Customize design settings
//                                              (display name + 3 colors +
//                                              live phone preview)
//   3. /settings/branding/portal             — Customize portal preferences
//                                              (portal URL, menu-bar
//                                              visibility, per-item toggles,
//                                              embed URL/code, deep links)
//   4. <Sidebar> brand label                 — currently `studio.name`; the
//                                              `displayName` here is the
//                                              eventual replacement once the
//                                              customer-portal handover ships
//   5. Customer-facing portal (not yet built)— `primaryColor`,
//                                              `backgroundColor`, `textColor`
//                                              will theme the entire portal;
//                                              `portalUrl` + `embedCode` +
//                                              per-item `menuItems[].url` are
//                                              the public-facing endpoints
//
// Field shape mirrors PRD 11 §13.2 (`branding_settings`) plus the brief's
// portal-preferences additions (`portalUrl`, `menuItems`, `embedCode`).
//
// Editing flow:
//   • The Design settings + Portal preferences sub-pages each fire a single
//     `updateBrandingSettings(patch)` action on Save. Every consumer that
//     subscribes to `brandingSettings` re-renders in the same render cycle.
//   • This file is the BOOT source. The store's initial state imports from
//     here; runtime edits live in Zustand state (the seed is never mutated).
//
// Persona aligned with Figma 4468:21332 (Branding landing reference) —
// Forma Studio, primary `#B7FF01`, background `#FAFAFA`, text Black, portal
// `formastudio.book.com`, four menu items with Products disabled to mirror
// the landing screenshot.

import type { BrandingSettings } from "@/lib/store";

export const branding_settings: BrandingSettings = {
    displayName:     "Forma Studio",
    // ── Identity assets — empty by default. The landing card surfaces
    //    "Not uploaded" until the admin uploads each via the Customize
    //    design settings form Step 1 (Identity).
    logoUrl:    "",
    appIconUrl: "",
    favIconUrl: "",
    // ── Brand palette — defaults per Figma 4468:21332 (the new branding
    //    landing reference). Primary is the existing soft mint;
    //    tertiary (#F1F2ED) is the new warm-grey tile chrome.
    primaryColor:    "#C4EDD6",
    backgroundColor: "#FAFAFA",
    tertiaryColor:   "#F1F2ED",
    textColor:       "#101828",
    textColorLabel:  "Black",
    // ── Typeface — DM Sans is the default and pre-selected on Step 2.
    typeface:        "dm_sans",
    // ── Notification channels — all three on by default so the demo
    //    surfaces "Email · WhatsApp · SMS" in the landing card. Admin
    //    can toggle individual channels off in Step 3.
    notificationBranding: {
        email:    true,
        whatsapp: true,
        sms:      true,
    },
    portalUrl:       "formastudio.book.com",
    menuBarVisible:  true,
    menuItems: [
        { id: "search",   label: "Search",   enabled: true,  url: "https://www.formastudio.com/schedule#/home" },
        { id: "bookings", label: "Bookings", enabled: true,  url: "https://www.formastudio.com/schedule#/bookings" },
        { id: "products", label: "Products", enabled: false, url: "https://www.formastudio.com/schedule#/products" },
        { id: "profile",  label: "Profile",  enabled: true,  url: "https://www.formastudio.com/schedule#/profile" },
    ],
    embedCode: `<div id="studioyou-embed"></div>
<script>
  const date = Date.now();
  const xscript = document.createElement("script");
  xscript.setAttribute("src","https://formastudio.onbookee.com/embed/index.js?t="+date);
  document.head.appendChild(xscript);
</script>`,
};
