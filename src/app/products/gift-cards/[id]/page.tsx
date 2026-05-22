"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift card detail page (/products/gift-cards/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen detail page matching the membership / credit-package detail
// shell (/products/[id]) so every detail page in the dashboard shares the
// same chrome:
//   • 72px top header (X close + page title)
//   • h-[832px] two-column frame inside px-6 py-6 outer padding
//   • 320px left sidebar (decorative banner + key stats + state-aware actions)
//   • Right panel: tabs (Gift card details / Active customers)
//
// Figma references:
//   • Sidebar       — 6096:312094 (cyan pattern banner + 72px gift avatar)
//   • Details tab   — 3726:26161
//   • Customers tab — 3726:26990
//
// State source of truth: useAppStore(s => s.giftCardDesigns). Status flips and
// deletes propagate to the gift-cards list view + POS catalog instantly.

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01, RefreshCcw01, Trash01, Check,
    DotsVertical, SearchMd, Eye, ChevronLeft,
    BankNote01, CalendarPlus02, Calendar, CalendarDate, CoinsHand,
    HelpCircle, Gift01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { DecorativeBanner, BANNER_TINTS } from "@/components/products/DecorativeBanner";
import { giftCardHolders, type GiftCardHolder } from "@/lib/giftCardHolders";
import { useAppStore, type GiftCardDesign } from "@/lib/store";

// ─── Types & helpers ────────────────────────────────────────────────────────

type GiftCardStatus = GiftCardDesign["status"]; // active | inactive | archived

const STATUS_LABEL: Record<GiftCardStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
};

function StatusBadge({ status }: { status: GiftCardStatus }) {
    const styles: Record<GiftCardStatus, string> = {
        active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        archived: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {STATUS_LABEL[status]}
        </span>
    );
}

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** Issued-card expiry as "YYYY-MM-DD, h:mm AM/PM" (UTC) — the "Amount left &
 *  expired" cell on the Active customers tab. */
function formatExpiry(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const pad = (n: number) => String(n).padStart(2, "0");
    const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    let h = d.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${date}, ${h}:${pad(d.getUTCMinutes())} ${ampm}`;
}

/** Gift card loaded value — fixed cards show the exact amount, custom cards
 *  show the purchasable min–max range. */
function amountLabel(g: GiftCardDesign): string {
    if (g.value_type === "custom") {
        return `AED ${(g.min_value_aed ?? 0).toLocaleString("en-US")} – ${(g.max_value_aed ?? 0).toLocaleString("en-US")}`;
    }
    return formatAed(g.fixed_value_aed ?? 0);
}

/** "Valid until" — honours the no-expiry flag. */
function validUntilLabel(g: GiftCardDesign): string {
    if (g.no_expiry) return "No expiry";
    return g.valid_until_date ? formatISODate(g.valid_until_date) : "—";
}

/** Format an ISO date "2026-03-20" as "20 March 2026". */
function formatISODate(iso: string): string {
    if (!iso) return "—";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const months = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? ""} ${m[1]}`;
}

