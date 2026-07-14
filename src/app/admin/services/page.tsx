"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services list view (/admin/services — Module 13, Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the Gift Cards list chrome 1:1 (toolbar + sortable table with bulk-
// select + floating bulk-action pill + Pagination + row-action ⋮ + Toast).
// No bespoke table primitives — every cell class, sort helper and modal
// shape is reused from /admin/products/gift-cards so the modules look
// identical to the eye.
//
// Differences from Gift Cards:
//   • Branch dropdown sits in the toolbar (Figma 7414:328584)
//   • "Type" column shows the session type (Private session / Recovery &
//     wellness) off `service.type`; the ?type= deep-link scopes the list
//   • "Price" column shows fixed AED price (services are currency-priced,
//     not membership-gated, per the Module 13 update)
//   • Filter is the side-panel multi-select (Figma 7424:139522) — Status +
//     Categories pills — because services bring two filter dimensions, not
//     the single status that gift cards have
//
// State source of truth: useAppStore(s => s.services). Edits, status flips
// and deletes propagate cross-module via the live store slice (future
// phases wire appointments + schedule-grid rendering).

import { useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, DotsVertical,
    ChevronLeft, Eye, Edit02, Trash01, Trash02, Archive,
    XClose, RefreshCcw01, SlashCircle01, Check, MarkerPin01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore, type Service, type ServiceStatus, type ServiceType } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types & constants ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<ServiceStatus, string> = {
    Active:   "Active",
    Inactive: "Inactive",
    Archived: "Archived",
};
const STATUS_ORDER: Record<ServiceStatus, number> = {
    Active: 0, Inactive: 1, Archived: 2,
};
const ALL_STATUSES: ServiceStatus[] = ["Active", "Archived", "Inactive"];

interface FilterState {
    statuses: ServiceStatus[];
    categories: string[];
}
const EMPTY_FILTER: FilterState = { statuses: [], categories: [] };

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

// ─── Status badge (gift-cards palette) ───────────────────────────────────────

// Local StatusBadge removed — uses canonical `<StatusBadge type="service">`
// from `@/components/patterns/StatusBadge`.

// ─── Service avatar — circular image with category-tinted fallback ─────────
//
// Figma 7414:328584 shows each service row leading with a photo. Render the
// uploaded image when present (`coverImage`), fall back to a category-tinted
// circle with the leading letter when the service has no upload yet — keeps
// new services visually identifiable until the admin attaches an image.

