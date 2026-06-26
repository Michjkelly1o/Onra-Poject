// ─────────────────────────────────────────────────────────────────────────────
// Customer — InstructorCard (shared) — PRD 13 §6 (Instructor Overview)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3675-39975 ("Instructor"). A 240px bordered
// white card: instructor name + active-class count on the left, a 100px cover
// photo flush to the right edge (corners clipped by the card radius). Built from
// scratch for the member surface; reuses the existing instructor data.

export interface InstructorCardProps {
    name: string;
    /** Number of upcoming classes at the active branch. */
    activeClasses: number;
    imageUrl?: string;
    /** Fallback avatar when there is no photo. */
    initials?: string;
    color?: string;
    onClick?: () => void;
}

export function InstructorCard({ name, activeClasses, imageUrl, initials, onClick }: InstructorCardProps) {
    const label = `${activeClasses} active class${activeClasses === 1 ? "" : "es"}`;
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
            className={`flex h-[100px] w-[240px] shrink-0 items-center gap-4 overflow-hidden rounded-xl border border-[#e4e7ec] bg-white pl-4 ${interactive ? "cursor-pointer outline-none" : ""}`}
        >
            <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-sm font-semibold leading-5 text-[#101828]">{name}</p>
                <p className="truncate text-xs font-normal leading-[18px] text-[#667085]">{label}</p>
            </div>

            <div className="relative flex w-[100px] shrink-0 items-center justify-center self-stretch overflow-hidden bg-[#f2f4f7]">
                {imageUrl ? (
                    // The instructor assets are circular avatars (transparent corners); scaling
                    // up crops the circle so the photo fills the box as a full rectangle.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="absolute inset-0 size-full scale-[1.5] object-cover" />
                ) : (
                    // No photo → neutral placeholder avatar (Figma 4214-40762): grey
                    // bg + grey initials, never the brand colour.
                    <span className="text-2xl font-semibold text-[#667085]">{initials}</span>
                )}
            </div>
        </div>
    );
}
