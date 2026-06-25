"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create new product (Membership / Credit package)
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page modal flow at /products/new. Same shell as /class-types/new and
// /schedule/new — lives OUTSIDE the admin sidebar layout (top-level route) so
// the multi-step form takes over the whole viewport per the Figma comp.
//
// Five-step flow:
//   1. Select product           — Membership vs Credit package radio (3629:70578)
//   2. Basic information        — name / description / welcome / price (2526:59411)
//   3. Product configuration    — kind-specific:
//        membership   (3629:96269 ON / 3629:90746 OFF)
//        credit pack  (3629:114941)
//   4. Duration & renewal       — kind-specific:
//        membership   (3629:98079 — Duration+Unit row, Active-on-first-use, auto-renew)
//        credit pack  (3629:112703 — Duration+Unit row only, no renewal section)
//   5. Purchase rules           — kind-specific:
//        membership   (6096:273638 — Time bound / Eligibility / Usage cap)
//        credit pack  (6096:280139 — Purchase limit + the same 3 sections,
//                      with package-flavoured copy)

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, CreditCard02, Package as PackageIcon,
    CalendarCheck01, ClockFastForward, ChevronUp, ChevronDown,
    MarkerPin01, FilterLines,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { DecorativeBanner, BANNER_TINTS } from "./DecorativeBanner";
import {
    useAppStore,
    type PurchaseRulesData, type DurationUnit, type Weekday, type Branch,
} from "@/lib/store";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Select product" },
    { n: 2, label: "Basic information" },
    { n: 3, label: "Product configuration" },
    { n: 4, label: "Duration & renewal" },
    { n: 5, label: "Purchase rules" },
];

type ProductKind = "membership" | "package";

// ─── Stepper sidebar — copy class-types/new pattern (Figma 3629:70669) ──────
//
// The connector is absolutely positioned starting at the bottom of the
// circle (top-24) and extends 40px down to bridge into the next StepItem.

