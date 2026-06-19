"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Gift Cards list view (/admin/products/gift-cards)
// ─────────────────────────────────────────────────────────────────────────────
//
// Same chrome as the Memberships & Packages list (toolbar + 760px view card +
// bulk-select table + pagination + row-action ⋮) — with kind-specific
// differences:
//   • Single product type (no tabs)
//   • No branch picker in the toolbar (gift cards aren't branch-scoped yet)
//   • Filter is a SIMPLE single-select dropdown (Active / Inactive / Archive)
//     vs the side-panel multi-select used elsewhere
//   • Avatar in the Name column is a `Gift01` icon inside a 40px `#f2f4f7`
//     circle, matching the Figma 3726:21787 reference
//
// State source of truth: useAppStore(s => s.giftCardDesigns). Edits, status
// flips and deletes propagate to the POS catalog instantly via the live
// store join.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    SearchMd, FilterLines, Plus, DotsVertical,
    ChevronLeft, Eye, Edit02, Trash01, Trash02, Archive,
    Download01, XClose, RefreshCcw01, SlashCircle01, Check,
    Gift01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { buildCsv, downloadCsv, todayISO } from "@/lib/csv-export";
import { Button } from "@/components/ui/button";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore,
    type GiftCardDesign,
} from "@/lib/store";
import { giftCardHolderCount } from "@/lib/giftCardHolders";
import type { IssuedGiftCard } from "@/lib/store";

// ─── Types & constants ───────────────────────────────────────────────────────

type GiftCardStatus = GiftCardDesign["status"]; // "active" | "inactive" | "archived"

const STATUS_LABEL: Record<GiftCardStatus, string> = {
    active: "Active",
    inactive: "Inactive",
    archived: "Archive",
};

const STATUS_ORDER: Record<GiftCardStatus, number> = {
    active: 0, inactive: 1, archived: 2,
};

// Filter state is just a single nullable status. `null` = "show all" — the
// brief explicitly says this filter is simpler than the side-panel filter
// used elsewhere.
type StatusFilter = GiftCardStatus | null;

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

/** Display the card's price — fixed cards show the exact amount, custom
 *  cards show the min/max range. */
function priceLabel(g: GiftCardDesign): string {
    if (g.value_type === "fixed") {
        return formatAed(g.fixed_value_aed ?? 0);
    }
    return `AED ${g.min_value_aed ?? 0}–${g.max_value_aed ?? 0}`;
}

/** Numeric price used for sorting — fixed cards use their face value;
 *  custom cards sort by their minimum. */
function priceForSort(g: GiftCardDesign): number {
    if (g.value_type === "fixed") return g.fixed_value_aed ?? 0;
    return g.min_value_aed ?? 0;
}

