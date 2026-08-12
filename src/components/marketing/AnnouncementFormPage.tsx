"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit announcement
// ─────────────────────────────────────────────────────────────────────────────
//
// An announcement is "something to SAY": information with a show-until date —
// a banner in the app + a push. NO action, NO revenue, NO conversion (client
// model 2026-08-12). So this form carries only: banner, name, message, a single
// "show until" date, and branch scope. There is no CTA, no products, and no
// customer-segment targeting (announcements are a broadcast — segment targeting
// is the Campaign's job).
//
// Delivery: an announcement is pushed to customers who opted into the "Studio
// announcements" topic on the Push channel (the consent gate lives in the
// store's dispatch). Writes the shared `marketing_items` slice (type =
// "announcement"), so the customer "What's on" banner picks it up.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Bell01 } from "@untitledui/icons";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/button";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type MarketingItem } from "@/lib/store";
import { audienceMatch, marketingReach, MARKETING_CHANNEL_LABEL } from "@/lib/marketing/dispatch";
import {
    type MarketingFormData,
    StepItem, type FormStep, FormCard, Section, FormField, TextInput, Textarea,
    ToggleCard, BranchSingleSelect, MultiSelectCard, MarketingPreviewPanel,
} from "@/components/marketing/form-kit";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
    { n: 1, label: "Announcement details" },
    { n: 2, label: "Visibility & delivery" },
];

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
    const branches            = useAppStore(s => s.branches);
    const customers           = useAppStore(s => s.customers);
    const customerPlans       = useAppStore(s => s.customerPlans);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const notificationSettings = useAppStore(s => s.notificationSettings);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<MarketingFormData>({
        bannerPreview: initial?.bannerPreview ?? "",
        name: initial?.name ?? "",
        // Type is fixed — announcements are a single-type module.
        type: "announcement",
        // Content type is fixed — announcements always send under "Studio announcements".
        topic: "",
        description: initial?.description ?? "",
        // No action — an announcement never carries a CTA.
        action: "no_action",
        ticketPrice: "",
        ctaClassId: "",
        externalUrl: "",
        startDate: "",
        startTime: "",
        // `endDate` doubles as the single "show until" date.
        endDate: initial?.endDate ?? "",
        endTime: "",
        countdown: false,
        multiLocation: initial?.multiLocation ?? false,
        branchIds: initial?.branchIds ?? [],
        singleBranchId: initial?.singleBranchId ?? null,
        productIds: [],
        customerTargeting: "",
        // Campaign-only fields — unused by announcements (broadcast).
        audienceKind: "",
        audienceMembershipIds: [],
        audienceSegments: [],
        audienceCustomerIds: [],
        scheduleMode: "",
    });
    const patch = (p: Partial<MarketingFormData>) => setForm(prev => ({ ...prev, ...p }));

    function handleClose() {
        router.push(returnTo);
    }

    // Step-1 gate — a title + a message.
    const canContinue = form.name.trim().length > 0 && form.description.trim().length > 0;

    // Step-2 gate — a branch + a show-until date.
    const branchOk = form.multiLocation ? form.branchIds.length > 0 : !!form.singleBranchId;
    const canCreate = branchOk && form.endDate.length > 0;

    function handleSubmit() {
        const branchIds = form.multiLocation
            ? form.branchIds
            : form.singleBranchId ? [form.singleBranchId] : [];

        const fields: Omit<MarketingItem, "id" | "status" | "view_count" | "click_count" | "conversion_count"> = {
            title: form.name.trim(),
            type: "announcement",
            short_description: form.description.trim(),
            cover_image_url: form.bannerPreview || undefined,
            // Announcements never carry an action, a link, a ticket, or a class.
            action_type: "no_action",
            ticket_price: undefined,
            cta_class_id: undefined,
            external_url: undefined,
            // Publish now; hide after the end of the show-until day.
            publish_date: new Date().toISOString(),
            expiry_date: `${form.endDate}T23:59:00Z`,
            countdown: false,
            branch_ids: branchIds,
            multi_location: form.multiLocation,
            // No product scope, no segment targeting — an announcement is a
            // branch-wide broadcast.
            target_package_ids: [],
            target_class_ids: [],
            customer_targeting: undefined,
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
            // Delivered reach — branch audience ∩ "Studio announcements" opt-in + channels.
            const audience = audienceMatch(
                { kind: "everyone", branchIds },
                customers, customerPlans, customerTransactions,
            );
            const r = marketingReach(audience, "studio_announcements", notificationSettings);
            const viaText = r.channels.length ? ` via ${r.channels.map(ch => MARKETING_CHANNEL_LABEL[ch]).join(", ")}` : "";
            showToast("Announcement published", `Sent to ${r.total} customer${r.total === 1 ? "" : "s"}${viaText}.`, "success", "check");
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
                                <FormField label="Message">
                                    <Textarea value={form.description} onChange={v => patch({ description: v })}
                                        placeholder="e.g. We'll be closed on April 20 for maintenance. All bookings are rescheduled." />
                                </FormField>
                            </Section>
                        </FormCard>
                    ) : (
                        <FormCard footer={
                            <div className="flex items-center justify-between w-full">
                                <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                                <Button variant="primary" size="md" disabled={!canCreate} onClick={handleSubmit}>
                                    {isEdit ? "Save changes" : "Publish announcement"}
                                </Button>
                            </div>
                        }>
                            {/* ── Show until ── */}
                            <Section title="Show until">
                                <FormField label="Show until"
                                    hint="The announcement shows in the app up to and including this day, then hides automatically.">
                                    <DatePicker value={form.endDate} placeholder="Select date" minDate={todayISO()}
                                        onChange={iso => patch({ endDate: iso })} />
                                </FormField>
                            </Section>

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

                            {/* ── Delivery ── read-only note explaining the push + consent gate. */}
                            <Section title="Delivery">
                                <div className="bg-[#f1f2ed] rounded-[12px] p-4 flex items-start gap-3">
                                    <span className="w-5 h-5 shrink-0 text-[#475467]"><Bell01 className="w-5 h-5" /></span>
                                    <p className="text-[14px] text-[#475467] leading-5">
                                        Published as an in-app banner and a push notification to customers in the selected branches.
                                    </p>
                                </div>
                            </Section>
                        </FormCard>
                    )}

                    {/* Right: live announcement preview (no action row) */}
                    <MarketingPreviewPanel form={form} branches={branches} noun="announcement" hideAction />
                </div>
            </div>
        </div>
    );
}
