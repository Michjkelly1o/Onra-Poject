"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit campaign
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page modal flow at /marketing/new — same shell as the promo create
// flow (lives OUTSIDE the admin sidebar).
//
// Two-step flow (Figma 5885:202840 / 7046:34820 / 35007 / 35078 / 35148 /
// 35215 / 35283 / 36045):
//   1. Campaign configuration — banner / display name / type / description,
//      then (once a type is picked) the link-or-action + its config field
//      and the duration window
//   2. Visibility settings     — applicable branches, applies-to packages /
//      classes, customer targeting (identical to the promo step 2)
//
// Shared building blocks (steppers, inputs, cards, the live preview) live in
// `form-kit.tsx` — the Announcements and Events modules compose the same kit.
// Only campaign-specific logic (the type dropdown + its per-type gating) lives
// here. Announcements/Events are their own single-type modules with no type
// dropdown, so "Announcement" and "Event" are NOT offered here.
//
// Create writes a `marketing_items` row via `addMarketingItem`; edit patches
// it via `updateMarketingItem`. Both route to the marketing detail page after.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, ChevronDown } from "@untitledui/icons";
import { cn, to12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type MarketingItem } from "@/lib/store";
import {
    type MarketingType, type MarketingFormData, type ClassCtaOption, type MultiOption,
    ACTIONS_BY_TYPE, nowHHMM,
    StepItem, type FormStep, FormCard, Section, FormField, TextInput, Textarea,
    ToggleCard, FilledRadio, ActionCard, TimeSelect, ClassCtaSelect,
    MultiSelectCard, BranchSingleSelect, MarketingPreviewPanel,
} from "@/components/marketing/form-kit";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
    { n: 1, label: "Campaign configuration" },
    { n: 2, label: "Visibility settings" },
];

// ─── Campaign-type dropdown ──────────────────────────────────────────────────
//
// Announcements + Events are now their own single-type modules, so the only
// types a *campaign* can be are "New class" and "Event". (Event splits into
// its own module in Phase 2, after which this narrows to New class only.)

const TYPE_OPTIONS: { value: MarketingType; label: string }[] = [
    { value: "new_class", label: "New class" },
    { value: "event",     label: "Event" },
];

