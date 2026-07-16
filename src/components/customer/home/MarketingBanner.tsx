"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Marketing Banner (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// Image-only banner: the campaign's marketing artwork fills a 140px rounded
// card (used by the Home "What's on" carousel and the campaign detail page).
// All copy now lives baked into the artwork — each campaign ships a fully
// designed image — so no title / countdown / T&Cs is overlaid on top. A neutral
// gradient shows when a campaign has no artwork yet.

export interface MarketingBannerProps {
    /** Campaign name — used as the image alt text. */
    title: string;
    image?: string;
    /** Retained for API compatibility (no longer rendered on the image-only banner). */
    countdown?: boolean;
    expiryISO?: string;
    onClick?: () => void;
}

export function MarketingBanner({ title, image, onClick }: MarketingBannerProps) {
    const interactive = typeof onClick === "function";

    return (
        <div
            {...(interactive
                ? {
                      role: "button",
                      tabIndex: 0,
                      onClick,
                      onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && onClick?.(),
                  }
                : {})}
            className={`relative aspect-[343/140] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467] ${interactive ? "cursor-pointer outline-none" : ""}`}
        >
            {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={title} className="pointer-events-none absolute inset-0 size-full object-cover" />
            ) : null}
        </div>
    );
}
