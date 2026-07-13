"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer brand tokens (+ preview bridge)
// ─────────────────────────────────────────────────────────────────────────────
//
// Reads `brandingSettings` from the store and injects them as CSS custom
// properties + inline `font-family` / `color` on the customer shell so every
// surface (buttons, tiles, hero text, chrome) reads from the same source.
// Anything the admin edits in Settings → Branding → Customize design settings
// reflects on the customer side after Save (client Jul 2026).
//
// ── Live preview bridge ────────────────────────────────────────────────────
// When the customer route is embedded in the admin panel's preview iframe
// (URL flag `?preview=1`) we listen for `postMessage` from the parent
// window and paint the DRAFT (unsaved) brand instead of the store value.
// The parent broadcasts on every form change so colour scrubs / typeface
// picks / logo uploads / display-name edits reflect live WITHOUT ever
// reloading the iframe (data-URL logos would blow URL length limits, and
// per-keystroke remounts flash).
//
// The preview payload also carries `logoUrl` + `displayName` — components
// that render those (welcome splash, auth header) subscribe via
// `usePreviewBrand()` and prefer the context override when set.
//
// ── Why imperative (not JSX <style>) ───────────────────────────────────────
// Earlier attempts emitted the CSS via `<style dangerouslySetInnerHTML>`.
// That works for the colour vars but Chromium doesn't always re-cascade
// font-family when the referenced CSS variable string changes inside a
// selector rule — typeface picks appeared to update the var but the
// `font-family: var(--brand-font)` on the customer div never repainted.
//
// This version:
//   1. Sets each `--brand-*` custom property IMPERATIVELY on `documentElement`
//      via `style.setProperty`. Colours cascade normally through that.
//   2. Writes `font-family`, `color`, and `background-color` DIRECTLY on the
//      `[data-brand-scope="customer"]` element via `style.*`. Inline styles
//      trump every Tailwind class in the tree so children inherit the brand
//      font without exception.

import { createContext, useContext, useEffect, useState } from "react";
import { useAppStore, type BrandTypeface } from "@/lib/store";
import { brandTypefaceFontFamily } from "@/app/branding-fonts";

// Pre-Branding customer sage — every hardcoded hex we replaced maps here so
// a fresh workspace looks identical to what customers had before Branding.
const DEFAULT_PRIMARY  = "#658774";
const DEFAULT_BG       = "#ffffff";
// Matches the shared DS Button "primary" variant background so anything
// styled tertiary looks identical to what customers had before Branding.
const DEFAULT_TERTIARY = "#c4edd6";
const DEFAULT_TEXT     = "#101828";

/** Contract shared with the admin panel's IframePreview. Any field the
 *  admin can edit in Customize design settings is optional here so we
 *  can send partial patches without repeating unchanged fields. */
export interface PreviewBrandPayload {
    primaryColor?:    string;
    backgroundColor?: string;
    tertiaryColor?:   string;
    textColor?:       string;
    typeface?:        BrandTypeface;
    logoUrl?:         string;
    displayName?:     string;
}

/** postMessage envelope — filtered on receive so we ignore other messages
 *  (dev tools, extensions, etc.) that reach the frame. */
export const PREVIEW_MESSAGE_TYPE = "onra-brand-preview";
export const PREVIEW_READY_TYPE   = "onra-brand-preview-ready";

// ── Context for logo + displayName override ────────────────────────────────
// Colours + typeface flow through DOM styles — components don't need
// context for those. But logo and displayName are rendered as raw JSX
// attributes (`<img src>`, text content), so those components read this
// context here and prefer its value when non-null.

const PreviewBrandContext = createContext<PreviewBrandPayload | null>(null);
export function usePreviewBrand(): PreviewBrandPayload | null {
    return useContext(PreviewBrandContext);
}

function isPreviewMode(): boolean {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "1";
}

export function BrandTokens({ children }: { children?: React.ReactNode }) {
    // Store subscription — individually scoped so unrelated branding fields
    // (menu items, embed code, notification channels) don't re-render us.
    const storedPrimary   = useAppStore(s => s.brandingSettings.primaryColor);
    const storedBg        = useAppStore(s => s.brandingSettings.backgroundColor);
    const storedTertiary  = useAppStore(s => s.brandingSettings.tertiaryColor);
    const storedText      = useAppStore(s => s.brandingSettings.textColor);
    const storedTypeface  = useAppStore(s => s.brandingSettings.typeface);

    // Preview override — populated ONLY when this document is being embedded
    // by the admin panel's iframe. `postMessage` from the parent updates
    // this state on every form change; a "ready" handshake tells the
    // parent to send the current draft after we mount.
    const [preview, setPreview] = useState<PreviewBrandPayload | null>(null);

    useEffect(() => {
        if (!isPreviewMode()) return;
        function onMessage(e: MessageEvent) {
            if (e.data?.type !== PREVIEW_MESSAGE_TYPE) return;
            // Merge — parent may send partial patches; keep previously set
            // fields when the new payload omits them.
            setPreview(prev => ({ ...(prev ?? {}), ...(e.data.payload ?? {}) }));
        }
        window.addEventListener("message", onMessage);
        // Announce readiness — parent replies with the current draft so the
        // first paint reflects unsaved edits even when the iframe finishes
        // loading AFTER the parent's initial broadcast. Sent every effect
        // run (harmless duplicates) so React strict-mode double-mount is
        // fine too.
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({ type: PREVIEW_READY_TYPE }, "*");
        }
        return () => window.removeEventListener("message", onMessage);
    }, []);

    const primary  = preview?.primaryColor    || storedPrimary  || DEFAULT_PRIMARY;
    const bg       = preview?.backgroundColor || storedBg       || DEFAULT_BG;
    const tertiary = preview?.tertiaryColor   || storedTertiary || DEFAULT_TERTIARY;
    const text     = preview?.textColor       || storedText     || DEFAULT_TEXT;
    const typeface = preview?.typeface        || storedTypeface;
    const fontFamily = brandTypefaceFontFamily(typeface);

    // Apply IMPERATIVELY:
    //   1. `--brand-*` CSS custom properties on `<html>` — colours cascade
    //      through the whole tree via `var(--brand-*)`.
    //   2. `font-family` + `color` + `background-color` INLINE on the
    //      customer scope div — inline styles win over every Tailwind
    //      class in the descendant tree, so children inherit the brand
    //      font/text/background without a single override lookup.
    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;
        root.style.setProperty("--brand-primary", primary);
        root.style.setProperty("--brand-background", bg);
        root.style.setProperty("--brand-tertiary", tertiary);
        root.style.setProperty("--brand-text", text);
        root.style.setProperty("--brand-font", fontFamily);

        const scope = document.querySelector<HTMLElement>(
            '[data-brand-scope="customer"]',
        );
        if (scope) {
            scope.style.fontFamily = fontFamily;
            scope.style.color = text;
        }
    }, [primary, bg, tertiary, text, fontFamily]);

    return (
        <PreviewBrandContext.Provider value={preview}>
            {children}
        </PreviewBrandContext.Provider>
    );
}
