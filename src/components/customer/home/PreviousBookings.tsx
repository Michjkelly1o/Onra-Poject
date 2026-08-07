// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Previous Booking section
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the Upcoming Bookings section: a section title + the shared
// <BookingCard>, showing the SINGLE most-recent past booking regardless of type
// (class, private, or recovery appointment). When the booking is attended and
// not yet rated, a full-width "Rate class" button (sm) sits under the card. The
// empty state reuses the Upcoming empty-state layout with the past-booking icon.

import { ClockRewind } from "@untitledui/icons";
import { BookingCard } from "@/components/customer/bookings/BookingCard";
import { Button } from "@/components/ui/button";
import type { PastCardVM } from "@/lib/customer/bookings-data";

/** Empty state — same card layout as EmptyUpcoming, past-booking icon + copy. */
function EmptyPrevious() {
    return (
        <div className="flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-2xl border border-[#e4e7ec] bg-white px-4 pb-4 pt-3 text-center">
            <span
                className="flex size-8 items-center justify-center rounded-lg border-[2.65px] border-white/10 bg-[#e9fff3]"
                style={{
                    boxShadow:
                        "0px 3.49px 3.49px 0px rgba(0,0,0,0.04), 0px 3.49px 20.94px 0px rgba(224,248,164,0.12), inset 4.5px 4.5px 6px 0px rgba(255,255,255,0.2)",
                }}
            >
                <ClockRewind className="size-4 text-[var(--brand-primary)]" aria-hidden />
            </span>
            <p className="text-sm font-semibold leading-5 text-[#101828]">No previous bookings yet</p>
        </div>
    );
}

export function PreviousBookings({
    items,
    onSelect,
    onRate,
}: {
    items: PastCardVM[];
    onSelect: (href: string) => void;
    onRate: (href: string) => void;
}) {
    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Past bookings</h2>

            {items.length === 0 ? (
                <EmptyPrevious />
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
                            footer={
                                b.canRate ? (
                                    // Same primary CTA as Booking Details, at sm size, INSIDE the card.
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        className="w-full rounded-full"
                                        onClick={() => onRate(b.rateHref)}
                                    >
                                        Rate class
                                    </Button>
                                ) : undefined
                            }
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
