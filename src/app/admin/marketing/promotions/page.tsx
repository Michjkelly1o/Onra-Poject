"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Promo module list view (/admin/marketing/promotions)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 6160:180145 (list view) + 5284:46589 (filter content).
//
// 3-column grid of marketing promo cards. Each card paints a dark banner with
// the promo headline + status badge, then the name / description / attribute
// grid (action · offer type · code · branches) and the valid-until row.
//
// State source of truth: useAppStore(s => s.promoCodes). The toolbar carries a
// branch picker, search, a side-panel filter (Status + Promo date range), and
// the "Add promo code" button (creation flow ships in the next step).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, XClose, MarkerPin01,
    CursorBox, Sale03, Ticket01,
    Eye, Edit02, Archive, SlashCircle01, RefreshCcw01, Check, Trash02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { usePersistedListState } from "@/lib/list-ui-cache";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type PromoCode } from "@/lib/store";
import { openMarketingFormPanel } from "@/lib/marketing-form-panel";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ArchivedSection } from "@/components/patterns/ArchivedSection";
import { useArchiveView } from "@/lib/hooks/useArchiveView";
import { RowActions, type RowActionItem } from "@/components/patterns/RowActions";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { promoCodesExportData } from "@/lib/export/specs/marketing";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { useHasMounted } from "@/lib/use-has-mounted";

// Card-embedded kebab menu actions — mirrors the detail-page action set so
// the list can drive Archive / Deactivate / Delete / Recover / Reactivate
// without navigating away first (client Jul 2026).
type PromoCardAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";
const PROMO_DESTRUCTIVE = new Set<PromoCardAction>(["deactivate", "delete"]);
const PROMO_MODAL_CFG: Record<PromoCardAction, { IconComp: React.ElementType; title: string; description: string; confirmLabel: string }> = {
    archive: {
        IconComp: Archive,
        title: "Archive this promotion?",
        description: "Are you sure you want to archive this promotion? It will no longer be applied at checkout.",
        confirmLabel: "Archive",
    },
    deactivate: {
        IconComp: SlashCircle01,
        title: "Deactivate this promotion?",
        description: "Are you sure you want to deactivate this promotion? Customers will no longer be able to redeem it.",
        confirmLabel: "Deactivate",
    },
    recover: {
        IconComp: RefreshCcw01,
        title: "Recover this promotion?",
        description: "Are you sure you want to recover this promotion from archive?",
        confirmLabel: "Recover",
    },
    reactivate: {
        IconComp: Check,
        title: "Reactivate this promotion?",
        description: "Are you sure you want to reactivate this promotion? It will be available at checkout again.",
        confirmLabel: "Reactivate",
    },
    delete: {
        IconComp: Trash02,
        title: "Delete this promotion?",
        description: "Are you sure you want to delete this promotion? This action cannot be undone.",
        confirmLabel: "Delete",
    },
};

// ─── Status helpers ──────────────────────────────────────────────────────────

type StoredStatus = PromoCode["status"];           // active | inactive | archived
type EffectiveStatus = StoredStatus | "expired";   // expired is derived from valid_until

const STATUS_LABEL: Record<EffectiveStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
    expired: "Expired",
};

/** A promo reads as "Expired" the moment its `valid_until` passes — regardless
 *  of the stored admin status. Otherwise it shows its stored status. */
