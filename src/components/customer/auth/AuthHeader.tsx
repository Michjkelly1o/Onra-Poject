"use client";

// Customer — auth screens header (studio logomark + wordmark, top-left).
// Figma 3228-22636/22812/22512: a frosted top bar pinned over the auth flow.
// Reused by Log in / Sign up, OTP, Create account, and the sign-up Emergency step.
// An optional close (X, top-right) turns the entry screen into a dismissible
// full-page modal — tapping it returns to wherever the user came from.
//
// Logo + wordmark come from `brandingSettings` (admin → Settings → Branding →
// Business info) so uploading a new logo / renaming the studio reflects here
// on every branded auth screen after Save. Falls back to Forma when unset so a
// fresh workspace still looks polished.

import { XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { usePreviewBrand } from "@/components/customer/shell/BrandTokens";

/** Top padding every auth-flow screen leaves to clear the fixed AuthHeader.
 *  Single source of truth so the flow never jumps between steps (matches the
 *  Figma auth layout, node 3228-22616). */
export const AUTH_CONTENT_OFFSET = "pt-[118px]";

export function AuthHeader({ onClose }: { onClose?: () => void }) {
    // Preview override wins over store — see BrandTokens for the bridge.
    const preview          = usePreviewBrand();
    const storedDisplayName = useAppStore(s => s.brandingSettings.displayName);
    const storedLogoUrl    = useAppStore(s => s.brandingSettings.logoUrl);
    const brandDisplayName = preview?.displayName ?? (storedDisplayName || "Forma");
    const effectiveLogoUrl = preview?.logoUrl ?? storedLogoUrl;
    const isCustomLogo     = effectiveLogoUrl.length > 0;
    const brandLogoUrl     = effectiveLogoUrl || "/customer/auth/forma-logomark.svg";
    // The default Forma SVG has `preserveAspectRatio="none"` and needs a
    // fixed 26.67×32 (viewBox aspect) box or it stretches. Uploaded logos
    // can be any shape — `object-contain` letterboxes them inside the
    // header's 32px height cap. Matches the welcome splash logic.
    const brandLogoClass   = isCustomLogo
        ? "max-h-8 max-w-[80px] w-auto h-auto object-contain"
        : "h-8 w-[26.67px]";
    return (
        <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-4 backdrop-blur-[12px]">
            <div className="flex items-center gap-0.5">
                <span className="relative flex size-8 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={brandLogoUrl}
                        alt=""
                        className={brandLogoClass}
                        aria-hidden
                    />
                </span>
                <span className="text-lg font-semibold leading-7 text-[var(--brand-text)]">{brandDisplayName}</span>
            </div>

            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            )}
        </header>
    );
}
