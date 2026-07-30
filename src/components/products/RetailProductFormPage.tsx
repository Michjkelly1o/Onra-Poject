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

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, CoinsHand, Package,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { useAppStore, type RetailProduct } from "@/lib/store";

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

// ─── Form primitives (mirror ProductFormPage) ──────────────────────────────

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

function FormField({ label, hint, error, children }: {
    label?: string; hint?: string; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            {label && <label className="text-[14px] font-medium text-[#344054]">{label}</label>}
            {children}
            {error
                ? <p className="text-[14px] text-[#d92d20] leading-5">{error}</p>
                : hint && <p className="text-[14px] text-[#475467] leading-5">{hint}</p>}
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

/** AED-prefixed price input — matches the ProductFormPage PriceInput
 *  exactly (h-10 shell + tight prefix + NumericStringInput inside). */
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

interface BasicInfo {
    imageUrl: string;
    name: string;
    sku: string;
    categoryId: string;
    description: string;
}

function BasicInformationStep({
    data, onChange, categoryOptions, errors, onBack, onContinue,
}: {
    data: BasicInfo;
    onChange: (patch: Partial<BasicInfo>) => void;
    categoryOptions: { value: string; label: string }[];
    errors: Partial<Record<keyof BasicInfo, string>>;
    onBack: () => void;
    onContinue: () => void;
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
                    <FormField label="Product name" error={errors.name}>
                        <TextInput
                            value={data.name}
                            onChange={v => onChange({ name: v })}
                            placeholder="e.g. Onra Studio Tank"
                        />
                    </FormField>
                    <FormField label="SKU" error={errors.sku} hint="Unique alphanumeric code used on receipts and reports.">
                        <TextInput
                            value={data.sku}
                            onChange={v => onChange({ sku: v.toUpperCase() })}
                            placeholder="APP-TNK-001"
                        />
                    </FormField>
                    <FormField label="Retail category" error={errors.categoryId}>
                        <SelectInput
                            value={data.categoryId}
                            onChange={v => onChange({ categoryId: v })}
                            options={categoryOptions}
                            placeholder="Select a category"
                            width="w-full"
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
    branches, stockByBranch, onStockChange,
    mode, onBack, onSubmit, submitLabel, saving,
}: {
    data: PricingInfo;
    onChange: (patch: Partial<PricingInfo>) => void;
    errors: Partial<Record<keyof PricingInfo, string>>;
    branches: { id: string; name: string }[];
    stockByBranch: Record<string, string>;
    onStockChange: (branchId: string, value: string) => void;
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
                    per active branch. Changes are applied via the store's
                    adjustRetailStock action on save so the audit log stays
                    in step with the running balance. */}
                <Section title={mode === "create" ? "Initial stock" : "Stock on hand"}>
                    <p className="text-[14px] text-[#475467] leading-5">
                        {mode === "create"
                            ? "Set how many units land at each branch when this product goes live. Every entry writes a matching audit-log row (kind: receive)."
                            : "Adjust units on hand per branch. Only branches that change are re-written; every change logs a matching audit-log row."}
                    </p>
                    <div className="flex flex-col gap-3">
                        {branches.map(b => (
                            <div key={b.id} className="flex items-center justify-between gap-3">
                                <p className="text-[14px] text-[#101828]">{b.name}</p>
                                <div className="w-[140px]">
                                    <IntegerInput
                                        value={stockByBranch[b.id] ?? ""}
                                        onChange={v => onStockChange(b.id, v)}
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        ))}
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
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            <div className="flex flex-col">
                <div className="pt-6 px-6 flex flex-col gap-1">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Template preview</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">This is how your product will look like.</p>
                </div>
                <div className="h-5" />
                <div className="h-px bg-[#e4e7ec]" />
            </div>
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5 w-[352px] mx-auto">
                    {/* Banner — real image when uploaded, sage placeholder otherwise. */}
                    {basic.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={basic.imageUrl} alt="" className="h-[160px] w-full object-cover" />
                    ) : (
                        <div className="h-[160px] w-full bg-gradient-to-br from-[#e9fff3] to-[#f5fffa]" />
                    )}
                    <div className="flex flex-col gap-4 px-5">
                        <div className="flex flex-col gap-2">
                            <p className="text-[18px] leading-[28px] font-medium text-[#101828] truncate">
                                {hasName ? basic.name : "Product name"}
                            </p>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <Package className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">
                                        {categoryLabel || "Retail category"}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <CoinsHand className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">
                                        Reorder at {threshold || 0}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <p className="font-semibold text-[20px] leading-[30px] text-[#658774]">
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
    const adjustRetailStock = useAppStore(s => s.adjustRetailStock);
    const showToast        = useAppStore(s => s.showToast);

    // Active branches only — archived branches shouldn't get seeded stock.
    const activeBranches = useMemo(
        () => branchesAll.filter(b => b.status !== "archive").map(b => ({ id: b.id, name: b.name })),
        [branchesAll],
    );

    const target = mode === "edit"
        ? products.find(p => p.id === productId)
        : undefined;

    const [step, setStep] = useState(1);
    const [basic, setBasic] = useState<BasicInfo>(() => ({
        imageUrl:    target?.imageUrl ?? "",
        name:        target?.name ?? "",
        sku:         target?.sku ?? "",
        categoryId:  target?.categoryId ?? "",
        description: target?.description ?? "",
    }));
    const [pricing, setPricing] = useState<PricingInfo>(() => ({
        priceAed:         target ? String(target.priceAed) : "",
        unitCostAed:      target ? String(target.unitCostAed) : "",
        reorderThreshold: target ? String(target.reorderThreshold) : "",
    }));
    // Per-branch stock inputs. In create mode start at "" (renders as
    // placeholder "0"). In edit mode seed from current unitsOnHand so the
    // admin can see and adjust exactly what's on hand right now.
    const initialStockByBranch = useMemo<Record<string, string>>(() => {
        const map: Record<string, string> = {};
        for (const b of activeBranches) {
            if (target) {
                const row = stockRows.find(s => s.productId === target.id && s.branchId === b.id);
                map[b.id] = row ? String(row.unitsOnHand) : "0";
            } else {
                map[b.id] = "";
            }
        }
        return map;
    }, [activeBranches, target, stockRows]);
    const [stockByBranch, setStockByBranch] = useState<Record<string, string>>(initialStockByBranch);
    function updateStock(branchId: string, value: string) {
        setStockByBranch(prev => ({ ...prev, [branchId]: value }));
    }
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
        setBasic(prev => ({ ...prev, ...patch }));
        const keys = Object.keys(patch) as (keyof BasicInfo)[];
        setErrors(e => ({ ...e, basic: Object.fromEntries(Object.entries(e.basic).filter(([k]) => !keys.includes(k as keyof BasicInfo))) }));
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
        const payload = {
            name: basic.name.trim(),
            sku: basic.sku.trim(),
            categoryId: basic.categoryId,
            description: basic.description.trim() || undefined,
            priceAed: Number(pricing.priceAed),
            unitCostAed: Number(pricing.unitCostAed),
            reorderThreshold: Number(pricing.reorderThreshold),
            imageUrl: basic.imageUrl.trim() || undefined,
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
            // Seed stock — for each branch with a positive entry, write a
            // "receive" adjustment so the running balance + audit log land
            // on the new product atomically.
            for (const b of activeBranches) {
                const units = Number(stockByBranch[b.id]);
                if (!Number.isFinite(units) || units <= 0) continue;
                adjustRetailStock({
                    productId: id,
                    branchId: b.id,
                    delta: Math.floor(units),
                    kind: "receive",
                    reason: "Initial stock from product creation",
                });
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
        // Per-branch stock deltas — every branch that changed gets one
        // "adjust" entry. Branches with no change are skipped so the audit
        // log stays quiet.
        for (const b of activeBranches) {
            const currentRow = stockRows.find(s => s.productId === productId && s.branchId === b.id);
            const currentUnits = currentRow?.unitsOnHand ?? 0;
            const nextUnits = Number(stockByBranch[b.id]);
            if (!Number.isFinite(nextUnits) || nextUnits < 0) continue;
            const rounded = Math.floor(nextUnits);
            const delta = rounded - currentUnits;
            if (delta === 0) continue;
            adjustRetailStock({
                productId,
                branchId: b.id,
                delta,
                kind: delta > 0 ? "receive" : "adjust",
                reason: "Manual adjustment from product edit",
            });
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
                    <p className="text-[18px] font-semibold text-[#101828]">Product not found</p>
                    <p className="text-[14px] text-[#667085]">
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
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
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
                        />
                    )}
                    {step === 2 && (
                        <PricingStep
                            data={pricing}
                            onChange={updatePricing}
                            errors={errors.pricing}
                            branches={activeBranches}
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

            <Toast />
        </div>
    );
}
