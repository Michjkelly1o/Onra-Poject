"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — "Reward rules & limits" side-panel modal (Figma 7661:54592)
// ─────────────────────────────────────────────────────────────────────────────
//
// Slide-in panel opened from the Referral landing card's "Edit" button on
// the Reward rules & limits tab. Chrome (overlay + 480 px slide-in from
// right + 64 px header + scrollable body + footer with Cancel +
// Save changes) MATCHES the POS "Add new customer" panel
// (`PosNewCustomerModal`) so the prototype's side-panel pattern stays
// consistent across modules.
//
// Sections (per Figma):
//   1. Who earns what — Referrer earns + Friend earns (type dropdown +
//      amount).
//   2. Rewards unlock when — 3 radio cards (sign up / first purchase
//      (Recommended) / attends first class).
//   3. Caps & limits — Max referrals per member / Earned reward expiry
//      (with day-unit suffix) / Monthly program budget (AED prefix).
//
// Validation: amounts ≥ 0; on save commits to the store via
// `updateReferralRewards` and fires a success toast. ESC + backdrop +
// X close without saving.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Lightbulb02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import {
    useAppStore,
    type ReferralRewardType,
    type ReferralUnlockTrigger,
} from "@/lib/store";

const labelCls = "text-[14px] font-medium text-[var(--colors-text-secondary)]";

// Two shipped reward types — a class credit or an AED account-credit top-up.
// The Amount field's unit suffix (see `amountUnitLabel`) flips to "credit(s)"
// or "AED" to match the selection.
const REWARD_TYPE_OPTIONS = [
    { value: "free_credits",  label: "Class Credit" },
    { value: "wallet_credit", label: "Account Credit (AED)" },
];

/** Numeric input that mirrors the project-wide convention:
 *  placeholder "0", empty when state === 0, strips leading zeros. */
function NumberField({ value, onChange, ariaLabel, suffixSlot }: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    suffixSlot?: React.ReactNode;
}) {
    return (
        <div className="flex items-stretch gap-0 h-10 w-full border-1 border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all">
            <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={ariaLabel}
                value={value === 0 ? "" : value}
                placeholder="0"
                onChange={e => {
                    const raw = e.target.value;
                    if (raw === "") { onChange(0); return; }
                    const stripped = raw.replace(/^0+(?=\d)/, "");
                    const parsed = parseInt(stripped, 10);
                    if (!Number.isNaN(parsed)) onChange(parsed);
                }}
                className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent"
            />
            {suffixSlot}
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{title}</p>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className={labelCls}>{label}</label>
            {children}
        </div>
    );
}

// Trigger labels only — the explanatory subtitles were dropped per client
// review; the three cards read simply "Sign up" / "First purchase" /
// "First class".
const TRIGGER_OPTIONS: Array<{
    value: ReferralUnlockTrigger;
    title: string;
}> = [
        { value: "friend_signup",         title: "Sign up" },
        { value: "friend_first_purchase", title: "First purchase" },
        { value: "friend_first_class",    title: "First class" },
    ];

