"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Announcements module list view (/admin/marketing/announcements)
// ─────────────────────────────────────────────────────────────────────────────
//
// Announcements are their OWN marketing module (split out of Campaigns). Same
// card-grid layout, same actions, same store — this view simply scopes the
// shared `marketingItems` slice to `type === "announcement"` and routes its
// create/detail/edit to the `/announcements` namespace.
//
// State source of truth: useAppStore(s => s.marketingItems), filtered to
// announcements. The toolbar carries a branch picker, search, a side-panel
// filter (Status + date range), and the "Add" button.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Plus, XClose, MarkerPin01, CursorBox,
    Eye, Edit02, Archive, SlashCircle01, RefreshCcw01, Check, Trash02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { usePersistedListState } from "@/lib/list-ui-cache";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type MarketingItem } from "@/lib/store";
import { openMarketingFormPanel } from "@/lib/marketing-form-panel";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions, type RowActionItem } from "@/components/patterns/RowActions";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { marketingExportData } from "@/lib/export/specs/marketing";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ArchivedSection } from "@/components/patterns/ArchivedSection";
import { useArchiveView } from "@/lib/hooks/useArchiveView";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

const LIST_PATH = "/admin/marketing/announcements";

// Card-embedded kebab menu actions — mirrors the detail-page action set.
type AnnouncementCardAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";
const ANNOUNCEMENT_DESTRUCTIVE = new Set<AnnouncementCardAction>(["deactivate", "delete"]);
const ANNOUNCEMENT_MODAL_CFG: Record<AnnouncementCardAction, { IconComp: React.ElementType; title: string; description: string; confirmLabel: string }> = {
    archive: {
        IconComp: Archive,
        title: "Archive this announcement?",
        description: "Are you sure you want to archive this announcement? It will no longer be shown to customers.",
        confirmLabel: "Archive",
    },
    deactivate: {
        IconComp: SlashCircle01,
        title: "Deactivate this announcement?",
        description: "Are you sure you want to deactivate this announcement? It will pause and can be reactivated later.",
        confirmLabel: "Deactivate",
    },
    recover: {
        IconComp: RefreshCcw01,
        title: "Recover this announcement?",
        description: "Are you sure you want to recover this announcement from archive?",
        confirmLabel: "Recover",
    },
    reactivate: {
        IconComp: Check,
        title: "Reactivate this announcement?",
        description: "Are you sure you want to reactivate this announcement? It will resume showing to customers.",
        confirmLabel: "Reactivate",
    },
    delete: {
        IconComp: Trash02,
        title: "Delete this announcement?",
        description: "Are you sure you want to delete this announcement? This action cannot be undone.",
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

/** An announcement reads as "Expired" the moment its `expiry_date` passes —
 *  regardless of the stored admin status. Otherwise it shows its stored status. */
function effectiveStatus(m: MarketingItem): EffectiveStatus {
    if (m.expiry_date && new Date(m.expiry_date).getTime() < Date.now()) return "expired";
    return m.status;
}

// ─── Display helpers ─────────────────────────────────────────────────────────

/** ISO → "31/12/2026, 12:00 AM" (DD/MM/YYYY + time, UTC) for the "Valid until" row. */
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
    return `${dd}/${mo}/${d.getUTCFullYear()}, ${mm === "00" ? `${h}` : `${h}.${mm}`} ${ampm}`;
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

// ─── Announcement card ───────────────────────────────────────────────────────

function AnnouncementAttribute({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 shrink-0 text-[var(--colors-text-quaternary)]">{icon}</span>
            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{label}</span>
        </div>
    );
}

function AnnouncementCardView({ item, onOpen, totalBranches }: { item: MarketingItem; onOpen: () => void; totalBranches: number }) {
    const router = useRouter();
    const status = effectiveStatus(item);
    const bannerClass = status === "active"
        ? "bg-gradient-to-br from-[#1d2939] via-[var(--colors-text-secondary)] to-[var(--colors-text-tertiary)]"
        : "bg-gradient-to-br from-[var(--colors-text-tertiary)] via-[var(--colors-text-quaternary)] to-[var(--colors-fg-quaternary)]";
    const updateMarketingItem = useAppStore(s => s.updateMarketingItem);
    const deleteMarketingItem = useAppStore(s => s.deleteMarketingItem);
    const showToast           = useAppStore(s => s.showToast);
    const [confirmAction, setConfirmAction] = useState<AnnouncementCardAction | null>(null);
    const canDelete = (item.view_count ?? 0) === 0;
    const items: RowActionItem[] = (() => {
        const base: RowActionItem[] = [{ label: "View details", icon: Eye, onClick: onOpen }];
        if (item.status === "archived") {
            base.push({ label: "Recover announcement", icon: RefreshCcw01, onClick: () => setConfirmAction("recover") });
            return base;
        }
        if (item.status === "inactive") {
            base.push({ label: "Reactivate announcement", icon: RefreshCcw01, onClick: () => setConfirmAction("reactivate") });
            base.push({ label: "Archive announcement", icon: Archive, onClick: () => setConfirmAction("archive") });
            return base;
        }
        // Active
        base.push({ label: "Edit announcement", icon: Edit02, onClick: () => openMarketingFormPanel({ kind: "announcement", mode: "edit", id: item.id }) });
        base.push({ label: "Archive announcement", icon: Archive, onClick: () => setConfirmAction("archive") });
        if (canDelete) {
            base.push({ label: "Delete announcement", icon: Trash02, danger: true, onClick: () => setConfirmAction("delete") });
        } else {
            base.push({ label: "Deactivate announcement", icon: SlashCircle01, danger: true, onClick: () => setConfirmAction("deactivate") });
        }
        return base;
    })();

    function handleConfirm() {
        if (!confirmAction) return;
        const name = item.title;
        switch (confirmAction) {
            case "delete":
                if (deleteMarketingItem(item.id)) {
                    showToast("Announcement deleted", `${name} has been deleted.`, "success", "trash");
                }
                break;
            case "archive":
                updateMarketingItem(item.id, { status: "archived" });
                showToast("Announcement archived", `${name} has been archived.`, "success", "archive");
                break;
            case "deactivate":
                updateMarketingItem(item.id, { status: "inactive" });
                showToast("Announcement deactivated", `${name} is no longer active.`, "error", "slash");
                break;
            case "recover":
                updateMarketingItem(item.id, { status: "active" });
                showToast("Announcement recovered", `${name} is active again.`, "success", "check");
                break;
            case "reactivate":
                updateMarketingItem(item.id, { status: "active" });
                showToast("Announcement reactivated", `${name} is active again.`, "success", "check");
                break;
        }
        setConfirmAction(null);
    }

    return (
        <>
        <div
            onClick={onOpen}
            className={cn(
                "bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] overflow-hidden flex flex-col cursor-pointer",
                "transition-all duration-150",
                "hover:border-[var(--colors-secondary-600)] hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.08),0px_2px_4px_-2px_rgba(16,24,40,0.03)]",
            )}>
            <div className={cn("relative aspect-[343/140] shrink-0 overflow-hidden", bannerClass)}>
                {item.cover_image_url && (
                    <img src={item.cover_image_url} alt={item.title}
                        className={cn("absolute inset-0 w-full h-full object-cover", status !== "active" && "grayscale")} />
                )}
                <div className="absolute top-3 right-3 z-10">
                    <StatusBadge type="marketing" status={status} size="lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-4 py-5">
                <div className="flex flex-row items-start gap-2">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[18px] font-medium text-[var(--colors-text-primary)] leading-7 truncate">
                            {item.title}
                        </p>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-5 line-clamp-2">
                            {item.short_description || "—"}
                        </p>
                    </div>
                    <div className="shrink-0 -mr-2 -mt-1" onClick={e => e.stopPropagation()}>
                        <RowActions items={items} minWidth={240} triggerLabel="Announcement actions" />
                    </div>
                </div>

                {/* Attribute row — action · branches */}
                <div className="grid grid-cols-2 gap-x-3">
                    <AnnouncementAttribute
                        icon={<CursorBox className="w-4 h-4" />}
                        label={ACTION_LABEL[item.action_type]}
                    />
                    <AnnouncementAttribute
                        icon={<MarkerPin01 className="w-4 h-4" />}
                        label={branchLabel(item.branch_ids, totalBranches)}
                    />
                </div>

                {/* Dashed divider */}
                <div className="border-t border-dashed border-[var(--colors-border-secondary)]" />

                {/* Valid until */}
                <div className="flex items-center gap-1 text-[14px]">
                    <span className="text-[var(--colors-text-quaternary)]">Valid until</span>
                    <span className="font-medium text-[var(--colors-text-primary)]">{formatValidUntil(item.expiry_date)}</span>
                </div>
            </div>
        </div>
        {confirmAction && (() => {
            const cfg = ANNOUNCEMENT_MODAL_CFG[confirmAction];
            const tone = ANNOUNCEMENT_DESTRUCTIVE.has(confirmAction) ? "danger" : "success";
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
                    ? "bg-[#f5fffa] border-[var(--colors-secondary-500)] text-[#10373a]"
                    : "bg-white border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
            )}>
            {label}
        </button>
    );
}

// ─── Filter side panel ───────────────────────────────────────────────────────

interface AnnouncementFilter {
    statuses: StoredStatus[];
    startDate: string;
    endDate: string;
}
const EMPTY_FILTER: AnnouncementFilter = { statuses: [], startDate: "", endDate: "" };

// Archived is a place (the Archived section), not a filter value (policy §3).
const FILTER_STATUSES: StoredStatus[] = ["active", "inactive"];

function FilterPanel({ open, applied, onClose, onApply }: {
    open: boolean;
    applied: AnnouncementFilter;
    onClose: () => void;
    onApply: (next: AnnouncementFilter) => void;
}) {
    const [pending, setPending] = useState<AnnouncementFilter>(EMPTY_FILTER);

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
            <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Filter</p>
                <button type="button" onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                {/* Status — multi-select pills */}
                <div className="flex flex-col gap-2">
                    <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Status</p>
                    <div className="flex flex-wrap gap-2">
                        {FILTER_STATUSES.map(s => (
                            <FilterPill key={s} label={STATUS_LABEL[s]}
                                selected={pending.statuses.includes(s)}
                                onClick={() => toggleStatus(s)} />
                        ))}
                    </div>
                </div>

                <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />

                {/* Date range — filters by the item's expiry date */}
                <div className="flex flex-col gap-1.5">
                    <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Announcement date range</p>
                    <div className="flex gap-4 items-start">
                        <div className="flex-1 min-w-0">
                            <DatePicker
                                value={pending.startDate}
                                onChange={iso => setPending(p => ({
                                    ...p,
                                    startDate: iso,
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

            <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
                <Button variant="secondary-gray" disabled={!hasAny}
                    onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                    Clear filter
                </Button>
                <Button variant="primary" disabled={!hasAny}
                    onClick={() => { onApply(pending); onClose(); }}>
                    Apply
                </Button>
            </div>
        </SlidePanel>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function AnnouncementsListPage() {
    const router = useRouter();
    const marketingItems = useAppStore(s => s.marketingItems);
    const branches = useAppStore(s => s.branches);
    const showToast = useAppStore(s => s.showToast);

    const [search, setSearch] = usePersistedListState("announcements:search", "");
    const [locationId, setLocationId] = usePersistedListState<string>("announcements:locationId", "");
    const [filter, setFilter] = usePersistedListState<AnnouncementFilter>("announcements:filter", EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    const hasActiveFilter = filter.statuses.length > 0 || !!filter.startDate || !!filter.endDate;

    const locationOptions = useMemo(() => branches
        .filter(b => b.status === "active")
        .map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,
        })), [branches]);
    const totalBranches = branches.length;

    // Base pool — announcements only.
    const announcements = useMemo(
        () => marketingItems.filter(m => m.type === "announcement"),
        [marketingItems],
    );

    // ─── Filter + search ───────────────────────────────────────────────────
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return announcements.filter(m => {
            if (q) {
                const hay = `${m.title} ${m.short_description}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (locationId) {
                const ids = m.branch_ids ?? [];
                if (ids.length > 0 && !ids.includes(locationId)) return false;
            }
            // Status pill filters only the active grid; archived announcements are
            // exempt — they always render in the Archived section below (policy §3).
            if (m.status !== "archived" && filter.statuses.length > 0 && !filter.statuses.includes(m.status)) return false;
            if (filter.startDate && (!m.expiry_date || m.expiry_date.slice(0, 10) < filter.startDate)) return false;
            if (filter.endDate && (!m.expiry_date || m.expiry_date.slice(0, 10) > filter.endDate)) return false;
            return true;
        });
    }, [announcements, search, locationId, filter]);
    // Archived announcements leave the grid → the shared Archived section (card
    // grid, no pagination, hugging layout for this bare-flow page).
    const { active: activeAnnouncements, archived: archivedAnnouncements } = useArchiveView(visible);

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={activeAnnouncements.length} entitySingular="announcement" />

                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={locationId}
                    onChange={setLocationId}
                    width="w-[220px]"
                />

                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search announcements..." />

                <ToolbarExport
                    disabled={activeAnnouncements.length + archivedAnnouncements.length === 0}
                    exportData={() => {
                        const rows = [...activeAnnouncements, ...archivedAnnouncements];
                        if (rows.length === 0) return null;
                        const branchNameById = new Map(branches.map(b => [b.id, b.name]));
                        return marketingExportData(rows, "announcements", id => branchNameById.get(id) ?? "");
                    }}
                    onExported={(fmt) => {
                        const n = activeAnnouncements.length + archivedAnnouncements.length;
                        showToast("Announcements exported", `${n} announcement${n === 1 ? "" : "s"} exported to ${fmt.toUpperCase()}.`, "success", "check");
                    }}
                />

                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />

                {/* Import — empty-state only. */}
                <ToolbarImportButton visible={announcements.length === 0 && !search.trim() && !hasActiveFilter} />

                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => openMarketingFormPanel({ kind: "announcement", mode: "create" })}>
                    Add
                </Button>
            </div>

            {/* ── Active card grid ── */}
            {activeAnnouncements.length === 0 ? (
                <div className="relative flex-1" style={{ minHeight: 400 }}>
                    <EmptyState
                        title={announcements.length === 0 ? "No announcements yet" : "No announcements found"}
                        subtitle={announcements.length === 0
                            ? "Create your first announcement to keep your customers informed."
                            : "Try adjusting your search or filters."}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-4">
                    {activeAnnouncements.map(m => (
                        <AnnouncementCardView key={m.id} item={m} totalBranches={totalBranches}
                            onOpen={() => router.push(`/announcements/${m.id}?returnTo=${encodeURIComponent(LIST_PATH)}`)} />
                    ))}
                </div>
            )}

            {/* ── Archived section — card grid, no pagination, hugging layout
                   (policy §3). Renders only when archived announcements exist. */}
            <ArchivedSection entitySingular="announcement" count={archivedAnnouncements.length} fill={false} bordered={false}>
                <div className="px-6 py-4">
                    <div className="grid grid-cols-4 gap-4">
                        {archivedAnnouncements.map(m => (
                            <AnnouncementCardView key={m.id} item={m} totalBranches={totalBranches}
                                onOpen={() => router.push(`/announcements/${m.id}?returnTo=${encodeURIComponent(LIST_PATH)}`)} />
                        ))}
                    </div>
                </div>
            </ArchivedSection>

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
