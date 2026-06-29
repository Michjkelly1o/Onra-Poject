// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Branding module typefaces
// ─────────────────────────────────────────────────────────────────────────────
//
// Loads the 6 typefaces offered by the new branding Customize Step 2 picker
// (Figma 7627:317328) via Next.js's `next/font/google` so they're SSR-safe
// and self-hosted at build-time (no FOUT, no third-party network call at
// runtime).
//
// Mapping (label shown on the picker card → loader → CSS variable):
//   • DM Sans              → DM_Sans              → --font-brand-dm-sans
//   • Inter                → Inter                → --font-brand-inter
//   • Nunito Sans          → Nunito_Sans          → --font-brand-avenir
//   • Playfair Display     → Playfair_Display     → --font-brand-playfair
//   • Cormorant Garamond   → Cormorant_Garamond   → --font-brand-cormorant
//   • Lora                 → Lora                 → --font-brand-lora
//
// The internal `BrandTypeface` key is still "avenir" for backward-compat
// with persisted v21 BrandingSettings payloads — only the user-facing
// label was swapped (Figma originally specced Avenir but it's Adobe-
// licensed; we ship Nunito Sans as the closest free Google Fonts
// equivalent and surface that name on the picker card).
//
// The CSS variables are attached to <body> in app/layout.tsx; the branding
// preview reads them via `brandTypefaceVarFor(typeface)` to apply the
// live-selected font to the template preview without disturbing any other
// surface (the admin shell stays on system sans-serif).

import {
    DM_Sans,
    Inter,
    Nunito_Sans,
    Playfair_Display,
    Cormorant_Garamond,
    Lora,
} from "next/font/google";
import type { BrandTypeface } from "@/lib/store";

export const fontDmSans = DM_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-dm-sans",
    display: "swap",
});

export const fontInter = Inter({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-inter",
    display: "swap",
});

/** Avenir substitute — Nunito Sans is the closest free geometric humanist
 *  sans available on Google Fonts (Avenir is Adobe-only). */
export const fontAvenir = Nunito_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-avenir",
    display: "swap",
});

export const fontPlayfair = Playfair_Display({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-playfair",
    display: "swap",
});

export const fontCormorant = Cormorant_Garamond({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-cormorant",
    display: "swap",
});

export const fontLora = Lora({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
    variable: "--font-brand-lora",
    display: "swap",
});

/** Convenience — `<body>` class list spread that exposes every brand
 *  typeface as a CSS variable. The branding preview consumes these
 *  variables; the admin shell ignores them and renders in the default
 *  Tailwind sans-serif. */
export const BRAND_FONT_VARIABLES = [
    fontDmSans.variable,
    fontInter.variable,
    fontAvenir.variable,
    fontPlayfair.variable,
    fontCormorant.variable,
    fontLora.variable,
].join(" ");

/** Resolve a CSS `font-family` token for a chosen typeface — wraps the
 *  next/font variable in a `var(...)` fallback chain so the preview
 *  always has something to render even if the font is still streaming. */
export function brandTypefaceFontFamily(typeface: BrandTypeface): string {
    switch (typeface) {
        case "dm_sans":            return "var(--font-brand-dm-sans), system-ui, sans-serif";
        case "inter":              return "var(--font-brand-inter), system-ui, sans-serif";
        case "avenir":             return "var(--font-brand-avenir), system-ui, sans-serif";
        case "playfair_display":   return "var(--font-brand-playfair), Georgia, serif";
        case "cormorant_garamond": return "var(--font-brand-cormorant), Georgia, serif";
        case "lora":               return "var(--font-brand-lora), Georgia, serif";
    }
}

/** Human label for a typeface key — used by the landing card "Typeface"
 *  row and the Customize form's typeface card titles. */
export function brandTypefaceLabel(typeface: BrandTypeface): string {
    switch (typeface) {
        case "dm_sans":            return "DM Sans";
        case "inter":              return "Inter";
        case "avenir":             return "Nunito Sans";
        case "playfair_display":   return "Playfair Display";
        case "cormorant_garamond": return "Cormorant Garamond";
        case "lora":               return "Lora";
    }
}

/** Short tagline pair shown under each typeface card in Step 2 (Figma
 *  7627:317328 — e.g. "Clean · Modern" beneath DM Sans). */
export function brandTypefaceTagline(typeface: BrandTypeface): string {
    switch (typeface) {
        case "dm_sans":            return "Clean · Modern";
        case "inter":              return "Neutral · Readable";
        case "avenir":             return "Elegant · Versatile";
        case "playfair_display":   return "Classic · Editorial";
        case "cormorant_garamond": return "Refined · Luxurious";
        case "lora":               return "Warm · Timeless";
    }
}
