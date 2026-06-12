"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail page (full-page screen)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 2481:18279 (detail + Plan tab) + 5852/6248/6249 (plan modals).
//
// Layout: a left side panel (customer summary, credit balance, customer
// actions) + a right card with the tab strip. The "Plan" tab is fully built —
// a plan-history table with row actions: Freeze / Unfreeze / Cancel plan /
// Remove free credit / View details. The other tabs are placeholders pending
// their own briefs.
//
// State source of truth: useAppStore(s => s.customerPlans). Every action flows
// through the store so the table, the credit balance and the customer list
// all re-render in the same cycle. Every action emits a toast.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose, SearchMd, FilterLines, DotsVertical, ChevronLeft,
    Edit02, HeartHand, Archive, SlashCircle01, RefreshCcw01, Check, AlignLeft,
    CreditCard02, Package, Gift01, PauseCircle, PlayCircle, XCircle, Lightbulb02,
    Trash02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore, type Customer, type CustomerPlan } from "@/lib/store";
import { CustomerBookingsTab } from "./CustomerBookingsTab";
import { CustomerPaymentsTab } from "./CustomerPaymentsTab";
import { CustomerDetailsTab } from "./CustomerDetailsTab";
import { CustomerAgreementsTab } from "./CustomerAgreementsTab";
import { CustomerReferralsTab } from "./CustomerReferralsTab";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = ["Plan", "Bookings", "Payments", "Details", "Agreements", "Referrals"] as const;
type TabId = typeof TABS[number];

type PlanStatus = CustomerPlan["status"];
type PlanKind = CustomerPlan["kind"];

const CREDIT_VALUE_AED = 100;

const CANCEL_REASONS = [
    "Customer request",
    "Relocating",
    "Financial reasons",
    "Switching plan",
];
const REMOVE_REASONS = [
    "Issued to wrong customer",
    "Duplicate complimentary",
    "Unauthorized complimentary",
];

// ─── Date helpers (UTC-anchored) ─────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Mar 28, 2026" — accepts date-only ISO or full timestamps. */
function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "2026-03-28, 10:00 PM" — the Plan-tab expiry column format. */
function fmtDateTime(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${h}:${min} ${ampm}`;
}

/** Whole days between two ISO dates. */
function daysBetween(fromISO: string, toISO: string): number {
    const a = new Date(`${fromISO.slice(0, 10)}T00:00:00Z`).getTime();
    const b = new Date(`${toISO.slice(0, 10)}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
}

/** Add `days` to an ISO datetime, preserving the time-of-day. */
function addDaysISO(iso: string, days: number): string {
    return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString();
}

/** Leading integer in a credits label ("10 credits" → 10, "Unlimited" → 0). */
function parseCredits(label: string): number {
    const m = label.match(/\d+/);
    return m ? Number(m[0]) : 0;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function CustomerStatusBadge({ status }: { status: Customer["status"] }) {
    const styles: Record<Customer["status"], string> = {
        active: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        archived: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium", styles[status])}>
            {label}
        </span>
    );
}

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
    active: "Active", expired: "Expired", frozen: "Frozen", cancelled: "Cancelled", removed: "Removed",
};

function PlanStatusBadge({ status }: { status: PlanStatus }) {
    const styles: Record<PlanStatus, string> = {
        active: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        expired: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        frozen: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        cancelled: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        removed: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {PLAN_STATUS_LABEL[status]}
        </span>
    );
}

function RoleBadge({ role }: { role: string }) {
    return (
        <span className="inline-flex items-center px-[6px] py-[2px] rounded-full text-[12px] font-medium bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3] whitespace-nowrap">
            {role}
        </span>
    );
}

// ─── Plan kind icon ───────────────────────────────────────────────────────────

function PlanIcon({ kind }: { kind: PlanKind }) {
    const Icon = kind === "membership" ? CreditCard02 : kind === "package" ? Package : Gift01;
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#475467]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ width = "w-[480px]", title, subtitle, onClose, children, footer }: {
    width?: string;
    title: string;
    subtitle: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className={cn("relative bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden max-h-[90vh]", width)}>
                <div className="relative shrink-0">
                    <button type="button" onClick={onClose}
                        className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                    <div className="flex flex-col gap-1 px-6 pt-6 pb-5 pr-14">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-4">
                    {children}
                </div>
                {footer && (
                    <div className="shrink-0">
                        <div className="h-px w-full bg-[#e4e7ec]" />
                        <div className="px-6 pt-6 pb-6 flex gap-3">{footer}</div>
                    </div>
                )}
            </div>
        </div>
    );
}

/** Label/value row used inside the modal detail cards. */
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-[14px] text-[#667085] whitespace-nowrap">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] text-right flex items-center gap-2">{children}</div>
        </div>
    );
}

