"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Memberships & Packages list view (/admin/products)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner-first build per CLAUDE.md. Mirrors the /admin/schedule list view shell,
// the /admin/pos slider filter, and the schedule class-detail bulk pattern.
//
// Patterns reused (no reinvention):
//   • CheckboxCell + floating "N selected" pill from /schedule/[classId]
//   • RangeSection + ValueChip from /admin/pos for the filter sliders
//   • ActionModal tone matrix from /class-types/[id] —
//       success modal: archive, recover, reactivate (green Archive icon)
//       destructive  : deactivate, delete           (red,  primary→destructive)
//   • Row-action "swap Deactivate ↔ Delete" — Delete only when no holders
//   • Toolbar / view-card chrome + pagination from /admin/schedule
//
// State source of truth: useAppStore(s => s.memberships / s.packages). Edits,
// status flips and deletes propagate to the Point of Sale catalog + class-types
// Applicable Plans tab + any future surface in the same render cycle.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, DotsVertical,
    ChevronLeft, Eye, Edit02, Trash01, Trash02, Archive, Check,
    Download01, MarkerPin01, AlignLeft, XClose, RefreshCcw01, SlashCircle01,
    CreditCard02, Package as PackageIcon,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarExport } from "@/components/patterns/ToolbarExport";
import { IconAvatar } from "@/components/patterns/IconAvatar";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { Toast } from "@/components/ui/Toast";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore,
    type Membership, type Package, type Customer, type Branch,
} from "@/lib/store";
import { findActiveTaxRuleFor, categoryForProductType } from "@/lib/tax-calc";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types & constants ───────────────────────────────────────────────────────

type TabId = "memberships" | "packages";
type ProductStatus = Membership["status"]; // "active" | "inactive" | "archived"

const ALL_STATUSES: ProductStatus[] = ["active", "inactive", "archived"];

const STATUS_LABEL: Record<ProductStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archived",
};

const STATUS_ORDER: Record<ProductStatus, number> = {
    active: 0, inactive: 1, archived: 2,
};

// FilterState mirrors POS shape: undefined min/max = "no filter set". The
// RangeSection helper handles the "both thumbs at floor → undefined" mapping.
interface FilterState {
    statuses: ProductStatus[];
    creditsMin?: number;
    creditsMax?: number;
    priceMin?: number;
    priceMax?: number;
}
const EMPTY_FILTER: FilterState = { statuses: [] };

const PRICE_FLOOR = 0;
const PRICE_CEILING = 30000;
const PRICE_STEP = 50;
const CREDITS_FLOOR = 0;
const CREDITS_CEILING = 50;

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

function formatCredits(c: Membership["credits"] | Package["credits"]): string {
    if (c === "unlimited") return "Unlimited";
    return `${c} ${c === 1 ? "credit" : "credits"}`;
}

function formatDuration(months: number): string {
    if (months === 1) return "1 month";
    if (months === 12) return "1 year";
    if (months % 12 === 0) return `${months / 12} years`;
    return `${months} months`;
}

function formatValidity(days: number): string {
    if (days === 7) return "7 days";
    if (days === 30) return "1 month";
    if (days === 60) return "2 months";
    if (days === 90) return "3 months";
    return `${days} days`;
}

