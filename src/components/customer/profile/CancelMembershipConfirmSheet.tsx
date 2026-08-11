"use client";

// Customer — cancel-membership confirmation bottom sheet.
//
// Shown AFTER the member picks a cancellation reason (OptionSheet). Discloses
// the exact end date and the "keep full access until then" promise before the
// cancellation is committed. Membership cancellation stops renewal only — no
// money moves, no proration, no partial refund (see cancelCustomerPlan with
// mode="period_end").

import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

export function CancelMembershipConfirmSheet({ open, onClose, endDateLabel, onConfirm }: {
    open: boolean;
    onClose: () => void;
    /** Formatted paid-through date, e.g. "24 Aug". */
    endDateLabel: string;
    onConfirm: () => void;
}) {
    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title="Cancel membership" onClose={onClose} />
            <div className="flex flex-col gap-2 pt-1">
                <p className="text-base leading-6 text-[var(--brand-text)]">
                    Your membership ends {endDateLabel}. You keep full access until then.
                </p>
                <p className="text-sm leading-5 text-[var(--colors-text-tertiary)]">
                    Cancelling stops your renewal — no further payments are taken, and there is no partial refund.
                </p>
            </div>
            <div className="flex flex-col gap-3 pt-5">
                <Button
                    variant="secondary"
                    size="xl"
                    className="w-full rounded-full border-[#fda29b] bg-[#fef3f2] font-semibold text-[#b42318] hover:bg-[#fee4e2] hover:text-[#912018] active:bg-[#fee4e2] active:text-[#912018]"
                    onClick={() => { onConfirm(); onClose(); }}
                >
                    Cancel membership
                </Button>
                <Button variant="secondary-gray" size="xl" className="w-full rounded-full" onClick={onClose}>
                    Keep membership
                </Button>
            </div>
        </CustomerSheet>
    );
}
