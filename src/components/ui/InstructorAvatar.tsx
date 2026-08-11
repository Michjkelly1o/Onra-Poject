import { cn } from "@/lib/utils";

/** Instructor avatar — the instructor's real photo when `imageUrl` is set,
 *  otherwise a circle tinted with their colour showing their initials. Shared
 *  across the schedule grid / attendee card / embed card / schedule form so an
 *  instructor reads the same everywhere (client 2026-08-08). */
export function InstructorAvatar({ imageUrl, initials, color = "#667085", size = 20, className }: {
    imageUrl?: string;
    initials: string;
    color?: string;
    size?: number;
    className?: string;
}) {
    if (imageUrl) {
        return (
            // eslint-disable-next-line @next/next/no-img-element
            <img
                src={imageUrl}
                alt=""
                loading="lazy"
                style={{ width: size, height: size }}
                className={cn("rounded-full object-cover shrink-0 border border-black/[0.04]", className)}
            />
        );
    }
    return (
        <span
            aria-hidden
            style={{ width: size, height: size, backgroundColor: color, fontSize: Math.round(size * 0.42) }}
            className={cn("rounded-full flex items-center justify-center shrink-0 text-white font-bold leading-none", className)}
        >
            {initials}
        </span>
    );
}