function TypeSelect({ value, onChange }: { value: MarketingType | ""; onChange: (v: MarketingType) => void }) {
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);
    const selected = TYPE_OPTIONS.find(o => o.value === value);
    function toggle() {
        if (btnRef.current) setWidth(btnRef.current.offsetWidth);
        setOpen(p => !p);
    }
    return (
        <>
            <button ref={btnRef} type="button" onClick={toggle}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[16px] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {selected?.label ?? "Select type"}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            {/* Fixed-positioned so the menu escapes the scrollable form card. */}
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={width || 220}>
                {TYPE_OPTIONS.map(o => (
                    <button key={o.value} type="button"
                        onClick={() => { onChange(o.value); setOpen(false); }}
                        className={cn(
                            "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            value === o.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                        )}>
                        {o.label}
                    </button>
                ))}
            </FixedDropdown>
        </>
    );
}

// ─── Shared page component ───────────────────────────────────────────────────

export interface MarketingFormPageProps {
    mode: "create" | "edit";
    marketingId?: string;
    initial?: Partial<MarketingFormData>;
    returnTo?: string;
}

export function MarketingFormPage({ mode, marketingId, initial, returnTo = "/admin/marketing" }: MarketingFormPageProps) {
    const router = useRouter();
    const isEdit = mode === "edit";

    const addMarketingItem    = useAppStore(s => s.addMarketingItem);
    const updateMarketingItem = useAppStore(s => s.updateMarketingItem);
    const showToast           = useAppStore(s => s.showToast);
    const memberships         = useAppStore(s => s.memberships);
    const packages            = useAppStore(s => s.packages);
    const classSchedules      = useAppStore(s => s.classSchedules);
    const branches            = useAppStore(s => s.branches);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<MarketingFormData>({
        bannerPreview: initial?.bannerPreview ?? "",
        name: initial?.name ?? "",
        type: initial?.type ?? "",
        description: initial?.description ?? "",
        action: initial?.action ?? "",
        ticketPrice: initial?.ticketPrice ?? "",
        ctaClassId: initial?.ctaClassId ?? "",
        externalUrl: initial?.externalUrl ?? "",
        startDate: initial?.startDate ?? "",
        startTime: initial?.startTime ?? "",
        endDate: initial?.endDate ?? "",
        endTime: initial?.endTime ?? "",
        countdown: initial?.countdown ?? false,
        multiLocation: initial?.multiLocation ?? false,
        branchIds: initial?.branchIds ?? [],
        singleBranchId: initial?.singleBranchId ?? null,
        productIds: initial?.productIds ?? [],
        customerTargeting: initial?.customerTargeting ?? "",
    });
    const patch = (p: Partial<MarketingFormData>) => setForm(prev => ({ ...prev, ...p }));

    function handleClose() {
        router.push(returnTo);
    }

    /** Switching marketing type resets the action + its config — the action
     *  options differ per type, so the previous pick may no longer be valid. */
    function handleTypeChange(t: MarketingType) {
        // The class picker's option list differs per type (new_class is limited
        // to the next 7 days), so drop the previous class pick too.
        patch({ type: t, action: "", ticketPrice: "", externalUrl: "", ctaClassId: "" });
    }

    // Step-1 gate — type + essentials, plus the action-specific config field.
    const actionConfigOk =
        form.action === "buy_ticket" ? form.ticketPrice.trim().length > 0
            : form.action === "external_link" ? form.externalUrl.trim().length > 0
                : form.action === "book_event" ? form.ctaClassId.trim().length > 0
                    : true;
    const canContinue =
        form.type !== "" &&
        form.name.trim().length > 0 &&
        form.action !== "" &&
        actionConfigOk &&
        form.startDate.length > 0 && form.startTime.length > 0 &&
        form.endDate.length > 0 && form.endTime.length > 0;

    // Step-2 gate — a branch and a customer-targeting option must be chosen.
    const branchOk = form.multiLocation
        ? form.branchIds.length > 0
        : !!form.singleBranchId;
    const canCreate = branchOk && form.customerTargeting !== "";

    // ─── Product / class option lists ──────────────────────────────────────
    const productOptions: MultiOption[] = useMemo(() => [
        ...memberships.filter(m => m.status === "active")
            .map(m => ({ id: m.id, label: m.name, group: "Membership" })),
        ...packages.filter(p => p.status === "active")
            .map(p => ({ id: p.id, label: p.name, group: "Class package" })),
    ], [memberships, packages]);

    // "Book an event" CTA target — upcoming real classes (type "class", not
    // cancelled/completed). new_class campaigns are limited to the next 7 days;
    // event campaigns list every upcoming class. Single-select.
    const ctaClassOptions: ClassCtaOption[] = useMemo(() => {
        const from = todayISO();
        const to = (() => {
            const d = new Date(`${from}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() + 7);
            return d.toISOString().slice(0, 10);
        })();
        const windowEnd = form.type === "new_class" ? to : null;
        return classSchedules
            .filter(c => c.type === "class"
                && c.status !== "Cancelled" && c.status !== "Completed"
                && c.dateISO >= from
                && (windowEnd == null || c.dateISO <= windowEnd))
            .sort((a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime))
            .map(c => ({
                value: c.id,
                label: c.name,
                sub: `${c.date} · ${c.displayTime || to12h(c.startTime)} · ${c.instructorName}`,
            }));
    }, [classSchedules, form.type]);

    // If the picked class drops out of the current option list (type switch,
    // data change), clear it so a stale id can't be submitted.
    useEffect(() => {
        if (form.ctaClassId && !ctaClassOptions.some(o => o.value === form.ctaClassId)) {
            patch({ ctaClassId: "" });
        }
    }, [ctaClassOptions]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleSubmit() {
        // Collapse date + time into ISO strings for publish / expiry.
        const toIso = (date: string, time: string) =>
            date ? `${date}T${time || "00:00"}:00Z` : undefined;
        const branchIds = form.multiLocation
            ? form.branchIds
            : form.singleBranchId ? [form.singleBranchId] : [];
        // Normalise the external URL — the field carries the part after the
        // fixed `http://` prefix.
        const externalUrl = form.action === "external_link" && form.externalUrl.trim()
            ? (/^https?:\/\//i.test(form.externalUrl.trim())
                ? form.externalUrl.trim()
                : `http://${form.externalUrl.trim()}`)
            : undefined;

        // Editable fields — shared by create + edit. `status` + analytics
        // counts are excluded so editing never resets a live item.
        const fields: Omit<MarketingItem, "id" | "status" | "view_count" | "click_count" | "conversion_count"> = {
            title: form.name.trim(),
            type: form.type || "new_class",
            short_description: form.description.trim(),
            cover_image_url: form.bannerPreview || undefined,
            action_type: form.action || "no_action",
            ticket_price: form.action === "buy_ticket" && form.ticketPrice
                ? Number(form.ticketPrice) : undefined,
            cta_class_id: form.action === "book_event" && form.ctaClassId
                ? form.ctaClassId : undefined,
            external_url: externalUrl,
            publish_date: toIso(form.startDate, form.startTime) ?? new Date().toISOString(),
            expiry_date: toIso(form.endDate, form.endTime),
            countdown: form.countdown,
            branch_ids: branchIds,
            multi_location: form.multiLocation,
            target_package_ids: form.productIds,
            // Class scope removed Jul 2026 — payload keeps the FK-list
            // column empty for schema compat; the Book-an-event CTA already
            // targets a specific class via cta_class_id.
            target_class_ids: [],
            customer_targeting: form.customerTargeting || undefined,
            created_at: new Date().toISOString(),
        };

        if (isEdit && marketingId) {
            updateMarketingItem(marketingId, fields);
            showToast("Campaign was updated", `${fields.title} has been saved.`, "success", "check");
            router.push(`/marketing/${marketingId}`);
        } else {
            const newId = addMarketingItem({
                ...fields,
                status: "active",
                view_count: 0,
                click_count: 0,
                conversion_count: 0,
            });
            showToast("New campaign was created", "Your campaign is ready to publish.", "success", "check");
            router.push(`/marketing/${newId}`);
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">
                        {isEdit ? "Edit campaign" : "Create new campaign"}
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* 3-column shell — stepper + form + live preview */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} total={STEPS.length} />)}
                    </div>

                    {step === 1 ? (
                        <FormCard footer={
                            <div className="flex items-center justify-between w-full">
                                <Button variant="secondary-gray" size="md" onClick={handleClose}>Cancel</Button>
                                <Button variant="primary" size="md" disabled={!canContinue} onClick={() => setStep(2)}>
                                    Continue
                                </Button>
                            </div>
                        }>
                            {/* ── Campaign details ── */}
                            <Section title="Campaign details">
                                <ImageBannerUpload
                                    preview={form.bannerPreview || null}
                                    onChange={url => patch({ bannerPreview: url ?? "" })}
                                    sizeGuide="Recommended: 1029 × 420 px (ratio ~2.45:1). Off-ratio images are cropped — keep key content centered."
                                />
                                <div className="flex gap-4 items-start w-full">
                                    <div className="flex-1 min-w-0">
                                        <FormField label="Display name">
                                            <TextInput value={form.name} onChange={v => patch({ name: v })}
                                                placeholder="e.g. New: Aerial Yoga" />
                                        </FormField>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <FormField label="Campaign type">
                                            <TypeSelect value={form.type} onChange={handleTypeChange} />
                                        </FormField>
                                    </div>
                                </div>
                                <FormField label="Short description">
                                    <Textarea value={form.description} onChange={v => patch({ description: v })}
                                        placeholder="Describe this campaign..." />
                                </FormField>

                                {/* Link or action — surfaces only once a type is picked. */}
                                {form.type !== "" && (
                                    <>
                                        <FormField label="Link or action">
                                            {ACTIONS_BY_TYPE[form.type].length === 1 ? (
                                                // new_class — a single full-width card.
                                                ACTIONS_BY_TYPE[form.type].map(a => (
                                                    <ActionCard key={a} action={a}
                                                        selected={form.action === a}
                                                        onSelect={() => patch({ action: a, ticketPrice: "", externalUrl: "" })} />
                                                ))
                                            ) : (
                                                // event — 2-column grid of action cards.
                                                <div className="grid grid-cols-2 gap-3 w-full">
                                                    {ACTIONS_BY_TYPE[form.type].map(a => (
                                                        <ActionCard key={a} action={a}
                                                            selected={form.action === a}
                                                            onSelect={() => patch({
                                                                action: a,
                                                                ticketPrice: a === "buy_ticket" ? form.ticketPrice : "",
                                                                externalUrl: a === "external_link" ? form.externalUrl : "",
                                                                ctaClassId: a === "book_event" ? form.ctaClassId : "",
                                                            })} />
                                                    ))}
                                                </div>
                                            )}
                                        </FormField>

                                        {/* Action-specific config field */}
                                        {form.action === "book_event" && (
                                            <FormField
                                                label={form.type === "event" ? "Select event" : "Select class"}
                                                hint={form.type === "new_class"
                                                    ? "Only classes in the next 7 days can be booked from a new-class campaign."
                                                    : "The class this campaign's Book button opens."}>
                                                <ClassCtaSelect
                                                    value={form.ctaClassId}
                                                    onChange={id => patch({ ctaClassId: id })}
                                                    options={ctaClassOptions}
                                                    placeholder={form.type === "event" ? "Select an event" : "Select a class"}
                                                />
                                            </FormField>
                                        )}
                                        {form.action === "buy_ticket" && (
                                            <FormField label="Ticket price">
                                                <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] h-10">
                                                    <div className="flex items-center pl-[14px] text-[16px] font-medium text-[var(--colors-text-quaternary)]">AED</div>
                                                    <div className="flex-1 min-w-0">
                                                        <NumericStringInput value={form.ticketPrice} onChange={v => patch({ ticketPrice: v })}
                                                            min={0} className="!border-0 !shadow-none !rounded-none !ring-0 focus-within:!ring-0 focus-within:!border-0" />
                                                    </div>
                                                </div>
                                            </FormField>
                                        )}
                                        {form.action === "external_link" && (
                                            <FormField label="External link"
                                                hint="The link opens in a new tab when a customer taps the CTA.">
                                                <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] h-10">
                                                    <div className="flex items-center px-[14px] text-[16px] text-[var(--colors-text-quaternary)] border-r-1 border-[var(--colors-border-primary)] bg-[var(--colors-bg-secondary)]">http://</div>
                                                    <input type="text" value={form.externalUrl}
                                                        onChange={e => patch({ externalUrl: e.target.value.replace(/^https?:\/\//i, "") })}
                                                        placeholder="www.example.com"
                                                        className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-white" />
                                                </div>
                                            </FormField>
                                        )}
                                    </>
                                )}
                            </Section>

                            {/* ── Duration ── surfaces only once a type is picked. */}
                            {form.type !== "" && (
                                <Section title="Duration">
                                    <div className="flex gap-4 items-start w-full">
                                        <div className="flex-1 min-w-0">
                                            <FormField label="Start date">
                                                <DatePicker value={form.startDate} placeholder="Select date" minDate={todayISO()}
                                                    onChange={iso => {
                                                        // End must stay ≥ start — drop a now-invalid end date + time.
                                                        const keepEnd = !(form.endDate && iso && form.endDate < iso);
                                                        // If start moves to today, drop a now-past start time.
                                                        const startTimePast = iso === todayISO()
                                                            && form.startTime !== "" && form.startTime < nowHHMM();
                                                        patch({
                                                            startDate: iso,
                                                            startTime: startTimePast ? "" : form.startTime,
                                                            endDate: keepEnd ? form.endDate : "",
                                                            endTime: keepEnd ? form.endTime : "",
                                                        });
                                                    }} />
                                            </FormField>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <FormField label="Start time">
                                                {/* When the start date is today, past slots are barred. */}
                                                <TimeSelect value={form.startTime}
                                                    disabledOption={form.startDate === todayISO()
                                                        ? (slot => slot < nowHHMM()) : undefined}
                                                    onChange={v => patch({
                                                        startTime: v,
                                                        // Clear a same-day end time that's now in the past.
                                                        endTime: form.startDate !== "" && form.startDate === form.endDate
                                                            && form.endTime !== "" && form.endTime <= v ? "" : form.endTime,
                                                    })} />
                                            </FormField>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 items-start w-full">
                                        <div className="flex-1 min-w-0">
                                            <FormField label="End date">
                                                <DatePicker value={form.endDate} placeholder="Select date"
                                                    minDate={form.startDate || todayISO()}
                                                    onChange={iso => patch({
                                                        endDate: iso,
                                                        // Same-day end can't be at/before the start time.
                                                        endTime: iso === form.startDate && form.startTime !== ""
                                                            && form.endTime !== "" && form.endTime <= form.startTime ? "" : form.endTime,
                                                    })} />
                                            </FormField>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <FormField label="End time">
                                                {/* Same-day end time must be strictly after the start time. */}
                                                <TimeSelect value={form.endTime} onChange={v => patch({ endTime: v })}
                                                    disabledOption={form.startDate !== "" && form.startDate === form.endDate && form.startTime !== ""
                                                        ? (slot => slot <= form.startTime) : undefined} />
                                            </FormField>
                                        </div>
                                    </div>
                                    <ToggleCard
                                        title="Countdown"
                                        subtitle="Show the timer to highlight limited-time offers"
                                        on={form.countdown}
                                        onChange={v => patch({ countdown: v })}
                                    />
                                </Section>
                            )}
                        </FormCard>
                    ) : (
                        <FormCard footer={
                            <div className="flex items-center justify-between w-full">
                                <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                                <Button variant="primary" size="md" disabled={!canCreate} onClick={handleSubmit}>
                                    {isEdit ? "Save changes" : "Create campaign"}
                                </Button>
                            </div>
                        }>
                            {/* ── Applicable branch ── */}
                            <Section title="Applicable branch">
                                <ToggleCard
                                    title="Multi-location access"
                                    subtitle="The marketing can be use on multiple branches"
                                    on={form.multiLocation}
                                    onChange={v => patch({ multiLocation: v })}
                                />
                                {/* Toggle OFF → single branch dropdown;
                                    ON → multi-select branch card. */}
                                {form.multiLocation ? (
                                    <MultiSelectCard
                                        title="Branches"
                                        subtitle="The marketing can be used on these branches"
                                        options={branches.map(b => ({ id: b.id, label: b.name }))}
                                        selected={form.branchIds}
                                        onChange={ids => patch({ branchIds: ids })}
                                    />
                                ) : (
                                    <FormField label="Branch location">
                                        <BranchSingleSelect
                                            value={form.singleBranchId}
                                            onChange={id => patch({ singleBranchId: id })}
                                            branches={branches}
                                        />
                                    </FormField>
                                )}
                            </Section>

                            {/* ── Applies to ──
                                Class scope was removed per client Jul 2026 —
                                the Book-an-event CTA already targets a
                                specific class, so a second class-scope was
                                redundant. Packages/memberships stay. */}
                            <Section title="Applies to">
                                <MultiSelectCard
                                    title="Packages"
                                    subtitle="The marketing can be used on these products"
                                    options={productOptions}
                                    selected={form.productIds}
                                    onChange={ids => patch({ productIds: ids })}
                                />
                            </Section>

                            {/* ── Customer ── */}
                            <Section title="Customer">
                                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">The marketing can be configured to target specific eligible users.</p>
                                    {([["all", "Everyone"], ["new_users", "New user only"]] as const).map(([v, label]) => (
                                        <button key={v} type="button" onClick={() => patch({ customerTargeting: v })}
                                            className="flex items-center gap-2 w-full text-left">
                                            <FilledRadio selected={form.customerTargeting === v} />
                                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </Section>
                        </FormCard>
                    )}

                    {/* Right: live marketing preview */}
                    <MarketingPreviewPanel form={form} branches={branches} noun="campaign" />
                </div>
            </div>
        </div>
    );
}
