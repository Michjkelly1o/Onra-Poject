"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax module (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Whole page          — 5006-73920
//   • Tax rates list card — 5006-73991
//   • Add new modal       — 5006-106235 (Phase 2)
//   • Apply tax rates tab — 5041-99787  (Phase 3)
//   • Delete tax rule     — 5041-105464 (Phase 3)
//
// Phase 1 scope (Brief-for-tax-module §1):
//   ✓ "Prices include tax" container (toggle + exclusive vs inclusive demo
//      table) — Figma 5006-73920.
//   ✓ Tab switcher: "Tax rates list" (wired) | "Apply tax rates" (placeholder).
//   ✓ Tax rates list — toolbar (Total · Export · Filter · Add new),
//      table (checkbox / name+avatar / rate / status / ⋮), pagination,
//      bulk-action bar, empty state.
//   ✓ Row + bulk actions: Archive / Deactivate ↔ Delete / Reactivate /
//      Recover — same Active gating as customers / gift cards.
//   ✓ Status filter dropdown (FixedDropdown) — same shape as gift cards.
//   ✓ Export CSV — uses the same dropdown trigger as customers.
//   ✓ Toasts on every action.
//   ⏳ Add new + Edit row action → "Coming in Phase 2" placeholder toast.
//
// Reused patterns (no re-invention):
//   • Status filter dropdown        — gift-cards page
//   • Export CSV dropdown           — customers page
//   • Toggle                        — referral settings page
//   • RowActions FixedDropdown      — customers / gift-cards
//   • ActionModal                   — customers
//   • BulkActionBar                 — products
//   • Pagination + CheckboxCell     — products

import { useEffect, useMemo, useRef, useState } from "react";
import {
    FilterLines, Plus, DotsVertical, ChevronLeft, Edit02, Trash01, Trash02,
    Archive, Download01, XClose, RefreshCcw01, SlashCircle01, Check, Percent03,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { TaxRateModal } from "@/components/settings/TaxRateModal";
import { ApplyTaxRatesView } from "@/components/settings/ApplyTaxRatesView";
import { useAppStore, type TaxRate, type TaxRateStatus } from "@/lib/store";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";

// ─── Types & constants ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<TaxRateStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
};

const STATUS_ORDER: Record<TaxRateStatus, number> = {
    active: 0, inactive: 1, archived: 2,
};

