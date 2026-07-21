"use client";

// Customer — Freeze plan bottom sheet (v2, client 2026-07-20).
//
// Policy-driven: freeze reasons, the minimum + maximum duration, per-reason
// exceptions, the freeze fee, and the billing-behavior disclosure line all
// come from the studio-wide freeze policy (Settings → Customer → Freeze
// policy). See new-prd/freeze-policy-v2-implementation-plan.md § Phase 2.
//
// What changed vs v1:
//   • Duration+unit inputs → start-date + end-date fields (opens the shared
//     `DatePickerSheet` on top). Days computed from the range, so the sheet
//     still submits a whole-day count into the store (no schema churn).
//   • Client-side validation gates the Confirm button — start ≥ today,
//     end ≥ start, duration ≥ min (policy), duration ≤ max (policy) UNLESS
//     the picked reason has `ignoresMaxDuration` (Q7).
//   • Reason picker gates on `require_reason` (renamed field, v2).
//   • Billing behavior disclosure — shows what happens at next charge based
//     on the studio's `billing_behavior` (Pause vs Stays on schedule). Pure
//     read from `previewFreezeBilling` in `@/lib/customer/freeze-eligibility`.
//   • Approval-mode CTA — when the studio sets Who can freeze = "Members
//     request, admins approve", the primary button reads "Request freeze".
//     (Phase 5 wires the pending-request status — for now Confirm still
//     performs the freeze so the demo is testable end-to-end.)

import { useEffect, useState } from "react";
import { Calendar } from "@untitledui/icons";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { DatePickerSheet } from "@/components/customer/shell/DatePickerSheet";
import { Button } from "@/components/ui/button";
import type { CustomerPlan, FreezePolicy } from "@/lib/store";
import { REAL_TODAY_ISO, addDaysISO, daysBetweenISO } from "@/lib/customer/dates";
import { shortDate } from "@/lib/customer/profile-format";
import { previewFreezeBilling } from "@/lib/customer/freeze-eligibility";

const LABEL = "text-sm font-medium leading-5 text-[#344054]";
const DATE_FIELD =
    "flex w-full items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50";

const UNIT_DAYS = { days: 1, weeks: 7, months: 30 } as const;

/** Convert a policy min/max value+unit pair to whole days. */
function inDays(value: number, unit: "days" | "weeks" | "months"): number {
    return value * UNIT_DAYS[unit];
}

/** Absolute hard cap so a bypassed reason (ignoresMaxDuration) can't submit
 *  an absurd 10-year freeze. Per plan doc Q7. */
const HARD_MAX_DAYS = 365;

/** Reason row option — the sheet passes labels; the caller resolves each
 *  label back into its exceptions patch before submit. */
export interface FreezeReasonOption {
    /** Label the member picks. */
    label: string;
    /** When true, the max-duration cap does NOT apply to this pick (Q7). */
    ignoresMaxDuration?: boolean;
}

