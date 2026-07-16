"use client";

// Customer — Account Credit info bottom sheet (the "?" helper on the Referral
// page metric + the checkout Redeem row).

import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";

export function AccountCreditInfoSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title="Account credits" onClose={onClose} />
            <p className="pt-1 text-base font-normal leading-6 text-[#475467]">
                Account credits are currency rewards you receive from referrals and can use toward eligible purchases.
            </p>
        </CustomerSheet>
    );
}