/** "Valid until" cell — honours the `no_expiry` flag. */
function validUntilLabel(g: GiftCardDesign): string {
    if (g.no_expiry) return "No expiry";
    return g.valid_until_date ?? "—";
}

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: GiftCardStatus }) {
    // Same palette as memberships/packages — Active green, Inactive +
    // Archived share the neutral gray treatment.
    const styles: Record<GiftCardStatus, string> = {
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

// ─── Gift avatar (Figma 3726:21787) ─────────────────────────────────────────

function GiftAvatar() {
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <Gift01 className="w-5 h-5 text-[#475467]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Status filter dropdown (single-select, simpler than side-panel) ────────

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

    const OPTIONS: { value: GiftCardStatus; label: string }[] = [
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

// ─── Row actions (⋮) ────────────────────────────────────────────────────────
//
// Same state-aware action set as memberships/packages:
//   • Active   → View · Edit · Archive · Deactivate (red) / Delete (red, when no holders)
//   • Inactive → View · Reactivate · Archive · Delete (red, when no holders)
//   • Archived → View · Recover · Delete (red, when no holders)
//
// Until issued_gift_cards lands, every gift-card design is treated as
// holder-free → Delete shows whenever it's available.

type RowActionKind = "deactivate" | "reactivate" | "archive" | "recover" | "delete";

function RowActions({ status, hasHolders, onView, onEdit, onAction }: {
    status: GiftCardStatus;
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

                {status === "active" && (
                    <button type="button" onClick={() => trigger(onEdit)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Edit02 className="w-4 h-4 text-[#667085]" />Edit
                    </button>
                )}

                {(status === "active" || status === "inactive") && (
                    <button type="button" onClick={() => trigger(() => onAction("archive"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Archive className="w-4 h-4 text-[#667085]" />Archive
                    </button>
                )}

                {status === "inactive" && (
                    <button type="button" onClick={() => trigger(() => onAction("reactivate"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Check className="w-4 h-4 text-[#667085]" />Reactivate
                    </button>
                )}

                {status === "archived" && (
                    <button type="button" onClick={() => trigger(() => onAction("recover"))}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <RefreshCcw01 className="w-4 h-4 text-[#667085]" />Recover
                    </button>
                )}

                {/* Deactivate ↔ Delete — Active rows only. Inactive/archived
                    rows must be Reactivated/Recovered before they can be
                    deleted. */}
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
                    return null;
                })()}
            </FixedDropdown>
        </div>
    );
}

// ─── Confirmation modal (same tone matrix as memberships) ───────────────────

type ConfirmTone = "destructive" | "primary";
type ModalAction = RowActionKind;

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
    tone: ConfirmTone;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this gift card?",
        titleBulk:   n => `Archive ${n} gift cards?`,
        description: subject => <>{subject} will be removed from the POS catalog. You can recover archived gift cards at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        titleSingle: "Deactivate this gift card?",
        titleBulk:   n => `Deactivate ${n} gift cards?`,
        description: (subject, n) => <>{subject} will be hidden from new POS sales. Customers who already hold {n === 1 ? "it" : "them"} keep their balance.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this gift card?",
        titleBulk:   n => `Recover ${n} gift cards?`,
        description: subject => <>{subject} will be restored to Active status and become sellable again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        titleSingle: "Reactivate this gift card?",
        titleBulk:   n => `Reactivate ${n} gift cards?`,
        description: subject => <>{subject} will become available again in the POS catalog.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        titleSingle: "Delete this gift card?",
        titleBulk:   n => `Delete ${n} gift cards?`,
        description: subject => <>{subject} will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
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
                    <Button variant={cfg.tone === "destructive" ? "destructive" : "primary"} size="lg" className="flex-1" onClick={onConfirm}>
                        {cfg.confirmLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Export dropdown ────────────────────────────────────────────────────────

const EXPORT_FORMATS = ["CSV", "PDF", "Excel"] as const;

function ExportDropdown({ onExportCsv }: { onExportCsv: () => void }) {
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
                        <button key={fmt} type="button"
                            onClick={() => {
                                setOpen(false);
                                // Only CSV is wired today; PDF / Excel come later.
                                if (fmt === "CSV") onExportCsv();
                            }}
                            className="w-full text-left px-5 py-3 text-[15px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {fmt}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function exportGiftCardsCsv(rows: GiftCardRow[]) {
    const header = ["Design name", "Price", "Active customers", "Valid until", "Status"];
    const body = rows.map(r => [
        r.name,
        r.priceLabel,
        String(r.activeCustomers),
        r.validUntil,
        STATUS_LABEL[r.status],
    ]);
    downloadCsv(`gift-cards-${todayISO()}.csv`, buildCsv(header, body));
}

// ─── Pagination (same shape as /admin/products) ─────────────────────────────

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

// ─── Bulk action bar (floating pill, same pattern as memberships) ───────────

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

// ─── Table header/cell constants ───────────────────────────────────────────

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Checkbox cell (same sage style as schedule + memberships) ──────────────

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

// ─── Row VM ────────────────────────────────────────────────────────────────

type GiftCardRow = {
    id: string;
    name: string;
    priceLabel: string;
    priceSort: number;
    activeCustomers: number;
    validUntil: string;
    /** Sort key for "Valid until" — `no_expiry` rows sort last. */
    validUntilSort: number;
    status: GiftCardStatus;
    hasHolders: boolean;
};

function rowsFromDesigns(items: GiftCardDesign[], issuedGiftCards: IssuedGiftCard[]): GiftCardRow[] {
    return items.map(g => {
        // Holder count comes from the live `issued_gift_cards` table so the
        // list, the detail sidebar, and the detail "Active customers" tab all
        // agree — and so the delete-vs-deactivate gate is correct.
        const holderCount = giftCardHolderCount(g.id, issuedGiftCards);
        return {
            id: g.id,
            name: g.name,
            priceLabel: priceLabel(g),
            priceSort: priceForSort(g),
            activeCustomers: holderCount,
            validUntil: validUntilLabel(g),
            // No-expiry rows sort to the bottom (Number.MAX_SAFE_INTEGER). Date
            // rows sort by their numeric epoch.
            validUntilSort: g.no_expiry
                ? Number.MAX_SAFE_INTEGER
                : (g.valid_until_date ? new Date(g.valid_until_date).getTime() : 0),
            status: g.status,
            hasHolders: holderCount > 0,
        };
    });
}

// ─── List view (table) ────────────────────────────────────────────────────

function ListView({
    rows, sortKey, sortDir, onSort,
    selectedIds, onToggleOne, onToggleAll,
    onRowAction, onView, onEdit,
}: {
    rows: GiftCardRow[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    selectedIds: Set<string>;
    onToggleOne: (id: string) => void;
    onToggleAll: (next: boolean) => void;
    onRowAction: (row: GiftCardRow, kind: RowActionKind) => void;
    onView: (row: GiftCardRow) => void;
    onEdit: (row: GiftCardRow) => void;
}) {
    if (rows.length === 0) {
        return (
            <div className="relative flex-1" style={{ minHeight: 300 }}>
                <EmptyState title="No gift cards found" subtitle="Try adjusting your search or filter." />
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
                                ariaLabel="Select all gift cards"
                            />
                        </th>
                        <th className={cn(TH, "w-[320px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Gift card name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[140px]")}>
                            <SortableHeader sortKey="price" currentSort={sortKey} dir={sortDir} onSort={onSort}>Price</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="customers" currentSort={sortKey} dir={sortDir} onSort={onSort}>Active customers</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="valid_until" currentSort={sortKey} dir={sortDir} onSort={onSort}>Valid until</SortableHeader>
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
                                        <GiftAvatar />
                                        <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                    </div>
                                </td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.priceLabel}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.activeCustomers}</td>
                                <td className={cn(TD, "whitespace-nowrap")}>{r.validUntil}</td>
                                <td className={TD}><StatusBadge status={r.status} /></td>
                                <td className={TD}>
                                    <RowActions
                                        status={r.status}
                                        hasHolders={r.hasHolders}
                                        onView={() => onView(r)}
                                        onEdit={() => onEdit(r)}
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

// ─── Page ──────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: GiftCardRow; kind: RowActionKind }
    | { mode: "bulk"; rows: GiftCardRow[]; kind: RowActionKind };

export default function GiftCardsPage() {
    const router = useRouter();

    // ─── Store subscriptions ───────────────────────────────────────────────
    const giftCardDesigns        = useAppStore(s => s.giftCardDesigns);
    const issuedGiftCards        = useAppStore(s => s.issuedGiftCards);
    const setGiftCardDesignStatus = useAppStore(s => s.setGiftCardDesignStatus);
    const deleteGiftCardDesign    = useAppStore(s => s.deleteGiftCardDesign);
    const deleteGiftCardDesigns   = useAppStore(s => s.deleteGiftCardDesigns);
    const showToast              = useAppStore(s => s.showToast);

    // ─── Local UI state ────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<StatusFilter>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    useEffect(() => { setPage(1); }, [search, filter]);

    // ─── Build + filter rows ───────────────────────────────────────────────
    const allRows = useMemo(() => rowsFromDesigns(giftCardDesigns, issuedGiftCards), [giftCardDesigns, issuedGiftCards]);
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allRows.filter(r => {
            if (q && !r.name.toLowerCase().includes(q)) return false;
            if (filter && r.status !== filter) return false;
            return true;
        });
    }, [allRows, search, filter]);

    // ─── Sort ──────────────────────────────────────────────────────────────
    const comparators: Record<string, (a: GiftCardRow, b: GiftCardRow) => number> = {
        name:        (a, b) => a.name.localeCompare(b.name),
        price:       (a, b) => a.priceSort - b.priceSort,
        customers:   (a, b) => a.activeCustomers - b.activeCustomers,
        valid_until: (a, b) => a.validUntilSort - b.validUntilSort,
        status:      (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, comparators);

    // ─── Pagination slice ──────────────────────────────────────────────────
    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Selection helpers ─────────────────────────────────────────────────
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

    // ─── Bulk derived flags ────────────────────────────────────────────────
    const selectedRows = useMemo(
        () => sorted.filter(r => selectedIds.has(r.id)),
        [sorted, selectedIds],
    );
    const hasArchivable    = selectedRows.some(r => r.status !== "archived");
    const hasReactivatable = selectedRows.some(r => r.status === "inactive");
    const hasRecoverable   = selectedRows.some(r => r.status === "archived");
    // Delete only when every selected row is Active AND holder-free —
    // inactive/archived gift cards must be reactivated/recovered first.
    const hasDeletable     = selectedRows.length > 0
        && selectedRows.every(r => r.status === "active" && !r.hasHolders);

    // ─── Action plumbing ───────────────────────────────────────────────────
    function openRowConfirm(row: GiftCardRow, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function handleView(row: GiftCardRow) {
        router.push(`/products/gift-cards/${row.id}`);
    }
    function handleEdit(row: GiftCardRow) {
        router.push(`/products/gift-cards/${row.id}/edit`);
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = (() => {
            switch (kind) {
                case "deactivate": return selectedRows.filter(r => r.status === "active");
                case "reactivate": return selectedRows.filter(r => r.status === "inactive");
                case "archive":    return selectedRows.filter(r => r.status !== "archived");
                case "recover":    return selectedRows.filter(r => r.status === "archived");
                case "delete":     return selectedRows.filter(r => r.status === "active" && !r.hasHolders);
            }
        })();
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const kind = pending.kind;
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);

        // ─── Status mutations ─────────────────────────────────────────────
        if (kind === "deactivate" || kind === "reactivate" || kind === "archive" || kind === "recover") {
            const nextStatus: GiftCardStatus =
                kind === "deactivate" ? "inactive" :
                kind === "reactivate" ? "active" :
                kind === "archive"    ? "archived" :
                /* recover */ "active";
            setGiftCardDesignStatus(ids, nextStatus);

            const verbPast =
                kind === "deactivate" ? "deactivated" :
                kind === "reactivate" ? "reactivated" :
                kind === "archive"    ? "archived" :
                "recovered";
            const titleSingle =
                kind === "deactivate" ? "Gift card deactivated" :
                kind === "reactivate" ? "Gift card reactivated" :
                kind === "archive"    ? "Gift card archived" :
                "Gift card recovered";
            const icon: "slash" | "archive" | "refresh" | "check" =
                kind === "deactivate" ? "slash" :
                kind === "archive"    ? "archive" :
                kind === "reactivate" ? "check" :
                "refresh";
            const tone: "success" | "error" = kind === "deactivate" ? "error" : "success";

            if (rows.length === 1) {
                showToast(titleSingle, `${rows[0].name} has been ${verbPast}.`, tone, icon);
            } else {
                showToast(
                    `${rows.length} gift cards ${verbPast}`,
                    `Your selected gift cards have been ${verbPast} and the catalog updated.`,
                    tone, icon,
                );
            }
            clearSelection();
            setPendingConfirm(null);
            return;
        }

        // ─── Delete ───────────────────────────────────────────────────────
        if (kind === "delete") {
            if (pending.mode === "row") {
                deleteGiftCardDesign(ids[0]);
                showToast("Gift card deleted", `${rows[0].name} has been deleted.`, "success", "trash");
            } else {
                const r = deleteGiftCardDesigns(ids);
                showToast(
                    "Gift cards deleted",
                    `${r.deleted.length} gift card${r.deleted.length === 1 ? "" : "s"} deleted.`,
                    "success", "trash",
                );
            }
            clearSelection();
            setPendingConfirm(null);
        }
    }

    // ─── Modal subject copy ───────────────────────────────────────────────
    function modalSubject(p: PendingConfirm): { count: number; subject: React.ReactNode } {
        if (p.mode === "row") {
            return { count: 1, subject: <span className="font-medium text-[#344054]">{p.row.name}</span> };
        }
        return {
            count: p.rows.length,
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected gift cards</>,
        };
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <div className="flex-1">
                    <p className="text-[16px] text-[#667085]">Total</p>
                    <p className="text-[16px] font-medium text-[#101828]">
                        {filteredRows.length} {filteredRows.length === 1 ? "gift card" : "gift cards"}
                    </p>
                </div>
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search product..."
                        className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <ExportDropdown
                    onExportCsv={() => {
                        exportGiftCardsCsv(filteredRows);
                        showToast(
                            "Gift cards exported",
                            `${filteredRows.length} gift card${filteredRows.length === 1 ? "" : "s"} exported to CSV.`,
                            "success", "check",
                        );
                    }}
                />
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() => router.push("/products/gift-cards/new")}>
                    Add new
                </Button>
            </div>

            {/* Body — sits flush on the admin chrome (no nested view card)
                per Figma 3726:21787. The relative wrapper anchors the
                floating bulk-action pill so it can absolutely-position over
                the table area without escaping the page. */}
            <div className="relative flex flex-col flex-1">
                {sorted.length === 0 ? (
                    <div className="relative flex-1" style={{ minHeight: 400 }}>
                        <EmptyState
                            title="No gift cards found"
                            subtitle="Try adjusting your search or filter."
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
