"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor dashboard Cancellations modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Triggered from the Cancellations KPI tile on the Instructor dashboard.
// Three tabs reveal the cancellations that contributed to the number:
//   • All       — every cancelled booking for the instructor's classes
//                 in the active period
//   • Late      — cancellations that fell inside the late-cancel window
//                 (booking.attendanceStatus === "late_cancel")
//   • On-time   — the rest (cancelled by the studio/system/customer
//                 outside the late window)
//
// All rows come from the SAME centralized store the admin reads — no
// instructor-specific seed exists or should exist. Sync is automatic: a
// booking cancelled from the admin's class detail page or the customer
// portal flows here on the next render.
//
// Uses the SAME drill-down chrome as the admin dashboard modals: shared
// `ModalShell` (title + aggregate subtitle + paginated footer) and the
// shared `<table>` + `TABLE_TH/TD` + `Pagination` primitives, so the
// instructor modals look identical to admin's.
//
// Layout notes:
//   • The kebab row-action menu is portaled to `document.body` with
//     fixed positioning calculated from the trigger's bounding rect —
//     same pattern the sidebar tooltip uses. This escapes the scroll
//     container's clipping so "View details" is fully visible no matter
//     which row the user clicks.
//
// Figma reference 6262:385418 / 6262:387172 / 6262:388264.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { DotsVertical, Eye } from "@untitledui/icons";
import { useAppStore, isAppointmentId, type ClassBooking, type ClassSchedule, type Customer } from "@/lib/store";
import { Badge } from "@/components/reports/badges";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/Pagination";
import { TABLE_TH, TABLE_TD } from "@/lib/table-styles";
import { ModalShell } from "@/components/dashboard/NeedsAttentionModals";

interface CancellationsModalProps {
    open: boolean;
    onClose: () => void;
    /** Pre-filtered list of cancelled bookings for the instructor (in
     *  the active period). Passed in so the modal stays a pure view —
     *  the dashboard owns the period / instructor filter logic. */
    cancelledBookings: ClassBooking[];
}

type TabKey = "all" | "late" | "on_time";

interface CancellationRow {
    bookingId: string;
    /** FK back to the class the booking sat on — drives the "View
     *  details" kebab action's navigation target. */
    classScheduleId: string;
    /** Class status at modal open time — drives the branching between
     *  `/class/[id]` (Upcoming/Ongoing) and `/earnings/[id]`
     *  (Completed/Cancelled) when the user clicks "View details". */
    classStatus: ClassSchedule["status"];
    customerName: string;
    customerEmail: string;
    customerImageUrl?: string;
    customerInitials: string;
    customerColor: string;
    className: string;
    /** "Cancelled (late)" or "Cancelled (no charge)" — derived from the
     *  booking's `attendanceStatus`. */
    statusLabel: string;
    isLate: boolean;
}

