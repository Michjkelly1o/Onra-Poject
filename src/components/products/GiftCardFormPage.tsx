"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit gift card
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page modal flow at /products/gift-cards/new — same shell as
// /products/new (membership/package) and /class-types/new: lives OUTSIDE the
// admin sidebar layout so the multi-step form takes over the whole viewport.
//
// Three-step flow (PRD 06 — gift cards brief):
//   1. Basic information     — name / description / gift card price
//   2. Product configuration — gift card number + custom-amount condition
//        custom OFF → single "Gift card amount" input
//        custom ON  → "Minimal amount" + "Maximal amount" inputs
//   3. Duration configuration — "No expiration" condition
//        no-expiry OFF (default) → Issue date + Expiry date pickers
//        no-expiry ON            → date inputs removed
//
// On Create the form writes a `gift_card_designs` row via the store's
// `addGiftCardDesign`, so the new card lands in the gift-cards list view and
// the POS catalog in the same render cycle. Edit mode rewrites the same row
// via `updateGiftCardDesign`.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Check, BankNote01, ClockFastForward, Gift01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { DecorativeBanner, BANNER_TINTS } from "./DecorativeBanner";
import { useAppStore, type GiftCardDesign } from "@/lib/store";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Basic information" },
    { n: 2, label: "Product configuration" },
    { n: 3, label: "Duration configuration" },
];

// ─── Stepper sidebar (same primitive as ProductFormPage 3629:70669) ──────────

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

