"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Pay rate creation / edit form (Module 10 §6.3 / §6.4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by both:
//   • /admin/staff/pay-rate/new            → mode = "create"
//   • /admin/staff/pay-rate/[id]/edit      → mode = "edit" (id required)
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • Step 1 base               3714-38497
//   • Step 1 flat               7093-290426
//   • Step 1 tiered             7093-290452
//   • Step 1 % of revenue       7093-290481
//   • Step 1 hybrid (bonus)     7093-290508
//   • Step 1 hybrid (revenue)   7093-290539
//   • Step 1 monthly salary     7093-290570
//   • Step 2 assign branch      3778-30773
//
// Layout: full page with a 72px header (× close + title), then a body with
//   • Left progress steps   (w-300px)
//   • Center content card   (max-w-628px, scrollable form, fixed footer)
//   • Right preview card    (w-400px) showing how the pay rate will render
//
// "Tax rates" section in the Figma is intentionally NOT implemented per the
// project brief — that lives in a future /tax module.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, MarkerPin01, Check, Plus, Minus, Percent01,
    DistributeSpacingVertical, LayersTwo01, Sliders01, Calendar, CoinsHand,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { FieldLabel } from "@/components/patterns/FieldLabel";
import {
    useAppStore, DEFAULT_BRANCH_ID,
    computePayRateDisplay,
    type PayRate, type PayRateType, type PayRateTier, type PayRateHybridCondition,
    type FlatPayRate, type TieredPayRate, type RevenuePayRate, type HybridPayRate, type MonthlyPayRate,
    type Branch,
} from "@/lib/store";

// ─── Form value (mirror of PayRate without id/createdAt/usage/status) ───────
//
// A single shape that can describe any variant — the Save action narrows back
// to the discriminated union at submit time. Optional numeric fields stay
// nullable so the user can clear them.

interface FormValue {
    name: string;
    type: PayRateType;
    branchId: string;
    onlyCheckedIn: boolean;
    includeLateCancelled: boolean;
    // flat / hybrid base / monthly fixedSalary all live here per type
    flatAmount: number | "";
    tiers: PayRateTier[];
    splitPercent: number | "";         // revenue OR hybrid-revenue
    payPerCustomer: number | "";       // revenue only
    baseRate: number | "";             // hybrid only
    hybridConditionKind: "bonus_attendance" | "revenue";
    hybridBonusThreshold: number | "";
    hybridBonusPerCustomer: number | "";
    fixedSalary: number | "";
    bonusOfSalaryPercent: number | "";
    bonusCap: number | "";
    salesCommissionPackagesPercent: number | "";
    salesCommissionMembershipsPercent: number | "";
    /** Optional per-rate tax override (Figma 6106:10962). Empty string =
     *  "No tax rate" (the rate inherits the global pay-rate tax rule).
     *  Populated with a `tax_rates.id` when the admin picks one. */
    taxRateId: string;
}

function emptyForm(): FormValue {
    return {
        name: "",
        type: "flat",
        branchId: DEFAULT_BRANCH_ID,
        onlyCheckedIn: false,
        includeLateCancelled: true,
        flatAmount: "",
        tiers: [
            { id: `t_${Date.now()}_1`, from: 1, to: 5, aed: 0 },
        ],
        splitPercent: "",
        payPerCustomer: "",
        baseRate: "",
        hybridConditionKind: "bonus_attendance",
        hybridBonusThreshold: "",
        hybridBonusPerCustomer: "",
        fixedSalary: "",
        bonusOfSalaryPercent: "",
        bonusCap: "",
        salesCommissionPackagesPercent: "",
        salesCommissionMembershipsPercent: "",
        taxRateId: "",
    };
}

/** Inflate an existing PayRate back into the editor shape. */
function formFromPayRate(p: PayRate): FormValue {
    const base = emptyForm();
    base.name = p.name;
    base.type = p.type;
    base.branchId = p.branchId;
    base.onlyCheckedIn = p.onlyCheckedIn ?? false;
    base.includeLateCancelled = p.includeLateCancelled ?? false;
    base.taxRateId = p.taxRateId ?? "";
    switch (p.type) {
        case "flat":
            base.flatAmount = p.flatAmount;
            break;
        case "tiered":
            base.tiers = p.tiers.length > 0 ? p.tiers.map(t => ({ ...t })) : base.tiers;
            break;
        case "revenue":
            base.splitPercent = p.splitPercent;
            base.payPerCustomer = p.payPerCustomer ?? "";
            break;
        case "hybrid":
            base.baseRate = p.baseRate;
            base.hybridConditionKind = p.condition.kind;
            if (p.condition.kind === "bonus_attendance") {
                base.hybridBonusThreshold = p.condition.bonusThreshold;
                base.hybridBonusPerCustomer = p.condition.bonusPerCustomer;
            } else {
                base.splitPercent = p.condition.splitPercent;
            }
            break;
        case "monthly":
            base.fixedSalary = p.fixedSalary;
            base.bonusOfSalaryPercent = p.bonusOfSalaryPercent ?? "";
            base.bonusCap = p.bonusCap ?? "";
            base.salesCommissionPackagesPercent = p.salesCommissionPackagesPercent ?? "";
            base.salesCommissionMembershipsPercent = p.salesCommissionMembershipsPercent ?? "";
            break;
    }
    return base;
}

