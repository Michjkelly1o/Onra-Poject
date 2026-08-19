"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing Spend module (/admin/marketing/spend)
// ─────────────────────────────────────────────────────────────────────────────
//
// The admin data-entry home for marketing / ad spend — the number the
// Acquisition Efficiency report divides by to compute CPL / CAC / ROAS
// (client comment: "this spend needs to go somewhere to be able to generate
// this report"). One row per (month × channel × branch); the channel set
// mirrors the acquisition channels the report joins leads on, so spend and
// leads line up and the ratios resolve.
//
// Chrome deliberately reuses the shared list + side-panel patterns:
//   • Table  → same TABLE_TH/TD styles, SortableHeader, RowActions ⋮,
//     Pagination, ToolbarTotal/Search as the Gift Cards list.
//   • Add / Edit → a right SlidePanel with the Marketing forms' header /
//     scrollable body / border-top footer shell.
//   • Delete → the shared ConfirmModal. Every action fires a toast.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Plus, Edit02, Trash01, Trash02, XClose,
    CurrencyDollarCircle, Calendar, Announcement01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toast } from "@/components/ui/Toast";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import { Section, FormField, TextInput, BranchSingleSelect } from "@/components/marketing/form-kit";
import { usePersistedListState } from "@/lib/list-ui-cache";
import { useAppStore } from "@/lib/store";
import type { MarketingSpend } from "@/data/mock/_types";

// Channels the Acquisition Efficiency report joins spend↔leads on. Keeping this
// list in lock-step with the lead sources is what makes CPL / CAC / ROAS
// resolve per channel.
const CHANNELS: MarketingSpend["channel"][] = [
    "Instagram", "Google", "Website", "Walk-in", "Referral", "WhatsApp",
];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08" → "Aug 2026". */
function monthLabel(ym: string): string {
    const [y, m] = ym.split("-");
    return `${MONTH_ABBR[Number(m) - 1] ?? m} ${y}`;
}

/** Last 18 calendar months, newest first — the Month picker options. */
function recentMonthOptions(): { value: string; label: string }[] {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        out.push({ value: ym, label: monthLabel(ym) });
    }
    return out;
}

const AED = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

// ─── Row VM ────────────────────────────────────────────────────────────────

type SpendRow = {
    id: string;
    month: string;
    monthText: string;
    channel: string;
    branch: string;
    amount: number;
};

// ─── Table (same chrome as the Gift Cards list) ─────────────────────────────