function ServiceAvatar({ name, coverImage, coverColor, status }: {
    name: string;
    coverImage?: string;
    coverColor: string;
    status: ServiceStatus;
}) {
    if (coverImage) {
        return (
            <div className="relative shrink-0 size-10 rounded-full overflow-hidden bg-[#f2f4f7]">
                <img
                    src={coverImage}
                    alt={name}
                    className={cn("absolute inset-0 w-full h-full object-cover", status === "Inactive" && "grayscale")}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
            </div>
        );
    }
    const initial = (name?.[0] ?? "S").toUpperCase();
    return (
        <div
            className="relative shrink-0 size-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-[#344054]"
            style={{ backgroundColor: coverColor || "#f2f4f7" }}
        >
            {initial}
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Row actions (⋮) — same state-aware matrix as gift cards ───────────────

// Local RowActions removed — uses canonical `<RowActions items={[...]}>` from
// `@/components/patterns/RowActions`. Items array is built per-row at the
// call site below based on status + hasHistory.

// ─── Confirmation modal (gift-cards tone matrix) ────────────────────────────

const MODAL_CONFIG: Record<RowActionKind, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
    tone: "destructive" | "primary";
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this service?",
        titleBulk:   n => `Archive ${n} services?`,
        description: subject => <>{subject} will be hidden from the default service list. You can recover archived services at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this service?",
        titleBulk:   n => `Deactivate ${n} services?`,
        description: (subject, n) => <>{subject} will stop accepting new appointment bookings. Customers who already booked {n === 1 ? "it" : "them"} keep their slot.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this service?",
        titleBulk:   n => `Recover ${n} services?`,
        description: subject => <>{subject} will be restored to Active status and become bookable again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this service?",
        titleBulk:   n => `Reactivate ${n} services?`,
        description: subject => <>{subject} will become available for new appointments again.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this service?",
        titleBulk:   n => `Delete ${n} services?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
    },
};

// Local ActionModal removed — uses canonical `<ConfirmModal>` driven by
// MODAL_CONFIG above.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Floating bulk-action pill (gift-cards twin) ────────────────────────────

function BulkActionBar({ count, hasArchivable, hasReactivatable, hasRecoverable, hasDeletable, onClear, onAction }: {
    count: number;
    hasArchivable: boolean;
    hasReactivatable: boolean;
    hasRecoverable: boolean;
    hasDeletable: boolean;
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    {hasArchivable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Archive className="w-5 h-5 text-[#667085]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {hasReactivatable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<Check className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("reactivate")}>
                            Reactivate
                        </Button>
                    )}
                    {hasRecoverable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {hasArchivable && (
                        hasDeletable ? (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("delete")}>
                                Delete
                            </Button>
                        ) : (
                            <Button variant="secondary-gray" size="sm"
                                className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                                leftIcon={<SlashCircle01 className="w-5 h-5 text-[#b42318]" />}
                                onClick={() => onAction("deactivate")}>
                                Deactivate
                            </Button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Table header/cell constants (verbatim from gift-cards) ─────────────────


// ─── Checkbox cell (verbatim from gift-cards) ───────────────────────────────

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]"
            )}>
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// ─── Row VM ─────────────────────────────────────────────────────────────────

type ServiceRow = {
    id: string;
    name: string;
    category: string;
    durationMin: number;
    branchName: string;
    branchId: string;
    type: ServiceType;
    price: number;
    status: ServiceStatus;
    coverImage?: string;
    coverColor: string;
    hasHistory: boolean;
};

function rowsFromServices(items: Service[], hasHistory: (id: string) => boolean): ServiceRow[] {
    return items.map(s => ({
        id: s.id,
        name: s.name,
        category: s.category,
        durationMin: s.durationMin,
        branchName: s.branchName,
        branchId: s.branchId,
        type: s.type,
        price: s.price,
        status: s.status,
        coverImage: s.coverImage,
        coverColor: s.coverColor,
        hasHistory: hasHistory(s.id),
    }));
}

// ─── Filter pill ────────────────────────────────────────────────────────────

function Pill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

// ─── Filter side panel (Figma 7424:139522) ──────────────────────────────────

function FilterPanel({ open, onClose, applied, onApply, allCategories }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
    allCategories: string[];
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => {
        if (open) setPending({ statuses: [...applied.statuses], categories: [...applied.categories] });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T extends string>(arr: T[], v: T): T[] {
        return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    }
    const hasSelection = pending.statuses.length > 0 || pending.categories.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={400} zIndex={50}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => (
                                <Pill key={s} label={s}
                                    selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Categories */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Categories</p>
                        <div className="flex flex-wrap gap-2">
                            {allCategories.map(c => (
                                <Pill key={c} label={c}
                                    selected={pending.categories.includes(c)}
                                    onClick={() => setPending(p => ({ ...p, categories: toggle(p.categories, c) }))}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasSelection}
                        onClick={() => { setPending(EMPTY_FILTER); onApply(EMPTY_FILTER); onClose(); }}>
                        Clear filter
                    </Button>
                    <Button variant="primary" size="md" disabled={!hasSelection}
                        onClick={() => { onApply(pending); onClose(); }}>
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── List view (table) ──────────────────────────────────────────────────────

function ListView({
    rows, sortKey, sortDir, onSort,
    selectedIds, onToggleOne, onToggleAll,
    onRowAction, onView, onEdit,
}: {
    rows: ServiceRow[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onRowAction: (row: ServiceRow, kind: RowActionKind) => void;
    onView: (row: ServiceRow) => void;
    onEdit: (row: ServiceRow) => void;
}) {
    const allChecked  = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && rows.some(r => selectedIds.has(r.id));

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[44px]")}>
                            <CheckboxCell
                                checked={allChecked}
                                indeterminate={someChecked}
                                onChange={onToggleAll}
                                ariaLabel="Select all services"
                            />
                        </th>
                        <th className={cn(TH, "w-[320px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Service name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="duration" currentSort={sortKey} dir={sortDir} onSort={onSort}>Duration</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[200px]")}>
                            <SortableHeader sortKey="branch" currentSort={sortKey} dir={sortDir} onSort={onSort}>Branch location</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="type" currentSort={sortKey} dir={sortDir} onSort={onSort}>Type</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[52px]")}></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => {
                        const isSelected = selectedIds.has(r.id);
                        return (
                            <tr key={r.id}
                                onClick={() => onView(r)}
                                className={cn("transition-colors cursor-pointer", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <CheckboxCell
                                        checked={isSelected}
                                        onChange={() => onToggleOne(r.id)}
                                        ariaLabel={`Select ${r.name}`}
                                    />
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <ServiceAvatar
                                            name={r.name}
                                            coverImage={r.coverImage}
                                            coverColor={r.coverColor}
                                            status={r.status}
                                        />
                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.durationMin} minutes</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.branchName || "—"}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.type === "recovery" ? "Recovery & wellness" : "Private session"}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>AED {r.price.toLocaleString()}</td>
                                <td className={TD}><StatusBadge type="service" status={r.status} /></td>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <RowActions items={[
                                        { label: "View details", icon: Eye, onClick: () => onView(r) },
                                        { label: "Edit details", icon: Edit02, onClick: () => onEdit(r), hidden: r.status !== "Active" },
                                        { label: "Archive", icon: Archive, onClick: () => onRowAction(r, "archive"), hidden: r.status !== "Active" && r.status !== "Inactive" },
                                        { label: "Reactivate", icon: Check, onClick: () => onRowAction(r, "reactivate"), hidden: r.status !== "Inactive" },
                                        { label: "Recover", icon: RefreshCcw01, onClick: () => onRowAction(r, "recover"), hidden: r.status !== "Archived" },
                                        { label: "Deactivate", icon: SlashCircle01, onClick: () => onRowAction(r, "deactivate"), danger: true, hidden: !(r.status === "Active" && r.hasHistory) },
                                        { label: "Delete", icon: Trash01, onClick: () => onRowAction(r, "delete"), danger: true, hidden: !(r.status === "Active" && !r.hasHistory) },
                                    ]} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row";  row: ServiceRow;   kind: RowActionKind }
    | { mode: "bulk"; rows: ServiceRow[]; kind: RowActionKind };

// Default export wraps the page in a Suspense boundary — required because
// ServicesPageInner reads the `?type=` deep-link via useSearchParams (the
// Products & pricing nav's "Private sessions" / "Recovery & wellness" entries).
export default function ServicesPage() {
    return (
        <Suspense fallback={null}>
            <ServicesPageInner />
        </Suspense>
    );
}

function ServicesPageInner() {
    const router = useRouter();
    // Type deep-link — "private" | "recovery" | null (all). Drives the list
    // scope + the page's contextual title.
    const typeScope = useSearchParams().get("type");

    // ─── Store subscriptions ───────────────────────────────────────────────
    const services         = useAppStore(s => s.services);
    const appointments     = useAppStore(s => s.appointments);
    const branches         = useAppStore(s => s.branches);
    const classCategories  = useAppStore(s => s.classCategories);
    const setServiceStatus = useAppStore(s => s.setServiceStatus);
    const deleteService    = useAppStore(s => s.deleteService);
    const showToast        = useAppStore(s => s.showToast);

    // Live history check — derived from the appointments slice. A service
    // can only be hard-deleted when it has ZERO appointments; once any
    // appointment exists the Delete action swaps to Deactivate so the
    // historical record stays intact. Updates immediately when an admin
    // cancels the last appointment on the detail page.
    const serviceIdsWithHistory = useMemo(
        () => new Set(appointments.map(a => a.serviceId)),
        [appointments],
    );
    function hasAppointmentHistory(id: string): boolean {
        return serviceIdsWithHistory.has(id);
    }

    // ─── Local UI state ────────────────────────────────────────────────────
    const [branchId, setBranchId]             = useState<string>("");           // "" = All locations
    const [search, setSearch]                 = useState("");
    const [filterOpen, setFilterOpen]         = useState(false);
    const [applied, setApplied]               = useState<FilterState>(EMPTY_FILTER);
    const [page, setPage]                     = useState(1);
    const [pageSize, setPageSize]             = useState(10);
    const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    useEffect(() => { setPage(1); }, [search, applied, branchId]);

    // ─── Derived: branches dropdown (live, active only) ────────────────────
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );
    const allCategoryNames = useMemo(() => classCategories.map(c => c.name), [classCategories]);

    // ─── Build + filter rows ───────────────────────────────────────────────
    const allRows = useMemo(() => rowsFromServices(services, hasAppointmentHistory), [services]);
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            // Type deep-link scope — "private" / "recovery" nav entries.
            if (typeScope && r.type !== typeScope) return false;
            if (branchId && r.branchId !== branchId) return false;
            if (applied.statuses.length   && !applied.statuses.includes(r.status))     return false;
            if (applied.categories.length && !applied.categories.includes(r.category)) return false;
            if (q && !`${r.name} ${r.category}`.toLowerCase().includes(q))             return false;
            return true;
        });
    }, [allRows, search, applied, branchId, typeScope]);

    // ─── Sort (gift-cards twin) ────────────────────────────────────────────
    const comparators: Record<string, (a: ServiceRow, b: ServiceRow) => number> = {
        name:     (a, b) => a.name.localeCompare(b.name),
        duration: (a, b) => a.durationMin - b.durationMin,
        branch:   (a, b) => a.branchName.localeCompare(b.branchName),
        // Private first when ascending, Recovery first when descending.
        type:     (a, b) => a.type.localeCompare(b.type),
        price:    (a, b) => a.price - b.price,
        status:   (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, comparators);

    // ─── Pagination slice ──────────────────────────────────────────────────
    const totalPages   = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage  = Math.min(Math.max(1, page), totalPages);
    const pagedRows    = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection helpers ─────────────────────────────────────────────────
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAllOnPage(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else       pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    // ─── Bulk derived flags ────────────────────────────────────────────────
    const selectedRows = useMemo(() => sorted.filter(r => selectedIds.has(r.id)), [sorted, selectedIds]);
    const hasArchivable    = selectedRows.some(r => r.status !== "Archived");
    const hasReactivatable = selectedRows.some(r => r.status === "Inactive");
    const hasRecoverable   = selectedRows.some(r => r.status === "Archived");
    const hasDeletable     = selectedRows.length > 0
        && selectedRows.every(r => r.status === "Active" && !r.hasHistory);

    // ─── Action plumbing ───────────────────────────────────────────────────
    function openRowConfirm(row: ServiceRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "Active");
                case "reactivate": return selectedRows.filter(r => r.status === "Inactive");
                case "archive":    return selectedRows.filter(r => r.status !== "Archived");
                case "recover":    return selectedRows.filter(r => r.status === "Archived");
                case "delete":     return selectedRows.filter(r => r.status === "Active" && !r.hasHistory);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;

        if (kind === "deactivate" || kind === "reactivate" || kind === "archive" || kind === "recover") {
            const nextStatus: ServiceStatus =
                kind === "deactivate" ? "Inactive" :
                kind === "reactivate" ? "Active"   :
                kind === "archive"    ? "Archived" :
                /* recover */           "Active";
            rows.forEach(r => setServiceStatus(r.id, nextStatus));

            const verbPast =
                kind === "deactivate" ? "deactivated" :
                kind === "reactivate" ? "reactivated" :
                kind === "archive"    ? "archived"    :
                /* recover */           "recovered";
            const titleSingle =
                kind === "deactivate" ? "Service deactivated" :
                kind === "reactivate" ? "Service reactivated" :
                kind === "archive"    ? "Service archived"    :
                /* recover */           "Service recovered";
            const icon: "slash" | "archive" | "refresh" | "check" =
                kind === "deactivate" ? "slash"   :
                kind === "archive"    ? "archive" :
                kind === "reactivate" ? "check"   :
                /* recover */           "refresh";
            const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";

            if (rows.length === 1) {
                showToast(titleSingle, `${rows[0].name} has been ${verbPast}.`, tone, icon);
            } else {
                showToast(
                    `${rows.length} services ${verbPast}`,
                    `Your selected services have been ${verbPast}.`,
                    tone, icon,
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // Delete
        if (kind === "delete") {
            rows.forEach(r => deleteService(r.id));
            if (rows.length === 1) {
                showToast("Service deleted", `${rows[0].name} has been deleted.`, "success", "trash");
            } else {
                showToast(
                    "Services deleted",
                    `${rows.length} services deleted.`,
                    "success", "trash",
                );
            }
            clearSelection();
            setPendingConfirm(null);
        }
    }

    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected services</>,
        };
    }

    // ─── Navigation handlers ──────────────────────────────────────────────
    //
    // The new/edit/detail pages all live at TOP-LEVEL routes (`/services/*`)
    // — NOT under `/admin/services/*` — so they render full-screen without
    // the admin sidebar + header chrome. Same convention as class templates
    // (`/class-types/new`) and customers (`/customers/[id]/edit`).
    //
    // returnTo carries the active `?type=` scope so closing a service from the
    // "Private sessions" / "Recovery & wellness" view lands back on the SAME
    // filtered list (keeps the sidebar highlight + the type-scoped header title).
    const listPath = typeScope ? `/admin/services?type=${typeScope}` : "/admin/services";
    function handleAdd() {
        router.push(`/services/new?returnTo=${encodeURIComponent(listPath)}`);
    }
    function handleView(row: ServiceRow) {
        router.push(`/services/${row.id}?returnTo=${encodeURIComponent(listPath)}`);
    }
    function handleEdit(row: ServiceRow) {
        router.push(`/services/${row.id}/edit?returnTo=${encodeURIComponent(listPath)}`);
    }

    const hasActiveFilter = applied.statuses.length > 0 || applied.categories.length > 0;

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={filteredRows.length} entitySingular="service" />

                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />

                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search service..." />

                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />

                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleAdd}>
                    Add new
                </Button>
            </div>

            {/* Body — flush on the admin chrome (no nested view card). The
                relative wrapper anchors the floating bulk-action pill so it
                can sit over the table area without escaping the page. */}
            <div className="relative flex flex-col flex-1">
                {sorted.length === 0 ? (
                    <div className="relative flex-1" style={{ minHeight: 400 }}>
                        <EmptyState
                            title={allRows.length === 0 ? "No services yet" : "No services found"}
                            subtitle={allRows.length === 0
                                ? "Add your first appointment service to start accepting bookings."
                                : "Try adjusting your search or filters."}
                        />
                    </div>
                ) : (
                    <ListView
                        rows={pagedRows}
                        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                        selectedIds={selectedIds}
                        onToggleOne={toggleOne}
                        onToggleAll={toggleAllOnPage}
                        onRowAction={openRowConfirm}
                        onView={handleView}
                        onEdit={handleEdit}
                    />
                )}

                <Pagination
                    page={clampedPage} total={sorted.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                />

                <BulkActionBar
                    count={selectedIds.size}
                    hasArchivable={hasArchivable}
                    hasReactivatable={hasReactivatable}
                    hasRecoverable={hasRecoverable}
                    hasDeletable={hasDeletable}
                    onClear={clearSelection}
                    onAction={openBulkConfirm}
                />
            </div>

            {/* ── Filter side panel ── */}
            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={setApplied}
                allCategories={allCategoryNames}
            />

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone={cfg.tone === "destructive" ? "danger" : "success"}
                        title={title}
                        description={cfg.description(subject, count)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pendingConfirm)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}
