"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Referral (Figma 4620:151863 / 7661:42307)
// ─────────────────────────────────────────────────────────────────────────────
//
// 3 stacked cards:
//
//   • Card 1 — Referral settings
//     Master "Referral program is active" toggle (confirm before flip).
//
//   • Card 2 — Tabbed Reward rules & limits | Eligibility & fraud controls
//     Pill-tab strip at the top. Each tab body shows the saved config as a
//     read-only summary; the "Edit" button on the tab header opens the
//     matching side-panel modal (mirrors POS "Add new customer" panel
//     chrome — slide-in from the right, 480 px wide).
//
//   • Card 3 — Customize referral information
//     Title + Description preview. "Edit" routes to the full-page editor
//     at /settings/referral/edit-information (variables + RichText +
//     live preview rail per Figma 4627:153001).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit02, XClose, SlashCircle01, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import { ReferralRewardsPanel } from "@/components/settings/ReferralRewardsPanel";
import { ReferralEligibilityPanel } from "@/components/settings/ReferralEligibilityPanel";
import { ReferralOverviewTab } from "@/components/settings/ReferralOverviewTab";
import {
    rewardSummary,
    triggerLabel,
    substituteReferralVariables,
} from "@/lib/referral-helpers";
import { useAppStore } from "@/lib/store";

// ─── Toggle (master switch) ─────────────────────────────────────────────────

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

// ─── Page ───────────────────────────────────────────────────────────────────

type RulesTab = "rewards" | "eligibility";
type PageTab = "overview" | "setup";