// ─── Freeze modal ─────────────────────────────────────────────────────────────

function FreezeModal({ plan, onClose, onConfirm }: {
    plan: CustomerPlan;
    onClose: () => void;
    onConfirm: (startISO: string, endISO: string) => void;
}) {
    const today = todayISO();
    const [start, setStart] = useState(today);
    const [end, setEnd] = useState("");

    const days = end && end >= start ? daysBetween(start, end) : 0;
    const canConfirm = !!end && end >= start && days > 0;
    const newExpiry = days > 0 ? addDaysISO(plan.expiryISO, days) : plan.expiryISO;

    return (
        <ModalShell
            title="Freeze plan"
            subtitle="Pause this product to stop any further usage within the system"
            onClose={onClose}
            footer={<>
                <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="lg" className="flex-1" disabled={!canConfirm}
                    onClick={() => onConfirm(start, end)}>Confirm freeze</Button>
            </>}
        >
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-medium text-[#344054]">Start date</label>
                    {/* Freeze can only start today or later (Brief: start from current date). */}
                    <DatePicker value={start} onChange={v => setStart(v)} placeholder="Start date" minDate={today} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-medium text-[#344054]">End date</label>
                    <DatePicker value={end} onChange={setEnd} placeholder="End date" minDate={start || today} />
                </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-[12px] bg-[#f1f2ed] border-1 border-[#e4e7ec]">
                <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0" />
                <p className="text-[14px] text-[#475467] leading-[20px]">
                    {canConfirm
                        ? `${plan.planTypeLabel} will be extended by ${days} ${days === 1 ? "day" : "days"}. New expiry: ${fmtDate(newExpiry)}`
                        : "Pick a start and end date — the plan's expiry will be extended by the frozen duration."}
                </p>
            </div>
        </ModalShell>
    );
}

// ─── Unfreeze modal ───────────────────────────────────────────────────────────

function UnfreezeModal({ plan, onClose, onConfirm }: {
    plan: CustomerPlan;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <ModalShell
            title="Unfreeze plan"
            subtitle="Reactivate this product so the customer can use it again"
            onClose={onClose}
            footer={<>
                <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="lg" className="flex-1" onClick={onConfirm}>Confirm unfreeze</Button>
            </>}
        >
            {/* The freeze window is shown read-only — the dates were set when the
                plan was frozen and can't be changed at unfreeze time. */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-medium text-[#344054]">Start date</label>
                    <DatePicker value={plan.freezeStartISO ?? ""} onChange={() => {}} placeholder="—" disabled />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-[14px] font-medium text-[#344054]">End date</label>
                    <DatePicker value={plan.freezeEndISO ?? ""} onChange={() => {}} placeholder="—" disabled />
                </div>
            </div>
        </ModalShell>
    );
}

// ─── Cancel-plan modal ────────────────────────────────────────────────────────

function CancelPlanModal({ plan, onClose, onConfirm }: {
    plan: CustomerPlan;
    onClose: () => void;
    onConfirm: (mode: "today" | "period_end", reason: string) => void;
}) {
    const [mode, setMode] = useState<"today" | "period_end">("today");
    const [reason, setReason] = useState(CANCEL_REASONS[0]);

    const billingLabel = plan.kind === "membership" ? "Next billing" : "Expiry date";
    const billingValue = plan.priceAed
        ? `${fmtDate(plan.expiryISO)} (AED ${plan.priceAed.toLocaleString("en-US")})`
        : fmtDate(plan.expiryISO);

    const ModeCard = ({ value, title, sub }: { value: "today" | "period_end"; title: string; sub: string }) => {
        const selected = mode === value;
        return (
            <button type="button" onClick={() => setMode(value)}
                className={cn("flex-1 flex items-center gap-3 p-4 rounded-[12px] text-left transition-all",
                    selected ? "border-2 border-[#7ba08c] bg-white" : "border-1 border-[#e4e7ec] bg-white hover:border-[#aad4bd]")}>
                <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-[14px] font-medium text-[#344054]">{title}</span>
                    <span className="text-[14px] text-[#475467]">{sub}</span>
                </div>
                <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                    selected ? "border-[#658774]" : "border-[#d0d5dd]")}>
                    {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#658774]" />}
                </span>
            </button>
        );
    };

    return (
        <ModalShell
            width="w-[680px]"
            title="Cancel plan"
            subtitle="Terminating a customer's plan will terminate their access."
            onClose={onClose}
            footer={<>
                <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(mode, reason)}>Cancel plan</Button>
            </>}
        >
            <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <p className="text-[18px] font-semibold text-[#101828]">Plan details</p>
                <div className="flex flex-col">
                    <p className="text-[14px] text-[#667085]">{plan.planTypeLabel}</p>
                    <p className="text-[16px] font-medium text-[#101828]">{plan.name}</p>
                </div>
                <div className="flex flex-col">
                    <p className="text-[14px] text-[#667085]">Member since</p>
                    <p className="text-[16px] font-medium text-[#101828]">{fmtDate(plan.purchasedAtISO)}</p>
                </div>
                <div className="flex flex-col">
                    <p className="text-[14px] text-[#667085]">{billingLabel}</p>
                    <p className="text-[16px] font-medium text-[#101828]">{billingValue}</p>
                </div>
            </div>
            <div className="flex gap-4">
                <ModeCard value="today" title="Cancel start today" sub="Customer loses access now" />
                <ModeCard value="period_end" title="Cancel at end of current period" sub={`Accessible until ${fmtDate(plan.expiryISO)}`} />
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium text-[#344054]">Cancellation reason</label>
                <SelectInput value={reason} onChange={setReason} placeholder="Select a reason"
                    options={CANCEL_REASONS.map(r => ({ value: r, label: r }))} width="w-full" />
            </div>
        </ModalShell>
    );
}

// ─── Remove-complimentary modal ───────────────────────────────────────────────

function RemoveComplimentaryModal({ plan, customer, onClose, onConfirm }: {
    plan: CustomerPlan;
    customer: Customer;
    onClose: () => void;
    onConfirm: (reason: string) => void;
}) {
    const [reason, setReason] = useState("");
    const value = (plan.freeCredits ?? 0) * CREDIT_VALUE_AED;

    return (
        <ModalShell
            title="Remove free credit"
            subtitle="Remove free credit access from customer."
            onClose={onClose}
            footer={<>
                <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button variant="destructive" size="lg" className="flex-1" disabled={!reason}
                    onClick={() => onConfirm(reason)}>Remove</Button>
            </>}
        >
            <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <p className="text-[18px] font-semibold text-[#101828]">Details</p>
                <div className="flex flex-col gap-2">
                    <InfoRow label="Issued by">
                        <span>{plan.grantIssuedBy ?? "—"}</span>
                        {plan.grantIssuedRole && <RoleBadge role={plan.grantIssuedRole} />}
                    </InfoRow>
                    <InfoRow label="Granting to">
                        <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={24} />
                        <span>{customer.firstName} {customer.lastName}</span>
                    </InfoRow>
                    <InfoRow label="Grant">{plan.creditsLabel}</InfoRow>
                    <InfoRow label="Value">AED {value.toLocaleString("en-US")}</InfoRow>
                    <InfoRow label="Expires">{fmtDate(plan.expiryISO)}</InfoRow>
                    <InfoRow label="Reason">{plan.grantReason ?? "—"}</InfoRow>
                </div>
            </div>
            <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium text-[#344054]">Remove reason</label>
                <SelectInput value={reason} onChange={setReason} placeholder="Select a reason"
                    options={REMOVE_REASONS.map(r => ({ value: r, label: r }))} width="w-full" />
            </div>
        </ModalShell>
    );
}

// ─── View-details modal (removed complimentary) ──────────────────────────────

function ViewComplimentaryModal({ plan, customer, onClose }: {
    plan: CustomerPlan;
    customer: Customer;
    onClose: () => void;
}) {
    const value = (plan.freeCredits ?? 0) * CREDIT_VALUE_AED;
    return (
        <ModalShell
            title="Remove free credit"
            subtitle="Remove free credit access from customer."
            onClose={onClose}
        >
            <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <p className="text-[18px] font-semibold text-[#101828]">Details</p>
                <div className="flex flex-col gap-2">
                    <InfoRow label="Status">
                        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[12px] font-medium bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]">
                            Revoked
                        </span>
                    </InfoRow>
                    <InfoRow label="Remove reason">{plan.removeReason ?? "—"}</InfoRow>
                    <InfoRow label="Removed by">
                        <span>{plan.removedBy ?? "—"}</span>
                        {plan.removedByRole && <RoleBadge role={plan.removedByRole} />}
                    </InfoRow>
                </div>
                <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                <div className="flex flex-col gap-2">
                    <InfoRow label="Issued by">
                        <span>{plan.grantIssuedBy ?? "—"}</span>
                        {plan.grantIssuedRole && <RoleBadge role={plan.grantIssuedRole} />}
                    </InfoRow>
                    <InfoRow label="Granting to">
                        <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={24} />
                        <span>{customer.firstName} {customer.lastName}</span>
                    </InfoRow>
                    <InfoRow label="Grant">{plan.creditsLabel}</InfoRow>
                    <InfoRow label="Value">AED {value.toLocaleString("en-US")}</InfoRow>
                    <InfoRow label="Reason">{plan.grantReason ?? "—"}</InfoRow>
                </div>
            </div>
        </ModalShell>
    );
}

// ─── Customer status modal (archive / deactivate / recover / reactivate) ─────

type CustomerAction = "archive" | "deactivate" | "recover" | "reactivate";

const CUSTOMER_ACTION_CFG: Record<CustomerAction, {
    title: string; description: (n: string) => string; confirmLabel: string;
    destructive: boolean; IconComp: React.ElementType; iconBg: string; iconColor: string;
}> = {
    archive: {
        title: "Archive this customer?",
        description: n => `${n} will be hidden from the default customer list. All history is preserved — you can recover them anytime.`,
        confirmLabel: "Archive", destructive: false,
        IconComp: Archive, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    deactivate: {
        title: "Deactivate this customer?",
        description: n => `${n} will be suspended — login is disabled and they cannot make new bookings. Existing bookings are not cancelled.`,
        confirmLabel: "Deactivate", destructive: true,
        IconComp: SlashCircle01, iconBg: "bg-[#fee4e2]", iconColor: "text-[#d92d20]",
    },
    recover: {
        title: "Recover this customer?",
        description: n => `${n} will be restored to Active status and shown in the customer list again.`,
        confirmLabel: "Recover", destructive: false,
        IconComp: RefreshCcw01, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
    reactivate: {
        title: "Reactivate this customer?",
        description: n => `${n} will be reactivated — login is re-enabled and they can book classes again.`,
        confirmLabel: "Reactivate", destructive: false,
        IconComp: Check, iconBg: "bg-[#e9fff3]", iconColor: "text-[#658774]",
    },
};

function CustomerStatusModal({ action, customerName, onClose, onConfirm }: {
    action: CustomerAction; customerName: string; onClose: () => void; onConfirm: () => void;
}) {
    const cfg = CUSTOMER_ACTION_CFG[action];
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", cfg.iconBg)}>
                        <cfg.IconComp className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description(customerName)}</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant={cfg.destructive ? "destructive" : "primary"} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Plan-row actions (⋮) ─────────────────────────────────────────────────────

type PlanActionKind = "freeze" | "unfreeze" | "cancel" | "remove" | "view";

/** Which row actions a plan offers, given its kind + status. */
function planActions(plan: CustomerPlan): PlanActionKind[] {
    if (plan.kind === "complimentary") {
        if (plan.status === "active") return ["remove"];
        if (plan.status === "removed") return ["view"];
        return [];
    }
    if (plan.status === "active") return ["freeze", "cancel"];
    if (plan.status === "frozen") return ["unfreeze"];
    return [];
}

function PlanRowActions({ plan, onAction }: {
    plan: CustomerPlan;
    onAction: (kind: PlanActionKind) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const actions = planActions(plan);
    if (actions.length === 0) return null;

    function trigger(kind: PlanActionKind) { setOpen(false); onAction(kind); }

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                {actions.includes("freeze") && (
                    <button type="button" onClick={() => trigger("freeze")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <PauseCircle className="w-4 h-4 text-[#667085]" />Freeze
                    </button>
                )}
                {actions.includes("unfreeze") && (
                    <button type="button" onClick={() => trigger("unfreeze")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <PlayCircle className="w-4 h-4 text-[#667085]" />Unfreeze
                    </button>
                )}
                {actions.includes("view") && (
                    <button type="button" onClick={() => trigger("view")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <AlignLeft className="w-4 h-4 text-[#667085]" />View details
                    </button>
                )}
                {actions.includes("cancel") && (
                    <button type="button" onClick={() => trigger("cancel")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <XCircle className="w-4 h-4 text-[#b42318]" />Cancel plan
                    </button>
                )}
                {actions.includes("remove") && (
                    <button type="button" onClick={() => trigger("remove")}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <Trash02 className="w-4 h-4 text-[#b42318]" />Remove free credit
                    </button>
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Plan-tab filter panel ────────────────────────────────────────────────────

type PlanFilterStatus = "active" | "expired";
interface PlanFilter {
    dateStart: string;
    dateEnd: string;
    kinds: PlanKind[];
    statuses: PlanFilterStatus[];
}
const EMPTY_PLAN_FILTER: PlanFilter = { dateStart: "", dateEnd: "", kinds: [], statuses: [] };

const PLAN_KIND_LABEL: Record<PlanKind, string> = {
    membership: "Membership", package: "Credit package", complimentary: "Free credit",
};

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn("px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]")}>
            {label}
        </button>
    );
}

function PlanFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void; applied: PlanFilter; onApply: (f: PlanFilter) => void;
}) {
    const [pending, setPending] = useState<PlanFilter>(EMPTY_PLAN_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);
    if (!open) return null;

    function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
    const hasAny = pending.statuses.length > 0 || pending.kinds.length > 0 ||
        pending.dateStart !== "" || pending.dateEnd !== "";

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range — filters on plan expiry date */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker value={pending.dateStart} placeholder="Start date"
                                onChange={v => setPending(p => ({
                                    ...p, dateStart: v,
                                    dateEnd: p.dateEnd && v && p.dateEnd < v ? "" : p.dateEnd,
                                }))} />
                            <DatePicker value={pending.dateEnd} placeholder="End date"
                                minDate={pending.dateStart || undefined}
                                onChange={v => setPending(p => ({ ...p, dateEnd: v }))} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Plan type</p>
                        <div className="flex flex-wrap gap-2">
                            {(["membership", "package", "complimentary"] as PlanKind[]).map(k => (
                                <FilterPill key={k} label={PLAN_KIND_LABEL[k]} selected={pending.kinds.includes(k)}
                                    onClick={() => setPending(p => ({ ...p, kinds: toggle(p.kinds, k) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {(["active", "expired"] as PlanFilterStatus[]).map(s => (
                                <FilterPill key={s} label={PLAN_STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_PLAN_FILTER); onApply(EMPTY_PLAN_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Empty state — absolute-centred (mirrors the class-types detail page) ────

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Side-panel action button (mirrors the class-types detail ActionBtn) ─────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Page ─────────────────────────────────────────────────────────────────────

type PlanModalState =
    | { kind: "freeze" | "unfreeze" | "cancel" | "remove" | "view"; plan: CustomerPlan }
    | null;

export function CustomerDetailPage({ customerId }: { customerId: string }) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const customerPlans = useAppStore(s => s.customerPlans);
    const setCustomerStatus = useAppStore(s => s.setCustomerStatus);
    const freezeCustomerPlan = useAppStore(s => s.freezeCustomerPlan);
    const unfreezeCustomerPlan = useAppStore(s => s.unfreezeCustomerPlan);
    const cancelCustomerPlan = useAppStore(s => s.cancelCustomerPlan);
    const removeComplimentaryPlan = useAppStore(s => s.removeComplimentaryPlan);
    const showToast = useAppStore(s => s.showToast);
    const currentUser = useAppStore(s => s.currentUser);

    const customer = customers.find(c => c.id === customerId);

    // Read `?tab=` so notification click-through can deep-link the user
    // straight to a specific tab (e.g. notification → Payments tab).
    const searchParams = useSearchParams();
    const initialTab: TabId = (() => {
        const q = searchParams?.get("tab");
        return q && (TABS as readonly string[]).includes(q) ? (q as TabId) : "Plan";
    })();
    const [tab, setTab] = useState<TabId>(initialTab);
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<PlanFilter>(EMPTY_PLAN_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [planModal, setPlanModal] = useState<PlanModalState>(null);
    const [customerModal, setCustomerModal] = useState<CustomerAction | null>(null);

    useEffect(() => { setPage(1); }, [search, applied, tab]);

    // ─── Plans for this customer ────────────────────────────────────────────
    const plans = useMemo(
        () => customerPlans
            .filter(p => p.customerId === customerId)
            // Newest purchase first.
            .sort((a, b) => b.purchasedAtISO.localeCompare(a.purchasedAtISO)),
        [customerPlans, customerId],
    );

    const filteredPlans = useMemo(() => {
        const q = search.trim().toLowerCase();
        return plans.filter(p => {
            if (q && !p.name.toLowerCase().includes(q)) return false;
            if (applied.statuses.length > 0 && !(applied.statuses as string[]).includes(p.status)) return false;
            if (applied.kinds.length > 0 && !applied.kinds.includes(p.kind)) return false;
            // Date range filters on the plan's expiry date (date part only).
            const expDate = p.expiryISO.slice(0, 10);
            if (applied.dateStart && expDate < applied.dateStart) return false;
            if (applied.dateEnd && expDate > applied.dateEnd) return false;
            return true;
        });
    }, [plans, search, applied]);

    const totalPages = Math.max(1, Math.ceil(filteredPlans.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedPlans = filteredPlans.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Credit-balance widget data ─────────────────────────────────────────
    // Everything in this widget reflects the LIVE remaining balance:
    //   • Headline = customer.creditsRemaining (or "Unlimited")
    //   • Bar      = remaining / total allotment
    //   • Each breakdown row = remaining credits from THAT source, so the rows
    //                          sum to the headline (no disconnect with the bar).
    const activePlans = plans.filter(p => p.status === "active" || p.status === "frozen");
    const planCreditPlans = activePlans.filter(p => p.kind === "membership" || p.kind === "package");
    const freeCreditPlans = activePlans.filter(p => p.kind === "complimentary");
    const hasUnlimited = planCreditPlans.some(p => p.creditsLabel.toLowerCase().includes("unlimited"));
    // Allotments — used as the bar denominator and to split remaining credits
    // between plan-portion and free-portion.
    const planAllotment = planCreditPlans.reduce((s, p) => s + parseCredits(p.creditsLabel), 0);
    const freeAllotment = freeCreditPlans.reduce((s, p) => s + (p.freeCredits ?? parseCredits(p.creditsLabel)), 0);
    const totalAllotment = planAllotment + freeAllotment;
    const creditsLeft = customer?.creditsRemaining ?? 0;
    // Live remaining split: free credits stay credited to "free" until the
    // total balance drops below the free count; the plan portion is whatever's
    // left after that (clamped at 0). Keeps the numbers consistent.
    const freeRemaining = freeAllotment > 0 ? Math.min(freeAllotment, creditsLeft) : 0;
    const planRemaining = Math.max(0, creditsLeft - freeRemaining);
    const creditDisplay = hasUnlimited
        ? "Unlimited"
        : `${creditsLeft} ${creditsLeft === 1 ? "credit" : "credits"} left`;
    const barPct = hasUnlimited ? 100
        : totalAllotment > 0 ? Math.min(100, Math.round((creditsLeft / totalAllotment) * 100)) : 0;
    // Credit breakdown — live remaining per source. Rows sum to the headline.
    // A row is suffixed "(Frozen)" when every contributing plan is frozen, so
    // freezing a plan is visible without changing the credit pool (frozen
    // credits are preserved for when the plan unfreezes).
    const planAllFrozen = planCreditPlans.length > 0
        && planCreditPlans.every(p => p.status === "frozen");
    const freeAllFrozen = freeCreditPlans.length > 0
        && freeCreditPlans.every(p => p.status === "frozen");
    const creditRows: { label: string; value: string }[] = [];
    if (planCreditPlans.length > 0) {
        const isMembership = planCreditPlans[0].kind === "membership";
        const baseLabel = isMembership ? "Membership" : "Credit package";
        creditRows.push({
            label: planAllFrozen ? `${baseLabel} (Frozen)` : baseLabel,
            value: hasUnlimited
                ? "Unlimited"
                : `${planRemaining} ${planRemaining === 1 ? "credit" : "credits"}`,
        });
    }
    if (freeCreditPlans.length > 0) {
        creditRows.push({
            label: freeAllFrozen ? "Free credit (Frozen)" : "Free credit",
            value: `${freeRemaining} ${freeRemaining === 1 ? "credit" : "credits"}`,
        });
    }
    const hasActiveFilter = applied.statuses.length > 0 || applied.kinds.length > 0 ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    // Customer not found (deleted / stale link).
    if (!customer) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
                <p className="text-[16px] text-[#667085]">This customer could not be found.</p>
                <Button variant="secondary-gray" size="md" onClick={() => router.push("/admin/customers")}>
                    Back to customers
                </Button>
            </div>
        );
    }

    const customerName = `${customer.firstName} ${customer.lastName}`.trim();

    // ─── Plan action handlers ───────────────────────────────────────────────
    function handleFreeze(plan: CustomerPlan, startISO: string, endISO: string) {
        // Customer detail is an admin surface — attribute the freeze
        // there so the Frozen package report shows "Admin" for this row.
        freezeCustomerPlan(plan.id, startISO, endISO, "admin");
        setPlanModal(null);
        showToast(
            "Membership has been frozen",
            `All active benefits and class bookings for ${plan.name} will be frozen until reactivated.`,
            "error", "slash",
        );
    }
    function handleUnfreeze(plan: CustomerPlan) {
        unfreezeCustomerPlan(plan.id);
        setPlanModal(null);
        showToast(
            "Membership has been unfrozen",
            `All benefits and bookings have been reactivated for ${plan.name}.`,
            "success", "check",
        );
    }
    function handleCancelPlan(plan: CustomerPlan, mode: "today" | "period_end", reason: string) {
        cancelCustomerPlan(plan.id, mode, reason);
        setPlanModal(null);
        showToast(
            "Plan cancelled",
            mode === "today"
                ? `${plan.name} has been cancelled — the customer's access ends today.`
                : `${plan.name} will be cancelled at the end of the current period.`,
            "error", "slash",
        );
    }
    function handleRemoveComplimentary(plan: CustomerPlan, reason: string) {
        removeComplimentaryPlan(plan.id, reason, `${currentUser.first_name} ${currentUser.last_name}`, "Owner");
        setPlanModal(null);
        showToast(
            "Complimentary credit removed",
            `The free credit granted to ${customerName} has been revoked.`,
            "success", "trash",
        );
    }
    function handleCustomerStatus(action: CustomerAction) {
        const nextStatus: Customer["status"] =
            action === "deactivate" ? "inactive"
            : action === "archive" ? "archived"
            : "active"; // recover + reactivate
        setCustomerStatus([customerId], nextStatus);
        setCustomerModal(null);
        const verb = action === "archive" ? "archived"
            : action === "deactivate" ? "deactivated"
            : action === "recover" ? "recovered" : "reactivated";
        showToast(
            `Customer ${verb}`,
            `${customerName} has been ${verb}.`,
            action === "deactivate" ? "error" : "success",
            action === "deactivate" ? "slash" : action === "archive" ? "archive" : action === "recover" ? "refresh" : "check",
        );
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push("/admin/customers")}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Customer details</h1>
            </div>

            {/* Two-column content — fixed-height block, page scrolls (mirrors
                the class-types / products detail pages). */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    {/* ── Left panel ── */}
                    <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
                        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                            <div className="flex flex-col gap-5 px-6 pt-6 pb-6 flex-1">
                                {/* Avatar + status */}
                                <div className="flex items-start justify-between">
                                    <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={88} />
                                    <CustomerStatusBadge status={customer.status} />
                                </div>

                                {/* Name + email */}
                                <div>
                                    <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{customerName}</h2>
                                    <p className="text-[14px] text-[#667085] mt-0.5">{customer.email}</p>
                                </div>

                                {/* Credit balance */}
                                <div className="border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3">
                                    <div className="flex flex-col gap-0.5">
                                        <p className="text-[14px] text-[#667085]">Total credits</p>
                                        <p className="text-[18px] font-semibold text-[#101828]">{creditDisplay}</p>
                                    </div>
                                    <div className="h-2 w-full rounded-full bg-[#f2f4f7] overflow-hidden">
                                        <div className="h-full rounded-full bg-[#658774]" style={{ width: `${barPct}%` }} />
                                    </div>
                                    {creditRows.length > 0 && (
                                        <div className="flex gap-4">
                                            {creditRows.map(r => (
                                                <div key={r.label} className="flex flex-col flex-1 min-w-0">
                                                    <p className="text-[13px] text-[#667085]">{r.label}</p>
                                                    <p className="text-[14px] font-medium text-[#101828]">{r.value}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Info fields */}
                                <div className="flex flex-col gap-3">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[14px] text-[#667085]">Joined</p>
                                        <p className="text-[16px] font-medium text-[#101828]">{fmtDate(customer.createdAt)}</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[14px] text-[#667085]">Phone</p>
                                        <p className="text-[16px] font-medium text-[#101828]">{customer.phone || "—"}</p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[14px] text-[#667085]">Emergency contact</p>
                                        <p className="text-[16px] font-medium text-[#101828]">
                                            {customer.emergencyContactName
                                                ? customer.emergencyContactRelation
                                                    ? `${customer.emergencyContactName} (${customer.emergencyContactRelation})`
                                                    : customer.emergencyContactName
                                                : "Not on file"}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Customer actions */}
                            <div className="px-6 pb-6 shrink-0">
                                <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                                <p className="text-[14px] text-[#667085] mb-4">Customer actions</p>
                                <div className="flex flex-col gap-4">
                                    {/* Edit + Add credit are Active-only.
                                        Inactive customers must be Reactivated,
                                        Archived must be Recovered first. */}
                                    {customer.status === "active" && (
                                        <>
                                            <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit customer"
                                                onClick={() => router.push(`/customers/${customer.id}/edit?returnTo=/customers/${customer.id}`)} />
                                            <ActionBtn icon={<HeartHand className="w-5 h-5" />} label="Add complimentary credit"
                                                onClick={() => router.push(`/customers/${customer.id}/add-credit?returnTo=/customers/${customer.id}`)} />
                                        </>
                                    )}
                                    {customer.status !== "archived" && (
                                        <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive customer"
                                            onClick={() => setCustomerModal("archive")} />
                                    )}
                                    {customer.status === "active" && (
                                        <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate customer" danger
                                            onClick={() => setCustomerModal("deactivate")} />
                                    )}
                                    {customer.status === "inactive" && (
                                        <ActionBtn icon={<Check className="w-5 h-5" />} label="Reactivate customer"
                                            onClick={() => setCustomerModal("reactivate")} />
                                    )}
                                    {customer.status === "archived" && (
                                        <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover customer"
                                            onClick={() => setCustomerModal("recover")} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── Right panel ── */}
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
                        {/* Tab strip */}
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <div className="flex gap-1">
                                {TABS.map(t => (
                                    <button key={t} type="button" onClick={() => setTab(t)}
                                        className={cn(
                                            "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                            tab === t
                                                ? "border-b-2 border-[#101828] text-[#101828]"
                                                : "text-[#667085] hover:text-[#344054]",
                                        )}>
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {tab === "Plan" ? (
                            <>
                                {/* Toolbar */}
                                <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                                    <div className="flex-1">
                                        <p className="text-[14px] text-[#667085]">Total</p>
                                        <p className="text-[14px] font-medium text-[#101828]">
                                            {filteredPlans.length} purchased {filteredPlans.length === 1 ? "plan" : "plans"}
                                        </p>
                                    </div>
                                    <div className="relative w-[200px]">
                                        <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                                        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                                            placeholder="Search product..."
                                            className="h-9 w-full pl-[36px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                        />
                                    </div>
                                    <Button variant="secondary-gray" size="md"
                                        leftIcon={
                                            <div className="relative">
                                                <FilterLines className="w-4 h-4" />
                                                {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />}
                                            </div>
                                        }
                                        onClick={() => setFilterOpen(true)}>Filter</Button>
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                                    {pagedPlans.length === 0 ? (
                                        <EmptyBlock
                                            title={plans.length === 0 ? "No plans yet" : "No plans found"}
                                            subtitle={plans.length === 0
                                                ? "This customer hasn't purchased or been granted any plan."
                                                : "Try adjusting your search or filter."}
                                        />
                                    ) : (
                                        <div className="px-6">
                                            <table className="w-full border-collapse">
                                                <thead>
                                                    <tr>
                                                        <th className={TH}>Transaction name</th>
                                                        <th className={cn(TH, "w-[160px]")}>Plan type</th>
                                                        <th className={cn(TH, "w-[120px]")}>Status</th>
                                                        <th className={cn(TH, "w-[200px]")}>Expiry date</th>
                                                        <th className={cn(TH, "w-[52px]")} />
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pagedPlans.map(p => (
                                                        <tr key={p.id} className="hover:bg-[#f9fafb] transition-colors">
                                                            <td className={TD}>
                                                                <div className="flex items-center gap-3">
                                                                    <PlanIcon kind={p.kind} />
                                                                    <div className="flex flex-col min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-[14px] font-medium text-[#101828]">{p.name}</span>
                                                                            {p.kind === "complimentary" && (
                                                                                <span className="inline-flex items-center px-[8px] py-[1px] rounded-full text-[12px] font-medium bg-[#ecfdf3] border border-[#abefc6] text-[#067647]">
                                                                                    Complimentary
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <span className="text-[13px] text-[#667085]">
                                                                            {p.creditsLabel}{p.kind === "complimentary" ? " · Given by staff" : ""}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className={cn(TD, "text-[#475467]")}>{p.planTypeLabel}</td>
                                                            <td className={TD}><PlanStatusBadge status={p.status} /></td>
                                                            <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtDateTime(p.expiryISO)}</td>
                                                            <td className={TD}>
                                                                <PlanRowActions plan={p}
                                                                    onAction={kind => setPlanModal({ kind, plan: p })} />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>

                                <div className="px-6 shrink-0">
                                    <Pagination page={clampedPage} total={filteredPlans.length} pageSize={pageSize}
                                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
                                </div>
                            </>
                        ) : tab === "Bookings" ? (
                            <CustomerBookingsTab customerId={customerId} />
                        ) : tab === "Payments" ? (
                            <CustomerPaymentsTab customerId={customerId} />
                        ) : tab === "Details" ? (
                            <CustomerDetailsTab customerId={customerId} />
                        ) : tab === "Agreements" ? (
                            <CustomerAgreementsTab customerId={customerId} />
                        ) : (
                            <CustomerReferralsTab customerId={customerId} />
                        )}
                    </div>
                </div>
            </div>

            {/* ── Plan modals ── */}
            {planModal?.kind === "freeze" && (
                <FreezeModal plan={planModal.plan} onClose={() => setPlanModal(null)}
                    onConfirm={(s, e) => handleFreeze(planModal.plan, s, e)} />
            )}
            {planModal?.kind === "unfreeze" && (
                <UnfreezeModal plan={planModal.plan} onClose={() => setPlanModal(null)}
                    onConfirm={() => handleUnfreeze(planModal.plan)} />
            )}
            {planModal?.kind === "cancel" && (
                <CancelPlanModal plan={planModal.plan} onClose={() => setPlanModal(null)}
                    onConfirm={(m, r) => handleCancelPlan(planModal.plan, m, r)} />
            )}
            {planModal?.kind === "remove" && (
                <RemoveComplimentaryModal plan={planModal.plan} customer={customer} onClose={() => setPlanModal(null)}
                    onConfirm={r => handleRemoveComplimentary(planModal.plan, r)} />
            )}
            {planModal?.kind === "view" && (
                <ViewComplimentaryModal plan={planModal.plan} customer={customer} onClose={() => setPlanModal(null)} />
            )}

            {/* ── Customer status modal ── */}
            {customerModal && (
                <CustomerStatusModal action={customerModal} customerName={customerName}
                    onClose={() => setCustomerModal(null)}
                    onConfirm={() => handleCustomerStatus(customerModal)} />
            )}

            <PlanFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} />

            <Toast />
        </div>
    );
}
