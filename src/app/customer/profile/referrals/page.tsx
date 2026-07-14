"use client";

// Customer — Invite friends / Referral (`/customer/profile/referrals`).
// Referral code + copy/share, the program steps, metrics, and referred customers.

import { useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy01, HeartHand, ShoppingCart01, Stars02, Upload01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { rewardSummary, substituteReferralVariables, triggerProse } from "@/lib/referral-helpers";
import { useCurrentCustomer } from "@/lib/customer/context";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { ShareSheet } from "@/components/customer/shell/ShareSheet";
import { FeaturedIconHero } from "@/components/customer/profile/FeaturedIconHero";
import { Button } from "@/components/ui/button";

const STEP_ICONS: ComponentType<SVGProps<SVGSVGElement>>[] = [Upload01, ShoppingCart01, Stars02];

function initialsOf(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");
}

/** ISO → "DD/MM/YYYY". */
function ddmmyyyy(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function ReferralsPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const showToast = useAppStore((s) => s.showToast);
    const referralSettings = useAppStore((s) => s.referralSettings);
    const referrals = useAppStore((s) => s.customerReferrals).filter((r) => r.referrerCustomerId === member?.id);
    const [shareOpen, setShareOpen] = useState(false);

    const code = member?.referralCode ?? "";
    const maxReferrals = referralSettings.maxReferralsPerMember || 10;

    // All reward copy reflects the admin Referral settings (amounts, reward type,
    // unlock trigger) rather than hard-coded values.
    const referrerReward = rewardSummary(referralSettings.referrerEarnType, referralSettings.referrerEarnAmount);
    const friendReward = rewardSummary(referralSettings.friendEarnType, referralSettings.friendEarnAmount);
    const trigger = referralSettings.rewardUnlockTrigger;
    const step2Text =
        trigger === "friend_signup"
            ? "Your friend signs up using your referral code."
            : `Your friend signs up and ${triggerProse(trigger).replace(/^make /, "makes ").replace(/^attend /, "attends ")}.`;
    const steps = [
        "Share your unique link with friends to join the program.",
        step2Text,
        `Once your friend qualifies, you get ${referrerReward} and they get ${friendReward}.`,
    ];
    // A referral is "successful" once the referrer's full reward has been granted.
    const rewardThreshold = Math.max(1, referralSettings.referrerEarnAmount);
    const isSuccessful = (benefitCredits: number) => benefitCredits >= rewardThreshold;
    const successfulRefs = referrals.filter((r) => isSuccessful(r.benefitCredits));
    const successful = successfulRefs.length;
    const totalBonus = successfulRefs.reduce((n, r) => n + (r.benefitCredits || 0), 0);

    // The admin-authored referral message with its {{variables}} resolved, plus
    // the sign-up deep link (new users enter the code during sign-up).
    const resolvedMessage = substituteReferralVariables(
        referralSettings.infoDescription || `Join me on Onra! We both get free credits when you sign up.`,
        referralSettings,
    );
    const signupLink = `https://onra.app/join?ref=${encodeURIComponent(code)}`;
    const shareBody = `${resolvedMessage}\n\nUse my code: ${code}`;

    function copyAll() {
        navigator.clipboard
            ?.writeText(`${shareBody}\n${signupLink}`)
            .then(() => showToast("Copied to clipboard", "Your referral message is ready to share.", "success"))
            .catch(() => showToast("Couldn't copy", "Please try again.", "error"));
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-xl font-semibold leading-[30px] text-[var(--brand-text)]">Invite friends</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="relative flex flex-1 flex-col gap-5 px-4 pb-8 pt-[80px]">
                {/* Soft mint radial wash over the top (shared with Gift card). */}
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
                    style={{ background: "radial-gradient(125% 78% at 50% -18%, #dff6ed 0%, rgba(255,255,255,0) 72%)" }}
                />

                {/* Hero — shared pattern; upright green tile (rectangle, not diamond). */}
                <FeaturedIconHero
                    icon={HeartHand}
                    upright
                    tileClassName="bg-[#dcfae5] shadow-[0px_4px_18px_0px_rgba(220,250,229,0.7),0px_2px_4px_0px_rgba(16,24,40,0.04)]"
                    iconClassName="size-9 text-[var(--brand-primary)]"
                    title="Refer friends, get free credits"
                    subtitle={`Get ${friendReward} for each friend you invite.`}
                />

                <div className="relative flex items-center gap-2">
                    <div className="flex flex-1 items-center rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)]">
                        {code}
                    </div>
                    <Button
                        variant="secondary-gray"
                        size="lg"
                        leftIcon={<Copy01 className="size-4" aria-hidden />}
                        className="rounded-lg"
                        onClick={copyAll}
                    >
                        Copy
                    </Button>
                </div>
                <Button
                    variant="primary"
                    size="xl"
                    className="relative w-full rounded-full"
                    onClick={() => setShareOpen(true)}
                >
                    Share
                </Button>

                {/* Program steps — connector line runs between the step icons. */}
                <div className="relative flex flex-col rounded-2xl border border-[#eaecf0] bg-white p-4">
                    {steps.map((text, i) => {
                        const Icon = STEP_ICONS[i];
                        const last = i === steps.length - 1;
                        return (
                            <div key={i} className="flex gap-3">
                                <div className="flex flex-col items-center self-stretch">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--brand-tertiary)] text-[var(--brand-primary)]">
                                        <Icon className="size-4" aria-hidden />
                                    </div>
                                    {!last && (
                                        <div className="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-[#a9efc5] to-[var(--brand-tertiary)]" />
                                    )}
                                </div>
                                <p className={`flex-1 pt-1 text-sm leading-5 text-[#344054] ${last ? "" : "pb-5"}`}>
                                    {text}
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Metrics */}
                <div className="relative grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                        <p className="text-sm leading-5 text-[#475467]">Total bonus credit</p>
                        <p className="mt-1 text-xl font-semibold leading-7 text-[var(--brand-text)]">{totalBonus} credit</p>
                    </div>
                    <div className="rounded-2xl border border-[#eaecf0] bg-white p-4">
                        <p className="text-sm leading-5 text-[#475467]">Successful referrals</p>
                        <p className="mt-1 text-xl font-semibold leading-7 text-[var(--brand-text)]">
                            {successful}/{maxReferrals}
                        </p>
                    </div>
                </div>

                {/* Referred customers */}
                <div className="relative">
                    <p className="mb-3 text-sm font-semibold leading-5 text-[var(--brand-text)]">Referred customers</p>
                    {referrals.length > 0 ? (
                        <div className="flex flex-col gap-3">
                            {referrals.map((r) => {
                                const success = isSuccessful(r.benefitCredits);
                                return (
                                    <div
                                        key={r.id}
                                        className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-3"
                                    >
                                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e0e0e0] text-sm font-semibold text-[#475467]">
                                            {initialsOf(r.referredName)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-base font-medium leading-6 text-[var(--brand-text)]">
                                                {r.referredName}
                                            </p>
                                            <p className="truncate text-sm leading-5 text-[#475467]">
                                                {success
                                                    ? `Expiry until ${ddmmyyyy(r.expiresAtISO)}`
                                                    : `Joined ${ddmmyyyy(r.referredAtISO)}`}
                                            </p>
                                        </div>
                                        {success ? (
                                            <span className="shrink-0 rounded-full bg-[var(--brand-tertiary)] px-2.5 py-0.5 text-xs font-medium leading-5 text-[var(--brand-primary)] ring-1 ring-inset ring-[var(--brand-primary)]">
                                                +{r.benefitCredits} credits
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full bg-white px-2.5 py-0.5 text-xs font-medium leading-5 text-[#475467] ring-1 ring-inset ring-[#d0d5dd]">
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-1 rounded-2xl border border-dashed border-[#eaecf0] py-10 text-center">
                            <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">No referrals yet</p>
                            <p className="text-sm leading-5 text-[#475467]">Refer friends and get free credits!</p>
                        </div>
                    )}
                </div>
            </div>

            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                message={shareBody}
                url={signupLink}
                preview={
                    <div className="flex flex-col gap-4">
                        <div className="rounded-xl bg-[#f9fafb] p-4 text-sm leading-5 text-[#344054]">{resolvedMessage}</div>
                        <div className="flex items-center gap-2">
                            <div className="flex flex-1 items-center rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)]">
                                {code}
                            </div>
                            <Button
                                variant="secondary-gray"
                                size="lg"
                                leftIcon={<Copy01 className="size-4" aria-hidden />}
                                className="rounded-lg"
                                onClick={copyAll}
                            >
                                Copy
                            </Button>
                        </div>
                    </div>
                }
            />
        </div>
    );
}
