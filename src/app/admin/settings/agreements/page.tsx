"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Agreements module (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • List view              — 4232-52279
//   • Filter side-panel       — 4232-51994
//   • Create flow (Phase 2)   — 4205-125208 / 4205-125233 / 4209-152920 / 4983-113037 / 4984-116659
//   • Detail page (Phase 3)   — 4209-150012 / 4209-150030 / 4209-154039 / 4209-156334 / 4209-156753
//
// Phase 1 scope (Brief §1):
//   ✓ Toolbar — Total · Location picker · Search · Export · Filter · Add new
//   ✓ Table   — Agreement name (avatar + version subtext) · Type · Effective until · Status · ⋮
//   ✓ Filter side-panel — Status pills · Type pills · Effective date range
//   ✓ Row actions — View · Edit · Archive   (Active rows)
//                 — View · Recover          (Archived rows)
//                 NO delete, NO deactivate per brief (legal records).
//   ✓ Bulk actions — Archive / Recover (single-tone bar per selection)
//   ✓ Empty state for both truly-empty + filtered-empty
//   ✓ Toast on every state-changing action
//   ⏳ View / Edit / Add new → "Coming in Phase 2/3" placeholder toast.
//
// Reused patterns (no re-invention):
//   • Side-panel filter shell      — customers page
//   • FilterPill                   — customers page (copied verbatim)
//   • SelectInput branch picker    — customers page
//   • DatePicker (effective range) — customers page
//   • Export dropdown              — tax page (verbatim)
//   • Pagination + CheckboxCell    — tax page (verbatim)
//   • ActionModal (archive/recover) — tax page (subset)
//   • Empty state                  — shared EmptyState component
//   • Toast helper                 — useAppStore.showToast

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    FilterLines, Plus, DotsVertical, ChevronLeft, Edit02, Eye, Archive,
    Download01, XClose, RefreshCcw01, Check, MarkerPin01, SearchLg, File06,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore, type Agreement, type AgreementStatus, type Branch } from "@/lib/store";
import {
    branchLocationText,
    computeCoverage,
    computeAgreementLastSigned,
    type AgreementCoverage,
} from "@/lib/agreement-helpers";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { IconAvatar } from "@/components/patterns/IconAvatar";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types & constants ───────────────────────────────────────────────────────

const STATUS_LABEL: Record<AgreementStatus, string> = {
    active:   "Active",
    archived: "Archived",
};

const STATUS_ORDER: Record<AgreementStatus, number> = {
    active: 0, archived: 1,
};

type LocationScope = "multi" | "specific";
const SCOPE_LABEL: Record<LocationScope, string> = {
    multi:    "Multi-branch",
    specific: "Specific branch",
};

interface FilterState {
    statuses: AgreementStatus[];
    scopes:   LocationScope[];
    /** Filter rows whose `effectiveUntil` falls inside this window. */
    effectiveStart: string;
    effectiveEnd:   string;
}
const EMPTY_FILTER: FilterState = {
    statuses: [], scopes: [], effectiveStart: "", effectiveEnd: "",
};

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#475467] border-b border-[#f2f4f7]";

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Derived: Multi-branch (all_locations OR multiple location_ids) vs Specific
 *  branch (exactly one location_id). Retained for the Type filter chips even
 *  though the list column dropped in v24 (Figma 4232:52279 replaces Type
 *  with the concrete "Branch location" column). */
function scopeFor(a: Agreement): LocationScope {
    if (a.allLocations || a.locationIds.length > 1) return "multi";
    return "specific";
}

/** YYYY-MM-DD — matches the Figma's date-pill format (2025-04-22). */
function formatDateISO(iso: string): string {
    return iso.slice(0, 10);
}

// Helpers live in `src/lib/agreement-helpers.ts` — imported above.

// Local StatusBadge removed — uses canonical `<StatusBadge type="agreement">`
// from `@/components/patterns/StatusBadge`.