function branchNamesFor(ids: string[], branches: Branch[]): string {
    if (ids.length === 0) return "All branches";
    const names = ids
        .map(id => branches.find(b => b.id === id)?.name ?? id)
        // strip the "Forma Studio " prefix so the cell stays compact
        .map(n => n.replace(/^Forma Studio /, ""));
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

// Local StatusBadge removed — uses canonical `<StatusBadge type="product">`
// from `@/components/patterns/StatusBadge`.

// ─── Price cell with live tax suffix (Phase 4 cross-module wiring) ──────────
//
// Renders the raw catalog price + a one-line subtle suffix that reflects the
// global "Prices include tax" toggle and any active tax_rule for this product
// category (Membership → tax_rule.category = "membership"; Package →
// "credit_package"). When no rule is set or the rate is archived, the suffix
// is omitted and the cell looks exactly like before.

function PriceCell({ priceAed }: { priceAed: number }) {
    // Tax annotation moved from the per-cell rendering to the Price column
    // header (see `PriceColumnHeaderTaxLine` below). One row in the header
    // says it once for the whole column instead of repeating per row.
    return (
        <span className="text-[14px] font-medium text-[#101828] whitespace-nowrap">{formatAed(priceAed)}</span>
    );
}

/** Sub-line that sits directly under the "Price" column header showing
 *  the active tax rule's percentage. Reads from the live `taxRules` +
 *  `taxRates` slices so edits in Settings → Tax flip the label same tick.
 *
 *  Skipped when the table has no rows (nothing to infer the row kind
 *  from) or when there's no active tax rule for the category. */
function PriceColumnHeaderTaxLine({ rows }: { rows: ProductRow[] }) {
    const taxRules = useAppStore(s => s.taxRules);
    const taxRates = useAppStore(s => s.taxRates);
    const pricesIncludeTax = useAppStore(s => s.taxSettings.pricesIncludeTax);
    const kind = rows[0]?.kind;
    if (!kind) return null;
    const category = categoryForProductType(kind);
    if (!category) return null;
    const match = findActiveTaxRuleFor({ taxRules, taxRates }, category, undefined);
    if (!match) return null;
    return (
        <span className="text-[11px] font-normal text-[#667085] normal-case whitespace-nowrap">
            {pricesIncludeTax
                ? `Inc. ${match.rate.ratePercentage}% tax`
                : `+ ${match.rate.ratePercentage}% tax`}
        </span>
    );
}

// Local ProductAvatar removed — uses canonical `<IconAvatar icon={...}>` from
// `@/components/patterns/IconAvatar`. Icon selected from `kind` at call site.

// ─── Filter pill (multi-select status) ───────────────────────────────────────


// Local RowActions removed — uses canonical `<RowActions items={[...]}>` from
// `@/components/patterns/RowActions`. Items array is built per-row at the
// call site below based on status + hasHolders.

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

// ─── Action modal (mirrors /class-types/[id] tone matrix) ────────────────────

type ModalAction = RowActionKind;

const DESTRUCTIVE_ACTIONS = new Set<ModalAction>(["deactivate", "delete"]);

/** Per-action visual + copy config. Archive/Recover/Reactivate are SUCCESS
 *  tones (green icon, primary button) — Deactivate + Delete are destructive
 *  (red icon, destructive button). Same matrix as the class-template
 *  ActionModal so reviewers see one consistent pattern across modules. */
const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this product?",
        titleBulk: n => `Archive ${n} products?`,
        description: subject => <>{subject} will be hidden from the Point of Sale catalog and the class-types Applicable Plans list. You can recover archived products at any time.</>,
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this product?",
        titleBulk: n => `Deactivate ${n} products?`,
        description: (subject, n) => <>{subject} will be hidden from new Point of Sale sales. Customers who already hold {n === 1 ? "it" : "them"} keep their access.</>,
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this product?",
        titleBulk: n => `Recover ${n} products?`,
        description: subject => <>{subject} will be restored to Active status and become sellable again.</>,
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this product?",
        titleBulk: n => `Reactivate ${n} products?`,
        description: subject => <>{subject} will become available again in the Point of Sale catalog.</>,
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this product?",
        titleBulk: n => `Delete ${n} products?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
    },
};

// Local ActionModal removed — uses canonical `<ConfirmModal>` from
// `@/components/modals/ConfirmModal`, driven by MODAL_CONFIG above.

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
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

// ─── Filter side panel (Status pills + POS slider sections) ──────────────────

function FilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: FilterState;
    onApply: (next: FilterState) => void;
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny =
        pending.statuses.length > 0 ||
        pending.creditsMin != null || pending.creditsMax != null ||
        pending.priceMin != null || pending.priceMax != null;

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Status — multi-select pills */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {ALL_STATUSES.map(s => (
                                <FilterPill key={s} label={STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Price range — order per user spec: Status → Price → Credits */}
                    <RangeSection
                        label="Price range"
                        floor={PRICE_FLOOR} ceiling={PRICE_CEILING} step={PRICE_STEP}
                        prefix="AED "
                        minValue={pending.priceMin}
                        maxValue={pending.priceMax}
                        onMin={v => setPending(p => ({ ...p, priceMin: v }))}
                        onMax={v => setPending(p => ({ ...p, priceMax: v }))}
                    />

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Credits range — same RangeSection / ValueChip pattern as POS */}
                    <RangeSection
                        label="Credit amount range"
                        floor={CREDITS_FLOOR} ceiling={CREDITS_CEILING}
                        minValue={pending.creditsMin}
                        maxValue={pending.creditsMax}
                        onMin={v => setPending(p => ({ ...p, creditsMin: v }))}
                        onMax={v => setPending(p => ({ ...p, creditsMax: v }))}
                    />
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

// ─── RangeSection + ValueChip (lifted from /admin/pos pattern) ───────────────

function RangeSection({ label, floor, ceiling, step = 1, prefix = "", minValue, maxValue, onMin, onMax }: {
    label: string;
    floor: number; ceiling: number; step?: number;
    prefix?: string;
    minValue?: number; maxValue?: number;
    onMin: (v: number | undefined) => void;
    onMax: (v: number | undefined) => void;
}) {
    // Default state: both thumbs at the floor. floor/floor → "no filter".
    const sliderMin = minValue ?? floor;
    const sliderMax = maxValue ?? floor;
    const isActive = sliderMin !== floor || sliderMax !== floor;

    function handleSliderChange(next: { min: number; max: number }) {
        // Mirror to parent — floor stays as `undefined` so the filter list
        // reads "any" while the slider chips still show 0.
        onMin(next.min <= floor ? undefined : next.min);
        onMax(next.max <= floor ? undefined : next.max);
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-[14px] font-medium text-[#344054]">{label}</p>
            <div className="px-1">
                <RangeSlider
                    floor={floor} ceiling={ceiling} step={step}
                    minValue={sliderMin} maxValue={sliderMax}
                    isActive={isActive}
                    onChange={handleSliderChange}
                />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-[#667085] text-center">Minimum</p>
                    <ValueChip prefix={prefix} value={sliderMin} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <p className="text-[12px] text-[#667085] text-center">Maximum</p>
                    <ValueChip prefix={prefix} value={sliderMax} />
                </div>
            </div>
        </div>
    );
}

function ValueChip({ prefix, value }: { prefix: string; value: number }) {
    return (
        <div className="h-11 px-4 flex items-center justify-center border-1 border-[#e4e7ec] rounded-[12px] text-[14px] font-medium text-[#101828]">
            {prefix}{value.toLocaleString()}
        </div>
    );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportProductsCsv(rows: ProductRow[]) {
    const header = ["Type", "Name", "Price (AED)", "Credits", "Duration", "Branches", "Status"];
    const body = rows.map(r => [
        r.kind === "membership" ? "Membership" : "Class package",
        r.name,
        String(r.priceAed),
        r.creditsLabel,
        r.durationLabel,
        r.branchesLabel,
        r.status,
    ]);
    downloadCsv(`memberships-packages-${todayISO()}.csv`, buildCsv(header, body));
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Checkbox cell (from schedule class-detail) ─────────────────────────────

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

// ─── Floating bulk action bar (matches schedule class-detail Figma) ─────────

function BulkActionBar({ count, hasArchivable, hasReactivatable, hasRecoverable, hasDeletable, onClear, onAction }: {
    count: number;
    hasArchivable: boolean;   // ≥1 selected row is active/inactive
    hasReactivatable: boolean; // ≥1 selected row is inactive
    hasRecoverable: boolean;   // ≥1 selected row is archived
    hasDeletable: boolean;     // ≥1 selected row has zero holders
    onClear: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                {/* Selection counter pill (click to clear) — whitespace-nowrap so
                    the "N selected" label stays on one line even when the
                    action button cluster grows. */}
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                {/* Actions */}
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
                    {/* Deactivate ↔ Delete swap rule applies to bulk too. When the
                        whole selection has zero holders we expose Delete (red);
                        otherwise we expose Deactivate (red). */}
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

// ─── Table header/cell constants ─────────────────────────────────────────────


// ─── Row shape ───────────────────────────────────────────────────────────────

type ProductRow = {
    id: string;
    kind: "membership" | "package";
    name: string;
    priceAed: number;
    creditsLabel: string;
    /** Sortable numeric proxy for credits. "unlimited" sorts last. */
    creditsSortValue: number;
    branchIds: string[];
    branchesLabel: string;
    durationLabel: string;
    durationDays: number;
    status: ProductStatus;
    /** True when at least one customer currently holds this product. Drives
     *  the row-action Deactivate↔Delete swap and the bulk-bar Delete gate. */
    hasHolders: boolean;
};

function rowsFromMemberships(items: Membership[], customers: Customer[], branches: Branch[]): ProductRow[] {
    return items.map(m => ({
        id: m.id,
        kind: "membership" as const,
        name: m.name,
        priceAed: m.price_aed,
        creditsLabel: formatCredits(m.credits),
        creditsSortValue: m.credits === "unlimited" ? Number.POSITIVE_INFINITY : m.credits,
        branchIds: m.branch_ids,
        branchesLabel: branchNamesFor(m.branch_ids, branches),
        durationLabel: formatDuration(m.duration_months),
        durationDays: m.duration_months * 30,
        status: m.status,
        hasHolders: customers.some(c => c.planKind === "membership" && c.membershipId === m.id),
    }));
}

function rowsFromPackages(items: Package[], customers: Customer[], branches: Branch[]): ProductRow[] {
    return items.map(p => ({
        id: p.id,
        kind: "package" as const,
        name: p.name,
        priceAed: p.price_aed,
        creditsLabel: formatCredits(p.credits),
        creditsSortValue: p.credits,
        branchIds: p.branch_ids,
        branchesLabel: branchNamesFor(p.branch_ids, branches),
        durationLabel: formatValidity(p.validity_days),
        durationDays: p.validity_days,
        status: p.status,
        hasHolders: customers.some(c => c.planKind === "package" && (c.packageIds ?? []).includes(p.id)),
    }));
}

// ─── List view (table) ──────────────────────────────────────────────────────

function ListView({
    rows, sortKey, sortDir, onSort,
    selectedIds, onToggleOne, onToggleAll,
    onRowAction, onViewOrEdit,
}: {
    rows: ProductRow[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onRowAction: (row: ProductRow, kind: RowActionKind) => void;
    onViewOrEdit: (row: ProductRow, mode: "view" | "edit") => void;
}) {
    if (rows.length === 0) {
        return (
            <div className="relative flex-1" style={{ minHeight: 300 }}>
                <EmptyState title="No products found" subtitle="Try adjusting your search or filters." />
            </div>
        );
    }

    const allChecked = rows.length > 0 && rows.every(r => selectedIds.has(r.id));
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
                                ariaLabel="Select all rows"
                            />
                        </th>
                        <th className={cn(TH, "w-[320px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <div className="flex flex-col gap-0.5">
                                <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
                                <PriceColumnHeaderTaxLine rows={rows} />
                            </div>
                        </th>
                        <th className={cn(TH, "w-[140px] !text-center")}>
                            <SortableHeader sortKey="credits" currentSort={sortKey} dir={sortDir} onSort={onSort} className="whitespace-nowrap">Credit amount</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[200px]")}>
                            <SortableHeader sortKey="branches" currentSort={sortKey} dir={sortDir} onSort={onSort}>Branch location</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="duration" currentSort={sortKey} dir={sortDir} onSort={onSort}>Duration</SortableHeader>
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
                                onClick={() => onViewOrEdit(r, "view")}
                                className={cn(
                                    "transition-colors cursor-pointer",
                                    isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                )}>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <CheckboxCell
                                        checked={isSelected}
                                        onChange={() => onToggleOne(r.id)}
                                        ariaLabel={`Select ${r.name}`}
                                    />
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <IconAvatar icon={r.kind === "membership" ? CreditCard02 : PackageIcon} />
                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap")}><PriceCell priceAed={r.priceAed} /></td>
                                <td className={cn(TD, "whitespace-nowrap text-center")}>{r.creditsLabel}</td>
                                <td className={TD}>{r.branchesLabel}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.durationLabel}</td>
                                <td className={TD}><StatusBadge type="product" status={r.status} /></td>
                                <td className={TD} onClick={e => e.stopPropagation()}>
                                    <RowActions items={[
                                        { label: "View details", icon: Eye, onClick: () => onViewOrEdit(r, "view") },
                                        { label: "Edit", icon: Edit02, onClick: () => onViewOrEdit(r, "edit"), hidden: r.status !== "active" },
                                        { label: "Archive", icon: Archive, onClick: () => onRowAction(r, "archive"), hidden: r.status !== "active" && r.status !== "inactive" },
                                        { label: "Reactivate", icon: Check, onClick: () => onRowAction(r, "reactivate"), hidden: r.status !== "inactive" },
                                        { label: "Recover", icon: RefreshCcw01, onClick: () => onRowAction(r, "recover"), hidden: r.status !== "archived" },
                                        { label: "Deactivate", icon: SlashCircle01, onClick: () => onRowAction(r, "deactivate"), danger: true, hidden: !(r.status === "active" && r.hasHolders) },
                                        { label: "Delete", icon: Trash01, onClick: () => onRowAction(r, "delete"), danger: true, hidden: !(r.status === "active" && !r.hasHolders) },
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
    | { mode: "row"; row: ProductRow; kind: RowActionKind }
    | { mode: "bulk"; rows: ProductRow[]; kind: RowActionKind };

export default function ProductsPage() {
    const router = useRouter();

    // ─── Store subscriptions ────────────────────────────────────────────────
    const memberships = useAppStore(s => s.memberships);
    const packages = useAppStore(s => s.packages);
    const customers = useAppStore(s => s.customers);
    const branches = useAppStore(s => s.branches);
    const setMembershipStatus = useAppStore(s => s.setMembershipStatus);
    const setPackageStatus = useAppStore(s => s.setPackageStatus);
    const deleteMembership = useAppStore(s => s.deleteMembership);
    const deleteMemberships = useAppStore(s => s.deleteMemberships);
    const deletePackage = useAppStore(s => s.deletePackage);
    const deletePackages = useAppStore(s => s.deletePackages);
    const showToast = useAppStore(s => s.showToast);

    // ─── Local UI state ─────────────────────────────────────────────────────
    const [tab, setTab] = useState<TabId>("memberships");
    // "" = "All locations" — products default to the aggregate view.
    const [branchId, setBranchId] = useState<string>("");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedMemberships, setSelectedMemberships] = useState<Set<string>>(new Set());
    const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    const selectedIds = tab === "memberships" ? selectedMemberships : selectedPackages;
    const setSelectedIds = (next: Set<string>) => {
        if (tab === "memberships") setSelectedMemberships(next);
        else setSelectedPackages(next);
    };

    // Reset page when tab/filters change
    useEffect(() => { setPage(1); }, [tab, search, applied, branchId]);

    // Branch dropdown — single source: live `branches` slice
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // ─── Build rows for the current tab (holder flag derived live) ──────────
    const allRows = useMemo<ProductRow[]>(
        () => tab === "memberships"
            ? rowsFromMemberships(memberships, customers, branches)
            : rowsFromPackages(packages, customers, branches),
        [tab, memberships, packages, customers, branches],
    );

    // ─── Apply branch + search + filter ─────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (branchId && r.branchIds.length > 0 && !r.branchIds.includes(branchId)) return false;
            if (q && !r.name.toLowerCase().includes(q)) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(r.status)) return false;
            if (applied.priceMin != null && r.priceAed < applied.priceMin) return false;
            if (applied.priceMax != null && r.priceAed > applied.priceMax) return false;
            if (applied.creditsMin != null || applied.creditsMax != null) {
                // Unlimited memberships are excluded the moment the credits
                // range is active — they can't satisfy a numeric bound.
                if (!Number.isFinite(r.creditsSortValue)) return false;
                if (applied.creditsMin != null && r.creditsSortValue < applied.creditsMin) return false;
                if (applied.creditsMax != null && r.creditsSortValue > applied.creditsMax) return false;
            }
            return true;
        });
    }, [allRows, branchId, search, applied]);

    // ─── Sort ───────────────────────────────────────────────────────────────
    const comparators: Record<string, (a: ProductRow, b: ProductRow) => number> = {
        name: (a, b) => a.name.localeCompare(b.name),
        price: (a, b) => a.priceAed - b.priceAed,
        credits: (a, b) => a.creditsSortValue - b.creditsSortValue,
        branches: (a, b) => a.branchesLabel.localeCompare(b.branchesLabel),
        duration: (a, b) => a.durationDays - b.durationDays,
        status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, comparators);

    // ─── Pagination slice ───────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection helpers ──────────────────────────────────────────────────
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }
    function toggleAllOnPage(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    // ─── Bulk selection derived flags ───────────────────────────────────────
    const selectedRows = useMemo(
        () => sorted.filter(r => selectedIds.has(r.id)),
        [sorted, selectedIds],
    );
    // The bar gates each action on whether the selection has at least one
    // candidate row — Archive needs ≥1 active/inactive, Recover needs ≥1
    // archived, Delete needs every selected row to be Active AND holder-free
    // (inactive/archived must be reactivated/recovered first).
    const hasArchivable = selectedRows.some(r => r.status !== "archived");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable = selectedRows.some(r => r.status === "archived");
    const hasDeletable = selectedRows.length > 0
        && selectedRows.every(r => r.status === "active" && !r.hasHolders);

    // ─── Active filter dot ──────────────────────────────────────────────────
    const hasActiveFilter =
        applied.statuses.length > 0 ||
        applied.priceMin != null || applied.priceMax != null ||
        applied.creditsMin != null || applied.creditsMax != null;

    // ─── Action plumbing ────────────────────────────────────────────────────
    function openRowConfirm(row: ProductRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openViewOrEdit(row: ProductRow, mode: "view" | "edit") {
        const rt = encodeURIComponent("/admin/products");
        router.push(mode === "edit" ? `/products/${row.id}/edit?returnTo=${rt}` : `/products/${row.id}?returnTo=${rt}`);
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive": return selectedRows.filter(r => r.status !== "archived");
                case "recover": return selectedRows.filter(r => r.status === "archived");
                case "delete": return selectedRows.filter(r => r.status === "active" && !r.hasHolders);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);
        const splitByKind = (xs: ProductRow[]) => ({
            memIds: xs.filter(x => x.kind === "membership").map(x => x.id),
            pkgIds: xs.filter(x => x.kind === "package").map(x => x.id),
        });

        // ─── Status mutations ──────────────────────────────────────────────
        if (kind === "deactivate" || kind === "reactivate" || kind === "archive" || kind === "recover") {
            const nextStatus: ProductStatus =
                kind === "deactivate" ? "inactive" :
                    kind === "reactivate" ? "active" :
                        kind === "archive" ? "archived" :
                /* recover */ "active";
            const { memIds, pkgIds } = splitByKind(rows);
            if (memIds.length > 0) setMembershipStatus(memIds, nextStatus);
            if (pkgIds.length > 0) setPackageStatus(pkgIds, nextStatus);

            // Toast tone mirrors the modal — archive is a positive operation
            // ("success"), deactivate stays "error".
            const titleSingle =
                kind === "deactivate" ? "Product deactivated" :
                    kind === "reactivate" ? "Product reactivated" :
                        kind === "archive" ? "Product archived" :
                            "Product recovered";
            const verbPast =
                kind === "deactivate" ? "deactivated" :
                    kind === "reactivate" ? "reactivated" :
                        kind === "archive" ? "archived" :
                            "recovered";
            const icon: "slash" | "archive" | "refresh" | "check" =
                kind === "deactivate" ? "slash" :
                    kind === "archive" ? "archive" :
                        kind === "reactivate" ? "check" :
                            "refresh";
            const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";

            if (rows.length === 1) {
                showToast(titleSingle, `${rows[0].name} has been ${verbPast}.`, tone, icon);
            } else {
                showToast(
                    `${rows.length} products ${verbPast}`,
                    `Your selected products have been ${verbPast} and the catalog updated.`,
                    tone, icon,
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // ─── Delete (still gated server-side as a belt-and-braces check) ──
        if (kind === "delete") {
            if (pending.mode === "row") {
                const ok = rows[0].kind === "membership" ? deleteMembership(ids[0]) : deletePackage(ids[0]);
                if (ok) {
                    showToast("Product deleted", `${rows[0].name} has been deleted.`, "success", "trash");
                } else {
                    // Shouldn't happen because the option is hidden — but log the
                    // edge case explicitly so it's debuggable if it ever does.
                    showToast(
                        "Cannot delete",
                        `${rows[0].name} is still held by one or more customers. Archive it instead.`,
                        "error", "slash",
                    );
                }
            } else {
                const { memIds, pkgIds } = splitByKind(rows);
                let deleted = 0;
                if (memIds.length > 0) deleted += deleteMemberships(memIds).deleted.length;
                if (pkgIds.length > 0) deleted += deletePackages(pkgIds).deleted.length;
                if (deleted > 0) {
                    showToast("Products deleted", `${deleted} product${deleted === 1 ? "" : "s"} deleted.`, "success", "trash");
                }
            }
            clearSelection();
            setPendingConfirm(null);
        }
    }

    // ─── Modal subject (single name vs. "N selected products") ─────────────
    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected products</>,
        };
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                {/* Pre-existing chrome here hardcodes always-plural for the
                    tab label (always "memberships" / "packages" regardless of
                    count). Pass both forms identical to preserve that exact
                    display behavior. */}
                <ToolbarTotal
                    count={filteredRows.length}
                    entitySingular={tab === "memberships" ? "memberships" : "packages"}
                    entityPlural={tab === "memberships" ? "memberships" : "packages"}
                />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...branchOptions]}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search products..." />
                <ToolbarExport
                    onExportCsv={() => {
                        exportProductsCsv(filteredRows);
                        showToast(
                            "Products exported",
                            `${filteredRows.length} product${filteredRows.length === 1 ? "" : "s"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push("/products/new")}>
                    Add new
                </Button>
            </div>

            {/* ── View card ── */}
            <div className="h-[760px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                {/* Tab nav row */}
                <div className="shrink-0 relative flex items-center px-6 py-4">
                    <SegmentedTabs
                        tabs={[
                            { key: "memberships", label: `Membership (${memberships.length})` },
                            { key: "packages",    label: `Credit package (${packages.length})` },
                        ]}
                        activeKey={tab}
                        onChange={(k) => setTab(k as TabId)}
                    />

                </div>

                {/* Table + bulk bar + pagination (px-6 shared wrapper per CLAUDE.md #5) */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {sorted.length === 0 ? (
                        <EmptyState
                            title={tab === "memberships" ? "No memberships found" : "No packages found"}
                            subtitle="Try adjusting your search or filters."
                        />
                    ) : (
                        <div className="px-6">
                            <ListView
                                rows={pagedRows}
                                sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                                selectedIds={selectedIds}
                                onToggleOne={toggleOne}
                                onToggleAll={toggleAllOnPage}
                                onRowAction={openRowConfirm}
                                onViewOrEdit={openViewOrEdit}
                            />
                        </div>
                    )}

                    {/* Floating bulk action pill — same pattern as schedule
                        class-detail. Positioned absolutely inside the
                        scrollable area so it lifts above the pagination
                        row when the selection is non-empty. */}
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

                <div className="px-6 shrink-0">
                    <Pagination
                        page={clampedPage} total={sorted.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
                const tone = DESTRUCTIVE_ACTIONS.has(pendingConfirm.kind) ? "danger" : "success";
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone={tone}
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
