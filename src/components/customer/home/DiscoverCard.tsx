"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — DiscoverCard (compact browse card for the discover rails)
// ─────────────────────────────────────────────────────────────────────────────
//
// A tappable teaser card used by the Home "Trending today" (classes) and
// "Recommended services" (appointments) rails: a 4:3 cover, a title, and a muted
// subtitle. Purely presentational — the caller supplies the tap target so both
// rails can route into the existing Search / class-detail screens.

export function DiscoverCard({
    coverImage,
    coverColor,
    title,
    subtitle,
    onClick,
}: {
    coverImage?: string;
    coverColor: string;
    title: string;
    subtitle: string;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="flex w-[280px] shrink-0 flex-col gap-3 text-left">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[#f9fafb]">
                {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImage} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: coverColor }} />
                )}
            </div>
            <div className="flex flex-col gap-0.5">
                <p className="truncate text-base font-semibold leading-6 text-[#101828]">{title}</p>
                <p className="truncate text-sm font-normal leading-5 text-[#475467]">{subtitle}</p>
            </div>
        </button>
    );
}
