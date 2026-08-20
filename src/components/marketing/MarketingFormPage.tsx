"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit campaign
// ─────────────────────────────────────────────────────────────────────────────
//
// A Campaign is "something to SEND: a message to a chosen segment of customers"
// (client model 2026-08-12). Full-page 2-step flow (lives OUTSIDE the admin
// sidebar):
//   1. Campaign content — banner / name / message / topic + an optional CTA
//      (Book a class / External link / No action)
//   2. Audience & send  — branch scope, the audience segment, a live "will
//      reach N" count, and Send now / Schedule for later (or Save as draft)
//
// On send the store dispatches a consent-gated push to the audience and records
// the send in `marketingCampaignStats` (see store `addMarketingItem`). Campaigns
// are delivered to the customer's notification inbox — NOT the "What's on"
// banner (that's the Announcement's job).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, ChevronDown } from "@untitledui/icons";
import { cn, to12h } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { PanelStepper } from "@/components/ui/PanelStepper";
import { useAppStore, type MarketingItem } from "@/lib/store";
import {
    type MarketingFormData, type ClassCtaOption, type MultiOption,
    ACTIONS_BY_TYPE, nowHHMM,
    StepItem, type FormStep, FormCard, Section, FormField, TextInput, Textarea,
    FilledRadio, ActionCard, TimeSelect, ClassCtaSelect,
    ToggleCard, MultiSelectCard, BranchSingleSelect, MarketingPreviewPanel,
} from "@/components/marketing/form-kit";
import { audienceMatch, marketingReach, MARKETING_CHANNEL_LABEL, type AudienceSpec } from "@/lib/marketing/dispatch";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS: FormStep[] = [
    { n: 1, label: "Campaign content" },
    { n: 2, label: "Audience & send" },
];

// Campaign CTA options — Book a class / External link / No action.
const CAMPAIGN_ACTIONS = ACTIONS_BY_TYPE.campaign;

const SEGMENT_OPTIONS: { value: "lead" | "member" | "inactive"; label: string; sub: string }[] = [
    { value: "lead",     label: "Leads",    sub: "Never bought anything" },
    { value: "member",   label: "Members",  sub: "Something live right now" },
    { value: "inactive", label: "Inactive", sub: "Bought before, nothing live" },
];
// Segment picker reuses the MultiSelectCard (Select all + filter + accordion).
const SEGMENT_MULTI_OPTIONS: MultiOption[] = SEGMENT_OPTIONS.map(s => ({ id: s.value, label: s.label, sublabel: s.sub }));

const AUDIENCE_OPTIONS: { value: NonNullable<MarketingFormData["audienceKind"]>; label: string }[] = [
    { value: "everyone",   label: "Everyone" },
    { value: "membership", label: "By membership" },
    { value: "segment",    label: "By segment" },
    { value: "specific",   label: "Specific customers" },
];

// A campaign's content type maps to a Customer-notifications row (channel config
// + the customer's opt-in). Only the two campaign-relevant rows are offered —
// Announcements + Promotions map to their own rows automatically.
const TOPIC_OPTIONS: { value: MarketingFormData["topic"]; label: string }[] = [
    { value: "new_class_launch", label: "New class launch" },
    { value: "special_offers",   label: "Special offers" },
];

