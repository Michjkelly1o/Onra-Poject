"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing module list view (/admin/marketing)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 5885:176274 (list view) + 5885:174980 (filter content).
//
// Structurally a sibling of the Promo list (/admin/products/promo-codes) — a
// 3-column grid of banner cards. Each marketing card paints a cover image (or
// gradient fallback) with a type badge + status badge, then the title /
// description / attribute row (action · branches) and the valid-until row.
//
// State source of truth: useAppStore(s => s.marketingItems). The toolbar
// carries a branch picker, search, a side-panel filter (Status + Marketing
// date range), and the "Add marketing" button (creation flow ships next step).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, XClose, MarkerPin01, CursorBox,
    Eye, Edit02, Archive, SlashCircle01, RefreshCcw01, Check, Trash02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type MarketingItem } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions, type RowActionItem } from "@/components/patterns/RowActions";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

// Card-embedded kebab menu actions — mirrors the detail-page action set so
// the list can drive Archive / Deactivate / Delete / Recover / Reactivate
// without navigating away first (client Jul 2026).
type CampaignCardAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";
const CAMPAIGN_DESTRUCTIVE = new Set<CampaignCardAction>(["deactivate", "delete"]);
const CAMPAIGN_MODAL_CFG: Record<CampaignCardAction, { IconComp: React.ElementType; title: string; description: string; confirmLabel: string }> = {
    archive: {
        IconComp: Archive,
        title: "Archive this campaign?",
        description: "Are you sure you want to archive this campaign? It will no longer be sent to customers.",
        confirmLabel: "Archive",
    },
    deactivate: {
        IconComp: SlashCircle01,
        title: "Deactivate this campaign?",
        description: "Are you sure you want to deactivate this campaign? It will pause and can be reactivated later.",
        confirmLabel: "Deactivate",
    },
    recover: {
        IconComp: RefreshCcw01,
        title: "Recover this campaign?",
        description: "Are you sure you want to recover this campaign from archive?",
        confirmLabel: "Recover",
    },
    reactivate: {
        IconComp: Check,
        title: "Reactivate this campaign?",
        description: "Are you sure you want to reactivate this campaign? It will resume sending to customers.",
        confirmLabel: "Reactivate",
    },
    delete: {
        IconComp: Trash02,
        title: "Delete this campaign?",
        description: "Are you sure you want to delete this campaign? This action cannot be undone.",
        confirmLabel: "Delete",
    },
};

// ─── Status helpers ──────────────────────────────────────────────────────────

type StoredStatus = MarketingItem["status"];        // active | inactive | archived
type EffectiveStatus = StoredStatus | "expired";    // expired derived from expiry_date

const STATUS_LABEL: Record<EffectiveStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
    expired: "Expired",
};

/** A marketing item reads as "Expired" the moment its `expiry_date` passes —
 *  regardless of the stored admin status. Otherwise it shows its stored status. */
