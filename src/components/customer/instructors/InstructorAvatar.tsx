"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — InstructorAvatar (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// The instructor avatar used across every filter surface (Search + Bookings
// pills, the "See all" selection screens). Photo when available; otherwise a
// neutral grey placeholder with the initials — never a coloured fallback, so the
// placeholder looks identical everywhere.

export function InstructorAvatar({
    imageUrl,
    initials,
    size = 20,
}: {
    imageUrl?: string;
    initials: string;
    size?: number;
}) {
    return (
        <span
            className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]"
            style={{ width: size, height: size }}
        >
            {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
            ) : (
                <span className="font-semibold leading-none text-[#667085]" style={{ fontSize: size >= 28 ? 12 : 9 }}>
                    {initials}
                </span>
            )}
        </span>
    );
}
