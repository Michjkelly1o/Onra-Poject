// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Upcoming Booking section (PRD 13 §6.5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-41143 ("Upcoming Bookings"). Section
// title + the shared <BookingCard>, rendered IDENTICALLY to the Bookings module.
// Shows the SINGLE next upcoming booking regardless of type (class, private, or
// recovery appointment). When there are none, the Figma empty state (node
// 4567-119566) renders at the SAME height as a populated card so the layout never
// shifts.

"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "@untitledui/icons";
import { BookingCard } from "@/components/customer/bookings/BookingCard";
import { Button } from "@/components/ui/button";
import type { UpcomingCardVM } from "@/lib/customer/bookings-data";

/** Figma "NEW Booking card" empty state (4567-119566) — a bordered card with a
 *  green calendar featured-icon tile + title + supporting text, centered. Fixed
 *  min-height matches a populated <BookingCard> so toggling doesn't shift the page. */
function EmptyUpcoming() {
    const router = useRouter();
    return (
        <div className="flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#e4e7ec] bg-white px-4 pb-4 pt-3 text-center">
            {/* Featured icon — DS skeuomorphic tile (secondary/50 wash + calendar) */}
            <span
                className="flex size-8 items-center justify-center rounded-lg border-[2.65px] border-white/10 bg-[#eff6f3]"
                style={{
                    boxShadow:
                        "0px 3.49px 3.49px 0px rgba(0,0,0,0.04), 0px 3.49px 20.94px 0px rgba(224,248,164,0.12), inset 4.5px 4.5px 6px 0px rgba(255,255,255,0.2)",
                }}
            >
                <Calendar className="size-4 text-[var(--brand-primary)]" aria-hidden />
            </span>
            <p className="text-sm font-semibold leading-5 text-[#101828] font-heading">Ready for your next session?</p>
            {/* Same primary CTA (sm) as the "Rate class" button in Past bookings. */}
            <Button
                variant="primary"
                size="sm"
                className="w-full rounded-full"
                onClick={() => router.push("/customer/search")}
            >
                Browse schedule
            </Button>
        </div>
    );
}

export function UpcomingBookings({
    items,
    onSelect,
}: {
    items: UpcomingCardVM[];
    onSelect: (href: string) => void;
}) {
    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Upcoming bookings</h2>

            {items.length === 0 ? (
                <EmptyUpcoming />
            ) : (
                <div className="flex flex-col gap-3">
                    {items.map((b) => (
                        <BookingCard
                            key={b.key}
                            name={b.name}
                            date={b.dateShort}
                            time={b.time}
                            location={b.location}
                            status={b.status}
                            mutedCover={b.mutedCover}
                            image={b.coverImage}
                            imageColor={b.coverColor}
                            onClick={() => onSelect(b.href)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
