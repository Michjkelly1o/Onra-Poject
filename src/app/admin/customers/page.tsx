"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer list view (/admin/customers)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner-first build per CLAUDE.md. Figma: 2481:23104 (list) + 2481:23065 (filter).
//
// Patterns reused (no reinvention — Brief rule #2):
//   • Toolbar / view-card chrome / Pagination / CheckboxCell / BulkActionBar /
//     ActionModal / FilterPill / EmptyState — all lifted from /admin/products.
//   • TableAvatar (image-or-initials) from the DS for the Name cell.
//   • Row-action ⋮ menu via FixedDropdown.
//
// State source of truth: useAppStore(s => s.customers). Every action
// (create / edit / deactivate / reactivate / archive / recover / delete)
// goes through the store so dependent surfaces re-render in the same cycle.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, ChevronLeft,
    Eye, Edit02, Trash01, Trash02, Archive, Check, Download01,
    MarkerPin01, AlignLeft, XClose, RefreshCcw01, HeartHand,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { usePersistedListState } from "@/lib/list-ui-cache";
import { TableAvatar } from "@/components/ui/avatar";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { useAppStore, type Customer, type CustomerPlan, type CustomerTransaction } from "@/lib/store";
import { customerSegment, type CustomerSegment } from "@/lib/customer/segment";
import { useBulkSelectionSignal } from "@/lib/hooks/useBulkSelectionSignal";
// CustomerImportModal import removed (Jul 2026) — the Import Data entry is
// hidden pending a proper migration flow build. The modal file stays on disk
// as reference for that rebuild.
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ArchivedSection } from "@/components/patterns/ArchivedSection";
import { BulkBarDock } from "@/components/patterns/BulkBarDock";
import { useArchiveView } from "@/lib/hooks/useArchiveView";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { customersExportData } from "@/lib/export/specs/customers";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { computeLifecycleTag } from "@/lib/customer/lifecycle";
import { LEAD_ASSIGNMENT_ENABLED } from "@/lib/lead-assignment";

// ─── Types & constants ───────────────────────────────────────────────────────

type CustomerStatus = Customer["status"];     // "active" | "archived"
type PlanType = "membership" | "package" | "none";
type LastVisitBucket = "7d" | "30d" | "60d" | "90d" | "over90" | "never";
// Archive is a "place", not a lifecycle status (client 2026-08-10) — the only
// two customer actions that change visibility are Archive and Recover.
type RowActionKind = "archive" | "recover" | "delete";

const ALL_PLAN_TYPES: PlanType[] = ["membership", "package", "none"];
const PLAN_LABEL: Record<PlanType, string> = {
    membership: "Membership", package: "Package", none: "No plan",
};

const LAST_VISIT_OPTIONS: { value: LastVisitBucket; label: string }[] = [
    { value: "7d", label: "Last 7 days" },
    { value: "30d", label: "Last 30 days" },
    { value: "60d", label: "Last 60 days" },
    { value: "90d", label: "Last 90 days" },
    { value: "over90", label: "Over 90 days ago" },
    { value: "never", label: "Never visited" },
];

interface FilterState {
    planTypes: PlanType[];
    lastVisit: LastVisitBucket[];
    planExpiryStart: string;   // "" = no lower bound
    planExpiryEnd: string;     // "" = no upper bound
    /** v83 client 2026-07-27 — multi-select over the 7 lifecycle stages.
     *  Empty = no filter. Stacks on top of the segment tabs (Members /
     *  Leads / Inactive) so a user can further scope inside a segment. */
    lifecycleTags: import("@/lib/store").LifecycleTag[];
    // v83 audit-1 (2026-07-29) — `branchId` intentionally removed from
    // this panel. Branch scope is owned exclusively by the toolbar's
    // branch dropdown so admins can't accidentally AND two branch filters
    // together and get 0 rows with no visible reason (toolbar=South +
    // panel=North silently returned empty). Toolbar branch stays; the
    // panel now covers everything ELSE (status, plan type, dates,
    // lifecycle).
}
const ALL_LIFECYCLE_TAGS: import("@/lib/store").LifecycleTag[] = [
    "Lead", "Trialist", "New Active", "Loyal Active", "At Risk", "Churned", "Won-back",
];
const EMPTY_FILTER: FilterState = {
    planTypes: [], lastVisit: [], planExpiryStart: "", planExpiryEnd: "",
    lifecycleTags: [],
};

// ─── Display helpers ─────────────────────────────────────────────────────────

