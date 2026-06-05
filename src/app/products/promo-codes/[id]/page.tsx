"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Promo detail page (/products/promo-codes/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen detail page matching the membership detail (/products/[id])
// shell exactly so every detail page shares the same chrome:
//   • 72px top header (X close + page title)
//   • h-[832px] two-column frame inside px-6 py-6 outer padding
//   • 320px left sidebar (promo banner + key stats + actions)
//   • Right panel: bordered rounded-20 container, no tabs — a single
//     scrollable body with Promo configuration + Visibility settings
//
// Figma references:
//   • Page              — 5284:116206
//   • Promo configuration — 7042:103566
//   • Visibility settings — 7042:103624
//
// State source of truth: useAppStore(s => s.promoCodes). Every action
// (edit / archive / deactivate / reactivate / recover / delete) writes back
// through the store so the list view + this page stay in lock-step.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01, RefreshCcw01, Trash01, Check,
    ChevronUp, ChevronDown, HelpCircle,
    LetterSpacing01, CursorBox, Calendar, Sale03, Ticket01, User01,
    BankNote01, CheckVerified02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { useAppStore, type PromoCode, type Branch } from "@/lib/store";

// ─── Status helpers ──────────────────────────────────────────────────────────

type StoredStatus = PromoCode["status"];           // active | inactive | archived
type EffectiveStatus = StoredStatus | "expired";   // expired derived from valid_until

const STATUS_LABEL: Record<EffectiveStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
    expired: "Expired",
};

/** A promo reads as "Expired" once `valid_until` passes — regardless of the
 *  stored admin status. Otherwise it shows its stored status. */
function effectiveStatus(p: PromoCode): EffectiveStatus {
    if (p.valid_until && new Date(p.valid_until).getTime() < Date.now()) return "expired";
    return p.status;
}

function StatusBadge({ status }: { status: EffectiveStatus }) {
    const styles = status === "active"
        ? "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
        : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]";
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium whitespace-nowrap",
            styles,
        )}>
            {STATUS_LABEL[status]}
        </span>
    );
}

