"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Module 13 — Attendee list (`/attendee`) — CARD GRID (Figma 7962:40140)
// ─────────────────────────────────────────────────────────────────────────────
//
// The attendance console. Rebuilt to match the Figma "Calendar - This Week"
// design: a white rounded panel with a studio-logo header + branch dropdown,
// a Day/Week toggle, a centred date navigator, a week-day strip (Week view),
// and a responsive GRID of class cards (cover image + overlaid name/status,
// duration/spots/instructor/room, and a "View details" button).
//
// Only Ongoing + Upcoming classes surface — never Past — derived live from the
// device clock (`liveScheduleStatus` at store boot). Reached from the
// "Attendee" button in the Schedule header. Top-level route → bare root layout,
// so the page builds its own back affordance above the panel.

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, ChevronLeft, ChevronRight, ChevronDown, MarkerPin01, AlignLeft,
    Users01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sliders } from "@/components/icons/Sliders";
import { genderAccessIcon } from "@/components/ui/gender-icons";
import { FilterPill } from "@/components/ui/FilterPill";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedTabs } from "@/components/patterns/SegmentedTabs";
import { AttendeeTopBar } from "@/components/attendee/AttendeeTopBar";
import { AttendeeDetailPanel } from "@/components/attendee/AttendeeDetailPanel";
import { isAttendeeOngoing } from "@/components/attendee/attendee-status";
import {
    INSTRUCTORS, isoAddDays, isoToDisplay, isoToMonday, formatWeekRange, TODAY_ISO, DAY_VIEW_DATE,
} from "@/components/schedule/ScheduleGridViews";
import {
    useAppStore,
    type ClassInstance, type ClassStatus, type SessionType,
} from "@/lib/store";

// ─── Small date helpers (timezone-stable, parse ISO parts directly) ────────────