/** "Mar 25, 2026" — accepts both date-only ISO and full timestamps; UTC-anchored. */
function fmtDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Whole days between two "YYYY-MM-DD" calendar dates (UTC-anchored). */
function daysBetween(fromISO: string, toISO: string): number {
    const a = new Date(`${fromISO}T00:00:00Z`).getTime();
    const b = new Date(`${toISO}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
}

// ─── Action modal config (tone matrix mirrors /admin/products) ───────────────

const DESTRUCTIVE_ACTIONS = new Set<RowActionKind>(["delete"]);

const MODAL_CONFIG: Record<RowActionKind, {
    IconComp: React.ComponentType<{ className?: string }>;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
}> = {
    archive: {
        IconComp: Archive,
        titleSingle: "Archive this customer?",
        titleBulk: n => `Archive ${n} customers?`,
        description: (_subject, n) => n > 1
            ? <>These customers will be hidden from lists, counts, and search. You can unarchive anytime.</>
            : <>This customer will be hidden from lists, counts, and search. You can unarchive anytime.</>,
        confirmLabel: "Archive",
    },
    recover: {
        IconComp: RefreshCcw01,
        titleSingle: "Recover this customer?",
        titleBulk: n => `Recover ${n} customers?`,
        description: subject => <>{subject} will be restored to the customer list and included again in counts, search, and campaigns.</>,
        confirmLabel: "Recover",
    },
    delete: {
        IconComp: Trash02,
        titleSingle: "Delete this customer?",
        titleBulk: n => `Delete ${n} customers?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
    },
};

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="flex items-center justify-center pointer-events-none w-full h-full min-h-[400px]">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <div className="bg-[var(--colors-bg-secondary)] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                        <div className="bg-[var(--colors-bg-secondary)] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center">
                            <AlignLeft className="w-[18px] h-[18px] text-[var(--colors-fg-quaternary)]" />
                        </div>
                    </div>
                    <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-[82px] rounded-full" />
                        <div className="bg-[var(--colors-bg-tertiary)] h-[13px] w-full rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 text-center max-w-[340px]">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Filter side panel ───────────────────────────────────────────────────────

function FilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T>(arr: T[], val: T): T[] {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    const hasAny =
        pending.planTypes.length > 0 ||
        pending.lastVisit.length > 0 ||
        pending.planExpiryStart !== "" ||
        pending.planExpiryEnd !== "" ||
        pending.lifecycleTags.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
<div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                    <p className="font-heading flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* v83 client 2026-07-27 — Lifecycle filter chip group.
                        Stacks on top of the segment tabs so "Members ∧ Loyal
                        Active" is a valid pinned scope. */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Lifecycle</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_LIFECYCLE_TAGS.map(t => (
                                <FilterPill key={t} label={t} selected={pending.lifecycleTags.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, lifecycleTags: toggle(p.lifecycleTags, t) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />

                    {/* Plan expiry date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Plan expiry date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker
                                value={pending.planExpiryStart}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    planExpiryStart: v,
                                    // keep end ≥ start
                                    planExpiryEnd: p.planExpiryEnd && v && p.planExpiryEnd < v ? "" : p.planExpiryEnd,
                                }))}
                                placeholder="Start date"
                            />
                            <DatePicker
                                value={pending.planExpiryEnd}
                                onChange={v => setPending(p => ({ ...p, planExpiryEnd: v }))}
                                placeholder="End date"
                                minDate={pending.planExpiryStart || undefined}
                            />
                        </div>
                    </div>

                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />

                    {/* Plan type */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Plan type</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_PLAN_TYPES.map(t => (
                                <FilterPill key={t} label={PLAN_LABEL[t]} selected={pending.planTypes.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, planTypes: toggle(p.planTypes, t) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />

                    {/* v83 audit-1 (2026-07-29) — Branch location filter
                        removed. Toolbar branch dropdown is now the single
                        source of truth for branch scope; the panel field
                        would AND with the toolbar and silently produce 0
                        rows when they didn't match. */}

                    {/* Last visit date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Last visit date range</p>
                        <div className="flex flex-wrap gap-2">
                            {LAST_VISIT_OPTIONS.map(o => (
                                <FilterPill key={o.value} label={o.label} selected={pending.lastVisit.includes(o.value)}
                                    onClick={() => setPending(p => ({ ...p, lastVisit: toggle(p.lastVisit, o.value) }))} />
                            ))}
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

// Local Pagination removed — now uses the canonical
// `<Pagination>` from `@/components/ui/Pagination`.

// ─── Checkbox cell ───────────────────────────────────────────────────────────

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: (next: boolean) => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={() => onChange(!checked)}
            className={cn(
                "w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)] text-white"
                    : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-secondary-500)]"
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// ─── Floating bulk action bar ────────────────────────────────────────────────

function BulkActionBar({ count, flags, onClear, onAction }: {
    count: number;
    flags: { archive: boolean; recover: boolean; delete: boolean };
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <BulkBarDock>
            <div className="pointer-events-auto bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] font-medium text-[var(--colors-text-primary)] hover:bg-[var(--colors-bg-secondary)] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
                <div className="flex items-center gap-3">
                    {flags.archive && (
                        <Button variant="secondary-gray" leftIcon={<Archive className="w-5 h-5 text-[var(--colors-text-quaternary)]" />} onClick={() => onAction("archive")}>
                            Archive
                        </Button>
                    )}
                    {flags.recover && (
                        <Button variant="secondary-gray" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#164e52]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                    {flags.delete && (
                        <Button variant="secondary-gray"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => onAction("delete")}>
                            Delete
                        </Button>
                    )}
                </div>
            </div>
        </BulkBarDock>
    );
}

// ─── Row shape ───────────────────────────────────────────────────────────────

type CustomerRow = {
    id: string;
    name: string;
    initials: string;
    imageUrl?: string;
    email: string;
    phone: string;
    joinedISO: string;
    planType: PlanType;
    status: CustomerStatus;
    lastVisitISO?: string;
    planExpiryISO?: string;
    branchId: string;
    /** True when the customer has booking history — Delete is gated on this. */
    hasHistory: boolean;
    // v83 lifecycle — read from customer.lifecycleTag (stamped by the store's
    // recompute hook). Missing means the customer predates v83; the segment
    // tab treats "missing" as the fallback "Lead" bucket per plan §1.
    lifecycleTag?: import("@/lib/store").LifecycleTag;
    isVip?: boolean;
    /** v83 Phase 3 — used by the "Assigned to me" chip filter. */
    assignedTo?: string;
};

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: CustomerRow; kind: RowActionKind; note?: string }
    | { mode: "bulk"; rows: CustomerRow[]; kind: RowActionKind; note?: string };

// ─── Sortable-column comparators (shared by the active + archived tables) ────
// Order lifecycle tags by "funnel depth" so ascending puts leads at the top and
// loyal members at the bottom — mirrors the mental model in PDF §2.1.
const LIFECYCLE_ORDER: Record<string, number> = {
    "Lead": 0, "Trialist": 1, "New Active": 2, "Loyal Active": 3,
    "Won-back": 4, "At Risk": 5, "Churned": 6,
};
const CUSTOMER_SORT: Record<string, (a: CustomerRow, b: CustomerRow) => number> = {
    name:      (a, b) => a.name.localeCompare(b.name),
    contact:   (a, b) => a.email.localeCompare(b.email),
    plan:      (a, b) => a.planType.localeCompare(b.planType),
    lifecycle: (a, b) => (LIFECYCLE_ORDER[a.lifecycleTag ?? "Lead"] ?? 99) - (LIFECYCLE_ORDER[b.lifecycleTag ?? "Lead"] ?? 99),
    lastVisit: (a, b) => {
        // No-visit rows sort to the end regardless of direction by pegging them
        // to a sentinel larger than any real ISO.
        const av = a.lastVisitISO ?? "9999-99-99";
        const bv = b.lastVisitISO ?? "9999-99-99";
        return av.localeCompare(bv);
    },
};

// ─── Customer table (header + rows) ──────────────────────────────────────────
// Rendered for BOTH the active list and the Archived section — each passes its
// own rows + sort; selection is shared across both. `renderRowActions` is
// supplied by the page so all router / confirm wiring stays there.
function CustomerTable({ rows, selectedIds, onToggleOne, onToggleAll, sortKey, sortDir, onSort, onRowClick, renderRowActions }: {
    rows: CustomerRow[];
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (check: boolean, rows: CustomerRow[]) => void;
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    onRowClick: (id: string) => void;
    renderRowActions: (r: CustomerRow) => React.ReactNode;
}) {
    const allChecked = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && rows.some(r => selectedIds.has(r.id));
    return (
        <div className="px-6">
            {/* table-fixed — column widths follow the <th> widths, not the cell
                content, so columns keep a stable width when sorting reorders rows. */}
            <table className="w-full border-collapse table-fixed">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[44px]")}>
                            <CheckboxCell checked={allChecked} indeterminate={someChecked}
                                onChange={(c) => onToggleAll(c, rows)} ariaLabel="Select all rows on this page" />
                        </th>
                        <th className={cn(TH, "w-[280px]")}><SortableHeader sortKey="name"      currentSort={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader></th>
                        <th className={cn(TH, "w-[240px]")}><SortableHeader sortKey="contact"   currentSort={sortKey} dir={sortDir} onSort={onSort}>Contact</SortableHeader></th>
                        <th className={cn(TH, "w-[150px]")}><SortableHeader sortKey="plan"      currentSort={sortKey} dir={sortDir} onSort={onSort}>Plan</SortableHeader></th>
                        <th className={cn(TH, "w-[160px]")}><SortableHeader sortKey="lifecycle" currentSort={sortKey} dir={sortDir} onSort={onSort}>Lifecycle</SortableHeader></th>
                        <th className={cn(TH, "w-[140px]")}><SortableHeader sortKey="lastVisit" currentSort={sortKey} dir={sortDir} onSort={onSort}>Last visit</SortableHeader></th>
                        <th className={cn(TH, "w-[52px]")}></th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => {
                        const isSelected = selectedIds.has(r.id);
                        return (
                            <tr key={r.id}
                                onClick={() => onRowClick(r.id)}
                                className={cn(
                                    "transition-colors cursor-pointer",
                                    isSelected ? "bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]",
                                )}>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <CheckboxCell checked={isSelected} onChange={() => onToggleOne(r.id)} ariaLabel={`Select ${r.name}`} />
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <TableAvatar initials={r.initials} imageUrl={r.imageUrl} size={40} />
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">{r.name}</span>
                                            <span className="text-[13px] text-[var(--colors-text-quaternary)]">Joined {fmtDate(r.joinedISO)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[14px] text-[var(--colors-text-tertiary)] truncate">{r.email}</span>
                                        <span className="text-[13px] text-[var(--colors-text-quaternary)] truncate">{r.phone || "—"}</span>
                                    </div>
                                </td>
                                <td className={TD}><StatusBadge type="plan" status={r.planType} /></td>
                                <td className={TD}>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <StatusBadge type="lifecycle" status={r.lifecycleTag ?? "Lead"} />
                                        {r.isVip && <StatusBadge type="vip" status="vip" />}
                                    </div>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap text-[var(--colors-text-tertiary)]")}>
                                    {r.lastVisitISO ? fmtDate(r.lastVisitISO) : "—"}
                                </td>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    {renderRowActions(r)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export default function CustomersPage() {
    const router = useRouter();

    // ─── Store subscriptions ────────────────────────────────────────────────
    const customers = useAppStore(s => s.customers);
    const classBookings = useAppStore(s => s.classBookings);
    const branches = useAppStore(s => s.branches);
    const setCustomerStatus = useAppStore(s => s.setCustomerStatus);
    const deleteCustomers = useAppStore(s => s.deleteCustomers);
    const showToast = useAppStore(s => s.showToast);
    // v83 Phase 3 — "Assigned to me" filter chip needs the current staff id
    // to compare against customer.assignedTo. Falls back to the auth user id
    // when the role has no staff row (owner etc.).
    const currentUser = useAppStore(s => s.currentUser);
    // v83 audit fix — CSV export needs staff for the "Assigned to" column.
    const staff = useAppStore(s => s.staff);
    // Client 2026-07-27 (audit #4 follow-up) — the profile computes
    // lifecycle live via `computeLifecycleTag`; the list used to read
    // the STORED `lifecycleTag` field, which could drift stale if the
    // recompute hook missed a write path. That produced the "table says
    // Lead but details say Churned" mismatch the client flagged. Fix:
    // list also computes on the fly, so both surfaces use the same
    // function and stay in agreement by construction.
    const customerPlans = useAppStore(s => s.customerPlans);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const appointmentBookings = useAppStore(s => s.appointmentBookings);

    // ─── Local UI state ─────────────────────────────────────────────────────
    // Branch filter defaults to "" ("All locations") — Owner + Branch Admin
    // both start on the aggregate view so the module reads like the full
    // studio on first paint, not a branch slice.
    const [branchId, setBranchId] = usePersistedListState<string>("customers:branchId", "");
    const [search, setSearch] = usePersistedListState("customers:search", "");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = usePersistedListState<FilterState>("customers:applied", EMPTY_FILTER);
    const [page, setPage] = usePersistedListState("customers:page", 1);
    const [pageSize, setPageSize] = usePersistedListState("customers:pageSize", 10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Hide the FloatingAiButton while bulk-select mode has ≥1 row checked.
    useBulkSelectionSignal(selectedIds.size > 0);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    // Wallet segment tabs (client 2026-08-10) — the partition is WALLET-based,
    // computed by `customerSegment`, never attendance:
    //   All      → no segment filter
    //   Leads    → never bought anything
    //   Members  → something live now (active/frozen plan or unexpired credits)
    //   Inactive → bought before, nothing live today
    // The tab strip reuses the same chrome as /admin/insights.
    const [segment, setSegment] = useState<"all" | "leads" | "members" | "inactive">("all");
    // Archived is a "place", not a tab — archived customers leave the active
    // table and render in the shared <ArchivedSection> below it (policy §3).
    // The section owns its own collapse state; the page owns archived paging.
    const [archivedPage, setArchivedPage] = useState(1);
    // v83 Phase 3 — "Assigned to me" chip. Off by default; when on, filters
    // to rows whose customer.assignedTo matches the current staff id.
    const [mineOnly, setMineOnly] = useState(false);

    // Reset to page 1 whenever the result set changes shape — but NOT on the
    // initial mount, so a page restored from the cross-nav cache survives.
    // Deps include the lifecycle segment + "assigned to me" chip so switching
    // either also returns to page 1.
    const didMountRef = useRef(false);
    useEffect(() => {
        if (!didMountRef.current) { didMountRef.current = true; return; }
        setPage(1);
        setArchivedPage(1);
    }, [search, applied, branchId, pageSize, segment, mineOnly]);

    // Branch dropdown — active branches from the live `branches` slice so
    // adds/archives in Business & Locations propagate immediately.
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // ─── Build rows (history flag derived live from bookings) ───────────────
    const allRows = useMemo<CustomerRow[]>(() => {
        // History-bearing = any class booking, appointment booking, or
        // purchase/refund transaction. Mirrors the store's deleteCustomers
        // guard so the Delete option only appears for truly history-free
        // customers (not those with appointment or financial history).
        const historyCustomerIds = new Set<string>([
            ...classBookings.map(b => b.customerId),
            ...appointmentBookings.map(b => b.customerId),
            ...customerTransactions.map(t => t.customerId),
        ]);
        // A customer who ever held a plan (active OR expired/cancelled) carries
        // history too — counted alongside bookings / transactions.
        const customerPlanCustomerIds = new Set<string>(customerPlans.map(p => p.customerId));
        const liveState = { customers, classBookings, customerPlans, customerTransactions };
        // Plan column reads the customer's ACTUAL held plans (customerPlans is
        // the source of truth) so the table always matches the profile detail.
        // The denormalized `c.planKind` can drift out of sync (client-reported
        // 2026-08-19: table said "Membership" while the profile showed a package).
        // A customer holds one membership OR one-or-more packages, so membership
        // wins when resolving the single column value.
        const activePlanByCustomer = new Map<string, PlanType>();
        for (const p of customerPlans) {
            if (p.status !== "active" && p.status !== "frozen") continue;
            if (p.kind === "membership") activePlanByCustomer.set(p.customerId, "membership");
            else if (p.kind === "package" && activePlanByCustomer.get(p.customerId) !== "membership") {
                activePlanByCustomer.set(p.customerId, "package");
            }
        }
        // Newest customers first so a just-created customer lands at the top.
        return [...customers]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .map(c => {
                // Client 2026-07-27 — LIVE compute so this list agrees with
                // the profile's drawer / pill (which also computes live).
                // Falls back to the stored tag only if compute returns
                // nothing usable (defensive; shouldn't happen).
                const lc = computeLifecycleTag(c.id, liveState);
                const tag = lc?.tag ?? c.lifecycleTag ?? "Lead";
                return {
                    id: c.id,
                    name: `${c.firstName} ${c.lastName}`.trim(),
                    initials: c.initials,
                    imageUrl: c.imageUrl,
                    email: c.email,
                    phone: c.phone ?? "",
                    joinedISO: c.createdAt,
                    planType: activePlanByCustomer.get(c.id) ?? "none",
                    status: c.status,
                    lastVisitISO: c.lastVisitISO,
                    planExpiryISO: c.planExpiryISO,
                    branchId: c.branchId,
                    // History-bearing = any real record on file: a class /
                    // appointment booking, a purchase/refund transaction, or a
                    // plan ever held (active OR expired). A customer with ZERO
                    // such records is hard-deletable regardless of the computed
                    // lifecycle tag (CLAUDE.md archive rule: Delete only when 0
                    // history). Drives both the row Delete and the bulk-bar Delete.
                    hasHistory: historyCustomerIds.has(c.id)
                        || customerPlanCustomerIds.has(c.id),
                    lifecycleTag: tag,
                    isVip: c.isVip,
                    assignedTo: c.assignedTo,
                };
            });
    }, [customers, classBookings, appointmentBookings, customerPlans, customerTransactions]);

    // ─── Apply branch + search + filter ─────────────────────────────────────
    const today = todayISO();

    // Wallet segment per customer — Lead / Member / Inactive, computed ONCE from
    // the wallet (plans + purchases), never attendance. Single source of truth
    // shared by the tab filter AND the per-tab counts. Archived customers keep a
    // segment but are excluded upstream (Phase 3) — a "place", not a segment.
    const segmentById = useMemo(() => {
        const plansByCust = new Map<string, CustomerPlan[]>();
        for (const p of customerPlans) {
            const a = plansByCust.get(p.customerId);
            if (a) a.push(p); else plansByCust.set(p.customerId, [p]);
        }
        const txnsByCust = new Map<string, CustomerTransaction[]>();
        for (const t of customerTransactions) {
            const a = txnsByCust.get(t.customerId);
            if (a) a.push(t); else txnsByCust.set(t.customerId, [t]);
        }
        const out = new Map<string, CustomerSegment>();
        for (const c of customers) {
            out.set(c.id, customerSegment(c, plansByCust.get(c.id) ?? [], txnsByCust.get(c.id) ?? [], today));
        }
        return out;
    }, [customers, customerPlans, customerTransactions, today]);

    // Rows after EVERY filter except the segment tab — the base set the segment
    // tab counts + partition operate on.
    const scopedRows = useMemo(() => {
        const q = search.trim().toLowerCase();

        function matchesLastVisit(r: CustomerRow): boolean {
            if (applied.lastVisit.length === 0) return true;
            return applied.lastVisit.some(bucket => {
                if (bucket === "never") return !r.lastVisitISO;
                if (!r.lastVisitISO) return false;
                const days = daysBetween(r.lastVisitISO, today);
                switch (bucket) {
                    case "7d": return days >= 0 && days <= 7;
                    case "30d": return days >= 0 && days <= 30;
                    case "60d": return days >= 0 && days <= 60;
                    case "90d": return days >= 0 && days <= 90;
                    case "over90": return days > 90;
                }
            });
        }

        return allRows.filter(r => {
            // Both active AND archived pass here (branch/search/filters/mineOnly
            // apply to both); the active vs archived split happens downstream so
            // each renders in its own section.
            if (branchId && r.branchId !== branchId) return false;
            if (q && !(
                r.name.toLowerCase().includes(q) ||
                r.email.toLowerCase().includes(q) ||
                r.phone.toLowerCase().includes(q)
            )) return false;
            if (applied.planTypes.length > 0 && !applied.planTypes.includes(r.planType)) return false;
            if (applied.lifecycleTags.length > 0 && !applied.lifecycleTags.includes(r.lifecycleTag ?? "Lead")) return false;
            if (!matchesLastVisit(r)) return false;
            if (applied.planExpiryStart || applied.planExpiryEnd) {
                // No-plan customers have no expiry — excluded once the range is set.
                if (!r.planExpiryISO) return false;
                if (applied.planExpiryStart && r.planExpiryISO < applied.planExpiryStart) return false;
                if (applied.planExpiryEnd && r.planExpiryISO > applied.planExpiryEnd) return false;
            }
            // v83 Phase 3 — "Assigned to me" chip. When on, keep only rows
            // whose customer.assignedTo matches the current signed-in staff.
            // v83 audit-1 (2026-07-29) — match against `currentUser.staff_id`
            // (the staff row this account maps to) NOT `currentUser.id` (the
            // account id, e.g. "u-admin-1"). Every customer.assignedTo is a
            // `staff_*` id sourced from the staff picker, so comparing to
            // account id always returned 0 rows.
            const meStaffId = currentUser?.staff_id;
            if (mineOnly && meStaffId && r.assignedTo !== meStaffId) return false;
            return true;
        });
    }, [allRows, branchId, search, applied, today, mineOnly, currentUser?.staff_id]);

    // Split off archived rows → the shared Archived section below (policy §3).
    // `nonArchived` is the active-list base; `archivedRows` is a flat list (no
    // wallet segment); search/filters/branch already applied to both above.
    const { active: nonArchived, archived: archivedRows } = useArchiveView(scopedRows);

    // Active list = non-archived, narrowed to the selected wallet tab. The
    // Lead/Member/Inactive partition is WALLET-based (client 2026-08-10) — an
    // "At Risk" member with a live plan still sits in Members.
    const activeRows = useMemo(() => {
        if (segment === "all") return nonArchived;
        const want: CustomerSegment = segment === "leads" ? "lead" : segment === "members" ? "member" : "inactive";
        return nonArchived.filter(r => (segmentById.get(r.id) ?? "lead") === want);
    }, [nonArchived, segment, segmentById]);

    // ─── Pagination slice ───────────────────────────────────────────────────
    // ── Sortable columns (shared CUSTOMER_SORT) — active + archived tables ──
    // Each section sorts + paginates independently; they share `pageSize`.
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<CustomerRow>(activeRows, CUSTOMER_SORT);
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const { sorted: archivedSortedRows, sortKey: archSortKey, sortDir: archSortDir, toggle: toggleArchSort } = useSort<CustomerRow>(archivedRows, CUSTOMER_SORT);
    const archivedTotalPages = Math.max(1, Math.ceil(archivedSortedRows.length / pageSize));
    const clampedArchivedPage = Math.min(Math.max(1, archivedPage), archivedTotalPages);
    const pagedArchivedRows = archivedSortedRows.slice((clampedArchivedPage - 1) * pageSize, clampedArchivedPage * pageSize);

    // ─── Selection ──────────────────────────────────────────────────────────
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    }
    // Toggle every row in the given table page (active OR archived) — each
    // <CustomerTable> passes its own visible rows. Selection is shared across
    // both sections.
    function toggleAllRows(check: boolean, rows: CustomerRow[]) {
        const next = new Set(selectedIds);
        if (check) rows.forEach(r => next.add(r.id));
        else rows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    // Selected rows span BOTH sections (selection survives pagination); the
    // bulk-bar flags derive archive/recover/delete from their statuses.
    const selectedRows = useMemo(
        () => [...activeRows, ...archivedRows].filter(r => selectedIds.has(r.id)),
        [activeRows, archivedRows, selectedIds],
    );
    // Archive / Recover / Delete. Delete is offered only for history-free rows
    // (CLAUDE.md archive rule — anything with booking history can only be
    // archived, never hard-deleted). Archive + Delete can co-exist in the bar.
    const allHistoryFree = selectedRows.length > 0 && selectedRows.every(r => !r.hasHistory);
    const bulkFlags = {
        archive: selectedRows.some(r => r.status !== "archived"),
        recover: selectedRows.some(r => r.status === "archived"),
        delete: allHistoryFree,
    };

    // ─── Active-filter dot ──────────────────────────────────────────────────
    const hasActiveFilter =
        applied.planTypes.length > 0 ||
        applied.lastVisit.length > 0 ||
        applied.planExpiryStart !== "" || applied.planExpiryEnd !== "" ||
        applied.lifecycleTags.length > 0;

    // ─── Action plumbing ────────────────────────────────────────────────────
    function openRowConfirm(row: CustomerRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "archive": return selectedRows.filter(r => r.status !== "archived");
                case "recover": return selectedRows.filter(r => r.status === "archived");
                case "delete": return selectedRows.filter(r => !r.hasHistory);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);
        const single = rows.length === 1;

        if (kind === "delete") {
            const { deleted } = deleteCustomers(ids);
            if (deleted.length > 0) {
                showToast(
                    single ? "Customer deleted" : `${deleted.length} customers deleted`,
                    single
                        ? `${rows[0].name} has been permanently removed.`
                        : "The selected customers have been permanently removed.",
                    "success", "trash",
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // ─── Archive / Recover ──────────────────────────────────────────────
        // Archiving never touches access — it only hides the row from the list.
        const nextStatus: CustomerStatus = kind === "archive" ? "archived" : "active";
        setCustomerStatus(ids, nextStatus, kind === "archive" ? pending.note : undefined);

        const verbPast = kind === "archive" ? "archived" : "recovered";
        const icon: "archive" | "refresh" = kind === "archive" ? "archive" : "refresh";
        const tone: "success" | "error" = "success";

        if (single) {
            showToast(
                `Customer ${verbPast}`,
                `${rows[0].name} has been ${verbPast}.`,
                tone, icon,
            );
        } else {
            showToast(
                `${rows.length} customers ${verbPast}`,
                `The selected customers have been ${verbPast}.`,
                tone, icon,
            );
        }
        clearSelection();
        setPendingConfirm(null);
    }

    // ─── Modal subject ──────────────────────────────────────────────────────
    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[var(--colors-text-secondary)]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[var(--colors-text-secondary)]">{p.rows.length}</span> selected customers</>,
        };
    }

    const isTrulyEmpty = allRows.length === 0;

    // v83 client 2026-07-27 — segment tabs restated as SegmentedTabs for
    // the Staff/Shifts-style layout: toolbar row on top → rounded
    // container box wrapping the pill-tab strip + table. Same tab keys
    // (all / leads / members / inactive) so downstream filter code
    // doesn't need to change.
    // No count badges on the tabs — client feedback only calls for a count on
    // the "View archived (n)" link, not the segment tabs.
    const segmentTabDefs = [
        { key: "all",      label: "All"      },
        { key: "leads",    label: "Leads"    },
        { key: "members",  label: "Members"  },
        { key: "inactive", label: "Inactive" },
    ];

    // Row-action menu — shared by the active + archived tables. Active rows
    // offer Archive; archived rows offer Recover; Delete only when history-free.
    const goToCustomer = (id: string) => router.push(`/customers/${id}?returnTo=${encodeURIComponent("/admin/customers")}`);
    const renderRowActions = (r: CustomerRow) => (
        <RowActions
            items={[
                { label: "View profile", icon: Eye, onClick: () => goToCustomer(r.id) },
                {
                    label: "Edit", icon: Edit02,
                    onClick: () => router.push(`/customers/${r.id}/edit?returnTo=/admin/customers`),
                    hidden: r.status !== "active",
                },
                {
                    label: "Add complimentary credit", icon: HeartHand,
                    onClick: () => router.push(`/customers/${r.id}/add-credit?returnTo=/admin/customers`),
                    hidden: r.status !== "active",
                },
                { label: "Archive", icon: Archive, onClick: () => openRowConfirm(r, "archive"), hidden: r.status === "archived" },
                { label: "Recover", icon: RefreshCcw01, onClick: () => openRowConfirm(r, "recover"), hidden: r.status !== "archived" },
                { label: "Delete", icon: Trash01, onClick: () => openRowConfirm(r, "delete"), danger: true, hidden: r.hasHistory },
            ]}
        />
    );

    return (
        // Fill-to-viewport: the view card fills the remaining height (flex-1
        // min-h-0) so only the table body scrolls — sticky header pinned at top,
        // pagination pinned at the bottom. Consistent across every admin list
        // (the AI trigger now lives in the header, so no bottom clearance needed).
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* ── Toolbar ── matches /admin/staff (Total · Location · Search
                · Export · Filter · Assigned-to-me chip). */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={activeRows.length} entitySingular="customer" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search customer..." />
                <ToolbarExport
                    disabled={activeRows.length + archivedRows.length === 0}
                    exportData={() => {
                        // Map the filtered display rows (active + archived, all
                        // that pass the current filters) back to their full store
                        // records so the export carries the migration column set.
                        const byId = new Map(customers.map(c => [c.id, c]));
                        const rows = [...activeRows, ...archivedRows]
                            .map(r => byId.get(r.id))
                            .filter((c): c is Customer => !!c);
                        const branchName = new Map(branches.map(b => [b.id, b.name]));
                        const staffName = new Map(staff.map(s => [
                            s.id,
                            (s.fullName || `${s.firstName} ${s.lastName}`).trim() || s.email,
                        ]));
                        return customersExportData(rows, {
                            branchName: id => branchName.get(id) ?? "",
                            staffName: id => staffName.get(id) ?? "",
                        });
                    }}
                    onExported={(fmt) => {
                        const n = activeRows.length + archivedRows.length;
                        showToast("Customer list exported", `${n} customer${n === 1 ? "" : "s"} exported to ${fmt.toUpperCase()}.`, "success", "check");
                    }}
                />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                {/* Import — empty-state only (client 2026-07-31). Hidden once the table has real data so admins default to "Add new". */}
                <ToolbarImportButton visible={customers.length === 0 && !search.trim() && !hasActiveFilter} />
            </div>

            {/* Scroll region — the active card fills the viewport (its pagination
                stays pinned + visible, no page scroll needed); the Archived
                section sits below and is reached by scrolling THIS region. */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-6">
            {/* ── Active view card — segment tabs + active customer table. `h-full`
                   fills the scroll region so a short list never hugs (CLAUDE.md)
                   and the pagination pins to the bottom of the viewport. */}
            <div className="shrink-0 h-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                <div className="shrink-0 px-6 py-4 flex items-center gap-3">
                    <SegmentedTabs
                        tabs={segmentTabDefs}
                        activeKey={segment}
                        onChange={(k) => setSegment(k as typeof segment)}
                    />
                    <div className="flex-1" />
                    {/* "Assigned to me" scope toggle — hidden while lead
                        assignment is off (boutique doesn't assign leads to a
                        person). See @/lib/lead-assignment. */}
                    {LEAD_ASSIGNMENT_ENABLED && currentUser?.id && (
                        <Button
                            variant="secondary-gray"
                            onClick={() => setMineOnly(v => !v)}
                            className={mineOnly ? "bg-[var(--colors-bg-tertiary)] text-[var(--colors-text-primary)]" : undefined}
                        >
                            {mineOnly ? "Showing yours only" : "Assigned to me"}
                        </Button>
                    )}
                </div>
                <div className="flex-auto min-h-0 overflow-y-auto scrollbar-hide relative">
                    {pagedRows.length === 0 ? (
                        <EmptyState
                            title={isTrulyEmpty ? "No customers yet" : "No customers found"}
                            subtitle={isTrulyEmpty
                                ? "Add your first customer to get started."
                                : "Try adjusting your search or filters."}
                        />
                    ) : (
                        <CustomerTable
                            rows={pagedRows}
                            selectedIds={selectedIds}
                            onToggleOne={toggleOne}
                            onToggleAll={toggleAllRows}
                            sortKey={sortKey}
                            sortDir={sortDir}
                            onSort={toggleSort}
                            onRowClick={goToCustomer}
                            renderRowActions={renderRowActions}
                        />
                    )}

                    {/* Floating bulk action pill — spans both sections. */}
                    <BulkActionBar
                        count={selectedIds.size}
                        flags={bulkFlags}
                        onClear={clearSelection}
                        onAction={openBulkConfirm}
                    />
                </div>

                <div className="shrink-0 px-6">
                    <Pagination
                        page={clampedPage} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {/* ── Archived section — shared <ArchivedSection> (policy §3). Renders
                   only when archived rows exist; collapsible (default expanded);
                   its own table + pagination; selection + search/filters shared
                   with the active list. */}
            <ArchivedSection
                entitySingular="customer"
                count={archivedRows.length}
                modalWidthClass="w-[1160px]"
                pagination={
                    <Pagination
                        page={clampedArchivedPage} total={archivedSortedRows.length} pageSize={pageSize}
                        onPage={setArchivedPage} onPageSize={s => { setPageSize(s); setArchivedPage(1); }}
                    />
                }
            >
                <CustomerTable
                    rows={pagedArchivedRows}
                    selectedIds={selectedIds}
                    onToggleOne={toggleOne}
                    onToggleAll={toggleAllRows}
                    sortKey={archSortKey}
                    sortDir={archSortDir}
                    onSort={toggleArchSort}
                    onRowClick={goToCustomer}
                    renderRowActions={renderRowActions}
                />
            </ArchivedSection>
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); }}
            />

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count > 1
                    ? cfg.titleBulk(count)
                    : pendingConfirm.kind === "archive" && pendingConfirm.mode === "row"
                        ? `Archive ${pendingConfirm.row.name}?`
                        : cfg.titleSingle;
                const tone = DESTRUCTIVE_ACTIONS.has(pendingConfirm.kind) ? "danger" : "success";
                // Optional internal note captured on archive (display-only,
                // never shown to the customer). Stored on the customer record.
                const noteField = pendingConfirm.kind === "archive" ? (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[13px] font-medium text-[var(--colors-text-secondary)]">
                            Reason <span className="text-[var(--colors-text-quaternary)]">(optional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={pendingConfirm.note ?? ""}
                            onChange={e => setPendingConfirm(p => (p ? { ...p, note: e.target.value } : p))}
                            placeholder="Why is this customer being archived? (duplicate, test, long-gone…)"
                            className="w-full resize-none rounded-[8px] border-1 border-[var(--colors-border-primary)] bg-white px-3 py-2 text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:border-[var(--colors-border-brand)]"
                        />
                    </div>
                ) : undefined;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone={tone}
                        title={title}
                        description={cfg.description(subject, count)}
                        confirmLabel={cfg.confirmLabel}
                        extraContent={noteField}
                        onConfirm={() => performAction(pendingConfirm)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}