/** Format an ISO timestamp as "Sun, 28 Feb 2025". */
function formatCreatedAt(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ─── Sidebar action button ──────────────────────────────────────────────────

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

// ─── Confirmation modal ─────────────────────────────────────────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const DESTRUCTIVE_ACTIONS = new Set<ModalAction>(["deactivate", "delete"]);

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    title: string; description: string;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        title: "Archive this gift card?",
        description: "This gift card will be removed from the POS catalog. You can recover archived gift cards at any time.",
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        title: "Deactivate this gift card?",
        description: "This gift card will be hidden from new POS sales. Customers who already hold it keep their balance.",
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        title: "Recover this gift card?",
        description: "This gift card will be restored to Active status and become sellable again.",
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        title: "Reactivate this gift card?",
        description: "This gift card will become available again in the POS catalog.",
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash01, iconColor: "text-[#d92d20]",
        title: "Delete this gift card?",
        description: "This gift card will be permanently removed. This action cannot be undone.",
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

// ─── Left sidebar (Figma 6096:312094) ───────────────────────────────────────

function LeftSidebar({ design, customerCount, onAction }: {
    design: GiftCardDesign;
    customerCount: number;
    onAction: (a: "edit" | ModalAction) => void;
}) {
    const status = design.status;
    const hasHolders = customerCount > 0;

    // Action set per the PRD gift-card states:
    //   • Active + holders   → Edit · Archive · Deactivate
    //   • Active + no holders → Edit · Archive · Delete
    //   • Archived            → Recover
    //   • Inactive            → Archive · Reactivate
    const actions = (() => {
        if (status === "archived") {
            return <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover gift card" onClick={() => onAction("recover")} />;
        }
        if (status === "inactive") {
            return (
                <>
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive gift card" onClick={() => onAction("archive")} />
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Reactivate gift card" onClick={() => onAction("reactivate")} />
                </>
            );
        }
        return (
            <>
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit gift card" onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive gift card" onClick={() => onAction("archive")} />
                {hasHolders ? (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate gift card" danger onClick={() => onAction("deactivate")} />
                ) : (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete gift card" danger onClick={() => onAction("delete")} />
                )}
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            <DecorativeBanner bannerHeight={156} iconBox={72} icon={Gift01} {...BANNER_TINTS.giftCard} />

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{design.name}</h2>

                    <div className="flex flex-col gap-3">
                        <SidebarField label="Price" value={formatAed(design.price_aed ?? 0)} />
                        <SidebarField label="Valid until" value={validUntilLabel(design)} />
                        <SidebarField label="Active customers" value={`${customerCount} ${customerCount === 1 ? "Customer" : "Customers"}`} />
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Status</p>
                            <div><StatusBadge status={status} /></div>
                        </div>
                    </div>
                </div>

                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Gift card actions</p>
                    <div className="flex flex-col gap-4">{actions}</div>
                </div>
            </div>
        </div>
    );
}

function SidebarField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
        </div>
    );
}

// ─── Right panel ────────────────────────────────────────────────────────────

type TabId = "details" | "customers";

function RightPanel({ design, holders }: {
    design: GiftCardDesign;
    holders: GiftCardHolder[];
}) {
    const [tab, setTab] = useState<TabId>("details");

    const tabsCopy: { id: TabId; label: string }[] = [
        { id: "details",   label: "Gift card details" },
        { id: "customers", label: "Active customers" },
    ];

    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                <div className="flex gap-1">
                    {tabsCopy.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={cn(
                                "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                tab === t.id
                                    ? "border-b-2 border-[#101828] text-[#101828]"
                                    : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "details"
                ? <DetailsTab design={design} />
                : <ActiveCustomersTab holders={holders} cardName={design.name} />}
        </div>
    );
}

// ─── Details tab (Figma 3726:26161) ─────────────────────────────────────────

function DetailsTab({ design }: { design: GiftCardDesign }) {
    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            {/* ── Basic information ── */}
            <SectionHeading>Basic information</SectionHeading>
            <DescriptionCard body={design.description || "—"} />
            <InlineStatRow>
                <InlineStat
                    icon={<BankNote01 className="w-5 h-5" />}
                    label="Gift card price"
                    value={formatAed(design.price_aed ?? 0)}
                />
                <InlineStat
                    icon={<CalendarPlus02 className="w-5 h-5" />}
                    label="Date created"
                    value={formatCreatedAt(design.created_at)}
                />
            </InlineStatRow>

            {/* ── Product configuration ── */}
            <SectionHeading>Product configuration</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<Gift01 className="w-5 h-5" />}
                    label="Gift card number"
                    value={design.gift_card_number || "—"}
                />
                <InlineStat
                    icon={<BankNote01 className="w-5 h-5" />}
                    label="Gift card amount"
                    value={amountLabel(design)}
                />
            </InlineStatRow>
            <InlineStatRow>
                <InlineStat
                    icon={<CoinsHand className="w-5 h-5" />}
                    label="Custom amount"
                    value={design.value_type === "custom" ? "Yes" : "No"}
                    tooltip="Allow customers to enter their own amount"
                />
                <div />
            </InlineStatRow>

            {/* ── Duration configuration ── */}
            <SectionHeading>Duration configuration</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<CalendarDate className="w-5 h-5" />}
                    label="Expiry gift card"
                    value={design.no_expiry ? "No" : "Yes"}
                />
                <InlineStat
                    icon={<Calendar className="w-5 h-5" />}
                    label="Valid until"
                    value={validUntilLabel(design)}
                />
            </InlineStatRow>
        </div>
    );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] text-[#667085] mt-2 first:mt-0">{children}</p>;
}

function DescriptionCard({ body }: { body: string }) {
    const [expanded, setExpanded] = useState(false);
    const isTruncatable = body.length > 280;
    const shown = expanded || !isTruncatable ? body : `${body.slice(0, 280).trimEnd()}…`;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <p className="text-[14px] text-[#667085] leading-5">Description</p>
            <p className="text-[16px] text-[#101828] leading-6 whitespace-pre-line">{shown}</p>
            {isTruncatable && (
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="self-start text-[14px] font-medium text-[#658774] hover:text-[#4f6e5d] transition-colors">
                    {expanded ? "See less" : "See more"}
                </button>
            )}
        </div>
    );
}

