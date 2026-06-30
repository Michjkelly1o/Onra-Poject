"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Apply tax rates view (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Tab body            — 5041-99787
//   • Tax rate dropdown   — 5041-102560 (with "Add new tax rate" header item)
//   • Location dropdown   — 5041-102561 (multi-select w/ Select all)
//   • Delete tax rule     — 5041-105464
//
// Renders one collapsible accordion per predefined category (Membership,
// Credit package, Gift card, Pay rate). Each accordion's body is a list of
// `TaxRule` rows; each row is two dropdowns (rate + location) + an on/off
// toggle + a delete button. A "+ Add another tax rule" link sits below the
// rows. Clicking the trash button on a row opens a confirmation modal.
//
// All reads come from the central store so cross-module sync is automatic:
//   • Archive / delete a tax rate in the Tax rates list  → every rule
//     referencing it drops to the "Select tax rate" placeholder live.
//   • Branch list changes propagate into the location dropdown options.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    ChevronUp, ChevronDown, Trash02, Plus, Check, XClose,
    CreditCard02, Package, Gift01, CoinsHand, CalendarCheck01,
    SlashCircle01, InfoCircle, Lightbulb02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    useAppStore,
    type TaxRule, type TaxRuleCategory, type TaxRate, type TaxRateKind,
} from "@/lib/store";

// ─── Category metadata (matches Figma 5006:73920 / 5041:99307 / 5041:98666) ──

const CATEGORY_META: Record<TaxRuleCategory, {
    title: string;
    Icon: React.FC<{ className?: string }>;
}> = {
    membership:     { title: "Membership",               Icon: CreditCard02   },
    credit_package: { title: "Credit package",           Icon: Package        },
    appointment:    { title: "Appointment",              Icon: CalendarCheck01 },
    gift_card:      { title: "Gift card (redeemed tax)", Icon: Gift01         },
    pay_rate:       { title: "Pay rate",                 Icon: CoinsHand      },
};

const CATEGORY_ORDER: TaxRuleCategory[] = [
    "membership", "credit_package", "appointment", "gift_card", "pay_rate",
];

/** Which categories live under which top-level tab. The Apply view scopes
 *  its rendered accordions to one of these arrays based on `props.kind`.
 *  Membership / Credit package / Appointment also share the "Services"
 *  parent wrapper card on the VAT tab. */
const CATEGORIES_BY_KIND: Record<TaxRateKind, TaxRuleCategory[]> = {
    vat:    ["membership", "credit_package", "appointment", "gift_card"],
    income: ["pay_rate"],
};

const SERVICES_SUBCATEGORIES: TaxRuleCategory[] = ["membership", "credit_package", "appointment"];

// ─── Small toggle (sm size, mirrors Figma 5041-99787) ────────────────────────

function SmallToggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Tax rate dropdown (Figma 5041-102560) ───────────────────────────────────
//
// Trigger: rounded white input field with placeholder "Select tax rate" or
// the selected rate label "{name} ({rate}%)". Chevron-down on the right.
//
// Menu items:
//   • "+ Add new tax rate"  — opens the create-rate modal via `onCreateRate`
//   • divider
//   • "No tax rate"          — sets the rule's taxRateId to undefined
//   • active rate options    — clicking sets the rule's taxRateId

