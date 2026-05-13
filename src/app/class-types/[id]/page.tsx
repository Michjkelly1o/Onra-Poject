"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01,
    RefreshCcw01, Trash01, Trash02, DotsVertical,
    SearchMd, FilterLines, ChevronDown, Eye, Check,
    CreditCard01, Package, Calendar, AlignLeft,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import type { ClassTemplate, TemplateStatus } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { TableAvatar } from "@/components/ui/avatar";

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

function TemplateBadge({ status }: { status: TemplateStatus }) {
    const styles: Record<TemplateStatus, string> = {
        Active: "bg-[#ecfdf3] border border-[#abefc6] text-[#067647]",
        Archived: "bg-[#f9fafb] border border-[#e4e7ec] text-[#344054]",
        Inactive: "bg-[#f9fafb] border border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium", styles[status])}>
            {status}
        </span>
    );
}

function SessionBadge({ status }: { status: SessionStatus }) {
    const styles: Record<SessionStatus, string> = {
        Upcoming: "bg-[#f9fafb] border border-[#e4e7ec] text-[#344054]",
        Ongoing: "bg-[#eff8ff] border border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border border-[#abefc6] text-[#067647]",
        Cancelled: "bg-[#fef3f2] border border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap", styles[status])}>
            {status}
        </span>
    );
}

function AttendanceBar({ booked, capacity }: { booked: number; capacity: number }) {
    const pct = capacity > 0 ? (booked / capacity) : 0;
    const barColor = pct >= 0.8 ? "#658774" : pct > 0 ? "#658774" : "#e4e7ec";
    return (
        <div className="flex items-center gap-3">
            <div className="h-[4px] w-[80px] bg-[#e4e7ec] rounded-full overflow-hidden shrink-0">
                <div className="h-full rounded-full bg-[#658774]" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[14px] text-[#344054] whitespace-nowrap">
                {booked}/{capacity}
            </span>
        </div>
    );
}

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

// ─── Row action dropdown (fixed-position to avoid overflow clipping) ──────────

function FixedDropdown({ triggerRef, open, onClose, children }: {
    triggerRef: React.RefObject<HTMLButtonElement>;
    open: boolean;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const [pos, setPos] = useState({ top: 0, right: 0 });
    const dropRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
        }
    }, [open, triggerRef]);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                onClose();
            }
        }
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open, onClose, triggerRef]);

    if (!open) return null;
    return (
        <div ref={dropRef} style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999 }}
            className="bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 min-w-[180px]">
            {children}
        </div>
    );
}

