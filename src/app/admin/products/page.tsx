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
// status flips and deletes propagate to the POS catalog + class-types
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
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { RangeSlider } from "@/components/ui/RangeSlider";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Toast } from "@/components/ui/Toast";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore, BRANCHES, DEFAULT_BRANCH_ID,
    type Membership, type Package, type Customer,
} from "@/lib/store";

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

function branchNamesFor(ids: string[]): string {
    if (ids.length === 0) return "All branches";
    const names = ids
        .map(id => BRANCHES.find(b => b.id === id)?.name ?? id)
        // strip the "Forma Studio " prefix so the cell stays compact
        .map(n => n.replace(/^Forma Studio /, ""));
    if (names.length <= 2) return names.join(", ");
    return `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ProductStatus }) {
    // Match the /admin/class-types badge palette — Inactive + Archived share
    // the same neutral gray treatment.
    const styles: Record<ProductStatus, string> = {
        active: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        archived: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {STATUS_LABEL[status]}
        </span>
    );
}

// ─── Product avatar (Figma 2526:58876 + 2533:52175) ─────────────────────────

function ProductAvatar({ kind }: { kind: "membership" | "package" }) {
    const Icon = kind === "membership" ? CreditCard02 : PackageIcon;
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#475467]" />
            {/* 0.75px contrast border per Figma spec */}
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Filter pill (multi-select status) ───────────────────────────────────────

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-3 py-[7px] rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

// ─── Row actions (⋮) — Delete only when no holders, swaps with Deactivate ──

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

function RowActions({ status, hasHolders, onView, onEdit, onAction }: {
    status: ProductStatus;
    /** True when at least one customer currently holds this product. When
     *  true the row hides Delete and shows Deactivate (red); when false the
     *  Delete option is unlocked (still red). */
    hasHolders: boolean;
    onView: () => void;
    onEdit: () => void;
    onAction: (kind: RowActionKind) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    function trigger(fn: () => void) { setOpen(false); fn(); }

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                <button type="button" onClick={() => trigger(onView)}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View details
                </button>
                {/* Edit available only for Active rows — archived/inactive
                    products are read-only per Module 06 rules. */}
                {status === "active" && (
                    <button type="button" onClick={() => trigger(onEdit)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit
                    </button>
                )}

                {/* Archive — available for active + inactive (success modal). */}
                {(status === "active" || status === "inactive") && (
                    <button type="button" onClick={() => trigger(() => onAction("archive"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Archive className="w-4 h-4 text-[#667085]" />Archive
                    </button>
                )}

                {/* Reactivate — for inactive only (success). */}
                {status === "inactive" && (
                    <button type="button" onClick={() => trigger(() => onAction("reactivate"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#667085]" />Reactivate
                    </button>
                )}

                {/* Recover — for archived only (success). */}
                {status === "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("recover"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <RefreshCcw01 className="w-4 h-4 text-[#667085]" />Recover
                    </button>
                )}

                {/* Deactivate ↔ Delete swap (both red). Active rows:
                    - has holders → Deactivate
                    - no holders  → Delete
                    Inactive/archived rows: only Delete (when no holders). */}
                {(() => {
                    if (status === "active") {
                        return hasHolders ? (
                            <button type="button" onClick={() => trigger(() => onAction("deactivate"))}
                                className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                                <SlashCircle01 className="w-4 h-4 text-[#b42318]" />Deactivate
                            </button>
                        ) : (
                            <button type="button" onClick={() => trigger(() => onAction("delete"))}
                                className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                                <Trash01 className="w-4 h-4 text-[#b42318]" />Delete
                            </button>
                        );
                    }
                    // Non-active rows: surface Delete only when there are no holders.
                    if (!hasHolders) {
                        return (
                            <button type="button" onClick={() => trigger(() => onAction("delete"))}
                                className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                                <Trash01 className="w-4 h-4 text-[#b42318]" />Delete
                            </button>
                        );
                    }
                    return null;
                })()}
            </FixedDropdown>
        </div>
    );
}

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
        description: subject => <>{subject} will be hidden from the POS catalog and the class-types Applicable Plans list. You can recover archived products at any time.</>,
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this product?",
        titleBulk: n => `Deactivate ${n} products?`,
        description: (subject, n) => <>{subject} will be hidden from new POS sales. Customers who already hold {n === 1 ? "it" : "them"} keep their access.</>,
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
        description: subject => <>{subject} will become available again in the POS catalog.</>,
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

function ActionModal({ action, count, subject, onConfirm, onCancel }: {
    action: ModalAction;
    count: number;
    subject: React.ReactNode;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const cfg = MODAL_CONFIG[action];
    const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
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
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description(subject, count)}</p>
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

    if (!open) return null;

    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny =
        pending.statuses.length > 0 ||
        pending.creditsMin != null || pending.creditsMax != null ||
        pending.priceMin != null || pending.priceMax != null;

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

                    <div className="h-px bg-[#e4e7ec]" />

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

                    <div className="h-px bg-[#e4e7ec]" />

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
            </div>
        </div>
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

// ─── Export dropdown ─────────────────────────────────────────────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown() {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={<Download01 className="w-4 h-4" />}
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[140px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button" onClick={() => setOpen(false)}
                            className="w-full text-left px-5 py-3 text-[15px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
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
        <div className="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none pb-[96px] pt-6 px-6 z-30">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 inline-flex items-center gap-3">
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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

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

function rowsFromMemberships(items: Membership[], customers: Customer[]): ProductRow[] {
    return items.map(m => ({
        id: m.id,
        kind: "membership" as const,
        name: m.name,
        priceAed: m.price_aed,
        creditsLabel: formatCredits(m.credits),
        creditsSortValue: m.credits === "unlimited" ? Number.POSITIVE_INFINITY : m.credits,
        branchIds: m.branch_ids,
        branchesLabel: branchNamesFor(m.branch_ids),
        durationLabel: formatDuration(m.duration_months),
        durationDays: m.duration_months * 30,
        status: m.status,
        hasHolders: customers.some(c => c.planKind === "membership" && c.membershipId === m.id),
    }));
}

function rowsFromPackages(items: Package[], customers: Customer[]): ProductRow[] {
    return items.map(p => ({
        id: p.id,
        kind: "package" as const,
        name: p.name,
        priceAed: p.price_aed,
        creditsLabel: formatCredits(p.credits),
        creditsSortValue: p.credits,
        branchIds: p.branch_ids,
        branchesLabel: branchNamesFor(p.branch_ids),
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
                            <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
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
                                className={cn(
                                    "transition-colors",
                                    isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                                )}>
                                <td className={TD}>
                                    <CheckboxCell
                                        checked={isSelected}
                                        onChange={() => onToggleOne(r.id)}
                                        ariaLabel={`Select ${r.name}`}
                                    />
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <ProductAvatar kind={r.kind} />
                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(TD, "font-medium text-[#101828] whitespace-nowrap")}>{formatAed(r.priceAed)}</td>
                                <td className={cn(TD, "whitespace-nowrap text-center")}>{r.creditsLabel}</td>
                                <td className={TD}>{r.branchesLabel}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.durationLabel}</td>
                                <td className={TD}><StatusBadge status={r.status} /></td>
                                <td className={TD}>
                                    <RowActions
                                        status={r.status}
                                        hasHolders={r.hasHolders}
                                        onView={() => onViewOrEdit(r, "view")}
                                        onEdit={() => onViewOrEdit(r, "edit")}
                                        onAction={k => onRowAction(r, k)}
                                    />
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
    const setMembershipStatus = useAppStore(s => s.setMembershipStatus);
    const setPackageStatus = useAppStore(s => s.setPackageStatus);
    const deleteMembership = useAppStore(s => s.deleteMembership);
    const deleteMemberships = useAppStore(s => s.deleteMemberships);
    const deletePackage = useAppStore(s => s.deletePackage);
    const deletePackages = useAppStore(s => s.deletePackages);
    const showToast = useAppStore(s => s.showToast);

    // ─── Local UI state ─────────────────────────────────────────────────────
    const [tab, setTab] = useState<TabId>("memberships");
    const [branchId, setBranchId] = useState<string>(DEFAULT_BRANCH_ID);
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

    // Branch dropdown — single source: BRANCHES seed
    const branchOptions = useMemo(
        () => BRANCHES.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [],
    );

    // ─── Build rows for the current tab (holder flag derived live) ──────────
    const allRows = useMemo<ProductRow[]>(
        () => tab === "memberships"
            ? rowsFromMemberships(memberships, customers)
            : rowsFromPackages(packages, customers),
        [tab, memberships, packages, customers],
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
    // archived, Delete needs ≥1 holder-free row.
    const hasArchivable = selectedRows.some(r => r.status !== "archived");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable = selectedRows.some(r => r.status === "archived");
    const hasDeletable = selectedRows.length > 0 && selectedRows.every(r => !r.hasHolders);

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
        router.push(mode === "edit" ? `/products/${row.id}/edit` : `/products/${row.id}`);
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive": return selectedRows.filter(r => r.status !== "archived");
                case "recover": return selectedRows.filter(r => r.status === "archived");
                case "delete": return selectedRows.filter(r => !r.hasHolders);
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
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {filteredRows.length} {tab === "memberships" ? "memberships" : "packages"}
                    </p>
                </div>
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select studio"
                    options={branchOptions}
                    value={branchId}
                    onChange={setBranchId}
                    width="w-[220px]"
                />
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search products..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <ExportDropdown />
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push("/products/new")}>
                    Add new
                </Button>
            </div>

            {/* ── View card ── */}
            <div className="h-[760px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                {/* Tab nav row */}
                <div className="shrink-0 relative flex items-center px-6 py-4">
                    <div className="flex items-center bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1">
                        {[
                            { id: "memberships" as TabId, label: "Membership", count: memberships.length },
                            { id: "packages" as TabId, label: "Credit package", count: packages.length },
                        ].map(t => (
                            <button key={t.id} type="button" onClick={() => setTab(t.id)}
                                className={cn("px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all",
                                    tab === t.id
                                        ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                        : "text-[#667085] hover:text-[#344054]")}>
                                {t.label} ({t.count})
                            </button>
                        ))}
                    </div>

                    <div className="ml-auto">
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasActiveFilter && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}>
                            Filter
                        </Button>
                    </div>
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

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); }}
            />

            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                return (
                    <ActionModal
                        action={pendingConfirm.kind}
                        count={count}
                        subject={subject}
                        onConfirm={() => performAction(pendingConfirm)}
                        onCancel={() => setPendingConfirm(null)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}