function TopicSelect({ value, onChange }: { value: MarketingFormData["topic"]; onChange: (v: MarketingFormData["topic"]) => void }) {
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);
    const selected = TOPIC_OPTIONS.find(o => o.value === value);
    function toggle() {
        if (btnRef.current) setWidth(btnRef.current.offsetWidth);
        setOpen(p => !p);
    }
    return (
        <>
            <button ref={btnRef} type="button" onClick={toggle}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[16px] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {selected?.label ?? "Select content type"}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={width || 220}>
                {TOPIC_OPTIONS.map(o => (
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

// ─── Store row → form initial ────────────────────────────────────────────────

/** Split an ISO "2026-02-20T12:00:00Z" into "2026-02-20" + "12:00". */
function splitIso(iso?: string): { date: string; time: string } {
    if (!iso) return { date: "", time: "" };
    const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
    if (!m) return { date: iso.slice(0, 10), time: "" };
    return { date: m[1], time: m[2] };
}

/** Map a persisted `marketing_items` row back into the campaign form's working
 *  shape. Shared by the legacy edit route and the side-panel host so the two
 *  entry points stay byte-identical. */
export function marketingItemToInitial(item: MarketingItem): Partial<MarketingFormData> {
    const branchIds = item.branch_ids ?? [];
    const multiLocation = item.multi_location ?? (branchIds.length !== 1);
    // A scheduled campaign restores its send time; sent/draft start blank.
    const scheduled = item.delivery_status === "scheduled";
    const sched = splitIso(scheduled ? item.scheduled_at : undefined);
    return {
        bannerPreview: item.cover_image_url ?? "",
        name: item.title,
        topic: item.topic ?? "",
        description: item.short_description,
        action: item.action_type,
        ctaClassId: item.cta_class_id ?? "",
        externalUrl: (item.external_url ?? "").replace(/^https?:\/\//i, ""),
        startDate: sched.date,
        startTime: sched.time,
        multiLocation,
        branchIds,
        singleBranchId: multiLocation ? null : (branchIds[0] ?? null),
        audienceKind: item.audience_kind ?? "everyone",
        audienceMembershipIds: item.audience_membership_ids ?? [],
        audienceSegments: item.audience_segments ?? [],
        audienceCustomerIds: item.audience_customer_ids ?? [],
        scheduleMode: scheduled ? "later" : "now",
        budget: item.budget_aed != null ? String(item.budget_aed) : "",
    };
}

// ─── Shared page component ───────────────────────────────────────────────────

export interface MarketingFormPageProps {
    mode: "create" | "edit";
    marketingId?: string;
    initial?: Partial<MarketingFormData>;
    returnTo?: string;
    /** When provided the form renders as SIDE-PANEL content and this closes the
     *  panel instead of navigating (client 2026-08-18). */
    onClose?: () => void;
}

export function MarketingFormPage({ mode, marketingId, initial, returnTo = "/admin/marketing", onClose }: MarketingFormPageProps) {
    const router = useRouter();
    const isEdit = mode === "edit";

    const addMarketingItem    = useAppStore(s => s.addMarketingItem);
    const updateMarketingItem = useAppStore(s => s.updateMarketingItem);
    const showToast           = useAppStore(s => s.showToast);
    const memberships         = useAppStore(s => s.memberships);
    const classSchedules      = useAppStore(s => s.classSchedules);
    const branches            = useAppStore(s => s.branches);
    const customers           = useAppStore(s => s.customers);
    const customerPlans       = useAppStore(s => s.customerPlans);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const notificationSettings = useAppStore(s => s.notificationSettings);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<MarketingFormData>({
        bannerPreview: initial?.bannerPreview ?? "",
        name: initial?.name ?? "",
        type: "campaign",
        topic: initial?.topic ?? "",
        description: initial?.description ?? "",
        action: initial?.action ?? "no_action",
        ticketPrice: "",
        ctaClassId: initial?.ctaClassId ?? "",
        externalUrl: initial?.externalUrl ?? "",
        // startDate/startTime double as the scheduled send time.
        startDate: initial?.startDate ?? "",
        startTime: initial?.startTime ?? "",
        endDate: "",
        endTime: "",
        countdown: false,
        multiLocation: initial?.multiLocation ?? false,
        branchIds: initial?.branchIds ?? [],
        singleBranchId: initial?.singleBranchId ?? null,
        productIds: [],
        customerTargeting: "",
        audienceKind: initial?.audienceKind ?? "everyone",
        audienceMembershipIds: initial?.audienceMembershipIds ?? [],
        audienceSegments: initial?.audienceSegments ?? [],
        audienceCustomerIds: initial?.audienceCustomerIds ?? [],
        scheduleMode: initial?.scheduleMode ?? "now",
        budget: initial?.budget ?? "",
    });
    const patch = (p: Partial<MarketingFormData>) => setForm(prev => ({ ...prev, ...p }));

    // When `onClose` is supplied the form is side-panel content — closing and
    // post-submit both dismiss the panel instead of navigating.
    const panel = !!onClose;
    const exit = onClose ?? (() => router.push(returnTo));
    /** After a create/edit: dismiss the panel, or (page fallback) route to the
     *  freshly-saved detail page. */
    const finish = (detailPath: string) => { if (panel) exit(); else router.push(detailPath); };

    // ─── Option lists ──────────────────────────────────────────────────────
    const membershipOptions: MultiOption[] = useMemo(
        () => memberships.filter(m => m.status === "active").map(m => ({ id: m.id, label: m.name })),
        [memberships],
    );
    const customerOptions: MultiOption[] = useMemo(
        () => customers.filter(c => c.status !== "archived")
            .map(c => ({ id: c.id, label: `${c.firstName} ${c.lastName}`.trim(), sublabel: c.email })),
        [customers],
    );
    // "Book a class" CTA target — all upcoming real classes.
    const ctaClassOptions: ClassCtaOption[] = useMemo(() => {
        const from = todayISO();
        return classSchedules
            .filter(c => c.type === "class" && c.status !== "Cancelled" && c.status !== "Completed" && c.dateISO >= from)
            .sort((a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime))
            .map(c => ({ value: c.id, label: c.name, sub: `${c.date} · ${c.displayTime || to12h(c.startTime)} · ${c.instructorName}` }));
    }, [classSchedules]);

    useEffect(() => {
        if (form.ctaClassId && !ctaClassOptions.some(o => o.value === form.ctaClassId)) patch({ ctaClassId: "" });
    }, [ctaClassOptions]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Live reach (audience ∩ consent) ───────────────────────────────────
    const branchIds = form.multiLocation
        ? form.branchIds
        : form.singleBranchId ? [form.singleBranchId] : [];
    const audienceSpec: AudienceSpec = {
        kind: (form.audienceKind || "everyone"),
        membershipIds: form.audienceMembershipIds,
        segments: form.audienceSegments,
        customerIds: form.audienceCustomerIds,
        branchIds,
    };
    const audienceCustomers = useMemo(
        () => audienceMatch(audienceSpec, customers, customerPlans, customerTransactions),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [form.audienceKind, form.audienceMembershipIds, form.audienceSegments, form.audienceCustomerIds, form.multiLocation, form.branchIds, form.singleBranchId, customers, customerPlans, customerTransactions],
    );
    // Consent-gated reach once a content type is chosen (audience ∩ topic opt-in ∩ channels).
    const reachInfo = useMemo(
        () => form.topic ? marketingReach(audienceCustomers, form.topic, notificationSettings) : null,
        [audienceCustomers, form.topic, notificationSettings],
    );
    const reach = reachInfo ? reachInfo.total : audienceCustomers.length;
    const reachChannels = reachInfo ? reachInfo.channels : [];

    // ─── Gates ─────────────────────────────────────────────────────────────
    const actionConfigOk =
        form.action === "external_link" ? form.externalUrl.trim().length > 0
            : form.action === "book_event" ? form.ctaClassId.trim().length > 0
                : true;
    const canContinue =
        form.name.trim().length > 0 && form.description.trim().length > 0 &&
        form.topic !== "" && form.action !== "" && actionConfigOk;

    const branchOk = form.multiLocation ? form.branchIds.length > 0 : !!form.singleBranchId;
    const audienceOk =
        form.audienceKind === "everyone" ? true
            : form.audienceKind === "membership" ? form.audienceMembershipIds.length > 0
                : form.audienceKind === "segment" ? form.audienceSegments.length > 0
                    : form.audienceKind === "specific" ? form.audienceCustomerIds.length > 0
                        : false;
    const scheduleOk = form.scheduleMode === "now"
        || (form.scheduleMode === "later" && form.startDate.length > 0 && form.startTime.length > 0);
    const canSend = branchOk && audienceOk && scheduleOk;

    function handleSubmit(kind: "draft" | "send") {
        const toIso = (date: string, time: string) => date ? `${date}T${time || "00:00"}:00Z` : undefined;
        const externalUrl = form.action === "external_link" && form.externalUrl.trim()
            ? (/^https?:\/\//i.test(form.externalUrl.trim()) ? form.externalUrl.trim() : `http://${form.externalUrl.trim()}`)
            : undefined;

        const scheduling = kind === "send" && form.scheduleMode === "later";
        const sending = kind === "send" && form.scheduleMode === "now";
        const nowIso = new Date().toISOString();
        const scheduledIso = scheduling ? toIso(form.startDate, form.startTime) : undefined;
        const deliveryStatus: MarketingItem["delivery_status"] = kind === "draft" ? "draft" : scheduling ? "scheduled" : "sent";

        const fields: Omit<MarketingItem, "id" | "status" | "view_count" | "click_count" | "conversion_count"> = {
            title: form.name.trim(),
            type: "campaign",
            topic: form.topic || undefined,
            short_description: form.description.trim(),
            cover_image_url: form.bannerPreview || undefined,
            action_type: form.action || "no_action",
            cta_class_id: form.action === "book_event" && form.ctaClassId ? form.ctaClassId : undefined,
            external_url: externalUrl,
            ticket_price: undefined,
            publish_date: sending ? nowIso : scheduledIso ?? nowIso,
            expiry_date: undefined,
            countdown: false,
            branch_ids: branchIds,
            multi_location: form.multiLocation,
            target_package_ids: [],
            target_class_ids: [],
            customer_targeting: undefined,
            created_at: nowIso,
            audience_kind: form.audienceKind || "everyone",
            audience_membership_ids: form.audienceKind === "membership" ? form.audienceMembershipIds : undefined,
            audience_segments: form.audienceKind === "segment" ? form.audienceSegments : undefined,
            audience_customer_ids: form.audienceKind === "specific" ? form.audienceCustomerIds : undefined,
            delivery_status: deliveryStatus,
            scheduled_at: scheduling ? scheduledIso : undefined,
            sent_at: sending ? nowIso : undefined,
            budget_aed: form.budget.trim() ? Number(form.budget) : undefined,
        };

        if (isEdit && marketingId) {
            // Preserve the original created_at — an edit must not clobber it
            // with "now" (it drives the campaign's age / sort ordering).
            const { created_at: _createdAt, ...editFields } = fields;
            updateMarketingItem(marketingId, editFields);
            showToast("Campaign updated", `${fields.title} has been saved.`, "success", "check");
            finish(`/marketing/${marketingId}`);
            return;
        }
        const newId = addMarketingItem({ ...fields, status: "active", view_count: 0, click_count: 0, conversion_count: 0 });
        const viaText = reachChannels.length ? ` via ${reachChannels.map(ch => MARKETING_CHANNEL_LABEL[ch]).join(", ")}` : "";
        if (kind === "draft") showToast("Draft saved", `${fields.title} was saved as a draft.`, "success", "check");
        else if (scheduling) showToast("Campaign scheduled", `${fields.title} will send to ${reach ?? 0} customer${reach === 1 ? "" : "s"}${viaText}.`, "success", "check");
        else showToast("Campaign sent", `${fields.title} was sent to ${reach ?? 0} customer${reach === 1 ? "" : "s"}${viaText}.`, "success", "check");
        finish(`/marketing/${newId}`);
    }

    // Step footer buttons — shared by the page shell (inside FormCard) and the
    // side-panel footer bar. Cancel routes through `exit` (close panel / nav).
    const stepFooter = step === 1 ? (
        <div className="flex items-center justify-between w-full">
            <Button variant="secondary-gray" size="md" onClick={exit}>Cancel</Button>
            <Button variant="primary" size="md" disabled={!canContinue} onClick={() => setStep(2)}>Continue</Button>
        </div>
    ) : (
        <div className="flex items-center justify-between w-full gap-3">
            <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
            <div className="flex items-center gap-3">
                <Button variant="secondary-gray" size="md" onClick={() => handleSubmit("draft")}>Save as draft</Button>
                <Button variant="primary" size="md" disabled={!canSend} onClick={() => handleSubmit("send")}>
                    {form.scheduleMode === "later" ? "Schedule campaign" : "Send campaign"}
                </Button>
            </div>
        </div>
    );

    // Step body sections — rendered inside the FormCard (page) or the panel's
    // scroll area. Both use the same `flex flex-col gap-8` spacing.
    const stepBody = step === 1 ? (
        <Section title="Campaign content">
            <ImageBannerUpload
                preview={form.bannerPreview || null}
                onChange={url => patch({ bannerPreview: url ?? "" })}
                sizeGuide="Recommended: 1029 × 420 px (ratio ~2.45:1). Off-ratio images are cropped — keep key content centered."
            />
            <div className="grid grid-cols-2 gap-3 w-full">
                <FormField label="Display name">
                    <TextInput value={form.name} onChange={v => patch({ name: v })} placeholder="e.g. New: Aerial Yoga" />
                </FormField>
                <FormField label="Content type" hint="Content type based on customer notifications.">
                    <TopicSelect value={form.topic} onChange={v => patch({ topic: v })} />
                </FormField>
            </div>
            <FormField label="Message">
                <Textarea value={form.description} onChange={v => patch({ description: v })}
                    placeholder="Write the message customers receive..." />
            </FormField>

            <FormField label="Budget (AED)" hint="Marketing spend for this campaign. Feeds the Acquisition Efficiency report — split across the campaign's channels by message volume.">
                <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)] h-10">
                    <span className="flex items-center px-[14px] text-[16px] text-[var(--colors-text-quaternary)] bg-[var(--colors-bg-secondary)] border-r-1 border-[var(--colors-border-primary)]">AED</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={form.budget}
                        onChange={e => patch({ budget: e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "") })}
                        placeholder="0"
                        className="flex-1 min-w-0 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-white"
                    />
                </div>
            </FormField>

            {/* Link or action */}
            <FormField label="Link or action">
                <div className="grid grid-cols-2 gap-3 w-full">
                    {CAMPAIGN_ACTIONS.map(a => (
                        <ActionCard key={a} action={a}
                            selected={form.action === a}
                            onSelect={() => patch({
                                action: a,
                                externalUrl: a === "external_link" ? form.externalUrl : "",
                                ctaClassId: a === "book_event" ? form.ctaClassId : "",
                            })} />
                    ))}
                </div>
            </FormField>
            {form.action === "book_event" && (
                <FormField label="Select class" hint="The class this campaign's Book button opens.">
                    <ClassCtaSelect value={form.ctaClassId} onChange={id => patch({ ctaClassId: id })}
                        options={ctaClassOptions} placeholder="Select a class" />
                </FormField>
            )}
            {form.action === "external_link" && (
                <FormField label="External link" hint="The link opens in a new tab when a customer taps the CTA.">
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
    ) : (
        <>
            {/* ── Branch ── */}
            <Section title="Applicable branch">
                <ToggleCard title="Multi-location access" subtitle="The campaign can be sent from multiple branches"
                    on={form.multiLocation} onChange={v => patch({ multiLocation: v })} />
                {form.multiLocation ? (
                    <MultiSelectCard title="Branches" subtitle="The campaign targets customers at these branches"
                        options={branches.map(b => ({ id: b.id, label: b.name }))}
                        selected={form.branchIds} onChange={ids => patch({ branchIds: ids })} />
                ) : (
                    <FormField label="Branch location">
                        <BranchSingleSelect value={form.singleBranchId} onChange={id => patch({ singleBranchId: id })} branches={branches} />
                    </FormField>
                )}
            </Section>

            {/* ── Audience ── */}
            <Section title="Audience">
                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <p className="text-[14px] text-[var(--colors-text-quaternary)]">Who should receive this campaign?</p>
                    {AUDIENCE_OPTIONS.map(o => (
                        <button key={o.value} type="button" onClick={() => patch({ audienceKind: o.value })}
                            className="flex items-center gap-2 w-full text-left">
                            <FilledRadio selected={form.audienceKind === o.value} />
                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{o.label}</span>
                        </button>
                    ))}
                </div>

                {form.audienceKind === "membership" && (
                    <MultiSelectCard title="Memberships" subtitle="Customers holding these memberships"
                        options={membershipOptions} selected={form.audienceMembershipIds}
                        onChange={ids => patch({ audienceMembershipIds: ids })} />
                )}
                {form.audienceKind === "segment" && (
                    <MultiSelectCard title="Segments" subtitle="Customers in these wallet segments"
                        options={SEGMENT_MULTI_OPTIONS} selected={form.audienceSegments}
                        onChange={ids => patch({ audienceSegments: ids as ("lead" | "member" | "inactive")[] })} />
                )}
                {form.audienceKind === "specific" && (
                    <MultiSelectCard title="Customers" subtitle="Hand-pick who receives this campaign"
                        options={customerOptions} selected={form.audienceCustomerIds}
                        onChange={ids => patch({ audienceCustomerIds: ids })} searchable />
                )}

                {/* Live reach */}
                <div className="bg-[#f1f2ed] rounded-[12px] px-4 py-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] text-[#475467]">This campaign will reach</span>
                    <span className="text-[14px] font-semibold text-[#10373a]">
                        {`${reach} customer${reach === 1 ? "" : "s"}`}
                    </span>
                    <span className="text-[14px] text-[#475467]">
                        {reachInfo
                            ? (reachChannels.length ? `via ${reachChannels.map(ch => MARKETING_CHANNEL_LABEL[ch]).join(", ")}.` : "— no opted-in channels yet.")
                            : "in the chosen audience."}
                    </span>
                </div>
            </Section>

            {/* ── Send ── */}
            <Section title="Send">
                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    {([["now", "Send now"], ["later", "Schedule for later"]] as const).map(([v, label]) => (
                        <button key={v} type="button" onClick={() => patch({ scheduleMode: v })}
                            className="flex items-center gap-2 w-full text-left">
                            <FilledRadio selected={form.scheduleMode === v} />
                            <span className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</span>
                        </button>
                    ))}
                </div>
                {form.scheduleMode === "later" && (
                    <div className="flex gap-4 items-start w-full">
                        <div className="flex-1 min-w-0">
                            <FormField label="Send date">
                                <DatePicker value={form.startDate} placeholder="Select date" minDate={todayISO()}
                                    onChange={iso => patch({ startDate: iso,
                                        startTime: iso === todayISO() && form.startTime && form.startTime < nowHHMM() ? "" : form.startTime })} />
                            </FormField>
                        </div>
                        <div className="flex-1 min-w-0">
                            <FormField label="Send time">
                                <TimeSelect value={form.startTime}
                                    disabledOption={form.startDate === todayISO() ? (slot => slot < nowHHMM()) : undefined}
                                    onChange={v => patch({ startTime: v })} />
                            </FormField>
                        </div>
                    </div>
                )}
            </Section>
        </>
    );

    // ── Side-panel shell (client 2026-08-18) ──────────────────────────────────
    if (panel) {
        return (
            <>
                <div className="flex items-center justify-between px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                        {isEdit ? "Edit campaign" : "New campaign"}
                    </h2>
                    <button type="button" onClick={exit} aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <PanelStepper
                    steps={STEPS}
                    current={step}
                    onStep={(n) => { if (n === 1 || canContinue) setStep(n); }}
                />
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 py-5">
                    <div className="flex flex-col gap-8">{stepBody}</div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4">{stepFooter}</div>
            </>
        );
    }

    // ── Full-page shell (legacy /marketing/new + /marketing/[id]/edit) ────────
    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={exit} aria-label="Close"
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
                    <FormCard footer={stepFooter}>{stepBody}</FormCard>
                    {/* Right: live preview */}
                    <MarketingPreviewPanel form={form} branches={branches} noun="campaign" />
                </div>
            </div>
        </div>
    );
}