/** "10:00" → "10:00 AM". Graceful passthrough for odd inputs. */
function to12h(time: string): string {
    if (!time || !time.includes(":")) return time || "";
    const [h, m] = time.split(":").map(Number);
    const mer = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m ?? 0).padStart(2, "0")} ${mer}`;
}

// Week-range label reuses the Schedule module's `formatWeekRange` (imported
// above) so the Attendee date navigator reads identically to Schedule's.

// ─── Filter state (mirrors the Schedule FilterPanel shape) ─────────────────────

type FilterState = {
    types: SessionType[];
    statuses: ClassStatus[];
    timeOfDay: string[];
    instructors: string[];
    categories: string[];
};
const EMPTY_FILTER: FilterState = { types: [], statuses: [], timeOfDay: [], instructors: [], categories: [] };
// Attendee only ever lists Ongoing + Upcoming, so the Status filter offers
// exactly those two (Past is excluded by definition — §7.1 of the PRD).
const ALL_STATUSES: ClassStatus[] = ["Upcoming", "Ongoing"];


// ─── Attendee class card — horizontal row (Figma 8069:25666), stacked as a
//     vertical list. ──────────────────────────────────────────────────────────

function AttendeeClassCard({ ci, onView }: { ci: ClassInstance; onView: () => void }) {
    const duration = (() => {
        const [sh, sm] = ci.startTime.split(":").map(Number);
        const [eh, em] = ci.endTime.split(":").map(Number);
        const mins = (eh * 60 + em) - (sh * 60 + sm);
        // Guard sessions that cross midnight so the duration never goes negative.
        return mins < 0 ? mins + 1440 : mins;
    })();
    // Attendee-only: a class reads "Ongoing" 30 min before start (client 2026-08-04).
    const ongoing = isAttendeeOngoing(ci.status, ci.dateISO, ci.startTime);
    // Gender-access label + icon for the meta row.
    const genderLabel = ci.genderAccess === "male" ? "Male only" : ci.genderAccess === "female" ? "Female only" : "All gender";

    return (
        // The whole row opens the class detail; the inner "View details" button
        // repeats the action but stops propagation so it isn't double-handled.
        <div
            role="button"
            tabIndex={0}
            onClick={onView}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(); } }}
            className="group flex items-center gap-6 p-5 bg-white border border-[var(--colors-border-secondary)] rounded-[20px] cursor-pointer transition-shadow hover:shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.10),0px_2px_4px_-2px_rgba(16,24,40,0.06)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--colors-secondary-300)]"
        >
            {/* Time block */}
            <div className="flex flex-col gap-1 shrink-0 whitespace-nowrap">
                <p className="text-[16px] font-semibold leading-6 text-[var(--colors-text-primary)]">{to12h(ci.startTime)}</p>
                <p className="text-[14px] font-medium leading-5 text-[var(--colors-text-quaternary)]">{duration} minutes</p>
            </div>

            {/* Circular class image */}
            <div className="relative w-[88px] h-[88px] rounded-full overflow-hidden shrink-0" style={{ backgroundColor: ci.coverColor }}>
                {ci.coverImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ci.coverImage} alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <p className="text-[16px] font-semibold leading-6 text-[var(--colors-text-primary)] truncate">{ci.name}</p>
                        <span className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border-1 shrink-0",
                            ongoing ? "bg-[#eff8ff] border-[#b2ddff] text-[#175cd3]" : "bg-[var(--colors-bg-secondary)] border-[var(--colors-border-secondary)] text-[var(--colors-text-tertiary)]",
                        )}>
                            {ongoing ? "Ongoing" : "Upcoming"}
                        </span>
                    </div>
                    {/* Instructor — avatar + name */}
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                            style={{ backgroundColor: ci.instructorColor }}>
                            {ci.instructorInitials}
                        </span>
                        <span className="text-[14px] leading-5 text-[var(--colors-text-secondary)] truncate">{ci.instructorName || "Open session"}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap text-[14px]">
                    <span className="flex items-center gap-2 text-[var(--colors-text-tertiary)] shrink-0">
                        <Users01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        {ci.booked}/{ci.capacity} spots
                    </span>
                    <span className="w-px h-4 bg-[var(--colors-bg-quaternary)] shrink-0" />
                    <span className="flex items-center gap-2 text-[var(--colors-text-tertiary)] min-w-0">
                        <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <span className="truncate">{ci.room || ci.location}</span>
                    </span>
                    <span className="w-px h-4 bg-[var(--colors-bg-quaternary)] shrink-0" />
                    <span className="flex items-center gap-2 text-[var(--colors-text-tertiary)] shrink-0">
                        {genderAccessIcon(genderLabel, "w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0")}
                        {genderLabel}
                    </span>
                </div>
            </div>

            {/* View details */}
            <Button variant="secondary-gray" size="lg" className="shrink-0 w-[200px] rounded-full text-[16px]"
                onClick={(e) => { e.stopPropagation(); onView(); }}>
                View details
            </Button>
        </div>
    );
}

// ─── Branch dropdown pill (Figma header — pin + branch + chevron) ──────────────

function BranchDropdown({ value, options, onChange }: {
    value: string;
    options: { value: string; label: string }[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const selected = options.find(o => o.value === value);
    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-2 rounded-full border border-[var(--colors-border-primary)] bg-white pl-3 pr-2.5 py-2 text-left transition-colors hover:bg-[var(--colors-bg-secondary)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
            >
                <MarkerPin01 className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
                <span className="text-[14px] font-medium text-[var(--colors-text-secondary)] whitespace-nowrap">{selected?.label ?? "Select branch"}</span>
                <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+6px)] right-0 min-w-[220px] bg-white border border-[var(--colors-border-secondary)] rounded-[10px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1">
                    {options.map(o => (
                        <button
                            key={o.value || "all"}
                            type="button"
                            onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn(
                                "flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium text-left transition-colors",
                                o.value === value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                            )}
                        >
                            <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Filter dropdown (instructor picker — from the Schedule FilterPanel) ────────

function FilterDropdown({ label, value, options, onChange }: {
    label: string; value: string;
    options: { value: string; label: string; initials?: string; color?: string }[];
    onChange: (v: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const selected = options.find(o => o.value === value);
    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="w-full h-10 flex items-center gap-2 px-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[14px] font-medium text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                {selected?.initials && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                        style={{ backgroundColor: selected.color }}>
                        {selected.initials}
                    </div>
                )}
                <span className="flex-1 text-left truncate text-[var(--colors-text-secondary)]">{selected?.label ?? label}</span>
                <ChevronDown className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[200px] overflow-y-auto">
                    <button type="button" onClick={() => { onChange(""); setOpen(false); }}
                        className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            !value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
                        {label}
                    </button>
                    {options.map(o => (
                        <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
                            className={cn("flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                value === o.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]")}>
                            {o.initials && (
                                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                                    style={{ backgroundColor: o.color }}>
                                    {o.initials}
                                </div>
                            )}
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Filter panel — Schedule's `FilterPanel`, statuses trimmed to live-only ────

function FilterPanel({ open, onClose, applied, onApply, categories }: {
    open: boolean;
    onClose: () => void;
    applied: FilterState;
    onApply: (f: FilterState) => void;
    categories: string[];
}) {
    const [pending, setPending] = useState<FilterState>(EMPTY_FILTER);
    useEffect(() => { if (open) setPending({ ...applied }); }, [open]); // eslint-disable-line
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]; }

    const hasAny = pending.types.length > 0 || pending.statuses.length > 0 ||
        pending.timeOfDay.length > 0 || pending.instructors.length > 0 || pending.categories.length > 0;

    const instructorOptions = INSTRUCTORS.map(i => ({ value: i.id, label: i.name, initials: i.initials, color: i.color }));

    const Divider = () => <div className="h-px w-full bg-[var(--colors-bg-quaternary)] shrink-0" />;
    const SectionLabel = ({ label }: { label: string }) => (
        <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</p>
    );

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
            <div className="flex items-center px-6 border-b border-[var(--colors-border-secondary)] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[var(--colors-text-primary)]">Filter</p>
                <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                {/* Type filter removed — the attendee console is classes-only
                    (client 2026-08-04), so a Class/Private/Recovery filter is moot. */}

                {/* Status — live-only (Upcoming / Ongoing). */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Status" />
                    <div className="flex flex-wrap gap-2">
                        {ALL_STATUSES.map(s => (
                            <FilterPill key={s} label={s} selected={pending.statuses.includes(s)}
                                onClick={() => setPending(p => ({ ...p, statuses: toggle(p.statuses, s) }))} />
                        ))}
                    </div>
                </div>
                <Divider />

                {/* Time of the day */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Time of the day" />
                    <div className="flex gap-2">
                        {["Morning", "Afternoon", "Evening"].map(t => (
                            <FilterPill key={t} label={t} selected={pending.timeOfDay.includes(t)}
                                onClick={() => setPending(p => ({ ...p, timeOfDay: toggle(p.timeOfDay, t) }))} />
                        ))}
                    </div>
                </div>
                <Divider />

                {/* Instructor */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Instructor" />
                    <FilterDropdown label="All instructors" value={pending.instructors[0] ?? ""} options={instructorOptions}
                        onChange={v => setPending(p => ({ ...p, instructors: v ? [v] : [] }))} />
                </div>
                <Divider />

                {/* Categories */}
                <div className="flex flex-col gap-2">
                    <SectionLabel label="Categories" />
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <FilterPill key={c} label={c} selected={pending.categories.includes(c)}
                                onClick={() => setPending(p => ({ ...p, categories: toggle(p.categories, c) }))} />
                        ))}
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between gap-3">
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

// ── Cross-navigation UI cache ────────────────────────────────────────────────
// Persists the toolbar/view state (filter, location, view tab) across a
// detail round-trip. The day/week date cursors are DELIBERATELY excluded — the
// Attendee module always reopens on the current week + today (client
// 2026-07-28), so the date resets on every mount instead of restoring the
// previous scroll position. Reset the rest only on an explicit filter Clear.
type AttendeeView = "day" | "week";
const attendeeUi: {
    applied: FilterState;
    location: string;
    activeView: AttendeeView;
} = {
    applied: EMPTY_FILTER,
    location: "",
    activeView: "day",
};

export default function AttendeePageRoute() {
    return <Suspense fallback={null}><AttendeePage /></Suspense>;
}

function AttendeePage() {
    const router = useRouter();
    const classSchedules = useAppStore(s => s.classSchedules);
    const classCategories = useAppStore(s => s.classCategories);
    const branches = useAppStore(s => s.branches);
    const businessProfile = useAppStore(s => s.businessProfile);
    const brandingSettings = useAppStore(s => s.brandingSettings);

    const activeBranches = useMemo(
        () => branches.filter(b => b.status === "active"),
        [branches],
    );
    const studioName = brandingSettings.displayName || businessProfile.name || "Forma Studio";
    const studioLogo = brandingSettings.logoUrl || businessProfile.logoUrl;

    const [activeView, setActiveView] = useState<AttendeeView>(attendeeUi.activeView);
    const [applied, setApplied] = useState<FilterState>(attendeeUi.applied);
    // Default to the first active branch so the header reads a real location
    // (Figma "Forma Studio (South)"). Attendee is always single-branch — there
    // is no "All locations" option; only real branches are selectable.
    const [location, setLocation] = useState<string>(attendeeUi.location || activeBranches[0]?.id || "");
    const [filterOpen, setFilterOpen] = useState(false);
    // Always open on today / the current week — never restored from the cache
    // (client 2026-07-28). Each remount (incl. navigating back from a detail)
    // re-runs these initializers, so the date + week strip reset every time.
    const [dayDateISO, setDayDateISO] = useState(DAY_VIEW_DATE);
    const [weekSelectedISO, setWeekSelectedISO] = useState(TODAY_ISO);
    const weekStart = isoToMonday(weekSelectedISO);

    // ── Week strip horizontal paging — reuses the customer DateStrip interaction ──
    // The strip renders one full-width page per week (the same Mon–Sun admin box
    // UI). Scrolling/swiping snaps one week at a time and syncs the selected week
    // + the range button; the ‹ › nav + the range button scroll the strip to the
    // matching week. Both states always move together.
    const weekStripRef = useRef<HTMLDivElement>(null);
    const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
    // Anchor at the CURRENT week's Monday — the strip only pages FORWARD from
    // today, exactly like the customer class-search DateStrip. Past weeks are
    // unreachable and past days are disabled; Attendee only surfaces schedules
    // from the current week onward (client 2026-07-28).
    const todayMonday = isoToMonday(TODAY_ISO);
    const weekAnchorMonday = todayMonday;
    const selectedWeekIdx = Math.max(0, Math.floor(daysBetween(weekAnchorMonday, weekStart) / 7));
    const weekPageCount = Math.max(5, selectedWeekIdx + 2);
    const weekdayOffset = Math.max(0, Math.min(6, daysBetween(weekStart, weekSelectedISO)));
    // Backward nav is clamped at the boundary — ‹ is disabled at today / the
    // current week so you can't page into the past.
    const atFirstDay = dayDateISO <= TODAY_ISO;
    const atFirstWeek = weekStart <= todayMonday;

    // Scroll the selected week into view when it changes via the ‹ › nav / range
    // button (mirrors DateStrip's selected-week scroll effect).
    useEffect(() => {
        if (activeView !== "week") return;
        const el = weekStripRef.current;
        if (!el) return;
        const page = el.querySelector<HTMLElement>(`[data-week="${selectedWeekIdx}"]`);
        if (page) el.scrollTo({ left: page.offsetLeft, behavior: "smooth" });
    }, [selectedWeekIdx, activeView]);

    // Debounced scroll handler — when the user swipes to a different week page,
    // move the selected day (same weekday) into that week so the range button
    // stays in sync.
    const weekScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    function handleWeekScroll() {
        const el = weekStripRef.current;
        if (!el) return;
        if (weekScrollTimer.current) clearTimeout(weekScrollTimer.current);
        weekScrollTimer.current = setTimeout(() => {
            const w = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
            const next = isoAddDays(weekAnchorMonday, w * 7 + weekdayOffset);
            if (isoToMonday(next) !== weekStart) setWeekSelectedISO(next);
        }, 120);
    }

    useEffect(() => {
        attendeeUi.applied = applied;
        attendeeUi.location = location;
        attendeeUi.activeView = activeView;
    }, [applied, location, activeView]);

    // ── Class feed — CLASSES ONLY (client 2026-08-04 — Private & Recovery are
    //    no longer surfaced in the attendee console), then live-only filter. ──

    const categoryNames = useMemo(
        () => classCategories.map(c => c.name).sort((a, b) => a.localeCompare(b)),
        [classCategories],
    );

    // Attendee always operates within ONE branch — no "All locations" option.
    // Only real active branches are selectable; the selection defaults to the
    // first active branch (set in the `location` state initializer below).
    const locationOptions = useMemo(
        () => activeBranches.map(b => ({ value: b.id, label: b.name })),
        [activeBranches],
    );

    const hasActiveFilter = applied.types.length > 0 || applied.statuses.length > 0 ||
        applied.timeOfDay.length > 0 || applied.instructors.length > 0 || applied.categories.length > 0;

    // Apply location / filter / search, then narrow to Ongoing + Upcoming ONLY —
    // never Past. Status is already device-live (`liveScheduleStatus` at boot).
    const filteredClasses = useMemo(() => {
        return classSchedules.filter(c => {
            if (location && c.branchId !== location) return false;
            if (applied.types.length > 0 && !applied.types.includes(c.type)) return false;
            if (applied.statuses.length > 0 && !applied.statuses.includes(c.status)) return false;
            if (applied.instructors.length > 0 && !applied.instructors.includes(c.instructorId)) return false;
            if (applied.categories.length > 0 && !applied.categories.includes(c.category)) return false;
            if (applied.timeOfDay.length > 0) {
                const [h] = c.startTime.split(":").map(Number);
                const slot = h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening";
                if (!applied.timeOfDay.includes(slot)) return false;
            }
            // Live-only surface — the single job of Attendee.
            return c.status === "Ongoing" || c.status === "Upcoming";
        });
    }, [classSchedules, location, applied]);

    // The Attendee module is TODAY-ONLY (client 2026-07-31) — no Day/Week toggle,
    // no date navigator. Always shows today's on-and-upcoming classes.
    const selectedDayISO = TODAY_ISO;
    const dayClasses = useMemo(
        () => filteredClasses
            .filter(c => c.dateISO === selectedDayISO)
            .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        [filteredClasses, selectedDayISO],
    );
    const schedulesCount = dayClasses.length;
    // Group by attendee status (client 2026-08-04): Ongoing first (incl. classes
    // starting within 30 min), then Upcoming. Each renders as a vertical list.
    const ongoingClasses  = useMemo(() => dayClasses.filter(c => isAttendeeOngoing(c.status, c.dateISO, c.startTime)), [dayClasses]);
    const upcomingClasses = useMemo(() => dayClasses.filter(c => !isAttendeeOngoing(c.status, c.dateISO, c.startTime)), [dayClasses]);
    // Section-header date label, e.g. "Friday, 26 Feb 2026".
    const todayLabel = new Date(`${TODAY_ISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "short", year: "numeric",
    });

    // Class-details slide panel state. `detailId` is kept even after the panel
    // closes so its content stays mounted through the slide-out animation.
    const [detailId, setDetailId] = useState<string | null>(null);
    const [detailOpen, setDetailOpen] = useState(false);

    function handleView(cls: ClassInstance) {
        // Opens the class roster as a right slide panel (no navigation). The
        // console is classes-only now, so only class ids flow here. `detailId`
        // persists through the panel's slide-out so content stays mounted.
        setDetailId(cls.id);
        setDetailOpen(true);
    }

    // Backward nav is clamped to today / the current week.
    function prevDay() { setDayDateISO(d => { const n = isoAddDays(d, -1); return n < TODAY_ISO ? d : n; }); }
    function nextDay() { setDayDateISO(d => isoAddDays(d, 1)); }
    function prevWeek() { setWeekSelectedISO(d => { const n = isoAddDays(d, -7); return isoToMonday(n) < todayMonday ? d : n; }); }
    function nextWeek() { setWeekSelectedISO(d => isoAddDays(d, 7)); }

    // Centred date navigator — reuses the Schedule module's `DateNav`/`NavBtn`
    // markup verbatim (soft `bg-surface-secondary` chevron squares + a pill
    // label) so the Attendee navigator reads 1:1 with Schedule. Day → a single
    // date via `isoToDisplay`; Week → a range via `formatWeekRange`.
    const DateNav = ({ children }: { children: React.ReactNode }) => (
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center rounded-[8px] gap-1">
            {children}
        </div>
    );
    const NavBtn = ({ onClick, children, label, disabled }: { onClick?: () => void; children: React.ReactNode; label?: string; disabled?: boolean }) => (
        <button type="button" onClick={onClick} aria-label={label} disabled={disabled}
            className="w-8 bg-surface-secondary h-8 flex items-center justify-center rounded-[8px] transition-colors enabled:hover:bg-[var(--colors-bg-quaternary)] disabled:opacity-40 disabled:cursor-not-allowed">
            {children}
        </button>
    );

    return (
        // Plain neutral page bg (the green/tertiary wrapper was removed) — the
        // white panel sits directly on it. `min-h-screen` + a `flex-1 min-h-0`
        // panel + `flex-1 min-h-0` inner card make the surface fill the viewport
        // height instead of hugging content.
        <div className="h-screen bg-[var(--colors-tertiary-50)] p-[12px] flex flex-col overflow-hidden">
            {/* Admin-standard white panel — ONE container (bg-white + border +
                rounded), identical to every other admin surface. The header is
                pinned at the top of the panel; only the calendar content below
                scrolls. No nested inner card (client 2026-07-27). */}
            <div className="bg-white border border-[#dcded5] rounded-[20px] h-full flex flex-col overflow-hidden">
                <AttendeeTopBar>
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="w-6 h-7 flex items-center justify-center shrink-0">
                                    {studioLogo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={studioLogo} alt="" className="w-6 h-6 object-contain" />
                                    ) : (
                                        <svg width="24" height="24" viewBox="0 0 24 29" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M8.22876 2.39999C6.87492 2.39999 5.57658 2.9378 4.61929 3.89509L0 8.51435V10.6287C0 12.1226 0.641664 13.4665 1.66441 14.4C0.641664 15.3335 0 16.6774 0 18.1712V20.2856L4.61929 24.9049C5.57658 25.8622 6.87492 26.4 8.22876 26.4C9.72258 26.4 11.0665 25.7584 12 24.7356C12.9335 25.7584 14.2774 26.4 15.7712 26.4C17.1251 26.4 18.4234 25.8622 19.3807 24.9049L24 20.2856V18.1712C24 16.6774 23.3584 15.3335 22.3356 14.4C23.3584 13.4665 24 12.1226 24 10.6287V8.51435L19.3807 3.89509C18.4234 2.9378 17.1251 2.39999 15.7712 2.39999C14.2774 2.39999 12.9335 3.04166 12 4.0644C11.0665 3.04166 9.72258 2.39999 8.22876 2.39999ZM15.4553 14.4C15.3977 14.3475 15.3413 14.2935 15.286 14.2382L12 10.9523L8.71404 14.2382C8.65872 14.2935 8.60226 14.3475 8.54472 14.4C8.60226 14.4525 8.65872 14.5064 8.71404 14.5617L12 17.8477L15.286 14.5617C15.3413 14.5064 15.3977 14.4525 15.4553 14.4ZM13.3333 20.2856V21.2954C13.3333 22.6418 14.4248 23.7334 15.7712 23.7334C16.4178 23.7334 17.0379 23.4765 17.4951 23.0193L21.3334 19.181V18.1712C21.3334 16.8248 20.2418 15.7333 18.8954 15.7333C18.2489 15.7333 17.6288 15.9902 17.1716 16.4474L13.3333 20.2856ZM10.6667 20.2856L6.82842 16.4474C6.37122 15.9902 5.75114 15.7333 5.10457 15.7333C3.75815 15.7333 2.66666 16.8248 2.66666 18.1712V19.181L6.5049 23.0193C6.9621 23.4765 7.5822 23.7334 8.22876 23.7334C9.57516 23.7334 10.6667 22.6418 10.6667 21.2954V20.2856ZM10.6667 7.50457V8.51435L6.82842 12.3526C6.37122 12.8098 5.75114 13.0667 5.10457 13.0667C3.75815 13.0667 2.66666 11.9751 2.66666 10.6287V9.61895L6.5049 5.7807C6.9621 5.32351 7.5822 5.06666 8.22876 5.06666C9.57516 5.06666 10.6667 6.15815 10.6667 7.50457ZM17.1716 12.3526L13.3333 8.51435V7.50457C13.3333 6.15815 14.4248 5.06666 15.7712 5.06666C16.4178 5.06666 17.0379 5.32351 17.4951 5.7807L21.3334 9.61895V10.6287C21.3334 11.9751 20.2418 13.0667 18.8954 13.0667C18.2489 13.0667 17.6288 12.8098 17.1716 12.3526Z" fill="#0C2D34" />
                                        </svg>
                                    )}
                                </span>
                                <p className="text-[24px] font-bold leading-[28px] text-[var(--colors-brand-900)] truncate">{studioName}</p>
                            </div>
                        </div>
                        <BranchDropdown value={location} options={locationOptions} onChange={setLocation} />
                    </AttendeeTopBar>

                    {/* Calendar content — fills remaining panel height; the card
                        grid scrolls inside. No bordered inner card. */}
                    <div className="flex-1 min-h-0 px-6 pb-6 flex flex-col gap-6">
                            {/* Controls row */}
                            <div className="flex flex-col gap-4 shrink-0">
                                <div className="relative flex items-center justify-between gap-4">
                                    {/* Today section header — date + upcoming-class count.
                                        Today-only view: no Day/Week toggle, no date navigator. */}
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <p className="text-[18px] font-semibold text-[var(--colors-text-primary)] leading-[28px] truncate">{todayLabel}</p>
                                        <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px]">
                                            {schedulesCount} class{schedulesCount === 1 ? "" : "es"} today
                                        </p>
                                    </div>
                                    {/* Search removed (client 2026-08-04) — the attendee
                                        console is a live-only, today-only surface. */}
                                </div>

                            </div>

                            {/* Card grid — scrolls within the fixed-height card. */}
                            {dayClasses.length === 0 ? (
                                <div className="relative flex-1 min-h-[420px]">
                                    <EmptyState
                                        icon={AlignLeft}
                                        title="No classes to attend"
                                        subtitle="Nothing is on or upcoming for this day."
                                    />
                                </div>
                            ) : (
                                // Vertical stacked list, grouped Ongoing → Upcoming.
                                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-6">
                                    {ongoingClasses.length > 0 && (
                                        <section className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-4">
                                                {ongoingClasses.map(ci => (
                                                    <AttendeeClassCard key={ci.id} ci={ci} onView={() => handleView(ci)} />
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                    {upcomingClasses.length > 0 && (
                                        <section className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-4">
                                                {upcomingClasses.map(ci => (
                                                    <AttendeeClassCard key={ci.id} ci={ci} onView={() => handleView(ci)} />
                                                ))}
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

            {/* Class details — a wide right slide panel (replaces the old full-page
                detail). Opens on "View details"; closing keeps you on the calendar. */}
            {detailId && (
                <AttendeeDetailPanel
                    open={detailOpen}
                    classId={detailId}
                    onClose={() => setDetailOpen(false)}
                />
            )}
        </div>
    );
}