function SpendTable({
    rows, sortKey, sortDir, onSort, onEdit, onDelete,
}: {
    rows: SpendRow[];
    sortKey: string | null;
    sortDir: "asc" | "desc";
    onSort: (key: string) => void;
    onEdit: (row: SpendRow) => void;
    onDelete: (row: SpendRow) => void;
}) {
    if (rows.length === 0) {
        return (
            <div className="relative flex-1" style={{ minHeight: 400 }}>
                <EmptyState
                    icon={CurrencyDollarCircle}
                    title="No marketing spend yet"
                    subtitle="Add your first spend entry to power the Acquisition Efficiency report."
                />
            </div>
        );
    }
    return (
        <table className="w-full border-collapse">
            <thead>
                <tr>
                    <th className={cn(TH, "w-[220px]")}>
                        <SortableHeader sortKey="month" currentSort={sortKey} dir={sortDir} onSort={onSort}>Month</SortableHeader>
                    </th>
                    <th className={cn(TH, "w-[220px]")}>
                        <SortableHeader sortKey="channel" currentSort={sortKey} dir={sortDir} onSort={onSort}>Channel</SortableHeader>
                    </th>
                    <th className={cn(TH)}>
                        <SortableHeader sortKey="branch" currentSort={sortKey} dir={sortDir} onSort={onSort}>Branch</SortableHeader>
                    </th>
                    <th className={cn(TH, "w-[180px]", "!text-right")}>
                        <SortableHeader sortKey="amount" currentSort={sortKey} dir={sortDir} onSort={onSort} align="right">Amount (AED)</SortableHeader>
                    </th>
                    <th className={cn(TH, "w-[52px]")}></th>
                </tr>
            </thead>
            <tbody>
                {rows.map(r => (
                    <tr key={r.id}
                        onClick={() => onEdit(r)}
                        className="transition-colors cursor-pointer hover:bg-[var(--colors-bg-secondary)]">
                        <td className={cn(TD, "whitespace-nowrap")}>
                            <span className="text-[14px] font-medium text-[#101828]">{r.monthText}</span>
                        </td>
                        <td className={cn(TD, "whitespace-nowrap")}>{r.channel}</td>
                        <td className={cn(TD, "whitespace-nowrap")}>{r.branch}</td>
                        <td className={cn(TD, "whitespace-nowrap", "text-right", "tabular-nums")}>{AED.format(r.amount)}</td>
                        <td className={TD} onClick={e => e.stopPropagation()}>
                            <RowActions items={[
                                { label: "Edit", icon: Edit02, onClick: () => onEdit(r) },
                                { label: "Delete", icon: Trash01, onClick: () => onDelete(r), danger: true },
                            ]} />
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

// ─── Form state ──────────────────────────────────────────────────────────────

interface FormState {
    month: string;
    channel: MarketingSpend["channel"] | "";
    branchId: string;
    amount: string;
}
const EMPTY_FORM: FormState = { month: "", channel: "", branchId: "", amount: "" };

// ─── Page ──────────────────────────────────────────────────────────────────

export default function MarketingSpendPage() {
    const marketingSpend       = useAppStore(s => s.marketingSpend);
    const branches             = useAppStore(s => s.branches);
    const addMarketingSpend    = useAppStore(s => s.addMarketingSpend);
    const updateMarketingSpend = useAppStore(s => s.updateMarketingSpend);
    const deleteMarketingSpend = useAppStore(s => s.deleteMarketingSpend);
    const showToast            = useAppStore(s => s.showToast);

    const [search, setSearch]     = usePersistedListState("marketingSpend:search", "");
    const [page, setPage]         = usePersistedListState("marketingSpend:page", 1);
    const [pageSize, setPageSize] = usePersistedListState("marketingSpend:pageSize", 10);

    const [panelOpen, setPanelOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm]           = useState<FormState>(EMPTY_FORM);
    const [confirmDelete, setConfirmDelete] = useState<SpendRow | null>(null);

    const activeBranches = useMemo(() => branches.filter(b => b.status !== "archived"), [branches]);
    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";
    const monthOptions = useMemo(recentMonthOptions, []);

    // Reset to page 1 when the search changes (skip initial mount).
    const didMount = useRef(false);
    useEffect(() => {
        if (!didMount.current) { didMount.current = true; return; }
        setPage(1);
    }, [search, setPage]);

    // ─── Rows + search + sort + paginate ───────────────────────────────────
    const allRows = useMemo<SpendRow[]>(
        () => marketingSpend.map(s => ({
            id: s.id,
            month: s.month,
            monthText: monthLabel(s.month),
            channel: s.channel,
            branch: branchName(s.branch_id),
            amount: s.spend_aed,
        })),
        [marketingSpend, branches],
    );
    const filteredRows = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allRows;
        return allRows.filter(r =>
            r.monthText.toLowerCase().includes(q) ||
            r.channel.toLowerCase().includes(q) ||
            r.branch.toLowerCase().includes(q),
        );
    }, [allRows, search]);

    const comparators: Record<string, (a: SpendRow, b: SpendRow) => number> = {
        month:   (a, b) => a.month.localeCompare(b.month),
        channel: (a, b) => a.channel.localeCompare(b.channel),
        branch:  (a, b) => a.branch.localeCompare(b.branch),
        amount:  (a, b) => a.amount - b.amount,
    };
    const { sorted, sortKey, sortDir, toggle: toggleSort } = useSort(filteredRows, comparators);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ─── Panel + actions ───────────────────────────────────────────────────
    function openAdd() {
        setEditingId(null);
        setForm({ ...EMPTY_FORM, month: monthOptions[0]?.value ?? "", branchId: activeBranches[0]?.id ?? "" });
        setPanelOpen(true);
    }
    function openEdit(row: SpendRow) {
        const src = marketingSpend.find(s => s.id === row.id);
        if (!src) return;
        setEditingId(src.id);
        setForm({ month: src.month, channel: src.channel, branchId: src.branch_id, amount: String(src.spend_aed) });
        setPanelOpen(true);
    }

    const amountNum = Number(form.amount);
    const isValid =
        form.month !== "" && form.channel !== "" && form.branchId !== "" &&
        Number.isFinite(amountNum) && amountNum > 0;

    function handleSave() {
        if (!isValid || form.channel === "") return;
        const payload = { month: form.month, channel: form.channel, spend_aed: amountNum, branch_id: form.branchId };
        if (editingId) {
            updateMarketingSpend(editingId, payload);
            showToast("Spend updated", `${form.channel} · ${monthLabel(form.month)} set to AED ${AED.format(amountNum)}.`, "success", "check");
        } else {
            addMarketingSpend(payload);
            showToast("Spend added", `AED ${AED.format(amountNum)} on ${form.channel} for ${monthLabel(form.month)}.`, "success", "check");
        }
        setPanelOpen(false);
        setEditingId(null);
    }
    function handleDelete(row: SpendRow) {
        deleteMarketingSpend(row.id);
        showToast("Spend deleted", `${row.channel} · ${row.monthText} removed.`, "success", "trash");
        setConfirmDelete(null);
    }

    return (
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            {/* ── Toolbar (same as Gift Cards) ── */}
            <div className="flex items-center gap-3">
                <ToolbarTotal count={sorted.length} entitySingular="entry" entityPlural="entries" />
                <ToolbarSearch value={search} onChange={setSearch} placeholder="Search spend..." />
                <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={openAdd}>
                    Add
                </Button>
            </div>

            {/* ── List (fills viewport, pagination pinned) ── */}
            <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-auto min-h-0 overflow-y-auto scrollbar-hide">
                    <SpendTable
                        rows={pagedRows}
                        sortKey={sortKey} sortDir={sortDir} onSort={toggleSort}
                        onEdit={openEdit}
                        onDelete={setConfirmDelete}
                    />
                </div>
                {sorted.length > 0 && (
                    <Pagination
                        page={clampedPage} total={sorted.length} pageSize={pageSize}
                        onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                )}
            </div>

            {/* ── Add / Edit side panel (same shell as Marketing forms) ── */}
            <SlidePanel open={panelOpen} onClose={() => setPanelOpen(false)} width={480}>
                <div className="flex h-full flex-col">
                    <div className="flex items-center justify-between px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                        <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            {editingId ? "Edit spend" : "New spend"}
                        </h2>
                        <button type="button" onClick={() => setPanelOpen(false)} aria-label="Close"
                            className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                    </div>

                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 py-5">
                        <div className="flex flex-col gap-8">
                            <Section title="Spend details">
                                <FormField label="Month">
                                    <SelectInput
                                        triggerIcon={<Calendar className="w-5 h-5" />}
                                        placeholder="Select month"
                                        options={monthOptions}
                                        value={form.month}
                                        onChange={v => setForm(f => ({ ...f, month: v }))}
                                        width="w-full"
                                        searchable
                                    />
                                </FormField>
                                <FormField label="Channel"
                                    hint="Matches the acquisition channels the report uses, so spend lines up with leads.">
                                    <SelectInput
                                        triggerIcon={<Announcement01 className="w-5 h-5" />}
                                        placeholder="Select channel"
                                        options={CHANNELS.map(c => ({ value: c, label: c }))}
                                        value={form.channel}
                                        onChange={v => setForm(f => ({ ...f, channel: v as MarketingSpend["channel"] }))}
                                        width="w-full"
                                    />
                                </FormField>
                                <FormField label="Branch">
                                    <BranchSingleSelect
                                        value={form.branchId}
                                        onChange={id => setForm(f => ({ ...f, branchId: id }))}
                                        branches={activeBranches}
                                    />
                                </FormField>
                                <FormField label="Amount (AED)">
                                    <TextInput
                                        value={form.amount === "0" ? "" : form.amount}
                                        onChange={v => setForm(f => ({ ...f, amount: v.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "") }))}
                                        placeholder="0"
                                    />
                                </FormField>
                            </Section>
                        </div>
                    </div>

                    <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4">
                        <div className="flex items-center justify-between w-full">
                            <Button variant="secondary-gray" size="md" onClick={() => setPanelOpen(false)}>Cancel</Button>
                            <Button variant="primary" size="md" disabled={!isValid} onClick={handleSave}>
                                {editingId ? "Save changes" : "Add spend"}
                            </Button>
                        </div>
                    </div>
                </div>
            </SlidePanel>

            {/* ── Delete confirmation ── */}
            <ConfirmModal
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                icon={Trash02}
                tone="danger"
                title="Delete spend entry?"
                description={confirmDelete ? (
                    <>Remove the <span className="font-medium text-[var(--colors-text-primary)]">{confirmDelete.channel} · {confirmDelete.monthText}</span> spend of AED {AED.format(confirmDelete.amount)}. The Acquisition Efficiency report will recompute without it.</>
                ) : ""}
                confirmLabel="Delete"
                onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
            />

            <Toast />
        </div>
    );
}
