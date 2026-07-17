"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — DiscoverCard (compact browse card for the discover rails)
// ─────────────────────────────────────────────────────────────────────────────
//
// A tappable teaser used by "Trending today" (classes) and "Recommended
// services" (appointments): a 188×120 cover, a title, and a subtitle. Trending
// cards pass an `avatar` so the instructor shows next to the name; Recommended
// cards leave it off and show a plain subtitle. Purely presentational.

export function DiscoverCard({
    coverImage,
    coverColor,
    title,
    subtitle,
    avatar,
    onClick,
}: {
    coverImage?: string;
    coverColor: string;
    title: string;
    subtitle: string;
    /** Instructor avatar shown before the subtitle (Trending only). */
    avatar?: { imageUrl?: string; initials?: string };
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} className="flex w-[188px] shrink-0 flex-col gap-3 text-left">
            <div className="relative h-[120px] w-[188px] overflow-hidden rounded-2xl bg-[#f9fafb]">
                {coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={coverImage} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                    <div className="absolute inset-0" style={{ backgroundColor: coverColor }} />
                )}
            </div>
            <div className="flex w-full flex-col gap-1">
                <p className="truncate text-base font-semibold leading-6 text-[var(--brand-text)]">{title}</p>
                {avatar ? (
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                            {avatar.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={avatar.imageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                            ) : (
                                <span className="text-[8px] font-semibold leading-none text-[#667085]">{avatar.initials}</span>
                            )}
                        </span>
                        <span className="truncate text-sm font-normal leading-5 text-[#475467]">{subtitle}</span>
                    </div>
                ) : (
                    <p className="truncate text-sm font-normal leading-5 text-[#475467]">{subtitle}</p>
                )}
            </div>
        </button>
    );
}