function RowActions({ status }: { status: SessionStatus }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const isEditable = status === "Upcoming" || status === "Ongoing";

    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                {isEditable ? (
                    <>
                        <button type="button" onClick={() => setOpen(false)}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            <Eye className="w-4 h-4 text-[#667085]" />View details
                        </button>
                        <button type="button" onClick={() => setOpen(false)}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            <Edit02 className="w-4 h-4 text-[#667085]" />Edit class
                        </button>
                        <button type="button" onClick={() => setOpen(false)}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                            <Trash01 className="w-4 h-4 text-[#b42318]" />Cancel class
                        </button>
                    </>
                ) : (
                    <button type="button" onClick={() => setOpen(false)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                        <Eye className="w-4 h-4 text-[#667085]" />View class details
                    </button>
                )}
            </FixedDropdown>
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
                                : "bg-[#c4edd6] text-[#0c2d34] hover:bg-[#aad4bd]",
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
                {template.coverImage && (
                    <img
                        src={template.coverImage}
                        alt={template.name}
                        className={cn("absolute inset-0 w-full h-full object-cover", status === "Inactive" && "grayscale")}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                )}
                {/* Status badge */}
                <div className="absolute top-3 right-3">
                    <TemplateBadge status={status} />
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

                    {/* Info fields */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class type</p>
                            <p className="text-[16px] font-medium text-[#101828]">{template.locationType} class</p>
                        </div>
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

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

function SessionsTable({ sessions, sortKey, sortDir, onSort }: {
    sessions: Session[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
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
                        <tr key={s.id} className="hover:bg-[#f9fafb] transition-colors">
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
                                <StarRating rating={s.rating} count={s.ratingCount} />
                            </td>
                            <td className={TD}>
                                <SessionBadge status={s.status} />
                            </td>
                            <td className={TD}>
                                <RowActions status={s.status} />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Membership / Package list data ──────────────────────────────────────────

const MEMBERSHIPS = [
    { id: "m1", name: "Beginner Monthly Membership",   active: 8,  enabled: true  },
    { id: "m2", name: "Advanced Monthly Membership",   active: 6,  enabled: true  },
    { id: "m3", name: "Unlimited Monthly Membership",  active: 4,  enabled: false },
];

const PACKAGES = [
    { id: "p1", name: "10 Class Package", active: 8,  enabled: true  },
    { id: "p2", name: "20 Class Package", active: 0,  enabled: false },
    { id: "p3", name: "30 Class Package", active: 4,  enabled: true  },
    { id: "p4", name: "40 Class Package", active: 4,  enabled: false },
];

// ─── Membership/Package filter dropdown ───────────────────────────────────────

type ItemFilter = "enabled" | "disabled" | null;

const ITEM_FILTER_OPTIONS: { value: ItemFilter; label: string }[] = [
    { value: null,       label: "All" },
    { value: "enabled",  label: "Only enabled" },
    { value: "disabled", label: "Only disabled" },
];

function ItemFilterDropdown({ active, onChange }: {
    active: ItemFilter;
    onChange: (f: ItemFilter) => void;
}) {
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
                leftIcon={
                    <div className="relative">
                        <FilterLines className="w-4 h-4" />
                        {active !== null && (
                            <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border border-white" />
                        )}
                    </div>
                }
                onClick={() => setOpen(p => !p)}>
                Filter
            </Button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
                    {ITEM_FILTER_OPTIONS.map(opt => (
                        <button key={String(opt.value)} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                active === opt.value
                                    ? "bg-[#f9fafb] text-[#101828]"
                                    : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

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

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium border transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}>
            {label}
        </button>
    );
}

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

    if (!open) return null;

    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny = pending.statuses.length > 0 || !!pending.startDate || !!pending.endDate || pending.days.length > 0 || pending.times.length > 0;

    return (
        <div className="fixed inset-0 z-[200] flex justify-end">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative w-[400px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col">
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
                            <div className="relative flex-1">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                                <input type="date" value={pending.startDate}
                                    onChange={e => setPending(p => ({ ...p, startDate: e.target.value }))}
                                    className="h-10 w-full pl-9 pr-3 border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                            </div>
                            <div className="relative flex-1">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                                <input type="date" value={pending.endDate}
                                    onChange={e => setPending(p => ({ ...p, endDate: e.target.value }))}
                                    className="h-10 w-full pl-9 pr-3 border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#344054] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]" />
                            </div>
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
            </div>
        </div>
    );
}

// ─── Action modal (Figma-designed per action) ─────────────────────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    title: string; description: string;
    confirmLabel: string; confirmClass: string;
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        title: "Archive this class template?",
        description: "Are you sure you want to archive this class template? This will archive all of class template access.",
        confirmLabel: "Archive",
        confirmClass: "bg-[#c4edd6] text-[#101828] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        title: "Deactivate this class template?",
        description: "Are you sure you want to deactivate this class template? This will deactivate access to all classes associated with it.",
        confirmLabel: "Deactivate",
        confirmClass: "bg-[#d92d20] text-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318]",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        title: "Recover this class template?",
        description: "Are you sure you want to recover this class template from archive? This will enable all of class template access.",
        confirmLabel: "Recover",
        confirmClass: "bg-[#c4edd6] text-[#101828] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        title: "Reactivate this class template?",
        description: "Are you sure you want to reactivate this class template? This will restore access to all classes associated with it.",
        confirmLabel: "Reactivate",
        confirmClass: "bg-[#c4edd6] text-[#101828] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        title: "Delete this class template?",
        description: "Are you sure you want to delete this class template? This action cannot be undone.",
        confirmLabel: "Delete",
        confirmClass: "bg-[#d92d20] text-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#b42318]",
    },
};

function ActionModal({ action, onConfirm, onCancel }: {
    action: ModalAction; onConfirm: () => void; onCancel: () => void;
}) {
    const cfg = MODAL_CONFIG[action];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* X close */}
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>

                {/* Header */}
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className={cn("w-12 h-12 rounded-full flex items-center justify-center", cfg.iconBg)}>
                        <cfg.IconComp className={cn("w-6 h-6", cfg.iconColor)} />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description}</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <button type="button" onClick={onCancel}
                        className="flex-1 py-[10px] border border-[#d0d5dd] rounded-[8px] text-[16px] font-semibold text-[#344054] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors">
                        Cancel
                    </button>
                    <button type="button" onClick={onConfirm}
                        className={cn("flex-1 py-[10px] rounded-[8px] text-[16px] font-semibold transition-colors", cfg.confirmClass)}>
                        {cfg.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Generic row action "View details" ────────────────────────────────────────

function ViewDetailsAction() {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                <button type="button" onClick={() => setOpen(false)}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View details
                </button>
            </FixedDropdown>
        </div>
    );
}

// ─── Pagination component ─────────────────────────────────────────────────────

function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: {
    page: number;
    totalPages: number;
    pageSize: number;
    onPageChange: (p: number) => void;
    onPageSizeChange: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            {/* Left: per-page dropdown */}
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}
                    <ChevronDown className="w-4 h-4 text-[#667085]" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button"
                                onClick={() => { onPageSizeChange(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                                    s === pageSize ? "text-[#101828] font-semibold bg-[#f9fafb]" : "text-[#344054]")}>
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>

            {/* Right: Page info + Previous + Next */}
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">
                    Page {page} of {totalPages}
                </span>
                <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>
                    Previous
                </button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>
                    Next
                </button>
            </div>
        </div>
    );
}

// ─── Right panel ──────────────────────────────────────────────────────────────

type RightTab = "classes" | "memberships" | "packages";

const TABS: { id: RightTab; label: string }[] = [
    { id: "classes", label: "Classes" },
    { id: "memberships", label: "Applicable memberships" },
    { id: "packages", label: "Applicable packages" },
];

function RightPanel({ hasData, template }: { hasData: boolean; template: ClassTemplate }) {
    const [tab, setTab] = useState<RightTab>("classes");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filterOpen, setFilterOpen] = useState(false);
    const [appliedFilter, setAppliedFilter] = useState<ClassFilter>(EMPTY_FILTER);
    const [membershipFilter, setMembershipFilter] = useState<ItemFilter>(null);
    const [packageFilter, setPackageFilter] = useState<ItemFilter>(null);

    // Sessions for this template are derived live from the shared store — when a
    // class is added/cancelled/edited in the schedule module, it reflects here too.
    const classInstances = useAppStore(s => s.classInstances);
    const allSessions: Session[] = classInstances
        .filter(ci => ci.templateId === template.id)
        .map(instanceToSession);

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

    const applicable = template.applicableMemberships;

    const filteredMemberships = MEMBERSHIPS
        .filter(m => applicable.includes(m.id))
        .filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
        .filter(m => {
            if (membershipFilter === null) return true;
            if (membershipFilter === "enabled") return m.enabled;
            return !m.enabled;
        });

    const filteredPackages = PACKAGES
        .filter(p => applicable.includes(p.id))
        .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
        .filter(p => {
            if (packageFilter === null) return true;
            if (packageFilter === "enabled") return p.enabled;
            return !p.enabled;
        });

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
        status: (a, b) => Number(a.enabled) - Number(b.enabled),
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
        setMembershipFilter(null);
        setPackageFilter(null);
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
                    {tab === "memberships" && (
                        <ItemFilterDropdown active={membershipFilter} onChange={v => { setMembershipFilter(v); setPage(1); }} />
                    )}
                    {tab === "packages" && (
                        <ItemFilterDropdown active={packageFilter} onChange={v => { setPackageFilter(v); setPage(1); }} />
                    )}
                </div>

                {/* Table content — relative so empty states can use absolute centering */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {tab === "classes" && (
                        hasData && filteredSessions.length > 0 ? (
                            <div className="px-6">
                                <SessionsTable sessions={paginatedSessions} sortKey={sessionSortKeyState} sortDir={sessionSortDir} onSort={toggleSessionSort} />
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
                                            <th className={TH}>
                                                <SortableHeader sortKey="status" currentSort={membershipSortKey} dir={membershipSortDir} onSort={toggleMembershipSort}>Status</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={membershipSortKey} dir={membershipSortDir} onSort={toggleMembershipSort} align="right">Active members</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedMemberships.map(m => (
                                            <tr key={m.id} className="hover:bg-[#f9fafb] transition-colors">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <CreditCard01 className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{m.name}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                                                        m.enabled
                                                            ? "bg-[#ecfdf3] border border-[#abefc6] text-[#067647]"
                                                            : "bg-[#f9fafb] border border-[#e4e7ec] text-[#667085]")}>
                                                        {m.enabled ? "Enabled" : "Disabled"}
                                                    </span>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{m.active}</td>
                                                <td className={TD}><ViewDetailsAction /></td>
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
                                            <th className={TH}>
                                                <SortableHeader sortKey="status" currentSort={packageSortKey} dir={packageSortDir} onSort={togglePackageSort}>Status</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={packageSortKey} dir={packageSortDir} onSort={togglePackageSort} align="right">Active packages</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPackages.map(p => (
                                            <tr key={p.id} className="hover:bg-[#f9fafb] transition-colors">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn("inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                                                        p.enabled
                                                            ? "bg-[#ecfdf3] border border-[#abefc6] text-[#067647]"
                                                            : "bg-[#f9fafb] border border-[#e4e7ec] text-[#667085]")}>
                                                        {p.enabled ? "Enabled" : "Disabled"}
                                                    </span>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{p.active || "—"}</td>
                                                <td className={TD}><ViewDetailsAction /></td>
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
                        totalPages={totalPages}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={s => { setPageSize(s); setPage(1); }}
                    />
                </div>
            </div>

            <ClassFilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={appliedFilter}
                onApply={f => { setAppliedFilter(f); setPage(1); }}
            />
        </>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ClassTemplateDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { classTemplates, updateClassTemplate, deleteClassTemplate, showToast } = useAppStore();

    const template = classTemplates.find(t => t.id === id);

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    if (!template) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Template not found</p>
                    <button type="button" onClick={() => router.push("/admin/class-types")}
                        className="mt-4 text-[14px] text-[#658774] hover:underline">
                        Back to class templates
                    </button>
                </div>
            </div>
        );
    }

    // Mock templates ("1"-"6") have session history; newly created templates ("t-…") start empty
    const hasData = !id.startsWith("t-");

    function handleAction(action: "edit" | ModalAction) {
        if (action === "edit") {
            router.push(`/class-types/${id}/edit`);
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
            router.push("/admin/class-types");
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
                    onClick={() => router.push("/admin/class-types")}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class template details</h1>
            </div>

            {/* Two-column content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <LeftPanel template={template} hasData={hasData} onAction={handleAction} />
                    <RightPanel hasData={hasData} template={template} />
                </div>
            </div>

            {confirmAction && (
                <ActionModal
                    action={confirmAction}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <Toast />
        </div>
    );
}
