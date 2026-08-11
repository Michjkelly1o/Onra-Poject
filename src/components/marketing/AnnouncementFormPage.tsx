"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit announcement
// ─────────────────────────────────────────────────────────────────────────────
//
// Announcements are their OWN single-type marketing module (split out of
// Campaigns). Same 2-step full-page flow, same shared building blocks
// (`form-kit.tsx`), same live preview — only the type is fixed to
// "announcement", so there's NO "Campaign type" dropdown.
//
// An announcement's only CTA options are "External link" and "No action"
// (per Figma 7046:* announcement variant), so this form drops the class /
// event picker and the ticket-price field that Campaigns/Events carry.
//
// Writes/patches the SAME `marketing_items` slice as Campaigns (type =
// "announcement"), so the customer "What's on" feed picks it up with no
// migration — the modules are separate in the admin, unified in the data.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type MarketingItem } from "@/lib/store";
import {
    type MarketingFormData, type MultiOption,
    ACTIONS_BY_TYPE, nowHHMM,
    StepItem, type FormStep, FormCard, Section, FormField, TextInput, Textarea,
    ToggleCard, FilledRadio, ActionCard, TimeSelect,
    MultiSelectCard, BranchSingleSelect, MarketingPreviewPanel,
} from "@/components/marketing/form-kit";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
    { n: 1, label: "Announcement configuration" },
    { n: 2, label: "Visibility settings" },
];

// Announcements offer only External link / No action.
const ANNOUNCEMENT_ACTIONS = ACTIONS_BY_TYPE.announcement;

// ─── Shared page component ───────────────────────────────────────────────────

export interface AnnouncementFormPageProps {
    mode: "create" | "edit";
    marketingId?: string;
    initial?: Partial<MarketingFormData>;
    returnTo?: string;
}