type StatusFilter = TaxRateStatus | null;
type TabId = "list" | "apply";

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatPct(r: number): string {
    return `${r}%`;
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TaxRateStatus }) {
    const styles: Record<TaxRateStatus, string> = {
        active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
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

// ─── Percent avatar (Figma 5006:74021 — `percent-03` in 40px gray circle) ────

function PercentAvatar() {
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <Percent03 className="w-5 h-5 text-[#475467]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Toggle (mirrors referral settings) ──────────────────────────────────────

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Row actions (⋮) — mirrors customers / gift cards ────────────────────────
//
// Same archive/delete convention as every other module in the app:
//   "Deactivate ↔ Delete — Active rows only. Inactive/archived rows must be
//    Reactivated/Recovered before they can be deleted."
//   (verbatim from /admin/products/gift-cards · /admin/customers)
//
// State matrix:
//   • Active   + has usage → Edit · Archive · Deactivate (red)
//   • Active   + no usage  → Edit · Archive · Delete (red)
//   • Inactive             → Reactivate · Archive   (no Delete)
//   • Archived             → Recover                (no Delete)

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

function RowActions({ status, hasUsage, onEdit, onAction }: {
    status: TaxRateStatus;
    /** True when ≥1 `tax_rule` references this rate. Phase 3 wires this. */
    hasUsage: boolean;
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
                {/* Edit — Active only (cannot edit archived/inactive per brief). */}
                {status === "active" && (
                    <button type="button" onClick={() => trigger(onEdit)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit
                    </button>
                )}

                {/* Archive — active + inactive. */}
                {status !== "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("archive"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Archive className="w-4 h-4 text-[#667085]" />Archive
                    </button>
                )}

                {/* Reactivate — inactive only. */}
                {status === "inactive" && (
                    <button type="button" onClick={() => trigger(() => onAction("reactivate"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#667085]" />Reactivate
                    </button>
                )}

                {/* Recover — archived only. NO Delete here — user must Recover
                    first, then Delete from the active state (matches every
                    other module's convention). */}
                {status === "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("recover"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <RefreshCcw01 className="w-4 h-4 text-[#667085]" />Recover
                    </button>
                )}

                {/* Deactivate ↔ Delete — Active rows only. Inactive rows must
                    be Reactivated first; archived rows must be Recovered first.
                    Active + usage → Deactivate; Active + no usage → Delete. */}
                {status === "active" && (
                    hasUsage ? (
                        <button type="button" onClick={() => trigger(() => onAction("deactivate"))}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <SlashCircle01 className="w-4 h-4 text-[#b42318]" />Deactivate
                        </button>
                    ) : (
                        <button type="button" onClick={() => trigger(() => onAction("delete"))}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <Trash01 className="w-4 h-4 text-[#b42318]" />Delete
                        </button>
                    )
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Action modal (tone matrix mirrors customers / products) ─────────────────

const DESTRUCTIVE_ACTIONS = new Set<RowActionKind>(["deactivate", "delete"]);

const MODAL_CONFIG: Record<RowActionKind, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this tax rate?",
        titleBulk: n => `Archive ${n} tax rates?`,
        description: subject => <>{subject} will be hidden from the default list. All history is preserved — you can recover archived tax rates at any time.</>,
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this tax rate?",
        titleBulk: n => `Deactivate ${n} tax rates?`,
        description: subject => <>{subject} will stop applying to future sales. Existing tax rules referencing this rate stay in place but won't charge.</>,
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this tax rate?",
        titleBulk: n => `Recover ${n} tax rates?`,
        description: subject => <>{subject} will be restored to Active status and shown in the tax rate list again.</>,
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this tax rate?",
        titleBulk: n => `Reactivate ${n} tax rates?`,
        description: subject => <>{subject} will be reactivated and applied to future sales again.</>,
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this tax rate?",
        titleBulk: n => `Delete ${n} tax rates?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
    },
};

function ActionModal({ action, count, subject, onConfirm, onCancel }: {
    action: RowActionKind;
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

// ─── Status filter dropdown (single-select — same as gift cards) ─────────────

function StatusFilterDropdown({ value, onChange }: {
    value: StatusFilter; onChange: (next: StatusFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const OPTIONS: { value: TaxRateStatus; label: string }[] = [
        { value: "active",   label: "Active"   },
        { value: "inactive", label: "Inactive" },
        { value: "archived", label: "Archive"  },
    ];

    return (
        <div ref={ref} className="relative">
            <Button variant="secondary-gray" size="md"
                leftIcon={
                    <div className="relative">
                        <FilterLines className="w-4 h-4" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                        )}
                    </div>
                }
                onClick={() => setOpen(p => !p)}>
                Filter
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2 min-w-[160px]">
                    {OPTIONS.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => {
                                // Click the same option twice → clear the filter
                                onChange(value === opt.value ? null : opt.value);
                                setOpen(false);
                            }}
                            className={cn(
                                "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                value === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                            {value === opt.value && <Check className="w-4 h-4 text-[#658774]" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Export dropdown (mirrors customers) ─────────────────────────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ disabled, onExportCsv }: { disabled: boolean; onExportCsv: () => void }) {
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
                disabled={disabled}
                onClick={() => setOpen(p => !p)}>
                Export
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    {EXPORT_FORMATS.map(fmt => (
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Floating bulk action bar (mirrors products) ─────────────────────────────

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
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 inline-flex items-center gap-3">
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

// ─── Pagination + Checkbox cell (lifted verbatim from products) ──────────────

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
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? (
                <span className="block w-2 h-[1.5px] bg-white" />
            ) : checked ? (
                <Check className="w-3 h-3" />
            ) : null}
        </button>
    );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportTaxRatesCsv(rows: TaxRate[]) {
    const headers = ["Tax name", "Tax rate (%)", "Calculation mode", "Status", "Description", "Created"];
    const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [headers.join(",")];
    for (const r of rows) {
        lines.push([
            r.name,
            String(r.ratePercentage),
            r.calculationMode,
            r.status,
            r.description ?? "",
            r.createdAt.slice(0, 10),
        ].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tax-rates-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: TaxRate; kind: RowActionKind }
    | { mode: "bulk"; rows: TaxRate[]; kind: RowActionKind };

export default function TaxPage() {
    // ─── Store subscriptions ────────────────────────────────────────────────
    const taxRates           = useAppStore(s => s.taxRates);
    const taxRules           = useAppStore(s => s.taxRules);
    const taxSettings        = useAppStore(s => s.taxSettings);
    const setPricesIncludeTax = useAppStore(s => s.setPricesIncludeTax);
    const setTaxRatesStatus  = useAppStore(s => s.setTaxRatesStatus);
    const deleteTaxRates     = useAppStore(s => s.deleteTaxRates);
    const showToast          = useAppStore(s => s.showToast);

    // ─── Local UI state ─────────────────────────────────────────────────────
    const [tab, setTab] = useState<TabId>("list");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
    // Confirm-before-flip for the global "Prices include tax" toggle —
    // matches the Branches / Rooms / Staff convention.
    const [pendingPricesToggle, setPendingPricesToggle] = useState<{ next: boolean } | null>(null);
    /** Modal state — `null` closed, `{ mode: "create" }` for Add new,
     *  `{ mode: "edit", existing }` for the Edit row action. */
    const [taxModal, setTaxModal] = useState<
        | { mode: "create" }
        | { mode: "edit"; existing: TaxRate }
        | null
    >(null);

    useEffect(() => { setPage(1); }, [statusFilter, tab]);

    // ─── Apply filter + sort ────────────────────────────────────────────────
    //
    // `hasUsage` derives from the live `tax_rules` table — a rate is "in use"
    // when at least one tax rule references it. Phase 3 wired this so the
    // Deactivate↔Delete swap and the Delete-blocked logic on archived rates
    // light up correctly.
    const usageByRate = useMemo(() => {
        const m = new Set<string>();
        for (const r of taxRules) {
            if (r.taxRateId) m.add(r.taxRateId);
        }
        return m;
    }, [taxRules]);
    const hasUsage = (id: string) => usageByRate.has(id);

    const filtered = useMemo(() => {
        return taxRates
            .filter(r => statusFilter === null ? true : r.status === statusFilter)
            .sort((a, b) => {
                const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                if (s !== 0) return s;
                return a.name.localeCompare(b.name);
            });
    }, [taxRates, statusFilter]);

    // ── Tax rate sort — Name / Rate (numeric) / Status. ──
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<TaxRate>(filtered, {
        name:   (a, b) => a.name.localeCompare(b.name),
        rate:   (a, b) => a.ratePercentage - b.ratePercentage,
        status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection helpers ──────────────────────────────────────────────────
    const allChecked = pagedRows.length > 0 && pagedRows.every(r => selectedIds.has(r.id));
    const someChecked = !allChecked && pagedRows.some(r => selectedIds.has(r.id));
    function toggleOne(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id); else next.add(id);
        setSelectedIds(next);
    }
    function toggleAllOnPage(check: boolean) {
        const next = new Set(selectedIds);
        if (check) pagedRows.forEach(r => next.add(r.id));
        else pagedRows.forEach(r => next.delete(r.id));
        setSelectedIds(next);
    }
    function clearSelection() { setSelectedIds(new Set()); }

    // ─── Bulk-flag derivation ───────────────────────────────────────────────
    const selectedRows = useMemo(
        () => taxRates.filter(r => selectedIds.has(r.id)),
        [taxRates, selectedIds],
    );
    const hasArchivable     = selectedRows.some(r => r.status !== "archived");
    const hasReactivatable  = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable    = selectedRows.some(r => r.status === "archived");
    const allActiveNoUsage  = selectedRows.length > 0 && selectedRows.every(r => r.status === "active" && !hasUsage(r.id));

    function openRowConfirm(row: TaxRate, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive":    return selectedRows.filter(r => r.status !== "archived");
                case "recover":    return selectedRows.filter(r => r.status === "archived");
                // Delete only ever applies to active + no-usage rows. The
                // BulkActionBar already gates the button on `allActiveNoUsage`,
                // but we re-filter here as a safety belt so any future
                // mixed-selection edge cases can't accidentally delete an
                // archived row.
                case "delete":     return selectedRows.filter(r => r.status === "active" && !hasUsage(r.id));
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);
        const single = rows.length === 1;

        if (pending.kind === "delete") {
            const { deleted } = deleteTaxRates(ids);
            if (deleted.length > 0) {
                if (single) {
                    showToast("Tax rate deleted", `${rows[0].name} has been permanently removed.`, "success", "trash");
                } else {
                    showToast(
                        `${deleted.length} tax rates deleted`,
                        "The selected tax rates have been permanently removed.",
                        "success", "trash",
                    );
                }
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // Status mutations
        const nextStatus: TaxRateStatus =
            pending.kind === "deactivate" ? "inactive" :
            pending.kind === "reactivate" ? "active"   :
            pending.kind === "archive"    ? "archived" :
            /* recover */ "active";
        setTaxRatesStatus(ids, nextStatus);

        const verbPast =
            pending.kind === "deactivate" ? "deactivated" :
            pending.kind === "reactivate" ? "reactivated" :
            pending.kind === "archive"    ? "archived"    :
            "recovered";
        const icon: "slash" | "check" | "archive" | "refresh" =
            pending.kind === "deactivate" ? "slash" :
            pending.kind === "reactivate" ? "check" :
            pending.kind === "archive"    ? "archive" :
            "refresh";
        const tone: "success" | "error" = pending.kind === "deactivate" ? "error" : "success";

        if (single) {
            showToast(`Tax rate ${verbPast}`, `${rows[0].name} has been ${verbPast}.`, tone, icon);
        } else {
            showToast(`${rows.length} tax rates ${verbPast}`, `Your selected tax rates have been ${verbPast}.`, tone, icon);
        }
        clearSelection();
        setPendingConfirm(null);
    }

    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected tax rates</>,
        };
    }

    // ─── Toggle handler (global "Prices include tax") ──────────────────────
    function handlePricesIncludeTax(next: boolean) {
        setPendingPricesToggle({ next });
    }

    function handleConfirmPricesIncludeTax() {
        if (!pendingPricesToggle) return;
        const { next } = pendingPricesToggle;
        setPricesIncludeTax(next);
        showToast(
            next ? "Prices now include tax" : "Prices now exclude tax",
            next
                ? "Tax is already baked into displayed prices — no extra line at checkout."
                : "Tax will be added on top at checkout. Displayed prices are pre-tax.",
            "success", "check",
        );
        setPendingPricesToggle(null);
    }

    function handleAddNew() {
        setTaxModal({ mode: "create" });
    }
    function handleEdit(row: TaxRate) {
        setTaxModal({ mode: "edit", existing: row });
    }
    /** Modal submit callback — emits the matching toast for create vs edit
     *  then closes the modal. */
    function handleTaxModalSubmitted(saved: TaxRate, mode: "create" | "edit") {
        setTaxModal(null);
        if (mode === "create") {
            // Figma 5006-107638 copy.
            showToast(
                "New tax rate was added",
                "The new tax rate is all set and can be apply to products or services.",
                "success", "check",
            );
        } else {
            showToast(
                "Tax rate updated",
                `${saved.name} now applies at ${saved.ratePercentage}%.`,
                "success", "check",
            );
        }
    }
    function handleExportCsv() {
        if (filtered.length === 0) return;
        exportTaxRatesCsv(filtered);
        showToast(
            "Tax rates exported",
            `${filtered.length} tax rate${filtered.length === 1 ? "" : "s"} exported to CSV.`,
            "success", "check",
        );
    }

    const isTrulyEmpty = taxRates.length === 0;
    const hasActiveFilter = statusFilter !== null;

    return (
        <div className="flex flex-col gap-6">
            {/* ── "Prices include tax" container (Figma 5006-73920) ─────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col gap-6 p-6">
                {/* Toggle row */}
                <div className="flex items-center gap-4">
                    <Toggle
                        on={taxSettings.pricesIncludeTax}
                        onChange={handlePricesIncludeTax}
                        ariaLabel="Prices include tax"
                    />
                    <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">
                            Prices include tax
                        </p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            Tax rates can be exclusive or inclusive. This affects how prices are displayed to customer and calculated in invoices.
                        </p>
                    </div>
                </div>

                {/* Exclusive vs Inclusive demo table */}
                <div className="flex flex-col gap-2">
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        The following table illustrates exclusive &amp; inclusive tax
                    </p>
                    <div className="border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-[#e4e7ec]">
                                    <th className="px-6 py-3 text-left text-[12px] font-medium text-[#475467]">Tax type</th>
                                    <th className="px-6 py-3 text-left text-[12px] font-medium text-[#475467]">Item subtotal</th>
                                    <th className="px-6 py-3 text-left text-[12px] font-medium text-[#475467]">Tax due</th>
                                    <th className="px-6 py-3 text-left text-[12px] font-medium text-[#475467]">Item total</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b border-[#e4e7ec]">
                                    <td className="px-6 py-4 text-[14px] font-medium text-[#101828]">10% Exclusive</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 500</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 50</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 550 (AED 500 + AED 50)</td>
                                </tr>
                                <tr>
                                    <td className="px-6 py-4 text-[14px] font-medium text-[#101828]">10% Inclusive</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 500</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 50 (already included in total)</td>
                                    <td className="px-6 py-4 text-[14px] text-[#667085]">AED 500 (AED 450 + AED 50)</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Tab strip ─────────────────────────────────────────────────── */}
            <div className="border-b border-[#e4e7ec]">
                <div className="flex gap-3 items-end">
                    <button type="button" onClick={() => setTab("list")}
                        className={cn(
                            "h-[32px] flex items-center gap-2 pb-3 px-1 transition-colors whitespace-nowrap text-[14px] font-semibold",
                            tab === "list"
                                ? "border-b-2 border-[#101828] text-[#101828]"
                                : "text-[#667085] hover:text-[#344054]",
                        )}>
                        Tax rates list
                    </button>
                    <button type="button" onClick={() => setTab("apply")}
                        className={cn(
                            "h-[32px] flex items-center gap-2 pb-3 px-1 transition-colors whitespace-nowrap text-[14px] font-semibold",
                            tab === "apply"
                                ? "border-b-2 border-[#101828] text-[#101828]"
                                : "text-[#667085] hover:text-[#344054]",
                        )}>
                        Apply tax rates
                    </button>
                </div>
            </div>

            {/* ── Tab content ───────────────────────────────────────────────── */}
            {tab === "list" ? (
                // Tax rates list — h-[760px] view card, same as products module
                <div className="h-[760px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                    {/* Toolbar */}
                    <div className="shrink-0 flex items-center gap-3 px-6 py-5">
                        <div className="flex-1">
                            <p className="text-[14px] text-[#667085]">Total</p>
                            <p className="text-[14px] font-medium text-[#101828]">
                                {filtered.length} tax rate{filtered.length === 1 ? "" : "s"}
                            </p>
                        </div>
                        <ExportDropdown disabled={filtered.length === 0} onExportCsv={handleExportCsv} />
                        <StatusFilterDropdown value={statusFilter} onChange={setStatusFilter} />
                        <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAddNew}>
                            Add new
                        </Button>
                    </div>

                    {/* Table + pagination (px-6 shared wrapper per CLAUDE.md #5) */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                        {pagedRows.length === 0 ? (
                            <EmptyState
                                title={isTrulyEmpty ? "No tax rates yet" : "No tax rates found"}
                                subtitle={isTrulyEmpty
                                    ? "Add your first tax rate to apply tax to memberships, packages, gift cards, or pay rates."
                                    : hasActiveFilter
                                        ? "Try clearing the filter to see all tax rates."
                                        : "Try adjusting your search or filter."}
                            />
                        ) : (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={cn(TH, "w-[44px]")}>
                                                <CheckboxCell
                                                    checked={allChecked}
                                                    indeterminate={someChecked}
                                                    onChange={toggleAllOnPage}
                                                    ariaLabel="Select all rows on this page"
                                                />
                                            </th>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Tax name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[160px]")}>
                                                <SortableHeader sortKey="rate"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Tax rate</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[140px]")}>
                                                <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")} />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedRows.map(r => {
                                            const isSelected = selectedIds.has(r.id);
                                            return (
                                                <tr key={r.id}
                                                    className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                    <td className={TD}>
                                                        <CheckboxCell
                                                            checked={isSelected}
                                                            onChange={() => toggleOne(r.id)}
                                                            ariaLabel={`Select ${r.name}`}
                                                        />
                                                    </td>
                                                    <td className={TD}>
                                                        <div className="flex items-center gap-3">
                                                            <PercentAvatar />
                                                            <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className={cn(TD, "text-[#475467]")}>{formatPct(r.ratePercentage)}</td>
                                                    <td className={TD}><StatusBadge status={r.status} /></td>
                                                    <td className={TD}>
                                                        <RowActions
                                                            status={r.status}
                                                            hasUsage={hasUsage(r.id)}
                                                            onEdit={() => handleEdit(r)}
                                                            onAction={k => openRowConfirm(r, k)}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <BulkActionBar
                            count={selectedIds.size}
                            hasArchivable={hasArchivable}
                            hasReactivatable={hasReactivatable}
                            hasRecoverable={hasRecoverable}
                            hasDeletable={allActiveNoUsage}
                            onClear={clearSelection}
                            onAction={openBulkConfirm}
                        />
                    </div>

                    <div className="px-6 shrink-0">
                        <Pagination
                            page={clampedPage} total={sortedRows.length} pageSize={pageSize}
                            onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                        />
                    </div>
                </div>
            ) : (
                // Apply tax rates — full Phase 3 view. Clicking "+ Add new
                // tax rate" inside any rate dropdown opens the same create
                // modal as the "Add new" button on the Tax rates list tab.
                <ApplyTaxRatesView onCreateRate={() => setTaxModal({ mode: "create" })} />
            )}

            {/* Action modal */}
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

            {/* Add / Edit tax rate modal — shared form, Figma 5006-106235 */}
            {taxModal && (
                <TaxRateModal
                    mode={taxModal.mode}
                    existing={taxModal.mode === "edit" ? taxModal.existing : undefined}
                    onClose={() => setTaxModal(null)}
                    onSubmitted={saved => handleTaxModalSubmitted(saved, taxModal.mode)}
                />
            )}

            {/* "Prices include tax" confirm modal — stages the flip behind a
                Cancel / Confirm gate, matches the Branches / Rooms convention. */}
            {pendingPricesToggle && (
                <PricesIncludeTaxConfirmModal
                    next={pendingPricesToggle.next}
                    onCancel={() => setPendingPricesToggle(null)}
                    onConfirm={handleConfirmPricesIncludeTax}
                />
            )}

            <Toast />
        </div>
    );
}

// ─── Prices-include-tax confirm modal ───────────────────────────────────────
//
// Mirrors the shape of ToggleConfirmModal in /admin/settings/page.tsx —
// destructive for disable, primary for enable.
function PricesIncludeTaxConfirmModal({ next, onCancel, onConfirm }: {
    next: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onCancel();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const isEnable = next;
    const title = isEnable
        ? "Enable tax-inclusive pricing?"
        : "Disable tax-inclusive pricing?";
    const supporting = isEnable
        ? "Catalog prices will be treated as tax-inclusive across POS and customer checkout."
        : "Catalog prices will be treated as pre-tax — POS will add the applicable tax at checkout.";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[400px] flex flex-col">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        isEnable ? "bg-[#e9fff3]" : "bg-[#fee4e2]",
                    )}>
                        {isEnable
                            ? <Check className="w-6 h-6 text-[#658774]" />
                            : <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                        }
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">{title}</p>
                        <p className="text-[14px] text-[#475467] leading-5 w-full">{supporting}</p>
                    </div>
                </div>
                <div className="flex gap-3 items-start p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant={isEnable ? "primary" : "destructive"}
                        size="lg"
                        className="flex-1"
                        onClick={onConfirm}
                    >
                        {isEnable ? "Enable" : "Disable"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
