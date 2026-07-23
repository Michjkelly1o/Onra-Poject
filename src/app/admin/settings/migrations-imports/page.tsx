"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings · Operations · Migration & imports
// ─────────────────────────────────────────────────────────────────────────────
//
// Audit log of every AI-Agent-driven data import. Figma:
//   • Populated  — 196:99889
//   • Empty      — 196:99868
//
// This module is the READ-ONLY history surface. The actual import flow
// (source → upload → mapping → preview → commit) lives inside the ONRA AI
// Agent (sibling project, /ONRA AI-Agent), and every completed commit
// writes one row to `importHistory` in the store. Until the AI Agent
// integration ships, the page reads seeded rows from
// `src/data/mock/import_history.ts` and the `+ Import` button routes to
// the /new placeholder page (per client 2026-07-20 — that route will
// later open the AI Agent import flow).
//
// Patterns reused (no reinvention):
//   • ToolbarTotal / ToolbarSearch / ToolbarFilter / SelectInput / Button
//   • SlidePanel + FilterPill for the filter drawer
//   • StatusBadge (new "import" family added to the registry)
//   • Pagination
//   • EmptyState (database icon per Figma)
//   • Table styles: TABLE_TH + TABLE_TD constants
//
// Filters (derived from the visible table columns):
//   • Data type (multi)   — Customer / Staff / Membership / …
//   • Status (multi)      — Imported / Partial / Failed / Pending
//   • Date range          — imported_at bounds
// Toolbar search matches file_name.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    MarkerPin01, Plus, XClose, Database02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Pagination } from "@/components/ui/Pagination";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterPill } from "@/components/ui/FilterPill";
import { DatePicker } from "@/components/ui/DatePicker";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarFilter } from "@/components/patterns/ToolbarFilter";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { useAppStore, type ImportHistorySeed } from "@/lib/store";

// ─── Display helpers ─────────────────────────────────────────────────────────

/** Title-case label for the data_type column. Keeps the snake_case values
 *  in the seed (parity with Onra table names) while showing something the
 *  admin reads naturally. */
const DATA_TYPE_LABEL: Record<ImportHistorySeed["data_type"], string> = {
    customers:        "Customer",
    staff:            "Staff",
    memberships:      "Membership",
    packages:         "Package",
    customer_plans:   "Customer plan",
    class_templates:  "Class template",
    class_schedule:   "Class schedule",
    leads:            "Lead",
    gift_cards:       "Gift card",
    services:         "Service",
    rooms:            "Room",
    branches:         "Branch",
    promo_codes:      "Promotion",
    pay_rates:        "Pay rate",
    campaigns:        "Campaign",
    tax_rates:        "Tax rate",
};

const DATA_TYPE_KEYS = Object.keys(DATA_TYPE_LABEL) as ImportHistorySeed["data_type"][];

const STATUS_KEYS: ImportHistorySeed["status"][] = ["imported", "partial", "failed", "pending"];
const STATUS_LABEL: Record<ImportHistorySeed["status"], string> = {
    imported: "Imported",
    partial:  "Partial",
    failed:   "Failed",
    pending:  "Pending",
};

/** ISO → "Imported Feb 1, 2026" for the two-line Data type cell. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtImportedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return `Imported ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** ISO → "2026-02-01" for date-range filter comparisons. */
function isoDay(iso: string): string {
    return (iso ?? "").slice(0, 10);
}

// ─── File-type chip ──────────────────────────────────────────────────────────

/** File-type icon. Every file type resolves to an asset in `public/` so
 *  all rows render through the same `<img>` pipeline — no visual mismatch
 *  between the client-shipped CSV webp and the XLSX/XLS variants (client
 *  flag 2026-07-20: the earlier inline SVG rendered differently at small
 *  sizes than the webp asset). If the client ships PNG/WEBP for XLSX or
 *  XLS later, replace the .svg reference with the new asset — the
 *  component signature stays identical. */
const FILE_ICON_SRC: Record<ImportHistorySeed["file_type"], string> = {
    csv:  "/csv-file-icon.webp",
    xlsx: "/xlsx-file-icon.svg",
    xls:  "/xls-file-icon.svg",
};

function FileTypeChip({ type }: { type: ImportHistorySeed["file_type"] }) {
    return (
        <div className="relative shrink-0 w-6 h-6 overflow-clip">
            <img
                src={FILE_ICON_SRC[type]}
                alt={`${type.toUpperCase()} file`}
                className="w-6 h-6 object-contain"
            />
        </div>
    );
}

// ─── Filter panel ────────────────────────────────────────────────────────────

interface FilterState {
    dataTypes: ImportHistorySeed["data_type"][];
    statuses: ImportHistorySeed["status"][];
    fromISO: string; // yyyy-MM-dd inclusive; empty = no lower bound
    toISO: string;   // yyyy-MM-dd inclusive; empty = no upper bound
}
const EMPTY_FILTER: FilterState = { dataTypes: [], statuses: [], fromISO: "", toISO: "" };