export function AnnouncementFormPage({ mode, marketingId, initial, returnTo = "/admin/marketing/announcements" }: AnnouncementFormPageProps) {
    const router = useRouter();
    const isEdit = mode === "edit";

    const addMarketingItem    = useAppStore(s => s.addMarketingItem);
    const updateMarketingItem = useAppStore(s => s.updateMarketingItem);
    const showToast           = useAppStore(s => s.showToast);
    const memberships         = useAppStore(s => s.memberships);
    const packages            = useAppStore(s => s.packages);
    const branches            = useAppStore(s => s.branches);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<MarketingFormData>({
        bannerPreview: initial?.bannerPreview ?? "",
        name: initial?.name ?? "",
        // Type is fixed — announcements are a single-type module.
        type: "announcement",
        description: initial?.description ?? "",
        action: initial?.action ?? "",
        ticketPrice: "",
        ctaClassId: "",
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

    // Step-1 gate — essentials + the action-specific config field. An external
    // link needs a URL; "No action" needs nothing more.
    const actionConfigOk =
        form.action === "external_link" ? form.externalUrl.trim().length > 0 : true;
    const canContinue =
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

    // ─── Product option list ────────────────────────────────────────────────
    const productOptions: MultiOption[] = [
        ...memberships.filter(m => m.status === "active")
            .map(m => ({ id: m.id, label: m.name, group: "Membership" })),
        ...packages.filter(p => p.status === "active")
            .map(p => ({ id: p.id, label: p.name, group: "Class package" })),
    ];

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

        const fields: Omit<MarketingItem, "id" | "status" | "view_count" | "click_count" | "conversion_count"> = {
            title: form.name.trim(),
            type: "announcement",
            short_description: form.description.trim(),
            cover_image_url: form.bannerPreview || undefined,
            action_type: form.action || "no_action",
            // Announcements never carry a ticket price or booked class.
            ticket_price: undefined,
            cta_class_id: undefined,
            external_url: externalUrl,
            publish_date: toIso(form.startDate, form.startTime) ?? new Date().toISOString(),
            expiry_date: toIso(form.endDate, form.endTime),
            countdown: form.countdown,
            branch_ids: branchIds,
            multi_location: form.multiLocation,
            target_package_ids: form.productIds,
            target_class_ids: [],
            customer_targeting: form.customerTargeting || undefined,
            created_at: new Date().toISOString(),
        };

        if (isEdit && marketingId) {
            updateMarketingItem(marketingId, fields);
            showToast("Announcement was updated", `${fields.title} has been saved.`, "success", "check");
            router.push(`/announcements/${marketingId}`);
        } else {
            const newId = addMarketingItem({
                ...fields,
                status: "active",
                view_count: 0,
                click_count: 0,
                conversion_count: 0,
            });
            showToast("New announcement was created", "Your announcement is ready to publish.", "success", "check");
            router.push(`/announcements/${newId}`);
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
                        {isEdit ? "Edit announcement" : "Create new announcement"}
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
                            {/* ── Announcement details ── */}
                            <Section title="Announcement details">
                                <ImageBannerUpload
                                    preview={form.bannerPreview || null}
                                    onChange={url => patch({ bannerPreview: url ?? "" })}
                                    sizeGuide="Recommended: 1029 × 420 px (ratio ~2.45:1). Off-ratio images are cropped — keep key content centered."
                                />
                                <FormField label="Display name">
                                    <TextInput value={form.name} onChange={v => patch({ name: v })}
                                        placeholder="e.g. Studio closure notice" />
                                </FormField>
                                <FormField label="Short description">
                                    <Textarea value={form.description} onChange={v => patch({ description: v })}
                                        placeholder="Describe this announcement..." />
                                </FormField>

                                {/* Link or action — External link or No action. */}
                                <FormField label="Link or action">
                                    <div className="grid grid-cols-2 gap-3 w-full">
                                        {ANNOUNCEMENT_ACTIONS.map(a => (
                                            <ActionCard key={a} action={a}
                                                selected={form.action === a}
                                                onSelect={() => patch({
                                                    action: a,
                                                    externalUrl: a === "external_link" ? form.externalUrl : "",
                                                })} />
                                        ))}
                                    </div>
                                </FormField>

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
                            </Section>

                            {/* ── Duration ── */}
                            <Section title="Duration">
                                <div className="flex gap-4 items-start w-full">
                                    <div className="flex-1 min-w-0">
                                        <FormField label="Start date">
                                            <DatePicker value={form.startDate} placeholder="Select date" minDate={todayISO()}
                                                onChange={iso => {
                                                    const keepEnd = !(form.endDate && iso && form.endDate < iso);
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
                                            <TimeSelect value={form.startTime}
                                                disabledOption={form.startDate === todayISO()
                                                    ? (slot => slot < nowHHMM()) : undefined}
                                                onChange={v => patch({
                                                    startTime: v,
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
                                                    endTime: iso === form.startDate && form.startTime !== ""
                                                        && form.endTime !== "" && form.endTime <= form.startTime ? "" : form.endTime,
                                                })} />
                                        </FormField>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <FormField label="End time">
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
                                    {isEdit ? "Save changes" : "Create announcement"}
                                </Button>
                            </div>
                        }>
                            {/* ── Applicable branch ── */}
                            <Section title="Applicable branch">
                                <ToggleCard
                                    title="Multi-location access"
                                    subtitle="The announcement can be shown on multiple branches"
                                    on={form.multiLocation}
                                    onChange={v => patch({ multiLocation: v })}
                                />
                                {form.multiLocation ? (
                                    <MultiSelectCard
                                        title="Branches"
                                        subtitle="The announcement can be shown on these branches"
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

                            {/* ── Applies to ── */}
                            <Section title="Applies to">
                                <MultiSelectCard
                                    title="Packages"
                                    subtitle="The announcement can be shown on these products"
                                    options={productOptions}
                                    selected={form.productIds}
                                    onChange={ids => patch({ productIds: ids })}
                                />
                            </Section>

                            {/* ── Customer ── */}
                            <Section title="Customer">
                                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">The announcement can be configured to target specific eligible users.</p>
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

                    {/* Right: live announcement preview */}
                    <MarketingPreviewPanel form={form} branches={branches} noun="announcement" />
                </div>
            </div>
        </div>
    );
}