function TaxRateSelect({ value, rates, onChange, onCreateRate, disabled }: {
    value: string | undefined;
    rates: TaxRate[];
    onChange: (next: string | undefined) => void;
    onCreateRate: () => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selected = rates.find(r => r.id === value);
    const triggerLabel = selected
        ? `${selected.name} (${selected.ratePercentage}%)`
        : "Select tax rate";

    // Only active rates show as choices (an archived/deleted rate would have
    // already cleared its taxRateId via the store's cross-module sync, so we
    // never need to render an archived rate in the list).
    const visible = rates.filter(r => r.status === "active");

    return (
        <div ref={ref} className="relative flex-1 min-w-0">
            <button type="button"
                disabled={disabled}
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "w-full h-11 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#fbfffd] transition-colors",
                    disabled && "opacity-60 cursor-not-allowed",
                )}>
                <span className={cn(
                    "flex-1 text-left text-[16px] leading-[24px] truncate",
                    selected ? "text-[#101828]" : "text-[#667085]",
                )}>
                    {triggerLabel}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
                    {/* Add new tax rate — header item with + icon */}
                    <button type="button"
                        onClick={() => { setOpen(false); onCreateRate(); }}
                        className="w-full flex items-center gap-2 px-3 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Plus className="w-5 h-5 text-[#667085]" />
                        Add new tax rate
                    </button>
                    <div className="h-px bg-[#e4e7ec] my-1 mx-2" />

                    {/* No tax rate option */}
                    <button type="button"
                        onClick={() => { setOpen(false); onChange(undefined); }}
                        className={cn(
                            "w-full flex items-center justify-between px-3 py-[10px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                            value === undefined ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054]",
                        )}>
                        <span>No tax rate</span>
                        {value === undefined && <Check className="w-5 h-5 text-[#658774]" />}
                    </button>

                    {visible.map(r => (
                        <button key={r.id} type="button"
                            onClick={() => { setOpen(false); onChange(r.id); }}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-[10px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                                value === r.id ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054]",
                            )}>
                            <span>{r.name} ({r.ratePercentage}%)</span>
                            {value === r.id && <Check className="w-5 h-5 text-[#658774]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Location multi-select (Figma 5041-102561) ───────────────────────────────
//
// Trigger label adapts to selection state:
//   • allLocations=true            → "All locations selected"
//   • locationIds = []             → "Select location" (placeholder color)
//   • locationIds = [single]       → that branch's name
//   • locationIds = [2+]           → "N locations selected"

function LocationSelect({ rule, branchOptions, onChange, disabled }: {
    rule: TaxRule;
    branchOptions: { id: string; name: string }[];
    onChange: (patch: { allLocations: boolean; locationIds: string[] }) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const triggerLabel = (() => {
        if (rule.allLocations) return "All locations selected";
        if (rule.locationIds.length === 0) return "Select location";
        if (rule.locationIds.length === 1) {
            return branchOptions.find(b => b.id === rule.locationIds[0])?.name ?? "1 location selected";
        }
        return `${rule.locationIds.length} locations selected`;
    })();
    const isPlaceholder = !rule.allLocations && rule.locationIds.length === 0;

    // Derived: "Select all" effective state (checked when allLocations OR
    // every branch is explicitly listed).
    const allBranchIds = branchOptions.map(b => b.id);
    const allListed = !rule.allLocations && allBranchIds.length > 0 && allBranchIds.every(id => rule.locationIds.includes(id));
    const selectAllChecked = rule.allLocations || allListed;

    function toggleSelectAll() {
        if (selectAllChecked) {
            onChange({ allLocations: false, locationIds: [] });
        } else {
            onChange({ allLocations: true, locationIds: [] });
        }
    }
    function toggleOne(id: string) {
        // If the rule was on "All locations", convert to explicit list first.
        let nextIds = rule.allLocations
            ? allBranchIds.filter(b => b !== id)
            : rule.locationIds.includes(id)
                ? rule.locationIds.filter(b => b !== id)
                : [...rule.locationIds, id];
        // Normalize ordering to match branchOptions ordering for stability.
        nextIds = allBranchIds.filter(b => nextIds.includes(b));
        // Collapse to allLocations:true when every active branch is included
        // (matches the Figma's "All locations selected" trigger label).
        if (nextIds.length === allBranchIds.length) {
            onChange({ allLocations: true, locationIds: [] });
        } else {
            onChange({ allLocations: false, locationIds: nextIds });
        }
    }

    return (
        <div ref={ref} className="relative flex-1 min-w-0">
            <button type="button"
                disabled={disabled}
                onClick={() => setOpen(p => !p)}
                className={cn(
                    "w-full h-11 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#fbfffd] transition-colors",
                    disabled && "opacity-60 cursor-not-allowed",
                )}>
                <span className={cn(
                    "flex-1 text-left text-[16px] leading-[24px] truncate",
                    isPlaceholder ? "text-[#667085]" : "text-[#101828]",
                )}>
                    {triggerLabel}
                </span>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>

            {open && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
                    <button type="button"
                        onClick={toggleSelectAll}
                        className="w-full flex items-center gap-3 px-3 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <CheckboxBox checked={selectAllChecked} />
                        Select all
                    </button>
                    {branchOptions.map(b => {
                        const checked = rule.allLocations || rule.locationIds.includes(b.id);
                        return (
                            <button key={b.id} type="button"
                                onClick={() => toggleOne(b.id)}
                                className="w-full flex items-center gap-3 px-3 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                                <CheckboxBox checked={checked} />
                                {b.name}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function CheckboxBox({ checked }: { checked: boolean }) {
    return (
        <span className={cn(
            "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
            checked ? "bg-[#658774] border-[#658774] text-white" : "bg-white border-[#d0d5dd]",
        )}>
            {checked && <Check className="w-3 h-3" />}
        </span>
    );
}

// ─── Rule status confirmation modal (Deactivate / Reactivate) ──────────────
//
// Same shape as the Delete modal — featured circle icon at top, centered
// title + body, Cancel + confirm buttons. Tone matches the existing
// row-action ActionModal convention used across the app:
//   • Deactivate → red-tone (destructive), SlashCircle01 icon
//   • Reactivate → green-tone (success),    Check icon

function RuleStatusModal({ action, onConfirm, onCancel }: {
    action: "deactivate" | "reactivate";
    onConfirm: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onCancel]);
    const isDeactivate = action === "deactivate";
    const cfg = isDeactivate
        ? {
            iconBg: "bg-[#fee4e2]",
            Icon: SlashCircle01,
            iconColor: "text-[#d92d20]",
            title: "Deactivate this tax rule?",
            body: "This tax rule will stop applying to future sales. The configuration is preserved — you can reactivate it any time.",
            confirmLabel: "Deactivate",
            variant: "destructive" as const,
        }
        : {
            iconBg: "bg-[#e9fff3]",
            Icon: Check,
            iconColor: "text-[#658774]",
            title: "Reactivate this tax rule?",
            body: "This tax rule will resume applying to future sales in the selected locations.",
            confirmLabel: "Reactivate",
            variant: "primary" as const,
        };
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[400px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    aria-label="Close"
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", cfg.iconBg)}>
                        <cfg.Icon className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.body}</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant={cfg.variant} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Delete tax rule confirmation modal (Figma 5041-105464) ──────────────────

function DeleteTaxRuleModal({ onConfirm, onCancel }: {
    onConfirm: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onCancel]);
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[400px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    aria-label="Close"
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash02 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            Delete this tax rule?
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            Are you sure you want to delete this tax rule? This will remove all of the information.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>Delete</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Tax rule row (rate dropdown + location dropdown + toggle + trash) ──────

function TaxRuleRow({ rule, rates, branchOptions, onUpdate, onToggle, onDelete, onCreateRate, canDelete = true }: {
    rule: TaxRule;
    rates: TaxRate[];
    branchOptions: { id: string; name: string }[];
    onUpdate: (id: string, patch: Partial<Omit<TaxRule, "id" | "createdAt">>) => void;
    onToggle: (id: string, next: boolean) => void;
    onDelete: (rule: TaxRule) => void;
    onCreateRate: () => void;
    /** Disable the trash button when this is the only rule in the
     *  category — every category must keep at least one rule for the
     *  inheritance / fallback to resolve. */
    canDelete?: boolean;
}) {
    return (
        <div className="flex gap-6 items-center w-full">
            <div className="flex flex-1 gap-4 items-center min-w-0">
                <TaxRateSelect
                    value={rule.taxRateId}
                    rates={rates}
                    onChange={taxRateId => onUpdate(rule.id, { taxRateId })}
                    onCreateRate={onCreateRate}
                />
                <LocationSelect
                    rule={rule}
                    branchOptions={branchOptions}
                    onChange={patch => onUpdate(rule.id, patch)}
                />
            </div>
            <SmallToggle
                on={rule.status === "active"}
                onChange={next => onToggle(rule.id, next)}
                ariaLabel="Tax rule active toggle"
            />
            <button type="button"
                onClick={() => canDelete && onDelete(rule)}
                disabled={!canDelete}
                title={canDelete ? "Delete tax rule" : "At least one rule must remain — add another rule first."}
                aria-label="Delete tax rule"
                className={cn(
                    "w-11 h-11 flex items-center justify-center border-1 rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors shrink-0",
                    canDelete
                        ? "border-[#d0d5dd] hover:bg-[#fef3f2]"
                        : "border-[#e4e7ec] cursor-not-allowed opacity-50",
                )}>
                <Trash02 className={cn("w-5 h-5", canDelete ? "text-[#d92d20]" : "text-[#98a2b3]")} />
            </button>
        </div>
    );
}

// ─── Hover tooltip (lightweight, no portal) ──────────────────────────────────
// Renders a dark text bubble above the trigger child on mouseenter +
// focus, with a small arrow pointing down. Used by the Gift card category
// header to surface the redeemed-tax explanation. The native HTML `title`
// attribute is unreliable across browsers + doesn't trigger on focus, so
// this is a real DOM-based replacement.
function HoverTooltip({ text, children }: { text: string; children: React.ReactNode }) {
    const [shown, setShown] = useState(false);
    return (
        <span
            className="relative inline-flex"
            onMouseEnter={() => setShown(true)}
            onMouseLeave={() => setShown(false)}
            onFocus={() => setShown(true)}
            onBlur={() => setShown(false)}
            tabIndex={0}
        >
            {children}
            {shown && (
                <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50">
                    <span className="block w-[260px] rounded-[8px] bg-[#0c111d] text-white text-[12px] leading-[18px] font-medium px-3 py-2 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
                        {text}
                    </span>
                    {/* Down-pointing arrow */}
                    <span className="block absolute left-1/2 -translate-x-1/2 top-full">
                        <svg viewBox="0 0 12 6" className="w-3 h-1.5"><path d="M6 6 L0 0 L12 0 Z" fill="#0c111d"/></svg>
                    </span>
                </span>
            )}
        </span>
    );
}

// ─── Category accordion (collapsible card per category) ──────────────────────

function CategoryAccordion({
    category, rules, rates, branchOptions, open, onToggleOpen,
    onAddRule, onUpdateRule, onToggleRule, onDeleteRule, onCreateRate,
    nested = false,
    headerPill,
    headerTooltip,
}: {
    category: TaxRuleCategory;
    rules: TaxRule[];
    rates: TaxRate[];
    branchOptions: { id: string; name: string }[];
    open: boolean;
    onToggleOpen: () => void;
    onAddRule: () => void;
    onUpdateRule: (id: string, patch: Partial<Omit<TaxRule, "id" | "createdAt">>) => void;
    onToggleRule: (id: string, next: boolean) => void;
    onDeleteRule: (rule: TaxRule) => void;
    onCreateRate: () => void;
    /** When true, render WITHOUT the outer border + reduced padding —
     *  used inside the Services parent card where the outer chrome is
     *  owned by the parent. Header is also rendered slimmer (smaller
     *  avatar / no border around the icon). */
    nested?: boolean;
    /** Optional pill label rendered to the right of the header — used by
     *  the Gift card category to surface "Tax at redemption". */
    headerPill?: string;
    /** Optional tooltip text shown on hover of the info icon next to the
     *  header title. Used by the Gift card category to explain the
     *  redeemed-tax semantic. */
    headerTooltip?: string;
}) {
    const meta = CATEGORY_META[category];
    const Icon = meta.Icon;
    // Nested sub-rows (Membership / Credit package / Appointment) sit
    // INSIDE the Services parent accordion which already owns the
    // collapse behaviour — so their own header is non-clickable and the
    // body is always visible. Only stand-alone cards (Gift card, Pay
    // rate) keep the chevron + expand/collapse interaction.
    const bodyVisible = nested ? true : open;
    return (
        <div className={cn(
            "flex flex-col gap-3",
            nested
                ? "pt-1"
                : "border-1 border-[#e4e7ec] rounded-[16px] p-4 gap-4",
        )}>
            {/* Header — clickable only when NOT nested (the parent
                accordion owns expand/collapse for nested sub-rows). */}
            {nested ? (
                <div className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-[#475467] shrink-0" />
                        <span className="text-[14px] font-medium text-[#101828] leading-[20px]">
                            {meta.title}
                        </span>
                    </div>
                </div>
            ) : (
                <button type="button" onClick={onToggleOpen}
                    className="flex items-center justify-between w-full gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
                            <Icon className="w-5 h-5 text-[#475467]" />
                            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
                        </div>
                        <div className="flex flex-col items-start text-left min-w-0">
                            <span className="text-[14px] font-medium text-[#101828] leading-[20px] flex items-center gap-1.5">
                                {meta.title}
                                {headerTooltip && (
                                    <HoverTooltip text={headerTooltip}>
                                        <InfoCircle className="w-4 h-4 text-[#98a2b3]" aria-label="info" />
                                    </HoverTooltip>
                                )}
                            </span>
                            <span className="text-[14px] text-[#667085] leading-[20px]">
                                {rules.length} tax rule{rules.length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        {headerPill && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-[12px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]">
                                {headerPill}
                            </span>
                        )}
                        {open ? <ChevronUp className="w-5 h-5 text-[#667085]" /> : <ChevronDown className="w-5 h-5 text-[#667085]" />}
                    </div>
                </button>
            )}

            {/* Body */}
            {bodyVisible && (
                <div className="flex flex-col gap-4 py-2 w-full">
                    {rules.length === 0 ? (
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            No tax rules yet. Add one to apply tax to this category.
                        </p>
                    ) : (
                        rules.map(rule => (
                            <TaxRuleRow
                                key={rule.id}
                                rule={rule}
                                rates={rates}
                                branchOptions={branchOptions}
                                onUpdate={onUpdateRule}
                                onToggle={onToggleRule}
                                onDelete={onDeleteRule}
                                onCreateRate={onCreateRate}
                                // Every category must have at least one rule
                                // (the inheritance / catalog defaults rely
                                // on it). When there's only ONE rule the
                                // trash button is disabled so the admin
                                // can't accidentally wipe a category;
                                // adding a 2nd rule unlocks delete on
                                // both rows.
                                canDelete={rules.length > 1}
                            />
                        ))
                    )}

                    {/* "+ Add another tax rule" link — same visual as Figma */}
                    <button type="button" onClick={onAddRule}
                        className="flex items-center gap-[6px] self-start text-[14px] font-semibold text-[#475467] hover:text-[#101828] transition-colors">
                        <Plus className="w-5 h-5" />
                        Add another tax rule
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Top-level view ──────────────────────────────────────────────────────────

export interface ApplyTaxRatesViewProps {
    /** Top-level tab kind — drives which categories render. */
    kind: TaxRateKind;
    /** When set, render ONLY this single category (used by the Income tax
     *  inline Pay rate editor at the top of the page). */
    showOnly?: TaxRuleCategory;
    /** Called when the user clicks "+ Add new tax rate" inside the rate
     *  dropdown. Wired to the page's create-rate modal. */
    onCreateRate: () => void;
}

export function ApplyTaxRatesView({ kind, showOnly, onCreateRate }: ApplyTaxRatesViewProps) {
    const taxRates       = useAppStore(s => s.taxRates);
    const taxRules       = useAppStore(s => s.taxRules);
    const branches       = useAppStore(s => s.branches);
    const addTaxRule     = useAppStore(s => s.addTaxRule);
    const updateTaxRule  = useAppStore(s => s.updateTaxRule);
    const setTaxRuleStatus = useAppStore(s => s.setTaxRuleStatus);
    const deleteTaxRule  = useAppStore(s => s.deleteTaxRule);
    const showToast      = useAppStore(s => s.showToast);

    // Every category starts expanded — matches the Figma demo state.
    const [openCats, setOpenCats] = useState<Record<TaxRuleCategory, boolean>>({
        membership: true, credit_package: true, appointment: true, gift_card: true, pay_rate: true,
    });
    /** Services parent card open state — independent of its sub-cards
     *  so the admin can collapse the whole Services group while leaving
     *  individual sub-categories' open state intact. */
    const [servicesOpen, setServicesOpen] = useState(true);
    const [pendingDelete, setPendingDelete] = useState<TaxRule | null>(null);
    /** Toggle-flip confirmation — captures the rule + the target action so the
     *  modal can show the right copy and the confirm handler can apply it. */
    const [pendingStatus, setPendingStatus] = useState<{
        rule: TaxRule; action: "deactivate" | "reactivate";
    } | null>(null);

    // Active branches only — sourced from the live `branches` slice so
    // adds/archives in Business & Locations propagate immediately.
    const branchOptions = useMemo(
        () => branches
            .filter(b => b.status === "active")
            .map(b => ({ id: b.id, name: b.name })),
        [branches],
    );

    // Rates filtered by kind — VAT rules can only pick VAT rates and vice
    // versa. Keeps the cross-pollination guard tight without needing extra
    // validation in the store.
    const ratesForKind = useMemo(
        () => taxRates.filter(r => r.kind === kind),
        [taxRates, kind],
    );

    // Group rules by category, preserving createdAt order.
    const rulesByCategory = useMemo(() => {
        const byCat: Record<TaxRuleCategory, TaxRule[]> = {
            membership: [], credit_package: [], appointment: [], gift_card: [], pay_rate: [],
        };
        for (const r of taxRules) {
            byCat[r.category].push(r);
        }
        for (const k of CATEGORY_ORDER) {
            byCat[k].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        }
        return byCat;
    }, [taxRules]);

    function handleAddRule(category: TaxRuleCategory) {
        addTaxRule(category);
        const meta = CATEGORY_META[category];
        showToast(
            "Tax rule added",
            `A new draft tax rule was added under ${meta.title}.`,
            "success", "check",
        );
    }
    /** Toggle clicked — open a confirmation modal instead of flipping
     *  immediately, mirroring every other destructive / lifecycle change in
     *  the app (CLAUDE.md rule #3: state-changing actions are modals). */
    function handleToggleRule(id: string, next: boolean) {
        const rule = taxRules.find(r => r.id === id);
        if (!rule) return;
        setPendingStatus({
            rule,
            action: next ? "reactivate" : "deactivate",
        });
    }
    /** Confirm handler for the deactivate/reactivate modal — applies the
     *  status flip + emits the matching toast. */
    function handleStatusConfirmed() {
        if (!pendingStatus) return;
        const { rule, action } = pendingStatus;
        const nextActive = action === "reactivate";
        setTaxRuleStatus(rule.id, nextActive ? "active" : "inactive");
        showToast(
            nextActive ? "Tax rule activated" : "Tax rule deactivated",
            nextActive
                ? "This tax rule now applies to future sales in the selected locations."
                : "This tax rule is paused. Configuration is preserved.",
            nextActive ? "success" : "error",
            nextActive ? "check" : "slash",
        );
        setPendingStatus(null);
    }
    function handleDeleteConfirmed() {
        if (!pendingDelete) return;
        deleteTaxRule(pendingDelete.id);
        showToast(
            "Tax rule deleted",
            "The tax rule has been permanently removed.",
            "success", "trash",
        );
        setPendingDelete(null);
    }

    // ── Render switch ──────────────────────────────────────────────────────
    // showOnly mode renders a single category accordion (no outer wrapper)
    // — used by the Income tax tab's inline Pay rate editor at the top of
    // the page. Otherwise we render the full Apply tax rates card with the
    // Services parent + Gift card (VAT) or Pay rate (Income).

    const showSingleCategory = showOnly && rulesByCategory[showOnly] !== undefined;

    if (showSingleCategory) {
        const cat = showOnly!;
        return (
            <>
                <CategoryAccordion
                    category={cat}
                    rules={rulesByCategory[cat]}
                    rates={ratesForKind}
                    branchOptions={branchOptions}
                    open={openCats[cat]}
                    onToggleOpen={() => setOpenCats(p => ({ ...p, [cat]: !p[cat] }))}
                    onAddRule={() => handleAddRule(cat)}
                    onUpdateRule={updateTaxRule}
                    onToggleRule={handleToggleRule}
                    onDeleteRule={rule => setPendingDelete(rule)}
                    onCreateRate={onCreateRate}
                />
                {pendingDelete && (
                    <DeleteTaxRuleModal
                        onConfirm={handleDeleteConfirmed}
                        onCancel={() => setPendingDelete(null)}
                    />
                )}
                {pendingStatus && (
                    <RuleStatusModal
                        action={pendingStatus.action}
                        onConfirm={handleStatusConfirmed}
                        onCancel={() => setPendingStatus(null)}
                    />
                )}
            </>
        );
    }

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 min-h-[760px]">
            {/* Header */}
            <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">Apply tax rates</p>
                <p className="text-[14px] text-[#475467] leading-[20px]">Set tax rules for all categories</p>
            </div>

            {/* Category stack */}
            <div className="flex flex-col gap-4">
                {kind === "vat" && (
                    <>
                        {/* Services parent card containing 3 sub-categories
                            (Membership / Credit package / Appointment).
                            The parent owns the outer border + the "All
                            service categories inherit VAT…" info banner;
                            each sub-row provides its own header + rules
                            list + Add another rule link without an inner
                            border.

                            `inheritedRate` is computed from the ACTIVE
                            all-locations rules under the Services sub-
                            categories — those rules ARE the inheritance,
                            so their rate is what the banner should
                            display. Falls back to undefined when no
                            inheritance rule exists yet (the banner hides
                            in that case). */}
                        <ServicesParentCard
                            open={servicesOpen}
                            onToggleOpen={() => setServicesOpen(p => !p)}
                            servicesRuleCount={
                                SERVICES_SUBCATEGORIES.reduce(
                                    (n, c) => n + rulesByCategory[c].length, 0,
                                )
                            }
                            inheritedRate={(() => {
                                for (const cat of SERVICES_SUBCATEGORIES) {
                                    const inheritRule = rulesByCategory[cat].find(
                                        r => r.allLocations
                                            && r.status === "active"
                                            && r.taxRateId,
                                    );
                                    if (!inheritRule) continue;
                                    const rate = taxRates.find(
                                        t => t.id === inheritRule.taxRateId
                                            && t.status === "active",
                                    );
                                    if (rate && rate.type !== "exempt") {
                                        return rate.ratePercentage;
                                    }
                                }
                                return undefined;
                            })()}
                        >
                            {SERVICES_SUBCATEGORIES.map(cat => (
                                <CategoryAccordion
                                    key={cat}
                                    category={cat}
                                    rules={rulesByCategory[cat]}
                                    rates={ratesForKind}
                                    branchOptions={branchOptions}
                                    open={openCats[cat]}
                                    onToggleOpen={() => setOpenCats(p => ({ ...p, [cat]: !p[cat] }))}
                                    onAddRule={() => handleAddRule(cat)}
                                    onUpdateRule={updateTaxRule}
                                    onToggleRule={handleToggleRule}
                                    onDeleteRule={rule => setPendingDelete(rule)}
                                    onCreateRate={onCreateRate}
                                    nested
                                />
                            ))}
                        </ServicesParentCard>

                        {/* Gift card (redeemed tax) — same editable accordion
                            shape as the Services sub-categories. The "Tax
                            at redemption" pill + tooltip on the header
                            explain the underlying semantic (gift cards
                            are stored value; tax applies when redeemed
                            on a taxable service/product, not at
                            purchase) so admins still understand WHY
                            they're configuring a redeemed-tax rule. */}
                        <CategoryAccordion
                            category="gift_card"
                            rules={rulesByCategory.gift_card}
                            rates={ratesForKind}
                            branchOptions={branchOptions}
                            open={openCats.gift_card}
                            onToggleOpen={() => setOpenCats(p => ({ ...p, gift_card: !p.gift_card }))}
                            onAddRule={() => handleAddRule("gift_card")}
                            onUpdateRule={updateTaxRule}
                            onToggleRule={handleToggleRule}
                            onDeleteRule={rule => setPendingDelete(rule)}
                            onCreateRate={onCreateRate}
                            headerPill="Tax at redemption"
                            headerTooltip="Gift cards are stored value, not a sale. No VAT is charged when the card is purchased, tax applies when the card is redeemed on a service or product. This avoids double taxation."
                        />
                    </>
                )}

                {kind === "income" && (
                    <CategoryAccordion
                        category="pay_rate"
                        rules={rulesByCategory.pay_rate}
                        rates={ratesForKind}
                        branchOptions={branchOptions}
                        open={openCats.pay_rate}
                        onToggleOpen={() => setOpenCats(p => ({ ...p, pay_rate: !p.pay_rate }))}
                        onAddRule={() => handleAddRule("pay_rate")}
                        onUpdateRule={updateTaxRule}
                        onToggleRule={handleToggleRule}
                        onDeleteRule={rule => setPendingDelete(rule)}
                        onCreateRate={onCreateRate}
                    />
                )}
            </div>

            {pendingDelete && (
                <DeleteTaxRuleModal
                    onConfirm={handleDeleteConfirmed}
                    onCancel={() => setPendingDelete(null)}
                />
            )}
            {pendingStatus && (
                <RuleStatusModal
                    action={pendingStatus.action}
                    onConfirm={handleStatusConfirmed}
                    onCancel={() => setPendingStatus(null)}
                />
            )}
        </div>
    );
}

// ─── Services parent card ────────────────────────────────────────────────────
// Wraps the 3 sub-category accordions (Membership / Credit package /
// Appointment) per Figma 5041:99307. Provides the outer card chrome + the
// "All service categories inherit VAT X% unless overridden below." info
// banner at the bottom. Children are rendered in `nested` mode (no inner
// border on their own accordions).
function ServicesParentCard({ open, onToggleOpen, servicesRuleCount, inheritedRate, children }: {
    open: boolean;
    onToggleOpen: () => void;
    servicesRuleCount: number;
    inheritedRate: number | undefined;
    children: React.ReactNode;
}) {
    return (
        <div className="border-1 border-[#e4e7ec] rounded-[16px] p-4 flex flex-col gap-4">
            {/* Header — clickable to expand/collapse */}
            <button type="button" onClick={onToggleOpen}
                className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
                        <Package className="w-5 h-5 text-[#475467]" />
                        <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
                    </div>
                    <div className="flex flex-col items-start text-left">
                        <span className="text-[14px] font-semibold text-[#101828] leading-[20px]">Services</span>
                        <span className="text-[12px] text-[#667085] leading-[18px]">
                            Memberships · Credit packages · Appointments
                        </span>
                    </div>
                </div>
                {open ? <ChevronUp className="w-5 h-5 text-[#667085]" /> : <ChevronDown className="w-5 h-5 text-[#667085]" />}
            </button>

            {open && (
                <div className="flex flex-col gap-4">
                    {children}
                    {/* Info banner — inheritance hint. Hidden when there are
                        no rules yet (the rate inheritance only makes sense
                        once at least one rule is configured). */}
                    {servicesRuleCount > 0 && inheritedRate !== undefined && (
                        <div className="flex items-center gap-3 px-4 py-3 bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px]">
                            <Lightbulb02 className="w-4 h-4 text-[#475467] shrink-0" />
                            <p className="text-[13px] text-[#475467] leading-[18px]">
                                All service categories inherit VAT {inheritedRate}% unless overridden below.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