function StepItem({ step, current }: { step: typeof STEPS[0]; current: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === STEPS.length;

    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            {/* Circle + connector */}
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            {/* Label */}
            <span className={cn(
                "text-[14px]",
                active
                    ? "font-semibold text-[#3b5446]"
                    : complete
                        ? "font-medium text-[#344054]"
                        : "font-medium text-[#667085]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Step 1 — Select product (Figma 3629:70675) ─────────────────────────────

function ProductOptionCard({ title, description, selected, onSelect }: {
    title: string;
    description: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "w-full text-left bg-white border-1 rounded-[12px] p-4 flex items-center gap-1 transition-all",
                selected
                    ? "border-[#7ba08c] ring-2 ring-[#aad4bd] bg-[#f5fffa]"
                    : "border-[#e4e7ec] hover:bg-[#fafafa]",
            )}>
            <div className="flex-1 flex items-center gap-3">
                <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-[#344054] leading-5">{title}</span>
                    <span className="text-[14px] text-[#475467] leading-5">{description}</span>
                </div>
            </div>
            <div className={cn(
                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                selected ? "border-[#658774] bg-[#658774]" : "border-[#d0d5dd] bg-white",
            )}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

function SelectProductStep({ kind, onChange, onContinue }: {
    kind: ProductKind | null;
    onChange: (k: ProductKind) => void;
    onContinue: () => void;
}) {
    return (
        <FormCard
            title="Select product"
            footer={
                <div className="flex items-center justify-end w-full">
                    <Button variant="primary" size="md" disabled={!kind} onClick={onContinue}>
                        Continue
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <ProductOptionCard
                    title="Membership"
                    description="Recurring plans for monthly class access."
                    selected={kind === "membership"}
                    onSelect={() => onChange("membership")}
                />
                <ProductOptionCard
                    title="Credit package"
                    description="Pre-paid credit for flexible class bookings."
                    selected={kind === "package"}
                    onSelect={() => onChange("package")}
                />
            </div>
        </FormCard>
    );
}

// ─── Step 2 — Basic information (Figma 2526:59534) ──────────────────────────

interface BasicInfo {
    name: string;
    description: string;
    welcomeMessage: string;
    price: string;
}

function BasicInformationStep({ kind, data, onChange, onBack, onContinue }: {
    kind: ProductKind;
    data: BasicInfo;
    onChange: (patch: Partial<BasicInfo>) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const noun = kind === "membership" ? "membership" : "package";
    const canContinue = data.name.trim().length > 0 && data.price.length > 0;

    return (
        <FormCard
            footer={
                <div className="flex items-center justify-between w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>Continue</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-8">
                <Section title="Information">
                    <FormField label={`${kind === "membership" ? "Membership" : "Package"} name`}>
                        <TextInput
                            value={data.name}
                            onChange={v => onChange({ name: v })}
                            placeholder={`Enter ${noun} name...`}
                        />
                    </FormField>
                    <FormField label="Description">
                        <Textarea
                            value={data.description}
                            onChange={v => onChange({ description: v })}
                            placeholder="Enter description..."
                            minHeight={120}
                        />
                    </FormField>
                    <FormField
                        label="Welcome message"
                        hint="This message is to be sent to the customer's email confirmation"
                    >
                        <Textarea
                            value={data.welcomeMessage}
                            onChange={v => onChange({ welcomeMessage: v })}
                            placeholder="Welcome message to customer in their confirmation email..."
                            minHeight={120}
                        />
                    </FormField>
                </Section>

                <Section title="Pricing">
                    <FormField label={`${kind === "membership" ? "Membership" : "Package"} price`}>
                        <PriceInput
                            value={data.price}
                            onChange={v => onChange({ price: v })}
                        />
                    </FormField>
                </Section>
            </div>
        </FormCard>
    );
}

// ─── Step 3 — Product configuration ─────────────────────────────────────────
//
// Layout:
//   Section header "Product Configuration"
//   ┌──────────────────────────────────────────┐
//   │ ToggleCard A  (kind-specific lead toggle) │
//   └──────────────────────────────────────────┘
//   (membership only) Number-of-credits input shown only when "Unlimited" is OFF
//   (credit-package)  Number-of-credits input always shown
//   ┌──────────────────────────────────────────┐
//   │ ToggleCard B  Multi-location access        │
//   └──────────────────────────────────────────┘
//   Branch picker — multi (expandable card) when ON, single dropdown when OFF
//

interface ConfigurationData {
    /** Membership-only — when true, hides the credit-amount input. */
    unlimitedCredits: boolean;
    /** Both kinds — credit amount per cycle / per package. */
    creditAmount: string;
    /** Credit-package-only — flags the product as a one-time intro pack. */
    isIntroOffer: boolean;
    /** Both kinds — when true, swap branch picker to multi-select card. */
    multiLocation: boolean;
    /** Selected branch ids when multi-location is ON. */
    branchIds: string[];
    /** Selected branch id when multi-location is OFF (single-select). */
    singleBranchId: string | null;
}

function ProductConfigurationStep({ kind, data, onChange, onBack, onContinue, branches }: {
    kind: ProductKind;
    data: ConfigurationData;
    onChange: (patch: Partial<ConfigurationData>) => void;
    onBack: () => void;
    onContinue: () => void;
    branches: Branch[];
}) {
    // Validation: credit amount required unless membership has "unlimited" on.
    // Branch selection: at least 1 selected when multi-location ON; any branch
    // chosen when OFF.
    const creditOk = kind === "membership" && data.unlimitedCredits
        ? true
        : data.creditAmount.trim().length > 0;
    const branchOk = data.multiLocation
        ? data.branchIds.length > 0
        : !!data.singleBranchId;
    const canContinue = creditOk && branchOk;

    return (
        <FormCard
            title="Product configuration"
            footer={
                <div className="flex items-center justify-between w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>Continue</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                {/* ── Kind-specific lead toggle ── */}
                {kind === "membership" ? (
                    <>
                        <ToggleCard
                            title="Unlimited credits amount"
                            subtitle="The membership will be unlimited"
                            on={data.unlimitedCredits}
                            onChange={v => onChange({ unlimitedCredits: v })}
                        />
                        {/* Credit input hidden when unlimited is ON. */}
                        {!data.unlimitedCredits && (
                            <FormField label="Number of credit amount">
                                <CreditAmountInput
                                    value={data.creditAmount}
                                    onChange={v => onChange({ creditAmount: v })}
                                />
                            </FormField>
                        )}
                    </>
                ) : (
                    <>
                        <ToggleCard
                            title="This package is an intro offer"
                            subtitle="One-time offer for new users"
                            on={data.isIntroOffer}
                            onChange={v => onChange({ isIntroOffer: v })}
                        />
                        <FormField label="Number of credit amount">
                            <CreditAmountInput
                                value={data.creditAmount}
                                onChange={v => onChange({ creditAmount: v })}
                            />
                        </FormField>
                    </>
                )}

                {/* ── Multi-location toggle (shared) ── */}
                <ToggleCard
                    title="Multi-location access"
                    subtitle={kind === "membership"
                        ? "The membership can be use on multiple branches"
                        : "The credit package can be use on multiple branches"}
                    on={data.multiLocation}
                    onChange={v => onChange({ multiLocation: v })}
                />

                {/* ── Branch picker — swaps on multi-location toggle ── */}
                {data.multiLocation ? (
                    <BranchMultiSelect
                        kind={kind}
                        selected={data.branchIds}
                        onChange={ids => onChange({ branchIds: ids })}
                        branches={branches}
                    />
                ) : (
                    <FormField label="Branch location">
                        <BranchSingleSelect
                            value={data.singleBranchId}
                            onChange={id => onChange({ singleBranchId: id })}
                            branches={branches}
                        />
                    </FormField>
                )}
            </div>
        </FormCard>
    );
}

// ─── Toggle primitive (Figma 1102:4137 / 1102:4121) ─────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on}
            onClick={() => onChange(!on)}
            className={cn(
                "relative w-9 h-5 rounded-full transition-colors shrink-0",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                "shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]",
                on ? "left-[18px]" : "left-0.5",
            )} />
        </button>
    );
}

/** Bordered card wrapping a toggle. Border switches to a 2px green
 *  `#7ba08c` when the toggle is ON (matches Figma 5573:262653). */
function ToggleCard({ title, subtitle, on, onChange }: {
    title: string; subtitle: string;
    on: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className={cn(
            "bg-white rounded-[12px] p-4 flex items-center justify-between gap-3 transition-colors w-full",
            on ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
        )}>
            <div className="flex flex-col min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
            </div>
            <Toggle on={on} onChange={onChange} />
        </div>
    );
}

// ─── Credit amount numeric input (Figma 3629:96272) ─────────────────────────
//
// No trailing help-icon per user feedback — bare numeric input with the
// standard ChevronSelectorVertical stepper handle that NumericStringInput
// provides natively.

function CreditAmountInput({ value, onChange }: {
    value: string; onChange: (v: string) => void;
}) {
    return (
        <NumericStringInput
            value={value}
            onChange={onChange}
            min={0}
            step={1}
        />
    );
}

// ─── Branch multi-select (Figma 5852:354302) ────────────────────────────────
//
// Expandable card with header (label + "N selected" badge + chevron) and
// body containing a Select-all row + filter button + branch list with
// checkboxes. The card itself is the bordered container — no extra wrap.

type BranchFilterValue = "all" | "active" | "inactive";

function BranchMultiSelect({ kind, selected, onChange, branches }: {
    kind: ProductKind;
    selected: string[];
    onChange: (ids: string[]) => void;
    branches: Branch[];
}) {
    const [expanded, setExpanded] = useState(true);
    const [filter, setFilter] = useState<BranchFilterValue>("all");

    const all = branches;
    const visible = all.filter(b => {
        if (filter === "active") return b.status === "active";
        if (filter === "inactive") return b.status === "inactive";
        return true;
    });
    const visibleIds = visible.map(b => b.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAll() {
        if (allSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) {
                if (!merged.includes(id)) merged.push(id);
            }
            onChange(merged);
        }
    }

    const subtitle = kind === "membership"
        ? "The membership can be use on multiple branches"
        : "The credit package can be use on multiple branches";

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">Branches</p>
                    <p className="text-[14px] text-[#6e776f] leading-5 truncate">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {selected.length} selected
                </span>
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0">
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {expanded && (
                <div className="flex flex-col gap-3">
                    {/* Select all + filter row */}
                    <div className="flex items-center gap-2">
                        <FilledCheckbox checked={allSelected} onChange={toggleAll} />
                        <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                        <BranchFilterDropdown active={filter} onChange={setFilter} />
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-[#e4e7ec]" />

                    <p className="text-[12px] text-[#667085] leading-[18px]">Branches</p>

                    {visible.map(b => (
                        <div key={b.id} className="flex items-center gap-2">
                            <FilledCheckbox
                                checked={selected.includes(b.id)}
                                onChange={() => toggleOne(b.id)}
                            />
                            <span className="text-[14px] font-medium text-[#101828] flex-1">{b.name}</span>
                        </div>
                    ))}

                    {visible.length === 0 && (
                        <p className="text-[14px] text-[#667085]">No branches match the filter.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function BranchFilterDropdown({ active, onChange }: {
    active: BranchFilterValue; onChange: (f: BranchFilterValue) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: { value: BranchFilterValue; label: string }[] = [
        { value: "all",      label: "All" },
        { value: "active",   label: "Only active" },
        { value: "inactive", label: "Only inactive" },
    ];

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
                    {OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                active === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function FilledCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

// ─── Branch single-select dropdown (Figma 5390:84035) ───────────────────────

function BranchSingleSelect({ value, onChange, branches }: {
    value: string | null; onChange: (id: string) => void;
    branches: Branch[];
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selected = branches.find(b => b.id === value);

    return (
        <div ref={ref} className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]">
                <MarkerPin01 className="w-5 h-5 text-[#667085] shrink-0" />
                <span className={cn(
                    "flex-1 text-left truncate",
                    selected ? "text-[#101828]" : "text-[#667085]",
                )}>
                    {selected ? selected.name : "Select location"}
                </span>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 max-h-[240px] overflow-y-auto">
                    {branches.map(b => (
                        <button key={b.id} type="button"
                            onClick={() => { onChange(b.id); setOpen(false); }}
                            className={cn(
                                "flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === b.id ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            <MarkerPin01 className="w-4 h-4 text-[#667085]" />
                            {b.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Step 4 — Duration & renewal ────────────────────────────────────────────
//
// Membership (Figma 3629:98079):
//   • Duration section: Duration numeric (flex-1) + Unit dropdown (140px)
//     followed by "Active on first use" ToggleCard.
//   • Renewal  section: "This membership auto-renews" ToggleCard.
//
// Credit package (Figma 3629:112703):
//   • Duration section ONLY — same Duration + Unit row, no toggles below.

const UNIT_OPTIONS: { value: DurationUnit; label: string }[] = [
    { value: "day",   label: "Day"   },
    { value: "month", label: "Month" },
    { value: "year",  label: "Year"  },
];

interface DurationData {
    /** Numeric count — string for empty-state parity with other inputs. */
    duration: string;
    /** Day / month / year. */
    unit: DurationUnit;
    /** Membership-only — membership period starts only when the customer
     *  first uses it (vs. starts immediately on purchase). */
    activeOnFirstUse: boolean;
    /** Membership-only — auto-renew at the end of the period. */
    autoRenew: boolean;
}

function DurationRenewalStep({ kind, data, onChange, onBack, onContinue }: {
    kind: ProductKind;
    data: DurationData;
    onChange: (patch: Partial<DurationData>) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const canContinue = data.duration.trim().length > 0 && Number(data.duration) > 0;

    return (
        <FormCard
            footer={
                <div className="flex items-center justify-between w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>Continue</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-8">
                {/* ── Duration section ── */}
                <Section title="Duration">
                    <div className="flex gap-4 items-start w-full">
                        <div className="flex-1 min-w-0">
                            <FormField label="Duration">
                                <NumericStringInput
                                    value={data.duration}
                                    onChange={v => onChange({ duration: v })}
                                    min={0}
                                    step={1}
                                />
                            </FormField>
                        </div>
                        <div className="w-[140px] shrink-0">
                            <FormField label="Unit">
                                <UnitDropdown
                                    value={data.unit}
                                    onChange={u => onChange({ unit: u })}
                                />
                            </FormField>
                        </div>
                    </div>

                    {/* Active-on-first-use is membership-only per Figma 5573:262507 */}
                    {kind === "membership" && (
                        <ToggleCard
                            title="Active on first use"
                            subtitle="The membership period begins when the customer first uses it"
                            on={data.activeOnFirstUse}
                            onChange={v => onChange({ activeOnFirstUse: v })}
                        />
                    )}
                </Section>

                {/* ── Renewal section (membership only) ── */}
                {kind === "membership" && (
                    <Section title="Renewal">
                        <ToggleCard
                            title="This membership auto-renews"
                            subtitle="Turn this on if you want the membership to automatically renew and charge the customer at the end of its duration."
                            on={data.autoRenew}
                            onChange={v => onChange({ autoRenew: v })}
                        />
                    </Section>
                )}
            </div>
        </FormCard>
    );
}

// ─── Unit dropdown (Day / Month / Year) ─────────────────────────────────────

function UnitDropdown({ value, onChange }: {
    value: DurationUnit; onChange: (u: DurationUnit) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selected = UNIT_OPTIONS.find(o => o.value === value);

    return (
        <div ref={ref} className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]">
                <span className="flex-1 text-left truncate text-[#101828]">
                    {selected?.label ?? "Day"}
                </span>
                <ChevronDown className="w-5 h-5 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1">
                    {UNIT_OPTIONS.map(o => (
                        <button key={o.value} type="button"
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === o.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Step 5 — Purchase rules (Figma 6096:273638 / 6096:280139) ──────────────
//
// Each section has a master toggle (the whole section can be turned off,
// hiding all its rule cards). Inside, each rule is a `RuleCard` — bordered
// container with title+subtitle and a checkbox; checking the checkbox flips
// the border to 2px green and reveals the rule's body inputs.
//
// Membership: Time bound / Eligibility / Usage cap     (3 sections, 9 rules)
// Credit pack: Purchase limit + the same three          (4 sections, 10 rules)

// Day-of-week labels for the Day pills primitive — same order as the
// Weekday union, just exported as a value to map over.
const WEEKDAYS: readonly Weekday[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const EMPTY_PURCHASE_RULES: PurchaseRulesData = {
    timeBound: {
        on: true,
        purchaseWindow: { on: false, from: "", to: "" },
        dayOfWeek:      { on: false, days: [] },
        activationDelay:{ on: false, days: "" },
    },
    eligibility: {
        on: true,
        newCustomers:           { on: false, neverPurchased: false, recentSignup: false, daysAgo: "", daysUnit: "day" },
        existingCustomers:      { on: false, minPackages: "" },
        specificMembershipTier: { on: false, membershipId: "" },
        locationRegion:         { on: false, region: "" },
    },
    usageCap: {
        on: true,
        totalRedemptions: { on: false, max: "" },
        perLocation:      { on: false, max: "" },
        perDay:           { on: false, max: "" },
    },
    purchaseLimit: {
        on: true,
        selectedRule: null,
        rolling: { every: "", unit: "day" },
    },
};

function PurchaseRulesStep({ kind, data, onChange, onBack, onCreate, submitLabel }: {
    kind: ProductKind;
    data: PurchaseRulesData;
    onChange: (next: PurchaseRulesData) => void;
    onBack: () => void;
    onCreate: () => void;
    /** "Create product" in create mode, "Save changes" in edit mode. */
    submitLabel: string;
}) {
    // Helpers so leaf field updates stay terse.
    const patch = (partial: Partial<PurchaseRulesData>) => onChange({ ...data, ...partial });
    const patchTime = (p: Partial<PurchaseRulesData["timeBound"]>) =>
        patch({ timeBound: { ...data.timeBound, ...p } });
    const patchElig = (p: Partial<PurchaseRulesData["eligibility"]>) =>
        patch({ eligibility: { ...data.eligibility, ...p } });
    const patchCap = (p: Partial<PurchaseRulesData["usageCap"]>) =>
        patch({ usageCap: { ...data.usageCap, ...p } });
    const patchLimit = (p: Partial<PurchaseRulesData["purchaseLimit"]>) =>
        patch({ purchaseLimit: { ...data.purchaseLimit, ...p } });

    const noun = kind === "membership" ? "membership" : "package";

    // Substitutes "(n)" in a label with the actual numeric value the user
    // typed. Renders "(n)" while the field is empty/zero so the placeholder
    // intent stays readable. Used by every label that references the
    // companion numeric input below it (eligibility + usage cap rules).
    const withN = (template: string, raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return template;
        const n = Number(trimmed);
        if (!Number.isFinite(n) || n <= 0) return template;
        return template.replace("(n)", `(${n})`);
    };

    // Pluralizes the unit suffix on the "Account created with last (n) days"
    // label when the user picks Month/Year from the inline unit dropdown.
    const daysUnitLabel = (() => {
        const u = data.eligibility.newCustomers.daysUnit;
        return u === "day" ? "days" : u === "month" ? "months" : "years";
    })();
    const recentSignupLabel = withN(
        `Account created with last (n) ${daysUnitLabel}`,
        data.eligibility.newCustomers.daysAgo,
    );

    // "Maximum 1 purchase per (n days)" → reflect the live Period limit +
    // Unit picks. Falls back to "(n {unit}s)" while the field is empty so
    // the placeholder copy keeps shape until the admin enters a value.
    const rollingUnit = data.purchaseLimit.rolling.unit;
    const rollingUnitPlural = rollingUnit === "day" ? "days"
        : rollingUnit === "month" ? "months"
        : "years";
    const rollingEvery = data.purchaseLimit.rolling.every.trim();
    const rollingEveryN = Number(rollingEvery);
    const rollingSubtitle = (rollingEvery && Number.isFinite(rollingEveryN) && rollingEveryN > 0)
        ? `Maximum 1 purchase per (${rollingEveryN} ${rollingEveryN === 1 ? rollingUnit : rollingUnitPlural})`
        : `Maximum 1 purchase per (n ${rollingUnitPlural})`;

    return (
        <FormCard
            footer={
                <div className="flex items-center justify-between w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" onClick={onCreate}>{submitLabel}</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-8">

                {/* ── Credit-package-only — Purchase limit rules ──
                    Single-select radio group (Lifetime XOR Rolling) per
                    Figma 6096:280139. Picking one card unselects the other.
                    Rolling card reveals Period limit + Unit inputs below
                    when selected; Lifetime needs no extra inputs. */}
                {kind === "package" && (
                    <MasterToggleSection
                        title="Purchase limit rules"
                        subtitle="Control how often a customer can buy this package"
                        on={data.purchaseLimit.on}
                        onChange={v => patchLimit({ on: v })}
                    >
                        <RadioRuleCard
                            title="Lifetime limit"
                            subtitle="Maximum 1 purchase per customer"
                            selected={data.purchaseLimit.selectedRule === "lifetime"}
                            onSelect={() => patchLimit({ selectedRule: "lifetime" })}
                        />
                        <RadioRuleCard
                            title="Rolling window or calendar period limit"
                            subtitle={rollingSubtitle}
                            selected={data.purchaseLimit.selectedRule === "rolling"}
                            onSelect={() => patchLimit({ selectedRule: "rolling" })}
                        >
                            <div className="flex gap-4 items-start w-full">
                                <div className="flex-1 min-w-0">
                                    <FormField label="Period limit">
                                        <NumericStringInput
                                            value={data.purchaseLimit.rolling.every}
                                            onChange={v => patchLimit({ rolling: { ...data.purchaseLimit.rolling, every: v } })}
                                            min={0}
                                        />
                                    </FormField>
                                </div>
                                <div className="w-[140px] shrink-0">
                                    <FormField label="Unit">
                                        <UnitDropdown
                                            value={data.purchaseLimit.rolling.unit}
                                            onChange={u => patchLimit({ rolling: { ...data.purchaseLimit.rolling, unit: u } })}
                                        />
                                    </FormField>
                                </div>
                            </div>
                        </RadioRuleCard>
                    </MasterToggleSection>
                )}

                {/* ── Time bound rules ── */}
                <MasterToggleSection
                    title="Time bound rules"
                    subtitle={`Control when this ${noun} can be purchased`}
                    on={data.timeBound.on}
                    onChange={v => patchTime({ on: v })}
                >
                    <RuleCard
                        title="Set purchase window"
                        subtitle="Set the available purchase window"
                        on={data.timeBound.purchaseWindow.on}
                        onChange={v => patchTime({ purchaseWindow: { ...data.timeBound.purchaseWindow, on: v } })}
                    >
                        <div className="flex gap-4 items-start w-full">
                            <div className="flex-1 min-w-0">
                                <FormField label="Available from">
                                    <DatePicker
                                        value={data.timeBound.purchaseWindow.from}
                                        onChange={iso => patchTime({
                                            purchaseWindow: {
                                                ...data.timeBound.purchaseWindow,
                                                from: iso,
                                                // Clear `to` when the new `from` pushes past it — the
                                                // until-date can't precede the from-date.
                                                to: data.timeBound.purchaseWindow.to && iso && data.timeBound.purchaseWindow.to < iso
                                                    ? "" : data.timeBound.purchaseWindow.to,
                                            },
                                        })}
                                        placeholder="Select date"
                                        minDate={todayISO()}
                                    />
                                </FormField>
                            </div>
                            <div className="flex-1 min-w-0">
                                <FormField label="Available until">
                                    <DatePicker
                                        value={data.timeBound.purchaseWindow.to}
                                        onChange={iso => patchTime({ purchaseWindow: { ...data.timeBound.purchaseWindow, to: iso } })}
                                        placeholder="Select date"
                                        minDate={data.timeBound.purchaseWindow.from || todayISO()}
                                    />
                                </FormField>
                            </div>
                        </div>
                    </RuleCard>

                    <RuleCard
                        title="Day of week restrictions"
                        subtitle="Set the available of purchase day"
                        on={data.timeBound.dayOfWeek.on}
                        onChange={v => patchTime({ dayOfWeek: { ...data.timeBound.dayOfWeek, on: v } })}
                    >
                        <p className="text-[14px] font-medium text-[#344054]">Only available on:</p>
                        <DayPills
                            value={data.timeBound.dayOfWeek.days}
                            onChange={days => patchTime({ dayOfWeek: { ...data.timeBound.dayOfWeek, days } })}
                        />
                    </RuleCard>

                    <RuleCard
                        title="Activation delay"
                        subtitle="Can purchase now, but usable after certain of delay days"
                        on={data.timeBound.activationDelay.on}
                        onChange={v => patchTime({ activationDelay: { ...data.timeBound.activationDelay, on: v } })}
                    >
                        <FormField label="Days of delay">
                            <NumericStringInput
                                value={data.timeBound.activationDelay.days}
                                onChange={v => patchTime({ activationDelay: { ...data.timeBound.activationDelay, days: v } })}
                                min={0}
                            />
                        </FormField>
                    </RuleCard>
                </MasterToggleSection>

                {/* ── Eligibility rules ── */}
                <MasterToggleSection
                    title="Eligibility rules"
                    subtitle={`Control who can purchase this ${noun}`}
                    on={data.eligibility.on}
                    onChange={v => patchElig({ on: v })}
                >
                    <RuleCard
                        title="New customers only"
                        subtitle="This rule is for new customers only"
                        on={data.eligibility.newCustomers.on}
                        onChange={v => patchElig({ newCustomers: { ...data.eligibility.newCustomers, on: v } })}
                    >
                        <p className="text-[14px] font-medium text-[#344054]">Define &ldquo;new customer&rdquo; as:</p>

                        {/* Sub-option 1: never purchased — full-width checkbox card */}
                        <SubCheckboxCard
                            label="Never purchase any paid package"
                            checked={data.eligibility.newCustomers.neverPurchased}
                            onChange={v => patchElig({ newCustomers: { ...data.eligibility.newCustomers, neverPurchased: v } })}
                        />

                        {/* Sub-option 2: recent signup — checkbox card + inline numeric+unit input below */}
                        <div className="flex flex-col gap-3 w-full">
                            <SubCheckboxCard
                                label={recentSignupLabel}
                                checked={data.eligibility.newCustomers.recentSignup}
                                onChange={v => patchElig({ newCustomers: { ...data.eligibility.newCustomers, recentSignup: v } })}
                            />
                            {data.eligibility.newCustomers.recentSignup && (
                                <NumberWithUnit
                                    value={data.eligibility.newCustomers.daysAgo}
                                    onChange={v => patchElig({ newCustomers: { ...data.eligibility.newCustomers, daysAgo: v } })}
                                    unitNode={
                                        <InlineUnitDropdown
                                            value={data.eligibility.newCustomers.daysUnit}
                                            onChange={u => patchElig({ newCustomers: { ...data.eligibility.newCustomers, daysUnit: u } })}
                                        />
                                    }
                                />
                            )}
                        </div>
                    </RuleCard>

                    <RuleCard
                        title="Existing customers only"
                        subtitle="This rule is for existing customers only"
                        on={data.eligibility.existingCustomers.on}
                        onChange={v => patchElig({ existingCustomers: { ...data.eligibility.existingCustomers, on: v } })}
                    >
                        <FormField label={withN("Must purchase at least (n) packages before", data.eligibility.existingCustomers.minPackages)}>
                            <NumberWithUnit
                                value={data.eligibility.existingCustomers.minPackages}
                                onChange={v => patchElig({ existingCustomers: { ...data.eligibility.existingCustomers, minPackages: v } })}
                                unitText="Package"
                            />
                        </FormField>
                    </RuleCard>

                    {/* Credit-package-only — gate purchase on holding a
                        specific membership tier. The picker dropdown sources
                        memberships live from the store so a newly-created
                        membership shows up here without a refresh. */}
                    {kind === "package" && (
                        <RuleCard
                            title="Specific membership tier"
                            subtitle="This rule is for customers who only have specific membership tier"
                            on={data.eligibility.specificMembershipTier.on}
                            onChange={v => patchElig({ specificMembershipTier: { ...data.eligibility.specificMembershipTier, on: v } })}
                        >
                            <FormField label="Select membership tier">
                                <MembershipTierDropdown
                                    value={data.eligibility.specificMembershipTier.membershipId}
                                    onChange={id => patchElig({ specificMembershipTier: { ...data.eligibility.specificMembershipTier, membershipId: id } })}
                                />
                            </FormField>
                        </RuleCard>
                    )}

                    <RuleCard
                        title="Specific location/region"
                        subtitle={`This rule is for customers on specific location/region`}
                        on={data.eligibility.locationRegion.on}
                        onChange={v => patchElig({ locationRegion: { ...data.eligibility.locationRegion, on: v } })}
                    >
                        <FormField label="Location/region">
                            <RegionDropdown
                                value={data.eligibility.locationRegion.region}
                                onChange={r => patchElig({ locationRegion: { ...data.eligibility.locationRegion, region: r } })}
                            />
                        </FormField>
                    </RuleCard>
                </MasterToggleSection>

                {/* ── Usage cap rules ── */}
                <MasterToggleSection
                    title="Usage cap rules"
                    subtitle="Limit total availability across all customers"
                    on={data.usageCap.on}
                    onChange={v => patchCap({ on: v })}
                >
                    <RuleCard
                        title="Total redemptions cap"
                        subtitle="This rule is to determine the maximum purchases from customers"
                        on={data.usageCap.totalRedemptions.on}
                        onChange={v => patchCap({ totalRedemptions: { ...data.usageCap.totalRedemptions, on: v } })}
                    >
                        <FormField label={withN("Maximum (n) total purchases across all customers", data.usageCap.totalRedemptions.max)}>
                            <NumberWithUnit
                                value={data.usageCap.totalRedemptions.max}
                                onChange={v => patchCap({ totalRedemptions: { ...data.usageCap.totalRedemptions, max: v } })}
                                unitText="purchases"
                            />
                        </FormField>
                    </RuleCard>

                    <RuleCard
                        title="Per-location cap"
                        subtitle="This rule is to determine the maximum purchases per locations"
                        on={data.usageCap.perLocation.on}
                        onChange={v => patchCap({ perLocation: { ...data.usageCap.perLocation, on: v } })}
                    >
                        <FormField label={withN("Maximum (n) total purchases per location", data.usageCap.perLocation.max)}>
                            <NumberWithUnit
                                value={data.usageCap.perLocation.max}
                                onChange={v => patchCap({ perLocation: { ...data.usageCap.perLocation, max: v } })}
                                unitText="purchases"
                            />
                        </FormField>
                    </RuleCard>

                    <RuleCard
                        title="Per-day cap"
                        subtitle="This rule is to determine the maximum purchases per day"
                        on={data.usageCap.perDay.on}
                        onChange={v => patchCap({ perDay: { ...data.usageCap.perDay, on: v } })}
                    >
                        <FormField label={withN("Maximum (n) total purchases per day", data.usageCap.perDay.max)}>
                            <NumberWithUnit
                                value={data.usageCap.perDay.max}
                                onChange={v => patchCap({ perDay: { ...data.usageCap.perDay, max: v } })}
                                unitText="purchases"
                            />
                        </FormField>
                    </RuleCard>
                </MasterToggleSection>
            </div>
        </FormCard>
    );
}

// ─── Primitive: master-toggle section ───────────────────────────────────────

function MasterToggleSection({ title, subtitle, on, onChange, children }: {
    title: string; subtitle: string;
    on: boolean; onChange: (v: boolean) => void;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-center gap-4 w-full">
                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-5">{subtitle}</p>
                </div>
                <Toggle on={on} onChange={onChange} />
            </div>
            {on && <div className="flex flex-col gap-4 w-full">{children}</div>}
        </div>
    );
}

// ─── Primitive: rule card ──────────────────────────────────────────────────

function RuleCard({ title, subtitle, on, onChange, children }: {
    title: string; subtitle: string;
    on: boolean; onChange: (v: boolean) => void;
    children: React.ReactNode;
}) {
    return (
        <div className={cn(
            "bg-white rounded-[12px] p-4 flex flex-col gap-3 transition-colors w-full",
            on ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
        )}>
            <div className="flex items-center gap-3 w-full">
                <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#344054] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <FilledCheckbox checked={on} onChange={() => onChange(!on)} />
            </div>
            {on && children}
        </div>
    );
}

// ─── Primitive: filled radio (single-select indicator) ────────────────────

function FilledRadio({ selected }: { selected: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors border",
            selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#658774]",
        )}>
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
    );
}

// ─── Primitive: radio rule card ───────────────────────────────────────────
//
// Sibling to `RuleCard` but with a radio indicator + an `onSelect` callback
// that always selects (no toggle off — selection moves to whichever radio
// the user clicks). Used for the credit-package Purchase-limit group where
// Lifetime XOR Rolling can be chosen.

function RadioRuleCard({ title, subtitle, selected, onSelect, children }: {
    title: string; subtitle: string;
    selected: boolean; onSelect: () => void;
    children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "bg-white rounded-[12px] p-4 flex flex-col gap-3 transition-colors w-full",
            selected ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
        )}>
            <button type="button" onClick={onSelect}
                className="flex items-center gap-3 w-full text-left">
                <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#344054] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <FilledRadio selected={selected} />
            </button>
            {selected && children}
        </div>
    );
}

// ─── Sub-checkbox card (used inside "Define new customer as:") ─────────────

function SubCheckboxCard({ label, checked, onChange }: {
    label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <button type="button" onClick={() => onChange(!checked)}
            className={cn(
                "w-full bg-white rounded-[12px] p-4 flex items-center gap-3 transition-colors text-left",
                checked ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec] hover:bg-[#fafafa]",
            )}>
            <span className="flex-1 text-[14px] font-medium text-[#344054]">{label}</span>
            <FilledCheckbox checked={checked} onChange={() => onChange(!checked)} />
        </button>
    );
}

// ─── Day-of-week pills (Mon..Sun multi-select) ─────────────────────────────

function DayPills({ value, onChange }: {
    value: Weekday[]; onChange: (next: Weekday[]) => void;
}) {
    function toggle(day: Weekday) {
        onChange(value.includes(day) ? value.filter(d => d !== day) : [...value, day]);
    }
    return (
        <div className="flex flex-wrap gap-3">
            {WEEKDAYS.map(day => {
                const selected = value.includes(day);
                return (
                    <button key={day} type="button" onClick={() => toggle(day)}
                        className={cn(
                            "h-11 px-4 rounded-[8px] flex items-center justify-center gap-3 transition-colors",
                            selected
                                ? "bg-white border-2 border-[#7ba08c]"
                                : "bg-white border-1 border-[#e4e7ec] hover:bg-[#fafafa]",
                        )}>
                        <FilledCheckbox checked={selected} onChange={() => toggle(day)} />
                        <span className="text-[16px] font-medium text-[#344054]">{day}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Number-with-unit composite input ──────────────────────────────────────
//
// Numeric field + right-side unit cell. Either pass `unitText` for a plain
// label ("purchases" / "Package") or `unitNode` for an inline dropdown.
// Renders via `NumericStringInput`'s native `suffix` slot (which already
// provides the left-border divider) so we don't double-stack borders + h-10
// rows the way the previous wrapper did.

function NumberWithUnit({ value, onChange, unitText, unitNode }: {
    value: string; onChange: (v: string) => void;
    unitText?: string;
    unitNode?: React.ReactNode;
}) {
    return (
        <NumericStringInput
            value={value}
            onChange={onChange}
            min={0}
            step={1}
            suffix={unitNode ?? unitText}
        />
    );
}

// ─── Inline unit dropdown (smaller, for embedded use in NumberWithUnit) ────

function InlineUnitDropdown({ value, onChange }: {
    value: DurationUnit; onChange: (u: DurationUnit) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const selected = UNIT_OPTIONS.find(o => o.value === value);
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1 text-[16px] text-[#344054] focus:outline-none">
                <span>{selected?.label ?? "Day"}</span>
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] right-0 z-50 min-w-[120px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1">
                    {UNIT_OPTIONS.map(o => (
                        <button key={o.value} type="button"
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === o.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Region dropdown (single-select) ───────────────────────────────────────

const REGIONS = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"] as const;

function RegionDropdown({ value, onChange }: {
    value: string; onChange: (r: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]">
                <span className={cn("flex-1 text-left truncate", value ? "text-[#101828]" : "text-[#667085]")}>
                    {value || "Select region"}
                </span>
                <ChevronDown className="w-5 h-5 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 max-h-[240px] overflow-y-auto">
                    {REGIONS.map(r => (
                        <button key={r} type="button"
                            onClick={() => { onChange(r); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === r ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {r}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Membership-tier dropdown (live from the store) ───────────────────────

function MembershipTierDropdown({ value, onChange }: {
    value: string; onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    // Live store subscription — newly-created memberships appear here without
    // a refresh. Archived/inactive tiers are filtered out so admins can't
    // gate a package on a retired tier.
    const memberships = useAppStore(s => s.memberships.filter(m => m.status === "active"));
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const selected = memberships.find(m => m.id === value);
    return (
        <div ref={ref} className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[#101828]" : "text-[#667085]")}>
                    {selected?.name || "Select membership tier"}
                </span>
                <ChevronDown className="w-5 h-5 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 max-h-[240px] overflow-y-auto">
                    {memberships.length === 0 ? (
                        <p className="px-3 py-2 text-[14px] text-[#667085]">No active memberships yet</p>
                    ) : memberships.map(m => (
                        <button key={m.id} type="button"
                            onClick={() => { onChange(m.id); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === m.id ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {m.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── FormCard shell (Figma 3629:70675 / 2526:59534) ─────────────────────────

function FormCard({ title, children, footer }: {
    title?: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                {title && (
                    <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h2>
                )}
                {children}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-6 flex items-center">{footer}</div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-5 w-full">
            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

function FormField({ label, hint, children }: {
    label: string; hint?: string; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[#475467] leading-5">{hint}</p>}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function TextInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={INPUT_CLS}
        />
    );
}

function Textarea({ value, onChange, placeholder, minHeight = 120 }: {
    value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y leading-6"
        />
    );
}

function PriceInput({ value, onChange }: {
    value: string; onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all h-10">
            <div className="flex items-center pl-[14px] text-[16px] font-medium text-[#667085] shrink-0">AED</div>
            <div className="flex-1 min-w-0">
                <NumericStringInput
                    value={value}
                    onChange={onChange}
                    min={0}
                    step={1}
                    className="!border-0 !shadow-none !rounded-none !ring-0 focus-within:!ring-0 focus-within:!border-0"
                    inputClassName="!text-[16px]"
                />
            </div>
        </div>
    );
}

// ─── Template preview card (Figma 3629:70712 / 5852:352940 / 3629:113920) ──

interface PreviewState {
    kind: ProductKind | null;
    name: string;
    creditsLabel: string;
    durationLabel: string;
    price: number;
}

function TemplatePreviewCard({ data }: { data: PreviewState }) {
    const hasName = !!data.name.trim();
    const Icon = data.kind === "package" ? PackageIcon : CreditCard02;
    // Membership reads indigo, credit package sage — the banner tint is the
    // only thing that differs from the gift-card preview (same card design).
    const tint = data.kind === "package" ? BANNER_TINTS.package : BANNER_TINTS.membership;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            {/* Header */}
            <div className="flex flex-col">
                <div className="pt-6 px-6 flex flex-col gap-1">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Template preview</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">This is how your product will look like.</p>
                </div>
                <div className="h-5" />
                <div className="h-px bg-[#e4e7ec]" />
            </div>
            {/* Stage */}
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5 w-[352px] mx-auto">
                    {data.kind
                        ? <DecorativeBanner bannerHeight={120} iconBox={56} icon={Icon} {...tint} />
                        : <div className="h-[120px] w-full bg-[#f9fafb]" />}
                    <div className="flex flex-col gap-4 px-5">
                        <div className="flex flex-col gap-2">
                            <p className="text-[18px] leading-[28px] font-medium text-[#101828] truncate">
                                {hasName ? data.name : "Product name"}
                            </p>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <CalendarCheck01 className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">{data.creditsLabel || "Credit"}</span>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">{data.durationLabel || "Duration"}</span>
                                </div>
                            </div>
                        </div>
                        <p className="font-semibold text-[20px] leading-[30px] text-[#658774]">
                            AED {data.price.toLocaleString("en-US")}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Duration <-> Membership/Package column conversion ─────────────────────
//
// The seed Membership type stores `duration_months`; Package stores
// `validity_days`. The form's free-form "N + Day/Month/Year" is collapsed
// back into those columns when we persist on Save.

function monthsFromDuration(d: DurationData): number {
    const n = Number(d.duration);
    if (!Number.isFinite(n) || n <= 0) return 1;
    if (d.unit === "month") return n;
    if (d.unit === "year")  return n * 12;
    // "day" → approximate at 30 days/month, snap to ≥1.
    return Math.max(1, Math.round(n / 30));
}

function daysFromDuration(d: DurationData): number {
    const n = Number(d.duration);
    if (!Number.isFinite(n) || n <= 0) return 1;
    if (d.unit === "day")   return n;
    if (d.unit === "month") return n * 30;
    return n * 365;
}

// ─── Shared page component (mounted by /products/new + /products/[id]/edit) ─

/** Initial form data — every field is optional so callers only seed what
 *  they have. Mode "create" generally passes nothing; mode "edit" seeds
 *  from the persisted Membership/Package columns we have today and lets
 *  the rest default to EMPTY_PURCHASE_RULES + fresh form values. */
export interface ProductFormInitial {
    kind?: ProductKind;
    basic?: Partial<BasicInfo>;
    config?: Partial<ConfigurationData>;
    duration?: Partial<DurationData>;
    rules?: PurchaseRulesData;
}

export interface ProductFormPageProps {
    mode: "create" | "edit";
    /** Required when mode === "edit" — the id the save action writes to. */
    productId?: string;
    initial?: ProductFormInitial;
    /** Where the close / list-bound nav should return to. */
    returnTo?: string;
}

export function ProductFormPage({ mode, productId, initial, returnTo = "/admin/products" }: ProductFormPageProps) {
    const router = useRouter();

    const isEdit = mode === "edit";

    // In edit mode the kind is locked + Step 1 is skipped — we start at
    // Step 2 with Step 1 visually marked complete on the stepper.
    const [step, setStep] = useState(isEdit ? 2 : 1);
    const [kind, setKind] = useState<ProductKind | null>(initial?.kind ?? null);
    const [basic, setBasic] = useState<BasicInfo>({
        name: initial?.basic?.name ?? "",
        description: initial?.basic?.description ?? "",
        welcomeMessage: initial?.basic?.welcomeMessage ?? "",
        price: initial?.basic?.price ?? "",
    });
    const [config, setConfig] = useState<ConfigurationData>({
        unlimitedCredits: initial?.config?.unlimitedCredits ?? false,
        creditAmount: initial?.config?.creditAmount ?? "",
        isIntroOffer: initial?.config?.isIntroOffer ?? false,
        multiLocation: initial?.config?.multiLocation ?? false,
        branchIds: initial?.config?.branchIds ?? [],
        singleBranchId: initial?.config?.singleBranchId ?? null,
    });
    const [duration, setDuration] = useState<DurationData>({
        duration: initial?.duration?.duration ?? "",
        unit: initial?.duration?.unit ?? "day",
        activeOnFirstUse: initial?.duration?.activeOnFirstUse ?? false,
        autoRenew: initial?.duration?.autoRenew ?? false,
    });
    const [rules, setRules] = useState<PurchaseRulesData>(initial?.rules ?? EMPTY_PURCHASE_RULES);

    const showToast        = useAppStore(s => s.showToast);
    const addMembership    = useAppStore(s => s.addMembership);
    const addPackage       = useAppStore(s => s.addPackage);
    const updateMembership = useAppStore(s => s.updateMembership);
    const updatePackage    = useAppStore(s => s.updatePackage);
    const branches         = useAppStore(s => s.branches);

    function handleClose() {
        // Edit mode returns to the detail page; create mode returns to list.
        if (isEdit && productId) router.push(`/products/${productId}`);
        else                     router.push(returnTo);
    }

    /** Step 5 primary action.
     *  - create mode: writes a new row via `addMembership` / `addPackage`,
     *                 fires the "New X was created" toast, then routes to
     *                 the new product's detail page so the admin can see
     *                 their input reflected immediately.
     *  - edit mode  : writes every form field back through `updateMembership`
     *                 / `updatePackage`, fires the "X was updated" toast,
     *                 returns to the detail page. */
    function handleSubmit() {
        if (!kind) return;
        const productLabel = kind === "membership" ? "membership" : "credit package";

        // ─── Shared column derivations ─────────────────────────────────────
        const price = Number(basic.price);
        const numericCredits = Number(config.creditAmount);
        const safePrice = Number.isFinite(price) ? price : 0;
        const safeCredits = Number.isFinite(numericCredits) ? numericCredits : 0;
        const branchIds = config.multiLocation
            ? config.branchIds
            : (config.singleBranchId ? [config.singleBranchId] : []);
        const welcomeMessage = basic.welcomeMessage.trim() || undefined;

        if (isEdit && productId) {
            // Persist every column the form touches. Status stays untouched
            // here so it doesn't reset to Active when an admin saves edits
            // on a deactivated/archived product (status changes are owned
            // by the row + sidebar action menus).
            if (kind === "membership") {
                updateMembership(productId, {
                    name: basic.name,
                    description: basic.description,
                    credits: config.unlimitedCredits
                        ? "unlimited"
                        : safeCredits,
                    duration_months: monthsFromDuration(duration),
                    price_aed: safePrice,
                    branch_ids: branchIds,
                    welcome_message: welcomeMessage,
                    active_on_first_use: duration.activeOnFirstUse,
                    auto_renew: duration.autoRenew,
                    purchase_rules: rules,
                });
            } else {
                updatePackage(productId, {
                    name: basic.name,
                    description: basic.description,
                    credits: safeCredits,
                    validity_days: daysFromDuration(duration),
                    price_aed: safePrice,
                    branch_ids: branchIds,
                    welcome_message: welcomeMessage,
                    is_intro_offer: config.isIntroOffer,
                    purchase_rules: rules,
                });
            }
            showToast(
                `${kind === "membership" ? "Membership" : "Credit package"} was updated`,
                `${basic.name.trim() || `Your ${productLabel}`} has been saved.`,
                "success",
                "check",
            );
            router.push(`/products/${productId}`);
            return;
        }

        // ─── Create ────────────────────────────────────────────────────────
        // New rows go in with `status: "active"` so they land in the live
        // POS catalog + the class-types Applicable Plans tab immediately.
        let newId: string;
        if (kind === "membership") {
            newId = addMembership({
                name: basic.name.trim() || "New membership",
                description: basic.description.trim() || undefined,
                credits: config.unlimitedCredits ? "unlimited" : safeCredits,
                duration_months: monthsFromDuration(duration),
                price_aed: safePrice,
                branch_ids: branchIds,
                status: "active",
                welcome_message: welcomeMessage,
                active_on_first_use: duration.activeOnFirstUse,
                auto_renew: duration.autoRenew,
                purchase_rules: rules,
            });
        } else {
            newId = addPackage({
                name: basic.name.trim() || "New credit package",
                description: basic.description.trim() || undefined,
                credits: safeCredits,
                validity_days: daysFromDuration(duration),
                price_aed: safePrice,
                branch_ids: branchIds,
                status: "active",
                welcome_message: welcomeMessage,
                is_intro_offer: config.isIntroOffer,
                purchase_rules: rules,
            });
        }
        showToast(
            `New ${productLabel} was created`,
            `New ${productLabel} is ready and available for sale.`,
            "success",
            "check",
        );
        // Route to the new detail page so the admin can immediately see the
        // input reflected end-to-end (list view → detail view → sidebar stats).
        router.push(`/products/${newId}`);
    }

    // ─── Preview labels — derived from live config so the right rail stays
    //     in sync with the form as the user types/toggles. ──────────────────
    const previewPrice = basic.price === "" ? 0 : Number(basic.price);
    const creditsLabel = (() => {
        if (kind === "membership" && config.unlimitedCredits) return "Unlimited";
        if (config.creditAmount === "") return "";
        const n = Number(config.creditAmount);
        if (!Number.isFinite(n) || n <= 0) return "";
        return n === 1 ? "1 credit" : `${n} credits`;
    })();
    const durationLabel = (() => {
        const n = Number(duration.duration);
        if (!duration.duration || !Number.isFinite(n) || n <= 0) return "";
        return `${n} ${duration.unit}${n === 1 ? "" : "s"}`;
    })();
    const previewData: PreviewState = {
        kind,
        name: basic.name,
        creditsLabel,
        durationLabel,
        price: Number.isFinite(previewPrice) ? previewPrice : 0,
    };

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Top header (72px) */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    {isEdit
                        ? `Edit ${kind === "package" ? "credit package" : "membership"}`
                        : "Create new product"}
                </h1>
            </div>

            {/* 3-column shell */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">

                    {/* Left: progress steps */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                    </div>

                    {/* Middle: form
                        Step 1 (product kind picker) is create-only — in
                        edit mode the kind is locked and we land on Step 2.
                        Step 2 "Back" in edit mode closes back to the
                        detail page instead of routing to a kind picker
                        the user can't navigate. */}
                    {step === 1 && !isEdit && (
                        <SelectProductStep
                            kind={kind}
                            onChange={setKind}
                            onContinue={() => setStep(2)}
                        />
                    )}
                    {step === 2 && kind && (
                        <BasicInformationStep
                            kind={kind}
                            data={basic}
                            onChange={p => setBasic(prev => ({ ...prev, ...p }))}
                            onBack={isEdit ? handleClose : () => setStep(1)}
                            onContinue={() => setStep(3)}
                        />
                    )}
                    {step === 3 && kind && (
                        <ProductConfigurationStep
                            kind={kind}
                            data={config}
                            onChange={p => setConfig(prev => ({ ...prev, ...p }))}
                            onBack={() => setStep(2)}
                            onContinue={() => setStep(4)}
                            branches={branches}
                        />
                    )}
                    {step === 4 && kind && (
                        <DurationRenewalStep
                            kind={kind}
                            data={duration}
                            onChange={p => setDuration(prev => ({ ...prev, ...p }))}
                            onBack={() => setStep(3)}
                            onContinue={() => setStep(5)}
                        />
                    )}
                    {step === 5 && kind && (
                        <PurchaseRulesStep
                            kind={kind}
                            data={rules}
                            onChange={setRules}
                            onBack={() => setStep(4)}
                            onCreate={handleSubmit}
                            submitLabel={isEdit ? "Save changes" : "Create product"}
                        />
                    )}

                    {/* Right: template preview */}
                    <TemplatePreviewCard data={previewData} />
                </div>
            </div>
        </div>
    );
}