function FilterPanel({ open, onClose, applied, onApply }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (f: FilterState) => void;
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggle<T>(arr: T[], val: T): T[] {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    const hasAny = pending.dataTypes.length > 0 || pending.statuses.length > 0
        || !!pending.fromISO || !!pending.toISO;

    const Divider = () => <div className="h-px w-full bg-[#e4e7ec] shrink-0" />;
    const SectionLabel = ({ label }: { label: string }) => (
        <p className="text-[14px] font-medium text-[#344054]">{label}</p>
    );

    return (
        <SlidePanel open={open} onClose={onClose} width={420}>
            {/* Header — matches the customer-module filter panel */}
            <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[#101828]">Filter</p>
                <button type="button" onClick={onClose}
                    className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>

            {/* Body — px-6 py-5 gap-5 matches the customer module so both
                filter surfaces read identically. */}
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                {/* Data type — multi */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Data type" />
                    <div className="flex flex-wrap gap-2">
                        {DATA_TYPE_KEYS.map(k => (
                            <FilterPill key={k} label={DATA_TYPE_LABEL[k]}
                                selected={pending.dataTypes.includes(k)}
                                onClick={() => setPending(p => ({ ...p, dataTypes: toggle(p.dataTypes, k) }))}
                            />
                        ))}
                    </div>
                </div>

                <Divider />

                {/* Status — multi */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Status" />
                    <div className="flex flex-wrap gap-2">
                        {STATUS_KEYS.map(s => (
                            <FilterPill key={s} label={STATUS_LABEL[s]}
                                selected={pending.statuses.includes(s)}
                                onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))}
                            />
                        ))}
                    </div>
                </div>

                <Divider />

                {/* Imported date range — DatePicker per client 2026-07-20.
                    Same "Start date / End date" pair the customer module's
                    Plan expiry filter uses so the two panels feel identical.
                    End is clamped to ≥ start via `minDate`, and if the admin
                    picks a later start after an end was set we clear the
                    now-invalid end. */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Imported date range" />
                    <div className="grid grid-cols-2 gap-3">
                        <DatePicker
                            value={pending.fromISO}
                            onChange={v => setPending(p => ({
                                ...p,
                                fromISO: v,
                                toISO: p.toISO && v && p.toISO < v ? "" : p.toISO,
                            }))}
                            placeholder="Start date"
                        />
                        <DatePicker
                            value={pending.toISO}
                            onChange={v => setPending(p => ({ ...p, toISO: v }))}
                            placeholder="End date"
                            minDate={pending.fromISO || undefined}
                        />
                    </div>
                </div>
            </div>

            {/* Footer — buttons are fit-width (no flex-1) and pinned to
                the edges via justify-between, matching the customer-module
                filter (client 2026-07-20). */}
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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MigrationsImportsPage() {
    const router = useRouter();
    const importHistory = useAppStore(s => s.importHistory);
    const branches = useAppStore(s => s.branches);

    const [location, setLocation] = useState<string>("");
    const [search, setSearch] = useState<string>("");
    const [applied, setApplied] = useState<FilterState>(EMPTY_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Reset paging when filters/search change so the admin isn't stranded
    // on an out-of-range page after narrowing the list.
    useEffect(() => { setPage(1); }, [location, search, applied]);

    // Location dropdown options — active branches only, matches the
    // dashboard convention so the two pickers feel identical.
    const locationOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id,
            label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );

    // ── Filtering pipeline ──────────────────────────────────────────────
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        return importHistory.filter(r => {
            if (location && r.branch_id !== location) return false;
            if (applied.dataTypes.length > 0 && !applied.dataTypes.includes(r.data_type)) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(r.status)) return false;
            const day = isoDay(r.imported_at);
            if (applied.fromISO && day < applied.fromISO) return false;
            if (applied.toISO && day > applied.toISO) return false;
            if (q && !r.file_name.toLowerCase().includes(q)
                && !DATA_TYPE_LABEL[r.data_type].toLowerCase().includes(q)) return false;
            return true;
        });
    }, [importHistory, location, search, applied]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<ImportHistorySeed>(filteredRows, {
            dataType:     (a, b) => DATA_TYPE_LABEL[a.data_type].localeCompare(DATA_TYPE_LABEL[b.data_type]),
            file:         (a, b) => a.file_name.localeCompare(b.file_name),
            totalRows:    (a, b) => a.total_rows - b.total_rows,
            importedRows: (a, b) => a.imported_rows - b.imported_rows,
            invalidRows:  (a, b) => a.invalid_rows - b.invalid_rows,
            status:       (a, b) => a.status.localeCompare(b.status),
            importedAt:   (a, b) => a.imported_at.localeCompare(b.imported_at),
        });

    const totalRows = sortedRows.length;
    const paged = sortedRows.slice((page - 1) * pageSize, page * pageSize);
    const hasActiveFilter = applied.dataTypes.length > 0 || applied.statuses.length > 0
        || !!applied.fromISO || !!applied.toISO;

    return (
        // Settings layout wraps this in flex-col gap-6; we render the toolbar
        // + view card at the natural rhythm without extra chrome. Card gets
        // the same 760px min-height every other admin list uses so it stays
        // stable across filter changes (CLAUDE.md rule #7 — "fill, never hug").
        <div className="flex flex-col gap-6">
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={totalRows} entitySingular="data" entityPlural="data" />
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                    placeholder="Select location"
                    options={[{ value: "", label: "All locations" }, ...locationOptions]}
                    value={location}
                    onChange={setLocation}
                    width="w-[220px]"
                />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search data..." />
                <ToolbarFilter onClick={() => setFilterOpen(true)} active={hasActiveFilter} />
                {/* +Import — opens the AI Agent Migration thread with a
                    returnTo pointing back here. Every commit_import the
                    agent runs adds a new row to importHistory (via
                    store.addImportHistory) so the admin lands back on
                    this page with the fresh row already at the top. */}
                <Button variant="primary" size="md" leftIcon={<Plus className="w-4 h-4" />}
                    onClick={() =>
                        router.push(
                            "/ai-agent?thread=migrate_data&returnTo=" +
                                encodeURIComponent("/admin/settings/migrations-imports"),
                        )
                    }>
                    Import
                </Button>
            </div>

            {/* ── Body ── Borderless like /admin/products/gift-cards
                (client 2026-07-20). No nested view card, no rounded
                corners; table sits flush on the settings page chrome.
                `min-h` on the wrapper keeps the empty state and the
                populated table at the same footprint so the layout
                doesn't jump when filters narrow to zero. */}
            <div className="flex flex-col flex-1 min-h-[560px]">
                {totalRows === 0 ? (
                    // Empty state — Figma 196:99884.
                    <div className="relative flex-1 min-h-[400px]">
                        <EmptyState
                            icon={Database02}
                            title="There are no imported data yet"
                            subtitle="Your imported data and migration history will appear here."
                        />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={TH}>
                                        <SortableHeader sortKey="dataType" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Data type</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="file" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Imported file</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="totalRows" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Total rows</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="importedRows" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Imported rows</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="invalidRows" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Invalid rows</SortableHeader>
                                    </th>
                                    <th className={TH}>
                                        <span className="text-[12px] font-medium text-[#475467]">Invalid rows data</span>
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(row => (
                                    <tr key={row.id} className="hover:bg-[#f9fafb]/50 transition-colors">
                                        <td className={TD}>
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-medium text-[#101828]">{DATA_TYPE_LABEL[row.data_type]}</span>
                                                <span className="text-[14px] text-[#667085]">{fmtImportedAt(row.imported_at)}</span>
                                            </div>
                                        </td>
                                        <td className={TD}>
                                            <div className="flex items-center gap-3">
                                                <FileTypeChip type={row.file_type} />
                                                <span className="text-[14px] font-medium text-[#101828]">{row.file_name}</span>
                                            </div>
                                        </td>
                                        <td className={cn(TD, "text-[14px] font-medium text-[#101828]")}>
                                            {row.total_rows.toLocaleString("en-US")}
                                        </td>
                                        <td className={cn(TD, "text-[14px] font-medium text-[#079455]")}>
                                            {row.imported_rows > 0 ? row.imported_rows.toLocaleString("en-US") : "-"}
                                        </td>
                                        <td className={cn(TD, "text-[14px] font-medium")}>
                                            {row.invalid_rows > 0
                                                ? <span className="text-[#b42318]">{row.invalid_rows.toLocaleString("en-US")}</span>
                                                : <span className="text-[#101828]">-</span>}
                                        </td>
                                        <td className={TD}>
                                            {row.invalid_rows_file_name ? (
                                                <div className="flex items-center gap-3 max-w-[240px]">
                                                    <FileTypeChip type={
                                                        row.invalid_rows_file_name.toLowerCase().endsWith(".xlsx") ? "xlsx"
                                                        : row.invalid_rows_file_name.toLowerCase().endsWith(".xls") ? "xls"
                                                        : "csv"
                                                    } />
                                                    <span className="text-[14px] font-medium text-[#101828] truncate">
                                                        {row.invalid_rows_file_name}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[14px] font-medium text-[#101828]">-</span>
                                            )}
                                        </td>
                                        <td className={TD}>
                                            <StatusBadge type="import" status={row.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                {totalRows > 0 && (
                    <Pagination
                        page={page}
                        total={totalRows}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={size => { setPageSize(size); setPage(1); }}
                    />
                )}
            </div>

            <FilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={setApplied}
            />
        </div>
    );
}
