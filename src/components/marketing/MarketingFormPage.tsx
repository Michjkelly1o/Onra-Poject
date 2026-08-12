"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit campaign (New class)
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page modal flow at /marketing/new — same shell as the promo create
// flow (lives OUTSIDE the admin sidebar).
//
// Announcements and Events are now their OWN single-type modules, so a
// *campaign* is always a "New class" promotion. There is NO "Campaign type"
// dropdown anymore — the type is fixed to `new_class`, whose only CTA is
// "Book an event" (the class picker, limited to the next 7 days).
//
// Two-step flow:
//   1. Campaign configuration — banner / display name / description, the
//      class the Book button opens, and the duration window
//   2. Visibility settings     — applicable branches, applies-to packages,
//      customer targeting
//
// Shared building blocks live in `form-kit.tsx` — the Announcements and Events
// modules compose the same kit.
//
// Create writes a `marketing_items` row via `addMarketingItem`; edit patches
// it via `updateMarketingItem`. Both route to the marketing detail page after.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { to12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type MarketingItem } from "@/lib/store";
import {
    type MarketingFormData, type ClassCtaOption, type MultiOption,
    nowHHMM,
    StepItem, type FormStep, FormCard, Section, FormField, TextInput, Textarea,
    ToggleCard, FilledRadio, ActionCard, TimeSelect, ClassCtaSelect,
    MultiSelectCard, BranchSingleSelect, MarketingPreviewPanel,
} from "@/components/marketing/form-kit";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
    { n: 1, label: "Campaign configuration" },
    { n: 2, label: "Visibility settings" },
];

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
        // Type is fixed — a campaign is always a New class promotion.
        type: "campaign",
        description: initial?.description ?? "",
        // New class's only CTA is Book an event — default it selected so the
        // class picker shows straight away (it's the only option).
        action: initial?.action ?? "book_event",
        ticketPrice: "",
        ctaClassId: initial?.ctaClassId ?? "",
        externalUrl: "",
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

    // Step-1 gate — essentials + the booked class.
    const canContinue =
        form.name.trim().length > 0 &&
        form.ctaClassId.trim().length > 0 &&
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
    // cancelled/completed) in the next 7 days (new-class campaigns promote a
    // soon-to-run class). Single-select.
    const ctaClassOptions: ClassCtaOption[] = useMemo(() => {
        const from = todayISO();
        const to = (() => {
            const d = new Date(`${from}T00:00:00Z`);
            d.setUTCDate(d.getUTCDate() + 7);
            return d.toISOString().slice(0, 10);
        })();
        return classSchedules
            .filter(c => c.type === "class"
                && c.status !== "Cancelled" && c.status !== "Completed"
                && c.dateISO >= from && c.dateISO <= to)
            .sort((a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime))
            .map(c => ({
                value: c.id,
                label: c.name,
                sub: `${c.date} · ${c.displayTime || to12h(c.startTime)} · ${c.instructorName}`,
            }));
    }, [classSchedules]);

    // If the picked class drops out of the current option list (data change),
    // clear it so a stale id can't be submitted.
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

        // Editable fields — shared by create + edit. `status` + analytics
        // counts are excluded so editing never resets a live item.
        const fields: Omit<MarketingItem, "id" | "status" | "view_count" | "click_count" | "conversion_count"> = {
            title: form.name.trim(),
            type: "campaign",
            short_description: form.description.trim(),
            cover_image_url: form.bannerPreview || undefined,
            action_type: "book_event",
            ticket_price: undefined,
            cta_class_id: form.ctaClassId || undefined,
            external_url: undefined,
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
                                <FormField label="Display name">
                                    <TextInput value={form.name} onChange={v => patch({ name: v })}
                                        placeholder="e.g. New: Aerial Yoga" />
                                </FormField>
                                <FormField label="Short description">
                                    <Textarea value={form.description} onChange={v => patch({ description: v })}
                                        placeholder="Describe this campaign..." />
                                </FormField>

                                {/* Link or action — a campaign always opens a class booking. */}
                                <FormField label="Link or action">
                                    <ActionCard action="book_event" selected onSelect={() => patch({ action: "book_event" })} />
                                </FormField>

                                <FormField
                                    label="Select class"
                                    hint="Only classes in the next 7 days can be booked from a new-class campaign.">
                                    <ClassCtaSelect
                                        value={form.ctaClassId}
                                        onChange={id => patch({ ctaClassId: id })}
                                        options={ctaClassOptions}
                                        placeholder="Select a class"
                                    />
                                </FormField>
                            </Section>

                            {/* ── Duration ── */}
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