function effectiveStatus(m: MarketingItem): EffectiveStatus {
    if (m.expiry_date && new Date(m.expiry_date).getTime() < Date.now()) return "expired";
    return m.status;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** ISO → "31/12/2026, 12:00 AM" (DD/MM/YYYY + time, UTC) for the
 *  "Valid until" row. Compact date so 4 cards per row don't wrap
 *  (client-flagged Jul 2026); time is preserved. */
function formatValidUntil(iso?: string): string {
    if (!iso) return "No expiry";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    let h = d.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${dd}/${mo}/${d.getUTCFullYear()}, ${h}:${mm} ${ampm}`;
}

const ACTION_LABEL: Record<MarketingItem["action_type"], string> = {
    book_event: "Book an event",
    buy_ticket: "Buy a ticket",
    external_link: "External link",
    no_action: "No action",
};

/** "All branches" when the item covers every branch, else "N branches". */
function branchLabel(branchIds: string[] | undefined, totalBranches: number): string {
    const n = branchIds?.length ?? 0;
    if (n === 0 || n >= totalBranches) return "All branches";
    return `${n} ${n === 1 ? "branch" : "branches"}`;
}

// ─── Marketing card (Figma 6160:197552) ──────────────────────────────────────

function MarketingAttribute({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 shrink-0 text-[#667085]">{icon}</span>
            <span className="text-[14px] text-[#667085] truncate">{label}</span>
        </div>
    );
}

function MarketingCardView({ item, onOpen, totalBranches }: { item: MarketingItem; onOpen: () => void; totalBranches: number }) {
    const router = useRouter();
    const status = effectiveStatus(item);
    // Active items get the deep-slate gradient fallback; inactive / archived /
    // expired items render the muted gray gradient (Figma grayscale state).
    const bannerClass = status === "active"
        ? "bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467]"
        : "bg-gradient-to-br from-[#475467] via-[#667085] to-[#98a2b3]";
    // ── Kebab menu wiring ────────────────────────────────────────────────
    const updateMarketingItem = useAppStore(s => s.updateMarketingItem);
    const deleteMarketingItem = useAppStore(s => s.deleteMarketingItem);
    const showToast           = useAppStore(s => s.showToast);
    const [confirmAction, setConfirmAction] = useState<CampaignCardAction | null>(null);
    const canDelete = (item.view_count ?? 0) === 0;
    const editHref  = `/marketing/${item.id}/edit?returnTo=${encodeURIComponent("/admin/marketing")}`;
    const items: RowActionItem[] = (() => {
        const base: RowActionItem[] = [{ label: "View details", icon: Eye, onClick: onOpen }];
        if (item.status === "archived") {
            base.push({ label: "Recover campaign", icon: RefreshCcw01, onClick: () => setConfirmAction("recover") });
            return base;
        }
        if (item.status === "inactive") {
            base.push({ label: "Reactivate campaign", icon: RefreshCcw01, onClick: () => setConfirmAction("reactivate") });
            base.push({ label: "Archive campaign", icon: Archive, onClick: () => setConfirmAction("archive") });
            return base;
        }
        // Active
        base.push({ label: "Edit campaign", icon: Edit02, onClick: () => router.push(editHref) });
        base.push({ label: "Archive campaign", icon: Archive, onClick: () => setConfirmAction("archive") });
        if (canDelete) {
            base.push({ label: "Delete campaign", icon: Trash02, danger: true, onClick: () => setConfirmAction("delete") });
        } else {
            base.push({ label: "Deactivate campaign", icon: SlashCircle01, danger: true, onClick: () => setConfirmAction("deactivate") });
        }
        return base;
    })();

    function handleConfirm() {
        if (!confirmAction) return;
        const name = item.title;
        switch (confirmAction) {
            case "delete":
                if (deleteMarketingItem(item.id)) {
                    showToast("Campaign deleted", `${name} has been deleted.`, "success", "trash");
                }
                break;
            case "archive":
                updateMarketingItem(item.id, { status: "archived" });
                showToast("Campaign archived", `${name} has been archived.`, "success", "archive");
                break;
            case "deactivate":
                updateMarketingItem(item.id, { status: "inactive" });
                showToast("Campaign deactivated", `${name} is no longer active.`, "error", "slash");
                break;
            case "recover":
                updateMarketingItem(item.id, { status: "active" });
                showToast("Campaign recovered", `${name} is active again.`, "success", "check");
                break;
            case "reactivate":
                updateMarketingItem(item.id, { status: "active" });
                showToast("Campaign reactivated", `${name} is active again.`, "success", "check");
                break;
        }
        setConfirmAction(null);
    }

    return (
        <>
        <div
            onClick={onOpen}
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col cursor-pointer",
                "transition-all duration-150",
                "hover:border-[#658774] hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.08),0px_2px_4px_-2px_rgba(16,24,40,0.03)]",
            )}>
            {/* Banner — fixed 4:3 so the cover art stays the same shape at
                every screen width instead of stretching wide on large monitors. */}
            <div className={cn("relative aspect-[4/3] shrink-0 overflow-hidden", bannerClass)}>
                {/* Image-only banner — the campaign artwork carries all copy.
                    Inactive / archived / expired render grayscale. */}
                {item.cover_image_url && (
                    <img src={item.cover_image_url} alt={item.title}
                        className={cn("absolute inset-0 w-full h-full object-cover", status !== "active" && "grayscale")} />
                )}
                {/* Status badge — top right (admin status indicator, not campaign copy) */}
                <div className="absolute top-3 right-3 z-10">
                    <StatusBadge type="marketing" status={status} size="lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-4 py-5">
                <div className="flex flex-row items-start gap-2">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[18px] font-medium text-[#101828] leading-7 truncate">
                            {item.title}
                        </p>
                        <p className="text-[14px] text-[#667085] leading-5 line-clamp-2">
                            {item.short_description || "—"}
                        </p>
                    </div>
                    {/* Kebab — stop propagation so the card's own onClick doesn't fire alongside. */}
                    <div className="shrink-0 -mr-2 -mt-1" onClick={e => e.stopPropagation()}>
                        <RowActions items={items} minWidth={220} triggerLabel="Campaign actions" />
                    </div>
                </div>

                {/* Attribute row — action · branches */}
                <div className="grid grid-cols-2 gap-x-3">
                    <MarketingAttribute
                        icon={<CursorBox className="w-4 h-4" />}
                        label={ACTION_LABEL[item.action_type]}
                    />
                    <MarketingAttribute
                        icon={<MarkerPin01 className="w-4 h-4" />}
                        label={branchLabel(item.branch_ids, totalBranches)}
                    />
                </div>

                {/* Dashed divider */}
                <div className="border-t border-dashed border-[#e4e7ec]" />

                {/* Valid until */}
                <div className="flex items-center gap-1 text-[14px]">
                    <span className="text-[#667085]">Valid until</span>
                    <span className="font-medium text-[#101828]">{formatValidUntil(item.expiry_date)}</span>
                </div>
            </div>
        </div>
        {confirmAction && (() => {
            const cfg = CAMPAIGN_MODAL_CFG[confirmAction];
            const tone = CAMPAIGN_DESTRUCTIVE.has(confirmAction) ? "danger" : "success";
            return (
                <ConfirmModal
                    open
                    onClose={() => setConfirmAction(null)}
                    icon={cfg.IconComp}
                    tone={tone}
                    title={cfg.title}
                    description={cfg.description}
                    confirmLabel={cfg.confirmLabel}
                    onConfirm={handleConfirm}
                />
            );
        })()}
        </>
    );
}

// ─── Filter pill (multi-select status) ───────────────────────────────────────

function FilterPill({ label, selected, onClick }: {
    label: string; selected: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium border-1 transition-colors",
                selected
                    ? "bg-[#f5fffa] border-[#7ba08c] text-[#3b5446]"
                    : "bg-white border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

// ─── Filter side panel (Figma 5885:174980) ───────────────────────────────────

interface MarketingFilter {
    statuses: StoredStatus[];
    startDate: string;
    endDate: string;
}
const EMPTY_FILTER: MarketingFilter = { statuses: [], startDate: "", endDate: "" };

const FILTER_STATUSES: StoredStatus[] = ["active", "inactive", "archived"];

function FilterPanel({ open, applied, onClose, onApply }: {
    open: boolean;
    applied: MarketingFilter;
    onClose: () => void;
    onApply: (next: MarketingFilter) => void;
}) {
    const [pending, setPending] = useState<MarketingFilter>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    const hasAny = pending.statuses.length > 0 || !!pending.startDate || !!pending.endDate;

    function toggleStatus(s: StoredStatus) {
        setPending(p => ({
            ...p,
            statuses: p.statuses.includes(s) ? p.statuses.filter(x => x !== s) : [...p.statuses, s],
        }));
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Status — multi-select pills */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {FILTER_STATUSES.map(s => (
                                <FilterPill key={s} label={STATUS_LABEL[s]}
                                    selected={pending.statuses.includes(s)}
                                    onClick={() => toggleStatus(s)} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Marketing date range — filters by the item's expiry date */}
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[14px] font-medium text-[#344054]">Marketing date range</p>
                        <div className="flex gap-4 items-start">
                            <div className="flex-1 min-w-0">
                                <DatePicker
                                    value={pending.startDate}
                                    onChange={iso => setPending(p => ({
                                        ...p,
                                        startDate: iso,
                                        // Keep end ≥ start.
                                        endDate: p.endDate && iso && p.endDate < iso ? "" : p.endDate,
                                    }))}
                                    placeholder="Start date"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <DatePicker
                                    value={pending.endDate}
                                    onChange={iso => setPending(p => ({ ...p, endDate: iso }))}
                                    placeholder="End date"
                                    minDate={pending.startDate || undefined}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarketingListPage() {
    const router = useRouter();
    const marketingItems = useAppStore(s => s.marketingItems);
    const branches = useAppStore(s => s.branches);

    const [search, setSearch] = useState("");
    // "" = "All locations" — marketing items default to the aggregate view.
    const [locationId, setLocationId] = useState<string>("");
    const [filter, setFilter] = useState<MarketingFilter>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    const hasActiveFilter = filter.statuses.length > 0 || !!filter.startDate || !!filter.endDate;

    // Branch picker — active branches from the live `branches` slice, each
    // option carrying a MarkerPin01 glyph so the dropdown matches the
    // POS / schedule / dashboard pickers.
    const locationOptions = useMemo(() => branches
        .filter(b => b.status === "active")
        .map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })), [branches]);
    const totalBranches = branches.length;

    // ─── Filter + search ───────────────────────────────────────────────────
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return marketingItems.filter(m => {
            if (q) {
                const hay = `${m.title} ${m.short_description}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (locationId) {
                const ids = m.branch_ids ?? [];
                // Empty branch_ids = available everywhere.
                if (ids.length > 0 && !ids.includes(locationId)) return false;
            }
            if (filter.statuses.length > 0 && !filter.statuses.includes(m.status)) return false;
            if (filter.startDate && (!m.expiry_date || m.expiry_date.slice(0, 10) < filter.startDate)) return false;
            if (filter.endDate && (!m.expiry_date || m.expiry_date.slice(0, 10) > filter.endDate)) return false;
            return true;
        });
    }, [marketingItems, search, locationId, filter]);

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {visible.length} {visible.length === 1 ? "campaign" : "campaigns"}
                    </p>
                </div>

                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={locationId}
                    onChange={setLocationId}
                    width="w-[220px]"
                />

                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search campaigns..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>

                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />

                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push(`/marketing/new?returnTo=${encodeURIComponent("/admin/marketing")}`)}>
                    Add campaign
                </Button>
            </div>

            {/* ── Card grid ── */}
            {visible.length === 0 ? (
                <div className="relative flex-1" style={{ minHeight: 400 }}>
                    <EmptyState
                        title={marketingItems.length === 0 ? "No campaigns yet" : "No campaigns found"}
                        subtitle={marketingItems.length === 0
                            ? "Create your first campaign to engage your customers."
                            : "Try adjusting your search or filters."}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-4">
                    {visible.map(m => (
                        <MarketingCardView key={m.id} item={m} totalBranches={totalBranches}
                            onOpen={() => router.push(`/marketing/${m.id}?returnTo=${encodeURIComponent("/admin/marketing")}`)} />
                    ))}
                </div>
            )}

            <FilterPanel
                open={filterOpen}
                applied={filter}
                onClose={() => setFilterOpen(false)}
                onApply={setFilter}
            />

            <Toast />
        </div>
    );
}
