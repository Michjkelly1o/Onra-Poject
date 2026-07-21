"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Customer notifications (PRD 11 §12 — v27 redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout per Figma 7745:26872:
//   • Toolbar right: Quiet hours pill + Delivery hours button
//   • Single bordered card hosts the whole table
//   • Column headers: Notifications · Email · WhatsApp · Approval status ·
//     SMS · Send time · kebab
//   • 5 collapsible sections (default open): Booking · Payment · Package &
//     membership · Marketing & promotions · Referral
//   • Payment rows show a Critical pill + "?" tooltip (payment lock)
//   • Marketing rows show "Sent during campaigns" pill instead of send time
//   • Row kebab: Edit template · Manage timing
//   • Bottom banner on Marketing group
//
// Modals:
//   • Edit template — 5 tabs (Email / WhatsApp / SMS / Manage timing /
//     Condition) per Figma 7745:28301 series + 7808:58413 (Condition
//     tab added Jul 2026 to let admin flip any event's `isCritical`
//     flag — was previously payments-only in the seed).
//   • Delivery hours — quiet-window side panel per Figma 7733:51010
//
// Cross-module wiring:
//   • WhatsApp column is DISABLED (grayed toggles + "?" tooltip on the
//     column header) when the WhatsApp Business integration isn't
//     connected — read live from `useAppStore(s => s.integrations)`.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    Edit02, XClose, Check, Lightbulb02,
    CalendarCheck01, BankNote01, CreditCard02, Announcement02, Users01,
    ChevronDown, DotsVertical, Clock, Trash01, Send03, HelpCircle,
    AlertCircle, Plus, MarkerPin01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    PhoneCountryDropdown,
    splitPhone,
    type PhoneCountry,
} from "@/components/customers/CustomerFormPage";
import {
    useAppStore,
    type NotificationSetting,
    type NotificationCategory,
    type NotificationSendMode,
    type NotificationSendOffset,
    type WhatsappApprovalStatus,
} from "@/lib/store";

// ─── Static config ─────────────────────────────────────────────────────────

const CATEGORY_META: Record<NotificationCategory, {
    label: string; Icon: React.ComponentType<{ className?: string }>;
}> = {
    booking:            { label: "Booking notifications",   Icon: CalendarCheck01 },
    payment:            { label: "Payment notifications",   Icon: BankNote01      },
    package_membership: { label: "Package & membership",    Icon: CreditCard02    },
    marketing:          { label: "Marketing & promotions",  Icon: Announcement02  },
    referral:           { label: "Referral notifications",  Icon: Users01         },
};

const CATEGORY_ORDER: NotificationCategory[] = [
    "booking", "payment", "package_membership", "marketing", "referral",
];

// Single braces — matches the seed templates in `notification_settings.ts`
// and the `renderSample` substitution dict. Adding `{class_time}` since
// every booking-family seed row uses it.
const TEMPLATE_VARIABLES = [
    "{member_name}", "{class_name}", "{class_date}", "{class_time}",
    "{instructor_name}", "{branch_name}", "{credits_remaining}",
    "{expiry_date}", "{package_name}", "{booking_id}", "{studio_name}",
    // Jul 2026 — Gift card purchase event (dispatched to the
    // recipient, not the buyer). See `ns_gift_card_purchase` seed.
    "{gift_card_code}", "{gift_card_amount}", "{sender_name}",
    "{recipient_name}", "{gift_message}",
];

const OFFSET_UNIT_OPTIONS = [
    { value: "minutes", label: "minutes" },
    { value: "hours",   label: "hours"   },
    { value: "days",    label: "days"    },
];

// Compact widths mirrored between the column header row and each event row
// so the columns align pixel-for-pixel across sections.
const COL_EMAIL    = "w-[64px]";
const COL_WA       = "w-[80px]";
const COL_APPROVAL = "w-[120px]";
const COL_SMS      = "w-[64px]";
const COL_SEND     = "w-[180px]";
const COL_KEBAB    = "w-[40px]";

// ─── Tiny atoms ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, ariaLabel, disabled, lockedOn, onLockedClick }: {
    on: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
    /** Hard-disabled — dimmed + cursor-not-allowed. Used for the
     *  disconnected WhatsApp column. Clicks are dropped entirely. */
    disabled?: boolean;
    /** Locked ON — the switch reads as fully "on" with an amber ring,
     *  and toggling is blocked, BUT the click is still intercepted so
     *  the caller can surface a "why is this locked?" toast. Used for
     *  the last-remaining channel on a critical (payment) row. */
    lockedOn?: boolean;
    /** Fired instead of `onChange` when the user clicks a `lockedOn`
     *  toggle. The row wires this to the same store-guard branch that
     *  the keyboard/AT path hits, so admins always get feedback. */
    onLockedClick?: () => void;
}) {
    // We deliberately DO NOT use the `disabled` HTML attribute for the
    // locked-on case — a disabled button drops click events entirely,
    // and we need them so we can fire the toast. Hard-disabled (WA
    // integration off) still uses the attribute since there's nothing
    // to say and pointer-events must feel truly dead.
    function handleClick() {
        if (disabled) return;
        if (lockedOn) { onLockedClick?.(); return; }
        onChange(!on);
    }
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={handleClick}
            disabled={disabled && !lockedOn}
            aria-disabled={disabled || lockedOn}
            title={lockedOn ? "This channel is locked on — at least one channel must stay on for critical notifications." : undefined}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                // Only DIM for hard disable, never for the locked-on
                // state — the amber tone below reads as protected, not
                // broken. cursor-not-allowed still fires so the pointer
                // signals "no click here" for both paths.
                disabled && !lockedOn && "opacity-50 cursor-not-allowed",
                lockedOn && "cursor-not-allowed",
                on ? (lockedOn ? "bg-[#658774] ring-2 ring-[#fedf89]" : "bg-[#658774]") : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

function Pill({ tone, children }: {
    tone: "green" | "amber" | "red" | "blue" | "gray"; children: React.ReactNode;
}) {
    const tint =
        tone === "green" ? "bg-[#ecfdf3] border-[#abefc6] text-[#067647]"
      : tone === "amber" ? "bg-[#fffaeb] border-[#fedf89] text-[#b54708]"
      : tone === "red"   ? "bg-[#fef3f2] border-[#fecdca] text-[#b42318]"
      : tone === "blue"  ? "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]"
      :                    "bg-[#f9fafb] border-[#e4e7ec] text-[#344054]";
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium border-1 whitespace-nowrap", tint)}>
            {children}
        </span>
    );
}

function ApprovalPill({ status }: { status: WhatsappApprovalStatus }) {
    if (status === "approved") return <Pill tone="green">Approved</Pill>;
    if (status === "pending")  return <Pill tone="amber">Pending</Pill>;
    return <Pill tone="red">Rejected</Pill>;
}

/** Hover / focus tooltip anchored to a small `?` glyph. Same pattern as
 *  the Agreements rule pills. */
