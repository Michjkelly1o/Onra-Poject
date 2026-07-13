"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Welcome (Splash + Onboarding) · `/customer/welcome`
// Figma 3669-34057 (Splash) + 3669-34085 (Onboarding carousel)
// ─────────────────────────────────────────────────────────────────────────────
//
// First-launch front door. Phase 1: a brief Forma-logo splash (auto-advances
// after ~1.2s or on tap). Phase 2: a 3-slide swipeable onboarding carousel that
// ends in "Get started", which marks onboarding seen and drops the guest into
// Home. Already-onboarded devices skip straight to Home. Full-screen (the layout
// hides the bottom nav on `/customer/welcome`).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hasOnboarded, markOnboarded } from "@/lib/customer/auth";
import { useAppStore } from "@/lib/store";
import { usePreviewBrand } from "@/components/customer/shell/BrandTokens";
import { Button } from "@/components/ui/button";

interface Slide {
    image: string;
    title: string;
    subtitle: string;
}

// Slide 1 copy is grounded from Figma; 2–3 follow the value-prop arc
// (discovery → booking → managing your membership).
const SLIDES: Slide[] = [
    {
        image: "/customer/auth/onboarding-1.png",
        title: "Elevate your routine",
        subtitle: "Discover classes that fit seamlessly into your lifestyle.",
    },
    {
        image: "/images/class-template/hot-yoga.webp",
        title: "Book in a tap",
        subtitle: "Reserve classes and private appointments in seconds, anytime.",
    },
    {
        image: "/images/class-template/reformer-pilates.webp",
        title: "Stay on track",
        subtitle: "Manage your memberships, credits and bookings all in one place.",
    },
];

export default function WelcomePage() {
    const router = useRouter();
    const [phase, setPhase] = useState<"splash" | "onboarding">("splash");
    const [active, setActive] = useState(0);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    // Splash mirrors admin's Branding — the studio's display name + logo (from
    // Settings → Branding → Business info) so the first thing a member sees is
    // the branded studio, not "Forma". Falls back to Forma when not uploaded.
    // The default Forma SVG has `preserveAspectRatio="none"` so it stretches
    // to fill any container — must be locked to its native 43×52. Uploaded
    // logos can be any aspect ratio, so we cap them with `object-contain`.
    //
    // The preview override (admin panel's draft state, streamed in via
    // postMessage) takes precedence over the store so live-edits in
    // Customize design settings reflect here before Save.
    const preview          = usePreviewBrand();
    const storedDisplayName = useAppStore(s => s.brandingSettings.displayName);
    const storedLogoUrl    = useAppStore(s => s.brandingSettings.logoUrl);
    const brandDisplayName = preview?.displayName ?? (storedDisplayName || "Forma");
    const effectiveLogoUrl = preview?.logoUrl ?? storedLogoUrl;
    const isCustomLogo     = effectiveLogoUrl.length > 0;
    const brandLogoUrl     = effectiveLogoUrl || "/customer/auth/forma-logomark.svg";
    const brandLogoClass   = isCustomLogo
        ? "max-h-[52px] max-w-[120px] w-auto h-auto object-contain"
        : "h-[52px] w-[43px]";

    // Already onboarded → skip the intro entirely. In admin preview mode
    // (`?preview=1`, iframe embed from Branding → Customize design settings)
    // we suppress this redirect so the splash always renders regardless of
    // the tester's onboarded state.
    useEffect(() => {
        const isPreview = typeof window !== "undefined"
            && new URLSearchParams(window.location.search).get("preview") === "1";
        if (!isPreview && hasOnboarded()) router.replace("/customer");
    }, [router]);

    // Splash auto-advances to the carousel after a short beat. In admin
    // preview mode the splash is exactly what we want to render, so we
    // skip the timer — the panel's "Login" tab always shows the logo+name
    // hero (not the onboarding carousel underneath).
    useEffect(() => {
        if (phase !== "splash") return;
        const isPreview = typeof window !== "undefined"
            && new URLSearchParams(window.location.search).get("preview") === "1";
        if (isPreview) return;
        const t = setTimeout(() => setPhase("onboarding"), 1200);
        return () => clearTimeout(t);
    }, [phase]);

    function onScroll() {
        const el = scrollRef.current;
        if (!el) return;
        const i = Math.round(el.scrollLeft / el.clientWidth);
        if (i !== active) setActive(Math.max(0, Math.min(SLIDES.length - 1, i)));
    }

    function goToSlide(i: number) {
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    }

    function getStarted() {
        markOnboarded();
        router.replace("/customer");
    }

    if (phase === "splash") {
        return (
            <button
                type="button"
                onClick={() => setPhase("onboarding")}
                aria-label="Continue"
                className="relative flex h-full w-full flex-col items-center justify-center bg-gradient-to-b from-white via-white to-[var(--brand-tertiary)]"
            >
                <div className="flex flex-col items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={brandLogoUrl} alt="" className={brandLogoClass} aria-hidden />
                    <span className="text-[32px] font-semibold leading-none text-[var(--brand-text)]">{brandDisplayName}</span>
                </div>
                <div className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] flex items-center gap-1.5">
                    <span className="text-sm leading-5 text-[#98a2b3]">powered by</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/pay/forma-logomark.svg" alt="" className="size-4 opacity-60" aria-hidden />
                    <span className="text-sm font-semibold leading-5 text-[#667085]">Onra</span>
                </div>
            </button>
        );
    }

    return (
        <div className="relative h-full w-full overflow-hidden bg-black">
            {/* Full-bleed swipeable image track */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {SLIDES.map((s, i) => (
                    <div key={i} className="relative h-full w-full shrink-0 snap-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt="" className="absolute inset-0 size-full object-cover" aria-hidden />
                    </div>
                ))}
            </div>

            {/* Bottom gradient + content overlay (fixed; text follows the active slide) */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[300px] bg-gradient-to-b from-[rgba(28,28,28,0)] to-[rgba(28,28,28,0.85)]" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-6 px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
                {/* Pagination dots */}
                <div className="flex items-center gap-2">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goToSlide(i)}
                            aria-label={`Go to slide ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${
                                i === active ? "w-6 bg-[var(--brand-tertiary)]" : "w-1.5 bg-[#e4e7ec]/70"
                            }`}
                        />
                    ))}
                </div>

                {/* Active slide copy */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-white">{SLIDES[active].title}</h1>
                    <p className="text-base leading-6 text-[#d0d5dd]">{SLIDES[active].subtitle}</p>
                </div>

                <Button variant="primary" size="xl" className="w-full rounded-full" onClick={getStarted}>
                    Get started
                </Button>
            </div>
        </div>
    );
}
