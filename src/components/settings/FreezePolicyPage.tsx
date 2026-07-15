"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Freeze Policy landing (Settings → Customer → Freeze policy)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single summary card + "Customize" button that opens the FreezePolicyPanel
// side panel (same pattern as Booking Rules). Studio-wide singleton — client
// Jul 2026 flipped away from the earlier per-branch model. Governs the
// CUSTOMER self-service membership-freeze flow; admin freeze/unfreeze is a
// full override and ignores it.

import { useState } from "react";
import { Edit02 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import type { FreezePolicy } from "@/lib/store";
import { FreezePolicyPanel } from "./FreezePolicyPanel";

const UNIT_LABEL: Record<FreezePolicy["max_duration_unit"], (n: number) => string> = {
    days:   n => (n === 1 ? "day" : "days"),
    weeks:  n => (n === 1 ? "week" : "weeks"),
    months: n => (n === 1 ? "month" : "months"),
};

export default function FreezePolicyPage() {
    const policy = useAppStore(s => s.freezePolicy);
    const [panelOpen, setPanelOpen] = useState(false);

    const durationValue = policy.max_duration_enabled
        ? `${policy.max_duration_value} ${UNIT_LABEL[policy.max_duration_unit](policy.max_duration_value)}`
        : "No limit";
    const freezesValue = policy.limit_freezes_enabled ? String(policy.max_freezes) : "Unlimited";
    const feeValue = policy.fee_enabled
        ? `AED ${policy.fee_amount_aed} · ${policy.fee_type === "one_time" ? "One-time" : "Recurring"}`
        : "No";
    const reasonsValue = !policy.allow_exceptions
        ? "Any reason"
        : (() => {
            const n = policy.reasons.filter(r => r.enabled && r.label.trim()).length;
            return `${n} reason${n === 1 ? "" : "s"}`;
        })();
    const applyToValue = policy.apply_to === "all"
        ? "All memberships"
        : `${policy.membership_ids.length} membership${policy.membership_ids.length === 1 ? "" : "s"}`;

    return (
        <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* Summary card */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex items-start gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Freeze policy</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Rules for how members pause their memberships from their account.
                        </p>
                    </div>
                    <Button variant="secondary-gray" size="md" leftIcon={<Edit02 className="w-4 h-4" />}
                        onClick={() => setPanelOpen(true)}>
                        Customize
                    </Button>
                </div>

                <SummaryField label="Enable freeze policy" value={policy.enabled ? "Yes" : "No"} />

                {policy.enabled && (
                    <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                        <SummaryField label="Maximum freeze duration" value={durationValue} />
                        <SummaryField label="Freezes per membership"  value={freezesValue} />
                        <SummaryField label="Freeze fee"              value={feeValue} />
                        <SummaryField label="Allowed reasons"         value={reasonsValue} />
                        <SummaryField label="Apply to"                value={applyToValue} />
                    </div>
                )}
            </div>

            <FreezePolicyPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
            <Toast />
        </div>
    );
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-semibold text-[#101828]">{value}</p>
        </div>
    );
}