/** Narrow the form to a concrete PayRate variant at submit time. The store's
 *  `addPayRate` accepts `Omit<PayRate, "id"> & { id?: string }`; we satisfy
 *  that by building a full PayRate (with a placeholder id when creating) and
 *  letting the store discard or honour the supplied id. */
function payloadFromForm(form: FormValue, id?: string, usageCount = 0): PayRate {
    const resolvedId = id ?? `pr_preview_${form.type}`;
    // Flat pay and Monthly salary don't depend on attendance — force
    // both attendance toggles off so a stale value can't leak through
    // when an admin swaps an existing Tiered/Hybrid row to Flat or
    // Monthly. The form already hides the toggles for these two types;
    // this is the safety net at the save layer.
    const hidesAttendanceToggles = form.type === "flat" || form.type === "monthly";
    const baseShared = {
        id: resolvedId,
        name: form.name.trim(),
        branchId: form.branchId,
        status: "active" as const,
        onlyCheckedIn:        hidesAttendanceToggles ? false : form.onlyCheckedIn,
        includeLateCancelled: hidesAttendanceToggles ? false : form.includeLateCancelled,
        usageCount,
        // Empty-string sentinel → undefined so the persisted record reads
        // as "no override" instead of holding an empty FK string.
        taxRateId: form.taxRateId === "" ? undefined : form.taxRateId,
    };
    const num = (v: number | "") => (v === "" ? 0 : v);
    switch (form.type) {
        case "flat":
            return { ...baseShared, type: "flat", flatAmount: num(form.flatAmount) };
        case "tiered":
            return { ...baseShared, type: "tiered", tiers: form.tiers };
        case "revenue":
            return {
                ...baseShared, type: "revenue",
                splitPercent: num(form.splitPercent),
                payPerCustomer: form.payPerCustomer === "" ? undefined : form.payPerCustomer,
            };
        case "hybrid": {
            const condition: PayRateHybridCondition = form.hybridConditionKind === "bonus_attendance"
                ? { kind: "bonus_attendance", bonusThreshold: num(form.hybridBonusThreshold), bonusPerCustomer: num(form.hybridBonusPerCustomer) }
                : { kind: "revenue", splitPercent: num(form.splitPercent) };
            return { ...baseShared, type: "hybrid", baseRate: num(form.baseRate), condition };
        }
        case "monthly":
            return {
                ...baseShared, type: "monthly",
                fixedSalary: num(form.fixedSalary),
                bonusOfSalaryPercent: form.bonusOfSalaryPercent === "" ? undefined : form.bonusOfSalaryPercent,
                bonusCap: form.bonusCap === "" ? undefined : form.bonusCap,
                salesCommissionPackagesPercent: form.salesCommissionPackagesPercent === "" ? undefined : form.salesCommissionPackagesPercent,
                salesCommissionMembershipsPercent: form.salesCommissionMembershipsPercent === "" ? undefined : form.salesCommissionMembershipsPercent,
            };
    }
}

// ─── Step 1 validation ──────────────────────────────────────────────────────

function isStep1Valid(form: FormValue): boolean {
    if (!form.name.trim()) return false;
    switch (form.type) {
        case "flat":    return form.flatAmount !== "" && form.flatAmount > 0;
        case "tiered":  return form.tiers.length > 0 && form.tiers.every(t => t.from >= 0 && t.to >= t.from && t.aed > 0);
        case "revenue": return form.splitPercent !== "" && form.splitPercent > 0;
        case "hybrid":
            if (form.baseRate === "" || form.baseRate <= 0) return false;
            if (form.hybridConditionKind === "bonus_attendance") {
                return form.hybridBonusThreshold !== "" && form.hybridBonusPerCustomer !== ""
                    && form.hybridBonusThreshold > 0 && form.hybridBonusPerCustomer > 0;
            }
            return form.splitPercent !== "" && form.splitPercent > 0;
        case "monthly": return form.fixedSalary !== "" && form.fixedSalary > 0;
    }
}