/** Coverage column cell — thin progress bar (48 px) + N% label + optional
 *  amber "N to re-accept" subtitle when the current version has any
 *  re-accept-due customers. Matches Figma 4232:52279 "80% · 31 to
 *  re-accept" pattern. */
function CoverageCell({ coverage }: { coverage: AgreementCoverage | undefined }) {
    if (!coverage) return <span className="text-[#98a2b3]">—</span>;
    const pct = coverage.percent;
    return (
        <div className="flex items-center gap-2">
            <div className="w-[64px] h-[6px] rounded-full bg-[#eaecf0] overflow-hidden shrink-0">
                <div className="h-full bg-[#658774] transition-[width]" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[14px] text-[#101828] shrink-0">{pct}%</span>
            {coverage.pendingReAccept > 0 && (
                <span className="text-[14px] text-[#b54708] shrink-0">
                    · {coverage.pendingReAccept} to re-accept
                </span>
            )}
        </div>
    );
}

/** Blue "Ongoing" pill for the Effective-until column when the agreement
 *  has no expiry. Matches the Figma blue-tinted pill (#eff8ff bg /
 *  #b2ddff border / #175cd3 text). */
function OngoingPill() {
    return (
        <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]">
            Ongoing
        </span>
    );
}

// Local AgreementAvatar removed — uses canonical `<IconAvatar icon={File06} />`
// from `@/components/patterns/IconAvatar`.

// ─── FilterPill (matches the canonical selected style — customers / products
//    / schedule). Tinted green BG + 2px green border + dark text on selected,
//    white + light gray border on unselected. NOT solid-green/white-text. ───


// ─── Row actions ────────────────────────────────────────────────────────────
//
// Agreements are legal records — brief excludes delete + deactivate. Only:
//   • Active   → View · Edit · Archive
//   • Archived → View · Recover

type RowActionKind = "archive" | "recover";

// Local RowActions removed — uses canonical `<RowActions items={[...]}>` from
// `@/components/patterns/RowActions`. Items array is built per-row at the
// call site below based on agreement status.

// ─── Action modal (tone matrix mirrors customers / tax — archive + recover) ─

const MODAL_CONFIG: Record<RowActionKind, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    titleSingle: string; titleBulk: (n: number) => string;
    description: (subject: React.ReactNode, n: number) => React.ReactNode;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        titleSingle: "Archive this agreement?",
        titleBulk: n => `Archive ${n} agreements?`,
        description: subject => <>{subject} will be hidden from the default list. All signed records and version history are preserved — you can recover archived agreements at any time.</>,
        confirmLabel: "Archive",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        titleSingle: "Recover this agreement?",
        titleBulk: n => `Recover ${n} agreements?`,
        description: subject => <>{subject} will be restored to Active status and shown in the agreements list again.</>,
        confirmLabel: "Recover",
    },
};

// Local ActionModal removed — uses canonical `<ConfirmModal>` driven by
// MODAL_CONFIG above.

// ─── Filter side-panel (Figma 4232-51994) ───────────────────────────────────

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
        pending.statuses.length > 0 ||
        pending.scopes.length > 0 ||
        pending.effectiveStart !== "" ||
        pending.effectiveEnd !== "";

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {(["active", "archived"] as AgreementStatus[]).map(s => (
                                <FilterPill key={s} label={STATUS_LABEL[s]} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Type — derived location scope */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Type</p>
                        <div className="flex flex-wrap gap-2">
                            {(["multi", "specific"] as LocationScope[]).map(t => (
                                <FilterPill key={t} label={SCOPE_LABEL[t]} selected={pending.scopes.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, scopes: toggle(p.scopes, t) }))} />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    {/* Effective date range — filters by effectiveUntil ∈ [start, end] */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Effective date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker
                                value={pending.effectiveStart}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    effectiveStart: v,
                                    effectiveEnd: p.effectiveEnd && v && p.effectiveEnd < v ? "" : p.effectiveEnd,
                                }))}
                                placeholder="Start date"
                            />
                            <DatePicker
                                value={pending.effectiveEnd}
                                onChange={v => setPending(p => ({ ...p, effectiveEnd: v }))}
                                placeholder="End date"
                                minDate={pending.effectiveStart || undefined}
                            />
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

