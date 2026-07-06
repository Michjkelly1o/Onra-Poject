"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Needs-attention modals
// ─────────────────────────────────────────────────────────────────────────────
//
// Four drill-down modals opened from the "Needs attention today" card on the
// admin dashboard (Figma 7798:80427). Each modal shares the same shell —
// centered white card, header (title + subtitle + close X), table body,
// pagination footer. Only the table columns + row-action items differ per
// modal.
//
// Figma sources:
//   • Renewal due     — 7785:66057   (opens for BOTH renew-today +
//                                     expire-today cards; single modal
//                                     shows the 30-day window)
//   • Failed payments — 7785:227786
//   • At-risk clients — 7785:245665
//   • Under filled    — 7785:246710
//
// Data resolution:
//   All four selectors work from live store slices so a purchase / cancel /
//   attendance-mark elsewhere in the app immediately re-flows the tables.
//   Every filter honours the caller-supplied branch scope so the modals stay
//   consistent with the header branch picker.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    XClose, Eye, RefreshCcw01, Bell01, Users02, Pencil02, Announcement01,
    SlashCircle01, Star01, Trash01, Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import {
    useAppStore, type Customer, type CustomerPlan,
    type CustomerTransaction, type ClassSchedule,
} from "@/lib/store";

// ─── Shared modal shell ────────────────────────────────────────────────────

interface ModalShellProps {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Subtitle rendered directly below the title. Interpolate the row
     *  count + AED-at-stake / range copy here — matches every Figma. */
    subtitle: React.ReactNode;
    /** Rendered inside the modal body between the header and the
     *  pagination footer. */
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Optional width override — default 900px matches the four
     *  Figma widths except the wider Under-filled variant. */
    width?: number;
}

/** Fixed modal height across every drill-down so switching between the
 *  four (renewal → failed → at-risk → under-filled) doesn't jump the
 *  viewport. Client feedback Jul 2026. Chosen to match the Figma
 *  mockups' visible body height plus header + footer chrome. Falls back
 *  to viewport minus 48px gutter on smaller screens. */
const MODAL_FIXED_HEIGHT = 780;

