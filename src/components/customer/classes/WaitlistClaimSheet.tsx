"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — WaitlistClaimSheet — "Notify to accept" spot offer
// ─────────────────────────────────────────────────────────────────────────────
//
// Shown when a booked member cancels, the studio's Booking Rules are set to
// "Notify to accept", and THIS member is next in line. They either take the spot
// or pass it straight to the next person — the same two outcomes the admin panel
// describes ("#1 must claim it, else passes to #2").
//
// Chrome matches <CancelConfirmSheet>: centred icon, title, one-line outcome, a
// primary action and a quiet secondary one.

import { AlertCircle, CalendarCheck02 } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { Button } from "@/components/ui/button";

export function WaitlistClaimSheet({
    open,
    onClose,
    className,
    when,
    expiresLabel,
    onClaim,
    onDecline,
    /** Phase 3 — when set, the sheet disables the Claim button and shows a
     *  red rejection banner. Used by the freeze guard: a frozen membership
     *  can't claim a waitlist spot. Copy is fed by the caller so the same
     *  sheet can be reused for other block reasons later. */
    blockedReason,
}: {
    open: boolean;
    onClose: () => void;
    /** Class name, e.g. "Reformer Pilates". */
    className: string;
    /** Human date + time, e.g. "Mon, 20 Jul • 6:00 PM". */
    when: string;
    /** How long is left to claim, e.g. "28 minutes". Omitted when unknown. */
    expiresLabel?: string;
    onClaim: () => void;
    onDecline: () => void;
    blockedReason?: string;
}) {
    return (
        <CustomerSheet open={open} onClose={onClose}>
            <div className="flex flex-col items-center gap-4 px-2 pb-2 pt-1 text-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tertiary)]">
                    <CalendarCheck02 className="size-6 text-[var(--brand-primary)]" aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                    <p className="text-xl font-semibold leading-[30px] text-[var(--brand-text)]">A spot is available 🎉</p>
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        A spot has opened up in {className} on {when}. Claim it to confirm your booking before it&apos;s
                        offered to the next person.
                    </p>
                </div>
                {blockedReason && (
                    <div className="flex w-full items-start gap-2 rounded-xl border border-[#fda29b] bg-[#fffbfa] p-3 text-left">
                        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#d92d20]" aria-hidden />
                        <p className="text-sm font-normal leading-5 text-[#b42318]">{blockedReason}</p>
                    </div>
                )}
                {!blockedReason && expiresLabel && (
                    <div className="flex w-full items-center justify-center rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-3">
                        <p className="text-sm font-normal leading-5 text-[#475467]">Claim within {expiresLabel}</p>
                    </div>
                )}
                <Button
                    variant="primary"
                    size="xl"
                    className="mt-1 w-full rounded-full"
                    disabled={!!blockedReason}
                    onClick={() => {
                        if (blockedReason) return;
                        onClaim();
                        onClose();
                    }}
                >
                    {blockedReason ? "Can't claim" : "Claim spot"}
                </Button>
                <Button
                    variant="secondary"
                    size="xl"
                    className="w-full rounded-full"
                    onClick={() => {
                        onDecline();
                        onClose();
                    }}
                >
                    Decline spot
                </Button>
            </div>
        </CustomerSheet>
    );
}
