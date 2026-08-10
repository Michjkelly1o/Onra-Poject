// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · ShinyText — animated shimmer/sheen for text or an icon
// ─────────────────────────────────────────────────────────────────────────────
//
// A light "shine" sweeps across the content on a loop. Implemented with a moving
// linear-gradient that's either clipped to the glyphs (background-clip: text) or
// masked to an SVG silhouette (mask-image) — no animation library, no
// shared-file edits, so it stays fully scoped to the AI Agent module and can't
// collide with the branding sweep.
//
//   • Text mode  (default)   — pass `text`; the gradient is clipped to the type.
//   • Icon mode  (`maskUrl`) — the gradient is masked to a single-colour SVG so
//                              the logo itself shimmers. Size it via `className`
//                              (e.g. "w-4 h-4"); the base colour should be the
//                              icon's natural colour so it rests unchanged.
//
// The keyframes are injected via a plain <style> tag and the animation is set
// inline — deliberately NOT styled-jsx, whose scoped class/keyframe renaming can
// silently fail to apply and leave the content static. The gradient's two ends
// share `baseColor` so the loop wraps seamlessly; at rest / reduced-motion the
// shine parks off-screen and the content shows `baseColor`.

"use client";

import type { CSSProperties } from "react";

// Global, uniquely-named keyframes. Identical markup per instance — duplicate
// <style> tags with the same rules are harmless. (No reduced-motion opt-out:
// this is a small brand flourish the demo is meant to always show.)
const SHINY_CSS = `
@keyframes onra-shiny-sweep {
  from { background-position: 150% center; }
  to   { background-position: -50% center; }
}
`;

export interface ShinyTextProps {
    /** Text mode: the label to render. Ignored when `maskUrl` is set. */
    text?: string;
    /** Icon mode: URL of a single-colour SVG to mask the shimmer to. */
    maskUrl?: string;
    /** Extra classes (typography for text; sizing like "w-4 h-4" for icons). */
    className?: string;
    /** Seconds for one full sweep. Lower = faster. */
    speed?: number;
    /** Seconds to offset this instance's loop — lets a logo lead its label. */
    delay?: number;
    /** Resting colour (the non-shine portion of the glyphs / icon). */
    baseColor?: string;
    /** The moving highlight colour that sweeps across. */
    shineColor?: string;
    /** Gradient angle in degrees — controls the shine's tilt. */
    spread?: number;
}

export function ShinyText({
    text,
    maskUrl,
    className = "",
    speed = 2.3,
    delay = 0,
    baseColor = "#101828",
    shineColor = "#45b89e",
    spread = 110,
}: ShinyTextProps) {
    // Shared moving-gradient base + the animation itself, set inline so it can't
    // be dropped by any scoping layer. Both ends = baseColor so the loop wraps
    // seamlessly; the wide, bright shineColor band (34%→66%) sweeps across.
    const base: CSSProperties = {
        backgroundImage: `linear-gradient(${spread}deg, ${baseColor} 0%, ${baseColor} 34%, ${shineColor} 50%, ${baseColor} 66%, ${baseColor} 100%)`,
        backgroundSize: "200% auto",
        backgroundRepeat: "repeat",
        backgroundPosition: "150% center",
        animation: `onra-shiny-sweep ${speed}s linear infinite`,
        animationDelay: `${delay}s`,
    };

    const styleTag = <style dangerouslySetInnerHTML={{ __html: SHINY_CSS }} />;

    // ── Icon mode — mask the shimmer to an SVG silhouette so the logo shimmers.
    if (maskUrl) {
        const iconStyle: CSSProperties = {
            ...base,
            WebkitMaskImage: `url("${maskUrl}")`,
            maskImage: `url("${maskUrl}")`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            display: "inline-block",
        };
        return (
            <>
                {styleTag}
                <span aria-hidden className={`onra-shiny ${className}`} style={iconStyle} />
            </>
        );
    }

    // ── Text mode — clip the shimmer to the glyphs.
    const textStyle: CSSProperties = {
        ...base,
        display: "inline-block",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
    };
    return (
        <>
            {styleTag}
            <span className={`onra-shiny ${className}`} style={textStyle}>
                {text}
            </span>
        </>
    );
}

export default ShinyText;