function isStep2Valid(form: FormValue): boolean { return !!form.branchId; }

// ─── Display config for the type cards (icon + label + subtitle) ────────────

const TYPE_CARDS: { value: PayRateType; label: string; subtitle: string; Icon: React.ElementType }[] = [
    { value: "flat",    label: "Flat rate",             subtitle: "Fixed amount per class regardless of attendance", Icon: DistributeSpacingVertical },
    { value: "tiered",  label: "Tiered",                subtitle: "Different rate based on how many customers attend", Icon: LayersTwo01 },
    { value: "revenue", label: "Percentage of revenue", subtitle: "Instructor earns a percentage of class revenue", Icon: Percent01 },
    { value: "hybrid",  label: "Hybrid",                subtitle: "Base rate plus per client bonus or revenue %", Icon: Sliders01 },
    { value: "monthly", label: "Monthly salary",        subtitle: "Fixed monthly salary with bonus and sales commission", Icon: Calendar },
];

// Same palette as the list-page badges so the preview pill matches the table.
const TYPE_BADGE_STYLE: Record<PayRateType, string> = {
    flat:    "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    tiered:  "bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708]",
    revenue: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    hybrid:  "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    monthly: "bg-[#f5fffa] border-1 border-[#aad4bd] text-[#3b5446]",
};
const TYPE_PREVIEW_LABEL: Record<PayRateType, string> = {
    flat: "Flat", tiered: "Tiered", revenue: "% revenue", hybrid: "Hybrid", monthly: "Monthly",
};

// ─── Reusable form atoms ────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
    return (
        <div className="flex flex-col gap-1 w-full">
            <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</p>
            {subtitle && <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>}
        </div>
    );
}

// Local FieldLabel removed — uses canonical from `@/components/patterns/FieldLabel`.

function TextInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
        />
    );
}

/** Numeric input — accepts an "" sentinel for "cleared". Per project memory:
 *  placeholder "0", strip leading zeros, empty when state is 0. */
function NumberInput({ value, onChange, placeholder = "0", className }: {
    value: number | ""; onChange: (v: number | "") => void; placeholder?: string; className?: string;
}) {
    const display = value === "" || value === 0 ? "" : String(value);
    return (
        <input type="text" inputMode="numeric" value={display}
            onChange={e => {
                const raw = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                onChange(raw === "" ? "" : Number(raw));
            }}
            placeholder={placeholder}
            className={cn(
                "flex-1 min-w-0 px-[14px] py-[10px] text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent border-0 focus:outline-none",
                className,
            )}
        />
    );
}

// Shared chrome for prefix/suffix wrappers — gets the focus-within ring
// (same palette as the customer form: `focus:ring-[#aad4bd] focus:border-[#7ba08c]`).
const PREFIX_WRAP_CLS = "group flex items-stretch w-full bg-white border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden cursor-text transition-all focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]";

/** AED-prefixed input — used for every monetary amount in this form. The
 *  whole pill is a `<label>` so clicking anywhere (AED chip or empty padding)
 *  focuses the underlying input. */
function AedInput({ value, onChange, placeholder = "Enter amount" }: {
    value: number | ""; onChange: (v: number | "") => void; placeholder?: string;
}) {
    return (
        <label className={PREFIX_WRAP_CLS}>
            <span className="flex items-center px-[14px] text-[16px] text-[#475467] leading-[24px] border-r border-[#d0d5dd] shrink-0 select-none">AED</span>
            <NumberInput value={value} onChange={onChange} placeholder={placeholder} />
        </label>
    );
}

/** Percent-suffixed input — used for split %, bonus %, sales commission %. */
function PercentInput({ value, onChange, placeholder = "0" }: {
    value: number | ""; onChange: (v: number | "") => void; placeholder?: string;
}) {
    return (
        <label className={PREFIX_WRAP_CLS}>
            <NumberInput value={value} onChange={onChange} placeholder={placeholder} />
            <span className="flex items-center justify-center px-3 border-l border-[#d0d5dd] bg-white shrink-0">
                <Percent01 className="w-5 h-5 text-[#667085]" />
            </span>
        </label>
    );
}

/** Plain number input pill (no prefix/suffix) — used for the tier from/to
 *  fields. Same clickable + focus-within behaviour. */
function PlainNumberInput({ value, onChange, placeholder = "0" }: {
    value: number | ""; onChange: (v: number | "") => void; placeholder?: string;
}) {
    return (
        <label className={PREFIX_WRAP_CLS}>
            <NumberInput value={value} onChange={onChange} placeholder={placeholder} />
        </label>
    );
}

