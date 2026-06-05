"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Edit referral settings (2-step wizard)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Step 1: 4627-153283 — "New customer benefit"
//   • Step 2: 4627-155806 — "Existing customer benefit"
//
// Chrome mirrors the role / staff / customer form pages:
//   • Header: × close + "Edit referral settings"
//   • Left rail: step indicator
//   • Center card: the form for the active step
//   • Footer: Back / Continue / Save

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericInput } from "@/components/ui/NumericInput";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppStore, type ReferralTrigger } from "@/lib/store";

const TRIGGER_OPTIONS: { value: ReferralTrigger; label: string }[] = [
    { value: "sign_up",  label: "Customer sign up" },
    { value: "purchase", label: "Customer buy membership/package" },
];

// ─── Step indicator ──────────────────────────────────────────────────────

function StepRow({ index, label, active, done, isLast }: {
    index: 1 | 2; label: string; active: boolean; done: boolean; isLast: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center gap-4 h-[52px] p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#7ba08c]"
                        : done
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-[1.5px] border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {done && !active ? <Check className="w-3.5 h-3.5" /> : index}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            <p className={cn(
                "flex-1 text-[14px] leading-[20px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]",
            )}>
                {label}
            </p>
        </div>
    );
}

// ─── Form atoms ──────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] font-medium text-[#344054] leading-[20px]">{children}</p>;
}

// ─── Page ────────────────────────────────────────────────────────────────

export interface EditReferralRewardsPageProps {
    returnTo?: string;
}

export default function EditReferralRewardsPage({ returnTo = "/admin/settings/referral" }: EditReferralRewardsPageProps) {
    const router = useRouter();
    const settings              = useAppStore(s => s.referralSettings);
    const updateReferralRewards = useAppStore(s => s.updateReferralRewards);
    const showToast             = useAppStore(s => s.showToast);

    // Local form state — committed only on Save.
    const [step, setStep] = useState<1 | 2>(1);
    // Step 1
    const [newCredits, setNewCredits] = useState(settings.newCustomerCredits);
    const [newMessage, setNewMessage] = useState(settings.newCustomerMessage);
    // Step 2
    const [trigger, setTrigger]                 = useState<ReferralTrigger>(settings.existingCustomerTrigger);
    const [minReferred, setMinReferred]         = useState(settings.existingCustomerMinReferred);
    const [existingCredits, setExistingCredits] = useState(settings.existingCustomerCredits);
    const [existingMessage, setExistingMessage] = useState(settings.existingCustomerMessage);

    const step1Valid = newCredits >= 1 && newMessage.trim().length > 0;
    const step2Valid =
        minReferred >= 1
        && existingCredits >= 1
        && existingMessage.trim().length > 0;

    function handleSave() {
        if (!step1Valid || !step2Valid) return;
        updateReferralRewards({
            newCustomerCredits: newCredits,
            newCustomerMessage: newMessage.trim(),
            existingCustomerTrigger: trigger,
            existingCustomerMinReferred: minReferred,
            existingCustomerCredits: existingCredits,
            existingCustomerMessage: existingMessage.trim(),
        });
        showToast(
            "Referral settings updated",
            "The new rewards configuration is now live for every customer.",
            "success", "check",
        );
        router.push(returnTo);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Edit referral settings</h1>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-8 items-start overflow-hidden">
                {/* Left progress rail */}
                <div className="w-[260px] shrink-0 flex flex-col gap-4">
                    <StepRow index={1} label="New customer benefit"      active={step === 1} done={step === 2} isLast={false} />
                    <StepRow index={2} label="Existing customer benefit" active={step === 2} done={false}     isLast={true}  />
                </div>

                {/* Center content card */}
                <div className="flex-1 min-w-0 max-w-[680px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
                        {step === 1 ? (
                            // Step 1 uses a flex column so the Message field's
                            // RichTextEditor (`flex-1`) fills whatever vertical
                            // space the credits field above doesn't take. The
                            // outer container is `h-full` so the flex chain
                            // actually has a height to distribute.
                            <div className="flex flex-col gap-5 w-full h-full">
                                <p className="font-semibold text-[18px] leading-[28px] text-[#101828] shrink-0">New customer benefit</p>

                                <div className="flex flex-col gap-[6px] w-full shrink-0">
                                    <FieldLabel>Number of free credits</FieldLabel>
                                    <NumericInput value={newCredits} onChange={setNewCredits} min={0} max={50} placeholder="Enter class amount..." />
                                </div>

                                <div className="flex-1 min-h-0 flex flex-col gap-[6px] w-full">
                                    <FieldLabel>Message to new customer</FieldLabel>
                                    <RichTextEditor
                                        value={newMessage}
                                        onChange={setNewMessage}
                                        placeholder="Write the referral information..."
                                        rows={10}
                                        className="flex-1 min-h-0"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-5 w-full">
                                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Existing customer benefit</p>

                                <div className="flex flex-col gap-[6px] w-full">
                                    <FieldLabel>Trigger for successful referral</FieldLabel>
                                    <SelectInput
                                        placeholder="Select trigger"
                                        options={TRIGGER_OPTIONS}
                                        value={trigger}
                                        onChange={v => setTrigger(v as ReferralTrigger)}
                                        width="w-full"
                                    />
                                </div>

                                <div className="flex flex-col gap-[6px] w-full">
                                    <FieldLabel>Minimal of referred customer</FieldLabel>
                                    <NumericInput value={minReferred} onChange={setMinReferred} min={1} max={20} />
                                    <p className="text-[13px] text-[#667085] leading-[18px]">
                                        This is the minimum number of people that existing customers must refer in order to get the benefit.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-[6px] w-full">
                                    <FieldLabel>Number of free credits</FieldLabel>
                                    <NumericInput value={existingCredits} onChange={setExistingCredits} min={1} max={50} />
                                </div>

                                <div className="flex flex-col gap-[6px] w-full">
                                    <FieldLabel>Message to existing customer</FieldLabel>
                                    <RichTextEditor
                                        value={existingMessage}
                                        onChange={setExistingMessage}
                                        placeholder="Write the referral information..."
                                        rows={8}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3">
                        {step === 2 ? (
                            <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                        ) : <span />}
                        {step === 1 ? (
                            <Button variant="primary" size="md" disabled={!step1Valid} onClick={() => setStep(2)}>Continue</Button>
                        ) : (
                            <Button variant="primary" size="md" disabled={!step1Valid || !step2Valid} onClick={handleSave}>
                                Save changes
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
