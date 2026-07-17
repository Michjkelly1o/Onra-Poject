"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — CancelConfirmSheet — bottom-sheet cancel confirmation
// ─────────────────────────────────────────────────────────────────────────────
//
// The single-step confirmation for cancelling / leaving a class or appointment.
// A centered red icon, title, one-line outcome, an optional green "refunded"
// note (on-time), and a single destructive "Yes, cancel …" button. Dismiss by
// tapping the backdrop / swiping down. Replaces the old full cancellation page.

import { Lightbulb02, SlashCircle01 } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { Button } from "@/components/ui/button";

export function CancelConfirmSheet({
    open,
    onClose,
    title,
    description,
    refundNote,
    confirmLabel,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    description: string;
    /** Green info box (on-time cancel → credit / amount refunded). */
    refundNote?: string;
    confirmLabel: string;
    onConfirm: () => void;
}) {
    return (
        <CustomerSheet open={open} onClose={onClose}>
            <div className="flex flex-col items-center gap-4 px-2 pb-2 pt-1 text-center">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#fef3f2]">
                    <SlashCircle01 className="size-6 text-[#d92d20]" aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                    <p className="text-xl font-semibold leading-[30px] text-[var(--brand-text)]">{title}</p>
                    <p className="text-sm font-normal leading-5 text-[#475467]">{description}</p>
                </div>
                {refundNote && (
                    <div className="flex w-full items-center gap-2 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-3">
                        <Lightbulb02 className="size-5 shrink-0 text-[#475467]" aria-hidden />
                        <p className="flex-1 text-left text-sm font-normal leading-5 text-[#475467]">{refundNote}</p>
                    </div>
                )}
                <Button
                    variant="secondary"
                    size="xl"
                    className="mt-1 w-full rounded-full border-[#fda29b] bg-[#fef3f2] text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]"
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmLabel}
                </Button>
            </div>
        </CustomerSheet>
    );
}
