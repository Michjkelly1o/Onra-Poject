"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Agreements tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 3882:62994 (table) + 6186:158509 (filter).
//
// Every agreement version the customer has been issued, with whether they
// signed it. A row action opens "View agreement" — the dedicated Agreements
// module doesn't exist yet, so the action fires an informational toast for
// now and will deep-link once that module ships.
//
// Data is derived live from useAppStore(s => s.customerAgreements), joined to
// `branches` (Branch location), `classTemplates` (Class template), and the
// Phase 4 Agreements module's `agreements` + `agreementVersions` so the View
// action opens the actual agreement content rather than firing a stub toast.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    SearchMd, FilterLines, DotsVertical, ChevronLeft, XClose, AlignLeft, Eye, File06,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { DatePicker } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore,
    type CustomerAgreement, type AgreementVersion, type Branch,
} from "@/lib/store";
import { AgreementContentModal } from "@/components/settings/AgreementContentModal";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { FilterPill } from "@/components/ui/FilterPill";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgreementStatus = CustomerAgreement["status"];

interface AgreementFilter {
    dateStart: string;
    dateEnd: string;
    statuses: AgreementStatus[];
    branchId: string;
}
const EMPTY_AGREEMENT_FILTER: AgreementFilter = { dateStart: "", dateEnd: "", statuses: [], branchId: "" };

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "2025-02-28, 10:00 PM" — signed-date column format. */
function fmtDateTime(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    let h = d.getUTCHours();
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${h}:${min} ${ampm}`;
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function AgreementStatusBadge({ status }: { status: AgreementStatus }) {
    const signed = status === "signed";
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            signed
                ? "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
                : "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
        )}>
            {signed ? "Signed" : "Unsigned"}
        </span>
    );
}

// ─── Agreement icon ───────────────────────────────────────────────────────────

function AgreementIcon() {
    return (
        <div className="relative shrink-0 size-10 rounded-full bg-[#f2f4f7] flex items-center justify-center">
            <File06 className="w-5 h-5 text-[#475467]" />
            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
        </div>
    );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────


// ─── Filter panel (Figma 6186:158509) ─────────────────────────────────────────

function AgreementFilterPanel({ open, onClose, applied, onApply, branches }: {
    open: boolean; onClose: () => void;
    applied: AgreementFilter; onApply: (f: AgreementFilter) => void;
    branches: Branch[];
}) {
    const [pending, setPending] = useState<AgreementFilter>(EMPTY_AGREEMENT_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggle<T>(arr: T[], v: T): T[] { return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]; }
    const hasAny =
        pending.statuses.length > 0 || pending.branchId !== "" ||
        pending.dateStart !== "" || pending.dateEnd !== "";

    const STATUSES: AgreementStatus[] = ["unsigned", "signed"];

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="grid grid-cols-2 gap-3">
                            <DatePicker value={pending.dateStart} placeholder="Start date"
                                onChange={v => setPending(p => ({
                                    ...p, dateStart: v,
                                    dateEnd: p.dateEnd && v && p.dateEnd < v ? "" : p.dateEnd,
                                }))} />
                            <DatePicker value={pending.dateEnd} placeholder="End date"
                                minDate={pending.dateStart || undefined}
                                onChange={v => setPending(p => ({ ...p, dateEnd: v }))} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Status */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {STATUSES.map(s => (
                                <FilterPill key={s} label={s === "signed" ? "Signed" : "Unsigned"}
                                    selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                    {/* Branch location */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Branch location</p>
                        <SelectInput value={pending.branchId} placeholder="Select location"
                            options={[{ value: "", label: "All locations" }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                            onChange={v => setPending(p => ({ ...p, branchId: v }))} width="w-full" />
                    </div>
                </div>
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_AGREEMENT_FILTER); onApply(EMPTY_AGREEMENT_FILTER); onClose(); }}>Clear filter</Button>
                    <Button variant="primary" size="md" disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}>Apply</Button>
                </div>
        </SlidePanel>
    );
}

// ─── Row action (⋮) ───────────────────────────────────────────────────────────

function RowActions({ onView }: { onView: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={200}>
                <button type="button" onClick={() => { setOpen(false); onView(); }}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View agreement
                </button>
            </FixedDropdown>
        </div>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyBlock({ title, subtitle }: { title: string; subtitle: string }) {
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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7] align-middle";

// ─── Agreements tab ───────────────────────────────────────────────────────────

export function CustomerAgreementsTab({ customerId }: { customerId: string }) {
    const customerAgreements = useAppStore(s => s.customerAgreements);
    const branches = useAppStore(s => s.branches);
    // Phase 4 — live joins back to the Agreements module so renames /
    // archives propagate, the View modal can read the published content
    // (text or uploaded file) from the actual version, and the Class
    // template column derives from the agreement's live applicable
    // services (so new-version fan-out rows show the same templates as
    // the agreement's existing rows, instead of "—").
    const agreements = useAppStore(s => s.agreements);
    const agreementVersions = useAppStore(s => s.agreementVersions);
    const classTemplates = useAppStore(s => s.classTemplates);

    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [applied, setApplied] = useState<AgreementFilter>(EMPTY_AGREEMENT_FILTER);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [viewVersion, setViewVersion] = useState<AgreementVersion | null>(null);

    useEffect(() => { setPage(1); }, [search, applied]);

    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";

    // Live agreement-name lookup — prefer the joined `agreements` row's
    // current name, fall back to the customer_agreements snapshot when the
    // parent has been deleted (shouldn't happen — agreements are legal
    // records — but the fallback keeps the table from blanking out).
    const liveAgreementName = (a: CustomerAgreement) => {
        const parent = agreements.find(x => x.id === a.agreementId);
        return parent?.name ?? a.title;
    };

    // Phase 4 — derive the Class template column live from the joined
    // agreement instead of the customer_agreements snapshot. Logic:
    //   1. Look up the parent agreement by `agreementId`.
    //   2. Determine the applicable services:
    //        • parent.applicableClassTemplateIds is empty → ALL active
    //          templates apply (matches how the form persists "all")
    //        • non-empty → only those specific templates apply
    //   3. Filter to templates that are offered at the customer's branch
    //      (`branch_ids` either missing/empty = available at all branches,
    //      or includes the row's branchId).
    //   4. Join to names. If the result is empty, fall back to "—".
    //
    // This means: when admin adds a new version, the fan-out row shows
    // the same class templates as the customer's existing rows for that
    // agreement, even though the fan-out only stores the agreement's
    // current `applicableClassTemplateIds` snapshot. When admin edits the
    // agreement to add/remove services, every customer row reflects the
    // new list in the same render cycle.
    const liveClassTemplateNames = (a: CustomerAgreement): string => {
        const parent = agreements.find(x => x.id === a.agreementId);
        const includeAll = !parent || parent.applicableClassTemplateIds.length === 0;
        const applicableIds = new Set(
            includeAll
                ? classTemplates.filter(t => t.status === "Active").map(t => t.id)
                : parent!.applicableClassTemplateIds,
        );
        const names = classTemplates
            .filter(t => t.status === "Active")
            .filter(t => applicableIds.has(t.id))
            .filter(t => {
                const tBranchIds = (t as { branch_ids?: string[] }).branch_ids;
                return !tBranchIds || tBranchIds.length === 0 || tBranchIds.includes(a.branchId);
            })
            .map(t => t.name);
        return names.length > 0 ? names.join(", ") : "—";
    };

    // ─── This customer's agreements (newest version first) ──────────────────
    const rows = useMemo(
        () => customerAgreements
            .filter(a => a.customerId === customerId)
            .sort((a, b) => b.version - a.version),
        [customerAgreements, customerId],
    );

    // ─── Filtering + pagination ─────────────────────────────────────────────
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(a => {
            if (q && !`${a.title} version ${a.version}`.toLowerCase().includes(q)) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(a.status)) return false;
            if (applied.branchId && a.branchId !== applied.branchId) return false;
            if (applied.dateStart || applied.dateEnd) {
                // Date range filters on the signed date — unsigned rows have none.
                if (!a.signedAtISO) return false;
                const date = a.signedAtISO.slice(0, 10);
                if (applied.dateStart && date < applied.dateStart) return false;
                if (applied.dateEnd && date > applied.dateEnd) return false;
            }
            return true;
        });
    }, [rows, search, applied]);

    // ── Agreements sort — Version (name) / Branch / Class template /
    //    Status / Signed date. ──
    const { sorted: sortedAgreements, sortKey: agreementSortKey, sortDir: agreementSortDir, toggle: toggleAgreementSort } = useSort<CustomerAgreement>(filtered, {
        version:  (a, b) => liveAgreementName(a).localeCompare(liveAgreementName(b)),
        branch:   (a, b) => branchName(a.branchId).localeCompare(branchName(b.branchId)),
        template: (a, b) => liveClassTemplateNames(a).localeCompare(liveClassTemplateNames(b)),
        status:   (a, b) => a.status.localeCompare(b.status),
        signed:   (a, b) => (a.signedAtISO ?? "").localeCompare(b.signedAtISO ?? ""),
    });

    const totalPages = Math.max(1, Math.ceil(sortedAgreements.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const paged = sortedAgreements.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    const hasActiveFilter =
        applied.statuses.length > 0 || applied.branchId !== "" ||
        applied.dateStart !== "" || applied.dateEnd !== "";

    // ─── View agreement (Phase 4) — open the live version's content modal ──
    function handleView(a: CustomerAgreement) {
        const v = agreementVersions.find(
            x => x.agreementId === a.agreementId && x.versionNumber === a.version,
        );
        if (v) {
            setViewVersion(v);
        }
        // No fallback toast — if the version is somehow missing we just
        // open nothing rather than leaving a misleading "coming soon" copy.
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="shrink-0 flex items-center gap-3 px-6 pt-5 pb-4">
                <ToolbarTotal count={filtered.length} entitySingular="agreement" size="sm" />
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Search agreement..."
                    size="sm"
                />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {paged.length === 0 ? (
                    <EmptyBlock
                        title={rows.length === 0 ? "No agreements yet" : "No agreements found"}
                        subtitle={rows.length === 0
                            ? "This customer hasn't been issued any agreements."
                            : "Try adjusting your search or filter."}
                    />
                ) : (
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={TH}>
                                        <SortableHeader sortKey="version"  currentSort={agreementSortKey} dir={agreementSortDir} onSort={toggleAgreementSort}>Version</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[200px]")}>
                                        <SortableHeader sortKey="branch"   currentSort={agreementSortKey} dir={agreementSortDir} onSort={toggleAgreementSort}>Branch location</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[240px]")}>
                                        <SortableHeader sortKey="template" currentSort={agreementSortKey} dir={agreementSortDir} onSort={toggleAgreementSort}>Class template</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[130px]")}>
                                        <SortableHeader sortKey="status"   currentSort={agreementSortKey} dir={agreementSortDir} onSort={toggleAgreementSort}>Status</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[190px]")}>
                                        <SortableHeader sortKey="signed"   currentSort={agreementSortKey} dir={agreementSortDir} onSort={toggleAgreementSort}>Signed date</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(a => (
                                    <tr key={a.id}
                                        onClick={() => handleView(a)}
                                        className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <AgreementIcon />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-[14px] font-medium text-[#101828]">{liveAgreementName(a)}</span>
                                                    <span className="text-[13px] text-[#667085]">Version {a.version}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[#475467]")}>{branchName(a.branchId)}</td>
                                        <td className={cn(TD, "text-[#667085]")}>{liveClassTemplateNames(a)}</td>
                                        <td className={TD}><AgreementStatusBadge status={a.status} /></td>
                                        <td className={cn(TD, "text-[#475467] whitespace-nowrap")}>{fmtDateTime(a.signedAtISO)}</td>
                                        <td onClick={e => e.stopPropagation()} className={TD}>
                                            <RowActions onView={() => handleView(a)} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="px-6 shrink-0">
                <Pagination page={clampedPage} total={sortedAgreements.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
            </div>

            <AgreementFilterPanel open={filterOpen} onClose={() => setFilterOpen(false)}
                applied={applied} onApply={f => { setApplied(f); setPage(1); }} branches={branches} />

            {/* Phase 4 — live agreement content modal (shared component).
                Resolves the agreement name from the live `agreements` store
                so the modal title shows the current agreement name + the
                exact version the customer signed (or didn't). */}
            <AgreementContentModal
                version={viewVersion}
                agreementName={
                    viewVersion
                        ? agreements.find(x => x.id === viewVersion.agreementId)?.name
                        : undefined
                }
                versionLabel={viewVersion ? `Version ${viewVersion.versionNumber}` : undefined}
                onClose={() => setViewVersion(null)}
            />
        </div>
    );
}
