// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Upcoming Class section (PRD 13 §6.5)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-41143 ("Upcoming Bookings"). Section
// title + the shared <BookingCard>, rendered IDENTICALLY to the Bookings module
// (same BookingListItemVM + BOOKING_STATUS mapping) so the two never diverge.

import { BookingCard } from "@/components/customer/bookings/BookingCard";
import { BOOKING_STATUS, type BookingListItemVM } from "@/lib/customer/bookings-data";

export function UpcomingBookings({
    bookings,
    onSelect,
}: {
    bookings: BookingListItemVM[];
    onSelect: (bookingId: string) => void;
}) {
    return (
        <section className="flex w-full flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Upcoming bookings</h2>

            {bookings.length === 0 ? (
                <div className="flex flex-col items-start gap-1 rounded-2xl border border-[var(--colors-border-secondary,#e4e7ec)] bg-white px-4 py-5">
                    <p className="text-sm font-medium text-[#344054]">No upcoming classes</p>
                    <p className="text-xs text-[#667085]">Find a class to book and it’ll show up here.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {bookings.map((b) => (
                        <BookingCard
                            key={b.bookingId}
                            name={b.name}
                            date={b.dateShort}
                            time={b.time}
                            location={b.location}
                            status={BOOKING_STATUS[b.viewStatus].card}
                            mutedCover={BOOKING_STATUS[b.viewStatus].mutedCover}
                            image={b.coverImage}
                            imageColor={b.coverColor}
                            onClick={() => onSelect(b.bookingId)}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