export default function ReferralSettingsPage() {
    const router = useRouter();
    const settings              = useAppStore(s => s.referralSettings);
    const setProgramActive      = useAppStore(s => s.setReferralProgramActive);
    const showToast             = useAppStore(s => s.showToast);

    // Confirm-before-flip master toggle.
    const [pendingToggle, setPendingToggle] = useState<{ next: boolean } | null>(null);

    // Page-level tab — Overview (program KPIs) vs Setup (configuration).
    const [pageTab, setPageTab] = useState<PageTab>("overview");

    // Active sub-tab on the rules card.
    const [rulesTab, setRulesTab] = useState<RulesTab>("rewards");

    // Side-panel modal open state.
    const [rewardsOpen, setRewardsOpen] = useState(false);
    const [eligibilityOpen, setEligibilityOpen] = useState(false);

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
        <div className="flex flex-col gap-6">
            {/* Page-level tabs — Overview (KPIs) / Setup (configuration).
                Sticky while scrolling, matching the dashboard + settings
                group header: `bg-white` covers behind the tabs and the white
                box-shadow extends 24px UPWARD to fill main's top padding so
                content doesn't bleed above the strip. */}
            <div className="sticky top-0 z-30 w-full bg-white border-b border-[#e4e7ec] shadow-[0_-24px_0_0_#ffffff]">
                <DetailPageTabs
                    tabs={[
                        { key: "overview", label: "Overview" },
                        { key: "setup",    label: "Setup" },
                    ]}
                    activeKey={pageTab}
                    onChange={k => setPageTab(k as PageTab)}
                    compact
                />
            </div>

            {pageTab === "overview" ? (
                <ReferralOverviewTab />
            ) : (
            <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* ── Card 1: Referral settings (master toggle) ────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828]">Referral settings</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">Turn on the rewards based referral program on or off.</p>
                </div>

                <div className={cn(
                    "rounded-[12px] px-5 py-4 flex items-center gap-4 border-1 transition-colors",
                    settings.programActive ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                )}>
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[14px] font-semibold text-[#101828]">Referral program is active</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">Members can share a link and earn rewards when join.</p>
                    </div>
                    <Toggle on={settings.programActive} onChange={next => setPendingToggle({ next })} ariaLabel="Referral program master switch" />
                </div>
            </div>

            {/* ── Card 2: Tabbed Rules + Fraud Controls ────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <SegmentedTabs
                    tabs={[
                        { key: "rewards",      label: "Reward rules & limits"     },
                        { key: "eligibility",  label: "Eligibility & safeguards" },
                    ]}
                    activeKey={rulesTab}
                    onChange={k => setRulesTab(k as RulesTab)}
                />

                {rulesTab === "rewards" && (
                    <>
                        <div className="flex items-start gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                                <p className="text-[16px] font-semibold text-[#101828]">Reward rules &amp; limits</p>
                                <p className="text-[14px] text-[#667085] leading-[20px]">
                                    Decide who qualifies &amp; block the common ways referral programs get gamed.
                                </p>
                            </div>
                            <Button variant="secondary-gray" size="md"
                                leftIcon={<Edit02 className="w-4 h-4" />}
                                onClick={() => setRewardsOpen(true)}>
                                Edit
                            </Button>
                        </div>

                        {/* 3-column grid of summary fields per Figma
                            4620:151863. Referrer + Friend earns both
                            show the actual reward summary (e.g. "2
                            credits") so the admin can see at a glance
                            what each side gets without opening the
                            modal — symmetric layout, no Yes/No
                            asymmetry. */}
                        <div className="grid grid-cols-3 gap-x-6 gap-y-5">
                            <SummaryField label="Referrer earns" value={rewardSummary(settings.referrerEarnType, settings.referrerEarnAmount)} />
                            <SummaryField label="Friend earns"   value={rewardSummary(settings.friendEarnType, settings.friendEarnAmount)} />
                            <SummaryField label="Reward unlock when" value={triggerLabel(settings.rewardUnlockTrigger)} />
                            <SummaryField label="Max referrals"  value={`${settings.maxReferralsPerMember} friends`} />
                            <SummaryField label="Earned expiry"  value={`${settings.earnedRewardExpiryDays} days`} />
                            <SummaryField label="Monthly program budget" value={`AED ${settings.monthlyProgramBudgetAed.toLocaleString()}`} />
                        </div>
                    </>
                )}

                {rulesTab === "eligibility" && (
                    <>
                        <div className="flex items-start gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                                <p className="text-[16px] font-semibold text-[#101828]">Eligibility &amp; safeguards</p>
                                <p className="text-[14px] text-[#667085] leading-[20px]">
                                    Decide who qualifies &amp; block the common ways referral programs get gamed.
                                </p>
                            </div>
                            <Button variant="secondary-gray" size="md"
                                leftIcon={<Edit02 className="w-4 h-4" />}
                                onClick={() => setEligibilityOpen(true)}>
                                Edit
                            </Button>
                        </div>

                        {/* Stacked rows per Figma 7661:42307 — title + subtitle
                            on the left, value on the right. Each row's value
                            is the toggle's on/off state or the AED amount. */}
                        <div className="flex flex-col">
                            <EligibilityRow
                                title="Prevent self-referral"
                                description="Block matching email, phone, or payment method between referrer and friend."
                                value={settings.preventSelfReferral ? "Active" : "Inactive"}
                            />
                            <EligibilityRow
                                title="New customers only"
                                description="Referred friend must have no prior account or booking."
                                value={settings.newCustomersOnly ? "Active" : "Inactive"}
                            />
                            <EligibilityRow
                                title="Require minimum first spend"
                                description="Friend must spend at least this amount before the reward is released."
                                value={settings.minFirstSpendAed > 0 ? `AED ${settings.minFirstSpendAed}` : "Disabled"}
                            />
                            <EligibilityRow
                                title="Credits redeemable across all branches"
                                description="Off — rewards can only be used at the location they were earned."
                                value={settings.creditsRedeemableAllBranches ? "Active" : "Inactive"}
                                last
                            />
                        </div>
                    </>
                )}
            </div>

            {/* ── Card 3: Customize referral information ──────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] flex flex-col gap-5 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
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

                <div className="flex flex-col gap-3">
                    <SummaryField label="Title" value={settings.infoTitle} />
                    <div className="flex flex-col gap-1">
                        <p className="text-[14px] text-[#667085]">Description</p>
                        <p className="text-[14px] text-[#101828] leading-[20px]">
                            {/* Description preview renders the RAW description with
                                variable tokens replaced for readability. Stored
                                value keeps the {{tokens}} so the editor can
                                round-trip cleanly. */}
                            {substituteReferralVariables(settings.infoDescription, settings)}
                        </p>
                    </div>
                </div>
            </div>
            </div>
            )}

            {pendingToggle && (
                <ReferralToggleConfirmModal
                    next={pendingToggle.next}
                    onCancel={() => setPendingToggle(null)}
                    onConfirm={handleConfirmToggle}
                />
            )}

            <ReferralRewardsPanel
                open={rewardsOpen}
                onClose={() => setRewardsOpen(false)}
            />
            <ReferralEligibilityPanel
                open={eligibilityOpen}
                onClose={() => setEligibilityOpen(false)}
            />

            <Toast />
        </div>
    );
}

// ─── Summary field ──────────────────────────────────────────────────────────

function SummaryField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-semibold text-[#101828]">{value}</p>
        </div>
    );
}

// ─── Eligibility row ─────────────────────────────────────────────────────────

function EligibilityRow({ title, description, value, last }: {
    title: string;
    description: string;
    value: string;
    last?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-start gap-4 py-4",
            !last && "border-b border-[#e4e7ec]",
        )}>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{description}</p>
            </div>
            <span className="text-[14px] text-[#475467] shrink-0">{value}</span>
        </div>
    );
}

// ─── Toggle confirmation modal ──────────────────────────────────────────────

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
