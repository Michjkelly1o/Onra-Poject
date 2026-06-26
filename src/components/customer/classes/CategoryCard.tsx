// ─────────────────────────────────────────────────────────────────────────────
// Customer — CategoryCard (shared) — PRD 13 §6 (Class Categories)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-41166 ("Category"). A beige (#f1f2ed)
// rounded card: category name on the left, an activity photo bleeding to the
// right edge. Reuses the admin Class Categories data (Booking Rules). Admin
// categories carry name + colour; the photo shows only when a category has an
// `image_url`.

export interface CategoryCardProps {
    name: string;
    /** Optional category cover photo (admin `class_categories.image_url`). */
    imageUrl?: string;
    onClick?: () => void;
}

export function CategoryCard({ name, imageUrl, onClick }: CategoryCardProps) {
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
            className={`flex min-h-[88px] items-center justify-between gap-2 overflow-hidden rounded-lg bg-[#f1f2ed] pl-3 ${interactive ? "cursor-pointer outline-none" : ""}`}
        >
            <p className="truncate text-sm font-semibold leading-5 text-[#344054]">{name}</p>

            {imageUrl ? (
                <div className="relative w-[96px] shrink-0 self-stretch overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                </div>
            ) : null}
        </div>
    );
}
