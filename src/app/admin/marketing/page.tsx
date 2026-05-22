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
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, BRANCHES, DEFAULT_BRANCH_ID, type MarketingItem } from "@/lib/store";

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

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** ISO → "20 March 2026, 12:00 AM" (UTC) for the "Valid until" row. */
function formatValidUntil(iso?: string): string {
    if (!iso) return "No expiry";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    let h = d.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${h}:${mm} ${ampm}`;
}

const TYPE_LABEL: Record<MarketingItem["type"], string> = {
    new_class: "New class",
    announcement: "Announcement",
    event: "Event",
};

const ACTION_LABEL: Record<MarketingItem["action_type"], string> = {
    book_event: "Book an event",
    buy_ticket: "Buy a ticket",
    external_link: "External link",
    no_action: "No action",
};

/** "All branches" when the item covers every branch, else "N branches". */
function branchLabel(branchIds: string[] | undefined): string {
    const n = branchIds?.length ?? 0;
    if (n === 0 || n >= BRANCHES.length) return "All branches";
    return `${n} ${n === 1 ? "branch" : "branches"}`;
}

// ─── Badges ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: EffectiveStatus }) {
    // Active is the only "live" state → green. Inactive / Archive / Expired
    // share the neutral gray treatment.
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

/** Marketing-type badge — translucent dark pill on the banner top-left. */
function TypeBadge({ type }: { type: MarketingItem["type"] }) {
    return (
        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium text-white bg-black/40 backdrop-blur-[8px] whitespace-nowrap">
            {TYPE_LABEL[type]}
        </span>
    );
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

function MarketingCardView({ item, onOpen }: { item: MarketingItem; onOpen: () => void }) {
    const status = effectiveStatus(item);
    // Active items get the deep-slate gradient fallback; inactive / archived /
    // expired items render the muted gray gradient (Figma grayscale state).
    const bannerClass = status === "active"
        ? "bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467]"
        : "bg-gradient-to-br from-[#475467] via-[#667085] to-[#98a2b3]";

    return (
        <div
            onClick={onOpen}
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col cursor-pointer",
                "transition-all duration-150",
                "hover:border-[#658774] hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.08),0px_2px_4px_-2px_rgba(16,24,40,0.03)]",
            )}>
            {/* Banner */}
            <div className={cn("relative h-[144px] flex flex-col justify-between p-3 shrink-0 overflow-hidden", bannerClass)}>
                {/* Cover artwork — inactive / archived / expired render grayscale */}
                {item.cover_image_url && (
                    <img src={item.cover_image_url} alt=""
                        className={cn("absolute inset-0 w-full h-full object-cover", status !== "active" && "grayscale")} />
                )}
                {/* Dark vignette so the white text stays legible on any banner */}
                <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(12,17,29,0.1)_0%,rgba(12,17,29,0.72)_100%)]" />
                {/* Status badge — top right */}
                <div className="absolute top-3 right-3 z-10">
                    <StatusBadge status={status} />
                </div>
                {/* Type badge — top left, in flow */}
                <div className="relative z-10">
                    <TypeBadge type={item.type} />
                </div>
                {/* Title */}
                <p className="relative z-10 text-[20px] font-semibold text-white leading-[30px] uppercase line-clamp-2">
                    {item.title}
                </p>
                <p className="relative z-10 text-[12px] text-[#d0d5dd] leading-[18px]">*T&amp;Cs Apply</p>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-4 py-5">
                <div className="flex flex-col gap-1">
                    <p className="text-[18px] font-medium text-[#101828] leading-7 truncate">
                        {item.title}
                    </p>
                    <p className="text-[14px] text-[#667085] leading-5 line-clamp-2">
                        {item.short_description || "—"}
                    </p>
                </div>

                {/* Attribute row — action · branches */}
                <div className="grid grid-cols-2 gap-x-3">
                    <MarketingAttribute
                        icon={<CursorBox className="w-4 h-4" />}
                        label={ACTION_LABEL[item.action_type]}
                    />
                    <MarketingAttribute
                        icon={<MarkerPin01 className="w-4 h-4" />}
                        label={branchLabel(item.branch_ids)}
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

    if (!open) return null;

    const hasAny = pending.statuses.length > 0 || !!pending.startDate || !!pending.endDate;

    function toggleStatus(s: StoredStatus) {
        setPending(p => ({
            ...p,
            statuses: p.statuses.includes(s) ? p.statuses.filter(x => x !== s) : [...p.statuses, s],
        }));
    }

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
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

                    <div className="h-px bg-[#e4e7ec]" />

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
            </div>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MarketingListPage() {
    const router = useRouter();
    const marketingItems = useAppStore(s => s.marketingItems);

    const [search, setSearch] = useState("");
    // Default to the user's primary branch — matches the POS / schedule /
    // dashboard / products / promo pickers (all seed from DEFAULT_BRANCH_ID).
    const [locationId, setLocationId] = useState(DEFAULT_BRANCH_ID);
    const [filter, setFilter] = useState<MarketingFilter>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    const hasActiveFilter = filter.statuses.length > 0 || !!filter.startDate || !!filter.endDate;

    // Branch picker — active branches, each option carrying a MarkerPin01
    // glyph so the dropdown matches the POS / schedule / dashboard pickers.
    const locationOptions = useMemo(() => BRANCHES
        .filter(b => b.status === "active")
        .map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })), []);

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
                        {visible.length} {visible.length === 1 ? "marketing" : "marketings"}
                    </p>
                </div>

                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={locationOptions}
                    value={locationId}
                    onChange={setLocationId}
                    width="w-[220px]"
                />

                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search marketing..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>

                <Button variant="secondary-gray" size="md"
                    leftIcon={
                        <div className="relative">
                            <FilterLines className="w-4 h-4" />
                            {hasActiveFilter && (
                                <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />
                            )}
                        </div>
                    }
                    onClick={() => setFilterOpen(true)}>
                    Filter
                </Button>

                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push("/marketing/new")}>
                    Add marketing
                </Button>
            </div>

            {/* ── Card grid ── */}
            {visible.length === 0 ? (
                <div className="relative flex-1" style={{ minHeight: 400 }}>
                    <EmptyState
                        title={marketingItems.length === 0 ? "No marketing content yet" : "No marketing found"}
                        subtitle={marketingItems.length === 0
                            ? "Create your first campaign to engage your members."
                            : "Try adjusting your search or filters."}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-3 gap-4">
                    {visible.map(m => (
                        <MarketingCardView key={m.id} item={m}
                            onOpen={() => router.push(`/marketing/${m.id}`)} />
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