function ModalShell({
    open, onClose, title, subtitle, children, footer, width = 900,
}: ModalShellProps) {
    // Esc closes the modal. Clicking the backdrop closes too — the card
    // itself stops propagation so a click inside the table doesn't bubble.
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-6"
            onClick={onClose}
        >
            <div
                className="absolute inset-0 bg-[#0c111d]/40"
                aria-hidden="true"
            />
            <div
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: width, height: `min(${MODAL_FIXED_HEIGHT}px, calc(100vh - 48px))` }}
                className={cn(
                    "relative bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                    "flex flex-col w-full overflow-hidden",
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6 pb-5 shrink-0">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="font-semibold text-[20px] text-[#101828] leading-[30px]">
                            {title}
                        </p>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            {subtitle}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
                <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                {/* Body — scrolls when the table overflows. Each modal's
                    body wraps its table in an inner `px-6` container so
                    the table edges align with the header padding — same
                    convention every admin list page follows. */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    {children}
                </div>
                {/* Footer — pagination */}
                {footer && (
                    <>
                        <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                        <div className="px-6 py-4 shrink-0">
                            {footer}
                        </div>
                    </>
                )}
            </div>
        </div>,
        document.body,
    );
}

// ─── Bulk-select checkbox ──────────────────────────────────────────────────
//
// Same primitive `/admin/products` (memberships + packages page) uses at
// products/page.tsx:465 — sage-green (#658774) fill + white check when
// checked, sage-green border hover when idle. Client feedback Jul 2026:
// modal checkboxes must match the other admin list tables' style
// (the previous native `<input type="checkbox">` was orange-tinted from
// the browser default + didn't match the DS palette).
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

// ─── Bulk action bar (Renewal-due only) ────────────────────────────────────
//
// Lifted verbatim from `/admin/customers` (`BulkActionBar` at
// customers/page.tsx:334) so the modal's multi-select toolbar matches
// every other admin list page — floating pill anchored to the bottom of
// the viewport with a count + clear + action buttons. Kept scoped to
// this file (not extracted to /patterns) because the Renewal-due modal
// is the only surface here that supports bulk selection.

function RenewalBulkBar({ count, onClear, onSendReminder }: {
    count: number;
    onClear: () => void;
    onSendReminder: () => void;
}) {
    if (count === 0) return null;
    return (
        <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-[210]">
            <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                <button type="button" onClick={onClear}
                    className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                    {count} selected
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex items-center gap-3">
                    <Button variant="secondary-gray" size="sm"
                        leftIcon={<Bell01 className="w-5 h-5 text-[#667085]" />}
                        onClick={onSendReminder}>
                        Send reminder
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Small primitives (avatar, table cells) ────────────────────────────────

/** Customer avatar — real photo when `imageUrl` is set, initials otherwise.
 *  Colour matches the customer's assigned accent for initial fallback. */
function Avatar({
    imageUrl, initials, name, size = 40,
}: { imageUrl?: string; initials: string; name?: string; size?: number }) {
    if (imageUrl) {
        return (
            <img
                src={imageUrl}
                alt={name ?? initials}
                loading="lazy"
                style={{ width: size, height: size }}
                className="rounded-full object-cover shrink-0 border border-black/[0.04]"
            />
        );
    }
    return (
        <div
            style={{
                width: size, height: size,
                backgroundColor: "#f2f4f7",
                fontSize: size * 0.32,
            }}
            className="rounded-full flex items-center justify-center shrink-0 text-[#475467] font-semibold border border-black/[0.04]"
        >
            {initials}
        </div>
    );
}

/** Two-line customer cell — avatar on the left, name over email. */
function CustomerCell({ c }: { c: Customer }) {
    const initials = c.initials || `${(c.firstName?.[0] ?? "").toUpperCase()}${(c.lastName?.[0] ?? "").toUpperCase()}`;
    const name = `${c.firstName} ${c.lastName}`.trim();
    return (
        <div className="flex items-center gap-3">
            <Avatar imageUrl={c.imageUrl} initials={initials} name={name} />
            <div className="flex flex-col min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px] truncate">
                    {name}
                </p>
                <p className="text-[14px] text-[#667085] leading-[20px] truncate">
                    {c.email}
                </p>
            </div>
        </div>
    );
}

// Shared table styles are imported from `@/lib/table-styles`
// (`TABLE_TH` / `TABLE_TD`) — used verbatim so the four drill-down
// modals scan identically to every other admin list table. The
// `align-middle` extension is applied per-cell where a row's inner
// content taller than a single line would otherwise land top-aligned.
const TH = TABLE_TH;
const TD = cn(TABLE_TD, "align-middle");

/** "Mar 25, 2026" — matches the Figma date format across every modal. */
function fmtDate(iso: string | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** "2025-10-28, 10:00 PM" — Failed payments modal uses this stamp. */
function fmtDateTime(iso: string | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const date = d.toISOString().slice(0, 10);
    const h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${date}, ${hh}:${m} ${period}`;
}

// ─── 1. Renewal due modal ──────────────────────────────────────────────────
//
// Opens from BOTH "3 memberships renew today" AND "2 memberships expire
// today" cards (single modal, both cards land here per the client). Shows
// every held membership plan expiring in the NEXT 30 DAYS. Row status pill
// = "Active" while the plan is still held, "Expired" once its expiry date
// has passed. Row action:
//   • Active plans → "Send reminder"
//   • Expired plans → "Send reminder" + "Renew membership"
// Header bulk-actions (checkbox column) let admin blast a reminder to
// every selected row at once.

export interface RenewalDueModalProps { open: boolean; onClose: () => void; branchId?: string | null }

export function RenewalDueModal({ open, onClose, branchId }: RenewalDueModalProps) {
    const router         = useRouter();
    const customers      = useAppStore(s => s.customers);
    const customerPlans  = useAppStore(s => s.customerPlans);
    const showToast      = useAppStore(s => s.showToast);

    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [selected, setSelected] = useState<Set<string>>(new Set());

    // Reset paging + selection when the modal opens.
    useEffect(() => {
        if (open) { setPage(1); setSelected(new Set()); }
    }, [open]);

    const rows = useMemo(() => {
        const now = new Date();
        const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
        const in30ISO = in30.toISOString().slice(0, 10);
        const todayISO = now.toISOString().slice(0, 10);
        return customerPlans
            .filter(p => p.kind === "membership")
            .filter(p => (p.expiryISO ?? "").slice(0, 10) <= in30ISO)
            .filter(p => p.status === "active" || p.status === "frozen" || p.status === "expired")
            .map(p => {
                const c = customers.find(cx => cx.id === p.customerId);
                if (!c) return null;
                if (branchId && c.branchId !== branchId) return null;
                const expiryDate = (p.expiryISO ?? "").slice(0, 10);
                const isExpired = expiryDate < todayISO || p.status === "expired";
                return { plan: p, customer: c, expiryDate, isExpired };
            })
            .filter((r): r is NonNullable<typeof r> => !!r);
    }, [customerPlans, customers, branchId]);

    // Sortable columns — Customer / Membership / Status / Renews.
    // Sorting cycles desc → asc → off just like every other admin table.
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer:   (a, b) => `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`),
            membership: (a, b) => a.plan.name.localeCompare(b.plan.name),
            status:     (a, b) => Number(a.isExpired) - Number(b.isExpired),
            renews:     (a, b) => a.expiryDate.localeCompare(b.expiryDate),
        });

    const totalAtStake = useMemo(
        () => rows.reduce((sum, r) => sum + (r.plan.nextBillingAmountAed ?? r.plan.priceAed ?? 0), 0),
        [rows],
    );

    const totalRows = sortedRows.length;
    const paged = sortedRows.slice((page - 1) * pageSize, page * pageSize);
    const allChecked = paged.length > 0 && paged.every(r => selected.has(r.plan.id));
    const someChecked = !allChecked && paged.some(r => selected.has(r.plan.id));

    function toggleAll() {
        setSelected(prev => {
            const next = new Set(prev);
            if (allChecked) paged.forEach(r => next.delete(r.plan.id));
            else            paged.forEach(r => next.add(r.plan.id));
            return next;
        });
    }
    function toggleOne(id: string) {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    }
    function sendReminderBulk() {
        showToast(
            "Reminders queued",
            `${selected.size} member${selected.size === 1 ? "" : "s"} will receive a renewal reminder.`,
            "success", "check",
        );
        setSelected(new Set());
    }
    function sendReminderOne(customerName: string) {
        showToast("Reminder queued", `Renewal reminder sent to ${customerName}.`, "success", "check");
    }
    // "Renew membership" opens POS with the customer + product already
    // in the cart (client review Jul 2026 — admin should land inside the
    // renewal flow, not just see a toast). The POS page reads these
    // query params on mount, seeds cart + customer, and strips the query
    // afterwards so a refresh doesn't re-inject the prefill.
    function renewMembership(plan: CustomerPlan, customer: Customer) {
        const productKind = plan.kind === "membership" ? "membership" : "package";
        const url = `/admin/pos?customerId=${customer.id}&productId=${plan.productId ?? ""}&productKind=${productKind}`;
        router.push(url);
        onClose();
    }

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Renewal due"
            subtitle={
                <>
                    <span className="font-semibold text-[#101828]">
                        {totalRows} membership{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    renew in the next 30 days ·{" "}
                    <span className="font-semibold text-[#101828]">
                        AED {totalAtStake.toLocaleString("en-US")}
                    </span>{" "}
                    recurring at stake
                </>
            }
            footer={
                <Pagination
                    variant="compact"
                    page={page}
                    total={totalRows}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            {/* Floating bulk-action bar — lifted from /admin/customers so
                the multi-select toolbar matches every other admin list. */}
            <RenewalBulkBar
                count={selected.size}
                onClear={() => setSelected(new Set())}
                onSendReminder={sendReminderBulk}
            />
            {/* Table wrapped in `px-6` so cell edges align with the header
                text padding — same convention every admin list follows. */}
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={cn(TH, "w-10")}>
                                <CheckboxCell
                                    checked={allChecked}
                                    indeterminate={someChecked}
                                    onChange={toggleAll}
                                    ariaLabel={allChecked ? "Deselect all" : "Select all"}
                                />
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="membership" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Membership name</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="renews" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Renews</SortableHeader>
                            </th>
                            <th className={cn(TH, "w-14")} />
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.plan.id} className="hover:bg-[#f9fafb]/50 transition-colors">
                                <td className={TD}>
                                    <CheckboxCell
                                        checked={selected.has(r.plan.id)}
                                        onChange={() => toggleOne(r.plan.id)}
                                        ariaLabel={`Select ${r.customer.firstName} ${r.customer.lastName}`}
                                    />
                                </td>
                                <td className={TD}><CustomerCell c={r.customer} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{r.plan.name}</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">AED {(r.plan.priceAed ?? 0).toLocaleString("en-US")}</p>
                                </td>
                                <td className={TD}>
                                    <StatusBadge
                                        type="customer"
                                        status={r.isExpired ? "archived" : "active"}
                                        label={r.isExpired ? "Expired" : "Active"}
                                        className={r.isExpired ? "bg-[#fef3f2] border-[#fecdca] text-[#b42318]" : ""}
                                    />
                                </td>
                                <td className={cn(TD, "text-[14px] text-[#475467]")}>{fmtDate(r.plan.expiryISO)}</td>
                                <td className={TD}>
                                    <RowActions
                                        items={r.isExpired ? [
                                            {
                                                label: "Send reminder",
                                                icon: Bell01,
                                                onClick: () => sendReminderOne(`${r.customer.firstName} ${r.customer.lastName}`),
                                            },
                                            {
                                                label: "Renew membership",
                                                icon: RefreshCcw01,
                                                onClick: () => renewMembership(r.plan, r.customer),
                                            },
                                        ] : [
                                            {
                                                label: "Send reminder",
                                                icon: Bell01,
                                                onClick: () => sendReminderOne(`${r.customer.firstName} ${r.customer.lastName}`),
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-16 text-center text-[14px] text-[#667085]">
                                    No memberships due in the next 30 days.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 2. Failed payments modal ──────────────────────────────────────────────
//
// Every customer_transactions row with status = failed OR pending, newest
// first. AED at-risk = sum of the row's amountAed for those failed txns
// (this is what the studio can recover by retrying the charge / getting
// the customer's new card). Read-only in the mock — no row action per
// Figma 7785:227786.

export interface FailedPaymentsModalProps { open: boolean; onClose: () => void; branchId?: string | null }

export function FailedPaymentsModal({ open, onClose, branchId }: FailedPaymentsModalProps) {
    const customers = useAppStore(s => s.customers);
    const customerTransactions = useAppStore(s => s.customerTransactions);

    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const rows = useMemo(() => {
        return customerTransactions
            .filter(t => t.status === "failed" || t.status === "pending")
            .filter(t => !branchId || t.branchId === branchId)
            .map(t => {
                const c = customers.find(cx => cx.id === t.customerId);
                if (!c) return null;
                return { txn: t, customer: c };
            })
            .filter((r): r is NonNullable<typeof r> => !!r);
    }, [customerTransactions, customers, branchId]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer: (a, b) => `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`),
            product:  (a, b) => a.txn.name.localeCompare(b.txn.name),
            status:   (a, b) => a.txn.status.localeCompare(b.txn.status),
            date:     (a, b) => a.txn.createdAtISO.localeCompare(b.txn.createdAtISO),
        });

    const recoverableAed = useMemo(
        () => rows.reduce((sum, r) => sum + Math.abs(r.txn.amountAed), 0),
        [rows],
    );
    const totalRows = sortedRows.length;
    const paged = sortedRows.slice((page - 1) * pageSize, page * pageSize);

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Failed payments"
            subtitle={
                <>
                    <span className="font-semibold text-[#101828]">
                        {totalRows} payment{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    failed · AED{" "}
                    <span className="font-semibold text-[#101828]">
                        {recoverableAed.toLocaleString("en-US")}
                    </span>{" "}
                    recoverable now
                </>
            }
            footer={
                <Pagination
                    variant="compact"
                    page={page}
                    total={totalRows}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}>
                                <SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="product" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Products or service</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date &amp; Time</SortableHeader>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.txn.id} className="hover:bg-[#f9fafb]/50 transition-colors">
                                <td className={TD}><CustomerCell c={r.customer} /></td>
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{r.txn.name}</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px]">AED {Math.abs(r.txn.amountAed).toLocaleString("en-US")}</p>
                                </td>
                                <td className={TD}>
                                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]">
                                        Failed
                                    </span>
                                </td>
                                <td className={cn(TD, "text-[14px] text-[#475467] whitespace-nowrap")}>{fmtDateTime(r.txn.createdAtISO)}</td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[#667085]">
                                    No failed payments to recover.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 3. At-risk clients modal ──────────────────────────────────────────────
//
// Customers whose last attended class was 14-30 days ago — same window as
// the dashboard card. Row action:
//   • View     → routes to /admin/customers/[id]
//   • Win back → 404 for now (client hasn't decided the destination)
// Pattern column = "3 bookings/week" — computed from the customer's total
// bookings ÷ weeks since their first booking, capped at 5.

export interface AtRiskClientsModalProps { open: boolean; onClose: () => void; branchId?: string | null }

export function AtRiskClientsModal({ open, onClose, branchId }: AtRiskClientsModalProps) {
    const router = useRouter();
    const customers    = useAppStore(s => s.customers);
    const memberships  = useAppStore(s => s.memberships);
    const packages     = useAppStore(s => s.packages);
    const classBookings = useAppStore(s => s.classBookings);

    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const rows = useMemo(() => {
        const now = Date.now();
        const DAY = 24 * 60 * 60 * 1000;
        return customers
            .filter(c => c.status === "active")
            .filter(c => !branchId || c.branchId === branchId)
            .filter(c => !!c.lastVisitISO)
            .map(c => {
                const d = new Date(c.lastVisitISO!).getTime();
                if (Number.isNaN(d)) return null;
                const daysAgo = Math.floor((now - d) / DAY);
                if (daysAgo < 14 || daysAgo > 30) return null;
                const planLabel = c.planKind === "membership"
                    ? (memberships.find(m => m.id === c.membershipId)?.name ?? c.planName ?? "—")
                    : c.planKind === "package"
                        ? (packages.find(p => p.id === (c.packageIds ?? [])[0])?.name ?? c.planName ?? "—")
                        : "—";
                // Pattern — total bookings ÷ weeks since first booking.
                const custBookings = classBookings.filter(b => b.customerId === c.id);
                const first = custBookings.reduce((min, b) =>
                    (!min || b.bookingTime < min) ? b.bookingTime : min,
                    "" as string,
                );
                let pattern: string;
                if (custBookings.length === 0 || !first) {
                    pattern = "0 bookings/week";
                } else {
                    const weeks = Math.max(1, Math.round((now - new Date(first).getTime()) / (7 * DAY)));
                    const perWeek = Math.min(5, Math.max(1, Math.round(custBookings.length / weeks)));
                    pattern = `${perWeek} booking${perWeek === 1 ? "" : "s"}/week`;
                }
                return { customer: c, planLabel, pattern };
            })
            .filter((r): r is NonNullable<typeof r> => !!r);
    }, [customers, memberships, packages, classBookings, branchId]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<(typeof rows)[number]>(rows, {
            customer:  (a, b) => `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`),
            lastVisit: (a, b) => (a.customer.lastVisitISO ?? "").localeCompare(b.customer.lastVisitISO ?? ""),
            plan:      (a, b) => a.planLabel.localeCompare(b.planLabel),
            pattern:   (a, b) => a.pattern.localeCompare(b.pattern),
        });

    const totalRows = sortedRows.length;
    const paged = sortedRows.slice((page - 1) * pageSize, page * pageSize);

    function viewCustomer(id: string) {
        router.push(`/customers/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
        onClose();
    }
    function winBack() {
        // Client hasn't decided where Win back lands yet — route to the
        // 404 so the placeholder is honest until the destination ships.
        router.push("/admin/win-back-not-implemented");
    }

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="At-risk clients"
            subtitle={
                <>
                    <span className="font-semibold text-[#101828]">
                        {totalRows} customer{totalRows === 1 ? "" : "s"}
                    </span>{" "}
                    haven&apos;t visited in 14-30 days
                </>
            }
            footer={
                <Pagination
                    variant="compact"
                    page={page}
                    total={totalRows}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}>
                                <SortableHeader sortKey="customer" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Customer</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="lastVisit" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Last visit</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="plan" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Plan</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="pattern" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Pattern</SortableHeader>
                            </th>
                            <th className={cn(TH, "w-14")} />
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(r => (
                            <tr key={r.customer.id} className="hover:bg-[#f9fafb]/50 transition-colors">
                                <td className={TD}><CustomerCell c={r.customer} /></td>
                                <td className={cn(TD, "text-[14px] text-[#475467] whitespace-nowrap")}>{fmtDate(r.customer.lastVisitISO)}</td>
                                <td className={cn(TD, "text-[14px] text-[#475467]")}>{r.planLabel}</td>
                                <td className={cn(TD, "text-[14px] text-[#475467] whitespace-nowrap")}>{r.pattern}</td>
                                <td className={TD}>
                                    <RowActions
                                        items={[
                                            {
                                                label: "View",
                                                icon: Eye,
                                                onClick: () => viewCustomer(r.customer.id),
                                            },
                                            {
                                                label: "Win back",
                                                icon: Users02,
                                                onClick: winBack,
                                            },
                                        ]}
                                    />
                                </td>
                            </tr>
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={5} className="py-16 text-center text-[14px] text-[#667085]">
                                    No customers in the at-risk window right now.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </ModalShell>
    );
}

// ─── 4. Under filled classes modal ─────────────────────────────────────────
//
// Every UPCOMING or ONGOING schedule (next 30 days) whose booking ratio is
// under 50%. Row action:
//   • View details → routes to /schedule/[id]
//   • Edit class   → routes to the class detail edit view
//   • Promote class → 404 (client hasn't decided destination yet)
//   • Cancel class → calls store.cancelClassSchedule with an audit reason

export interface UnderFilledModalProps { open: boolean; onClose: () => void; branchId?: string | null }

export function UnderFilledModal({ open, onClose, branchId }: UnderFilledModalProps) {
    const router = useRouter();
    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings  = useAppStore(s => s.classBookings);
    const cancelClassSchedule = useAppStore(s => s.cancelClassSchedule);
    const showToast = useAppStore(s => s.showToast);

    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);
    /** Class the admin has picked "Cancel class" on but hasn't yet
     *  confirmed. Renders the shared cancel-confirmation modal (lifted
     *  visually from admin/schedule's AdminCancelClassModal) so the
     *  action reads consistently across every schedule surface. */
    const [pendingCancel, setPendingCancel] = useState<ClassSchedule | null>(null);
    useEffect(() => { if (open) { setPage(1); setPendingCancel(null); } }, [open]);

    const rows = useMemo(() => {
        const now = new Date();
        const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
        const in30ISO = in30.toISOString().slice(0, 10);
        const todayISO = now.toISOString().slice(0, 10);
        return classSchedules
            .filter(s => s.status === "Upcoming" || s.status === "Ongoing")
            .filter(s => s.dateISO >= todayISO && s.dateISO <= in30ISO)
            .filter(s => s.capacity > 0 && (s.booked / s.capacity) < 0.5)
            .filter(s => !branchId || s.branchId === branchId);
    }, [classSchedules, branchId]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } =
        useSort<ClassSchedule>(rows, {
            datetime:   (a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`),
            className:  (a, b) => a.name.localeCompare(b.name),
            location:   (a, b) => (a.room ?? "").localeCompare(b.room ?? ""),
            attendance: (a, b) => (a.booked / Math.max(1, a.capacity)) - (b.booked / Math.max(1, b.capacity)),
            rating:     (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
            status:     (a, b) => a.status.localeCompare(b.status),
        });

    const totalRows = sortedRows.length;
    const paged = sortedRows.slice((page - 1) * pageSize, page * pageSize);

    function viewDetails(id: string) {
        router.push(`/schedule/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
        onClose();
    }
    function editClass(id: string) {
        // Routes to the dedicated edit page (same URL admin/schedule uses
        // for its Edit class action) so the admin lands in the full-page
        // edit form instead of the read-only detail view.
        router.push(`/schedule/${id}/edit?returnTo=${encodeURIComponent("/admin/dashboard")}`);
        onClose();
    }
    function promoteClass() {
        router.push("/admin/promote-not-implemented");
    }
    function confirmCancelClass() {
        if (!pendingCancel) return;
        cancelClassSchedule(pendingCancel.id, true, "Cancelled from dashboard needs-attention");
        showToast(
            "Class cancelled",
            `${pendingCancel.name} on ${fmtDate(pendingCancel.dateISO)} has been cancelled. Booked members will be refunded.`,
            "success", "check",
        );
        setPendingCancel(null);
    }
    function bookedCountFor(scheduleId: string): number {
        return classBookings.filter(b => b.classScheduleId === scheduleId && b.status === "booked").length;
    }

    // "Sat, 27 Feb 2025" — Under-filled modal's date column format.
    function fmtDayDate(iso: string): string {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "—";
        return d.toLocaleDateString("en-US", {
            weekday: "short", day: "numeric", month: "short", year: "numeric",
        });
    }
    function fmtStartEnd(start?: string, end?: string): string {
        function fmt(hhmm?: string): string {
            if (!hhmm) return "—";
            const [h, m] = hhmm.split(":").map(Number);
            if (Number.isNaN(h)) return hhmm;
            const period = h >= 12 ? "PM" : "AM";
            const hh = h === 0 ? 12 : h > 12 ? h - 12 : h;
            return `${String(hh).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
        }
        return `${fmt(start)} - ${fmt(end)}`;
    }

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            title="Under filled"
            subtitle={<>{totalRows} classes below 50% capacity in the next 30 days</>}
            width={1128}
            footer={
                <Pagination
                    variant="compact"
                    page={page}
                    total={totalRows}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TH}>
                                <SortableHeader sortKey="datetime" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Date &amp; time</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="className" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Class name</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="location" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Location</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="attendance" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Attendance</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="rating" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Rating</SortableHeader>
                            </th>
                            <th className={TH}>
                                <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                            </th>
                            <th className={cn(TH, "w-14")} />
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(s => {
                            const fillPct = s.capacity > 0 ? Math.min(100, Math.round((s.booked / s.capacity) * 100)) : 0;
                            return (
                                <tr key={s.id} className="hover:bg-[#f9fafb]/50 transition-colors">
                                    <td className={TD}>
                                        <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{fmtDayDate(s.dateISO)}</p>
                                        <p className="text-[14px] text-[#667085] leading-[20px] whitespace-nowrap">{fmtStartEnd(s.startTime, s.endTime)}</p>
                                    </td>
                                    <td className={TD}>
                                        <div className="flex items-center gap-3">
                                            {/* Circle-rounded avatar with the template cover
                                                image (or category-tinted initials fallback) —
                                                same shape + fallback logic /admin/schedule uses
                                                in its list table (schedule/page.tsx:678). */}
                                            <div
                                                className="w-9 h-9 rounded-full overflow-hidden shrink-0 border-1 border-[#e4e7ec] flex items-center justify-center"
                                                style={{ backgroundColor: s.coverColor }}
                                            >
                                                {s.coverImage ? (
                                                    <img src={s.coverImage} alt={s.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-[12px] font-semibold text-[#475467]">
                                                        {s.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <p className="text-[14px] font-semibold text-[#101828] leading-[20px] truncate">{s.name}</p>
                                                <p className="text-[14px] text-[#667085] leading-[20px] truncate">with {s.instructorName}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className={cn(TD, "text-[14px] text-[#475467]")}>{s.room ?? "—"}</td>
                                    <td className={TD}>
                                        <div className="flex items-center gap-2 min-w-[100px]">
                                            <div className="flex-1 h-1.5 bg-[#e4e7ec] rounded-full overflow-hidden">
                                                <div className="h-full bg-[#658774] transition-all" style={{ width: `${fillPct}%` }} />
                                            </div>
                                            <span className="text-[14px] text-[#475467] whitespace-nowrap">{s.booked}/{s.capacity}</span>
                                        </div>
                                    </td>
                                    <td className={TD}>
                                        <div className="flex items-center gap-1">
                                            {[0, 1, 2, 3, 4].map(i => (
                                                <Star01
                                                    key={i}
                                                    className={cn(
                                                        "w-4 h-4",
                                                        i < Math.round(s.rating ?? 0)
                                                            ? "text-[#f79009] fill-[#f79009]"
                                                            : "text-[#d0d5dd]",
                                                    )}
                                                />
                                            ))}
                                            <span className="ml-1 text-[14px] text-[#475467]">
                                                {(s.rating ?? 0).toFixed(0)} ({s.ratingCount ?? 0} ratings)
                                            </span>
                                        </div>
                                    </td>
                                    <td className={TD}>
                                        <StatusBadge type="classLifecycle" status={s.status} />
                                    </td>
                                    <td className={TD}>
                                        <RowActions
                                            items={[
                                                { label: "View details",  icon: Eye,             onClick: () => viewDetails(s.id) },
                                                { label: "Edit class",    icon: Pencil02,        onClick: () => editClass(s.id) },
                                                { label: "Promote class", icon: Announcement01,  onClick: promoteClass },
                                                { label: "Cancel class",  icon: SlashCircle01,   onClick: () => setPendingCancel(s), danger: true },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={7} className="py-16 text-center text-[14px] text-[#667085]">
                                    No under-filled classes in the next 30 days.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {/* Cancel-confirmation modal — same chrome + copy shape as the
                AdminCancelClassModal on /admin/schedule so admins get a
                consistent cancellation experience wherever they trigger
                it from. Renders inside a portal so it stacks above the
                Under-filled modal. */}
            <CancelClassConfirmModal
                open={!!pendingCancel}
                schedule={pendingCancel}
                bookedCount={pendingCancel ? bookedCountFor(pendingCancel.id) : 0}
                onClose={() => setPendingCancel(null)}
                onConfirm={confirmCancelClass}
            />
        </ModalShell>
    );
}

// ─── Cancel class confirmation modal ───────────────────────────────────────
//
// Lifted visually verbatim from `AdminCancelClassModal` in
// `src/app/admin/schedule/page.tsx:275` so the Under-filled row action
// matches every other cancel surface in the app. Own portal → stacks
// above the parent ModalShell.
function CancelClassConfirmModal({
    open, schedule, bookedCount, onClose, onConfirm,
}: {
    open: boolean;
    schedule: ClassSchedule | null;
    bookedCount: number;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!open || !schedule) return null;
    if (typeof document === "undefined") return null;
    return createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10"
                    aria-label="Close"
                >
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <Trash01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this class?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{schedule.name}</span>{" "}
                            on {schedule.date} • {schedule.displayTime} will be cancelled.
                            {bookedCount > 0 && (
                                <> All <span className="font-medium text-[#344054]">{bookedCount} booked customer{bookedCount === 1 ? "" : "s"}</span> will be notified and credits refunded.</>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        Yes, cancel class
                    </Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}

// Re-exports (deliberately empty) — the four named exports above are the
// public API. `Customer`, `CustomerPlan`, `CustomerTransaction`,
// `ClassSchedule` come through the shared imports; this module only
// contributes UI.
export type { Customer, CustomerPlan, CustomerTransaction, ClassSchedule };
