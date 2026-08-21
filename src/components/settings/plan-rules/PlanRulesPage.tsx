"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Plan Rules landing (client 2026-08-19)
// ─────────────────────────────────────────────────────────────────────────────
//
// Own settings tab (Operations group, after Booking rules). Two cards moved
// out of the Booking rules page:
//
//   1. Plan cancellation — who-can-cancel + fee + reasons + apply-to summary;
//      Customize opens the PlanCancellationPanel.
//   2. Plan freeze — who-can-freeze + limits + fee + reasons + apply-to
//      summary; Customize opens the FreezePolicyPanel.
//
// The standalone "Members can cancel / freeze their own membership" master
// toggles were retired (client 2026-08-19) — the "Who can cancel / freeze"
// option is the single source of truth for whether the customer sees the
// action (admins_only → hidden on the customer side). Both the panels and
// these summaries show the full configuration unconditionally.

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import type { FreezePolicy } from "@/lib/store";
import { Toast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Edit02 } from "@untitledui/icons";
import { FreezePolicyPanel } from "../FreezePolicyPanel";
import { PlanCancellationPanel } from "../booking-rules/PlanCancellationPanel";

// ─── Display helpers ────────────────────────────────────────────────────────

const WHO_CAN_CANCEL_LABEL: Record<string, string> = {
    members_and_admins: "Customers & admins",
    members_request_admins_approve: "Customers request, admins approve",
    admins_only: "Admins only",
};

const WHO_CAN_FREEZE_LABEL: Record<string, string> = {
    members_and_admins: "Customers & admins",
    members_request_admins_approve: "Customers request, admins approve",
    admins_only: "Admins only",
};

const FREEZE_UNIT_LABEL: Record<FreezePolicy["max_duration_unit"], (n: number) => string> = {
    days:   n => (n === 1 ? "day" : "days"),
    weeks:  n => (n === 1 ? "week" : "weeks"),
    months: n => (n === 1 ? "month" : "months"),
};

export default function PlanRulesPage() {
    const cancellationPolicy = useAppStore(s => s.cancellationPolicy);
    const freezePolicy       = useAppStore(s => s.freezePolicy);

    const [pcOpen, setPcOpen] = useState(false);
    const [fpOpen, setFpOpen] = useState(false);

    // ── Plan-cancellation summary values ──────────────────────────────────
    const cancelWhoValue = WHO_CAN_CANCEL_LABEL[cancellationPolicy.plan_cancel_who ?? "members_and_admins"];
    const cancelFeeValue = cancellationPolicy.plan_cancel_fee_enabled
        ? `AED ${cancellationPolicy.plan_cancel_fee_aed}`
        : "No";
    const cancelReasonsValue = (() => {
        if (!(cancellationPolicy.plan_cancel_require_reason ?? true)) return "Any reason";
        const n = (cancellationPolicy.cancellation_reasons ?? []).filter(r => r.enabled && r.label.trim()).length;
        return `${n} reason${n === 1 ? "" : "s"}`;
    })();
    const cancelApplyToValue = (cancellationPolicy.plan_cancel_apply_to ?? "all") === "all"
        ? "All memberships"
        : `${(cancellationPolicy.plan_cancel_membership_ids ?? []).length} membership${(cancellationPolicy.plan_cancel_membership_ids ?? []).length === 1 ? "" : "s"}`;

    // ── Plan-freeze summary values ────────────────────────────────────────
    const freezeWhoValue = WHO_CAN_FREEZE_LABEL[freezePolicy.who_can_freeze ?? "members_and_admins"];
    const freezeDurationValue = freezePolicy.max_duration_enabled
        ? `${freezePolicy.max_duration_value} ${FREEZE_UNIT_LABEL[freezePolicy.max_duration_unit](freezePolicy.max_duration_value)}`
        : "No limit";
    const freezeFreezesValue = freezePolicy.limit_freezes_enabled
        ? String(freezePolicy.max_freezes)
        : "Unlimited";
    const freezeFeeValue = freezePolicy.fee_enabled
        ? `AED ${freezePolicy.fee_amount_aed} · ${freezePolicy.fee_type === "one_time" ? "One-time" : "Recurring"}`
        : "No";
    const freezeReasonsValue = !freezePolicy.require_reason
        ? "Any reason"
        : (() => {
            const n = freezePolicy.reasons.filter(r => r.enabled && r.label.trim()).length;
            return `${n} reason${n === 1 ? "" : "s"}`;
        })();
    const freezeApplyToValue = freezePolicy.apply_to === "all"
        ? "All memberships"
        : `${freezePolicy.membership_ids.length} membership${freezePolicy.membership_ids.length === 1 ? "" : "s"}`;

    return (
        <div className="flex w-full flex-col gap-4">
            {/* ── Plan cancellation ───────────────────────────────── */}
            <SettingsCard>
                <CardHeader
                    title="Plan cancellation"
                    subtitle="Rules for how customers cancel their memberships from their account."
                    editLabel="Customize"
                    onEdit={() => setPcOpen(true)}
                />
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                    <SummaryField label="Who can cancel"   value={cancelWhoValue} />
                    <SummaryField label="Cancellation fee" value={cancelFeeValue} />
                    <SummaryField label="Allowed reasons"  value={cancelReasonsValue} />
                    <SummaryField label="Apply to"         value={cancelApplyToValue} />
                </div>
            </SettingsCard>

            {/* ── Plan freeze ─────────────────────────────────────── */}
            <SettingsCard>
                <CardHeader
                    title="Plan freeze"
                    subtitle="Rules for how customers pause their memberships from their account."
                    editLabel="Customize"
                    onEdit={() => setFpOpen(true)}
                />
                <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                    <SummaryField label="Who can freeze"          value={freezeWhoValue} />
                    <SummaryField label="Maximum freeze duration" value={freezeDurationValue} />
                    <SummaryField label="Freezes per membership"  value={freezeFreezesValue} />
                    <SummaryField label="Freeze fee"              value={freezeFeeValue} />
                    <SummaryField label="Allowed reasons"         value={freezeReasonsValue} />
                    <SummaryField label="Apply to"                value={freezeApplyToValue} />
                </div>
            </SettingsCard>

            {/* Side panels */}
            <PlanCancellationPanel open={pcOpen} onClose={() => setPcOpen(false)} />
            <FreezePolicyPanel     open={fpOpen} onClose={() => setFpOpen(false)} />

            <Toast />
        </div>
    );
}

// ─── Small reusable helpers (mirror BookingRulesPage) ────────────────────────

function SettingsCard({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {children}
        </div>
    );
}

function CardHeader({ title, subtitle, editLabel, onEdit }: {
    title: string; subtitle: string; editLabel: string; onEdit: () => void;
}) {
    return (
        <div className="flex items-start gap-4">
            <div className="flex-1 flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{title}</p>
                <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{subtitle}</p>
            </div>
            <Button
                variant="secondary-gray" size="md"
                leftIcon={<Edit02 className="w-4 h-4" />}
                onClick={onEdit}
            >
                {editLabel}
            </Button>
        </div>
    );
}

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[var(--colors-text-quaternary)]">{label}</p>
            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{value}</p>
        </div>
    );
}
