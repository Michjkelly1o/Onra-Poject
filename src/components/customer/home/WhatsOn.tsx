"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — What's On section (PRD 13 §6.6)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 4111-40264 ("Promo"). Section title + a
// crossfade carousel of <MarketingBanner> (admin Marketing covers):
//   • each campaign dwells 5s, then dissolves to the next (Figma Smart-Animate
//     "Ease Out" — an opacity crossfade, not a slide)
//   • swipe left / right triggers the SAME dissolve (no finger-following slide)
//   • pagination dots (active = brand-green 24px pill, inactive = 6px gray)
// Hidden when there are no active campaigns for the studio.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MarketingBanner } from "@/components/customer/home/MarketingBanner";
import type { HomeWhatsOnVM } from "@/lib/customer/home-data";

const AUTO_MS = 5000;
// Figma Smart-Animate "Ease Out" curve — used for every transition (auto + swipe).
const DISSOLVE = "opacity 600ms cubic-bezier(0, 0, 0.58, 1)";

export function WhatsOn({ items }: { items: HomeWhatsOnVM[] }) {
    const router = useRouter();
    const count = items.length;
    const loop = count > 1;
    const [active, setActive] = useState(0);

    const ref = useRef<HTMLDivElement>(null);
    const drag = useRef({ startX: 0, active: false });
    // Set true when a pointer gesture ends as a swipe, so the trailing synthetic
    // click on the banner is swallowed instead of opening the campaign detail.
    const swiped = useRef(false);

    // Auto-advance: dwell 5s on the current campaign, then dissolve to the next.
    useEffect(() => {
        if (!loop) return;
        const id = setTimeout(() => setActive((a) => (a + 1) % count), AUTO_MS);
        return () => clearTimeout(id);
    }, [active, loop, count]);

    if (count === 0) return null;

    function go(dir: 1 | -1) {
        setActive((a) => (a + dir + count) % count);
    }

    function onPointerDown(e: React.PointerEvent) {
        swiped.current = false;
        // Single campaign → no swipe; let the banner tap open its detail.
        if (!loop) return;
        // Track the gesture WITHOUT capturing the pointer — pointer capture
        // reroutes the follow-up click away from the banner and breaks the tap.
        drag.current = { startX: e.clientX, active: true };
    }
    function onPointerUp(e: React.PointerEvent) {
        if (!drag.current.active) return;
        drag.current.active = false;
        const dx = e.clientX - drag.current.startX;
        // A decisive swipe dissolves to the next / previous campaign; a small
        // movement counts as a tap and falls through to the banner's onClick.
        if (Math.abs(dx) > 40) {
            swiped.current = true;
            go(dx < 0 ? 1 : -1);
        }
    }
    // Swallow the click that follows a swipe so it doesn't also open the detail.
    function onClickCapture(e: React.MouseEvent) {
        if (swiped.current) {
            e.preventDefault();
            e.stopPropagation();
            swiped.current = false;
        }
    }

    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">What’s on</h2>

            <div className="flex w-full flex-col gap-3">
                <div
                    ref={ref}
                    className="relative aspect-[343/140] w-full touch-pan-y select-none"
                    onPointerDown={onPointerDown}
                    onPointerUp={onPointerUp}
                    onPointerCancel={() => (drag.current.active = false)}
                    onClickCapture={onClickCapture}
                >
                    {items.map((it, i) => (
                        <div
                            key={it.id}
                            aria-hidden={i !== active}
                            className="absolute inset-0"
                            style={{
                                opacity: i === active ? 1 : 0,
                                transition: DISSOLVE,
                                pointerEvents: i === active ? "auto" : "none",
                            }}
                        >
                            <MarketingBanner
                                title={it.title}
                                image={it.image}
                                countdown={it.countdown}
                                expiryISO={it.expiryISO}
                                onClick={() => router.push(`/customer/marketing/${it.id}`)}
                            />
                        </div>
                    ))}
                </div>

                {loop && (
                    <div className="flex h-[6px] w-full items-center justify-center gap-2">
                        {items.map((it, i) => (
                            <span
                                key={it.id}
                                aria-hidden
                                className={
                                    i === active
                                        ? "h-[6px] w-6 rounded-full bg-[var(--brand-primary)]"
                                        : "size-[6px] rounded-full bg-[#e4e7ec]"
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