function InfoTooltip({ content, className }: { content: string; className?: string }) {
    const [open, setOpen] = useState(false);
    return (
        <span
            className={cn("relative inline-flex", className)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
        >
            <button type="button" tabIndex={0} aria-label="More info"
                className="w-4 h-4 rounded-full text-[#98a2b3] hover:text-[#667085] transition-colors flex items-center justify-center">
                <HelpCircle className="w-4 h-4" />
            </button>
            {open && (
                <span role="tooltip"
                    className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 z-50 whitespace-normal min-w-[220px] max-w-[280px] px-3 py-2 rounded-[8px] bg-[#0c111d] text-white text-[12px] leading-[16px] shadow-[0px_8px_16px_-2px_rgba(0,0,0,0.15)]">
                    {content}
                </span>
            )}
        </span>
    );
}

// ─── Send-time compact summary ─────────────────────────────────────────────

function unitCompact(u: "minutes" | "hours" | "days"): string {
    return u === "minutes" ? "m" : u === "hours" ? "h" : "d";
}

/** Landing "Send time" column formatter. Empty offsets → "Immediately".
 *  Otherwise joins each offset with `, ` and uses compact units: "24h, 2h",
 *  "30m", "7d". */
function formatSendTime(ns: NotificationSetting): string {
    if (ns.sendMode === "immediately" || ns.sendOffsets.length === 0) return "Immediately";
    return ns.sendOffsets.map(o => `${o.value}${unitCompact(o.unit)}`).join(", ");
}

// ─── Row kebab menu (Edit template / Manage timing) ────────────────────────

function RowKebab({ onEditTemplate, onManageTiming }: {
    onEditTemplate: () => void; onManageTiming: () => void;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    return (
        <>
            <button ref={btnRef} type="button" aria-label="Row actions"
                onClick={() => setOpen(o => !o)}
                className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-5 h-5 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                <button type="button"
                    onClick={() => { setOpen(false); onEditTemplate(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors text-left">
                    <Edit02 className="w-4 h-4 text-[#667085]" />
                    Edit template
                </button>
                <button type="button"
                    onClick={() => { setOpen(false); onManageTiming(); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors text-left">
                    <Clock className="w-4 h-4 text-[#667085]" />
                    Manage timing
                </button>
            </FixedDropdown>
        </>
    );
}

// ─── Event row ─────────────────────────────────────────────────────────────

function EventRow({ ns, waConnected, onChannelToggle, onLockHit, onEditTemplate, onManageTiming }: {
    ns: NotificationSetting;
    waConnected: boolean;
    onChannelToggle: (channel: "email" | "whatsapp" | "sms", enabled: boolean) => void;
    /** Called when the user clicks a `lockedOn` toggle. The page
     *  handler fires the "<Label> is critical" warning toast — same
     *  copy the store-guard path uses for keyboard/AT input. */
    onLockHit: () => void;
    onEditTemplate: () => void;
    onManageTiming: () => void;
}) {
    // Meta approval state is a property of the template itself so it
    // stays visible whenever the integration is connected — even when
    // this row's WhatsApp channel toggle is off. Only hidden when the
    // integration itself isn't connected (approval means nothing there).
    const showApprovalPill = waConnected;

    // ── Critical-row lock ─────────────────────────────────────────
    // Payment rows guarantee a customer always hears about their money.
    // We lock the toggle whose channel is the LAST remaining ON so the
    // admin literally can't click it off — no fumbled clicks, no
    // "why is this failing" state. The store's guard (return false +
    // warning toast) still catches keyboard/AT paths that bypass the
    // disabled attribute.
    //
    // WhatsApp is considered EFFECTIVELY OFF when the integration is
    // disconnected — so on a critical row with only WhatsApp on and WA
    // disconnected, this reduces to "no live channel," which never
    // happens in practice because seeds ensure at least one non-WA
    // channel is on for every critical row.
    const emailLive    = ns.emailEnabled;
    const whatsappLive = ns.whatsappEnabled && waConnected;
    const smsLive      = ns.smsEnabled;
    const liveCount = (emailLive ? 1 : 0) + (whatsappLive ? 1 : 0) + (smsLive ? 1 : 0);
    const lockEmail    = ns.isCritical && emailLive    && liveCount === 1;
    const lockWhatsapp = ns.isCritical && whatsappLive && liveCount === 1;
    const lockSms      = ns.isCritical && smsLive      && liveCount === 1;

    return (
        <div className="flex items-center gap-4 pl-11 pr-4 h-[52px] border-t border-[#f2f4f7]">
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <span className="text-[14px] text-[#344054] truncate">{ns.label}</span>
                {ns.isCritical && (
                    <>
                        <Pill tone="blue">Critical</Pill>
                        <InfoTooltip content="At least one channel stays on. Critical notifications must always reach the customer, so you can't disable the last enabled channel." />
                    </>
                )}
                {ns.sentDuringCampaigns && (
                    <Pill tone="gray">Sent during campaigns</Pill>
                )}
            </div>
            <div className={cn(COL_EMAIL, "flex justify-center")}>
                <Toggle on={ns.emailEnabled}
                    lockedOn={lockEmail}
                    onChange={v => onChannelToggle("email", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`Email ${ns.label}`} />
            </div>
            <div className={cn(COL_WA, "flex justify-center")}>
                <Toggle on={ns.whatsappEnabled && waConnected}
                    disabled={!waConnected}
                    lockedOn={lockWhatsapp}
                    onChange={v => onChannelToggle("whatsapp", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`WhatsApp ${ns.label}`} />
            </div>
            {showApprovalPill && (
                <div className={cn(COL_APPROVAL, "flex justify-center")}>
                    <ApprovalPill status={ns.whatsappApprovalStatus} />
                </div>
            )}
            <div className={cn(COL_SMS, "flex justify-center")}>
                <Toggle on={ns.smsEnabled}
                    lockedOn={lockSms}
                    onChange={v => onChannelToggle("sms", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`SMS ${ns.label}`} />
            </div>
            <div className={cn(COL_SEND, "text-[14px] text-[#475467]")}>
                {ns.sentDuringCampaigns ? "—" : formatSendTime(ns)}
            </div>
            <div className={cn(COL_KEBAB, "flex justify-center")}>
                <RowKebab onEditTemplate={onEditTemplate} onManageTiming={onManageTiming} />
            </div>
        </div>
    );
}

// ─── Section accordion ────────────────────────────────────────────────────

function Section({
    category, items, open, onToggle, waConnected, onChannelToggle, onLockHit, onEditTemplate, onManageTiming,
    marketingOptedIn, marketingTotal,
    branches, allSettings, onAddBranchOverride, onRemoveBranchOverride,
}: {
    category: NotificationCategory;
    /** Parent rows only for this category — the page pre-filters
     *  branch-override child rows out. Children are looked up per
     *  parent from `allSettings` below (marketing category only). */
    items: NotificationSetting[];
    open: boolean; onToggle: () => void;
    waConnected: boolean;
    onChannelToggle: (id: string, channel: "email" | "whatsapp" | "sms", enabled: boolean) => void;
    onLockHit: (id: string) => void;
    onEditTemplate: (ns: NotificationSetting) => void;
    onManageTiming: (ns: NotificationSetting) => void;
    /** Live counts injected by the page. Only read by the marketing
     *  group — the other categories ignore them. */
    marketingOptedIn: number;
    marketingTotal: number;
    /** Branches available for per-marketing overrides. Passed all the
     *  way in so the "+ Add branch override" dropdown menu can list
     *  only branches that don't already have an override. */
    branches: { id: string; name: string; status: string }[];
    /** Full settings slice — used to look up override children per
     *  marketing parent. */
    allSettings: NotificationSetting[];
    onAddBranchOverride: (parentId: string, branchId: string) => void;
    onRemoveBranchOverride: (id: string) => void;
}) {
    const meta = CATEGORY_META[category];
    // Child overrides keyed by notificationType so lookup is O(1) per
    // parent. Only meaningful when category === "marketing"; other
    // categories never carry branchId'd rows.
    const overridesByType = useMemo(() => {
        const map = new Map<string, NotificationSetting[]>();
        if (category !== "marketing") return map;
        for (const n of allSettings) {
            if (!n.branchId) continue;
            const list = map.get(n.notificationType) ?? [];
            list.push(n);
            map.set(n.notificationType, list);
        }
        return map;
    }, [allSettings, category]);
    return (
        <div className="border-t border-[#e4e7ec]">
            <button type="button" onClick={onToggle}
                className="w-full flex items-center gap-2 px-4 h-[52px] hover:bg-[#fafafa] transition-colors">
                <ChevronDown className={cn(
                    "w-5 h-5 text-[#667085] transition-transform shrink-0",
                    !open && "-rotate-90",
                )} />
                <meta.Icon className="w-4 h-4 text-[#667085]" />
                <span className="text-[14px] font-medium text-[#101828]">{meta.label}</span>
            </button>

            {open && items.map(ns => (
                <Fragment key={ns.id}>
                    <EventRow
                        ns={ns}
                        waConnected={waConnected}
                        onChannelToggle={(ch, v) => onChannelToggle(ns.id, ch, v)}
                        onLockHit={() => onLockHit(ns.id)}
                        onEditTemplate={() => onEditTemplate(ns)}
                        onManageTiming={() => onManageTiming(ns)}
                    />
                    {category === "marketing" && (
                        <MarketingBranchOverrides
                            parent={ns}
                            overrides={overridesByType.get(ns.notificationType) ?? []}
                            branches={branches}
                            waConnected={waConnected}
                            onChannelToggle={onChannelToggle}
                            onLockHit={onLockHit}
                            onEditTemplate={onEditTemplate}
                            onManageTiming={onManageTiming}
                            onAddBranchOverride={onAddBranchOverride}
                            onRemoveBranchOverride={onRemoveBranchOverride}
                        />
                    )}
                </Fragment>
            ))}

            {open && category === "marketing" && (
                <div className="mx-4 mt-4 mb-4 rounded-[12px] bg-[#f5fffa] border-1 border-[#e4e7ec] px-4 py-3 flex items-start gap-3">
                    <Lightbulb02 className="w-5 h-5 text-[#658774] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        Only <span className="font-semibold text-[#101828]">{marketingOptedIn.toLocaleString()}</span> of{" "}
                        <span className="font-semibold text-[#101828]">{marketingTotal.toLocaleString()}</span>{" "}
                        customers have opted in to receive marketing messages. Opted-out customers won't receive them.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Marketing per-branch overrides (client 2026-07-20) ───────────────────
//
// Sits directly under each MARKETING parent row. Renders one child row
// per existing override + a "+ Add branch override" affordance
// listing every branch that doesn't yet have an override for this
// parent. When no branches remain unassigned, the button hides.

function MarketingBranchOverrides({
    parent, overrides, branches, waConnected,
    onChannelToggle, onLockHit, onEditTemplate, onManageTiming,
    onAddBranchOverride, onRemoveBranchOverride,
}: {
    parent: NotificationSetting;
    overrides: NotificationSetting[];
    branches: { id: string; name: string; status: string }[];
    waConnected: boolean;
    onChannelToggle: (id: string, channel: "email" | "whatsapp" | "sms", enabled: boolean) => void;
    onLockHit: (id: string) => void;
    onEditTemplate: (ns: NotificationSetting) => void;
    onManageTiming: (ns: NotificationSetting) => void;
    onAddBranchOverride: (parentId: string, branchId: string) => void;
    onRemoveBranchOverride: (id: string) => void;
}) {
    const [addOpen, setAddOpen] = useState(false);
    const branchName = (id: string) =>
        branches.find(b => b.id === id)?.name ?? id;
    const usedBranchIds = new Set(overrides.map(o => o.branchId).filter(Boolean) as string[]);
    // Only active branches — an archived branch shouldn't accept new
    // overrides. Existing overrides on archived branches keep rendering.
    const eligibleBranches = branches.filter(
        b => b.status === "active" && !usedBranchIds.has(b.id),
    );
    return (
        <div className="bg-[#fafbff]">
            {overrides.map(o => (
                <MarketingOverrideRow
                    key={o.id}
                    override={o}
                    branchName={o.branchId ? branchName(o.branchId) : "—"}
                    waConnected={waConnected}
                    onChannelToggle={(ch, v) => onChannelToggle(o.id, ch, v)}
                    onLockHit={() => onLockHit(o.id)}
                    onEditTemplate={() => onEditTemplate(o)}
                    onManageTiming={() => onManageTiming(o)}
                    onRemove={() => onRemoveBranchOverride(o.id)}
                />
            ))}
            {eligibleBranches.length > 0 && (
                <div className="flex items-center gap-2 pl-11 pr-4 py-2 border-t border-dashed border-[#eaecf0]">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setAddOpen(o => !o)}
                            className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[13px] font-medium text-[#4b8c9a] hover:bg-white hover:text-[#306b78] transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Branch overrides
                        </button>
                        {addOpen && (
                            <div className="absolute left-0 top-full mt-1 z-10 bg-white border border-[#e4e7ec] rounded-lg shadow-lg py-1 min-w-[220px]">
                                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-[#98a2b3]">
                                    Add for branch
                                </div>
                                {eligibleBranches.map(b => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => {
                                            onAddBranchOverride(parent.id, b.id);
                                            setAddOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[#344054] hover:bg-[#f9fafb] text-left"
                                    >
                                        <MarkerPin01 className="w-4 h-4 text-[#667085]" />
                                        {b.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {overrides.length === 0 && (
                        <span className="text-[12px] text-[#98a2b3]">
                            Add a branch to customise this notification&apos;s channels + template for that location. Branches without an override inherit the settings above.
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function MarketingOverrideRow({
    override, branchName, waConnected,
    onChannelToggle, onLockHit, onEditTemplate, onManageTiming, onRemove,
}: {
    override: NotificationSetting;
    branchName: string;
    waConnected: boolean;
    onChannelToggle: (channel: "email" | "whatsapp" | "sms", enabled: boolean) => void;
    onLockHit: () => void;
    onEditTemplate: () => void;
    onManageTiming: () => void;
    onRemove: () => void;
}) {
    const showApprovalPill = waConnected;
    return (
        <div className="flex items-center gap-4 pl-11 pr-4 h-[48px] border-t border-dashed border-[#eaecf0]">
            <div className="flex-1 min-w-0 flex items-center gap-2 pl-5">
                <MarkerPin01 className="w-4 h-4 text-[#7ba08c] shrink-0" />
                <span className="text-[13px] text-[#344054] truncate">{branchName}</span>
                <span className="text-[11px] text-[#98a2b3] shrink-0">override</span>
            </div>
            <div className={cn(COL_EMAIL, "flex justify-center")}>
                <Toggle on={override.emailEnabled}
                    onChange={v => onChannelToggle("email", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`Email ${branchName}`} />
            </div>
            <div className={cn(COL_WA, "flex justify-center")}>
                <Toggle on={override.whatsappEnabled && waConnected}
                    disabled={!waConnected}
                    onChange={v => onChannelToggle("whatsapp", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`WhatsApp ${branchName}`} />
            </div>
            {showApprovalPill && (
                <div className={cn(COL_APPROVAL, "flex justify-center")}>
                    <ApprovalPill status={override.whatsappApprovalStatus} />
                </div>
            )}
            <div className={cn(COL_SMS, "flex justify-center")}>
                <Toggle on={override.smsEnabled}
                    onChange={v => onChannelToggle("sms", v)}
                    onLockedClick={onLockHit}
                    ariaLabel={`SMS ${branchName}`} />
            </div>
            <div className={cn(COL_SEND, "text-[13px] text-[#475467]")}>
                {override.sentDuringCampaigns ? "—" : formatSendTime(override)}
            </div>
            <div className={cn(COL_KEBAB, "flex items-center justify-center gap-1")}>
                <RowKebab onEditTemplate={onEditTemplate} onManageTiming={onManageTiming} />
                <button
                    type="button"
                    onClick={onRemove}
                    aria-label={`Remove ${branchName} override`}
                    className="w-7 h-7 flex items-center justify-center rounded hover:bg-[#f9fafb] text-[#98a2b3] hover:text-[#b42318] transition-colors"
                >
                    <Trash01 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ─── Column headers row ───────────────────────────────────────────────────

function ColumnHeaders({ waConnected }: { waConnected: boolean }) {
    return (
        <div className="flex items-center gap-4 pl-11 pr-4 h-[44px] bg-[#fafafa] border-t border-[#e4e7ec]">
            <div className="flex-1 min-w-0 text-[12px] font-medium text-[#475467]">Notifications</div>
            <div className={cn(COL_EMAIL, "text-center text-[12px] font-medium text-[#475467]")}>Email</div>
            <div className={cn(COL_WA, "flex items-center justify-center gap-1")}>
                <span className="text-[12px] font-medium text-[#475467]">WhatsApp</span>
                {!waConnected && (
                    <InfoTooltip content="Connect WhatsApp Business in Settings → Integrations to enable this channel." />
                )}
            </div>
            {waConnected && (
                <div className={cn(COL_APPROVAL, "text-center text-[12px] font-medium text-[#475467]")}>Approval status</div>
            )}
            <div className={cn(COL_SMS, "text-center text-[12px] font-medium text-[#475467]")}>SMS</div>
            <div className={cn(COL_SEND, "text-[12px] font-medium text-[#475467]")}>Send time</div>
            <div className={COL_KEBAB} />
        </div>
    );
}

// ─── Template editor modal (4 tabs) ────────────────────────────────────────

type TemplateTab = "email" | "whatsapp" | "sms" | "timing" | "condition";

function TemplateEditor({ ns, initialTab, onClose }: {
    ns: NotificationSetting;
    initialTab?: TemplateTab;
    onClose: () => void;
}) {
    const updateTemplate = useAppStore(s => s.updateNotificationTemplate);
    const updateTiming   = useAppStore(s => s.updateNotificationTiming);
    const setCritical    = useAppStore(s => s.setNotificationEventCritical);
    const showToast      = useAppStore(s => s.showToast);

    const [tab, setTab] = useState<TemplateTab>(initialTab ?? "email");

    // Local buffers — committed on Save template / Save timing / Save
    // condition. Every tab keeps its own draft so switching tabs never
    // wipes unsaved edits on another.
    const [emailSubject,     setEmailSubject]     = useState(ns.emailSubject ?? "");
    const [emailBody,        setEmailBody]        = useState(ns.emailTemplate ?? "");
    const [whatsappBody,     setWhatsappBody]     = useState(ns.whatsappTemplate ?? "");
    const [smsBody,          setSmsBody]          = useState(ns.smsTemplate ?? "");
    const [sendMode,         setSendMode]         = useState<NotificationSendMode>(ns.sendMode);
    const [sendOffsets,      setSendOffsets]      = useState<NotificationSendOffset[]>(
        ns.sendOffsets.length > 0 ? ns.sendOffsets.map(o => ({ ...o })) : [{ value: 0, unit: "hours" }],
    );
    // Condition tab draft — mirrors the row's current `isCritical`.
    // Payments seeded true; anything else defaults false but can now be
    // flipped by admin (Figma 7808:58413).
    const [isCritical,       setIsCritical]       = useState<boolean>(ns.isCritical);

    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    function insertVariable(target: "email" | "whatsapp" | "sms", token: string) {
        if (target === "email") setEmailBody(prev => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token} `);
        if (target === "whatsapp") setWhatsappBody(prev => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token} `);
        if (target === "sms") setSmsBody(prev => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token} `);
    }

    function handleSaveTemplate() {
        if (tab === "email") {
            updateTemplate(ns.id, { emailSubject: emailSubject.trim(), emailTemplate: emailBody.trim() });
            showToast("Template saved", `${ns.label} email template updated.`, "success", "check");
        } else if (tab === "whatsapp") {
            // Both sides trimmed so a no-op save doesn't spuriously
            // fire the "resubmitted to Meta" toast if the seed body
            // ever picks up trailing whitespace.
            const bodyChanged = whatsappBody.trim() !== (ns.whatsappTemplate ?? "").trim();
            updateTemplate(ns.id, { whatsappTemplate: whatsappBody.trim() });
            if (bodyChanged) {
                showToast(
                    "Template resubmitted",
                    `WhatsApp changes sent to Meta for approval — usually within 24 hours.`,
                    "success", "check",
                );
            } else {
                showToast("Template saved", `${ns.label} WhatsApp template updated.`, "success", "check");
            }
        } else if (tab === "sms") {
            updateTemplate(ns.id, { smsTemplate: smsBody.trim() });
            showToast("Template saved", `${ns.label} SMS template updated.`, "success", "check");
        }
        onClose();
    }

    /** Cleaned offsets = strictly-positive values. In "immediately"
     *  mode the array is emptied. In "scheduled" mode we DON'T save if
     *  no valid offsets survive — that ghost state (mode = scheduled,
     *  offsets = []) reads as "Immediately" on the landing but stores
     *  scheduled, which is a lie. `timingCanSave` gates the Save
     *  button so users have to add a real time first. */
    const cleanedOffsets = useMemo(
        () => sendMode === "immediately" ? [] : sendOffsets.filter(o => o.value > 0),
        [sendMode, sendOffsets],
    );
    const timingCanSave = sendMode === "immediately" || cleanedOffsets.length > 0;

    function handleSaveTiming() {
        if (!timingCanSave) return;
        updateTiming(ns.id, { sendMode, sendOffsets: cleanedOffsets });
        showToast("Timing saved", `${ns.label} send timing updated.`, "success", "check");
        onClose();
    }

    function handleSaveCondition() {
        // No-op when the draft matches the store (avoids a spurious
        // toast when admin opens the tab, doesn't change anything, and
        // clicks Save).
        if (isCritical === ns.isCritical) {
            onClose();
            return;
        }
        // If admin turned critical ON while every channel was off, the
        // store auto-enables Email (default primary channel) so the
        // "one channel stays on" contract holds. Detect that here so the
        // toast tells the admin exactly what happened.
        const noChannelBefore = !ns.emailEnabled && !ns.whatsappEnabled && !ns.smsEnabled;
        const autoEnabledEmail = isCritical && noChannelBefore;
        setCritical(ns.id, isCritical);
        showToast(
            isCritical ? `${ns.label} is now critical` : `${ns.label} no longer critical`,
            isCritical
                ? autoEnabledEmail
                    ? "Email was enabled as the required delivery channel — at least one channel must stay on."
                    : "At least one delivery channel must stay enabled from now on."
                : "Any channel can be turned off for this event.",
            "success", "check",
        );
        onClose();
    }

    if (typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            {/* Fixed height so switching tabs never shrinks the modal —
             *  Email/WhatsApp/SMS tabs are tallest (preview + send-test),
             *  Manage timing is shortest. `h-[720px]` sits the modal at
             *  the tallest tab's natural size on desktop and gets
             *  capped by `max-h-[90vh]` on smaller windows. Body area
             *  keeps its own scroll so overflowing content stays
             *  reachable without changing the frame. */}
            <div className="relative bg-white rounded-[16px] w-[720px] max-w-full h-[720px] max-h-[90vh] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col overflow-hidden">
                {/* Header — Condition tab uses its own title + subtitle
                    per Figma 7808:58413; the other four tabs share the
                    template-editor copy. */}
                <div className="flex items-start gap-4 px-6 py-5 border-b border-[#e4e7ec] shrink-0">
                    <div className="flex-1 flex flex-col gap-1">
                        <h3 className="text-[18px] font-semibold text-[#101828] leading-[28px]">
                            {tab === "condition"
                                ? "Notification conditions"
                                : `Edit template — ${ns.label}`}
                        </h3>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            {tab === "condition" ? (
                                "Manage when we push the reminder."
                            ) : (
                                <>Customize the copy sent to customers for this event. Variables in <span className="text-[#6941c6]">{"{curly_braces}"}</span> are replaced at send time.</>
                            )}
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Tabs (underline) */}
                <div className="border-b border-[#e4e7ec] px-6 shrink-0">
                    <div className="flex gap-1">
                        {(["email", "whatsapp", "sms", "timing", "condition"] as const).map(k => (
                            <button key={k} type="button" onClick={() => setTab(k)}
                                className={cn(
                                    "h-[44px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                    tab === k
                                        ? "border-b-2 border-[#101828] text-[#101828]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}>
                                {k === "email"     ? "Email"
                               : k === "whatsapp"  ? "WhatsApp"
                               : k === "sms"       ? "SMS"
                               : k === "timing"    ? "Manage timing"
                               :                     "Condition"}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {tab === "email" && (
                        <EmailTab
                            subject={emailSubject} onSubjectChange={setEmailSubject}
                            body={emailBody}       onBodyChange={setEmailBody}
                            onInsertVariable={token => insertVariable("email", token)}
                        />
                    )}
                    {tab === "whatsapp" && (
                        <WhatsappTab
                            status={ns.whatsappApprovalStatus}
                            rejectionReason={ns.whatsappRejectionReason}
                            body={whatsappBody} onBodyChange={setWhatsappBody}
                            onInsertVariable={token => insertVariable("whatsapp", token)}
                        />
                    )}
                    {tab === "sms" && (
                        <SmsTab
                            body={smsBody} onBodyChange={setSmsBody}
                            onInsertVariable={token => insertVariable("sms", token)}
                        />
                    )}
                    {tab === "timing" && (
                        <TimingTab
                            mode={sendMode} onModeChange={setSendMode}
                            offsets={sendOffsets} onOffsetsChange={setSendOffsets}
                        />
                    )}
                    {tab === "condition" && (
                        <ConditionTab
                            isCritical={isCritical}
                            onChange={setIsCritical}
                        />
                    )}
                </div>

                {/* Footer */}
                <div className="border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3 shrink-0">
                    <div />
                    <div className="flex items-center gap-3">
                        <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                        {tab === "timing" ? (
                            <Button variant="primary" size="md" onClick={handleSaveTiming}
                                disabled={!timingCanSave}>
                                <span className="flex items-center gap-2"><Check className="w-4 h-4" />Save timing</span>
                            </Button>
                        ) : tab === "condition" ? (
                            <Button variant="primary" size="md" onClick={handleSaveCondition}>
                                <span className="flex items-center gap-2"><Check className="w-4 h-4" />Save changes</span>
                            </Button>
                        ) : (
                            <Button variant="primary" size="md" onClick={handleSaveTemplate}>
                                <span className="flex items-center gap-2"><Check className="w-4 h-4" />Save template</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

// ─── Template tab bodies ───────────────────────────────────────────────────

function VariableRail({ onInsert }: { onInsert: (token: string) => void }) {
    return (
        <div className="flex flex-col gap-2 w-[200px] shrink-0">
            <p className="text-[13px] font-medium text-[#344054]">Variables — drag into the field</p>
            <div className="flex flex-wrap gap-2 p-3 border-1 border-[#e4e7ec] rounded-[8px] bg-[#fafafa]">
                {TEMPLATE_VARIABLES.map(v => (
                    <button key={v} type="button" onClick={() => onInsert(v)}
                        title="Click to insert at cursor"
                        className="inline-flex items-center px-2 py-1 rounded-[8px] border-1 border-[#e9d7fe] bg-[#f4ebff] text-[12px] font-medium text-[#6941c6] hover:bg-[#e9d7fe] transition-colors">
                        {v}
                    </button>
                ))}
            </div>
        </div>
    );
}

function CaseSensitiveHint() {
    return (
        <div className="bg-[#f5fffa] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 flex items-start gap-3">
            <Lightbulb02 className="w-5 h-5 text-[#658774] shrink-0 mt-0.5" />
            <p className="text-[13px] text-[#475467] leading-[18px]">
                Variables are case-sensitive. Anything that doesn't match a known variable is left in the message as-is.
            </p>
        </div>
    );
}

function EmailTab({ subject, onSubjectChange, body, onBodyChange, onInsertVariable }: {
    subject: string; onSubjectChange: (v: string) => void;
    body: string;    onBodyChange: (v: string) => void;
    onInsertVariable: (token: string) => void;
}) {
    return (
        <>
            <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-[#344054]">Subject line</span>
                        <input value={subject} onChange={e => onSubjectChange(e.target.value)}
                            className="h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]" />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-[#344054]">Email body</span>
                        <textarea value={body} onChange={e => onBodyChange(e.target.value)}
                            rows={8}
                            className="px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] resize-y font-mono" />
                    </label>
                </div>
                <VariableRail onInsert={onInsertVariable} />
            </div>
            <CaseSensitiveHint />
            <PreviewCard label="Preview (with sample data)" body={renderSample(subject, body, "email")} />
            <SendTestRow kind="email" />
        </>
    );
}

function WhatsappTab({ status, rejectionReason, body, onBodyChange, onInsertVariable }: {
    status: WhatsappApprovalStatus;
    rejectionReason?: string;
    body: string; onBodyChange: (v: string) => void;
    onInsertVariable: (token: string) => void;
}) {
    return (
        <>
            <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-[#344054]">Approval status</span>
                <ApprovalPill status={status} />
            </div>

            {status === "pending" && (
                <div className="bg-[#fffaeb] border-1 border-[#fedf89] rounded-[12px] p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#b54708] shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[#93370d] leading-[18px]">
                        Awaiting Meta approval — this template can't be sent until approved (usually within 24 hours), and customers will receive another enabled channel instead.
                    </p>
                </div>
            )}
            {status === "rejected" && (
                <div className="bg-[#fef3f2] border-1 border-[#fecdca] rounded-[12px] p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-[#b42318] shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-1">
                        <p className="text-[13px] text-[#912018] leading-[18px]">
                            Meta rejected this template — review the template, make the necessary changes, and resubmit it for approval.
                        </p>
                        {rejectionReason && (
                            <p className="text-[13px] text-[#912018] leading-[18px]">
                                <span className="font-semibold">Reason:</span> {rejectionReason}
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-[#344054]">WhatsApp message</span>
                        <textarea value={body} onChange={e => onBodyChange(e.target.value)}
                            rows={7}
                            className="px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] resize-y font-mono" />
                    </label>
                    <p className="text-[12px] text-[#667085]">Plain text only — emojis are fine, rich formatting isn't.</p>
                </div>
                <VariableRail onInsert={onInsertVariable} />
            </div>
            <CaseSensitiveHint />
            <PreviewCard label="Preview (with sample data)" body={renderSample("", body, "whatsapp")} />
            <SendTestRow kind="phone" />
        </>
    );
}

function SmsTab({ body, onBodyChange, onInsertVariable }: {
    body: string; onBodyChange: (v: string) => void;
    onInsertVariable: (token: string) => void;
}) {
    const chars = body.length;
    const segments = Math.max(1, Math.ceil(chars / 160));
    return (
        <>
            <div className="flex gap-4">
                <div className="flex-1 flex flex-col gap-2">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-medium text-[#344054]">SMS message</span>
                        <textarea value={body} onChange={e => onBodyChange(e.target.value)}
                            rows={7}
                            className="px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] resize-y font-mono" />
                    </label>
                    <p className="text-[12px] text-[#667085]">
                        {chars}/160 characters ({segments} message{segments === 1 ? "" : "s"})
                    </p>
                </div>
                <VariableRail onInsert={onInsertVariable} />
            </div>
            <CaseSensitiveHint />
            <PreviewCard label="Preview (with sample data)" body={renderSample("", body, "sms")} />
            <SendTestRow kind="phone" />
        </>
    );
}

function TimingTab({ mode, onModeChange, offsets, onOffsetsChange }: {
    mode: NotificationSendMode; onModeChange: (m: NotificationSendMode) => void;
    offsets: NotificationSendOffset[]; onOffsetsChange: (next: NotificationSendOffset[]) => void;
}) {
    function updateOffset(i: number, patch: Partial<NotificationSendOffset>) {
        onOffsetsChange(offsets.map((o, idx) => idx === i ? { ...o, ...patch } : o));
    }
    function removeOffset(i: number) {
        onOffsetsChange(offsets.filter((_, idx) => idx !== i));
    }
    function addOffset() {
        onOffsetsChange([...offsets, { value: 0, unit: "hours" }]);
    }
    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-[#344054]">When to send</span>
                <div className="grid grid-cols-2 gap-3">
                    <TimingRadioCard
                        title="Immediately"
                        subtitle="Send the notification as soon as it's triggered."
                        selected={mode === "immediately"}
                        onSelect={() => onModeChange("immediately")}
                    />
                    <TimingRadioCard
                        title="Manage send time"
                        subtitle="Choose when the notification should be sent."
                        selected={mode === "scheduled"}
                        onSelect={() => onModeChange("scheduled")}
                    />
                </div>
            </div>

            {mode === "scheduled" && (
                <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-medium text-[#344054]">Send time</span>
                    {offsets.every(o => o.value <= 0) && (
                        <p className="text-[12px] text-[#b54708] leading-[16px]">
                            Add at least one send time above 0 — Save is disabled until a real offset is set.
                        </p>
                    )}
                    <div className="flex flex-col gap-3">
                        {offsets.map((o, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <div className="flex-1 flex items-stretch h-10 border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]">
                                    <input
                                        type="number" min={0} inputMode="numeric"
                                        aria-label="Send time value"
                                        value={o.value === 0 ? "" : o.value}
                                        placeholder="Select time"
                                        onChange={e => {
                                            const raw = e.target.value;
                                            if (raw === "") { updateOffset(i, { value: 0 }); return; }
                                            const parsed = parseInt(raw.replace(/^0+(?=\d)/, ""), 10);
                                            if (!Number.isNaN(parsed)) updateOffset(i, { value: parsed });
                                        }}
                                        className="flex-1 min-w-0 px-3 text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent"
                                    />
                                    <UnitSuffixSelect
                                        value={o.unit}
                                        onChange={v => updateOffset(i, { unit: v as "minutes" | "hours" | "days" })}
                                        options={OFFSET_UNIT_OPTIONS}
                                    />
                                </div>
                                <button type="button" onClick={() => removeOffset(i)}
                                    className="w-10 h-10 flex items-center justify-center rounded-[8px] border-1 border-[#fecdca] text-[#b42318] hover:bg-[#fef3f2] transition-colors shrink-0"
                                    aria-label="Remove send time">
                                    <Trash01 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                    <Button variant="secondary-gray" size="md" leftIcon={<span className="text-[14px]">+</span>}
                        onClick={addOffset}>Add send time</Button>
                </div>
            )}
        </div>
    );
}

// ─── Condition tab (Figma 7808:58413) ──────────────────────────────────────
//
// Flip the "Notification is critical" flag on the current event. Critical
// rows enforce the "at least one channel stays enabled" contract (already
// wired in `setNotificationEventChannel` in the store — the guard reads
// `row.isCritical`, no payment-specific check). This tab is the single
// surface where admin can extend the critical treatment beyond Payments.
function ConditionTab({ isCritical, onChange }: {
    isCritical: boolean;
    onChange: (next: boolean) => void;
}) {
    return (
        <div className="flex flex-col gap-4">
            <div
                className={cn(
                    "rounded-[12px] border-1 px-4 py-3 flex items-start gap-4 transition-colors",
                    isCritical ? "border-[#7ba08c] bg-white" : "border-[#e4e7ec] bg-white",
                )}
            >
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">
                        Notification is critical
                    </p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">
                        At least one delivery channel must remain enabled for critical notifications.
                    </p>
                </div>
                <Toggle
                    on={isCritical}
                    onChange={onChange}
                    ariaLabel="Mark this notification as critical"
                />
            </div>
        </div>
    );
}

function TimingRadioCard({ title, subtitle, selected, onSelect }: {
    title: string; subtitle: string; selected: boolean; onSelect: () => void;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "text-left rounded-[12px] border-1 p-4 flex items-start gap-3 transition-colors bg-white",
                selected ? "border-[#7ba08c]" : "border-[#e4e7ec] hover:border-[#d0d5dd]",
            )}>
            <div className="shrink-0 w-9 h-9 rounded-[8px] bg-[#f5fffa] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#658774]" />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[13px] text-[#667085] leading-[18px]">{subtitle}</p>
            </div>
            <div className={cn(
                "w-4 h-4 rounded-full border-1 flex items-center justify-center shrink-0 mt-0.5",
                selected ? "border-[#658774] bg-[#658774]" : "border-[#d0d5dd] bg-white",
            )}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

function PreviewCard({ label, body }: { label: string; body: string }) {
    return (
        <div className="border-1 border-[#e4e7ec] rounded-[12px] bg-[#fafafa] p-4 flex flex-col gap-2">
            <p className="text-[13px] font-medium text-[#344054]">{label}</p>
            <p className="text-[13px] text-[#475467] leading-[20px] whitespace-pre-wrap">{body || "—"}</p>
        </div>
    );
}

function SendTestRow({ kind }: { kind: "email" | "phone" }) {
    // For the phone case we reuse the customer-creation phone picker
    // (PhoneCountryDropdown + numeric input) so admins see the same
    // dial-code selector, flag, and menu behaviour they use everywhere
    // else. Seed value 55 200 2003 sits under +971 by default.
    const initialPhone = useMemo(() => splitPhone("+971 55 200 2003"), []);
    const [emailValue,   setEmailValue]   = useState("jonathan@email.com");
    const [phoneNumber,  setPhoneNumber]  = useState(initialPhone.number);
    const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(initialPhone.country);
    const showToast = useAppStore(s => s.showToast);

    const displayValue = kind === "email"
        ? emailValue
        : phoneNumber ? `${phoneCountry.dial} ${phoneNumber}` : phoneCountry.dial;

    // Layout: label spans the full card width as a heading; input +
    // button share a single row below. Both are h-10, so they naturally
    // sit on the same baseline — no `self-center` acrobatics needed
    // and the button reads as belonging to the input it acts on.
    return (
        <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[#344054]">Send a test to yourself</span>
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                    {kind === "email" ? (
                        <input value={emailValue} onChange={e => setEmailValue(e.target.value)}
                            className="w-full h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                    ) : (
                        <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                            <PhoneCountryDropdown value={phoneCountry} onChange={setPhoneCountry} />
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                                placeholder="Phone number..."
                                className="flex-1 h-10 px-[14px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent rounded-r-[8px]"
                            />
                        </div>
                    )}
                </div>
                <Button variant="secondary-gray" size="md" leftIcon={<Send03 className="w-4 h-4" />}
                    className="shrink-0"
                    onClick={() => showToast("Test sent", `Test dispatched to ${displayValue}.`, "success", "check")}>
                    Send test
                </Button>
            </div>
        </div>
    );
}

/** Substitute a fixed set of demo variables so the preview reads real. */
function renderSample(subject: string, body: string, _channel: "email" | "whatsapp" | "sms"): string {
    const dict: Record<string, string> = {
        "{member_name}":     "Aliah Lane",
        "{class_name}":      "Reformer Pilates",
        "{class_date}":      "Mar 14",
        "{class_time}":      "9:00 AM",
        "{instructor_name}": "Maya Johnson",
        "{branch_name}":     "Forma Studio (South)",
        "{credits_remaining}": "8",
        "{expiry_date}":     "Aug 20",
        "{package_name}":    "10-Class Pack",
        "{booking_id}":      "BKG-3421",
        "{studio_name}":     "Forma Studio",
        // Gift card purchase event — sample values match a realistic
        // recipient email preview (Priya being gifted a card by Aliah).
        "{gift_card_code}":   "GC-2026-8QHXKM",
        "{gift_card_amount}": "500",
        "{sender_name}":      "Aliah Lane",
        "{recipient_name}":   "Priya Ramesh",
        "{gift_message}":     "Happy birthday! Enjoy the classes 🎁",
    };
    let out = [subject, body].filter(Boolean).join("\n\n");
    for (const [token, val] of Object.entries(dict)) {
        out = out.split(token).join(val);
    }
    return out;
}

// ─── Delivery hours side-panel ─────────────────────────────────────────────

function DeliveryHoursPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
    const delivery = useAppStore(s => s.notificationDeliverySettings);
    const update   = useAppStore(s => s.updateNotificationDeliverySettings);
    const showToast = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);
    const [onlyDuringHours,  setOnlyDuringHours]  = useState(delivery.onlySendDuringSetHours);
    const [start,            setStart]            = useState(delivery.quietHoursStart);
    const [end,              setEnd]              = useState(delivery.quietHoursEnd);
    const [criticalBypass,   setCriticalBypass]   = useState(delivery.criticalBypassesQuietHours);

    useEffect(() => {
        if (open) {
            setOnlyDuringHours(delivery.onlySendDuringSetHours);
            setStart(delivery.quietHoursStart);
            setEnd(delivery.quietHoursEnd);
            setCriticalBypass(delivery.criticalBypassesQuietHours);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, delivery]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    function handleSave() {
        update({
            onlySendDuringSetHours:      onlyDuringHours,
            quietHoursStart:             start,
            quietHoursEnd:               end,
            criticalBypassesQuietHours:  criticalBypass,
        });
        showToast("Delivery hours updated", "The new quiet-window rules are live.", "success", "check");
        onClose();
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className={cn(
                "absolute inset-0 bg-[#0c111d]/60 transition-opacity duration-300 ease-out",
                shown ? "opacity-100" : "opacity-0",
            )} onClick={onClose} />
            <div className={cn(
                "relative bg-white rounded-[16px] w-[720px] max-w-full shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col overflow-hidden",
                "transition-opacity duration-300",
                shown ? "opacity-100" : "opacity-0",
            )}>
                <div className="flex items-start gap-4 px-6 py-5 border-b border-[#e4e7ec] shrink-0">
                    <div className="flex-1 flex flex-col gap-1">
                        <h3 className="text-[18px] font-semibold text-[#101828] leading-[28px]">Delivery hours</h3>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Set quiet hours
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Merged "quiet hours" row — the previous design split
                        this into 3 rows (Only send during set hours ·
                        Quiet hours · Critical bypass) with two dividers,
                        which read as unrelated settings. Client Jul 2026
                        feedback: the modal title already says "Delivery
                        hours" so the on/off toggle + the time window can
                        collapse to a single line ("Pause messages between
                        [start] and [end]"). Times gray out with the
                        toggle. */}
                    <div className="flex items-start gap-4">
                        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-semibold text-[#101828] leading-[20px]">Pause messages between</span>
                                <div className={cn("flex items-center gap-2", !onlyDuringHours && "opacity-40 pointer-events-none")}>
                                    <TimeDropdown value={start} onChange={setStart} ariaLabel="Quiet hours start" />
                                    <span className="text-[14px] text-[#475467]">and</span>
                                    <TimeDropdown value={end}   onChange={setEnd}   ariaLabel="Quiet hours end" />
                                </div>
                            </div>
                            <p className="text-[13px] text-[#667085] leading-[18px]">
                                Messages queued in this window send when it ends.
                            </p>
                        </div>
                        <Toggle on={onlyDuringHours} onChange={setOnlyDuringHours} ariaLabel="Pause messages during quiet hours" />
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex items-start gap-4">
                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                            <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">Critical notifications ignore quiet hours</p>
                        </div>
                        <Toggle on={criticalBypass} onChange={setCriticalBypass} ariaLabel="Critical bypass" />
                    </div>
                </div>

                <div className="border-t border-[#e4e7ec] px-6 py-4 flex justify-between gap-3 shrink-0">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** Quiet-hours picker. Uses our FixedDropdown pattern instead of the
 *  native `<input type="time">` so the surface matches every other
 *  select in the app (Booking window, Waitlist, etc.). Options are the
 *  48 half-hour slots of a 24-hour day — enough granularity for a
 *  quiet-window without a wall of 96 minute-quarters. */
const TIME_SLOTS: string[] = (() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
        for (const m of [0, 30]) {
            out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
        }
    }
    return out;
})();

function TimeDropdown({ value, onChange, ariaLabel }: {
    value: string;
    onChange: (v: string) => void;
    ariaLabel: string;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);

    // If the stored value isn't in the seeded 30-minute grid (e.g. an
    // older payload with 21:15), keep it as a valid option so the
    // trigger still shows the selected label.
    const options = useMemo(
        () => (TIME_SLOTS.includes(value) ? TIME_SLOTS : [value, ...TIME_SLOTS]),
        [value],
    );

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                aria-label={ariaLabel}
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "flex items-stretch h-10 w-[160px] border-1 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white overflow-hidden transition-colors",
                    open ? "border-[#7ba08c] ring-2 ring-[#aad4bd]" : "border-[#d0d5dd] hover:border-[#98a2b3]",
                )}
            >
                <span className="px-2 flex items-center border-r border-[#d0d5dd] bg-[#f9fafb] shrink-0">
                    <Clock className="w-4 h-4 text-[#667085]" />
                </span>
                <span className="flex-1 min-w-0 px-3 flex items-center text-[14px] text-[#101828] text-left">{value}</span>
                <span className="pr-2 flex items-center">
                    <ChevronDown className={cn("w-4 h-4 text-[#667085] transition-transform", open && "rotate-180")} />
                </span>
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={160}>
                <div className="max-h-[264px] overflow-y-auto scrollbar-hide py-1">
                    {options.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => { onChange(t); setOpen(false); }}
                            className={cn(
                                "w-full flex items-center px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                t === value
                                    ? "bg-[#f9fafb] text-[#101828]"
                                    : "text-[#344054] hover:bg-[#f9fafb]",
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </FixedDropdown>
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CustomerNotificationsPage() {
    const settings     = useAppStore(s => s.notificationSettings);
    const integrations = useAppStore(s => s.integrations);
    const delivery     = useAppStore(s => s.notificationDeliverySettings);
    const setChannel   = useAppStore(s => s.setNotificationEventChannel);
    const showToast    = useAppStore(s => s.showToast);
    const customers    = useAppStore(s => s.customers);
    // Client 2026-07-20: per-branch marketing overrides. `branches` feeds
    // the "+ Add branch override" dropdown; the add/remove actions
    // mutate `notificationSettings` in place (new rows have `branchId`
    // set — parent lookup is by shared `notificationType`).
    const branches                    = useAppStore(s => s.branches);
    const addMarketingBranchOverride  = useAppStore(s => s.addMarketingBranchOverride);
    const removeMarketingBranchOverride = useAppStore(s => s.removeMarketingBranchOverride);

    /** Marketing-opt-in count for the info banner under the Marketing
     *  group. Deliverable = non-archived customers (active + inactive);
     *  archived rows are gone from the CRM and can't receive anything.
     *  A deliverable customer is "opted in" when at least one marketing
     *  TOPIC is enabled AND at least one DELIVERABLE CHANNEL is enabled.
     *
     *  Push is deliberately EXCLUDED from the channel test — the 4
     *  marketing notification rows all ship on Email / WhatsApp / SMS
     *  only (v27 dropped Push, see notification_settings.ts header).
     *  A customer who opted into Push + a topic but nothing else has
     *  no reachable channel for marketing, so they don't count.
     *
     *  This banner is the only user-visible read of the join today;
     *  when the marketing campaigns module's dispatch layer lands, it
     *  should apply the SAME predicate so send counts agree with this
     *  banner. */
    const { marketingOptedIn, marketingTotal } = useMemo(() => {
        let total = 0;
        let optedIn = 0;
        for (const c of customers) {
            if (c.status === "archived") continue;
            total++;
            const hasTopic =
                !!c.marketingTopicStudioAnnouncements ||
                !!c.marketingTopicNewClassLaunch      ||
                !!c.marketingTopicSpecialOffers       ||
                !!c.marketingTopicPromoCodeOffers;
            const hasChannel =
                !!c.marketingChannelEmail    ||
                !!c.marketingChannelWhatsapp ||
                !!c.marketingChannelSms;
            if (hasTopic && hasChannel) optedIn++;
        }
        return { marketingOptedIn: optedIn, marketingTotal: total };
    }, [customers]);

    /** WhatsApp channel is available only when the integration is
     *  connected in Settings → Integrations. Cross-module live-join. */
    const whatsappConnected = useMemo(() => {
        const wa = integrations.find(i => i.slug === "whatsapp_business");
        return wa?.status === "connected";
    }, [integrations]);

    const [openGroups, setOpenGroups] = useState<Record<NotificationCategory, boolean>>({
        booking: true, payment: true, package_membership: true, marketing: true, referral: true,
    });
    function toggleGroup(cat: NotificationCategory) {
        setOpenGroups(g => ({ ...g, [cat]: !g[cat] }));
    }

    const [templateEditor, setTemplateEditor] = useState<
        | { ns: NotificationSetting; initialTab?: TemplateTab }
        | null
    >(null);
    const [deliveryOpen, setDeliveryOpen] = useState(false);

    // Only PARENT rows land in each section — branch overrides (any row
    // with `branchId` set) are hidden from the top-level list and
    // rendered as children under their parent by the Section component.
    const byCategory = useMemo(() => {
        const grouped: Record<NotificationCategory, NotificationSetting[]> = {
            booking: [], payment: [], package_membership: [], marketing: [], referral: [],
        };
        for (const n of settings) {
            if (n.branchId) continue;
            grouped[n.category].push(n);
        }
        return grouped;
    }, [settings]);

    /** Shared "critical row is locked" toast — same body/tone whether
     *  the block came from clicking a locked-on toggle (mouse path) or
     *  from the store guard returning `false` (keyboard / AT path). */
    function firePaymentLockToast(id: string) {
        const row = settings.find(n => n.id === id);
        if (!row) return;
        showToast(
            `"${row.label}" is critical`,
            "We can't turn the toggle off, we must keep at least one channel on.",
            "warning",
            "alert",
        );
    }

    function handleChannelToggle(id: string, channel: "email" | "whatsapp" | "sms", enabled: boolean) {
        // WhatsApp toggles are inert when the integration isn't connected.
        if (channel === "whatsapp" && !whatsappConnected) return;
        const ok = setChannel(id, channel, enabled);
        if (!ok) {
            // Store returned false: caller tried to disable the LAST
            // enabled channel on a critical (payment) row. Payment rows
            // ALSO lock the last-remaining ON toggle at the UI level
            // (see `EventRow`), which routes clicks through
            // `firePaymentLockToast` directly. This branch is the safety
            // net for keyboard / assistive-tech paths that bypass the
            // visual lock.
            firePaymentLockToast(id);
        }
    }

    return (
        <div className="flex flex-col gap-4 max-w-[1100px]">
            {/* Single unified card — page title + toolbar sit above the
             *  column header row, with the table body below. Divider
             *  bars come from the border-t on `ColumnHeaders` and each
             *  `Section` so we don't stack extra rules. */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {/* Top strip — title + Quiet hours pill + Delivery hours button */}
                <div className="flex items-start gap-4 px-6 py-5">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Customer notifications</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            Choose which channels each message goes out on, and edit the copy your customers receive.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <Pill tone="blue">
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                Quiet hours {delivery.quietHoursStart}-{delivery.quietHoursEnd}
                            </span>
                        </Pill>
                        <Button variant="secondary-gray" size="md"
                            leftIcon={<Clock className="w-4 h-4" />}
                            onClick={() => setDeliveryOpen(true)}>
                            Delivery hours
                        </Button>
                    </div>
                </div>

                {/* Column headers row + collapsible category sections */}
                <ColumnHeaders waConnected={whatsappConnected} />
                {CATEGORY_ORDER.map(cat => (
                    <Section
                        key={cat}
                        category={cat}
                        items={byCategory[cat]}
                        open={openGroups[cat]}
                        onToggle={() => toggleGroup(cat)}
                        waConnected={whatsappConnected}
                        onChannelToggle={handleChannelToggle}
                        onLockHit={firePaymentLockToast}
                        onEditTemplate={ns => setTemplateEditor({ ns })}
                        onManageTiming={ns => setTemplateEditor({ ns, initialTab: "timing" })}
                        marketingOptedIn={marketingOptedIn}
                        marketingTotal={marketingTotal}
                        branches={branches}
                        allSettings={settings}
                        onAddBranchOverride={addMarketingBranchOverride}
                        onRemoveBranchOverride={removeMarketingBranchOverride}
                    />
                ))}
            </div>

            {templateEditor && (
                <TemplateEditor
                    ns={templateEditor.ns}
                    initialTab={templateEditor.initialTab}
                    onClose={() => setTemplateEditor(null)}
                />
            )}
            <DeliveryHoursPanel open={deliveryOpen} onClose={() => setDeliveryOpen(false)} />

            <Toast />
        </div>
    );
}