function InlineStatRow({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

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

// ─── Active customers tab (Figma 3726:26990) ────────────────────────────────

function ActiveCustomersTab({ holders, cardName }: {
    holders: GiftCardHolder[]; cardName: string;
}) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [search]);

    const q = search.trim().toLowerCase();
    const filtered = useMemo(() => holders.filter(h => {
        if (!q) return true;
        const c = h.customer;
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ""}`.toLowerCase();
        return hay.includes(q);
    }), [holders, q]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const paged = filtered.slice((clamped - 1) * pageSize, clamped * pageSize);

    return (
        <>
            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {filtered.length} {filtered.length === 1 ? "Customer" : "Customers"}
                    </p>
                </div>
                <div className="relative w-[220px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search customer..."
                        className="h-9 w-full pl-[36px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {filtered.length === 0 ? (
                    <EmptyState
                        title={holders.length === 0 ? "No active customers" : "No customers found"}
                        subtitle={holders.length === 0
                            ? `No customers currently hold ${cardName}.`
                            : "Try adjusting your search."}
                    />
                ) : (
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">Name</th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">Contact</th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">Amount left &amp; expired</th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec] w-[52px]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(h => <HolderRow key={h.issuedCard.id} holder={h} />)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            <div className="px-6 shrink-0">
                <CustomersPagination
                    page={clamped} total={filtered.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            </div>
        </>
    );
}

function HolderRow({ holder }: { holder: GiftCardHolder }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const c = holder.customer;

    return (
        <tr className="hover:bg-[#f9fafb] transition-colors">
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="flex items-center gap-3">
                    <CustomerAvatar customer={c} />
                    <span className="text-[14px] font-medium text-[#101828]">{c.firstName} {c.lastName}</span>
                </div>
            </td>
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="flex flex-col">
                    <span className="text-[14px] text-[#101828]">{c.email}</span>
                    {c.phone && <span className="text-[14px] text-[#667085]">{c.phone}</span>}
                </div>
            </td>
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="flex flex-col">
                    <span className="text-[14px] font-medium text-[#101828]">{formatAed(holder.issuedCard.current_balance_aed)} left</span>
                    <span className="text-[14px] text-[#475467]">{formatExpiry(holder.issuedCard.expires_at)}</span>
                </div>
            </td>
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="relative">
                    <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                        <DotsVertical className="w-4 h-4 text-[#667085]" />
                    </button>
                    <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                        <button type="button"
                            onClick={() => { setOpen(false); router.push(`/customers/${c.id}`); }}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            <Eye className="w-4 h-4 text-[#667085]" />View customer
                        </button>
                    </FixedDropdown>
                </div>
            </td>
        </tr>
    );
}

function CustomerAvatar({ customer }: { customer: GiftCardHolder["customer"] }) {
    if (customer.imageUrl) {
        return <img src={customer.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />;
    }
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
            style={{ backgroundColor: "#658774" }}>
            {customer.initials}
        </div>
    );
}

function CustomersPagination({ page, total, pageSize, onPage, onPageSize }: {
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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function GiftCardDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";

    const giftCardDesigns         = useAppStore(s => s.giftCardDesigns);
    const issuedGiftCards         = useAppStore(s => s.issuedGiftCards);
    const customers               = useAppStore(s => s.customers);
    const setGiftCardDesignStatus = useAppStore(s => s.setGiftCardDesignStatus);
    const deleteGiftCardDesign    = useAppStore(s => s.deleteGiftCardDesign);
    const showToast               = useAppStore(s => s.showToast);

    const design = giftCardDesigns.find(g => g.id === id) ?? null;

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    const holders = useMemo(
        () => (design ? giftCardHolders(design.id, issuedGiftCards, customers) : []),
        [design, issuedGiftCards, customers],
    );

    if (!design) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Gift card not found</p>
                <button type="button" onClick={() => router.push("/admin/products/gift-cards")}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to gift cards
                </button>
            </div>
        );
    }

    function handleAction(a: "edit" | ModalAction) {
        if (a === "edit") {
            router.push(`/products/gift-cards/${id}/edit`);
            return;
        }
        setConfirmAction(a);
    }

    function handleConfirm() {
        if (!confirmAction || !design) return;
        const name = design.name;
        if (confirmAction === "archive") {
            setGiftCardDesignStatus([id], "archived");
            showToast("Gift card archived", `${name} has been archived.`, "success", "archive");
            setConfirmAction(null);
        } else if (confirmAction === "deactivate") {
            setGiftCardDesignStatus([id], "inactive");
            showToast("Gift card deactivated", `${name} has been deactivated.`, "error", "slash");
            setConfirmAction(null);
        } else if (confirmAction === "recover") {
            setGiftCardDesignStatus([id], "active");
            showToast("Gift card recovered", `${name} has been recovered and is now active.`, "success", "refresh");
            setConfirmAction(null);
        } else if (confirmAction === "reactivate") {
            setGiftCardDesignStatus([id], "active");
            showToast("Gift card reactivated", `${name} is now active again.`, "success", "check");
            setConfirmAction(null);
        } else if (confirmAction === "delete") {
            deleteGiftCardDesign(id);
            showToast("Gift card deleted", `${name} has been deleted.`, "success", "trash");
            setConfirmAction(null);
            router.push("/admin/products/gift-cards");
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as the membership/package detail page */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push("/admin/products/gift-cards")}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Gift card details</h1>
            </div>

            {/* Body — px-6 py-6 outer + h-[832px] two-column frame */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <LeftSidebar
                        design={design}
                        customerCount={holders.length}
                        onAction={handleAction}
                    />
                    <RightPanel design={design} holders={holders} />
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
