"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useRouter, useParams, useSearchParams, usePathname } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01,
    RefreshCcw01, Trash01, Trash02,
    SearchMd, FilterLines, Eye, Check,
    CreditCard01, Package, AlignLeft,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore, resolveTemplateCoverImage } from "@/lib/store";
import type { ClassTemplate, TemplateStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { AttendanceBar } from "@/components/patterns/AttendanceBar";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { FilterPill } from "@/components/ui/FilterPill";
import { TableAvatar } from "@/components/ui/avatar";
import { RowActions } from "@/components/patterns/RowActions";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ─── Sort helpers ─────────────────────────────────────────────────────────────

const MONTH_IDX: Record<string, number> = {
    Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
    Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Builds a sortable key like "2025-02-27 13:00" from a Session's display-format date + time range. */
function sessionSortKey(date: string, timeRange: string): string {
    const parts = date.split(", ")[1]?.split(" ") ?? [];
    const day = String(parts[0] ?? "01").padStart(2, "0");
    const month = String((MONTH_IDX[parts[1] ?? "Jan"] ?? 0) + 1).padStart(2, "0");
    const year = parts[2] ?? "1970";
    const startWithPeriod = timeRange.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    const tail = timeRange.match(/(AM|PM)\s*$/i);
    let hh = 0, mm = 0, period = "AM";
    if (startWithPeriod) {
        hh = Number(startWithPeriod[1]);
        mm = Number(startWithPeriod[2]);
        period = startWithPeriod[3].toUpperCase();
    } else {
        const start = timeRange.match(/^(\d{1,2}):(\d{2})/);
        hh = start ? Number(start[1]) : 0;
        mm = start ? Number(start[2]) : 0;
        period = (tail?.[1] ?? "AM").toUpperCase();
    }
    if (period === "PM" && hh < 12) hh += 12;
    if (period === "AM" && hh === 12) hh = 0;
    return `${year}-${month}-${day} ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// ─── Mock sessions ────────────────────────────────────────────────────────────

type SessionStatus = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

interface Session {
    id: string;
    date: string;       // e.g. "Sat, 27 Feb 2025"
    timeRange: string;  // e.g. "01:00 - 02:00 PM"
    className: string;
    instructor: string;
    location: string;
    booked: number;
    capacity: number;
    rating: number;     // 0–5
    ratingCount: number;
    status: SessionStatus;
    coverImage?: string;
}

/** Convert a shared store ClassInstance into the local Session shape used by this table. */
function instanceToSession(ci: { id: string; name: string; date: string; displayTime: string; instructorName: string; room: string; booked: number; capacity: number; rating: number; ratingCount: number; status: string; coverImage?: string }): Session {
    return {
        id: ci.id,
        date: ci.date,
        timeRange: ci.displayTime,
        className: ci.name,
        instructor: ci.instructorName,
        location: ci.room,
        booked: ci.booked,
        capacity: ci.capacity,
        rating: ci.rating,
        ratingCount: ci.ratingCount,
        status: ci.status as SessionStatus,
        coverImage: ci.coverImage,
    };
}

// ─── Shared empty table illustration ─────────────────────────────────────────

function EmptyTableIllustration() {
    return (
        <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[360px] flex gap-[10px] items-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)] shrink-0">
            <div className="bg-white rounded-[10px] w-[51px] h-[51px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02),-3px_4.4px_10.2px_rgba(0,0,0,0.02)]">
                <div className="bg-[#f9fafb] rounded-[7px] w-[31px] h-[31px] flex items-center justify-center shadow-[0px_1.5px_1.5px_rgba(0,0,0,0.04)]">
                    <AlignLeft className="w-[18px] h-[18px] text-[#98a2b3]" />
                </div>
            </div>
            <div className="flex flex-col gap-[8px] flex-1 min-w-0">
                <div className="bg-[#f2f4f7] h-[13px] w-[82px] rounded-full" />
                <div className="bg-[#f2f4f7] h-[13px] w-full rounded-full" />
            </div>
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Local AttendanceBar removed — uses canonical from `@/components/patterns/AttendanceBar`.
// (Dead `barColor` variable that was never used in the render has been dropped.)

function FilledStar({ filled }: { filled: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 1.167l1.575 3.19 3.52.513-2.547 2.483.601 3.505L7 9.107l-3.149 1.751.601-3.505L1.905 4.87l3.52-.513L7 1.167z"
                fill={filled ? "#f79009" : "none"}
                stroke={filled ? "#f79009" : "#d0d5dd"}
                strokeWidth="1.2"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function StarRating({ rating, count }: { rating: number; count: number }) {
    const filled = Math.round(rating);
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map(i => <FilledStar key={i} filled={i <= filled} />)}
            </div>
            <span className="text-[12px] text-[#667085]">
                {count > 0 ? `${rating.toFixed(1)} (${count} ratings)` : "0 (0 ratings)"}
            </span>
        </div>
    );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
    icon, label, danger = false, onClick,
}: {
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}
        >
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
    open, title, message, confirmLabel, danger,
    onConfirm, onCancel,
}: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[16px] border border-[#e4e7ec] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] p-6 w-[400px] flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <p className="font-semibold text-[18px] text-[#101828]">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">{message}</p>
                </div>
                <div className="flex gap-3">
                    <button type="button" onClick={onCancel}
                        className="flex-1 h-10 border border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm}
                        className={cn(
                            "flex-1 h-10 rounded-[8px] text-[14px] font-semibold transition-colors",
                            danger
                                ? "bg-[#d92d20] text-white hover:bg-[#b42318]"
                                : "bg-[var(--brand-tertiary)] text-[#0c2d34] hover:bg-[#aad4bd]",
                        )}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Left panel ───────────────────────────────────────────────────────────────

function LeftPanel({
    template,
    hasData,
    onAction,
}: {
    template: ClassTemplate;
    hasData: boolean;
    onAction: (action: "edit" | "archive" | "deactivate" | "recover" | "reactivate" | "delete") => void;
}) {
    const { status } = template;
    // Effective banner — template's own upload, else the parent category's
    // image (Phase 4 sync), else nothing.
    const classCategories = useAppStore(s => s.classCategories);
    const effectiveCover  = resolveTemplateCoverImage(template, classCategories);

    const actions = (() => {
        if (status === "Archived") {
            return (
                <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover class template" onClick={() => onAction("recover")} />
            );
        }
        if (status === "Inactive") {
            return (
                <>
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive class template" onClick={() => onAction("archive")} />
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Reactivate class template" onClick={() => onAction("reactivate")} />
                </>
            );
        }
        // Active
        return (
            <>
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit class template" onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive class template" onClick={() => onAction("archive")} />
                {hasData ? (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate class template" danger onClick={() => onAction("deactivate")} />
                ) : (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete class template" danger onClick={() => onAction("delete")} />
                )}
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div className="relative h-[155px] shrink-0 overflow-hidden"
                style={{ backgroundColor: template.coverColor }}>
                {effectiveCover && (
                    <img
                        src={effectiveCover}
                        alt={template.name}
                        className={cn("absolute inset-0 w-full h-full object-cover", status === "Inactive" && "grayscale")}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                )}
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                    <StatusBadge type="template" status={status} size="lg" />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    {/* Name + description */}
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{template.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-2">{template.description}</p>
                    </div>

                    {/* Info fields — Class type row removed (always Group). */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class category</p>
                            <p className="text-[16px] font-medium text-[#101828]">{template.category}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">{template.durationMin} minutes</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class capacity</p>
                            <p className="text-[16px] font-medium text-[#101828]">{template.capacity} participants</p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Class template actions</p>
                    <div className="flex flex-col gap-4">
                        {actions}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Sessions table ───────────────────────────────────────────────────────────

function SessionsTable({ sessions, sortKey, sortDir, onSort, onViewSession, onEditSession, onCancelSession }: {
    sessions: Session[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    onViewSession: (id: string) => void;
    onEditSession: (id: string) => void;
    onCancelSession: (id: string) => void;
}) {
    if (sessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
                <p className="text-[15px] font-medium text-[#344054]">No sessions found</p>
                <p className="text-[14px] text-[#667085]">No sessions scheduled for this template.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={onSort}>Date &amp; time</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[220px]")}>
                            <SortableHeader sortKey="name" currentSort={sortKey} dir={sortDir} onSort={onSort}>Class name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="location" currentSort={sortKey} dir={sortDir} onSort={onSort}>Location</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="attendance" currentSort={sortKey} dir={sortDir} onSort={onSort}>Attendance</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="rating" currentSort={sortKey} dir={sortDir} onSort={onSort}>Rating</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[120px]")}>
                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={onSort}>Status</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[52px]")}></th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => (
                        <tr key={s.id}
                            onClick={() => onViewSession(s.id)}
                            className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                            <td className={TD}>
                                <div className="text-[14px] font-medium text-[#101828]">{s.date}</div>
                                <div className="text-[13px] text-[#667085] mt-0.5">{s.timeRange}</div>
                            </td>
                            <td className={TD}>
                                <div className="flex items-center gap-3">
                                    <TableAvatar
                                        initials={s.className.split(" ").map(w => w[0]).join("").slice(0, 2)}
                                        imageUrl={s.coverImage}
                                        size={36}
                                    />
                                    <div>
                                        <div className="text-[14px] font-medium text-[#101828]">{s.className}</div>
                                        <div className="text-[13px] text-[#667085]">with {s.instructor}</div>
                                    </div>
                                </div>
                            </td>
                            <td className={TD}>{s.location}</td>
                            <td className={TD}>
                                <AttendanceBar booked={s.booked} capacity={s.capacity} />
                            </td>
                            <td className={TD}>
                                {/* Rating only shown once the class has happened —
                                    Upcoming / Ongoing rows show a dash per client Jul 2026. */}
                                {s.status === "Upcoming" || s.status === "Ongoing"
                                    ? <span className="text-[14px] text-[#98a2b3]">—</span>
                                    : <StarRating rating={s.rating} count={s.ratingCount} />}
                            </td>
                            <td className={TD}>
                                <StatusBadge type="class" status={s.status} />
                            </td>
                            <td className={TD} onClick={e => e.stopPropagation()}>
                                {(() => {
                                    const isEditable = s.status === "Upcoming" || s.status === "Ongoing";
                                    return (
                                        <RowActions
                                            items={[
                                                { label: "View details", icon: Eye, onClick: () => onViewSession(s.id), hidden: !isEditable },
                                                { label: "Edit class", icon: Edit02, onClick: () => onEditSession(s.id), hidden: !isEditable },
                                                { label: "Cancel class", icon: Trash01, onClick: () => onCancelSession(s.id), danger: true, hidden: !isEditable },
                                                { label: "View class details", icon: Eye, onClick: () => onViewSession(s.id), hidden: isEditable },
                                            ]}
                                            minWidth={180}
                                        />
                                    );
                                })()}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Membership / Package list data ──────────────────────────────────────────
// Sourced from centralized seeds (`memberships`, `packages`) — single source of
// truth shared with the POS catalog. `active` count is derived live from the
// `customers` store at render time, so it stays in sync with plan changes.


// ─── Filter panel (right slide-in — classes tab) ──────────────────────────────

type DayKey = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
type TimeKey = "Morning" | "Afternoon" | "Evening";

interface ClassFilter {
    statuses: SessionStatus[];
    startDate: string;
    endDate: string;
    days: DayKey[];
    times: TimeKey[];
}

const EMPTY_FILTER: ClassFilter = { statuses: [], startDate: "", endDate: "", days: [], times: [] };


function ClassFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean; onClose: () => void;
    applied: ClassFilter; onApply: (f: ClassFilter) => void;
}) {
    const [pending, setPending] = useState<ClassFilter>(EMPTY_FILTER);

    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny = pending.statuses.length > 0 || !!pending.startDate || !!pending.endDate || pending.days.length > 0 || pending.times.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
{/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(["Upcoming", "Ongoing", "Cancelled", "Completed"] as SessionStatus[]).map(s => (
                                <FilterPill key={s} label={s} selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Custom date range</p>
                        <div className="flex gap-2">
                            <DatePicker className="flex-1" value={pending.startDate}
                                onChange={v => setPending(p => {
                                    const next = { ...p, startDate: v };
                                    if (p.endDate && v && p.endDate < v) next.endDate = "";
                                    return next;
                                })}
                                placeholder="Start date" />
                            <DatePicker className="flex-1" value={pending.endDate}
                                onChange={v => setPending(p => ({ ...p, endDate: v }))}
                                placeholder="End date"
                                minDate={pending.startDate || undefined} />
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Day of week</p>
                        <div className="flex flex-wrap gap-2">
                            {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as DayKey[]).map(d => (
                                <FilterPill key={d} label={d} selected={pending.days.includes(d)}
                                    onClick={() => setPending(p => ({ ...p, days: toggle(p.days, d) }))} />
                            ))}
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Time of the day</p>
                        <div className="flex flex-wrap gap-2">
                            {(["Morning", "Afternoon", "Evening"] as TimeKey[]).map(t => (
                                <FilterPill key={t} label={t} selected={pending.times.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, times: toggle(p.times, t) }))} />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
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

// ─── Action modal (Figma-designed per action) ─────────────────────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const DESTRUCTIVE_ACTIONS = new Set<ModalAction>(["deactivate", "delete"]);

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    title: string; description: string;
    confirmLabel: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        title: "Archive this class template?",
        description: "Are you sure you want to archive this class template? This will archive all of class template access.",
        confirmLabel: "Archive",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        title: "Deactivate this class template?",
        description: "Are you sure you want to deactivate this class template? This will deactivate access to all classes associated with it.",
        confirmLabel: "Deactivate",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        title: "Recover this class template?",
        description: "Are you sure you want to recover this class template from archive? This will enable all of class template access.",
        confirmLabel: "Recover",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        title: "Reactivate this class template?",
        description: "Are you sure you want to reactivate this class template? This will restore access to all classes associated with it.",
        confirmLabel: "Reactivate",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        title: "Delete this class template?",
        description: "Are you sure you want to delete this class template? This action cannot be undone.",
        confirmLabel: "Delete",
    },
};

// Local ActionModal removed — call site uses the canonical
// `<ConfirmModal>` from `@/components/modals/ConfirmModal`, driven by
// MODAL_CONFIG + DESTRUCTIVE_ACTIONS above.

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Right panel ──────────────────────────────────────────────────────────────

type RightTab = "classes" | "memberships" | "packages";

const TABS: { id: RightTab; label: string }[] = [
    { id: "classes", label: "Classes" },
    { id: "memberships", label: "Applicable memberships" },
    { id: "packages", label: "Applicable packages" },
];

function RightPanel({ hasData, template }: { hasData: boolean; template: ClassTemplate }) {
    const router = useRouter();
    const pathname = usePathname();
    const [tab, setTab] = useState<RightTab>("classes");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filterOpen, setFilterOpen] = useState(false);
    const [appliedFilter, setAppliedFilter] = useState<ClassFilter>(EMPTY_FILTER);
    // Cancel-class confirmation flow (mirrors the schedule list page's flow).
    const [cancelSessionId, setCancelSessionId] = useState<string | null>(null);

    // Sessions for this template are derived live from the shared store — when a
    // class is added/cancelled/edited in the schedule module, it reflects here too.
    const classSchedules = useAppStore(s => s.classSchedules);
    const classBookings = useAppStore(s => s.classBookings);
    const cancelClassSchedule = useAppStore(s => s.cancelClassSchedule);
    const showToast = useAppStore(s => s.showToast);
    const allSessions: Session[] = classSchedules
        .filter(ci => ci.templateId === template.id)
        .map(instanceToSession);

    /** Row dropdown handlers — route to the schedule module so we share its full pages. */
    function handleViewSession(id: string) {
        router.push(`/schedule/${id}?returnTo=${encodeURIComponent(pathname)}`);
    }
    function handleEditSession(id: string) {
        router.push(`/schedule/${id}/edit?returnTo=${encodeURIComponent(pathname)}`);
    }
    function handleConfirmCancel() {
        if (!cancelSessionId) return;
        const target = classSchedules.find(ci => ci.id === cancelSessionId);
        if (!target) { setCancelSessionId(null); return; }
        cancelClassSchedule(target.id, true);
        setCancelSessionId(null);
        showToast(
            "Class cancelled successfully",
            `${target.name} on ${target.date} has been cancelled and customers' credits returned.`,
            "error", "slash"
        );
    }
    const cancelTarget = cancelSessionId ? classSchedules.find(ci => ci.id === cancelSessionId) ?? null : null;
    const cancelTargetBookedCount = cancelSessionId
        ? classBookings.filter(b => b.classScheduleId === cancelSessionId && b.status === "booked").length
        : 0;

    const hasActiveFilter =
        appliedFilter.statuses.length > 0 || appliedFilter.startDate ||
        appliedFilter.endDate || appliedFilter.days.length > 0 || appliedFilter.times.length > 0;

    const filteredSessions = allSessions.filter(s => {
        const q = search.toLowerCase();
        const matchSearch = !q || s.className.toLowerCase().includes(q) ||
            s.instructor.toLowerCase().includes(q) || s.location.toLowerCase().includes(q);
        const matchStatus = appliedFilter.statuses.length === 0 || appliedFilter.statuses.includes(s.status);
        return matchSearch && matchStatus;
    });

    const applicableMembershipIds = template.applicableMembershipIds;
    const applicablePackageIds    = template.applicablePackageIds;

    // Map each plan id to # of customers currently holding it (live derivation
    // from the customers store keeps "active" in sync when plans are purchased
    // or cancelled in POS/checkout flows).
    const customers = useAppStore(s => s.customers);
    // Sourced from live store state — when an admin deactivates / archives
    // a product from /admin/products, the row disappears from this tab
    // automatically (only `status === "active"` plans show below).
    const allMemberships = useAppStore(s => s.memberships);
    const allPackages = useAppStore(s => s.packages);
    const activeByPlanName = new Map<string, number>();
    for (const c of customers) {
        if (!c.planName) continue;
        activeByPlanName.set(c.planName, (activeByPlanName.get(c.planName) ?? 0) + 1);
    }

    const filteredMemberships = allMemberships
        .filter(m => m.status === "active")
        .filter(m => applicableMembershipIds.includes(m.id))
        .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
        .map(m => ({
            id: m.id,
            name: m.name,
            active: activeByPlanName.get(m.name) ?? 0,
            enabled: m.status === "active",
        }));

    const filteredPackages = allPackages
        .filter(p => p.status === "active")
        .filter(p => applicablePackageIds.includes(p.id))
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .map(p => ({
            id: p.id,
            name: p.name,
            active: activeByPlanName.get(p.name) ?? 0,
            enabled: p.status === "active",
        }));

    // Sort comparators per table
    const STATUS_ORDER: Record<SessionStatus, number> = { Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3 };
    const sessionComparators: Record<string, (a: Session, b: Session) => number> = {
        date: (a, b) => sessionSortKey(a.date, a.timeRange).localeCompare(sessionSortKey(b.date, b.timeRange)),
        name: (a, b) => a.className.localeCompare(b.className),
        location: (a, b) => a.location.localeCompare(b.location),
        attendance: (a, b) => (a.capacity ? a.booked / a.capacity : 0) - (b.capacity ? b.booked / b.capacity : 0),
        rating: (a, b) => a.rating - b.rating,
        status: (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    type Item = { name: string; enabled: boolean; active: number };
    const itemComparators: Record<string, (a: Item, b: Item) => number> = {
        name: (a, b) => a.name.localeCompare(b.name),
        active: (a, b) => a.active - b.active,
    };
    const { sorted: sortedSessions, sortKey: sessionSortKeyState, sortDir: sessionSortDir, toggle: toggleSessionSort } =
        useSort(filteredSessions, sessionComparators);
    const { sorted: sortedMemberships, sortKey: membershipSortKey, sortDir: membershipSortDir, toggle: toggleMembershipSort } =
        useSort(filteredMemberships, itemComparators);
    const { sorted: sortedPackages, sortKey: packageSortKey, sortDir: packageSortDir, toggle: togglePackageSort } =
        useSort(filteredPackages, itemComparators);

    const total = tab === "classes"
        ? sortedSessions.length
        : tab === "memberships" ? sortedMemberships.length : sortedPackages.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const sliceStart = (clampedPage - 1) * pageSize;
    const sliceEnd = sliceStart + pageSize;
    const paginatedSessions = sortedSessions.slice(sliceStart, sliceEnd);
    const paginatedMemberships = sortedMemberships.slice(sliceStart, sliceEnd);
    const paginatedPackages = sortedPackages.slice(sliceStart, sliceEnd);

    function handleTabChange(t: RightTab) {
        setTab(t);
        setSearch("");
        setPage(1);
        setAppliedFilter(EMPTY_FILTER);
    }

    return (
        <>
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
                {/* Tabs — pt-6 */}
                <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                    <div className="flex gap-1">
                        {TABS.map(t => (
                            <button key={t.id} type="button" onClick={() => handleTabChange(t.id)}
                                className={cn(
                                    "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                    tab === t.id
                                        ? "border-b-2 border-[#101828] text-[#101828]"
                                        : "text-[#667085] hover:text-[#344054]",
                                )}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                    <div className="flex-1">
                        <p className="text-[14px] text-[#667085]">Total</p>
                        <p className="text-[14px] font-medium text-[#101828]">
                            {total} {tab === "classes" ? "classes" : tab === "memberships" ? "memberships" : "packages"}
                        </p>
                    </div>
                    <div className="relative w-[200px]">
                        <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                        <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder="Search..."
                            className="h-9 w-full pl-[36px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>
                    {/* Filter button — varies by tab */}
                    {tab === "classes" && (
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasActiveFilter && (
                                        <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border border-white" />
                                    )}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}>
                            Filter
                        </Button>
                    )}
                </div>

                {/* Table content — relative so empty states can use absolute centering */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {tab === "classes" && (
                        hasData && filteredSessions.length > 0 ? (
                            <div className="px-6">
                                <SessionsTable
                                    sessions={paginatedSessions}
                                    sortKey={sessionSortKeyState}
                                    sortDir={sessionSortDir}
                                    onSort={toggleSessionSort}
                                    onViewSession={handleViewSession}
                                    onEditSession={handleEditSession}
                                    onCancelSession={setCancelSessionId}
                                />
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center gap-6 pointer-events-auto">
                                    <EmptyTableIllustration />
                                    <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                                        <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">No classes yet</p>
                                        <p className="text-[14px] text-[#475467] leading-[20px]">Classes created from this template will appear here.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                    {tab === "memberships" && (
                        filteredMemberships.length > 0 ? (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name" currentSort={membershipSortKey} dir={membershipSortDir} onSort={toggleMembershipSort}>Name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={membershipSortKey} dir={membershipSortDir} onSort={toggleMembershipSort} align="right">Active members</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedMemberships.map(m => (
                                            <tr key={m.id}
                                                onClick={() => router.push(`/products/${m.id}?returnTo=${encodeURIComponent(pathname)}`)}
                                                className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <CreditCard01 className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{m.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{m.active}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}><RowActions items={[{ label: "View details", icon: Eye, onClick: () => router.push(`/products/${m.id}?returnTo=${encodeURIComponent(pathname)}`) }]} minWidth={180} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center gap-6 pointer-events-auto">
                                    <EmptyTableIllustration />
                                    <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                                        <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">No memberships applicable</p>
                                        <p className="text-[14px] text-[#475467] leading-[20px]">No memberships are linked to this class template yet.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                    {tab === "packages" && (
                        filteredPackages.length > 0 ? (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name" currentSort={packageSortKey} dir={packageSortDir} onSort={togglePackageSort}>Name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={packageSortKey} dir={packageSortDir} onSort={togglePackageSort} align="right">Active packages</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPackages.map(p => (
                                            <tr key={p.id}
                                                onClick={() => router.push(`/products/${p.id}?returnTo=${encodeURIComponent(pathname)}`)}
                                                className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{p.active || "—"}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}><RowActions items={[{ label: "View details", icon: Eye, onClick: () => router.push(`/products/${p.id}?returnTo=${encodeURIComponent(pathname)}`) }]} minWidth={180} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="flex flex-col items-center gap-6 pointer-events-auto">
                                    <EmptyTableIllustration />
                                    <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                                        <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">No packages applicable</p>
                                        <p className="text-[14px] text-[#475467] leading-[20px]">No packages are linked to this class template yet.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}
                </div>

                <div className="px-6 shrink-0">
                    <Pagination
                        page={clampedPage}
                        total={total}
                        pageSize={pageSize}
                        onPage={setPage}
                        onPageSize={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            <ClassFilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={appliedFilter}
                onApply={f => { setAppliedFilter(f); setPage(1); }}
            />

            {/* Cancel-class confirmation — mirrors the schedule list-view dialog. */}
            {cancelTarget && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => setCancelSessionId(null)} />
                    <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                        <button type="button" onClick={() => setCancelSessionId(null)}
                            className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                            <XClose className="w-6 h-6 text-[#667085]" />
                        </button>
                        <div className="flex flex-col items-center gap-4 pt-6 px-6">
                            <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                                <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                            </div>
                            <div className="flex flex-col gap-1 text-center w-full">
                                <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this class?</h3>
                                <p className="text-[14px] text-[#475467] leading-[20px]">
                                    {cancelTarget.name} on {cancelTarget.date} will be cancelled
                                    {cancelTargetBookedCount > 0
                                        ? <>, and credits will be refunded to {cancelTargetBookedCount} booked customer{cancelTargetBookedCount === 1 ? "" : "s"}.</>
                                        : <>. This action cannot be undone.</>}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3 px-6 pt-6 pb-6">
                            <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setCancelSessionId(null)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" size="lg" className="flex-1" onClick={handleConfirmCancel}>
                                Yes, cancel class
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ClassTemplateDetailPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const { id } = useParams<{ id: string }>();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/class-types";
    const { classTemplates, classSchedules, updateClassTemplate, deleteClassTemplate, showToast } = useAppStore();

    const template = classTemplates.find(t => t.id === id);

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    if (!template) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Template not found</p>
                    <button type="button" onClick={() => router.push(returnTo)}
                        className="mt-4 text-[14px] text-[#658774] hover:underline">
                        Back to class templates
                    </button>
                </div>
            </div>
        );
    }

    // "Has data" = at least one class has actually been scheduled from this
    // template. Drives the delete-vs-deactivate gate + the Classes-tab empty
    // state — read live from the schedule store, not guessed from the id.
    const hasData = classSchedules.some(s => s.templateId === id);

    function handleAction(action: "edit" | ModalAction) {
        if (action === "edit") {
            router.push(`/class-types/${id}/edit?returnTo=${encodeURIComponent(pathname)}`);
            return;
        }
        setConfirmAction(action);
    }

    function handleConfirm() {
        if (!confirmAction || !template) return;
        const name = template.name;

        if (confirmAction === "delete") {
            deleteClassTemplate(id);
            showToast("Class template deleted successfully", `"${name}" class template is no longer available for new classes.`, "error", "trash");
            setConfirmAction(null);
            router.push(returnTo);
        } else if (confirmAction === "archive") {
            updateClassTemplate(id, { status: "Archived" });
            showToast("Class template is now archived", "The class template has been archived and is no longer in use.", "success", "archive");
            setConfirmAction(null);
        } else if (confirmAction === "deactivate") {
            updateClassTemplate(id, { status: "Inactive" });
            showToast("Class template is now inactive", "The class template has been deactivate and is no longer in use.", "error", "slash");
            setConfirmAction(null);
        } else if (confirmAction === "recover") {
            updateClassTemplate(id, { status: "Active" });
            showToast("Class template is now recover", "The class template has been recover and now it can be use.", "success", "check");
            setConfirmAction(null);
        } else if (confirmAction === "reactivate") {
            updateClassTemplate(id, { status: "Active" });
            showToast("Class template is now active", "The class template has been reactivate and now it can be use.", "success", "check");
            setConfirmAction(null);
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={() => router.push(returnTo)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class template details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Two-column content — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={<LeftPanel template={template} hasData={hasData} onAction={handleAction} />}
                main={<RightPanel hasData={hasData} template={template} />}
            />

            {confirmAction && (() => {
                const cfg = MODAL_CONFIG[confirmAction];
                const tone = DESTRUCTIVE_ACTIONS.has(confirmAction) ? "danger" : "success";
                return (
                    <ConfirmModal
                        open
                        onClose={() => setConfirmAction(null)}
                        icon={cfg.IconComp}
                        tone={tone}
                        title={cfg.title}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={handleConfirm}
                    />
                );
            })()}
            <Toast />
        </div>
    );
}

export default function ClassTemplateDetailPage() {
    return (
        <Suspense fallback={null}>
            <ClassTemplateDetailPageInner />
        </Suspense>
    );
}
