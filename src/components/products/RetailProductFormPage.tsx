"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail product create / edit form (full-page)
// ─────────────────────────────────────────────────────────────────────────────
//
// 3-column full-viewport shell matching /products/new + /products/gift-cards/new:
//   • Top header (72px, NO border) — X close + title + Breadcrumbs
//   • Left column (300px)  — stepper (Basic info · Pricing & stock · Review)
//   • Middle column        — FormCard with step content + footer Back/Continue
//   • Right column (400px) — Template preview
//
// Same primitives (FormCard / Section / FormField / TextInput / Textarea /
// PriceInput / INPUT_CLS / StepItem) as ProductFormPage / GiftCardFormPage
// so retail lives in the same design language as the rest of the products
// namespace.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, CoinsHand, Package, Plus, ChevronUp, ChevronDown,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";
import { useAppStore, RETAIL_SIZE_SUGGESTIONS, type RetailProduct } from "@/lib/store";

// ─── Steps ─────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Basic information" },
    { n: 2, label: "Pricing & stock" },
];

function StepItem({ step, current }: { step: typeof STEPS[0]; current: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === STEPS.length;
    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#457175]"
                        : complete
                            ? "bg-[var(--colors-secondary-600)] text-white"
                            : "bg-[var(--colors-bg-tertiary)] border border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[var(--colors-bg-quaternary)] rounded-[2px]" />
                )}
            </div>
            <span className={cn(
                "text-[14px]",
                active
                    ? "font-semibold text-[#10373a]"
                    : complete
                        ? "font-medium text-[var(--colors-text-secondary)]"
                        : "font-medium text-[var(--colors-text-quaternary)]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form primitives (mirror ProductFormPage) ──────────────────────────────

function FormCard({ title, children, footer }: {
    title?: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                {title && (
                    <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">{title}</h2>
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
            <h3 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">{title}</h3>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

function FormField({ label, hint, error, children }: {
    label?: string; hint?: string; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</label>}
            {children}
            {error
                ? <p className="text-[14px] text-[#d92d20] leading-5">{error}</p>
                : hint && <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">{hint}</p>}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";
const INPUT_CLS_VALID = "border-[var(--colors-border-primary)] focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)]";
const INPUT_CLS_INVALID = "border-[#fda29b] focus:ring-[#fecdca] focus:border-[#d92d20]";

function TextInput({ value, onChange, placeholder, invalid = false }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
    /** When true, swaps the border/ring to the DS error tone (`#fda29b`
     *  → `#d92d20`). Used by the SKU field's live-duplicate check so the
     *  admin sees the error state as they type. */
    invalid?: boolean;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className={cn(INPUT_CLS, invalid ? INPUT_CLS_INVALID : INPUT_CLS_VALID)}
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
            className="w-full px-[14px] py-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y leading-6"
        />
    );
}

/** AED-prefixed price input — matches the ProductFormPage PriceInput
 *  exactly (h-10 shell + tight prefix + NumericStringInput inside). */
function PriceInput({ value, onChange }: {
    value: string; onChange: (v: string) => void;
}) {
    return (
        <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] transition-all h-10">
            <div className="flex items-center pl-[14px] text-[16px] font-medium text-[var(--colors-text-quaternary)] shrink-0">AED</div>
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

function IntegerInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <NumericStringInput
            value={value}
            onChange={onChange}
            min={0}
            step={1}
            placeholder={placeholder ?? "0"}
            className={INPUT_CLS}
        />
    );
}

// ─── Step 1 — Basic information ────────────────────────────────────────────

// ─── Auto-SKU helpers ───────────────────────────────────────────────────────
//
// Client 2026-07-31 — SKU auto-generates from (category, product name)
// as the admin types. Format: `{CAT}-{NAME_INITIALS}-{NNN}`.
//
//   • Category → 3-letter prefix. The 5 seeded categories have curated
//     prefixes (Apparel → APP, Supplements → SUP, Equipment → EQP,
//     Accessories → ACC, Recovery → REC). Any new category falls back
//     to the first 3 letters of its label uppercased.
//   • Name initials → first letter of every significant word (words < 2
//     chars are skipped). "Onra Studio Tank" → OST. If < 2 chars result,
//     pad from the first word so we always land on 2+ chars.
//   • Number → next available 3-digit ordinal for the {CAT}-{INITIALS}
//     stem, checked against existing SKUs so we never emit a duplicate.

const CURATED_CATEGORY_PREFIX: Record<string, string> = {
    apparel: "APP",
    supplements: "SUP",
    equipment: "EQP",
    accessories: "ACC",
    recovery: "REC",
};

function categoryPrefixFromLabel(label: string): string {
    const key = label.trim().toLowerCase();
    if (key in CURATED_CATEGORY_PREFIX) return CURATED_CATEGORY_PREFIX[key];
    // Fallback — first 3 letters of the label, uppercased, padded with X.
    const letters = key.replace(/[^a-z]/g, "").slice(0, 3).toUpperCase();
    return (letters + "XXX").slice(0, 3);
}

function nameInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(w => w.length >= 2);
    let init = words.map(w => w[0]!.toUpperCase()).join("");
    if (init.length < 2) {
        // Pad from the first word so a one-word product like "Socks"
        // becomes "SO" and still slots into the {CAT}-{XX}-{NNN} shape.
        const first = (name.trim().split(/\s+/)[0] ?? "").toUpperCase();
        init = (init + first).slice(0, Math.max(2, init.length + 1));
    }
    return init.slice(0, 4); // cap to 4 letters to keep SKU compact
}

function nextOrdinalForStem(stem: string, existingSkus: readonly string[]): string {
    // Scan every existing SKU whose stem matches ours, extract the
    // 3-digit trailing number, and return next-max padded to 3 digits.
    let maxN = 0;
    const rx = new RegExp(`^${stem.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}-(\\d{3,})$`);
    for (const sku of existingSkus) {
        const m = sku.toUpperCase().match(rx);
        if (!m) continue;
        const n = Number(m[1]);
        if (Number.isFinite(n) && n > maxN) maxN = n;
    }
    return String(maxN + 1).padStart(3, "0");
}

/** Compose the auto-SKU. Returns "" when we can't (missing name or
 *  category) so the caller can leave the field empty. */
function generateAutoSku(
    name: string,
    categoryLabel: string,
    existingSkus: readonly string[],
): string {
    const trimmedName = name.trim();
    if (!trimmedName || !categoryLabel) return "";
    const cat = categoryPrefixFromLabel(categoryLabel);
    const init = nameInitials(trimmedName);
    if (!cat || !init) return "";
    const stem = `${cat}-${init}`;
    const ordinal = nextOrdinalForStem(stem, existingSkus);
    return `${stem}-${ordinal}`;
}

interface BasicInfo {
    imageUrl: string;
    name: string;
    sku: string;
    categoryId: string;
    description: string;
    /** Free-form size variants (e.g. "Small", "Medium"). Empty = sizeless. */
    sizes: string[];
}

// Stock inputs are keyed per (branch) for sizeless products and per
// (branch × size) for sized ones. This helper keeps both paths on one flat map.
const STOCK_SEP = "::";
function stockKey(branchId: string, size?: string): string {
    return size ? `${branchId}${STOCK_SEP}${size}` : branchId;
}
/** The (branch × size) combos to render / seed for a product. Sizeless → one
 *  entry per branch with size undefined. */
function stockCombos(branchId: string, sizes: string[]): { size?: string; key: string }[] {
    return sizes.length > 0
        ? sizes.map(sz => ({ size: sz, key: stockKey(branchId, sz) }))
        : [{ size: undefined, key: stockKey(branchId) }];
}

/** Filled checkbox — same look as the membership form's BranchMultiSelect. */
function SizeCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-secondary-600)]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

/** Dynamic size-variant multi-select — mirrors the "Applicable branches"
 *  collapsible card (header + "N selected" badge + chevron + checkbox rows).
 *  The admin ticks/creates size labels; each row can be removed outright.
 *  Empty selection = a sizeless product. */
function SizesField({ sizes, onChange }: { sizes: string[]; onChange: (next: string[]) => void }) {
    const [expanded, setExpanded] = useState(true);
    const [draft, setDraft] = useState("");
    // The visible option rows — common suggestions + whatever the admin has
    // added. Removing a row drops it entirely (and deselects it).
    const [options, setOptions] = useState<string[]>(() => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const label of [...RETAIL_SIZE_SUGGESTIONS, ...sizes]) {
            const k = label.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(label);
        }
        return out;
    });

    const isChecked = (label: string) => sizes.some(s => s.toLowerCase() === label.toLowerCase());
    const toggle = (label: string) => {
        if (isChecked(label)) onChange(sizes.filter(s => s.toLowerCase() !== label.toLowerCase()));
        else onChange([...sizes, label]);
    };
    const removeOption = (label: string) => {
        setOptions(prev => prev.filter(o => o.toLowerCase() !== label.toLowerCase()));
        if (isChecked(label)) onChange(sizes.filter(s => s.toLowerCase() !== label.toLowerCase()));
    };
    const addCustom = () => {
        const label = draft.trim();
        if (!label) return;
        if (!options.some(o => o.toLowerCase() === label.toLowerCase())) setOptions(p => [...p, label]);
        if (!isChecked(label)) onChange([...sizes, label]);
        setDraft("");
    };

    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">Sizes</p>
                    <p className="text-[14px] text-[#6e776f] leading-5 truncate">Add the sizes this product comes in.</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] shrink-0">
                    {sizes.length} selected
                </span>
                <button type="button" onClick={() => setExpanded(p => !p)}
                    aria-label={expanded ? "Collapse" : "Expand"}
                    className="w-5 h-5 flex items-center justify-center text-[var(--colors-text-quaternary)] shrink-0">
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {expanded && (
                <div className="flex flex-col gap-3">
                    {options.map(label => (
                        <div key={label} className="flex items-center gap-2">
                            <SizeCheckbox checked={isChecked(label)} onChange={() => toggle(label)} />
                            <span className="text-[14px] font-medium text-[var(--colors-text-primary)] flex-1">{label}</span>
                            <button type="button" onClick={() => removeOption(label)} aria-label={`Remove ${label}`}
                                className="w-6 h-6 flex items-center justify-center rounded-[6px] text-[var(--colors-fg-quaternary)] hover:text-[#b42318] hover:bg-[#fef3f2] transition-colors shrink-0">
                                <XClose className="w-4 h-4" />
                            </button>
                        </div>
                    ))}

                    <div className="h-px bg-[var(--colors-bg-quaternary)]" />

                    {/* Add a custom size label */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1">
                            <TextInput
                                value={draft}
                                onChange={setDraft}
                                placeholder="Add a custom size (e.g. XXL, 38)"
                            />
                        </div>
                        <Button variant="secondary-gray" size="md" disabled={!draft.trim()} onClick={addCustom}>
                            Add
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function BasicInformationStep({
    data, onChange, categoryOptions, errors, onBack, onContinue, onCreateCategory,
}: {
    data: BasicInfo;
    onChange: (patch: Partial<BasicInfo>) => void;
    categoryOptions: { value: string; label: string }[];
    errors: Partial<Record<keyof BasicInfo, string>>;
    onBack: () => void;
    onContinue: () => void;
    /** Opens the parent's inline "Create category" modal. Called from
     *  the dropdown's menuHeader "+ Create category" button. */
    onCreateCategory: () => void;
}) {
    const canContinue = !!data.name.trim() && !!data.sku.trim() && !!data.categoryId;
    return (
        <FormCard
            title="Basic information"
            footer={
                <div className="flex items-center justify-between gap-3 w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>Continue</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-8">
                <Section title="Information">
                    {/* Image upload (label lives inside the shared uploader,
                        matching class-types/new pattern). */}
                    <ImageBannerUpload
                        preview={data.imageUrl || null}
                        onChange={(url) => onChange({ imageUrl: url ?? "" })}
                    />
                    {/* Client 2026-07-31 — SKU FIRST, name second. Now
                        strictly auto-driven: every time name or category
                        changes the SKU regenerates from (category prefix,
                        name initials, next ordinal). The admin CAN still
                        type in the field — the edit lives in state until
                        the next name/category change overwrites it. Live
                        duplicate check surfaces its error inline in RED
                        below (no "hint" copy, since the field is never
                        empty by design — it's pre-seeded on mount from
                        the default category + a placeholder name). */}
                    <FormField label="SKU" error={errors.sku}>
                        <TextInput
                            value={data.sku}
                            onChange={v => onChange({ sku: v.toUpperCase() })}
                            invalid={!!errors.sku}
                        />
                    </FormField>
                    <FormField label="Product name" error={errors.name}>
                        <TextInput
                            value={data.name}
                            onChange={v => onChange({ name: v })}
                            placeholder="e.g. Onra Studio Tank"
                        />
                    </FormField>
                    <FormField label="Retail category" error={errors.categoryId}>
                        <SelectInput
                            value={data.categoryId}
                            onChange={v => onChange({ categoryId: v })}
                            options={categoryOptions}
                            placeholder="Select a category"
                            width="w-full"
                            menuHeader={({ close }) => (
                                <button
                                    type="button"
                                    onClick={() => { close(); onCreateCategory(); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] font-medium text-[var(--colors-secondary-600)] hover:bg-[var(--colors-bg-secondary)] transition-colors rounded-t-[8px]"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create category
                                </button>
                            )}
                        />
                    </FormField>
                    <FormField label="Description">
                        <Textarea
                            value={data.description}
                            onChange={v => onChange({ description: v })}
                            placeholder="Optional — brief description for the POS card and customer portal."
                            minHeight={120}
                        />
                    </FormField>
                    <SizesField sizes={data.sizes} onChange={sizes => onChange({ sizes })} />
                </Section>
            </div>
        </FormCard>
    );
}

// ─── Step 2 — Pricing & stock ──────────────────────────────────────────────

interface PricingInfo {
    priceAed: string;
    unitCostAed: string;
    reorderThreshold: string;
}

function PricingStep({
    data, onChange, errors,
    branches, sizes, stockByBranch, onStockChange,
    mode, onBack, onSubmit, submitLabel, saving,
}: {
    data: PricingInfo;
    onChange: (patch: Partial<PricingInfo>) => void;
    errors: Partial<Record<keyof PricingInfo, string>>;
    branches: { id: string; name: string }[];
    /** Declared size variants — when non-empty the stock inputs render per
     *  (branch × size). */
    sizes: string[];
    stockByBranch: Record<string, string>;
    onStockChange: (key: string, value: string) => void;
    mode: Mode;
    onBack: () => void;
    onSubmit: () => void;
    submitLabel: string;
    saving: boolean;
}) {
    const priceOk = Number(data.priceAed) > 0;
    const costOk  = data.unitCostAed !== "" && Number(data.unitCostAed) >= 0;
    const thrOk   = data.reorderThreshold !== "" && Number(data.reorderThreshold) >= 0 && Number.isInteger(Number(data.reorderThreshold));
    const canSubmit = priceOk && costOk && thrOk && !saving;
    // Per-branch accordion for the SIZED stock grid — branches start EXPANDED
    // (client 2026-08-04); collapse the ones you're done with so a studio with
    // many branches isn't one long scroll. Sizeless products stay flat rows.
    const [collapsedBranches, setCollapsedBranches] = useState<Set<string>>(new Set());
    const toggleBranch = (id: string) =>
        setCollapsedBranches(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    return (
        <FormCard
            title="Pricing & stock"
            footer={
                <div className="flex items-center justify-between gap-3 w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canSubmit} onClick={onSubmit}>{submitLabel}</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-8">
                <Section title="Pricing">
                    <FormField label="Price · AED" error={errors.priceAed} hint="The price customers pay at POS.">
                        <PriceInput
                            value={data.priceAed}
                            onChange={v => onChange({ priceAed: v })}
                        />
                    </FormField>
                    <FormField label="Unit cost · AED" error={errors.unitCostAed} hint="What you pay per unit. Powers the Gross margin % in the Retail Sales report.">
                        <PriceInput
                            value={data.unitCostAed}
                            onChange={v => onChange({ unitCostAed: v })}
                        />
                    </FormField>
                </Section>

                <Section title="Stock alert">
                    <FormField label="Reorder threshold" error={errors.reorderThreshold} hint="The Stock on Hand report flags any branch at or below this level.">
                        <IntegerInput
                            value={data.reorderThreshold}
                            onChange={v => onChange({ reorderThreshold: v })}
                        />
                    </FormField>
                </Section>

                {/* Initial stock (create) / Adjust stock (edit) — one input
                    per active branch, or per (branch × size) for a sized
                    product. Changes are applied via the store's
                    adjustRetailStock action on save so the audit log stays
                    in step with the running balance. */}
                <Section title={mode === "create" ? "Initial stock" : "Stock on hand"}>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">
                        {sizes.length > 0
                            ? (mode === "create"
                                ? "Set how many units land at each branch, per size, when this product goes live. Every entry writes a matching audit-log row (kind: receive)."
                                : "Adjust units on hand per branch, per size. Only entries that change are re-written; every change logs a matching audit-log row.")
                            : (mode === "create"
                                ? "Set how many units land at each branch when this product goes live. Every entry writes a matching audit-log row (kind: receive)."
                                : "Adjust units on hand per branch. Only branches that change are re-written; every change logs a matching audit-log row.")}
                    </p>
                    <div className="flex flex-col gap-3">
                        {branches.map(b => {
                            // Sized product → collapsible per-branch accordion
                            // (header toggles the size rows). Sizeless → flat row.
                            if (sizes.length > 0) {
                                const open = !collapsedBranches.has(b.id);
                                return (
                                    <div key={b.id} className="flex flex-col border-1 border-[var(--colors-border-secondary)] rounded-[10px] overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => toggleBranch(b.id)}
                                            aria-expanded={open}
                                            className="flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-[var(--colors-bg-secondary)] transition-colors"
                                        >
                                            <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">{b.name}</p>
                                            <ChevronDown className={cn("w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0 transition-transform", !open && "-rotate-90")} />
                                        </button>
                                        {open && (
                                            <div className="flex flex-col gap-2 px-3 pb-3 pl-4">
                                                {sizes.map(sz => {
                                                    const key = stockKey(b.id, sz);
                                                    return (
                                                        <div key={sz} className="flex items-center justify-between gap-3">
                                                            <p className="text-[14px] text-[var(--colors-text-tertiary)]">{sz}</p>
                                                            <div className="w-[140px]">
                                                                <IntegerInput
                                                                    value={stockByBranch[key] ?? ""}
                                                                    onChange={v => onStockChange(key, v)}
                                                                    placeholder="0"
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            }
                            return (
                                <div key={b.id} className="flex items-center justify-between gap-3">
                                    <p className="text-[14px] text-[var(--colors-text-primary)]">{b.name}</p>
                                    <div className="w-[140px]">
                                        <IntegerInput
                                            value={stockByBranch[b.id] ?? ""}
                                            onChange={v => onStockChange(b.id, v)}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Section>
            </div>
        </FormCard>
    );
}

// ─── Preview card ──────────────────────────────────────────────────────────

function TemplatePreviewCard({ basic, pricing, categoryLabel }: {
    basic: BasicInfo;
    pricing: PricingInfo;
    categoryLabel: string;
}) {
    const hasName = !!basic.name.trim();
    const priceNum = Number(pricing.priceAed);
    const price = Number.isFinite(priceNum) ? priceNum : 0;
    const threshold = Number(pricing.reorderThreshold);
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            <div className="flex flex-col">
                <div className="pt-6 px-6 flex flex-col gap-1">
                    <p className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Template preview</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">This is how your product will look like.</p>
                </div>
                <div className="h-5" />
                <div className="h-px bg-[var(--colors-bg-quaternary)]" />
            </div>
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5 w-[352px] mx-auto">
                    {/* Banner — real image when uploaded, sage placeholder otherwise. */}
                    {basic.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={basic.imageUrl} alt="" className="h-[160px] w-full object-cover" />
                    ) : (
                        <div className="h-[160px] w-full bg-gradient-to-br from-[var(--colors-secondary-50)] to-[#f5fffa]" />
                    )}
                    <div className="flex flex-col gap-4 px-5">
                        <div className="flex flex-col gap-2">
                            <p className="text-[18px] leading-[28px] font-medium text-[var(--colors-text-primary)] truncate">
                                {hasName ? basic.name : "Product name"}
                            </p>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <Package className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                                    <span className="text-[14px] font-medium text-[var(--colors-text-quaternary)] truncate">
                                        {categoryLabel || "Retail category"}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <CoinsHand className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                                    <span className="text-[14px] font-medium text-[var(--colors-text-quaternary)] truncate">
                                        Reorder at {threshold || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="font-semibold text-[20px] leading-[30px] text-[var(--colors-secondary-600)]">
                            AED {price.toLocaleString("en-US")}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Types ─────────────────────────────────────────────────────────────────

type Mode = "create" | "edit";

// ─── Page component ────────────────────────────────────────────────────────

export function RetailProductFormPage({ mode, productId, returnTo }: {
    mode: Mode;
    productId?: string;
    returnTo: string;
}) {
    const router = useRouter();
    const products         = useAppStore(s => s.retailProducts);
    const categories       = useAppStore(s => s.retailCategories);
    const branchesAll      = useAppStore(s => s.branches);
    const stockRows        = useAppStore(s => s.retailStock);
    const addRetailProduct = useAppStore(s => s.addRetailProduct);
    const updateRetailProduct = useAppStore(s => s.updateRetailProduct);
    const addRetailCategory = useAppStore(s => s.addRetailCategory);
    const adjustRetailStock = useAppStore(s => s.adjustRetailStock);
    const showToast        = useAppStore(s => s.showToast);

    // Client 2026-07-31 — inline "Create category" modal reachable from the
    // Retail category dropdown header. Admin doesn't have to leave the form
    // to add a missing category.
    const [creatingCategory, setCreatingCategory] = useState(false);

    // Active branches only — archived branches shouldn't get seeded stock.
    const activeBranches = useMemo(
        () => branchesAll.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branchesAll],
    );

    const target = mode === "edit"
        ? products.find(p => p.id === productId)
        : undefined;

    const [step, setStep] = useState(1);
    // Client 2026-07-31 — SKU always has a REAL value from mount, not just a
    // placeholder. In CREATE mode we pre-select the first active category
    // and pre-seed the SKU using "New Product" as a placeholder name so the
    // field reads like `APP-NP-001` before the admin has typed anything.
    // In EDIT mode we take the target's existing values verbatim.
    const [basic, setBasic] = useState<BasicInfo>(() => {
        if (target) {
            return {
                imageUrl:    target.imageUrl ?? "",
                name:        target.name,
                sku:         target.sku,
                categoryId:  target.categoryId,
                description: target.description ?? "",
                sizes:       target.sizes ?? [],
            };
        }
        const firstActiveCategory = categories.find(c => c.status === "active");
        const initialCategoryId   = firstActiveCategory?.id ?? "";
        const initialCategoryLabel = firstActiveCategory?.label ?? "";
        const initialSku = initialCategoryLabel
            ? generateAutoSku("New Product", initialCategoryLabel, products.map(p => p.sku))
            : "";
        return {
            imageUrl:    "",
            name:        "",
            sku:         initialSku,
            categoryId:  initialCategoryId,
            description: "",
            sizes:       [],
        };
    });
    const [pricing, setPricing] = useState<PricingInfo>(() => ({
        priceAed:         target ? String(target.priceAed) : "",
        unitCostAed:      target ? String(target.unitCostAed) : "",
        reorderThreshold: target ? String(target.reorderThreshold) : "",
    }));
    // Per-(branch × size) stock inputs, keyed by `stockKey`. In create mode
    // start at "" (renders as placeholder "0"). In edit mode seed from current
    // unitsOnHand so the admin can see and adjust exactly what's on hand.
    const initialStockByBranch = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        const initialSizes = target?.sizes ?? [];
        for (const b of activeBranches) {
            for (const { size, key } of stockCombos(b.id, initialSizes)) {
                if (target) {
                    const row = stockRows.find(
                        s => s.productId === target.id && s.branchId === b.id && (s.size ?? undefined) === (size ?? undefined),
                    );
                    map[key] = row ? String(row.unitsOnHand) : "0";
                } else {
                    map[key] = "";
                }
            }
        }
        return map;
    }, [activeBranches, target, stockRows]);
    const [stockByBranch, setStockByBranch] = useState<Record<string, string>>(initialStockByBranch);
    function updateStock(key: string, value: string) {
        setStockByBranch(prev => ({ ...prev, [key]: value }));
    }
    // When the admin adds/removes size variants in step 1, make sure every
    // needed (branch × size) input key exists before step 2 renders. Existing
    // values are preserved; new keys default to the current on-hand (edit) or
    // blank (create). Stale keys are harmless — submit only reads live combos.
    useEffect(() => {
        setStockByBranch(prev => {
            const next = { ...prev };
            for (const b of activeBranches) {
                for (const { size, key } of stockCombos(b.id, basic.sizes)) {
                    if (next[key] !== undefined) continue;
                    if (target) {
                        const row = stockRows.find(
                            s => s.productId === target.id && s.branchId === b.id && (s.size ?? undefined) === (size ?? undefined),
                        );
                        next[key] = row ? String(row.unitsOnHand) : "0";
                    } else {
                        next[key] = "";
                    }
                }
            }
            return next;
        });
    }, [basic.sizes, activeBranches, target, stockRows]);
    const [errors, setErrors] = useState<{
        basic: Partial<Record<keyof BasicInfo, string>>;
        pricing: Partial<Record<keyof PricingInfo, string>>;
    }>({ basic: {}, pricing: {} });
    const [saving, setSaving] = useState(false);

    const categoryOptions = useMemo(
        () => categories.filter(c => c.status === "active").map(c => ({ value: c.id, label: c.label })),
        [categories],
    );
    const categoryLabel = categories.find(c => c.id === basic.categoryId)?.label ?? "";

    function updateBasic(patch: Partial<BasicInfo>) {
        setBasic(prev => {
            const next = { ...prev, ...patch };
            // Client 2026-07-31 — SKU ALWAYS auto-regenerates from the
            // latest (name, category). No "manually edited" latch — the
            // admin's direct edits to the SKU field live in state until
            // the next name/category change overwrites them. Empty name
            // falls back to a placeholder ("New Product") so the field
            // always ends up with a real value like `APP-NP-001`.
            const nameOrCategoryChanged = "name" in patch || "categoryId" in patch;
            if (nameOrCategoryChanged) {
                const nextCategoryLabel = categories.find(c => c.id === next.categoryId)?.label ?? "";
                if (nextCategoryLabel) {
                    const otherSkus = products
                        .filter(p => p.id !== productId) // ignore the edit target's own SKU
                        .map(p => p.sku);
                    const auto = generateAutoSku(
                        next.name.trim() || "New Product",
                        nextCategoryLabel,
                        otherSkus,
                    );
                    if (auto) next.sku = auto;
                }
            }
            return next;
        });
        // Live-duplicate check on the SKU field. Fires on name/category/sku
        // changes because auto-SKU can also produce a value the admin needs
        // to see validated. Compares case-insensitively against every OTHER
        // product's SKU (edit target excluded). Includes archived rows too —
        // the store doesn't block against them on save per spec, but showing
        // the error early stops the admin from clashing.
        const nextSkuRaw = ("sku" in patch ? String(patch.sku ?? "") : basic.sku).trim();
        const keys = Object.keys(patch) as (keyof BasicInfo)[];
        setErrors(e => {
            const nextBasicErrors = Object.fromEntries(
                Object.entries(e.basic).filter(([k]) => !keys.includes(k as keyof BasicInfo)),
            ) as typeof e.basic;
            if (nextSkuRaw) {
                const dup = products.some(
                    p => p.id !== productId
                        && p.status !== "archived"
                        && p.sku.toLowerCase() === nextSkuRaw.toLowerCase(),
                );
                if (dup) {
                    nextBasicErrors.sku = "This SKU is already in use. Every product must have a unique SKU.";
                }
            }
            return { ...e, basic: nextBasicErrors };
        });
    }
    function updatePricing(patch: Partial<PricingInfo>) {
        setPricing(prev => ({ ...prev, ...patch }));
        const keys = Object.keys(patch) as (keyof PricingInfo)[];
        setErrors(e => ({ ...e, pricing: Object.fromEntries(Object.entries(e.pricing).filter(([k]) => !keys.includes(k as keyof PricingInfo))) }));
    }

    function handleClose() {
        router.push(returnTo);
    }

    function handleSubmit() {
        setSaving(true);
        const cleanSizes = basic.sizes.map(s => s.trim()).filter(Boolean);
        const payload = {
            name: basic.name.trim(),
            sku: basic.sku.trim(),
            categoryId: basic.categoryId,
            description: basic.description.trim() || undefined,
            priceAed: Number(pricing.priceAed),
            unitCostAed: Number(pricing.unitCostAed),
            reorderThreshold: Number(pricing.reorderThreshold),
            imageUrl: basic.imageUrl.trim() || undefined,
            sizes: cleanSizes.length > 0 ? cleanSizes : undefined,
            status: (target?.status ?? "active") as RetailProduct["status"],
        };
        if (mode === "create") {
            const id = addRetailProduct(payload);
            if (!id) {
                setSaving(false);
                setStep(1);
                setErrors(e => ({ ...e, basic: { ...e.basic, sku: "SKU already in use by another product." } }));
                return;
            }
            // Seed stock — for each (branch × size) with a positive entry, write
            // a "receive" adjustment so the running balance + audit log land on
            // the new product atomically. Sizeless products use one entry per
            // branch (size undefined).
            for (const b of activeBranches) {
                for (const { size, key } of stockCombos(b.id, cleanSizes)) {
                    const units = Number(stockByBranch[key]);
                    if (!Number.isFinite(units) || units <= 0) continue;
                    adjustRetailStock({
                        productId: id,
                        branchId: b.id,
                        size,
                        delta: Math.floor(units),
                        kind: "receive",
                        reason: "Initial stock from product creation",
                    });
                }
            }
            showToast("Product created", `${payload.name} is now in your retail catalog.`, "success", "check");
            router.push(returnTo);
            return;
        }
        // edit
        if (!productId) return;
        const ok = updateRetailProduct(productId, payload);
        if (!ok) {
            setSaving(false);
            setStep(1);
            setErrors(e => ({ ...e, basic: { ...e.basic, sku: "SKU already in use by another product." } }));
            return;
        }
        // Per-(branch × size) stock deltas — every entry that changed gets one
        // "adjust"/"receive" row. Unchanged entries are skipped so the audit
        // log stays quiet.
        for (const b of activeBranches) {
            for (const { size, key } of stockCombos(b.id, cleanSizes)) {
                const currentRow = stockRows.find(
                    s => s.productId === productId && s.branchId === b.id && (s.size ?? undefined) === (size ?? undefined),
                );
                const currentUnits = currentRow?.unitsOnHand ?? 0;
                const nextUnits = Number(stockByBranch[key]);
                if (!Number.isFinite(nextUnits) || nextUnits < 0) continue;
                const rounded = Math.floor(nextUnits);
                const delta = rounded - currentUnits;
                if (delta === 0) continue;
                adjustRetailStock({
                    productId,
                    branchId: b.id,
                    size,
                    delta,
                    kind: delta > 0 ? "receive" : "adjust",
                    reason: "Manual adjustment from product edit",
                });
            }
        }
        setSaving(false);
        showToast("Product updated", `${payload.name} was saved.`, "success", "check");
        router.push(returnTo);
    }

    // Missing-target guard — happens if someone navigates directly to /edit
    // for a nonexistent id.
    if (mode === "edit" && !target) {
        return (
            <div className="h-screen bg-white flex items-center justify-center px-6 py-10">
                <div className="max-w-md text-center flex flex-col gap-3">
                    <p className="text-[18px] font-semibold text-[var(--colors-text-primary)]">Product not found</p>
                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">
                        The product you were editing may have been deleted. Head back to the retail list.
                    </p>
                    <Button variant="primary" size="md" onClick={() => router.push(returnTo)}>
                        Back to Retail
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Top header (72px, NO border) */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">
                        {mode === "create" ? "Create new retail product" : `Edit ${target?.name ?? "product"}`}
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* 3-column shell */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">
                    {/* Left: progress steps */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                    </div>

                    {/* Middle: form step */}
                    {step === 1 && (
                        <BasicInformationStep
                            data={basic}
                            onChange={updateBasic}
                            categoryOptions={categoryOptions}
                            errors={errors.basic}
                            onBack={handleClose}
                            onContinue={() => setStep(2)}
                            onCreateCategory={() => setCreatingCategory(true)}
                        />
                    )}
                    {step === 2 && (
                        <PricingStep
                            data={pricing}
                            onChange={updatePricing}
                            errors={errors.pricing}
                            branches={activeBranches}
                            sizes={basic.sizes}
                            stockByBranch={stockByBranch}
                            onStockChange={updateStock}
                            mode={mode}
                            onBack={() => setStep(1)}
                            onSubmit={handleSubmit}
                            submitLabel={mode === "create" ? "Create product" : "Save changes"}
                            saving={saving}
                        />
                    )}

                    {/* Right: template preview */}
                    <TemplatePreviewCard basic={basic} pricing={pricing} categoryLabel={categoryLabel} />
                </div>
            </div>

            {/* Client 2026-07-31 — reuse the SAME CategoryModal the admin
                uses on /admin/products/retail-categories so both surfaces
                stay 1:1 (chrome, validation, image upload). Submit calls
                the same addRetailCategory action → Retail Categories
                module + POS filter chips + AI-agent dataset all see the
                new row in the same render cycle (Zustand subscription).
                Duplicate names surface INLINE under the field (via
                takenNames) so the admin sees the error the moment they
                type it — no toast, no submit-then-fail flow. */}
            {creatingCategory && (
                <CategoryModal
                    entityLabel="retail category"
                    onClose={() => setCreatingCategory(false)}
                    takenNames={categories.map(c => c.label)}
                    onSubmit={({ name, image_url }) => {
                        const label = name.trim();
                        if (!label) return;
                        const id = addRetailCategory({
                            label,
                            imageUrl: image_url || undefined,
                        });
                        // Store rejects only on duplicate — but the modal
                        // already blocks submit for that case via
                        // takenNames, so hitting this branch would mean a
                        // race. Bail silently and let the admin retry.
                        if (!id) return;
                        // Auto-select the fresh category on this product so
                        // the form is ready to continue.
                        updateBasic({ categoryId: id });
                        setCreatingCategory(false);
                        showToast(
                            "Category created",
                            `"${label}" has been added to your retail catalog.`,
                            "success", "check",
                        );
                    }}
                />
            )}

            <Toast />
        </div>
    );
}