// ─── FormCard shell (same primitive as ProductFormPage 2526:59534) ───────────

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
    label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {error
                ? <p className="text-[14px] text-[#d92d20] leading-5">{error}</p>
                : hint && <p className="text-[14px] text-[#475467] leading-5">{hint}</p>}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function TextInput({ value, onChange, placeholder, invalid = false }: {
    value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(INPUT_CLS, invalid && "border-[#fda29b] focus:ring-[#fecdca] focus:border-[#fda29b]")}
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

// ─── Toggle + ToggleCard (same primitive as ProductFormPage 1102:4137) ───────

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

// ─── Form data shapes ────────────────────────────────────────────────────────

interface BasicInfo {
    name: string;
    description: string;
    price: string;
}

interface ConfigData {
    /** Admin-entered code the buyer reads off the card at POS. */
    giftCardNumber: string;
    /** When true → buyer chooses any amount in [min, max]. */
    customAmount: boolean;
    /** Single loaded value when customAmount is OFF. */
    amount: string;
    /** Custom-amount range bounds when customAmount is ON. */
    minAmount: string;
    maxAmount: string;
}

interface DurationData {
    /** When true → the gift card never expires; date inputs are removed. */
    noExpiration: boolean;
    /** ISO issue date when noExpiration is OFF. */
    issueDate: string;
    /** ISO expiry date when noExpiration is OFF. */
    expiryDate: string;
}

// ─── Step 1 — Basic information (Figma 3726:23832) ───────────────────────────

function BasicInformationStep({ data, onChange, onBack, onContinue }: {
    data: BasicInfo;
    onChange: (patch: Partial<BasicInfo>) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const canContinue = data.name.trim().length > 0 && data.price.trim().length > 0;
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
                    <FormField label="Gift card name">
                        <TextInput
                            value={data.name}
                            onChange={v => onChange({ name: v })}
                            placeholder="Enter gift card name..."
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
                </Section>

                <Section title="Pricing">
                    <FormField label="Gift card price">
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

// ─── Step 2 — Product configuration (Figma 3726:24604 / 3755:12470) ──────────

function ProductConfigurationStep({ data, numberError, onChange, onBack, onContinue }: {
    data: ConfigData;
    /** Non-empty when the entered gift card number collides with another card. */
    numberError: string | null;
    onChange: (patch: Partial<ConfigData>) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const numberOk = data.giftCardNumber.trim().length > 0 && !numberError;
    const amountOk = data.customAmount
        ? data.minAmount.trim().length > 0 && data.maxAmount.trim().length > 0
        : data.amount.trim().length > 0;
    const canContinue = numberOk && amountOk;

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
                <FormField
                    label="Gift card number"
                    hint="This is the gift card code that the customer will use when applying the card."
                    error={numberError ?? undefined}
                >
                    <TextInput
                        value={data.giftCardNumber}
                        onChange={v => onChange({ giftCardNumber: v })}
                        placeholder="Enter gift card number..."
                        invalid={!!numberError}
                    />
                </FormField>

                <ToggleCard
                    title="Custom amount"
                    subtitle="Allow customers to enter their own amount"
                    on={data.customAmount}
                    onChange={v => onChange({ customAmount: v })}
                />

                {data.customAmount ? (
                    <div className="flex gap-4 items-start w-full">
                        <div className="flex-1 min-w-0">
                            <FormField label="Minimal amount">
                                <PriceInput
                                    value={data.minAmount}
                                    onChange={v => onChange({ minAmount: v })}
                                />
                            </FormField>
                        </div>
                        <div className="flex-1 min-w-0">
                            <FormField label="Maximal amount">
                                <PriceInput
                                    value={data.maxAmount}
                                    onChange={v => onChange({ maxAmount: v })}
                                />
                            </FormField>
                        </div>
                    </div>
                ) : (
                    <FormField
                        label="Gift card amount"
                        hint="The customer will be able to apply this gift card when making purchases through the POS."
                    >
                        <PriceInput
                            value={data.amount}
                            onChange={v => onChange({ amount: v })}
                        />
                    </FormField>
                )}
            </div>
        </FormCard>
    );
}

// ─── Step 3 — Duration configuration (Figma 3726:24958) ──────────────────────

function DurationConfigurationStep({ data, onChange, onBack, onSubmit, submitLabel }: {
    data: DurationData;
    onChange: (patch: Partial<DurationData>) => void;
    onBack: () => void;
    onSubmit: () => void;
    /** "Create gift card" in create mode, "Save changes" in edit mode. */
    submitLabel: string;
}) {
    // With dates hidden the step is always complete; with dates shown both
    // pickers must carry a value before the card can be created.
    const canSubmit = data.noExpiration
        || (data.issueDate.length > 0 && data.expiryDate.length > 0);

    return (
        <FormCard
            title="Duration configuration"
            footer={
                <div className="flex items-center justify-between w-full">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" disabled={!canSubmit} onClick={onSubmit}>{submitLabel}</Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <ToggleCard
                    title="No expiration"
                    subtitle="Select this if the gift card has no expiry date"
                    on={data.noExpiration}
                    onChange={v => onChange({ noExpiration: v })}
                />

                {/* Date inputs are removed entirely while No expiration is ON. */}
                {!data.noExpiration && (
                    <div className="flex gap-4 items-start w-full">
                        <div className="flex-1 min-w-0">
                            <FormField label="Issue date">
                                <DatePicker
                                    value={data.issueDate}
                                    onChange={iso => onChange({
                                        issueDate: iso,
                                        // Clear the expiry date when a later issue date
                                        // pushes past it — expiry can't precede issue.
                                        expiryDate: data.expiryDate && iso && data.expiryDate < iso
                                            ? "" : data.expiryDate,
                                    })}
                                    placeholder="Select date"
                                    minDate={todayISO()}
                                />
                            </FormField>
                        </div>
                        <div className="flex-1 min-w-0">
                            <FormField label="Expiry date">
                                <DatePicker
                                    value={data.expiryDate}
                                    onChange={iso => onChange({ expiryDate: iso })}
                                    placeholder="Select date"
                                    minDate={data.issueDate || todayISO()}
                                />
                            </FormField>
                        </div>
                    </div>
                )}
            </div>
        </FormCard>
    );
}

// ─── Gift card preview card (right rail) ─────────────────────────────────────

interface PreviewState {
    name: string;
    /** Bank-note row — loaded value / range. Empty → "Amount" placeholder. */
    amountLabel: string;
    /** Clock row — expiry. Empty → "Valid until" placeholder. */
    durationLabel: string;
    /** Green price line — "Custom" for custom-amount cards, else "AED N". */
    priceLabel: string;
}

/** Live preview — mirrors the gift-card POS catalog card (Figma 3726:23875)
 *  so the admin sees exactly what the saved card looks like in the POS:
 *  "Template preview" header, an `#f6f6f3` stage, and the 352px card itself. */
function GiftCardPreviewCard({ data }: { data: PreviewState }) {
    const hasName = !!data.name.trim();
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            {/* Header */}
            <div className="flex flex-col">
                <div className="pt-6 px-6 flex flex-col gap-1">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Template preview</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">This is how your gift card will look like.</p>
                </div>
                <div className="h-5" />
                <div className="h-px bg-[#e4e7ec]" />
            </div>
            {/* Stage */}
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5 w-[352px] mx-auto">
                    <DecorativeBanner bannerHeight={120} iconBox={56} icon={Gift01} {...BANNER_TINTS.giftCard} />
                    <div className="flex flex-col gap-4 px-5">
                        <div className="flex flex-col gap-2">
                            <p className="text-[18px] leading-[28px] font-medium text-[#101828] truncate">
                                {hasName ? data.name : "Gift card name"}
                            </p>
                            <div className="flex gap-2 items-start">
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <BankNote01 className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">{data.amountLabel || "Amount"}</span>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-1">
                                    <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                                    <span className="text-[14px] font-medium text-[#667085] truncate">{data.durationLabel || "Valid until"}</span>
                                </div>
                            </div>
                        </div>
                        <p className="font-semibold text-[20px] leading-[30px] text-[#658774]">
                            {data.priceLabel}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Validity-days derivation ────────────────────────────────────────────────
//
// `gift_card_designs.validity_days` is kept for POS-catalog back-compat — the
// detail page reads `no_expiry` + `valid_until_date` for display. We collapse
// the form's issue/expiry dates back into a day count here.

function deriveValidityDays(d: DurationData): number {
    if (d.noExpiration) return 0;
    if (d.issueDate && d.expiryDate) {
        const ms = new Date(d.expiryDate).getTime() - new Date(d.issueDate).getTime();
        const days = Math.round(ms / 86_400_000);
        return days > 0 ? days : 365;
    }
    return 365;
}

// ─── Date display helper (preview "Valid until" copy) ────────────────────────

function formatDisplayDate(iso: string): string {
    // DD/MM/YYYY — matches the gift-card POS catalog card's "Valid until" cell.
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    return `${m[3]}/${m[2]}/${m[1]}`;
}

// ─── Shared page component ───────────────────────────────────────────────────

/** Initial form data — every field optional so callers seed only what they
 *  have. Create mode passes nothing; edit mode seeds from the persisted
 *  `GiftCardDesign` columns. */
export interface GiftCardFormInitial {
    basic?: Partial<BasicInfo>;
    config?: Partial<ConfigData>;
    duration?: Partial<DurationData>;
}

export interface GiftCardFormPageProps {
    mode: "create" | "edit";
    /** Required when mode === "edit" — the design id the save action writes to. */
    designId?: string;
    initial?: GiftCardFormInitial;
    /** Where the close / list-bound nav should return to. */
    returnTo?: string;
}

export function GiftCardFormPage({ mode, designId, initial, returnTo = "/admin/products/gift-cards" }: GiftCardFormPageProps) {
    const router = useRouter();
    const isEdit = mode === "edit";

    const [step, setStep] = useState(1);
    const [basic, setBasic] = useState<BasicInfo>({
        name: initial?.basic?.name ?? "",
        description: initial?.basic?.description ?? "",
        price: initial?.basic?.price ?? "",
    });
    const [config, setConfig] = useState<ConfigData>({
        giftCardNumber: initial?.config?.giftCardNumber ?? "",
        customAmount: initial?.config?.customAmount ?? false,
        amount: initial?.config?.amount ?? "",
        minAmount: initial?.config?.minAmount ?? "",
        maxAmount: initial?.config?.maxAmount ?? "",
    });
    const [duration, setDuration] = useState<DurationData>({
        noExpiration: initial?.duration?.noExpiration ?? false,
        issueDate: initial?.duration?.issueDate ?? "",
        expiryDate: initial?.duration?.expiryDate ?? "",
    });

    const giftCardDesigns   = useAppStore(s => s.giftCardDesigns);
    const addGiftCardDesign = useAppStore(s => s.addGiftCardDesign);
    const updateGiftCardDesign = useAppStore(s => s.updateGiftCardDesign);
    const showToast         = useAppStore(s => s.showToast);

    // Gift card numbers must be unique across all cards (PRD 06). Compare
    // case-insensitively, ignoring the row being edited.
    const numberError = useMemo<string | null>(() => {
        const entered = config.giftCardNumber.trim().toLowerCase();
        if (!entered) return null;
        const clash = giftCardDesigns.some(g =>
            g.id !== designId &&
            (g.gift_card_number ?? "").trim().toLowerCase() === entered,
        );
        return clash ? "This gift card number is already in use. Enter a unique number." : null;
    }, [config.giftCardNumber, giftCardDesigns, designId]);

    function handleClose() {
        // Edit mode returns to the detail page; create mode returns to the list.
        if (isEdit && designId) router.push(`/products/gift-cards/${designId}`);
        else                    router.push(returnTo);
    }

    /** Final step primary action — writes the `gift_card_designs` row, fires
     *  the success toast, and returns to the gift-cards list view so the new
     *  (or edited) card is immediately visible. */
    function handleSubmit() {
        const price = Number(basic.price);
        const safePrice = Number.isFinite(price) ? price : 0;
        const customAmount = config.customAmount;

        // value_type drives how the loaded value is stored + displayed.
        const valueType: GiftCardDesign["value_type"] = customAmount ? "custom" : "fixed";
        const fixedValue = customAmount ? undefined : (Number(config.amount) || 0);
        const minValue   = customAmount ? (Number(config.minAmount) || 0) : undefined;
        const maxValue   = customAmount ? (Number(config.maxAmount) || 0) : undefined;

        const noExpiry = duration.noExpiration;
        const issueDate     = noExpiry ? undefined : (duration.issueDate || undefined);
        const validUntil    = noExpiry ? undefined : (duration.expiryDate || undefined);
        const validityDays  = deriveValidityDays(duration);

        if (isEdit && designId) {
            updateGiftCardDesign(designId, {
                name: basic.name.trim() || "Gift card",
                description: basic.description.trim() || undefined,
                price_aed: safePrice,
                value_type: valueType,
                fixed_value_aed: fixedValue,
                min_value_aed: minValue,
                max_value_aed: maxValue,
                gift_card_number: config.giftCardNumber.trim() || undefined,
                no_expiry: noExpiry,
                issue_date: issueDate,
                valid_until_date: validUntil,
                validity_days: validityDays,
            });
            showToast(
                "Gift card was updated",
                `${basic.name.trim() || "Your gift card"} has been saved.`,
                "success",
                "check",
            );
            router.push(`/products/gift-cards/${designId}`);
            return;
        }

        // ─── Create — new rows go in Active so they land in the POS catalog
        //     and the gift-cards list immediately. ────────────────────────────
        addGiftCardDesign({
            name: basic.name.trim() || "New gift card",
            description: basic.description.trim() || undefined,
            price_aed: safePrice,
            value_type: valueType,
            fixed_value_aed: fixedValue,
            min_value_aed: minValue,
            max_value_aed: maxValue,
            gift_card_number: config.giftCardNumber.trim() || undefined,
            no_expiry: noExpiry,
            issue_date: issueDate,
            valid_until_date: validUntil,
            validity_days: validityDays,
            status: "active",
        });
        showToast(
            "New gift card was created",
            "New gift card is ready and available for sale.",
            "success",
            "check",
        );
        router.push(returnTo);
    }

    // ─── Preview labels — derived live so the right rail tracks the form ─────
    const previewPrice = basic.price === "" ? 0 : Number(basic.price);
    const safePreviewPrice = Number.isFinite(previewPrice) ? previewPrice : 0;
    const amountLabel = (() => {
        // Amount row carries no "AED" prefix — the bank-note icon already
        // signals currency (matches the gift-card POS catalog card).
        if (config.customAmount) {
            const min = config.minAmount.trim();
            const max = config.maxAmount.trim();
            if (min && max) return `${Number(min).toLocaleString("en-US")} - ${Number(max).toLocaleString("en-US")}`;
            return "";
        }
        const n = Number(config.amount);
        if (!config.amount.trim() || !Number.isFinite(n) || n <= 0) return "";
        return n.toLocaleString("en-US");
    })();
    const durationLabel = (() => {
        if (duration.noExpiration) return "No expiry";
        if (duration.expiryDate) return formatDisplayDate(duration.expiryDate);
        return "";
    })();
    // Custom-amount cards have no single price → the green line reads "Custom",
    // matching the gift-card POS catalog card.
    const priceLabel = config.customAmount
        ? "Custom"
        : `AED ${safePreviewPrice.toLocaleString("en-US")}`;
    const previewData: PreviewState = {
        name: basic.name,
        amountLabel,
        durationLabel,
        priceLabel,
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
                    {isEdit ? "Edit gift card" : "Create new gift card"}
                </h1>
            </div>

            {/* 3-column shell */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">

                    {/* Left: progress steps */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                    </div>

                    {/* Middle: form */}
                    {step === 1 && (
                        <BasicInformationStep
                            data={basic}
                            onChange={p => setBasic(prev => ({ ...prev, ...p }))}
                            onBack={handleClose}
                            onContinue={() => setStep(2)}
                        />
                    )}
                    {step === 2 && (
                        <ProductConfigurationStep
                            data={config}
                            numberError={numberError}
                            onChange={p => setConfig(prev => ({ ...prev, ...p }))}
                            onBack={() => setStep(1)}
                            onContinue={() => setStep(3)}
                        />
                    )}
                    {step === 3 && (
                        <DurationConfigurationStep
                            data={duration}
                            onChange={p => setDuration(prev => ({ ...prev, ...p }))}
                            onBack={() => setStep(2)}
                            onSubmit={handleSubmit}
                            submitLabel={isEdit ? "Save changes" : "Create gift card"}
                        />
                    )}

                    {/* Right: gift card preview */}
                    <GiftCardPreviewCard data={previewData} />
                </div>
            </div>
        </div>
    );
}
