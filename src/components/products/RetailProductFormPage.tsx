"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail product create / edit form (full-page)
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase B (2026-07-29). One component drives BOTH flows so the layout stays
// identical whether an admin is creating a new SKU or editing an existing
// one:
//   • Create — /admin/products/retail/new             → mode="create"
//   • Edit   — /admin/products/retail/[id]/edit       → mode="edit" + productId
//
// Single-page form (no wizard). Save writes through the store's
// addRetailProduct / updateRetailProduct actions, which handle SKU
// uniqueness + audit-log entries + updatedAt bumps. Cancel + successful
// Save both route back to `returnTo` (defaults to /admin/products/retail).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { FilterPill } from "@/components/ui/FilterPill";
import { useAppStore, type RetailProduct } from "@/lib/store";

// ─── Form primitives (local to this page) ───────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
            <div className="flex flex-col gap-4">{children}</div>
        </div>
    );
}

function FormField({ label, hint, required, children, error }: {
    label: string;
    hint?: string;
    required?: boolean;
    error?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">
                {label}
                {required && <span className="text-[#b42318] ml-0.5">*</span>}
            </label>
            {children}
            {error
                ? <p className="text-[13px] text-[#b42318]">{error}</p>
                : hint
                    ? <p className="text-[13px] text-[#667085]">{hint}</p>
                    : null}
        </div>
    );
}

const INPUT_BASE = cn(
    "w-full rounded-[8px] border-1 border-[#d0d5dd] px-[14px] py-2.5",
    "text-[16px] text-[#101828] placeholder:text-[#667085] bg-white",
    "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all",
    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
);

function TextInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={INPUT_BASE}
        />
    );
}

function Textarea({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={cn(INPUT_BASE, "resize-none")}
        />
    );
}

/** AED-prefixed price input using the same NumericStringInput helper the
 *  other product forms use — strips leading zeros, blanks on 0, integer +
 *  2-decimal precision handled downstream. */
function PriceInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <div className="relative">
            <span className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[16px] text-[#667085] pointer-events-none">AED</span>
            <NumericStringInput
                value={value}
                onChange={onChange}
                placeholder={placeholder ?? "0"}
                className={cn(INPUT_BASE, "pl-[54px]")}
            />
        </div>
    );
}

/** Bare numeric input for reorder threshold (integers, no currency). */
function IntegerInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <NumericStringInput
            value={value}
            onChange={onChange}
            placeholder={placeholder ?? "0"}
            className={INPUT_BASE}
        />
    );
}

// ─── Types ──────────────────────────────────────────────────────────────────

type Mode = "create" | "edit";
type Status = RetailProduct["status"];

interface FormState {
    name: string;
    sku: string;
    categoryId: string;
    description: string;
    priceAed: string;         // string so empty input renders blank
    unitCostAed: string;
    reorderThreshold: string;
    imageUrl: string;
    status: Status;
}

const EMPTY_FORM: FormState = {
    name: "",
    sku: "",
    categoryId: "",
    description: "",
    priceAed: "",
    unitCostAed: "",
    reorderThreshold: "",
    imageUrl: "",
    status: "active",
};

// ─── Page ───────────────────────────────────────────────────────────────────