export function FreezePlanSheet({
    open,
    onClose,
    plan,
    policy,
    planNoun,
    reasons,
    requireReason,
    /** Whether the CTA should read "Request freeze" (Members request, admins
     *  approve) or the default "Confirm" (Members & admins). */
    approvalMode = false,
    fee,
    onConfirm,
}: {
    open: boolean;
    onClose: () => void;
    /** The plan being frozen — used to compute the billing disclosure. */
    plan: CustomerPlan | null;
    /** Studio-wide policy — drives min/max duration + billing behavior. */
    policy: FreezePolicy;
    planNoun: string;
    /** Reasons the member may pick — from the policy's enabled reasons. */
    reasons: FreezeReasonOption[];
    /** Whether a reason must be chosen (policy "Require reason"). */
    requireReason: boolean;
    approvalMode?: boolean;
    /** Freeze fee to disclose + charge, or null for no fee. */
    fee: { amount: number; type: "one_time" | "recurring" } | null;
    onConfirm: (input: {
        startISO: string;
        endISO: string;
        days: number;
        reasonLabel: string;
    }) => void;
}) {
    // Policy-driven caps. `minDays` is always enforced; `maxDays` is enforced
    // unless the picked reason has `ignoresMaxDuration`.
    const minDays = Math.max(1, inDays(policy.min_duration_value, policy.min_duration_unit));
    const maxDays = policy.max_duration_enabled
        ? inDays(policy.max_duration_value, policy.max_duration_unit)
        : null;

    // Sensible default span: the smaller of 30d or the policy cap, floored
    // at the policy's min. Puts the member on a valid range at open time.
    const defaultDays = Math.max(minDays, Math.min(30, maxDays ?? 30));
    const [startISO, setStartISO] = useState<string>(REAL_TODAY_ISO);
    const [endISO, setEndISO] = useState<string>(addDaysISO(REAL_TODAY_ISO, defaultDays));
    const [reason, setReason] = useState<FreezeReasonOption | null>(null);
    const [pickerField, setPickerField] = useState<"start" | "end" | null>(null);

    useEffect(() => {
        if (!open) return;
        setStartISO(REAL_TODAY_ISO);
        setEndISO(addDaysISO(REAL_TODAY_ISO, defaultDays));
        setReason(null);
        setPickerField(null);
    }, [open, defaultDays]);

    const days = Math.max(0, daysBetweenISO(startISO, endISO));
    const bypassMaxCap = !!reason?.ignoresMaxDuration;
    const effectiveMax = bypassMaxCap ? HARD_MAX_DAYS : (maxDays ?? HARD_MAX_DAYS);

    const startInPast = startISO < REAL_TODAY_ISO;
    const endBeforeStart = endISO < startISO;
    const underMin = days < minDays;
    const overMax = days > effectiveMax;
    const showReasons = requireReason && reasons.length > 0;
    const missingReason = showReasons && !reason;
    const valid = !startInPast && !endBeforeStart && !underMin && !overMax && !missingReason;

    // Live billing preview — recomputed as the member changes dates / policy.
    const preview = plan ? previewFreezeBilling(plan, policy, startISO, endISO) : null;

    // Human error string driving the helper line under the date fields.
    const durationError = startInPast
        ? "Start date can't be in the past."
        : endBeforeStart
          ? "End date must be after the start date."
          : underMin
            ? `Minimum freeze: ${minDays} day${minDays === 1 ? "" : "s"}.`
            : overMax && !bypassMaxCap
              ? `Maximum freeze: ${maxDays} day${maxDays === 1 ? "" : "s"}.`
              : overMax && bypassMaxCap
                ? `Freeze can't exceed ${HARD_MAX_DAYS} days.`
                : null;

    // Policy-cap helper (shown when there's no error, i.e. duration is valid).
    const capHint =
        maxDays != null && !bypassMaxCap
            ? `Maximum freeze: ${maxDays} day${maxDays === 1 ? "" : "s"}.`
            : bypassMaxCap
              ? `This reason skips the ${maxDays ?? HARD_MAX_DAYS}-day cap.`
              : null;

    // Disclosure line text — driven by the studio's billing behavior. Only
    // rendered once the member has picked a valid range.
    const disclosure = preview && valid ? billingDisclosure(preview) : null;

    return (
        <>
            <CustomerSheet open={open} onClose={onClose}>
                <SheetToolbar title={`Freeze ${planNoun}`} onClose={onClose} />

                {/* Date range — two fields open the shared calendar sheet. */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>Start date</span>
                        <button type="button" onClick={() => setPickerField("start")} className={DATE_FIELD}>
                            <Calendar className="size-4 shrink-0 text-[#667085]" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-left text-[var(--brand-text)]">
                                {shortDate(startISO)}
                            </span>
                        </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>End date</span>
                        <button type="button" onClick={() => setPickerField("end")} className={DATE_FIELD}>
                            <Calendar className="size-4 shrink-0 text-[#667085]" aria-hidden />
                            <span className="min-w-0 flex-1 truncate text-left text-[var(--brand-text)]">
                                {shortDate(endISO)}
                            </span>
                        </button>
                    </div>
                </div>

                <p
                    className={`mt-2 text-sm leading-5 ${
                        durationError ? "text-[#d92d20]" : "text-[#667085]"
                    }`}
                >
                    {durationError ?? (
                        <>
                            {days} day{days === 1 ? "" : "s"} freeze
                            {capHint ? ` — ${capHint}` : ""}
                        </>
                    )}
                </p>

                {showReasons && (
                    <>
                        <p className="mb-2 mt-4 text-sm font-medium leading-5 text-[#344054]">Freeze reason</p>
                        <div className="flex flex-col gap-3">
                            {reasons.map((r) => (
                                <button
                                    key={r.label}
                                    type="button"
                                    onClick={() => setReason(r)}
                                    className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-left transition-colors ${
                                        reason?.label === r.label
                                            ? "border-2 border-[var(--brand-primary)] bg-[#fbfdfc]"
                                            : "border border-[#e4e7ec]"
                                    }`}
                                >
                                    <span className="flex-1 text-base leading-6 text-[var(--brand-text)]">{r.label}</span>
                                    <RadioDot checked={reason?.label === r.label} />
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Billing disclosure — always shown once the range is valid so
                    the member sees what will happen at next charge before they
                    confirm. Neutral background, no alarming red or amber. */}
                {disclosure && (
                    <div className="mt-4 rounded-xl border border-[#eaecf0] bg-[#f9fafb] px-4 py-3">
                        <p className="text-sm font-medium leading-5 text-[#344054]">Billing during freeze</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">{disclosure}</p>
                    </div>
                )}

                {fee && fee.amount > 0 && (
                    <div className="mt-4 rounded-xl border border-[#f9dbaf] bg-[#fffaf5] px-4 py-3">
                        <p className="text-sm leading-5 text-[#b93815]">
                            A {fee.type === "recurring" ? "recurring" : "one-time"} freeze fee of{" "}
                            <span className="font-semibold">AED {fee.amount}</span> will be charged when you confirm.
                        </p>
                    </div>
                )}

                <Button
                    variant="primary"
                    size="xl"
                    disabled={!valid}
                    className="mt-5 w-full rounded-full"
                    onClick={() => {
                        if (!valid) return;
                        onConfirm({
                            startISO,
                            endISO,
                            days,
                            reasonLabel: reason?.label ?? "",
                        });
                        onClose();
                    }}
                >
                    {approvalMode ? "Request freeze" : "Confirm"}
                </Button>
            </CustomerSheet>

            {/* Nested calendar — proven stacking pattern from BookingsFilterModal.
                One field at a time, single-day picks. `minISO` locks each field
                to a legal day: Start ≥ today, End ≥ Start (no need to encode
                the min-duration here — the parent enforces it via `underMin`). */}
            <DatePickerSheet
                open={pickerField !== null}
                onClose={() => setPickerField(null)}
                title={pickerField === "start" ? "Freeze start date" : "Freeze end date"}
                value={pickerField === "start" ? startISO : endISO}
                onSelect={(iso) => {
                    if (pickerField === "start") {
                        setStartISO(iso);
                        // If end drifts before the new start, push end forward
                        // so the range stays legal (member can adjust after).
                        if (endISO < iso) setEndISO(addDaysISO(iso, defaultDays));
                    } else if (pickerField === "end") {
                        setEndISO(iso);
                    }
                }}
                defaultISO={pickerField === "start" ? startISO : endISO}
                minISO={pickerField === "start" ? REAL_TODAY_ISO : startISO}
            />
        </>
    );
}

// ── Disclosure copy ─────────────────────────────────────────────────────────
//
// Kept in this file (not in the eligibility helper) because the wording is UI
// copy — the helper returns numbers, this maps them to a member-friendly
// sentence. Two branches so the tone matches the client's screenshot examples.

function billingDisclosure(preview: ReturnType<typeof previewFreezeBilling>): string {
    if (preview.behavior === "pause") {
        return `Your next charge shifts from ${shortDate(preview.originalNextChargeISO)} to ${shortDate(preview.newNextChargeISO)}.`;
    }
    // Option B — stay on schedule, prorate down.
    if (preview.newChargeAmountAed == null) {
        return `Your next charge on ${shortDate(preview.originalNextChargeISO)} stays on schedule.`;
    }
    if (preview.savingsAed && preview.savingsAed > 0) {
        return `Your next charge on ${shortDate(preview.originalNextChargeISO)} is reduced to AED ${preview.newChargeAmountAed} (saving AED ${preview.savingsAed}).`;
    }
    return `Your next charge on ${shortDate(preview.originalNextChargeISO)} stays at AED ${preview.newChargeAmountAed}.`;
}