function HelperText({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] text-[#475467] leading-[20px]">{children}</p>;
}

function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={value}
            onClick={() => onChange(!value)}
            className={cn(
                "w-9 h-5 rounded-full p-[2px] flex items-center transition-colors shrink-0",
                value ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
            )}>
            <span className="block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

function ToggleCard({ title, subtitle, value, onChange }: {
    title: string; subtitle: string; value: boolean; onChange: (next: boolean) => void;
}) {
    return (
        <div className={cn(
            "w-full bg-white rounded-[12px] p-4 flex items-center gap-3",
            value ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
        )}>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <Toggle value={value} onChange={onChange} />
        </div>
    );
}

function Radio({ checked }: { checked: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
            checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
        )}>
            {checked && <span className="block w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
    );
}

// ─── Type picker (5-card grid) ──────────────────────────────────────────────

function TypePicker({ value, onChange }: { value: PayRateType; onChange: (next: PayRateType) => void }) {
    return (
        <div className="flex flex-col gap-[6px] w-full">
            <FieldLabel label="Pay rate type" />
            <div className="grid grid-cols-2 gap-3 w-full">
                {TYPE_CARDS.map(card => {
                    const selected = card.value === value;
                    const Icon = card.Icon;
                    return (
                        <button key={card.value} type="button" onClick={() => onChange(card.value)}
                            className={cn(
                                "flex items-center gap-3 p-4 rounded-[12px] bg-white text-left transition-colors min-h-[92px]",
                                selected ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec] hover:bg-[#f9fafb]",
                            )}>
                            <div className={cn(
                                "w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0",
                                selected
                                    ? "bg-gradient-to-br from-[#edfdf5] to-[#dcfae9]"
                                    : "bg-[#f9fafb] border-1 border-[#e4e7ec]",
                            )}>
                                <Icon className={cn("w-4 h-4", selected ? "text-[#658774]" : "text-[#475467]")} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#344054] leading-[20px]">{card.label}</p>
                                <p className="text-[14px] text-[#475467] leading-[20px]">{card.subtitle}</p>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Rate sections (one per type) ───────────────────────────────────────────

function FlatRateSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    return (
        <div className="flex flex-col gap-[6px] w-full">
            <FieldLabel label="Flat rate" />
            <AedInput value={form.flatAmount} onChange={v => set({ flatAmount: v })} />
            <HelperText>Instructor earns this flat amount per class taught, regardless of attendance.</HelperText>
        </div>
    );
}

function TieredRateSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    function update(i: number, patch: Partial<PayRateTier>) {
        const next = form.tiers.map((t, idx) => idx === i ? { ...t, ...patch } : t);
        set({ tiers: next });
    }
    function remove(i: number) {
        if (form.tiers.length <= 1) return;
        set({ tiers: form.tiers.filter((_, idx) => idx !== i) });
    }
    function add() {
        const last = form.tiers[form.tiers.length - 1];
        set({
            tiers: [...form.tiers, {
                id: `t_${Date.now()}_${form.tiers.length + 1}`,
                from: last ? last.to + 1 : 1,
                to: last ? last.to + 5 : 5,
                aed: 0,
            }],
        });
    }
    return (
        <div className="flex flex-col gap-4 w-full">
            {form.tiers.map((tier, i) => (
                <div key={tier.id} className="relative bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-3">
                    {form.tiers.length > 1 && (
                        <button type="button" onClick={() => remove(i)}
                            className="absolute -top-[7px] -right-[7px] w-7 h-7 rounded-[8px] border-1 border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex items-center justify-center hover:bg-[#f9fafb]">
                            <Minus className="w-4 h-4 text-[#475467]" />
                        </button>
                    )}
                    {/* If customers between [X] and [Y] */}
                    <div className="flex items-center gap-2 w-full">
                        <span className="px-2 py-[2px] rounded-full bg-[#f9fafb] border-1 border-[#e4e7ec] text-[12px] font-medium text-[#344054] shrink-0">If</span>
                        <span className="text-[14px] text-[#475467] shrink-0">customers between</span>
                        <div className="flex-1 min-w-0">
                            <PlainNumberInput value={tier.from} onChange={v => update(i, { from: v === "" ? 0 : v })} />
                        </div>
                        <span className="text-[14px] text-[#475467] shrink-0">and</span>
                        <div className="flex-1 min-w-0">
                            <PlainNumberInput value={tier.to} onChange={v => update(i, { to: v === "" ? 0 : v })} />
                        </div>
                    </div>
                    {/* Then instructor receives AED [Z] */}
                    <div className="flex items-center gap-2 w-full">
                        <span className="px-2 py-[2px] rounded-full bg-[#ecfdf3] border-1 border-[#abefc6] text-[12px] font-medium text-[#067647] shrink-0">Then</span>
                        <span className="text-[14px] text-[#475467] shrink-0">instructor receives</span>
                        <div className="flex-1 min-w-0">
                            <AedInput value={tier.aed === 0 ? "" : tier.aed} onChange={v => update(i, { aed: v === "" ? 0 : v })} placeholder="0" />
                        </div>
                    </div>
                </div>
            ))}
            <Button variant="secondary-gray" size="sm" leftIcon={<Plus className="w-5 h-5" />} onClick={add} className="self-start">
                Add rule
            </Button>
        </div>
    );
}

function RevenueRateSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel label="Split percentage" />
                <PercentInput value={form.splitPercent} onChange={v => set({ splitPercent: v })} />
                <HelperText>Percentage of total class revenue paid to instructor.</HelperText>
            </div>
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel label="Pay per customer" />
                <AedInput value={form.payPerCustomer} onChange={v => set({ payPerCustomer: v })} />
            </div>
        </div>
    );
}

function HybridRateSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    const isBonus   = form.hybridConditionKind === "bonus_attendance";
    const isRevenue = form.hybridConditionKind === "revenue";
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel label="Base rate" />
                <AedInput value={form.baseRate} onChange={v => set({ baseRate: v })} />
            </div>

            <div className="flex flex-col gap-4 w-full">
                <SectionHeader title="Add conditions" />

                {/* Bonus by attendance */}
                <button type="button"
                    onClick={() => set({ hybridConditionKind: "bonus_attendance" })}
                    className={cn(
                        "w-full bg-white rounded-[12px] p-4 flex flex-col gap-3 text-left transition-colors",
                        isBonus ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec] hover:bg-[#f9fafb]",
                    )}>
                    <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828] leading-[20px]">Bonus by attendance</p>
                            <p className="text-[14px] text-[#667085] leading-[20px]">Get rewarded when your attendance reaches the required target.</p>
                        </div>
                        <Radio checked={isBonus} />
                    </div>
                    {isBonus && (
                        <div className="flex flex-col gap-3 w-full pt-1" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2 w-full">
                                <span className="px-2 py-[2px] rounded-full bg-[#fffaeb] border-1 border-[#fedf89] text-[12px] font-medium text-[#b54708] shrink-0">Once</span>
                                <span className="text-[14px] text-[#475467] shrink-0">customers reach</span>
                                <div className="flex-1 min-w-0">
                                    <PlainNumberInput value={form.hybridBonusThreshold} onChange={v => set({ hybridBonusThreshold: v })} />
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full">
                                <span className="px-2 py-[2px] rounded-full bg-[#ecfdf3] border-1 border-[#abefc6] text-[12px] font-medium text-[#067647] shrink-0">Then</span>
                                <span className="text-[14px] text-[#475467] shrink-0">instructor receives</span>
                                <div className="flex-1 min-w-0">
                                    <AedInput value={form.hybridBonusPerCustomer} onChange={v => set({ hybridBonusPerCustomer: v })} placeholder="0" />
                                </div>
                                <span className="text-[14px] text-[#475467] shrink-0">per customer</span>
                            </div>
                        </div>
                    )}
                </button>

                {/* Percentage of revenue */}
                <button type="button"
                    onClick={() => set({ hybridConditionKind: "revenue" })}
                    className={cn(
                        "w-full bg-white rounded-[12px] p-4 flex flex-col gap-3 text-left transition-colors",
                        isRevenue ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec] hover:bg-[#f9fafb]",
                    )}>
                    <div className="flex items-center justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828] leading-[20px]">Percentage of revenue</p>
                            <p className="text-[14px] text-[#667085] leading-[20px]">Instructor earns a share of total class revenue on top of the base.</p>
                        </div>
                        <Radio checked={isRevenue} />
                    </div>
                    {isRevenue && (
                        <div className="flex flex-col gap-2 w-full pt-1" onClick={e => e.stopPropagation()}>
                            <FieldLabel label="Split percentage" />
                            <PercentInput value={form.splitPercent} onChange={v => set({ splitPercent: v })} />
                            <HelperText>Percentage of total class revenue paid to instructor.</HelperText>
                        </div>
                    )}
                </button>
            </div>
        </div>
    );
}

function MonthlyRateSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel label="Fixed salary" />
                <AedInput value={form.fixedSalary} onChange={v => set({ fixedSalary: v })} />
                <HelperText>per month</HelperText>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <SectionHeader title="Performance bonus" />
                <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="flex flex-col gap-[6px]">
                        <FieldLabel label="Bonus of monthly salary" />
                        <PercentInput value={form.bonusOfSalaryPercent} onChange={v => set({ bonusOfSalaryPercent: v })} />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                        <FieldLabel label="Bonus cap (optional)" />
                        <AedInput value={form.bonusCap} onChange={v => set({ bonusCap: v })} />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <SectionHeader
                    title="Sales commission"
                    subtitle="Set a commission % for each sales category. Leave blank to exclude."
                />
                <div className="grid grid-cols-2 gap-4 w-full">
                    <div className="flex flex-col gap-[6px]">
                        <FieldLabel label="Packages" />
                        <PercentInput value={form.salesCommissionPackagesPercent} onChange={v => set({ salesCommissionPackagesPercent: v })} />
                    </div>
                    <div className="flex flex-col gap-[6px]">
                        <FieldLabel label="Memberships" />
                        <PercentInput value={form.salesCommissionMembershipsPercent} onChange={v => set({ salesCommissionMembershipsPercent: v })} />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Progress steps (left rail) ─────────────────────────────────────────────

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