export function ReferralRewardsPanel({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const settings = useAppStore(s => s.referralSettings);
    const updateReferralRewards = useAppStore(s => s.updateReferralRewards);
    const showToast = useAppStore(s => s.showToast);

    // Slide animation state — drives the same `right: -480 / 0` trick the
    // POS panel uses to avoid breaking `position: fixed` on inner
    // SelectInput dropdowns.
    const [shown, setShown] = useState(false);

    // Local form state — committed only on Save.
    const [referrerType, setReferrerType] = useState<ReferralRewardType>(settings.referrerEarnType);
    const [referrerAmount, setReferrerAmount] = useState<number>(settings.referrerEarnAmount);
    const [friendType, setFriendType] = useState<ReferralRewardType>(settings.friendEarnType);
    const [friendAmount, setFriendAmount] = useState<number>(settings.friendEarnAmount);
    const [trigger, setTrigger] = useState<ReferralUnlockTrigger>(settings.rewardUnlockTrigger);
    const [maxReferrals, setMaxReferrals] = useState<number>(settings.maxReferralsPerMember);
    const [expiryDays, setExpiryDays] = useState<number>(settings.earnedRewardExpiryDays);
    const [budget, setBudget] = useState<number>(settings.monthlyProgramBudgetAed);

    /** Cascade both dropdowns in lockstep — client Jul 2026: a studio can only
     *  offer ONE reward type at a time (Class Credit OR Account Credit AED,
     *  never mixed). Changing either dropdown mirrors to the other AND resets
     *  BOTH amounts to 0 so a "5 credits" value can't accidentally save as
     *  "5 AED" after a type switch. Both selects stay visible for clarity —
     *  the constraint is the sync, not hiding either input. */
    function handleTypeChange(next: ReferralRewardType) {
        if (next === referrerType && next === friendType) return;
        setReferrerType(next);
        setFriendType(next);
        setReferrerAmount(0);
        setFriendAmount(0);
    }

    // Reset every time the panel opens so the form mirrors the
    // currently-saved values (not stale local edits from a prior open).
    // Studio-single-type invariant (client Jul 2026): if persisted state
    // somehow diverges (mixed pre-constraint data), snap `friendType` to
    // `referrerType` on hydrate so the form opens in a valid state.
    useEffect(() => {
        if (open) {
            const t = settings.referrerEarnType;
            setReferrerType(t);
            setReferrerAmount(settings.referrerEarnAmount);
            setFriendType(t);
            setFriendAmount(settings.friendEarnAmount);
            setTrigger(settings.rewardUnlockTrigger);
            setMaxReferrals(settings.maxReferralsPerMember);
            setExpiryDays(settings.earnedRewardExpiryDays);
            setBudget(settings.monthlyProgramBudgetAed);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, settings]);

    // ESC closes the panel.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const formValid =
        referrerAmount >= 0
        && friendAmount >= 0
        && maxReferrals >= 1
        && expiryDays >= 1
        && budget >= 0;

    function handleSave() {
        if (!formValid) return;
        // Studio-single-type invariant (client Jul 2026) — both `referrerEarnType`
        // and `friendEarnType` MUST equal the same value on save. The cascade
        // handler above already keeps `friendType` in lockstep with
        // `referrerType`, but we write `referrerType` to both fields at save
        // time as a belt-and-braces guard for any stale mixed-type persisted
        // state that never got touched during the session.
        const rewardType = referrerType;
        updateReferralRewards({
            referrerEarnType: rewardType,
            referrerEarnAmount: referrerAmount,
            friendEarnType: rewardType,
            friendEarnAmount: friendAmount,
            rewardUnlockTrigger: trigger,
            maxReferralsPerMember: maxReferrals,
            earnedRewardExpiryDays: expiryDays,
            monthlyProgramBudgetAed: budget,
        });
        showToast(
            "Reward rules & limits updated",
            "The new referral reward configuration is now live.",
            "success", "check",
        );
        onClose();
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

    // PORTAL to document.body so the panel anchors to the VIEWPORT, not
    // to any transformed/overflow-hidden ancestor. Without this, a
    // `transform` on a parent layout chrome would re-base the panel's
    // `fixed` positioning and the user could see it shift / clip / drag
    // unexpectedly. Mounting at body guarantees the slide rides the
    // right edge of the actual window every time.
    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            {/* Backdrop fades in/out alongside the panel slide. */}
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            {/* Panel slides via `right` (not `transform`) so SelectInput's
                fixed-positioned dropdown menu stays anchored to the
                viewport — `transform` on this element would re-base
                every descendant's `position: fixed` to this box. */}
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
                        <p className="font-heading font-semibold text-[18px] text-[var(--colors-text-primary)]">Reward rules &amp; limits</p>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">
                            Decide who qualifies &amp; block the common ways referral programs get gamed.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                {/* Body — scrollable form. The Who-earns-what rows use a
                    flex layout with an inline `→` arrow connecting the
                    dropdown and the Amount field so each pair reads as
                    ONE control instead of two stranded inputs. */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-8 select-text">
                    {/* ── Who earns what ──────────────────────────────── */}
                    <Section title="Who earns what">
                        {/* Studio-single-type invariant (client Jul 2026) — a
                            studio offers ONE reward type at a time. This info
                            banner explains why changing either dropdown
                            cascades the other AND resets both amounts. Uses
                            the same neutral `#f1f2ed` info chrome the freeze
                            policy panel + cancel-plan modal use. */}
                        <div className="flex gap-3 items-start bg-[var(--colors-tertiary-50)] border-1 border-[var(--colors-border-secondary)] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                            <Lightbulb02 className="w-5 h-5 text-[var(--colors-text-tertiary)] shrink-0 mt-[2px]" />
                            <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">
                                Studios use one reward type at a time — switching resets both amounts.
                            </p>
                        </div>
                        {/* 3-column grid: dropdown → arrow → Amount.
                            `minmax(0, 1fr)` forces true 50/50 columns
                            (a plain `1fr` grows the intrinsically wider
                            side). Matches the Booking Rules Cancellation
                            policy Credit&Package rows. */}
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-end">
                            <div className="min-w-0">
                                <Field label="Referrer earns">
                                    <SelectInput
                                        value={referrerType}
                                        onChange={v => handleTypeChange(v as ReferralRewardType)}
                                        options={REWARD_TYPE_OPTIONS}
                                        width="w-full"
                                    />
                                </Field>
                            </div>
                            <div className="h-10 flex items-center text-[16px] text-[var(--colors-fg-quaternary)]">→</div>
                            <div className="min-w-0">
                                <Field label="Amount">
                                    <NumberField
                                        value={referrerAmount}
                                        onChange={setReferrerAmount}
                                        ariaLabel="Referrer reward amount"
                                        suffixSlot={
                                            <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-l border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                                {amountUnitLabel(referrerType)}
                                            </span>
                                        }
                                    />
                                </Field>
                            </div>
                        </div>

                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-3 items-end">
                            <div className="min-w-0">
                                <Field label="Friend earns">
                                    <SelectInput
                                        value={friendType}
                                        onChange={v => handleTypeChange(v as ReferralRewardType)}
                                        options={REWARD_TYPE_OPTIONS}
                                        width="w-full"
                                    />
                                </Field>
                            </div>
                            <div className="h-10 flex items-center text-[16px] text-[var(--colors-fg-quaternary)]">→</div>
                            <div className="min-w-0">
                                <Field label="Amount">
                                    <NumberField
                                        value={friendAmount}
                                        onChange={setFriendAmount}
                                        ariaLabel="Friend reward amount"
                                        suffixSlot={
                                            <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-l border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                                {amountUnitLabel(friendType)}
                                            </span>
                                        }
                                    />
                                </Field>
                            </div>
                        </div>
                    </Section>

                    {/* ── Rewards unlock when ─────────────────────────── */}
                    <Section title="Rewards unlock when">
                        <div className="flex flex-col gap-1">
                            <p className={labelCls}>Trigger</p>
                            <div className="grid grid-cols-3 gap-3 mt-1">
                                {TRIGGER_OPTIONS.map(opt => {
                                    const selected = trigger === opt.value;
                                    return (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setTrigger(opt.value)}
                                            className={cn(
                                                "text-left rounded-[12px] border-1 px-4 py-3 flex items-center gap-3 transition-colors",
                                                selected
                                                    ? "border-[var(--colors-secondary-500)] bg-white"
                                                    : "border-[var(--colors-border-secondary)] bg-white hover:border-[var(--colors-border-primary)]",
                                            )}
                                        >
                                            <p className="flex-1 min-w-0 text-[14px] font-semibold text-[var(--colors-text-primary)] leading-[20px]">{opt.title}</p>
                                            {/* Radio dot — outer ring + inner sage circle when selected. */}
                                            <div className={cn(
                                                "w-4 h-4 rounded-full border-1 flex items-center justify-center shrink-0",
                                                selected ? "border-[var(--colors-secondary-600)] bg-[var(--colors-secondary-600)]" : "border-[var(--colors-border-primary)] bg-white",
                                            )}>
                                                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </Section>

                    {/* ── Caps & limits ──────────────────────────────── */}
                    <Section title="Caps & limits">
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Max referrals per customer">
                                <NumberField
                                    value={maxReferrals}
                                    onChange={setMaxReferrals}
                                    ariaLabel="Max referrals per customer"
                                    suffixSlot={
                                        <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-l border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                            friends
                                        </span>
                                    }
                                />
                            </Field>
                            <Field label="Earned reward expiry">
                                {/* Same single-container suffix pattern as
                                    Max referrals / Monthly budget — input
                                    on the left, unit on the right of ONE
                                    shared bordered box. Days is the only
                                    unit shipped today; switching to weeks
                                    / months is wired through the seed
                                    when needed. */}
                                <NumberField
                                    value={expiryDays}
                                    onChange={setExpiryDays}
                                    ariaLabel="Earned reward expiry days"
                                    suffixSlot={
                                        <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-l border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                            days
                                        </span>
                                    }
                                />
                            </Field>
                        </div>

                        <Field label="Monthly program budget">
                            <div className="flex items-stretch h-10 w-full border-1 border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all">
                                <span className="px-3 flex items-center text-[14px] text-[var(--colors-text-quaternary)] border-r border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">
                                    AED
                                </span>
                                <input
                                    type="number"
                                    min={0}
                                    aria-label="Monthly program budget"
                                    value={budget === 0 ? "" : budget}
                                    placeholder="0"
                                    onChange={e => {
                                        const raw = e.target.value;
                                        if (raw === "") { setBudget(0); return; }
                                        const stripped = raw.replace(/^0+(?=\d)/, "");
                                        const parsed = parseInt(stripped, 10);
                                        if (!Number.isNaN(parsed)) setBudget(parsed);
                                    }}
                                    className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent"
                                />
                            </div>
                        </Field>
                    </Section>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[var(--colors-border-secondary)] shrink-0 select-none">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave} disabled={!formValid}>
                        Save changes
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function amountUnitLabel(type: ReferralRewardType): string {
    switch (type) {
        case "free_credits": return "credit(s)";
        case "wallet_credit": return "AED";
        case "discount": return "%";
    }
}