export function CancellationsModal({ open, onClose, cancelledBookings }: CancellationsModalProps) {
    const router         = useRouter();
    const customers      = useAppStore(s => s.customers);
    const classSchedules = useAppStore(s => s.classSchedules);

    const [tab, setTab] = useState<TabKey>("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    /** Active row's kebab menu — id + screen-anchored position. */
    const [openMenu, setOpenMenu] = useState<{ id: string; top: number; right: number } | null>(null);

    // Close the kebab menu when the modal closes (so re-opening doesn't
    // restore stale anchor coordinates) or when the user switches tabs.
    useEffect(() => {
        if (!open) setOpenMenu(null);
    }, [open]);
    useEffect(() => { setOpenMenu(null); setPage(1); }, [tab]);

    // Join the bookings with their customer + class. The modal renders
    // names/emails/avatars off this composite shape.
    const allRows = useMemo<CancellationRow[]>(() => {
        const customerById = new Map<string, Customer>(customers.map(c => [c.id, c]));
        const classById    = new Map<string, ClassSchedule>(
            classSchedules.map((c: ClassSchedule) => [c.id, c]),
        );
        return cancelledBookings
            .map<CancellationRow | null>(b => {
                const customer = customerById.get(b.customerId);
                const klass    = classById.get(b.classScheduleId);
                if (!customer || !klass) return null;
                const isLate = b.attendanceStatus === "late_cancel";
                return {
                    bookingId: b.id,
                    classScheduleId: klass.id,
                    classStatus: klass.status,
                    customerName: `${customer.firstName} ${customer.lastName}`.trim(),
                    customerEmail: customer.email,
                    customerImageUrl: customer.imageUrl,
                    customerInitials: customer.initials,
                    customerColor: "#94aeaf",
                    className: klass.name,
                    statusLabel: isLate ? "Cancelled (late)" : "Cancelled (no charge)",
                    isLate,
                };
            })
            .filter((r): r is CancellationRow => r !== null);
    }, [cancelledBookings, customers, classSchedules]);

    const lateRows    = useMemo(() => allRows.filter(r =>  r.isLate), [allRows]);
    const onTimeRows  = useMemo(() => allRows.filter(r => !r.isLate), [allRows]);
    const visibleRows = tab === "late" ? lateRows : tab === "on_time" ? onTimeRows : allRows;

    const totalRows = visibleRows.length;
    const clampedPage = Math.min(page, Math.max(1, Math.ceil(totalRows / pageSize)));
    const paged = visibleRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    /** Navigate to the class schedule detail for the row's underlying
     *  class. Instructor-scope routing (per memory: instructor side stays
     *  on instructor side) — appointments → `/appointments/[id]`,
     *  Completed/Cancelled classes → `/earnings/[id]`, otherwise
     *  `/class/[id]`. `returnTo` bounces the close button back to the
     *  dashboard (where this modal was opened from). Modal is closed
     *  before the navigation so reopening the dashboard doesn't
     *  re-trigger the cancellations overlay. */
    function handleViewDetails(row: CancellationRow) {
        const base = isAppointmentId(row.classScheduleId)
            ? `/appointments/${row.classScheduleId}`
            : (row.classStatus === "Completed" || row.classStatus === "Cancelled")
                ? `/instructor/earnings/${row.classScheduleId}`
                : `/instructor/class/${row.classScheduleId}`;
        const qs = new URLSearchParams({ returnTo: "/instructor/dashboard" }).toString();
        setOpenMenu(null);
        onClose();
        router.push(`${base}?${qs}`);
    }

    const strong = "font-semibold text-[var(--colors-text-primary)]";

    return (
        <ModalShell
            open={open}
            onClose={onClose}
            width={720}
            title="Cancellations"
            subtitle={
                <>
                    <span className={strong}>{allRows.length}</span> cancellation{allRows.length === 1 ? "" : "s"}
                    {" · "}<span className={strong}>{lateRows.length}</span> late
                    {" · "}<span className={strong}>{onTimeRows.length}</span> on-time
                </>
            }
            footer={
                <Pagination
                    variant="compact" page={clampedPage} total={totalRows} pageSize={pageSize}
                    onPage={setPage} onPageSize={size => { setPageSize(size); setPage(1); }}
                />
            }
        >
            <div className="px-6 pt-5">
                {/* Tabs — same segmented pill style the admin Memberships ↔ Credit-package
                    tab uses on `/admin/products` (white-on-gray pill, inline count). */}
                <div className="pb-4">
                    <div className="flex items-center bg-surface-secondary border-1 border-gray-200 rounded-[10px] p-1 gap-1">
                        <TabButton label="All"     count={allRows.length}    active={tab === "all"}     onClick={() => setTab("all")} />
                        <TabButton label="Late"    count={lateRows.length}   active={tab === "late"}    onClick={() => setTab("late")} />
                        <TabButton label="On-time" count={onTimeRows.length} active={tab === "on_time"} onClick={() => setTab("on_time")} />
                    </div>
                </div>

                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={TABLE_TH}>Name</th>
                            <th className={TABLE_TH}>Class</th>
                            <th className={TABLE_TH}>Status</th>
                            <th className={TABLE_TH} />
                        </tr>
                    </thead>
                    <tbody>
                        {paged.map(row => (
                            <CancellationRowItem
                                key={row.bookingId}
                                row={row}
                                isMenuOpen={openMenu?.id === row.bookingId}
                                onToggleMenu={(anchor) => {
                                    setOpenMenu(prev =>
                                        prev?.id === row.bookingId
                                            ? null
                                            : { id: row.bookingId, top: anchor.bottom + 4, right: window.innerWidth - anchor.right },
                                    );
                                }}
                            />
                        ))}
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                                    No cancellations in this view.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Portaled kebab menu — escapes the modal's overflow so
                "View details" is fully visible even on the last row. */}
            {openMenu && createPortal(
                <>
                    {/* Click-outside catcher — closes the menu only, not the modal. */}
                    <button
                        type="button"
                        aria-label="Close menu"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                        className="fixed inset-0 z-[260] cursor-default"
                    />
                    <div
                        role="menu"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => e.stopPropagation()}
                        style={{ position: "fixed", top: openMenu.top, right: openMenu.right }}
                        className="z-[261] w-44 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] overflow-hidden"
                    >
                        <button
                            type="button"
                            role="menuitem"
                            onClick={e => {
                                e.stopPropagation();
                                // Look up the row that owns this open menu
                                // (we keep the menu state keyed by bookingId
                                // only, so we resolve the row out of the
                                // visible list here) and navigate to its
                                // class schedule detail.
                                const row = visibleRows.find(r => r.bookingId === openMenu.id);
                                if (row) handleViewDetails(row);
                                else setOpenMenu(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors"
                        >
                            <Eye className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                            View details
                        </button>
                    </div>
                </>,
                document.body,
            )}
        </ModalShell>
    );
}

interface CancellationRowItemProps {
    row: CancellationRow;
    isMenuOpen: boolean;
    onToggleMenu: (anchor: DOMRect) => void;
}
function CancellationRowItem({ row, isMenuOpen, onToggleMenu }: CancellationRowItemProps) {
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <tr className="transition-colors">
            {/* Customer cell — avatar + name + email */}
            <td className={TABLE_TD}>
                <div className="flex items-center gap-3 min-w-0">
                    {row.customerImageUrl ? (
                        <img
                            src={row.customerImageUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                    ) : (
                        <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-semibold"
                            style={{ backgroundColor: row.customerColor }}
                        >
                            {row.customerInitials}
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--colors-text-primary)] leading-5 truncate">{row.customerName}</p>
                        <p className="text-sm font-normal text-[var(--colors-text-tertiary)] leading-5 truncate">{row.customerEmail}</p>
                    </div>
                </div>
            </td>

            {/* Class cell */}
            <td className={cn(TABLE_TD, "text-[var(--colors-text-tertiary)]")}>{row.className}</td>

            {/* Status cell */}
            <td className={TABLE_TD}>
                <Badge tone="red">{row.statusLabel}</Badge>
            </td>

            {/* Kebab cell — clicking calls onToggleMenu with the button's
                bounding rect so the portaled menu can fixed-position relative
                to the viewport (not the clipped scroll container). */}
            <td className={TABLE_TD}>
                <div className="flex justify-end">
                    <button
                        ref={btnRef}
                        type="button"
                        aria-label="Row actions"
                        aria-haspopup="menu"
                        aria-expanded={isMenuOpen}
                        onClick={() => {
                            const rect = btnRef.current?.getBoundingClientRect();
                            if (rect) onToggleMenu(rect);
                        }}
                        className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
                            isMenuOpen
                                ? "text-[var(--colors-text-primary)] bg-[var(--colors-bg-secondary)]"
                                : "text-[var(--colors-fg-quaternary)] hover:text-[var(--colors-text-primary)] hover:bg-[var(--colors-bg-secondary)]",
                        )}
                    >
                        <DotsVertical className="w-5 h-5" />
                    </button>
                </div>
            </td>
        </tr>
    );
}

interface TabButtonProps {
    label: string;
    count: number;
    active: boolean;
    onClick: () => void;
}
/** Segmented pill tab — same chrome as the canonical admin pattern
 *  on [admin/products](src/app/admin/products/page.tsx), but each pill
 *  is `flex-1` so the row fills the modal width, and the count
 *  renders as a circular badge sitting next to the label (Figma
 *  6262:385418 — "All 4 / Late 2 / On-time 2"). */
function TabButton({ label, count, active, onClick }: TabButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all whitespace-nowrap",
                active
                    ? "bg-white text-[var(--colors-text-primary)] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                    : "text-[var(--colors-text-quaternary)] hover:text-[var(--colors-text-secondary)]",
            )}
        >
            <span>{label}</span>
            <span
                className={cn(
                    "inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full text-[12px] font-medium border-1",
                    active
                        ? "bg-white border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]"
                        : "bg-surface-secondary border-[var(--colors-border-secondary)] text-[var(--colors-text-quaternary)]",
                )}
            >
                {count}
            </span>
        </button>
    );
}
