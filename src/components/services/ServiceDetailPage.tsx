"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Service Detail (Module 13, Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the Class Template detail chrome (two-column body — info card on
// the left, tabbed table panel on the right) so the two surfaces stay
// visually consistent. Per the brief: "Mostly it same like class template
// details, you can check on it and make sure its good."
//
// LEFT  — info card (banner + name + service category / duration / location /
//         open sessions + Service actions footer)
// RIGHT — tabbed panel
//   • Appointments        (Figma 7423:120796) — table + filter side panel
//                          (Figma 7424:132998 — Status + date range + Day +
//                          Time). Phase 4 wires the row data from the future
//                          `appointments` slice; Phase 3 ships the table
//                          chrome + empty state so the slot is ready.
//   • Applicable membership (Figma 7422:129351) — live from `memberships`
//                          slice, filtered by the service's
//                          `applicableMembershipIds`. Row → /products/[id].
//   • Applicable package    (Figma 7423:28072) — live from `packages` slice,
//                          filtered by `applicablePackageIds`. Row →
//                          /products/[id].
//
// Service actions matrix (mirrors the standard Onra archive/delete rules):
//   • Active   → Edit · Archive · Deactivate / Delete (delete iff no
//                appointments yet — same gate as gift cards & class
//                templates).
//   • Inactive → Archive · Reactivate
//   • Archived → Recover
//
// Cross-module sync: every action writes through the store actions
// (`setServiceStatus`, `deleteService`), so the list page + future
// appointment surfaces stay in sync without a refresh. Persisted via the
// `onra-demo-state` blob — cross-tab propagation works automatically.

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01, RefreshCcw01, Trash01, Trash02,
    DotsVertical, SearchMd, FilterLines, Eye, Check,
    CreditCard01, Package, AlignLeft, ChevronLeft, Star01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { SortableHeader, useSort, type SortDir } from "@/components/ui/SortableHeader";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore, type Service, type ServiceStatus, type Appointment, type AppointmentStatus } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ServiceStatus }) {
    const styles: Record<ServiceStatus, string> = {
        Active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        Inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        Archived: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {status}
        </span>
    );
}

// ─── Generic table constants (verbatim from gift cards / class templates) ───

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";

// ─── Empty-state illustration ───────────────────────────────────────────────

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

function EmptyTablePane({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center gap-6 pointer-events-auto">
                <EmptyTableIllustration />
                <div className="flex flex-col items-center gap-1 text-center max-w-[320px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-[20px]">{subtitle}</p>
                </div>
            </div>
        </div>
    );
}

// ─── Left panel — info card + actions ───────────────────────────────────────

