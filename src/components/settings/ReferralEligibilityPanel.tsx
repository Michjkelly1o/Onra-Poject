"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — "Eligibility & safeguards" side-panel modal
// (Figma 7661:85303)
// ─────────────────────────────────────────────────────────────────────────────
//
// Slide-in panel opened from the Referral landing card's "Edit" button on
// the Eligibility & safeguards tab. Same chrome as the Reward rules
// & limits panel + PosNewCustomerModal.
//
// Body shows 4 cards:
//   1. Prevent self referral (toggle card)
//   2. New customers only (toggle card)
//   3. Require minimum first spend (toggle card + AED amount input when on)
//   4. Credits redeemable across all branches (toggle card)
//
// Saved values mirror to `referralSettings` via `updateReferralEligibility`.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

/** Single toggle card. Selected (on) state paints a sage border around the
 *  card to mirror Figma 7661:85303's selected-state visual. */
function ToggleCard({
    title, description, on, onChange, ariaLabel, children,
}: {
    title: string;
    description: string;
    on: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
    /** Extra body content that renders BELOW the title/toggle row when
     *  the toggle is on (e.g. the AED amount input on min-first-spend). */
    children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "rounded-[12px] border-1 px-4 py-3 flex flex-col gap-3 transition-colors",
            on ? "border-[var(--colors-secondary-500)]" : "border-[var(--colors-border-secondary)]",
        )}>
            <div className="flex items-start gap-4">
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[var(--colors-text-primary)] leading-[20px]">{title}</p>
                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">{description}</p>
                </div>
                <Toggle on={on} onChange={onChange} ariaLabel={ariaLabel} />
            </div>
            {on && children}
        </div>
    );
}

export function ReferralEligibilityPanel({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const settings                  = useAppStore(s => s.referralSettings);
    const updateReferralEligibility = useAppStore(s => s.updateReferralEligibility);
    const showToast                 = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);

    // Local form state — committed on Save.
    const [preventSelf,  setPreventSelf]  = useState<boolean>(settings.preventSelfReferral);
    const [newOnly,      setNewOnly]      = useState<boolean>(settings.newCustomersOnly);
    /** The min-first-spend feature has TWO bits of state in the UI:
     *  a top-level toggle (on/off — independent of the AED amount) and
     *  the amount itself. Persistence collapses these to a single
     *  `minFirstSpendAed` number where 0 means "feature off". Local
     *  state mirrors the UI shape so toggling off doesn't clobber the
     *  admin-typed amount mid-edit. */
    const [minSpendOn,   setMinSpendOn]   = useState<boolean>(settings.minFirstSpendAed > 0);
    const [minSpend,     setMinSpend]     = useState<number>(
        settings.minFirstSpendAed > 0 ? settings.minFirstSpendAed : 100,
    );
    const [allBranches,  setAllBranches]  = useState<boolean>(settings.creditsRedeemableAllBranches);

    useEffect(() => {
        if (open) {
            setPreventSelf(settings.preventSelfReferral);
            setNewOnly(settings.newCustomersOnly);
            setMinSpendOn(settings.minFirstSpendAed > 0);
            setMinSpend(settings.minFirstSpendAed > 0 ? settings.minFirstSpendAed : 100);
            setAllBranches(settings.creditsRedeemableAllBranches);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, settings]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    function handleSave() {
        updateReferralEligibility({
            preventSelfReferral:          preventSelf,
            newCustomersOnly:             newOnly,
            // Persist `0` when the toggle is off so consumers can use the
            // numeric value as the source of truth without a separate
            // boolean flag in the schema.
            minFirstSpendAed:             minSpendOn ? minSpend : 0,
            creditsRedeemableAllBranches: allBranches,
        });
        showToast(
            "Eligibility & safeguards updated",
            "Referral eligibility rules now apply to new redemptions.",
            "success", "check",
        );
        onClose();
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

    // PORTAL to document.body — same reasoning as ReferralRewardsPanel:
    // anchors `position: fixed` to the viewport regardless of what the
    // parent layout chrome does with transforms / overflow.
    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            <div
                style={{ right: shown ? 0 : -600 }}
                className={cn(
                    "fixed top-0 w-[600px] max-w-[100vw] h-full bg-white border-l border-[var(--colors-border-secondary)] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 border-b border-[var(--colors-border-secondary)] shrink-0 py-4 select-none">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-[18px] text-[var(--colors-text-primary)]">Eligibility &amp; safeguards</p>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">
                            Decide who qualifies &amp; block the common ways referral programs get gamed.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-4">
                    <ToggleCard
                        title="Prevent self-referral"
                        description="Block matching email, phone, or payment method between referrer and friend."
                        on={preventSelf}
                        onChange={setPreventSelf}
                        ariaLabel="Prevent self-referral"
                    />
                    <ToggleCard
                        title="New customers only"
                        description="Referred friend must have no prior account or booking."
                        on={newOnly}
                        onChange={setNewOnly}
                        ariaLabel="New customers only"
                    />
                    <ToggleCard
                        title="Require minimum first spend"
                        description="Friend must spend at least this amount before the reward is released."
                        on={minSpendOn}
                        onChange={setMinSpendOn}
                        ariaLabel="Require minimum first spend"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Amount</label>
                            <div className="flex items-stretch h-10 w-full border-1 border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all">
                                <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-r border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                    AED
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    aria-label="Minimum first spend amount"
                                    value={minSpend === 0 ? "" : minSpend}
                                    placeholder="0"
                                    onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === "") { setMinSpend(0); return; }
                                        const stripped = raw.replace(/^0+(?=\d)/, "");
                                        const parsed = parseInt(stripped, 10);
                                        if (!Number.isNaN(parsed)) setMinSpend(parsed);
                                    }}
                                    className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent"
                                />
                            </div>
                        </div>
                    </ToggleCard>
                    <ToggleCard
                        title="Credits redeemable across all branches"
                        description="Off — rewards can only be used at the location they were earned."
                        on={allBranches}
                        onChange={setAllBranches}
                        ariaLabel="Credits redeemable across all branches"
                    />
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[var(--colors-border-secondary)] shrink-0 select-none">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>
                        Save changes
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
