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
    SlashCircle01, Star01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { StatusBadge } from "@/components/patterns/StatusBadge";
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
                style={{ maxWidth: width }}
                className={cn(
                    "relative bg-white rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)]",
                    "flex flex-col w-full max-h-[calc(100vh-48px)] overflow-hidden",
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
                {/* Body — scrolls when the table overflows */}
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

const TH = "px-6 py-3 text-left text-[12px] font-medium text-[#667085]";
const TD = "px-6 py-4 align-middle";

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
            .filter((r): r is NonNullable<typeof r> => !!r)
            .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    }, [customerPlans, customers, branchId]);

    const totalAtStake = useMemo(
        () => rows.reduce((sum, r) => sum + (r.plan.nextBillingAmountAed ?? r.plan.priceAed ?? 0), 0),
        [rows],
    );

    const totalRows = rows.length;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);
    const allChecked = paged.length > 0 && paged.every(r => selected.has(r.plan.id));

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
    function renewMembership(customerName: string) {
        showToast("Membership renewed", `${customerName}'s membership has been renewed.`, "success", "check");
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
                <div className="flex items-center gap-4">
                    {selected.size > 0 && (
                        <button
                            type="button"
                            onClick={sendReminderBulk}
                            className="text-[14px] font-semibold text-[#175cd3] hover:text-[#0e4890] transition-colors"
                        >
                            Send reminder to {selected.size} selected
                        </button>
                    )}
                    <div className="flex-1" />
                    <Pagination
                        variant="compact"
                        page={page}
                        total={totalRows}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={size => { setPageSize(size); setPage(1); }}
                    />
                </div>
            }
        >
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-[#e4e7ec]">
                        <th className={cn(TH, "w-10")}>
                            <input
                                type="checkbox"
                                checked={allChecked}
                                onChange={toggleAll}
                                className="w-4 h-4 rounded-[4px] border-[#d0d5dd] text-[#658774] focus:ring-[#aad4bd] cursor-pointer"
                            />
                        </th>
                        <th className={TH}>Customer</th>
                        <th className={TH}>Membership name</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Renews</th>
                        <th className={cn(TH, "w-14")} />
                    </tr>
                </thead>
                <tbody>
                    {paged.map(r => (
                        <tr key={r.plan.id} className="border-b border-[#f2f4f7] last:border-b-0 hover:bg-[#f9fafb]/50 transition-colors">
                            <td className={TD}>
                                <input
                                    type="checkbox"
                                    checked={selected.has(r.plan.id)}
                                    onChange={() => toggleOne(r.plan.id)}
                                    className="w-4 h-4 rounded-[4px] border-[#d0d5dd] text-[#658774] focus:ring-[#aad4bd] cursor-pointer"
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
                                            onClick: () => renewMembership(`${r.customer.firstName} ${r.customer.lastName}`),
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
                            <td colSpan={6} className="px-6 py-16 text-center text-[14px] text-[#667085]">
                                No memberships due in the next 30 days.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
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
            .filter((r): r is NonNullable<typeof r> => !!r)
            .sort((a, b) => b.txn.createdAtISO.localeCompare(a.txn.createdAtISO));
    }, [customerTransactions, customers, branchId]);

    const recoverableAed = useMemo(
        () => rows.reduce((sum, r) => sum + Math.abs(r.txn.amountAed), 0),
        [rows],
    );
    const totalRows = rows.length;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

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
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-[#e4e7ec]">
                        <th className={TH}>Customer</th>
                        <th className={TH}>Products or service</th>
                        <th className={TH}>Status</th>
                        <th className={TH}>Date &amp; Time</th>
                    </tr>
                </thead>
                <tbody>
                    {paged.map(r => (
                        <tr key={r.txn.id} className="border-b border-[#f2f4f7] last:border-b-0 hover:bg-[#f9fafb]/50 transition-colors">
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
                            <td colSpan={4} className="px-6 py-16 text-center text-[14px] text-[#667085]">
                                No failed payments to recover.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
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
            .filter((r): r is NonNullable<typeof r> => !!r)
            .sort((a, b) => (b.customer.lastVisitISO ?? "").localeCompare(a.customer.lastVisitISO ?? ""));
    }, [customers, memberships, packages, classBookings, branchId]);

    const totalRows = rows.length;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

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
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-[#e4e7ec]">
                        <th className={TH}>Customer</th>
                        <th className={TH}>Last visit</th>
                        <th className={TH}>Plan</th>
                        <th className={TH}>Pattern</th>
                        <th className={cn(TH, "w-14")} />
                    </tr>
                </thead>
                <tbody>
                    {paged.map(r => (
                        <tr key={r.customer.id} className="border-b border-[#f2f4f7] last:border-b-0 hover:bg-[#f9fafb]/50 transition-colors">
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
                            <td colSpan={5} className="px-6 py-16 text-center text-[14px] text-[#667085]">
                                No customers in the at-risk window right now.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
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
    const cancelClassSchedule = useAppStore(s => s.cancelClassSchedule);
    const showToast = useAppStore(s => s.showToast);

    const [page, setPage]         = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { if (open) setPage(1); }, [open]);

    const rows = useMemo(() => {
        const now = new Date();
        const in30 = new Date(now); in30.setDate(in30.getDate() + 30);
        const in30ISO = in30.toISOString().slice(0, 10);
        const todayISO = now.toISOString().slice(0, 10);
        return classSchedules
            .filter(s => s.status === "Upcoming" || s.status === "Ongoing")
            .filter(s => s.dateISO >= todayISO && s.dateISO <= in30ISO)
            .filter(s => s.capacity > 0 && (s.booked / s.capacity) < 0.5)
            .filter(s => !branchId || s.branchId === branchId)
            .sort((a, b) => `${a.dateISO} ${a.startTime}`.localeCompare(`${b.dateISO} ${b.startTime}`));
    }, [classSchedules, branchId]);

    const totalRows = rows.length;
    const paged = rows.slice((page - 1) * pageSize, page * pageSize);

    function viewDetails(id: string) {
        router.push(`/schedule/${id}?returnTo=${encodeURIComponent("/admin/dashboard")}`);
        onClose();
    }
    function editClass(id: string) {
        router.push(`/schedule/${id}?edit=true&returnTo=${encodeURIComponent("/admin/dashboard")}`);
        onClose();
    }
    function promoteClass() {
        router.push("/admin/promote-not-implemented");
    }
    function cancelClass(s: ClassSchedule) {
        cancelClassSchedule(s.id, true, "Cancelled from dashboard needs-attention");
        showToast(
            "Class cancelled",
            `${s.name} on ${fmtDate(s.dateISO)} has been cancelled. Booked members will be refunded.`,
            "success", "check",
        );
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
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-[#e4e7ec]">
                        <th className={TH}>Date &amp; time</th>
                        <th className={TH}>Class name</th>
                        <th className={TH}>Location</th>
                        <th className={TH}>Attendance</th>
                        <th className={TH}>Rating</th>
                        <th className={TH}>Status</th>
                        <th className={cn(TH, "w-14")} />
                    </tr>
                </thead>
                <tbody>
                    {paged.map(s => {
                        const fillPct = s.capacity > 0 ? Math.min(100, Math.round((s.booked / s.capacity) * 100)) : 0;
                        return (
                            <tr key={s.id} className="border-b border-[#f2f4f7] last:border-b-0 hover:bg-[#f9fafb]/50 transition-colors">
                                <td className={TD}>
                                    <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{fmtDayDate(s.dateISO)}</p>
                                    <p className="text-[14px] text-[#667085] leading-[20px] whitespace-nowrap">{fmtStartEnd(s.startTime, s.endTime)}</p>
                                </td>
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-[8px] bg-[#f2f4f7] flex items-center justify-center overflow-hidden shrink-0">
                                            <span className="text-[10px] font-semibold text-[#475467] px-1 text-center leading-[12px]">
                                                {s.category?.slice(0, 3).toUpperCase() ?? "CLS"}
                                            </span>
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
                                            { label: "Cancel class",  icon: SlashCircle01,   onClick: () => cancelClass(s), danger: true },
                                        ]}
                                    />
                                </td>
                            </tr>
                        );
                    })}
                    {paged.length === 0 && (
                        <tr>
                            <td colSpan={7} className="px-6 py-16 text-center text-[14px] text-[#667085]">
                                No under-filled classes in the next 30 days.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </ModalShell>
    );
}

// Re-exports (deliberately empty) — the four named exports above are the
// public API. `Customer`, `CustomerPlan`, `CustomerTransaction`,
// `ClassSchedule` come through the shared imports; this module only
// contributes UI.
export type { Customer, CustomerPlan, CustomerTransaction, ClassSchedule };
