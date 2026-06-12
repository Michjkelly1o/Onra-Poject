import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: "text-foreground",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }

// ─── Onra DS pill badges ──────────────────────────────────────────────────────

/**
 * Plan badge — used wherever a customer's plan (Membership or Credit package) is shown.
 * Colors lifted directly from the Onra DS Figma file:
 *  - Membership      → indigo-50 / indigo-200 / indigo-700
 *  - Credit package  → gray-50 / gray-200 / gray-700
 */
export function PlanBadge({ kind, className }: {
    kind: "membership" | "package";
    className?: string;
}) {
    const styles = kind === "membership"
        ? "bg-[#eef4ff] border-[#c7d7fe] text-[#3538cd]"
        : "bg-[#f9fafb] border-[#e4e7ec] text-[#344054]";
    const label = kind === "membership" ? "Membership" : "Credit package";
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-medium leading-[18px] whitespace-nowrap",
            styles, className,
        )}>
            {label}
        </span>
    );
}

/** Inferred from a free-text plan name (e.g. "Monthly Unlimited" → membership). */
export function planKindFromName(planName: string): "membership" | "package" {
    return /pack|credit/i.test(planName) ? "package" : "membership";
}

/**
 * "No plan" badge — used for newly-created customers who haven't been assigned a
 * membership or credit package yet. Gray pill with a dashed outline.
 */
export function NoPlanBadge({ className }: { className?: string }) {
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border border-dashed border-[#d0d5dd] bg-[#f9fafb] text-[12px] font-medium leading-[18px] text-[#667085] whitespace-nowrap",
            className,
        )}>
            No plan
        </span>
    );
}

/**
 * Booking-status badge — both variants use the red error palette per the Figma cancelled-badge spec.
 *  - "no-charge" → cancelled with enough notice (≥24h before class) — full refund / no penalty
 *  - "late"      → cancelled inside the 24h window — credit forfeited
 *  - "class"     → CLASS itself was cancelled (not the customer). Plain
 *                  "Cancelled" label. Used on the Booked tab when the
 *                  parent class.status === "Cancelled" — the booking row
 *                  preserves its original "booked" status so it stays
 *                  on the Booked tab, and this badge visually flips it
 *                  to cancelled. See store.ts cancelClassSchedule for
 *                  the tab-preservation model.
 */
export function BookingStatusBadge({ kind, className }: {
    kind: "no-charge" | "late" | "class";
    className?: string;
}) {
    const label = kind === "no-charge" ? "Cancelled (no charge)"
        : kind === "late" ? "Cancelled (late)"
        : "Cancelled";
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-medium leading-[18px] whitespace-nowrap",
            "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
            className,
        )}>
            {label}
        </span>
    );
}

/**
 * Attendance badges for ongoing/completed classes.
 *  - PresentBadge → green success palette
 *  - NoShowBadge  → red error palette (treated as a forfeit, same family as Cancelled)
 */
export function PresentBadge({ className }: { className?: string }) {
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-medium leading-[18px] whitespace-nowrap",
            "bg-[#ecfdf3] border-[#abefc6] text-[#067647]",
            className,
        )}>
            Present
        </span>
    );
}

export function NoShowBadge({ className }: { className?: string }) {
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full border text-[12px] font-medium leading-[18px] whitespace-nowrap",
            "bg-[#fef3f2] border-[#fecdca] text-[#b42318]",
            className,
        )}>
            No-show
        </span>
    );
}

/** Decide which cancelled-badge variant to use for a booking based on cancellation time vs class start. */
export function cancellationBadgeKind(args: {
    cancelledAt?: string | null;
    classDateISO: string;   // YYYY-MM-DD
    classStartTime: string; // HH:MM (24h)
}): "no-charge" | "late" {
    const classStart = new Date(`${args.classDateISO}T${args.classStartTime}:00`);
    const reference = args.cancelledAt ? new Date(args.cancelledAt) : new Date();
    const hoursAhead = (classStart.getTime() - reference.getTime()) / (1000 * 60 * 60);
    return hoursAhead >= 24 ? "no-charge" : "late";
}
