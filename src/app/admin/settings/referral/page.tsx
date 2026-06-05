"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Referral (Figma 4620-151863)
// ─────────────────────────────────────────────────────────────────────────────
//
// Two outer cards stacked vertically. Each outer card has a header (title +
// subtitle + Edit button on the right) and an inner BORDERED sub-card that
// previews the actual config:
//
//   • Card 1: outer subtitle "Set settings for referral rules" — inner card
//     shows "Referral program is active" with its own subtitle
//     "Edit rewards-based customer referral marketing program" and the
//     master toggle on the right.
//   • Card 2: outer subtitle "Use the text information to describe your
//     referral offer to the customers." — inner card shows the saved
//     Description preview.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit02, XClose, SlashCircle01, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

export default function ReferralSettingsPage() {
    const router = useRouter();
    const settings              = useAppStore(s => s.referralSettings);
    const setProgramActive      = useAppStore(s => s.setReferralProgramActive);
    const showToast             = useAppStore(s => s.showToast);

    // Confirm-before-flip — matches the Branches / Rooms / Staff toggle
    // convention. The toggle click stages the requested next value; the
    // modal's primary action commits it.
    const [pendingToggle, setPendingToggle] = useState<{ next: boolean } | null>(null);

    function handleToggle(next: boolean) {
        setPendingToggle({ next });
    }

    function handleConfirmToggle() {
        if (!pendingToggle) return;
        const { next } = pendingToggle;
        setProgramActive(next);
        showToast(
            next ? "Referral program activated" : "Referral program deactivated",
            next
                ? "Customers can now earn and redeem referral rewards."
                : "The customer share CTA is hidden until you re-activate.",
            next ? "success" : "error",
            next ? "check" : "slash",
        );
        setPendingToggle(null);
    }

    return (
        <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* ── Referral settings card ─────────────────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Referral settings</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">Set settings for referral rules</p>
                    </div>
                    <Button variant="secondary-gray" size="md"
                        leftIcon={<Edit02 className="w-4 h-4" />}
                        onClick={() => router.push("/settings/referral/edit-rewards")}>
                        Edit
                    </Button>
                </div>

                {/* Inner sub-card — sage border when the program is active. */}
                <div className={cn(
                    "rounded-[12px] px-5 py-4 flex items-center gap-4 border-1 transition-colors",
                    settings.programActive ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                )}>
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[14px] font-semibold text-[#101828]">Referral program is active</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">Edit rewards-based customer referral marketing program</p>
                    </div>
                    <Toggle on={settings.programActive} onChange={handleToggle} ariaLabel="Referral program master switch" />
                </div>
            </div>

            {/* ── Customize referral information card ───────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {/* Header */}
                <div className="flex items-start gap-4">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Customize referral information</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">Use the text information to describe your referral offer to the customers.</p>
                    </div>
                    <Button variant="secondary-gray" size="md"
                        leftIcon={<Edit02 className="w-4 h-4" />}
                        onClick={() => router.push("/settings/referral/edit-information")}>
                        Edit
                    </Button>
                </div>

                {/* Inner sub-card — Description preview. The saved value is
                    rich-text HTML produced by the editor, so we render with
                    `dangerouslySetInnerHTML` and re-declare the heading /
                    list / link styles so formatting survives the round-trip
                    from editor → state → preview. */}
                <div className="rounded-[12px] border-1 border-[#e4e7ec] px-5 py-4 flex flex-col gap-1">
                    <p className="text-[14px] text-[#667085]">Description</p>
                    <div
                        className={cn(
                            "text-[14px] text-[#101828] leading-[20px]",
                            "[&_h1]:text-[28px] [&_h1]:font-bold     [&_h1]:leading-[36px] [&_h1]:my-2",
                            "[&_h2]:text-[24px] [&_h2]:font-bold     [&_h2]:leading-[32px] [&_h2]:my-2",
                            "[&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:leading-[28px] [&_h3]:my-2",
                            "[&_h4]:text-[16px] [&_h4]:font-semibold [&_h4]:leading-[24px] [&_h4]:my-2",
                            "[&_ul]:list-disc    [&_ul]:pl-6",
                            "[&_ol]:list-decimal [&_ol]:pl-6",
                            "[&_a]:text-[#3538cd] [&_a]:underline",
                            "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-[6px] [&_img]:my-2",
                        )}
                        dangerouslySetInnerHTML={{ __html: settings.infoDescription }}
                    />
                </div>
            </div>

            {pendingToggle && (
                <ReferralToggleConfirmModal
                    next={pendingToggle.next}
                    onCancel={() => setPendingToggle(null)}
                    onConfirm={handleConfirmToggle}
                />
            )}

            <Toast />
        </div>
    );
}

// ─── Toggle confirmation modal ──────────────────────────────────────────────
//
// Mirrors the shape of ToggleConfirmModal in /admin/settings/page.tsx (the
// Branches / Rooms reference). The two states differ only in copy and CTA
// tone — destructive for deactivate, primary for activate — so a single
// component covers both.
function ReferralToggleConfirmModal({ next, onCancel, onConfirm }: {
    next: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onCancel();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const isActivate = next;
    const title = isActivate
        ? "Activate referral program?"
        : "Deactivate referral program?";
    const supporting = isActivate
        ? "Customers can begin earning + redeeming referral rewards across all branches."
        : "New referrals stop accruing rewards. Existing rewards are preserved.";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[400px] flex flex-col">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        isActivate ? "bg-[#e9fff3]" : "bg-[#fee4e2]",
                    )}>
                        {isActivate
                            ? <Check className="w-6 h-6 text-[#658774]" />
                            : <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                        }
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">{title}</p>
                        <p className="text-[14px] text-[#475467] leading-5 w-full">{supporting}</p>
                    </div>
                </div>
                <div className="flex gap-3 items-start p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant={isActivate ? "primary" : "destructive"}
                        size="lg"
                        className="flex-1"
                        onClick={onConfirm}
                    >
                        {isActivate ? "Activate" : "Deactivate"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