function effectiveStatus(p: PromoCode): EffectiveStatus {
    if (p.valid_until && new Date(p.valid_until).getTime() < Date.now()) return "expired";
    return p.status;
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
    return `${dd}/${mo}/${d.getUTCFullYear()}, ${mm === "00" ? `${h}` : `${h}.${mm}`} ${ampm}`;
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

/** "All branches" when the promo covers every branch, else "N branches". */
function branchLabel(branchIds: string[] | undefined, totalBranches: number): string {
    const n = branchIds?.length ?? 0;
    if (n === 0) return "All branches";
    if (n >= totalBranches) return "All branches";
    return `${n} ${n === 1 ? "branch" : "branches"}`;
}

// ─── Promo card (Figma 6160:154472) ──────────────────────────────────────────

function PromoAttribute({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 shrink-0 text-[var(--colors-text-quaternary)]">{icon}</span>
            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{label}</span>
        </div>
    );
}

function PromoCardView({ promo, onOpen, totalBranches }: { promo: PromoCode; onOpen: () => void; totalBranches: number }) {
    const router = useRouter();
    const status = effectiveStatus(promo);
    // Active promos get the deep-slate banner; inactive / archived / expired
    // promos render a muted gray banner (matches the Figma grayscale state).
    const bannerClass = status === "active"
        ? "bg-gradient-to-br from-[#1d2939] via-[var(--colors-text-secondary)] to-[var(--colors-text-tertiary)]"
        : "bg-gradient-to-br from-[var(--colors-text-tertiary)] via-[var(--colors-text-quaternary)] to-[var(--colors-fg-quaternary)]";
    // ── Kebab menu wiring ────────────────────────────────────────────────
    const updatePromoCode = useAppStore(s => s.updatePromoCode);
    const deletePromoCode = useAppStore(s => s.deletePromoCode);
    const showToast       = useAppStore(s => s.showToast);
    const [confirmAction, setConfirmAction] = useState<PromoCardAction | null>(null);
    const canDelete = (promo.usage_count ?? 0) === 0;
    // Items conditional on stored status (expired promos live in one of the
    // three stored states, so we key off `promo.status`, not `status`).
    const items: RowActionItem[] = (() => {
        const base: RowActionItem[] = [{ label: "View details", icon: Eye, onClick: onOpen }];
        if (promo.status === "archived") {
            base.push({ label: "Recover promotion", icon:RefreshCcw01, onClick: () => setConfirmAction("recover") });
            return base;
        }
        if (promo.status === "inactive") {
            base.push({ label: "Reactivate promotion", icon:RefreshCcw01, onClick: () => setConfirmAction("reactivate") });
            base.push({ label: "Archive promotion", icon:Archive, onClick: () => setConfirmAction("archive") });
            return base;
        }
        // Active
        base.push({ label: "Edit promotion", icon:Edit02, onClick: () => openMarketingFormPanel({ kind: "promotion", mode: "edit", id: promo.id }) });
        base.push({ label: "Archive promotion", icon:Archive, onClick: () => setConfirmAction("archive") });
        if (canDelete) {
            base.push({ label: "Delete promotion", icon:Trash02, danger: true, onClick: () => setConfirmAction("delete") });
        } else {
            base.push({ label: "Deactivate promotion", icon:SlashCircle01, danger: true, onClick: () => setConfirmAction("deactivate") });
        }
        return base;
    })();

    function handleConfirm() {
        if (!confirmAction) return;
        const name = promo.name ?? promo.code;
        switch (confirmAction) {
            case "delete":
                if (deletePromoCode(promo.id)) {
                    showToast("Promotion deleted", `${name} has been deleted.`, "success", "trash");
                }
                break;
            case "archive":
                updatePromoCode(promo.id, { status: "archived" });
                showToast("Promotion archived", `${name} has been archived.`, "success", "archive");
                break;
            case "deactivate":
                updatePromoCode(promo.id, { status: "inactive" });
                showToast("Promotion deactivated", `${name} is no longer active.`, "error", "slash");
                break;
            case "recover":
                updatePromoCode(promo.id, { status: "active" });
                showToast("Promotion recovered", `${name} is active again.`, "success", "check");
                break;
            case "reactivate":
                updatePromoCode(promo.id, { status: "active" });
                showToast("Promotion reactivated", `${name} is active again.`, "success", "check");
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
            {/* Banner — verbatim match for the customer-side PromoCard
                (`src/components/customer/products/PromoCard.tsx`): same
                aspect-[343/140] tile + `object-cover` fit. Admin preview
                and customer render are now pixel-for-pixel identical so
                what the admin sees IS what the customer sees. Was
                `aspect-[4/3] + object-cover` which cropped 12:5 uploads
                down to a square (client 2026-07-22). */}
            <div className={cn("relative aspect-[343/140] shrink-0 overflow-hidden", bannerClass)}>
                {/* Image-only banner — the voucher artwork carries all copy.
                    Inactive / archived / expired promos render grayscale. */}
                {promo.banner_image_url && (
                    <img src={promo.banner_image_url} alt={promo.name ?? promo.code}
                        className={cn("absolute inset-0 w-full h-full object-cover", status !== "active" && "grayscale")} />
                )}
                {/* Status badge — top right (system status, not voucher copy) */}
                <div className="absolute top-3 right-3 z-10">
                    <StatusBadge type="promo" status={status} size="lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-4 py-5">
                <div className="flex flex-row items-start gap-2">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[18px] font-medium text-[var(--colors-text-primary)] leading-7 truncate">
                            {promo.name ?? promo.code}
                        </p>
                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-5 line-clamp-2">
                            {promo.description ?? "—"}
                        </p>
                    </div>
                    {/* Kebab — stop propagation so the card's own onClick doesn't fire alongside. */}
                    <div className="shrink-0 -mr-2 -mt-1" onClick={e => e.stopPropagation()}>
                        <RowActions items={items} minWidth={220} triggerLabel="Promotion actions" />
                    </div>
                </div>

                {/* Attribute grid — action · offer type · code · branches */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                    <PromoAttribute
                        icon={<CursorBox className="w-4 h-4" />}
                        label={promo.action ? ACTION_LABEL[promo.action] : "—"}
                    />
                    <PromoAttribute
                        icon={<Sale03 className="w-4 h-4" />}
                        label={promo.offer_type ? OFFER_LABEL[promo.offer_type] : "—"}
                    />
                    <PromoAttribute
                        icon={<Ticket01 className="w-4 h-4" />}
                        label={promo.code || "—"}
                    />
                    <PromoAttribute
                        icon={<MarkerPin01 className="w-4 h-4" />}
                        label={branchLabel(promo.branch_ids, totalBranches)}
                    />
                </div>

                {/* Dashed divider */}
                <div className="border-t border-dashed border-[var(--colors-border-secondary)]" />

                {/* Valid until */}
                <div className="flex items-center gap-1 text-[14px]">
                    <span className="text-[var(--colors-text-quaternary)]">Valid until</span>
                    <span className="font-medium text-[var(--colors-text-primary)]">{formatValidUntil(promo.valid_until)}</span>
                </div>
            </div>
        </div>
        {confirmAction && (() => {
            const cfg = PROMO_MODAL_CFG[confirmAction];
            const tone = PROMO_DESTRUCTIVE.has(confirmAction) ? "danger" : "success";
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

// ─── Filter side panel (Figma 5284:46589) ────────────────────────────────────

interface PromoFilter {
    statuses: StoredStatus[];
    startDate: string;
    endDate: string;
}
const EMPTY_FILTER: PromoFilter = { statuses: [], startDate: "", endDate: "" };

// Archived is a place (the Archived section), not a filter value (policy §3).
const FILTER_STATUSES: StoredStatus[] = ["active", "inactive"];

function FilterPanel({ open, applied, onClose, onApply }: {
    open: boolean;
    applied: PromoFilter;
    onClose: () => void;
    onApply: (next: PromoFilter) => void;
}) {
    const [pending, setPending] = useState<PromoFilter>(EMPTY_FILTER);

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

                    {/* Promotion date range — filters by the promotion's valid-until date */}
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Promotion date range</p>
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

export default function PromoListPage() {
    // Promo rows + usage counts come from the localStorage-backed store, so the
    // seed-based server render disagrees with the rehydrated client on a fresh
    // load (e.g. the /admin/products/promo-codes → here redirect) — a hydration
    // mismatch. Gate until mounted.
    const mounted = useHasMounted();
    const router = useRouter();
    const promoCodes = useAppStore(s => s.promoCodes);
    const branches = useAppStore(s => s.branches);
    const showToast = useAppStore(s => s.showToast);

    const [search, setSearch] = usePersistedListState("promoCodes:search", "");
    // "" = "All locations" — promo codes default to the aggregate view
    // across every active branch.
    const [locationId, setLocationId] = usePersistedListState<string>("promoCodes:locationId", "");
    const [filter, setFilter] = usePersistedListState<PromoFilter>("promoCodes:filter", EMPTY_FILTER);
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
            icon: <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />,
        })), [branches]);
    const totalBranches = branches.length;

    // ─── Filter + search ───────────────────────────────────────────────────
    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return promoCodes.filter(p => {
            if (q) {
                const hay = `${p.name ?? ""} ${p.code} ${p.description ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            if (locationId) {
                const ids = p.branch_ids ?? [];
                // Empty branch_ids = available everywhere.
                if (ids.length > 0 && !ids.includes(locationId)) return false;
            }
            // Status pill filters only the active grid; archived promos are
            // exempt — they always render in the Archived section below (policy §3).
            if (p.status !== "archived" && filter.statuses.length > 0 && !filter.statuses.includes(p.status)) return false;
            if (filter.startDate && (!p.valid_until || p.valid_until.slice(0, 10) < filter.startDate)) return false;
            if (filter.endDate && (!p.valid_until || p.valid_until.slice(0, 10) > filter.endDate)) return false;
            return true;
        });
    }, [promoCodes, search, locationId, filter]);
    // Archived promos leave the grid → the shared Archived section (card grid,
    // no pagination, hugging layout for this bare-flow page).
    const { active: activePromos, archived: archivedPromos } = useArchiveView(visible);

    if (!mounted) return <div className="flex flex-col gap-6" />;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={activePromos.length} entitySingular="promotion" />

                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-5 h-5" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={locationId}
                    onChange={setLocationId}
                    width="w-[220px]"
                />

                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search promotions..." />

                <ToolbarExport
                    disabled={activePromos.length + archivedPromos.length === 0}
                    exportData={() => {
                        const rows = [...activePromos, ...archivedPromos];
                        if (rows.length === 0) return null;
                        const branchNameById = new Map(branches.map(b => [b.id, b.name]));
                        return promoCodesExportData(rows, id => branchNameById.get(id) ?? "");
                    }}
                    onExported={(fmt) => {
                        const n = activePromos.length + archivedPromos.length;
                        showToast("Promotions exported", `${n} promotion${n === 1 ? "" : "s"} exported to ${fmt.toUpperCase()}.`, "success", "check");
                    }}
                />

                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />

                {/* Import — empty-state only (client 2026-07-31). Hidden
                    once real promotions exist so admins default to
                    "Add promotion". */}
                <ToolbarImportButton visible={promoCodes.length === 0 && !search.trim() && !hasActiveFilter} />

                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => openMarketingFormPanel({ kind: "promotion", mode: "create" })}>
                    Add
                </Button>
            </div>

            {/* ── Active card grid ── */}
            {activePromos.length === 0 ? (
                <div className="relative flex-1" style={{ minHeight: 400 }}>
                    <EmptyState
                        title={promoCodes.length === 0 ? "No promotions yet" : "No promotions found"}
                        subtitle={promoCodes.length === 0
                            ? "Create your first promotion to get started."
                            : "Try adjusting your search or filters."}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-4 gap-4">
                    {activePromos.map(p => (
                        <PromoCardView key={p.id} promo={p} totalBranches={totalBranches}
                            onOpen={() => router.push(`/marketing/promotions/${p.id}?returnTo=${encodeURIComponent("/admin/marketing/promotions")}`)} />
                    ))}
                </div>
            )}

            {/* ── Archived section — card grid, no pagination, hugging layout
                   (policy §3). Renders only when archived promos exist. */}
            <ArchivedSection entitySingular="promotion" count={archivedPromos.length} fill={false} bordered={false}>
                <div className="px-6 py-4">
                    <div className="grid grid-cols-4 gap-4">
                        {archivedPromos.map(p => (
                            <PromoCardView key={p.id} promo={p} totalBranches={totalBranches}
                                onOpen={() => router.push(`/marketing/promotions/${p.id}?returnTo=${encodeURIComponent("/admin/marketing/promotions")}`)} />
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