// ─── Preview card (right rail) ──────────────────────────────────────────────
//
// Mirrors the table row's derived display strings — same source of truth
// (`computePayRateDisplay`) used by the list page, so what the user sees while
// editing is what they'll see in the table after save.

function PayRatePreview({ form }: { form: FormValue }) {
    // Build a synthetic PayRate from the form to feed the display helper.
    const synthetic = useMemo<PayRate>(() => {
        const base = payloadFromForm(form, "preview", 0) as PayRate;
        return base;
    }, [form]);
    const display = computePayRateDisplay(synthetic);
    const previewName = form.name.trim() || "Pay rate name";

    // Monthly-salary extras — performance bonus + sales commission line items.
    // Only rendered when at least one value is set so the card stays clean
    // for blank-canvas previews.
    const monthlyBullets: string[] = [];
    if (form.type === "monthly") {
        if (form.bonusOfSalaryPercent !== "" && form.bonusOfSalaryPercent > 0) {
            monthlyBullets.push(`${form.bonusOfSalaryPercent}% performance bonus`);
        }
        const pkg = form.salesCommissionPackagesPercent;
        const mem = form.salesCommissionMembershipsPercent;
        const pkgSet = pkg !== "" && pkg > 0;
        const memSet = mem !== "" && mem > 0;
        if (pkgSet && memSet)        monthlyBullets.push(`${pkg}% packages & ${mem}% memberships`);
        else if (pkgSet)             monthlyBullets.push(`${pkg}% packages commission`);
        else if (memSet)             monthlyBullets.push(`${mem}% memberships commission`);
    }

    return (
        <div className="w-[400px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shrink-0">
            <div className="p-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Pay rate preview</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">This is how pay rate overview will look like.</p>
            </div>
            <div className="bg-[#f6f6f3] flex flex-col gap-5 py-10 w-full">
                <div className="px-6 w-full">
                    <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden">
                        {/* Banner */}
                        <div className="relative h-[156px] bg-[#f9fafb] flex items-center justify-center">
                            <div className="w-[72px] h-[72px] rounded-[16px] flex items-center justify-center"
                                style={{ background: "linear-gradient(135deg, #ebfff5 0%, #d7ffe9 100%)" }}>
                                <CoinsHand className="w-[42px] h-[42px] text-[#658774]" />
                            </div>
                            <span className={cn(
                                "absolute top-3 right-3 px-[10px] py-[2px] rounded-full text-[14px] font-medium leading-[20px]",
                                TYPE_BADGE_STYLE[form.type],
                            )}>
                                {TYPE_PREVIEW_LABEL[form.type]}
                            </span>
                        </div>
                        {/* Content */}
                        <div className="px-6 pt-5 pb-6 flex flex-col gap-5">
                            <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{previewName}</p>
                            <div className="flex flex-col gap-1">
                                <p className="font-semibold text-[20px] leading-[30px] text-[#658774]">{display.main}</p>
                                <p className="text-[14px] text-[#667085] leading-[20px]">{display.subtitle}</p>
                            </div>
                            {monthlyBullets.length > 0 && (
                                <ul className="flex flex-col gap-1 pl-1 list-disc list-inside marker:text-[#667085]">
                                    {monthlyBullets.map(line => (
                                        <li key={line} className="text-[14px] text-[#667085] leading-[20px]">{line}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Branch select (step 2) ─────────────────────────────────────────────────

function BranchStep({ form, set, branches }: { form: FormValue; set: (patch: Partial<FormValue>) => void; branches: Branch[] }) {
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );
    return (
        <div className="flex flex-col gap-4 w-full">
            <SectionHeader title="Applicable branch" />
            <div className="flex flex-col gap-[6px] w-full max-w-[580px]">
                <FieldLabel label="Branch location" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5 text-[#667085]" />}
                    placeholder="Select location"
                    options={branchOptions}
                    value={form.branchId}
                    onChange={v => set({ branchId: v })}
                    width="w-full"
                />
            </div>
        </div>
    );
}

// ─── Top-level component (mode = create | edit) ─────────────────────────────

export interface PayRateFormPageProps {
    mode: "create" | "edit";
    /** Required when mode === "edit". */
    payRateId?: string;
    /** Where the × close / Back-after-save sends the user. Defaults to the list. */
    returnTo?: string;
}

export default function PayRateFormPage({ mode, payRateId, returnTo = "/admin/staff/pay-rate" }: PayRateFormPageProps) {
    // returnTo defaults to the admin list — the new/edit route wrappers under
    // /staff/pay-rate/* read ?returnTo= and pass it down, falling back to the
    // admin list so a deep link without the query still lands somewhere sane.
    const router = useRouter();
    const payRates       = useAppStore(s => s.payRates);
    const branches       = useAppStore(s => s.branches);
    const taxRates       = useAppStore(s => s.taxRates);
    const taxRules       = useAppStore(s => s.taxRules);
    const addPayRate     = useAppStore(s => s.addPayRate);
    const updatePayRate  = useAppStore(s => s.updatePayRate);
    const showToast      = useAppStore(s => s.showToast);
    // Country drives the Tax rates section visibility — UAE-based studios
    // don't tax instructor pay, so the input is hidden when the studio's
    // Business & Locations profile country is set to United Arab Emirates.
    // Every other country still sees Tax rates (optional).
    const businessCountry = useAppStore(s => s.businessProfile.country);
    const isUAE = businessCountry === "United Arab Emirates";

    const existing = mode === "edit" && payRateId ? payRates.find(p => p.id === payRateId) : undefined;

    // Tax-rate picker options — only tax rates that are referenced by an
    // ACTIVE tax_rule with category="pay_rate" qualify (matches the brief:
    // "list of tax rate we have that has been apply to tax rule on pay rate").
    // Inactive / archived tax rates are also filtered out.
    const payRateTaxOptions = useMemo(() => {
        const usedIds = new Set(
            taxRules
                .filter(r => r.category === "pay_rate" && r.status === "active" && r.taxRateId)
                .map(r => r.taxRateId!),
        );
        const usable = taxRates.filter(t => t.status === "active" && usedIds.has(t.id));
        // Preserve the existing taxRateId on edit even if its rule has since
        // been deactivated — otherwise the SelectInput would silently reset
        // the picked option on first render.
        if (existing?.taxRateId && !usable.some(t => t.id === existing.taxRateId)) {
            const stale = taxRates.find(t => t.id === existing.taxRateId);
            if (stale) usable.push(stale);
        }
        return [
            { value: "", label: "No tax rate" },
            ...usable.map(t => ({
                value: t.id,
                label: `${t.name} (${t.ratePercentage}%)`,
            })),
        ];
    }, [taxRates, taxRules, existing]);

    const [form, setForm] = useState<FormValue>(() => existing ? formFromPayRate(existing) : emptyForm());
    const [step, setStep] = useState<1 | 2>(1);
    const [hydrated, setHydrated] = useState(!!existing);

    // When the route lands on /edit before the store is hydrated, rehydrate
    // the form once the target row appears (single-shot per mount).
    useEffect(() => {
        if (mode === "edit" && existing && !hydrated) {
            setForm(formFromPayRate(existing));
            setHydrated(true);
        }
    }, [mode, existing, hydrated]);

    function set(patch: Partial<FormValue>) {
        setForm(prev => ({ ...prev, ...patch }));
    }

    const step1Valid = isStep1Valid(form);
    const step2Valid = isStep2Valid(form);

    function handleClose() {
        router.push(returnTo);
    }

    function handleSave() {
        if (!step1Valid || !step2Valid) return;
        // UAE studios don't tax instructor pay — strip any stale taxRateId
        // before persisting so the data layer can't carry an inert field
        // that the UI never exposes (mirrors the flat-rate Additional
        // settings reset pattern further up in `payloadFromForm`).
        if (mode === "create") {
            // Strip the placeholder id so the store mints a real one.
            const { id: _placeholder, ...rest } = payloadFromForm(form);
            void _placeholder;
            if (isUAE) rest.taxRateId = undefined;
            addPayRate(rest);
            showToast("Pay rate created", `"${form.name.trim()}" is now active.`, "success", "check");
        } else if (payRateId) {
            const payload = payloadFromForm(form, payRateId, existing?.usageCount ?? 0);
            if (isUAE) payload.taxRateId = undefined;
            updatePayRate(payRateId, payload as Partial<PayRate>);
            showToast("Pay rate updated", `"${form.name.trim()}" changes saved.`, "success", "check");
        }
        router.push(returnTo);
    }

    // Edit-mode guard: if the row is missing, drop back to the list.
    useEffect(() => {
        if (mode === "edit" && payRateId && payRates.length > 0 && !existing) {
            showToast("Pay rate not found", "Returned to the pay rate list.", "error");
            router.push(returnTo);
        }
    }, [mode, payRateId, payRates, existing, router, returnTo, showToast]);

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as products/[id] detail page */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    {mode === "edit" ? "Edit pay rate" : "Add pay rate"}
                </h1>
            </div>

            {/* Body — px-6 py-6 outer + flex frame */}
            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-8 items-start overflow-hidden">
                {/* Left — progress steps */}
                <div className="w-[300px] shrink-0 flex flex-col gap-4">
                    <StepRow index={1} label="Pay rate details" active={step === 1} done={step === 2} isLast={false} />
                    <StepRow index={2} label="Assign branch location" active={step === 2} done={false} isLast={true} />
                </div>

                {/* Center — content card */}
                <div className="flex-1 min-w-0 max-w-[628px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
                        {step === 1 ? (
                            <div className="flex flex-col gap-8 w-full">
                                <div className="flex flex-col gap-4 w-full">
                                    <SectionHeader title="Pay rate details" />
                                    <div className="flex flex-col gap-[6px] w-full">
                                        <FieldLabel label="Pay rate name" />
                                        <TextInput value={form.name} onChange={v => set({ name: v })} placeholder="e.g. Standard" />
                                    </div>
                                    <TypePicker value={form.type} onChange={t => set({ type: t })} />
                                </div>

                                {/* Rate */}
                                <div className="flex flex-col gap-4 w-full">
                                    <SectionHeader title="Rate" />
                                    {form.type === "flat"    && <FlatRateSection    form={form} set={set} />}
                                    {form.type === "tiered"  && <TieredRateSection  form={form} set={set} />}
                                    {form.type === "revenue" && <RevenueRateSection form={form} set={set} />}
                                    {form.type === "hybrid"  && <HybridRateSection  form={form} set={set} />}
                                    {form.type === "monthly" && <MonthlyRateSection form={form} set={set} />}
                                </div>

                                {/* Tax rates — Figma 6106:10962. Lists the global pay-rate
                                    tax rules so the admin can override the inherited
                                    rate for this specific pay rate. Hidden for UAE
                                    studios per the brief — every other country still
                                    sees this as an optional input. */}
                                {!isUAE && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <SectionHeader title="Tax rates" />
                                        <div className="flex flex-col gap-[6px] w-full">
                                            <FieldLabel label="Tax rate (optional)" />
                                            <SelectInput
                                                value={form.taxRateId}
                                                onChange={v => set({ taxRateId: v })}
                                                options={payRateTaxOptions}
                                                placeholder="Select"
                                                width="w-full"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Additional settings — hidden for "Flat rate"
                                    AND "Monthly salary" since both toggles
                                    ("Only count checked-in" + "Include
                                    late-cancelled") depend on attendance
                                    to drive pay, and these two types pay
                                    the same fixed amount regardless of
                                    who showed up. */}
                                {form.type !== "flat" && form.type !== "monthly" && (
                                    <div className="flex flex-col gap-4 w-full">
                                        <SectionHeader title="Additional settings" />
                                        <div className="flex flex-col gap-4 w-full">
                                            <ToggleCard
                                                title="Only count checked-in customers"
                                                subtitle="Pay only for members marked Present (not just booked)."
                                                value={form.onlyCheckedIn}
                                                onChange={v => set({ onlyCheckedIn: v })}
                                            />
                                            <ToggleCard
                                                title="Include late-cancelled customers"
                                                subtitle="Counts late-cancel members toward pay."
                                                value={form.includeLateCancelled}
                                                onChange={v => set({ includeLateCancelled: v })}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <BranchStep form={form} set={set} branches={branches} />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3">
                        {step === 2 ? (
                            <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                        ) : <span />}
                        {step === 1 ? (
                            <Button variant="primary" size="md" disabled={!step1Valid}
                                onClick={() => setStep(2)}>
                                Continue
                            </Button>
                        ) : (
                            <Button variant="primary" size="md" disabled={!step1Valid || !step2Valid}
                                onClick={handleSave}>
                                {mode === "edit" ? "Save changes" : "Add pay rate"}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Right — preview */}
                <PayRatePreview form={form} />
            </div>
        </div>
    );
}
