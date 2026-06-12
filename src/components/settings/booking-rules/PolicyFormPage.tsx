"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Cancellation & no-show policy form
//   /settings/booking-rules/policies/new
//   /settings/booking-rules/policies/[id]/edit
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4580:30598 (chrome) + 7228:48682 (cancellation × anytime no
// charge) + 7228:48699 (cancellation × fee if late) + 7228:48717 (no-show
// × no charge) + 7228:48734 (no-show × charge session). Create toast:
// 4580:35831. Edit toast: 4580:35336.
//
// Same chrome as the Customize classes settings page so the two surfaces
// stay visually anchored. Single step "Policy details". The form is one
// of four content variants determined by the (Policy type × Policy
// choice) pair — the conditional inputs (Cancel window, Charge class
// session) only render for the variants that include them.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CurrencyDollarCircle } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/NumericInput";
import { NumberWithUnitInput } from "@/components/ui/NumberWithUnitInput";
import { useAppStore } from "@/lib/store";
import {
    FormHeader, StepSidebar, SectionHeader, Field, TextInput,
} from "@/components/settings/business/StudioProfileFormPage";
import type {
    CancellationPolicy, PolicyType, CancellationChoice, NoShowChoice,
} from "@/lib/store";
import { cn } from "@/lib/utils";

const RETURN_ROUTE = "/admin/settings/booking-rules";

const HOURS_MINUTES = [
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];

export interface PolicyFormPageProps {
    /** Edit mode supplies an existing policy id; new mode omits it. */
    policyId?: string;
}

export function PolicyFormPage({ policyId }: PolicyFormPageProps) {
    const router               = useRouter();
    const policies             = useAppStore(s => s.cancellationPolicies);
    const addPolicy            = useAppStore(s => s.addCancellationPolicy);
    const updatePolicy         = useAppStore(s => s.updateCancellationPolicy);
    const showToast            = useAppStore(s => s.showToast);

    const existing = useMemo(
        () => (policyId ? policies.find(p => p.id === policyId) : undefined),
        [policies, policyId],
    );
    const isEditing = !!existing;

    // ── Draft state ─────────────────────────────────────────────────────────
    const [name,        setName]        = useState<string>(existing?.name ?? "");
    const [type,        setType]        = useState<PolicyType>(existing?.type ?? "cancellation");
    const [cancelChoice, setCancelChoice] = useState<CancellationChoice>(
        existing?.cancellation_choice ?? "anytime_no_charge",
    );
    const [noShowChoice, setNoShowChoice] = useState<NoShowChoice>(
        existing?.no_show_choice ?? "no_charge",
    );
    const [cancelWindowValue, setCancelWindowValue] = useState<number>(
        existing?.cancel_window_value ?? 12,
    );
    const [cancelWindowUnit, setCancelWindowUnit] = useState<"hours" | "minutes">(
        existing?.cancel_window_unit ?? "hours",
    );
    const [chargeSession, setChargeSession] = useState<number>(
        existing?.charge_class_session ?? 1,
    );

    const canSubmit = name.trim().length > 0;

    function handleClose() { router.push(RETURN_ROUTE); }

    function handleSubmit() {
        if (!canSubmit) return;

        const base: CancellationPolicy = {
            id: existing?.id ?? `policy_${Date.now()}`,
            name: name.trim(),
            type,
            created_at: existing?.created_at ?? new Date().toISOString(),
            // Reset all conditional fields, then re-populate per variant.
            cancellation_choice: undefined,
            cancel_window_value: undefined,
            cancel_window_unit: undefined,
            no_show_choice: undefined,
            charge_class_session: undefined,
        };

        if (type === "cancellation") {
            base.cancellation_choice = cancelChoice;
            if (cancelChoice === "fee_if_late") {
                base.cancel_window_value = cancelWindowValue;
                base.cancel_window_unit  = cancelWindowUnit;
            }
        } else {
            base.no_show_choice = noShowChoice;
            if (noShowChoice === "charge_session") {
                base.charge_class_session = chargeSession;
            }
        }

        if (isEditing) {
            updatePolicy(existing!.id, base);
            showToast(
                "Policy updated successfully",
                `"${base.name}" has been saved.`,
                "success", "check",
            );
        } else {
            addPolicy(base);
            const kind = type === "cancellation" ? "cancellation" : "no-show";
            showToast(
                `${kind === "cancellation" ? "Cancellation" : "No-show"} policy created successfully`,
                `"${base.name}" has been added to your ${kind} policies.`,
                "success", "check",
            );
        }
        router.push(RETURN_ROUTE);
    }

    const title       = isEditing ? `Edit ${existing?.name ?? "policy"}` : "Add new policy";
    const submitLabel = isEditing ? "Save changes" : "Add policy";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <FormHeader title={title} onClose={handleClose} />

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">
                    <StepSidebar steps={[{ n: 1, label: "Policy details" }]} current={1} />

                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-8 px-1 -mx-1 min-h-0">

                                {/* ── Policy details ─────────────────────── */}
                                <section className="flex flex-col gap-4">
                                    <SectionHeader title="Policy details" />

                                    <Field label="Policy name">
                                        <TextInput
                                            value={name}
                                            onChange={setName}
                                            placeholder="Enter policy name"
                                        />
                                    </Field>

                                    <Field label="Policy type">
                                        <div className="grid grid-cols-2 gap-3">
                                            <RadioCard
                                                selected={type === "cancellation"}
                                                onSelect={() => setType("cancellation")}
                                                label="Cancellation"
                                            />
                                            <RadioCard
                                                selected={type === "no_show"}
                                                onSelect={() => setType("no_show")}
                                                label="No-show"
                                            />
                                        </div>
                                    </Field>
                                </section>

                                {/* ── Cancellation policy variant ──────────── */}
                                {type === "cancellation" && (
                                    <section className="flex flex-col gap-4">
                                        <SectionHeader title="Cancellation policy" />

                                        <div className="grid grid-cols-2 gap-3">
                                            <RadioCard
                                                selected={cancelChoice === "anytime_no_charge"}
                                                onSelect={() => setCancelChoice("anytime_no_charge")}
                                                label="Customer can cancel anytime without any charge"
                                            />
                                            <RadioCard
                                                selected={cancelChoice === "fee_if_late"}
                                                onSelect={() => setCancelChoice("fee_if_late")}
                                                label="Customer will be charged a fee if they cancel late"
                                            />
                                        </div>

                                        {cancelChoice === "fee_if_late" && (
                                            <Field label={`Cancel window - ${cancelWindowUnit} before class start`}>
                                                <NumberWithUnitInput
                                                    value={cancelWindowValue}
                                                    unit={cancelWindowUnit}
                                                    units={HOURS_MINUTES}
                                                    onValueChange={setCancelWindowValue}
                                                    onUnitChange={(u) => setCancelWindowUnit(u as "hours" | "minutes")}
                                                />
                                            </Field>
                                        )}
                                    </section>
                                )}

                                {/* ── No-show policy variant ────────────────── */}
                                {type === "no_show" && (
                                    <section className="flex flex-col gap-4">
                                        <SectionHeader title="No-show policy" />

                                        <div className="grid grid-cols-2 gap-3">
                                            <RadioCard
                                                selected={noShowChoice === "no_charge"}
                                                onSelect={() => setNoShowChoice("no_charge")}
                                                label="A member won't be charged anything if they don't show up for a class."
                                            />
                                            <RadioCard
                                                selected={noShowChoice === "charge_session"}
                                                onSelect={() => setNoShowChoice("charge_session")}
                                                label="A member would be charged accordingly if they don't show up for a class."
                                            />
                                        </div>

                                        {noShowChoice === "charge_session" && (
                                            <Field label="Charge class session">
                                                <NumericInput
                                                    value={chargeSession}
                                                    onChange={setChargeSession}
                                                    prefix={<CurrencyDollarCircle className="w-5 h-5 text-[#667085]" />}
                                                    hideStepper
                                                    min={0}
                                                    max={99}
                                                />
                                            </Field>
                                        )}
                                    </section>
                                )}
                            </div>

                            {/* ── Footer ───────────────────────────────────── */}
                            <div className="shrink-0 flex items-center justify-end w-full">
                                <Button
                                    variant="primary"
                                    size="md"
                                    disabled={!canSubmit}
                                    onClick={handleSubmit}
                                >
                                    {submitLabel}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Radio card primitive — same shape as the Customize page ────────────────

function RadioCard({ selected, onSelect, label }: {
    selected: boolean;
    onSelect: () => void;
    label: string;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "p-4 rounded-[12px] bg-white text-left flex items-start gap-2 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]",
                selected ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
            )}
        >
            <span
                className={cn(
                    "w-4 h-4 rounded-full shrink-0 flex items-center justify-center mt-0.5",
                    selected ? "bg-[#658774]" : "bg-white border-1 border-[#d0d5dd]",
                )}
            >
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
            <span className="flex-1 text-[14px] font-medium text-[#344054] leading-5">
                {label}
            </span>
        </button>
    );
}