export function RetailProductFormPage({ mode, productId, returnTo }: {
    mode: Mode;
    productId?: string;
    returnTo: string;
}) {
    const router = useRouter();
    const products         = useAppStore(s => s.retailProducts);
    const categories       = useAppStore(s => s.retailCategories);
    const addRetailProduct = useAppStore(s => s.addRetailProduct);
    const updateRetailProduct = useAppStore(s => s.updateRetailProduct);
    const showToast        = useAppStore(s => s.showToast);

    const target = mode === "edit"
        ? products.find(p => p.id === productId)
        : undefined;

    const [form, setForm] = useState<FormState>(() => {
        if (mode === "edit" && target) {
            return {
                name: target.name,
                sku: target.sku,
                categoryId: target.categoryId,
                description: target.description ?? "",
                priceAed: String(target.priceAed),
                unitCostAed: String(target.unitCostAed),
                reorderThreshold: String(target.reorderThreshold),
                imageUrl: target.imageUrl ?? "",
                status: target.status,
            };
        }
        return EMPTY_FORM;
    });
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
    const [saving, setSaving] = useState(false);

    const categoryOptions = useMemo(
        () =>
            categories
                .filter(c => c.status === "active")
                .map(c => ({ value: c.id, label: c.label })),
        [categories],
    );

    // Missing-target guard — happens if someone navigates directly to
    // /edit for a nonexistent id.
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

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(f => ({ ...f, [key]: value }));
        if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
    }

    function validate(): boolean {
        const next: Partial<Record<keyof FormState, string>> = {};
        if (!form.name.trim()) next.name = "Name is required.";
        if (!form.sku.trim()) next.sku = "SKU is required.";
        if (!form.categoryId) next.categoryId = "Select a category.";
        const price = Number(form.priceAed);
        if (!form.priceAed || Number.isNaN(price) || price <= 0) next.priceAed = "Price must be greater than 0.";
        const cost = Number(form.unitCostAed);
        if (form.unitCostAed === "" || Number.isNaN(cost) || cost < 0) next.unitCostAed = "Unit cost must be 0 or more.";
        const threshold = Number(form.reorderThreshold);
        if (form.reorderThreshold === "" || Number.isNaN(threshold) || threshold < 0 || !Number.isInteger(threshold)) next.reorderThreshold = "Threshold must be a whole number, 0 or more.";
        setErrors(next);
        return Object.keys(next).length === 0;
    }

    function handleSave() {
        if (!validate()) return;
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            sku: form.sku.trim(),
            categoryId: form.categoryId,
            description: form.description.trim() || undefined,
            priceAed: Number(form.priceAed),
            unitCostAed: Number(form.unitCostAed),
            reorderThreshold: Number(form.reorderThreshold),
            imageUrl: form.imageUrl.trim() || undefined,
            status: form.status,
        };
        if (mode === "create") {
            const id = addRetailProduct(payload);
            if (!id) {
                setSaving(false);
                setErrors(e => ({ ...e, sku: "SKU already in use by another product." }));
                return;
            }
            showToast("Product created", `${payload.name} is now in your retail catalog.`, "success", "check");
            router.push(returnTo);
            return;
        }
        // edit
        if (!productId) return;
        const ok = updateRetailProduct(productId, payload);
        setSaving(false);
        if (!ok) {
            setErrors(e => ({ ...e, sku: "SKU already in use by another product." }));
            return;
        }
        showToast("Product updated", `${payload.name} was saved.`, "success", "check");
        router.push(returnTo);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Top header (72px) — same chrome as Create gift card /
                Create membership: X close + title + breadcrumbs. Full
                viewport so this route stands outside the admin sidebar. */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0 border-b border-[#e4e7ec]">
                <button
                    type="button"
                    onClick={() => router.push(returnTo)}
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

            {/* Scrollable form region */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6">
              <div className="max-w-[720px] w-full mx-auto">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-8">
                    <Section title="Information">
                        <FormField label="Product name" required error={errors.name}>
                            <TextInput
                                value={form.name}
                                onChange={v => update("name", v)}
                                placeholder="e.g. Onra Studio Tank"
                            />
                        </FormField>
                        <FormField label="SKU" required error={errors.sku} hint="Unique alphanumeric code used on receipts and reports.">
                            <TextInput
                                value={form.sku}
                                onChange={v => update("sku", v.toUpperCase())}
                                placeholder="APP-TNK-001"
                            />
                        </FormField>
                        <FormField label="Category" required error={errors.categoryId}>
                            <SelectInput
                                value={form.categoryId}
                                onChange={v => update("categoryId", v)}
                                options={categoryOptions}
                                placeholder="Select a category"
                                width="w-full"
                            />
                        </FormField>
                        <FormField label="Description">
                            <Textarea
                                value={form.description}
                                onChange={v => update("description", v)}
                                placeholder="Optional — brief description for the POS card and customer portal."
                            />
                        </FormField>
                        <FormField label="Product image URL" hint="Optional. Paste a hosted image URL. Full upload UI coming in a later phase.">
                            <TextInput
                                value={form.imageUrl}
                                onChange={v => update("imageUrl", v)}
                                placeholder="https://…"
                            />
                        </FormField>
                    </Section>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <Section title="Pricing">
                        <FormField label="Price · AED" required error={errors.priceAed} hint="The price customers pay at POS.">
                            <PriceInput
                                value={form.priceAed}
                                onChange={v => update("priceAed", v)}
                            />
                        </FormField>
                        <FormField label="Unit cost · AED" required error={errors.unitCostAed} hint="What you pay per unit. Powers the Gross margin % in the Retail Sales report.">
                            <PriceInput
                                value={form.unitCostAed}
                                onChange={v => update("unitCostAed", v)}
                            />
                        </FormField>
                    </Section>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <Section title="Stock alert">
                        <FormField label="Reorder threshold" required error={errors.reorderThreshold} hint="The Stock on Hand report flags any branch at or below this level.">
                            <IntegerInput
                                value={form.reorderThreshold}
                                onChange={v => update("reorderThreshold", v)}
                            />
                        </FormField>
                    </Section>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <Section title="Status">
                        <FormField label="Availability" hint="Inactive hides the product from POS and the customer shop but keeps it on the admin list.">
                            <div className="flex flex-wrap gap-2">
                                {(["active", "inactive"] as Status[]).map(s => (
                                    <FilterPill
                                        key={s}
                                        label={s.charAt(0).toUpperCase() + s.slice(1)}
                                        selected={form.status === s}
                                        onClick={() => update("status", s)}
                                    />
                                ))}
                            </div>
                        </FormField>
                    </Section>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end gap-3 mt-6 pb-8">
                    <Button variant="secondary-gray" size="md" onClick={() => router.push(returnTo)}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="md" onClick={handleSave} disabled={saving}>
                        {mode === "create" ? "Create product" : "Save changes"}
                    </Button>
                </div>
              </div>
            </div>

            <Toast />
        </div>
    );
}