// Mirrors the class-template detail's ActionBtn 1:1 — same 16px semibold
// label + sage/error color + 20px icon — so the two surfaces feel
// identical and the actions don't look undersized.
function ActionBtn({ icon, label, danger, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void;
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

function LeftPanel({ service, hasAppointments, onAction }: {
    service: Service;
    hasAppointments: boolean;
    onAction: (kind: "edit" | "archive" | "deactivate" | "delete" | "reactivate" | "recover") => void;
}) {
    const { status, openSession, capacity, durationMin } = service;

    const actions = (() => {
        if (status === "Archived") {
            return (
                <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover service" onClick={() => onAction("recover")} />
            );
        }
        if (status === "Inactive") {
            return (
                <>
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive service" onClick={() => onAction("archive")} />
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Reactivate service" onClick={() => onAction("reactivate")} />
                </>
            );
        }
        // Active
        return (
            <>
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit service" onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive service" onClick={() => onAction("archive")} />
                {hasAppointments ? (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate service" danger onClick={() => onAction("deactivate")} />
                ) : (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete service" danger onClick={() => onAction("delete")} />
                )}
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div
                className="relative h-[200px] shrink-0 overflow-hidden"
                style={{ backgroundColor: service.coverColor || "#f1f2ed" }}
            >
                {service.coverImage && (
                    <img
                        src={service.coverImage}
                        alt={service.name}
                        className={cn("absolute inset-0 w-full h-full object-cover", status === "Inactive" && "grayscale")}
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge status={status} />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    {/* Name + description */}
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{service.name}</h2>
                        {service.description && (
                            <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-3">{service.description}</p>
                        )}
                    </div>

                    {/* Info fields */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Service category</p>
                            <p className="text-[16px] font-medium text-[#101828]">{service.category || "—"}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">{durationMin} minutes</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{service.branchName || "—"}</p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Open sessions</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {openSession ? `Yes${capacity > 0 ? ` · ${capacity} capacity` : ""}` : "No"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Service actions</p>
                    <div className="flex flex-col gap-4">
                        {actions}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Appointments filter panel (Figma 7424:132998) ──────────────────────────

const APPOINTMENT_STATUSES: AppointmentStatus[] = ["Upcoming", "Ongoing", "Completed", "Cancelled"];

type DayKey = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";
const DAYS: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type TimeKey = "Morning" | "Afternoon" | "Evening";
const TIMES: TimeKey[] = ["Morning", "Afternoon", "Evening"];

interface AppointmentFilter {
    statuses: AppointmentStatus[];
    startDate: string;
    endDate:   string;
    days: DayKey[];
    times: TimeKey[];
}
const EMPTY_FILTER: AppointmentFilter = { statuses: [], startDate: "", endDate: "", days: [], times: [] };

function FilterPill({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all whitespace-nowrap",
                selected
                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:bg-[#f9fafb]",
            )}
        >
            {label}
        </button>
    );
}

function AppointmentFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean;
    onClose: () => void;
    applied: AppointmentFilter;
    onApply: (next: AppointmentFilter) => void;
}) {
    const [pending, setPending] = useState<AppointmentFilter>(EMPTY_FILTER);

    useEffect(() => {
        if (open) setPending({
            statuses:  [...applied.statuses],
            startDate: applied.startDate,
            endDate:   applied.endDate,
            days:      [...applied.days],
            times:     [...applied.times],
        });
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggle<T extends string>(arr: T[], v: T): T[] {
        return arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v];
    }

    const hasSelection = pending.statuses.length > 0 || pending.startDate || pending.endDate ||
        pending.days.length > 0 || pending.times.length > 0;

    return (
        <SlidePanel open={open} onClose={onClose} width={400} zIndex={50}>
<div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Status</p>
                        <div className="flex flex-wrap gap-2">
                            {APPOINTMENT_STATUSES.map(s => (
                                <FilterPill
                                    key={s}
                                    label={s}
                                    selected={pending.statuses.includes(s)}
                                    onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Custom date range</p>
                        <div className="grid grid-cols-2 gap-2">
                            <DatePicker
                                value={pending.startDate}
                                onChange={v => setPending(p => ({
                                    ...p,
                                    startDate: v,
                                    // End date that now sits before the new start
                                    // is invalidated — admins shouldn't keep an
                                    // impossible range after editing the start.
                                    endDate: p.endDate && v && p.endDate < v ? "" : p.endDate,
                                }))}
                                placeholder="Start date"
                                maxDate={pending.endDate || undefined}
                            />
                            <DatePicker
                                value={pending.endDate}
                                onChange={v => setPending(p => ({ ...p, endDate: v }))}
                                placeholder="End date"
                                minDate={pending.startDate || undefined}
                            />
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Day of week</p>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map(d => (
                                <FilterPill
                                    key={d}
                                    label={d}
                                    selected={pending.days.includes(d)}
                                    onClick={() => setPending(p => ({ ...p, days: toggle(p.days, d) }))}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec] shrink-0" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Time of the day</p>
                        <div className="flex flex-wrap gap-2">
                            {TIMES.map(t => (
                                <FilterPill
                                    key={t}
                                    label={t}
                                    selected={pending.times.includes(t)}
                                    onClick={() => setPending(p => ({ ...p, times: toggle(p.times, t) }))}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        disabled={!hasSelection}
                        onClick={() => {
                            setPending(EMPTY_FILTER);
                            onApply(EMPTY_FILTER);
                            onClose();
                        }}
                    >
                        Clear filter
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        disabled={!hasSelection}
                        onClick={() => { onApply(pending); onClose(); }}
                    >
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}

// ─── Confirmation modal ─────────────────────────────────────────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const MODAL_CONFIG: Record<ModalAction, {
    iconBg: string; IconComp: React.ElementType; iconColor: string;
    title: string;
    description: (name: string) => React.ReactNode;
    confirmLabel: string;
    tone: "destructive" | "primary";
}> = {
    archive: {
        iconBg: "bg-[#e9fff3]", IconComp: Archive, iconColor: "text-[#658774]",
        title: "Archive this service?",
        description: name => <><span className="font-medium text-[#344054]">{name}</span> will be hidden from the default service list. You can recover archived services at any time.</>,
        confirmLabel: "Archive",
        tone: "primary",
    },
    deactivate: {
        iconBg: "bg-[#fee4e2]", IconComp: SlashCircle01, iconColor: "text-[#d92d20]",
        title: "Deactivate this service?",
        description: name => <><span className="font-medium text-[#344054]">{name}</span> will stop accepting new appointment bookings. Existing appointments are not cancelled.</>,
        confirmLabel: "Deactivate",
        tone: "destructive",
    },
    recover: {
        iconBg: "bg-[#e9fff3]", IconComp: RefreshCcw01, iconColor: "text-[#658774]",
        title: "Recover this service?",
        description: name => <><span className="font-medium text-[#344054]">{name}</span> will be restored to Active status and become bookable again.</>,
        confirmLabel: "Recover",
        tone: "primary",
    },
    reactivate: {
        iconBg: "bg-[#e9fff3]", IconComp: Check, iconColor: "text-[#658774]",
        title: "Reactivate this service?",
        description: name => <><span className="font-medium text-[#344054]">{name}</span> will become available for new appointments again.</>,
        confirmLabel: "Reactivate",
        tone: "primary",
    },
    delete: {
        iconBg: "bg-[#fee4e2]", IconComp: Trash02, iconColor: "text-[#d92d20]",
        title: "Delete this service?",
        description: name => <><span className="font-medium text-[#344054]">{name}</span> will be permanently removed. This action cannot be undone.</>,
        confirmLabel: "Delete",
        tone: "destructive",
    },
};

function ActionModal({ action, name, onConfirm, onCancel }: {
    action: ModalAction;
    name: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const cfg = MODAL_CONFIG[action];
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
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.title}</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">{cfg.description(name)}</p>
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

// ─── Pagination (gift-cards / templates twin) ───────────────────────────────

function Pagination({ page, totalPages, pageSize, onPageChange, onPageSizeChange }: {
    page: number; totalPages: number; pageSize: number;
    onPageChange: (p: number) => void; onPageSizeChange: (s: number) => void;
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
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSizeChange(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
                <button type="button" disabled={page <= 1} onClick={() => onPageChange(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── Applicable membership / package "View details" dropdown ────────────────

function ViewDetailsAction({ onView }: { onView: () => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="relative">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)}>
                <button type="button" onClick={() => { setOpen(false); onView(); }}
                    className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                    <Eye className="w-4 h-4 text-[#667085]" />View details
                </button>
            </FixedDropdown>
        </div>
    );
}

// ─── Appointment status badge ───────────────────────────────────────────────

function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
    // Matches `ClassStatusBadge` 1:1 — Upcoming gray, Ongoing blue,
    // Completed green, Cancelled red.
    const styles: Record<AppointmentStatus, string> = {
        Upcoming:  "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#344054]",
        Ongoing:   "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
        Completed: "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
        Cancelled: "bg-[#fef3f2] border-1 border-[#fecdca] text-[#b42318]",
    };
    return (
        <span className={cn(
            "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
            styles[status],
        )}>
            {status}
        </span>
    );
}

// ─── Attendance bar (used by appointment row) ───────────────────────────────

// ─── Rating cell ────────────────────────────────────────────────────────────
//
// Used by the Appointments table — 5-star row with aggregate score below.
// Mirrors the class-template Sessions table's `StarRating` cell so the two
// surfaces feel identical. Renders an empty 5-star row when the
// appointment has no ratings yet (Upcoming / Ongoing / Cancelled).

function RatingCell({ rating, count }: { rating: number; count: number }) {
    const filled = Math.round(rating);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex gap-0.5 items-center">
                {[0, 1, 2, 3, 4].map(i => (
                    <Star01 key={i}
                        className={cn("w-4 h-4", i < filled ? "text-[#fdb022]" : "text-[#e4e7ec]")}
                        fill={i < filled ? "#fdb022" : "none"} />
                ))}
            </div>
            <div className="flex gap-1 items-center">
                <p className="text-[13px] font-medium text-[#344054]">{rating > 0 ? rating.toFixed(1) : "0"}</p>
                <p className="text-[12px] text-[#667085]">({count} {count === 1 ? "rating" : "ratings"})</p>
            </div>
        </div>
    );
}

// Solid sage fill regardless of percentage — matches the schedule list-view
// `AttendanceBar` so class schedules + appointments read identically in
// every list surface.
function AttendanceBar({ booked, capacity }: { booked: number; capacity: number }) {
    const pct = capacity > 0 ? (booked / capacity) : 0;
    return (
        <div className="flex items-center gap-3">
            <div className="h-[4px] w-[80px] bg-[#e4e7ec] rounded-full overflow-hidden shrink-0">
                <div className="h-full rounded-full bg-[#658774]" style={{ width: `${pct * 100}%` }} />
            </div>
            <span className="text-[14px] text-[#344054] whitespace-nowrap">{booked}/{capacity}</span>
        </div>
    );
}

// ─── Appointment row actions (status-conditional) ───────────────────────────
//
// Per the brief:
//   • Upcoming / Ongoing → View details · Cancel appointment
//   • Completed / Cancelled → View details only

function AppointmentRowActions({ status, onView, onCancel }: {
    status: AppointmentStatus;
    onView: () => void;
    onCancel: () => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    function trigger(fn: () => void) { setOpen(false); fn(); }
    const canCancel = status === "Upcoming" || status === "Ongoing";

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
                {canCancel && (
                    <button type="button" onClick={() => trigger(onCancel)}
                        className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#b42318] hover:bg-[#fef3f2] transition-colors">
                        <SlashCircle01 className="w-4 h-4 text-[#b42318]" />Cancel appointment
                    </button>
                )}
            </FixedDropdown>
        </div>
    );
}

// ─── Appointment table (Figma 7423:120796) ──────────────────────────────────

function AppointmentsTable({ rows, sortKey, sortDir, onSort, onView, onCancel }: {
    rows: Appointment[];
    sortKey: string | null;
    sortDir: SortDir;
    onSort: (key: string) => void;
    onView: (row: Appointment) => void;
    onCancel: (row: Appointment) => void;
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[160px]")}>
                            <SortableHeader sortKey="date" currentSort={sortKey} dir={sortDir} onSort={onSort}>Date &amp; time</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[220px]")}>
                            <SortableHeader sortKey="service" currentSort={sortKey} dir={sortDir} onSort={onSort}>Service name</SortableHeader>
                        </th>
                        <th className={cn(TH, "w-[160px]")}>
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
                    {rows.map(a => (
                        <tr key={a.id}
                            onClick={() => onView(a)}
                            className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                            <td className={TD}>
                                <div className="text-[14px] font-medium text-[#101828]">{a.date}</div>
                                <div className="text-[13px] text-[#667085] mt-0.5">{a.displayTime}</div>
                            </td>
                            <td className={TD}>
                                <div className="flex items-center gap-3">
                                    {a.coverImage ? (
                                        <div className="relative shrink-0 size-9 rounded-full overflow-hidden bg-[#f2f4f7]">
                                            <img src={a.coverImage} alt={a.serviceName}
                                                className={cn("absolute inset-0 w-full h-full object-cover", a.status === "Cancelled" && "grayscale")}
                                                onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                                            />
                                            <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
                                        </div>
                                    ) : (
                                        <div className="size-9 rounded-full shrink-0 flex items-center justify-center text-[12px] font-semibold text-[#344054]"
                                            style={{ backgroundColor: a.coverColor || "#f1f2ed" }}>
                                            {(a.serviceName?.[0] ?? "S").toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-[14px] font-medium text-[#101828]">{a.serviceName}</div>
                                        {a.instructorName && (
                                            <div className="text-[13px] text-[#667085]">with {a.instructorName}</div>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className={TD}>{a.branchName}</td>
                            <td className={TD}><AttendanceBar booked={a.booked} capacity={a.capacity} /></td>
                            <td className={TD}><RatingCell rating={a.rating} count={a.ratingCount} /></td>
                            <td className={TD}><AppointmentStatusBadge status={a.status} /></td>
                            <td className={TD} onClick={e => e.stopPropagation()}>
                                <AppointmentRowActions
                                    status={a.status}
                                    onView={() => onView(a)}
                                    onCancel={() => onCancel(a)}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// ─── Cancel appointment modal ───────────────────────────────────────────────
//
// Mirrors `CancelClassModal` 1:1 — header + booked-count copy + locked-on
// "Refund class credit" toggle row + destructive confirm. No reason field
// (per the user feedback — class schedule's flow doesn't ask for one).

function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-disabled={disabled} disabled={disabled}
            onClick={() => !disabled && onChange(!on)}
            className={cn(
                "relative w-9 h-5 rounded-full p-0.5 flex items-center transition-colors shrink-0",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed",
            )}>
            <span className="w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

function CancelAppointmentModal({ appointment, onConfirm, onCancel }: {
    appointment: Appointment;
    onConfirm: (refund: boolean) => void;
    onCancel: () => void;
}) {
    const bookedCount = appointment.booked;
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <div className="w-12 h-12 rounded-full bg-[#fee4e2] flex items-center justify-center shrink-0">
                        <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Cancel this appointment?</h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{appointment.serviceName}</span> on {appointment.date} • {appointment.displayTime} will be cancelled.
                            {bookedCount > 0 && <> All <span className="font-medium text-[#344054]">{bookedCount} booked customer{bookedCount === 1 ? "" : "s"}</span> will be notified.</>}
                        </p>
                    </div>
                </div>
                {bookedCount > 0 && (
                    <>
                        <div className="h-5 shrink-0" />
                        <div className="h-px w-full bg-[#e4e7ec]" />
                        <div className="flex items-center justify-between gap-4 px-6 py-5">
                            <div className="flex flex-col gap-1 min-w-0">
                                <p className="text-[16px] font-medium text-[#101828]">Refund class credit</p>
                                <p className="text-[14px] text-[#475467] leading-[20px]">When the studio cancels an appointment, each customer is always refunded.</p>
                            </div>
                            {/* Locked ON — admin cancellation always refunds, same rule as class schedule. */}
                            <Toggle on={true} onChange={() => { /* locked */ }} disabled />
                        </div>
                    </>
                )}
                <div className={cn("flex gap-3 px-6 pb-6", bookedCount > 0 ? "pt-6" : "pt-5")}>
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={() => onConfirm(true)}>
                        Yes, cancel appointment
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Right panel — tabs ─────────────────────────────────────────────────────

type RightTab = "appointments" | "memberships" | "packages";
const TABS: { id: RightTab; label: string }[] = [
    { id: "appointments", label: "Appointments" },
    { id: "memberships",  label: "Applicable memberships" },
    { id: "packages",     label: "Applicable packages" },
];

function RightPanel({ service }: { service: Service }) {
    const router = useRouter();
    const pathname = usePathname();
    const [tab, setTab]                       = useState<RightTab>("appointments");
    const [search, setSearch]                 = useState("");
    const [page, setPage]                     = useState(1);
    const [pageSize, setPageSize]             = useState(10);
    const [filterOpen, setFilterOpen]         = useState(false);
    const [applied, setApplied]               = useState<AppointmentFilter>(EMPTY_FILTER);
    const [cancelTarget, setCancelTarget]     = useState<Appointment | null>(null);

    // Live store reads — when an admin deactivates / archives a product
    // from /admin/products, the row disappears from this tab on the same
    // render cycle. Same for appointments — cancel here / book on customer
    // side / mark attendance, the table updates instantly.
    const customers         = useAppStore(s => s.customers);
    const allMemberships    = useAppStore(s => s.memberships);
    const allPackages       = useAppStore(s => s.packages);
    const appointments      = useAppStore(s => s.appointments);
    const cancelAppointment = useAppStore(s => s.cancelAppointment);
    const showToast         = useAppStore(s => s.showToast);

    const activeByPlanName = useMemo(() => {
        const m = new Map<string, number>();
        for (const c of customers) {
            if (!c.planName) continue;
            m.set(c.planName, (m.get(c.planName) ?? 0) + 1);
        }
        return m;
    }, [customers]);

    const filteredMemberships = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allMemberships
            .filter(m => m.status === "active")
            .filter(m => service.applicableMembershipIds.includes(m.id))
            .filter(m => !q || m.name.toLowerCase().includes(q))
            .map(m => ({
                id: m.id,
                name: m.name,
                active: activeByPlanName.get(m.name) ?? 0,
            }));
    }, [allMemberships, service.applicableMembershipIds, search, activeByPlanName]);

    const filteredPackages = useMemo(() => {
        const q = search.trim().toLowerCase();
        return allPackages
            .filter(p => p.status === "active")
            .filter(p => service.applicablePackageIds.includes(p.id))
            .filter(p => !q || p.name.toLowerCase().includes(q))
            .map(p => ({
                id: p.id,
                name: p.name,
                active: activeByPlanName.get(p.name) ?? 0,
            }));
    }, [allPackages, service.applicablePackageIds, search, activeByPlanName]);

    type ListRow = { id: string; name: string; active: number };
    const listComparators: Record<string, (a: ListRow, b: ListRow) => number> = {
        name:   (a, b) => a.name.localeCompare(b.name),
        active: (a, b) => a.active - b.active,
    };
    const { sorted: sortedMemberships, sortKey: mSortKey, sortDir: mSortDir, toggle: toggleMSort } =
        useSort(filteredMemberships, listComparators);
    const { sorted: sortedPackages, sortKey: pSortKey, sortDir: pSortDir, toggle: togglePSort } =
        useSort(filteredPackages, listComparators);

    // ─── Appointments — live from store ────────────────────────────────────
    const DAY_OF_WEEK: DayKey[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const filteredAppointments = useMemo(() => {
        const q = search.trim().toLowerCase();
        return appointments
            .filter(a => a.serviceId === service.id)
            // Same render rule the schedule grid uses (admin + instructor):
            // an appointment slot only surfaces once a customer has booked
            // it. Cancelled appointments still surface so admins can see
            // what was cancelled — mirrors the schedule view's
            // `booked > 0 || status === "Cancelled"` filter.
            .filter(a => a.booked > 0 || a.status === "Cancelled")
            .filter(a => {
                if (applied.statuses.length && !applied.statuses.includes(a.status)) return false;
                if (applied.startDate && a.dateISO < applied.startDate) return false;
                if (applied.endDate   && a.dateISO > applied.endDate)   return false;
                if (applied.days.length) {
                    const dow = DAY_OF_WEEK[new Date(a.dateISO + "T00:00:00Z").getUTCDay()];
                    if (!applied.days.includes(dow)) return false;
                }
                if (applied.times.length) {
                    const h = parseInt(a.startTime.split(":")[0] ?? "0", 10);
                    const slot: TimeKey = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
                    if (!applied.times.includes(slot)) return false;
                }
                if (q && !`${a.serviceName} ${a.branchName} ${a.instructorName ?? ""}`.toLowerCase().includes(q)) return false;
                return true;
            });
    }, [appointments, service.id, search, applied]); // eslint-disable-line react-hooks/exhaustive-deps

    const STATUS_ORDER: Record<AppointmentStatus, number> = {
        Upcoming: 0, Ongoing: 1, Completed: 2, Cancelled: 3,
    };
    const appointmentComparators: Record<string, (a: Appointment, b: Appointment) => number> = {
        date:       (a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime),
        service:    (a, b) => a.serviceName.localeCompare(b.serviceName),
        location:   (a, b) => a.branchName.localeCompare(b.branchName),
        attendance: (a, b) => (a.capacity ? a.booked / a.capacity : 0) - (b.capacity ? b.booked / b.capacity : 0),
        rating:     (a, b) => a.rating - b.rating,
        status:     (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    };
    const { sorted: sortedAppointments, sortKey: aSortKey, sortDir: aSortDir, toggle: toggleASort } =
        useSort(filteredAppointments, appointmentComparators);

    const hasActiveAppointmentFilter =
        applied.statuses.length > 0 || applied.startDate || applied.endDate ||
        applied.days.length > 0 || applied.times.length > 0;

    const total =
        tab === "appointments" ? sortedAppointments.length :
        tab === "memberships"  ? sortedMemberships.length :
                                 sortedPackages.length;
    const totalPages  = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const sliceStart  = (clampedPage - 1) * pageSize;
    const sliceEnd    = sliceStart + pageSize;
    const pagedMemberships  = sortedMemberships.slice(sliceStart, sliceEnd);
    const pagedPackages     = sortedPackages.slice(sliceStart, sliceEnd);
    const pagedAppointments = sortedAppointments.slice(sliceStart, sliceEnd);

    function handleTab(t: RightTab) {
        setTab(t); setSearch(""); setPage(1); setApplied(EMPTY_FILTER);
    }

    const subjectLabel =
        tab === "appointments" ? (total === 1 ? "appointment" : "appointments") :
        tab === "memberships"  ? (total === 1 ? "membership"  : "memberships")  :
                                 (total === 1 ? "package"     : "packages");

    return (
        <>
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px] bg-white">
                {/* Tabs */}
                <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                    <div className="flex gap-1">
                        {TABS.map(t => (
                            <button key={t.id} type="button" onClick={() => handleTab(t.id)}
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
                        <p className="text-[14px] font-medium text-[#101828]">{total} {subjectLabel}</p>
                    </div>
                    <div className="relative w-[220px]">
                        <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                        <input type="text"
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            placeholder={tab === "appointments" ? "Search appointment..." : "Search..."}
                            className="h-9 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </div>
                    {tab === "appointments" && (
                        <Button variant="secondary-gray" size="md"
                            leftIcon={
                                <div className="relative">
                                    <FilterLines className="w-4 h-4" />
                                    {hasActiveAppointmentFilter && (
                                        <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                                    )}
                                </div>
                            }
                            onClick={() => setFilterOpen(true)}>
                            Filter
                        </Button>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                    {tab === "appointments" && (
                        pagedAppointments.length > 0 ? (
                            <div className="px-6">
                                <AppointmentsTable
                                    rows={pagedAppointments}
                                    sortKey={aSortKey}
                                    sortDir={aSortDir}
                                    onSort={toggleASort}
                                    onView={(a) => router.push(`/appointments/${a.id}?returnTo=${encodeURIComponent(pathname)}`)}
                                    onCancel={(a) => setCancelTarget(a)}
                                />
                            </div>
                        ) : (
                            <EmptyTablePane
                                // `hasAnyBooked` mirrors the post-filter
                                // contract — only appointments that have
                                // been booked (or were booked then
                                // cancelled) ever surface in the table.
                                title={appointments.some(a => a.serviceId === service.id && (a.booked > 0 || a.status === "Cancelled"))
                                    ? "No appointments found"
                                    : "No appointments yet"}
                                subtitle={appointments.some(a => a.serviceId === service.id && (a.booked > 0 || a.status === "Cancelled"))
                                    ? "Try adjusting your search or filters."
                                    : "Appointments booked for this service will appear here."}
                            />
                        )
                    )}

                    {/* Applicable memberships */}
                    {tab === "memberships" && (
                        pagedMemberships.length > 0 ? (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name" currentSort={mSortKey} dir={mSortDir} onSort={toggleMSort}>Name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={mSortKey} dir={mSortDir} onSort={toggleMSort} align="right">Active members</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedMemberships.map(m => (
                                            <tr key={m.id}
                                                onClick={() => router.push(`/products/${m.id}?returnTo=${encodeURIComponent(pathname)}`)}
                                                className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border-1 border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <CreditCard01 className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{m.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{m.active}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}><ViewDetailsAction onView={() => router.push(`/products/${m.id}?returnTo=${encodeURIComponent(pathname)}`)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyTablePane
                                title="No memberships applicable"
                                subtitle="No memberships are linked to this service yet."
                            />
                        )
                    )}

                    {/* Applicable packages */}
                    {tab === "packages" && (
                        pagedPackages.length > 0 ? (
                            <div className="px-6">
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className={TH}>
                                                <SortableHeader sortKey="name" currentSort={pSortKey} dir={pSortDir} onSort={togglePSort}>Name</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "text-right")}>
                                                <SortableHeader sortKey="active" currentSort={pSortKey} dir={pSortDir} onSort={togglePSort} align="right">Active packages</SortableHeader>
                                            </th>
                                            <th className={cn(TH, "w-[52px]")}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pagedPackages.map(p => (
                                            <tr key={p.id}
                                                onClick={() => router.push(`/products/${p.id}?returnTo=${encodeURIComponent(pathname)}`)}
                                                className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full border-1 border-gray-200 bg-[#f2f4f7] flex items-center justify-center shrink-0">
                                                            <Package className="w-4 h-4 text-[#667085]" />
                                                        </div>
                                                        <span className="font-medium text-[#101828]">{p.name}</span>
                                                    </div>
                                                </td>
                                                <td className={cn(TD, "text-right")}>{p.active || "—"}</td>
                                                <td className={TD} onClick={e => e.stopPropagation()}><ViewDetailsAction onView={() => router.push(`/products/${p.id}?returnTo=${encodeURIComponent(pathname)}`)} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <EmptyTablePane
                                title="No packages applicable"
                                subtitle="No packages are linked to this service yet."
                            />
                        )
                    )}
                </div>

                {/* Pagination — shown on every tab now that appointments has
                    live data. The visual treatment + per-page picker are the
                    same across tabs for muscle-memory consistency. */}
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

            <AppointmentFilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={applied}
                onApply={f => { setApplied(f); setPage(1); }}
            />

            {cancelTarget && (
                <CancelAppointmentModal
                    appointment={cancelTarget}
                    onCancel={() => setCancelTarget(null)}
                    onConfirm={(refund: boolean) => {
                        cancelAppointment(cancelTarget.id, refund);
                        showToast(
                            "Appointment cancelled",
                            `${cancelTarget.serviceName} on ${cancelTarget.date} has been cancelled${cancelTarget.booked > 0 ? ` and ${cancelTarget.booked} customer${cancelTarget.booked === 1 ? "" : "s"} notified` : ""}.`,
                            "error", "slash",
                        );
                        setCancelTarget(null);
                    }}
                />
            )}
        </>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export interface ServiceDetailPageProps {
    serviceId: string;
    returnTo?: string;
}

export function ServiceDetailPage({ serviceId, returnTo = "/admin/services" }: ServiceDetailPageProps) {
    const router = useRouter();
    const pathname = usePathname();

    const services         = useAppStore(s => s.services);
    const appointments     = useAppStore(s => s.appointments);
    const setServiceStatus = useAppStore(s => s.setServiceStatus);
    const deleteService    = useAppStore(s => s.deleteService);
    const showToast        = useAppStore(s => s.showToast);

    const service = services.find(s => s.id === serviceId);

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    if (!service) {
        return (
            <div className="h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-[18px] font-semibold text-[#101828]">Service not found</p>
                    <button type="button" onClick={() => router.push(returnTo)}
                        className="mt-4 text-[14px] text-[#658774] hover:underline">
                        Back to services
                    </button>
                </div>
            </div>
        );
    }

    // Derived live: a service has "history" the moment any appointment
    // exists for it. Drives the Delete-vs-Deactivate gate in LeftPanel.
    const hasAppointments = appointments.some(a => a.serviceId === serviceId);

    function handleAction(action: "edit" | ModalAction) {
        if (!service) return;
        if (action === "edit") {
            router.push(`/services/${service.id}/edit?returnTo=${encodeURIComponent(pathname)}`);
            return;
        }
        setConfirmAction(action);
    }

    function handleConfirm() {
        if (!confirmAction || !service) return;
        const name = service.name;

        if (confirmAction === "delete") {
            deleteService(service.id);
            showToast(
                "Service deleted",
                `${name} has been permanently removed.`,
                "success", "trash",
            );
            setConfirmAction(null);
            router.push(returnTo);
            return;
        }

        const nextStatus: ServiceStatus =
            confirmAction === "archive"    ? "Archived" :
            confirmAction === "deactivate" ? "Inactive" :
            /* reactivate | recover */       "Active";
        setServiceStatus(service.id, nextStatus);

        const titles: Record<Exclude<ModalAction, "delete">, string> = {
            archive:    "Service archived",
            deactivate: "Service deactivated",
            recover:    "Service recovered",
            reactivate: "Service reactivated",
        };
        const verbs: Record<Exclude<ModalAction, "delete">, string> = {
            archive:    "archived",
            deactivate: "deactivated",
            recover:    "recovered",
            reactivate: "reactivated",
        };
        const icon: "slash" | "archive" | "refresh" | "check" =
            confirmAction === "deactivate" ? "slash"   :
            confirmAction === "archive"    ? "archive" :
            confirmAction === "recover"    ? "refresh" :
            /* reactivate */                 "check";
        const tone: "success" | "error" = confirmAction === "deactivate" ? "error" : "success";

        showToast(titles[confirmAction], `${name} has been ${verbs[confirmAction]}.`, tone, icon);
        setConfirmAction(null);
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
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Service details</h1>
            </div>

            {/* Body — fills viewport, 2-column */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="flex gap-6 h-[832px]">
                    <LeftPanel service={service} hasAppointments={hasAppointments} onAction={handleAction} />
                    <RightPanel service={service} />
                </div>
            </div>

            {confirmAction && (
                <ActionModal
                    action={confirmAction}
                    name={service.name}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirmAction(null)}
                />
            )}
            <Toast />
        </div>
    );
}