// ─── Display helpers ─────────────────────────────────────────────────────────

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** ISO → "20 February 2026, 12:00 PM" (UTC). */
function formatDateTime(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    let h = d.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h}:${mm} ${ampm}`;
}

const ACTION_LABEL: Record<NonNullable<PromoCode["action"]>, string> = {
    book_class: "Book a class",
    buy_package: "Buy a package",
};

const OFFER_LABEL: Record<NonNullable<PromoCode["offer_type"]>, string> = {
    free_class: "Free class",
    free_trial: "Free trial",
    percentage: "Percentage off",
    fixed_amount: "Fixed amount",
};

/** Human-readable discount value — "1 free class", "20% off", "AED 100 off". */
function discountValueLabel(offer: PromoCode["offer_type"], value: number): string {
    switch (offer) {
        case "free_class": return `${value} free ${value === 1 ? "class" : "classes"}`;
        case "free_trial": return `${value} free ${value === 1 ? "trial" : "trials"}`;
        case "percentage": return `${value}% off`;
        case "fixed_amount": return `AED ${value.toLocaleString("en-US")} off`;
        default: return "—";
    }
}

function branchName(id: string, branches: Branch[]): string {
    return branches.find(b => b.id === id)?.name ?? id;
}

/** "All branches" / "3 branches" / a single branch name. */
function branchSummary(branchIds: string[], branches: Branch[]): string {
    const n = branchIds.length;
    if (n === 0 || n >= branches.length) return "All branches";
    if (n === 1) return branchName(branchIds[0], branches);
    return `${n} branches`;
}

// ─── Sidebar action button (from /products/[id]) ────────────────────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void;
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

// ─── Confirmation modal (mirrors /products/[id] tone matrix) ────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const DESTRUCTIVE_ACTIONS = new Set<ModalAction>(["deactivate", "delete"]);

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    title: string; description: string; confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        title: "Archive this promo?",
        description: "This promo will be hidden from the promo list and stop being redeemable. You can recover archived promos at any time.",
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        title: "Deactivate this promo?",
        description: "This promo will stop being redeemable at checkout. You can reactivate it again later.",
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        title: "Recover this promo?",
        description: "This promo will be restored to Active status and become redeemable again.",
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        title: "Reactivate this promo?",
        description: "This promo will become redeemable at checkout again.",
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash01, iconColor: "text-[#d92d20]",
        title: "Delete this promo?",
        description: "This promo will be permanently removed. This action cannot be undone.",
        confirmLabel: "Delete",
    },
};

function ActionModal({ action, onConfirm, onCancel }: {
    action: ModalAction; onConfirm: () => void; onCancel: () => void;
}) {
    const cfg = MODAL_CONFIG[action];
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shrink-0", cfg.iconBg)}>
                        <cfg.IconComp className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description}</p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant={DESTRUCTIVE_ACTIONS.has(action) ? "destructive" : "primary"} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Left sidebar ────────────────────────────────────────────────────────────

function SidebarField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
        </div>
    );
}

function PromoSidebarBanner({ vm }: { vm: PromoDetailVM }) {
    const isActive = vm.effectiveStatus === "active";
    const bannerClass = isActive
        ? "bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467]"
        : "bg-gradient-to-br from-[#475467] via-[#667085] to-[#98a2b3]";
    return (
        <div className={cn("relative h-[155px] flex flex-col justify-between pt-10 pb-3 px-4 shrink-0", bannerClass)}>
            {vm.bannerImageUrl && (
                <img src={vm.bannerImageUrl} alt=""
                    className={cn("absolute inset-0 w-full h-full object-cover", !isActive && "grayscale")} />
            )}
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(12,17,29,0.1)_0%,rgba(12,17,29,0.72)_100%)]" />
            <div className="absolute top-3 right-3 z-10">
                <StatusBadge status={vm.effectiveStatus} />
            </div>
            <div className="relative z-10 flex flex-col">
                <p className="text-[20px] font-semibold text-white leading-[30px] break-words">{vm.name}</p>
            </div>
            <p className="relative z-10 text-[12px] text-[#d0d5dd] leading-[18px]">*T&amp;Cs Apply</p>
        </div>
    );
}

function LeftSidebar({ vm, onAction, branches }: {
    vm: PromoDetailVM;
    onAction: (a: "edit" | ModalAction) => void;
    branches: Branch[];
}) {
    const canDelete = vm.usageCount === 0;

    const actions = (() => {
        // Archived promos must be Recovered before they can be edited or
        // deleted; Inactive promos must be Reactivated first.
        if (vm.status === "archived") {
            return (
                <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover promo" onClick={() => onAction("recover")} />
            );
        }
        if (vm.status === "inactive") {
            return (
                <>
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Reactivate promo" onClick={() => onAction("reactivate")} />
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive promo" onClick={() => onAction("archive")} />
                </>
            );
        }
        // active (incl. expired — stored status is still "active")
        return (
            <>
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit promo" onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive promo" onClick={() => onAction("archive")} />
                {canDelete ? (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete promo" danger onClick={() => onAction("delete")} />
                ) : (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate promo" danger onClick={() => onAction("deactivate")} />
                )}
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            <PromoSidebarBanner vm={vm} />

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{vm.name}</h2>
                        {vm.description && (
                            <p className="text-[14px] text-[#667085] leading-5">{vm.description}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <SidebarField label="Promo action" value={vm.actionLabel} />
                        <SidebarField label="Start date & time" value={formatDateTime(vm.validFrom)} />
                        <SidebarField label="End date & time" value={formatDateTime(vm.validUntil)} />
                        <SidebarField label="Discount type" value={vm.offerLabel} />
                        <SidebarField label="Discount amount" value={vm.discountValueLabel} />
                        <SidebarField label="Applicable branch" value={branchSummary(vm.branchIds, branches)} />
                    </div>
                </div>

                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Promo actions</p>
                    <div className="flex flex-col gap-4">{actions}</div>
                </div>
            </div>
        </div>
    );
}

// ─── HelpTooltip — ? icon with hover popover (from /products/[id]) ──────────

function HelpTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative inline-flex">
            <button type="button" aria-label="More information"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                className="text-[#98a2b3] hover:text-[#667085] transition-colors">
                <HelpCircle className="w-4 h-4" />
            </button>
            {open && (
                <span className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 z-50 whitespace-nowrap rounded-[8px] bg-[#0c111d] text-white text-[12px] font-medium leading-[18px] px-3 py-2 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] pointer-events-none">
                    {text}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#0c111d]" />
                </span>
            )}
        </span>
    );
}

// ─── Inline icon-label-value stat (Figma 7042:103566) ───────────────────────

function InlineStat({ icon, label, value, tooltip }: {
    icon: React.ReactNode; label: string; value: string; tooltip?: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0 text-[#475467]">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-[14px] text-[#667085] leading-5">{label}</p>
                    {tooltip && <HelpTooltip text={tooltip} />}
                </div>
                <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{value}</p>
            </div>
        </div>
    );
}

// ─── Section heading (small gray label, no border) ──────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] text-[#667085] mt-2 first:mt-0">{children}</p>;
}

// ─── Disabled-state checkbox / radio (read-only Figma treatment) ────────────

function DisabledCheckbox() {
    return (
        <div className="w-4 h-4 rounded-[4px] border border-[#d0d5dd] bg-[#f9fafb] flex items-center justify-center shrink-0">
            <Check className="w-[10px] h-[10px] text-[#d0d5dd]" />
        </div>
    );
}

function DisabledRadio({ selected }: { selected: boolean }) {
    return (
        <div className="w-4 h-4 rounded-full bg-[#f9fafb] border border-[#d0d5dd] flex items-center justify-center shrink-0">
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-[#98a2b3]" />}
        </div>
    );
}

// ─── Visibility card — collapsible, badge + disabled rows ───────────────────

function VisibilityCard({ title, subtitle, badge, children }: {
    title: string; subtitle: string; badge: string; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0 whitespace-nowrap">
                    {badge}
                </span>
                <button type="button" onClick={() => setOpen(p => !p)}
                    aria-label={open ? "Collapse" : "Expand"}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0 hover:text-[#344054] transition-colors">
                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>
            {open && <div className="flex flex-col gap-3">{children}</div>}
        </div>
    );
}

/** A checkbox row — label on the left, optional muted text on the right. */
function CheckRow({ label, trailing }: { label: string; trailing?: string }) {
    return (
        <div className="flex items-center gap-2">
            <DisabledCheckbox />
            <span className="text-[14px] font-medium text-[#101828] flex-1 truncate">{label}</span>
            {trailing && <span className="text-[14px] text-[#667085] shrink-0">{trailing}</span>}
        </div>
    );
}

// ─── Right panel ─────────────────────────────────────────────────────────────

function RightPanel({ vm, branches }: { vm: PromoDetailVM; branches: Branch[] }) {
    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
                {/* ── Promo configuration ── */}
                <SectionHeading>Promo configuration</SectionHeading>
                <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                    <InlineStat icon={<LetterSpacing01 className="w-4 h-4" />} label="Display name" value={vm.name} />
                    <InlineStat icon={<CursorBox className="w-4 h-4" />} label="Link or action" value={vm.actionLabel} />
                    <InlineStat icon={<Calendar className="w-4 h-4" />} label="Start date & time" value={formatDateTime(vm.validFrom)} />
                    <InlineStat icon={<Calendar className="w-4 h-4" />} label="End date & time" value={formatDateTime(vm.validUntil)} />
                    <InlineStat icon={<Sale03 className="w-4 h-4" />} label="Discount type" value={vm.offerLabel} />
                    <InlineStat icon={<Sale03 className="w-4 h-4" />} label="Discount value" value={vm.discountValueLabel} />
                    <InlineStat icon={<Ticket01 className="w-4 h-4" />} label="Promo code" value={vm.code} />
                    <InlineStat
                        icon={<User01 className="w-4 h-4" />}
                        label="First time user only"
                        value={vm.firstTimeUserLabel}
                        tooltip="Only customer who have never purchased before"
                    />
                    <InlineStat icon={<BankNote01 className="w-4 h-4" />} label="Usage limit" value={vm.usageLimitLabel} />
                    <InlineStat
                        icon={<CheckVerified02 className="w-4 h-4" />}
                        label="Multi-location access"
                        value={vm.multiLocation ? "Yes" : "No"}
                        tooltip="Promo code can be use on multiple branches"
                    />
                </div>

                {/* ── Visibility settings ── */}
                <SectionHeading>Visibility settings</SectionHeading>

                {/* Branches */}
                <VisibilityCard
                    title="Branches"
                    subtitle={vm.multiLocation
                        ? "The promo can be use on multiple branches"
                        : "The promo can be use on a single branch"}
                    badge={vm.branchIds.length === 0 ? "All branches" : `${vm.branchIds.length} selected`}
                >
                    {vm.branchIds.length === 0 ? (
                        <CheckRow label="All active branches" />
                    ) : (
                        vm.branchIds.map(id => <CheckRow key={id} label={branchName(id, branches)} />)
                    )}
                </VisibilityCard>

                {/* Packages — grouped Membership / Class package */}
                <VisibilityCard
                    title="Packages"
                    subtitle="The promo can be use on multiple packages"
                    badge={`${vm.products.length} selected`}
                >
                    {vm.products.length === 0 ? (
                        <p className="text-[14px] text-[#667085]">No packages selected.</p>
                    ) : (
                        (["Membership", "Class package"] as const).map(group => {
                            const rows = vm.products.filter(p => p.group === group);
                            if (rows.length === 0) return null;
                            return (
                                <div key={group} className="flex flex-col gap-3">
                                    <p className="text-[12px] text-[#667085] leading-[18px]">{group}</p>
                                    {rows.map(p => <CheckRow key={p.id} label={p.name} />)}
                                </div>
                            );
                        })
                    )}
                </VisibilityCard>

                {/* Classes — class name + category */}
                <VisibilityCard
                    title="Classes"
                    subtitle="The promo can be use on multiple classes"
                    badge={`${vm.classes.length} selected`}
                >
                    {vm.classes.length === 0 ? (
                        <p className="text-[14px] text-[#667085]">No classes selected.</p>
                    ) : (
                        vm.classes.map(c => <CheckRow key={c.id} label={c.name} trailing={c.category} />)
                    )}
                </VisibilityCard>

                {/* Customer targeting */}
                <VisibilityCard
                    title="Customer"
                    subtitle="The promo can be configured to target specific eligible users."
                    badge={vm.customerTargeting === "new_users" ? "New user only"
                        : vm.customerTargeting === "all" ? "Everyone" : "—"}
                >
                    <div className="flex items-center gap-2">
                        <DisabledRadio selected={vm.customerTargeting === "all"} />
                        <span className="text-[14px] font-medium text-[#101828]">Everyone</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <DisabledRadio selected={vm.customerTargeting === "new_users"} />
                        <span className="text-[14px] font-medium text-[#101828]">New user only</span>
                    </div>
                </VisibilityCard>
            </div>
        </div>
    );
}

// ─── ViewModel ───────────────────────────────────────────────────────────────

interface ProductRow { id: string; name: string; group: "Membership" | "Class package" }
interface ClassRow { id: string; name: string; category: string }

interface PromoDetailVM {
    status: StoredStatus;
    effectiveStatus: EffectiveStatus;
    name: string;
    code: string;
    description: string;
    bannerImageUrl?: string;
    actionLabel: string;
    offerLabel: string;
    discountValueLabel: string;
    validFrom?: string;
    validUntil?: string;
    branchIds: string[];
    multiLocation: boolean;
    usageCount: number;
    firstTimeUserLabel: string;
    usageLimitLabel: string;
    customerTargeting: PromoCode["customer_targeting"] | "";
    products: ProductRow[];
    classes: ClassRow[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function PromoDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";

    const promoCodes      = useAppStore(s => s.promoCodes);
    const memberships     = useAppStore(s => s.memberships);
    const packages        = useAppStore(s => s.packages);
    const classTemplates  = useAppStore(s => s.classTemplates);
    const branches        = useAppStore(s => s.branches);
    const updatePromoCode = useAppStore(s => s.updatePromoCode);
    const deletePromoCode = useAppStore(s => s.deletePromoCode);
    const showToast       = useAppStore(s => s.showToast);

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    const promo = promoCodes.find(p => p.id === id) ?? null;

    if (!promo) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Promo not found</p>
                <button type="button" onClick={() => router.push("/admin/products/promo-codes")}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to promos
                </button>
            </div>
        );
    }

    // ─── Build the view model from the live store row ──────────────────────
    const branchIds = promo.branch_ids ?? [];
    const multiLocation = promo.multi_location ?? (branchIds.length !== 1);

    const firstTimeUserLabel = promo.first_time_only
        ? (promo.usage_limit ? `Yes (${promo.usage_limit} users)` : "Yes")
        : "No";
    const usageLimitLabel = promo.per_customer_limit
        ? `${promo.per_customer_limit} ${promo.per_customer_limit === 1 ? "usage" : "usages"}`
        : "Unlimited";

    const products: ProductRow[] = (promo.applies_to_product_ids ?? [])
        .map((pid): ProductRow | null => {
            const m = memberships.find(x => x.id === pid);
            if (m) return { id: pid, name: m.name, group: "Membership" };
            const pk = packages.find(x => x.id === pid);
            if (pk) return { id: pid, name: pk.name, group: "Class package" };
            return null;
        })
        .filter((r): r is ProductRow => r !== null);

    const classes: ClassRow[] = (promo.applies_to_class_ids ?? [])
        .map((cid): ClassRow | null => {
            const t = classTemplates.find(x => x.id === cid);
            return t ? { id: cid, name: t.name, category: t.category } : null;
        })
        .filter((r): r is ClassRow => r !== null);

    const vm: PromoDetailVM = {
        status: promo.status,
        effectiveStatus: effectiveStatus(promo),
        name: promo.name ?? promo.code,
        code: promo.code,
        description: promo.description ?? "",
        bannerImageUrl: promo.banner_image_url,
        actionLabel: promo.action ? ACTION_LABEL[promo.action] : "—",
        offerLabel: promo.offer_type ? OFFER_LABEL[promo.offer_type] : "—",
        discountValueLabel: discountValueLabel(promo.offer_type, promo.discount_value),
        validFrom: promo.valid_from,
        validUntil: promo.valid_until,
        branchIds,
        multiLocation,
        usageCount: promo.usage_count,
        firstTimeUserLabel,
        usageLimitLabel,
        customerTargeting: promo.customer_targeting ?? "",
        products,
        classes,
    };

    function handleAction(a: "edit" | ModalAction) {
        if (a === "edit") {
            router.push(`/products/promo-codes/${id}/edit`);
            return;
        }
        setConfirmAction(a);
    }

    function handleConfirm() {
        if (!confirmAction || !promo) return;
        const name = vm.name;
        if (confirmAction === "archive") {
            updatePromoCode(id, { status: "archived" });
            showToast("Promo archived", `${name} has been archived.`, "success", "archive");
            setConfirmAction(null);
        } else if (confirmAction === "deactivate") {
            updatePromoCode(id, { status: "inactive" });
            showToast("Promo deactivated", `${name} is no longer redeemable.`, "error", "slash");
            setConfirmAction(null);
        } else if (confirmAction === "recover") {
            updatePromoCode(id, { status: "active" });
            showToast("Promo recovered", `${name} has been recovered and is now active.`, "success", "refresh");
            setConfirmAction(null);
        } else if (confirmAction === "reactivate") {
            updatePromoCode(id, { status: "active" });
            showToast("Promo reactivated", `${name} is now active again.`, "success", "check");
            setConfirmAction(null);
        } else if (confirmAction === "delete") {
            const ok = deletePromoCode(id);
            if (ok) {
                showToast("Promo deleted", `${name} has been deleted.`, "success", "trash");
                setConfirmAction(null);
                router.push("/admin/products/promo-codes");
            } else {
                showToast(
                    "Cannot delete",
                    `${name} has already been redeemed. Archive it instead.`,
                    "error", "slash",
                );
                setConfirmAction(null);
            }
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as /products/[id] */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push("/admin/products/promo-codes")}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Promo details</h1>
            </div>

            {/* Body — px-6 py-6 outer + h-[832px] two-column frame */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <LeftSidebar vm={vm} onAction={handleAction} branches={branches} />
                    <RightPanel vm={vm} branches={branches} />
                </div>
            </div>

            {confirmAction && (
                <ActionModal
                    action={confirmAction}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <Toast />
        </div>
    );
}