// ─── Export dropdown (verbatim from tax page) ────────────────────────────────

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

// ─── Floating bulk action bar — archive OR recover ───────────────────────────

function BulkActionBar({ count, hasArchivable, hasRecoverable, onClear, onAction }: {
    count: number;
    hasArchivable: boolean;
    hasRecoverable: boolean;
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
                    {hasRecoverable && (
                        <Button variant="secondary-gray" size="sm" leftIcon={<RefreshCcw01 className="w-5 h-5 text-[#067647]" />} onClick={() => onAction("recover")}>
                            Recover
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

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

function exportAgreementsCsv(
    rows: Agreement[],
    branchById: Map<string, Branch>,
    coverageById: Map<string, AgreementCoverage>,
    lastSignedById: Map<string, string | undefined>,
) {
    // v24 columns match the new list view: Branch, Coverage, Effective
    // until (Ongoing or date), plus the v24 policy toggles for
    // completeness so admins can pull an audit trail. Last signed added
    // per client feedback so the audit trail includes recency at a glance.
    const headers = [
        "Name", "Version", "Branches", "Coverage %", "Pending re-accept",
        "Last signed", "Effective mode", "Issue date", "Expiry date",
        "Re-acceptance required", "Guardian consent required",
        "Status", "Required",
    ];
    const escape = (v: string) => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const lines = [headers.join(",")];
    for (const r of rows) {
        const branches = r.allLocations
            ? "All locations"
            : r.locationIds.map(id => branchById.get(id)?.name ?? id).join("; ");
        const cov = coverageById.get(r.id);
        const lastSigned = lastSignedById.get(r.id);
        lines.push([
            r.name,
            String(r.currentVersion),
            branches,
            cov ? String(cov.percent) : "0",
            cov ? String(cov.pendingReAccept) : "0",
            lastSigned ? lastSigned.slice(0, 10) : "",
            r.effectiveDatesMode,
            r.effectiveDatesMode === "expiry" ? r.effectiveFrom.slice(0, 10) : "",
            r.effectiveDatesMode === "expiry" ? r.effectiveUntil.slice(0, 10) : "",
            r.requireReAcceptance ? "Yes" : "No",
            r.requireGuardianConsent ? "Yes" : "No",
            r.status,
            r.required ? "Yes" : "No",
        ].map(escape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agreements-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Page ────────────────────────────────────────────────────────────────────

type PendingConfirm =
    | { mode: "row"; row: Agreement; kind: RowActionKind }
    | { mode: "bulk"; rows: Agreement[]; kind: RowActionKind };

export default function AgreementsPage() {
    const router = useRouter();

    // ─── Store subscriptions ────────────────────────────────────────────────
    const agreements         = useAppStore(s => s.agreements);
    const branches           = useAppStore(s => s.branches);
    // v24 — Coverage column reads live customerAgreements to compute
    // the signed-current-version percentage + re-accept pending count.
    const customerAgreements = useAppStore(s => s.customerAgreements);
    const setAgreementsStatus = useAppStore(s => s.setAgreementsStatus);
    const showToast          = useAppStore(s => s.showToast);

    // ─── Local UI state ─────────────────────────────────────────────────────
    const [search, setSearch] = useState("");
    const [branchId, setBranchId] = useState<string>("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

    useEffect(() => { setPage(1); }, [applied, branchId, search]);

    // ─── Branch options (active only — from the live `branches` slice) ──────
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );
    const branchById = useMemo<Map<string, Branch>>(
        () => new Map(branches.map(b => [b.id, b])),
        [branches],
    );

    // ─── Filter + search + sort pipeline ────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return agreements
            .filter(a => {
                // Search by name (case-insensitive)
                if (q && !a.name.toLowerCase().includes(q)) return false;

                // Branch scope — match agreements that apply to this branch
                if (branchId && !a.allLocations && !a.locationIds.includes(branchId)) return false;

                // Status filter
                if (applied.statuses.length > 0 && !applied.statuses.includes(a.status)) return false;

                // Type filter (derived scope)
                if (applied.scopes.length > 0 && !applied.scopes.includes(scopeFor(a))) return false;

                // Effective date range filter — agreement's effectiveUntil
                // falls in [start, end]. Ongoing agreements have no
                // expiry date; when the admin sets ANY range filter,
                // Ongoing rows are excluded (they're not in the range).
                if (applied.effectiveStart || applied.effectiveEnd) {
                    if (a.effectiveDatesMode === "ongoing") return false;
                    if (applied.effectiveStart && a.effectiveUntil.slice(0, 10) < applied.effectiveStart) return false;
                    if (applied.effectiveEnd   && a.effectiveUntil.slice(0, 10) > applied.effectiveEnd)   return false;
                }
                return true;
            })
            .sort((a, b) => {
                const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
                if (s !== 0) return s;
                return a.name.localeCompare(b.name);
            });
    }, [agreements, search, branchId, applied]);

    // ── Sortable columns — Name / Branch / Coverage / Effective until
    //    / Status. Coverage sorts by numeric percent so a 0% row lands
    //    at the bottom when descending. Effective-until sort treats
    //    Ongoing rows as sorting AFTER dated rows (Ongoing = furthest
    //    away). ──
    const coverageById = useMemo(() => {
        const m = new Map<string, AgreementCoverage>();
        for (const a of agreements) {
            m.set(a.id, computeCoverage(a, customerAgreements));
        }
        return m;
    }, [agreements, customerAgreements]);

    // Per-agreement max signature timestamp — feeds the Last signed
    // column + its sort. Undefined for agreements no one has ever
    // signed; those sort to the bottom on descending order.
    const lastSignedById = useMemo(() => {
        const m = new Map<string, string | undefined>();
        for (const a of agreements) {
            m.set(a.id, computeAgreementLastSigned(a, customerAgreements));
        }
        return m;
    }, [agreements, customerAgreements]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<Agreement>(filtered, {
        name:       (a, b) => a.name.localeCompare(b.name),
        branch:     (a, b) => branchLocationText(a, branchById).localeCompare(branchLocationText(b, branchById)),
        coverage:   (a, b) => (coverageById.get(a.id)?.percent ?? 0) - (coverageById.get(b.id)?.percent ?? 0),
        effective:  (a, b) => {
            const av = a.effectiveDatesMode === "ongoing" ? "9999-12-31" : a.effectiveUntil;
            const bv = b.effectiveDatesMode === "ongoing" ? "9999-12-31" : b.effectiveUntil;
            return av.localeCompare(bv);
        },
        lastSigned: (a, b) => {
            // Never-signed rows sort AFTER dated rows (their "date" is
            // treated as before any real timestamp on ascending, after
            // on descending — matches how empty coverage sorts).
            const av = lastSignedById.get(a.id) ?? "";
            const bv = lastSignedById.get(b.id) ?? "";
            return av.localeCompare(bv);
        },
        status:     (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
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
        () => agreements.filter(r => selectedIds.has(r.id)),
        [agreements, selectedIds],
    );
    const hasArchivable  = selectedRows.some(r => r.status === "active");
    const hasRecoverable = selectedRows.some(r => r.status === "archived");

    function openRowConfirm(row: Agreement, kind: RowActionKind) {
        setPendingConfirm({ mode: "row", row, kind });
    }
    function openBulkConfirm(kind: RowActionKind) {
        const rowsForKind = kind === "archive"
            ? selectedRows.filter(r => r.status === "active")
            : selectedRows.filter(r => r.status === "archived");
        if (rowsForKind.length === 0) return;
        setPendingConfirm({ mode: "bulk", rows: rowsForKind, kind });
    }

    function performAction(pending: PendingConfirm) {
        const rows = pending.mode === "row" ? [pending.row] : pending.rows;
        const ids = rows.map(r => r.id);
        const single = rows.length === 1;

        const nextStatus: AgreementStatus = pending.kind === "archive" ? "archived" : "active";
        setAgreementsStatus(ids, nextStatus);

        const verbPast = pending.kind === "archive" ? "archived" : "recovered";
        const icon: "archive" | "refresh" = pending.kind === "archive" ? "archive" : "refresh";

        if (single) {
            showToast(`Agreement ${verbPast}`, `${rows[0].name} has been ${verbPast}.`, "success", icon);
        } else {
            showToast(
                `${rows.length} agreements ${verbPast}`,
                `Your selected agreements have been ${verbPast}.`,
                "success", icon,
            );
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
            subject: <><span className="font-medium text-[#344054]">{p.rows.length}</span> selected agreements</>,
        };
    }

    // ─── Navigation handlers ────────────────────────────────────────────────
    function handleAddNew() {
        router.push(`/settings/agreements/new?returnTo=${encodeURIComponent("/admin/settings/agreements")}`);
    }
    function handleEdit(row: Agreement) {
        router.push(`/settings/agreements/${row.id}/edit?returnTo=${encodeURIComponent("/admin/settings/agreements")}`);
    }
    function handleView(row: Agreement) {
        router.push(`/settings/agreements/${row.id}?returnTo=${encodeURIComponent("/admin/settings/agreements")}`);
    }

    function handleExportCsv() {
        if (filtered.length === 0) return;
        exportAgreementsCsv(filtered, branchById, coverageById, lastSignedById);
        showToast(
            "Agreements exported",
            `${filtered.length} agreement${filtered.length === 1 ? "" : "s"} exported to CSV.`,
            "success", "check",
        );
    }

    const isTrulyEmpty = agreements.length === 0;
    const hasActiveFilter =
        applied.statuses.length > 0
        || applied.scopes.length > 0
        || applied.effectiveStart !== ""
        || applied.effectiveEnd !== ""
        || branchId !== ""
        || search !== "";

    return (
        <div className="flex flex-col gap-6 h-full min-h-0">
            {/* No inner border / bg — the admin layout's white-rounded shell
                already wraps this page. Toolbar + table + pagination sit
                flush inside the layout's `<main className="p-6">` padding. */}
            <div className="flex-1 min-h-0 flex flex-col">
                {/* Toolbar — Figma 4232-52279 */}
                <div className="shrink-0 flex items-center gap-3">
                    <ToolbarTotal count={filtered.length} entitySingular="agreement" size="sm" />

                    {/* Branch picker (220px) */}
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder="Select location"
                        options={[{ value: "", label: "All locations" }, ...branchOptions]}
                        value={branchId}
                        onChange={setBranchId}
                        width="w-[220px]"
                    />

                    {/* Search */}
                    <div className="relative w-[220px]">
                        <SearchLg className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#667085]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search agreement..."
                            className="h-10 w-full pl-[40px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>

                    <ExportDropdown disabled={filtered.length === 0} onExportCsv={handleExportCsv} />

                    <ToolbarFilter
                        onClick={() => setFilterOpen(true)}
                        active={hasActiveFilter && (applied.statuses.length > 0 || applied.scopes.length > 0 || applied.effectiveStart !== "" || applied.effectiveEnd !== "")}
                    />

                    <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />} onClick={handleAddNew}>
                        Add new
                    </Button>
                </div>

                {/* Table + pagination — no inner padding now that the outer
                    card chrome is gone (admin layout's p-6 already provides
                    the page gutter). */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative pt-5">
                    {pagedRows.length === 0 ? (
                        <EmptyState
                            title={isTrulyEmpty ? "No agreements yet" : "No agreements found"}
                            subtitle={isTrulyEmpty
                                ? "Create your first agreement to start collecting customer signatures."
                                : hasActiveFilter
                                    ? "Try adjusting your search or filters."
                                    : "Try clearing the filter to see all agreements."}
                        />
                    ) : (
                        <div>
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
                                        <th className={cn(TH, "w-[280px]")}>
                                            <SortableHeader sortKey="name"      currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Agreement name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[220px]")}>
                                            <SortableHeader sortKey="branch"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Branch location</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[240px]")}>
                                            <SortableHeader sortKey="coverage"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Coverage</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="lastSigned" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Last signed</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[140px]")}>
                                            <SortableHeader sortKey="effective" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Effective until</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[120px]")}>
                                            <SortableHeader sortKey="status"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pagedRows.map(r => {
                                        const isSelected = selectedIds.has(r.id);
                                        return (
                                            <tr key={r.id}
                                                onClick={() => router.push(`/settings/agreements/${r.id}?returnTo=${encodeURIComponent("/admin/settings/agreements")}`)}
                                                className={cn("transition-colors cursor-pointer", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleOne(r.id)}
                                                        ariaLabel={`Select ${r.name}`}
                                                    />
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <IconAvatar icon={File06} />
                                                        <div className="flex flex-col">
                                                            <span className="text-[14px] font-medium text-[#101828]">{r.name}</span>
                                                            <span className="text-[14px] text-[#667085]">Version {r.currentVersion}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className={TD}>{branchLocationText(r, branchById)}</td>
                                                <td className={TD}>
                                                    <CoverageCell coverage={coverageById.get(r.id)} />
                                                </td>
                                                <td className={TD}>
                                                    {/* Last signed — max signature timestamp across
                                                     *  all versions. `—` when the agreement is
                                                     *  brand-new / no one has signed yet. */}
                                                    {(() => {
                                                        const ts = lastSignedById.get(r.id);
                                                        return ts
                                                            ? <span className="whitespace-nowrap">{formatDateISO(ts)}</span>
                                                            : <span className="text-[#98a2b3]">—</span>;
                                                    })()}
                                                </td>
                                                <td className={TD}>
                                                    {r.effectiveDatesMode === "ongoing"
                                                        ? <OngoingPill />
                                                        : formatDateISO(r.effectiveUntil)}
                                                </td>
                                                <td className={TD}><StatusBadge type="agreement" status={r.status} /></td>
                                                <td className={TD} onClick={e => e.stopPropagation()}>
                                                    <RowActions items={[
                                                        { label: "View", icon: Eye, onClick: () => handleView(r) },
                                                        { label: "Edit", icon: Edit02, onClick: () => handleEdit(r), hidden: r.status !== "active" },
                                                        { label: "Archive", icon: Archive, onClick: () => openRowConfirm(r, "archive"), hidden: r.status !== "active" },
                                                        { label: "Recover", icon: RefreshCcw01, onClick: () => openRowConfirm(r, "recover"), hidden: r.status !== "archived" },
                                                    ]} />
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
                        hasRecoverable={hasRecoverable}
                        onClear={clearSelection}
                        onAction={openBulkConfirm}
                    />
                </div>

                <div className="shrink-0">
                    <Pagination
                        page={clampedPage} total={sortedRows.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            {/* Action modal */}
            {pendingConfirm && (() => {
                const { count, subject } = modalSubject(pendingConfirm);
                const cfg = MODAL_CONFIG[pendingConfirm.kind];
                const title = count === 1 ? cfg.titleSingle : cfg.titleBulk(count);
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={cfg.IconComp}
                        tone="success"
                        title={title}
                        description={cfg.description(subject, count)}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pendingConfirm)}
                    />
                );
            })()}

            {/* Filter side-panel */}
            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => setApplied(f)}
            />
        </div>
    );
}
