"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff form (Add new staff / Edit staff details)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by 2 routes (root-level full-page):
//   • /staff/members/new           → mode = "create"
//   • /staff/members/[id]/edit     → mode = "edit"
//
// Figma:
//   • 6236-395236 — Add new staff
//
// Single-step form with image upload, name pair, email, temp password,
// phone (country-code picker reused from CustomerFormPage), role dropdown
// (create only — edit mode hides it because the dedicated Change role modal
// owns role mutation), default pay rate dropdown.
// On create, status is forced to "pending" + inviteSentAt stamped.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose, User01, Upload01, MarkerPin01, Lightbulb02,
    Mail01, Phone, UserSquare, CoinsHand, Calendar, Lock01,
    Check, ChevronDown, SearchMd, Plus,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { PanelStepper } from "@/components/ui/PanelStepper";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";
import {
    useAppStore,
    type Staff, type StaffStatus, type Shift, type StaffPayConfig, type ClassCategory,
} from "@/lib/store";
import { isValidEmail } from "@/lib/validation";
import { FieldLabel } from "@/components/patterns/FieldLabel";
import { daysIntersect, timeRangesOverlap } from "@/lib/staff/shift-conflict";

// ─── Form value ────────────────────────────────────────────────────────────

interface FormValue {
    firstName: string;
    lastName: string;
    email: string;
    tempPassword: string;
    phone: string;                              // bare national number (digits only)
    phoneCountry: PhoneCountry;
    imageUrl?: string;
    roleId: string;
    /** The branch this person works at. Chosen at assignment time — roles are
     *  branch-agnostic, so branch lives on the person, not the role. Empty
     *  string = not yet picked (or "All locations" for an Owner-type role). */
    branchId: string;
    /** Canonical default-pay-rate id — kept mirrored to
     *  `payConfig.default.payRateId` so the preview + save path stay in step. */
    payRateId: string;
    /** Multi-track pay configuration (step 2). Instructors get all three
     *  tracks; other roles use Default only (always enabled). */
    payConfig: StaffPayConfig;
    // ── Instructor-only (Figma 7471:170327) ─────────────────────────────────
    /** Short introduction paragraph — drives the customer-facing instructor
     *  card + the Personal information section on the staff detail page. */
    shortIntro: string;
    /** Years of experience as a single integer; "" until typed. */
    workingExperienceYears: string;
    /** Assigned shift ids (optional). A staff member can hold multiple
     *  shifts. Empty = no shift assigned yet. Filtered by the person's
     *  branch; overlapping shifts can't be co-selected (client 2026-07-24). */
    shiftIds: string[];
    /** Categories the instructor is qualified to teach. Drives the
     *  cross-module instructor gating — class template / schedule /
     *  service / appointment dropdowns disable instructors who don't
     *  hold the picked category. */
    categoryIds: string[];
}

function emptyForm(): FormValue {
    return {
        firstName: "", lastName: "", email: "", tempPassword: "",
        phone: "", phoneCountry: PHONE_COUNTRIES[0],
        imageUrl: undefined,
        roleId: "", branchId: "", payRateId: "",
        payConfig: {
            default: { enabled: true, payRateId: "" },
            perClass: { enabled: false },
            perAppointment: { enabled: false },
        },
        shortIntro: "", workingExperienceYears: "",
        shiftIds: [], categoryIds: [],
    };
}

function formFromStaff(s: Staff, assignedShiftIds: string[]): FormValue {
    const split = splitPhone(s.phone);
    return {
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        tempPassword: s.tempPassword ?? "",
        phone: split.number,
        phoneCountry: split.country,
        imageUrl: s.imageUrl,
        roleId: s.roleId,
        branchId: s.branchId ?? "",
        payRateId: s.payRateId ?? "",
        payConfig: s.payConfig ?? {
            default: { enabled: true, payRateId: s.payRateId ?? "" },
            perClass: { enabled: false },
            perAppointment: { enabled: false },
        },
        shortIntro: s.shortIntro ?? "",
        workingExperienceYears: s.workingExperienceYears != null ? String(s.workingExperienceYears) : "",
        shiftIds: assignedShiftIds,
        categoryIds: s.categoryIds ?? [],
    };
}

// ─── Phone helpers (reused pattern from CustomerFormPage) ──────────────────

type PhoneCountry = { code: string; dial: string; name: string; flag: string };

const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: "AE", dial: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
    { code: "SA", dial: "+966", name: "Saudi Arabia",          flag: "🇸🇦" },
    { code: "QA", dial: "+974", name: "Qatar",                  flag: "🇶🇦" },
    { code: "KW", dial: "+965", name: "Kuwait",                 flag: "🇰🇼" },
    { code: "OM", dial: "+968", name: "Oman",                   flag: "🇴🇲" },
    { code: "BH", dial: "+973", name: "Bahrain",                flag: "🇧🇭" },
    { code: "EG", dial: "+20",  name: "Egypt",                  flag: "🇪🇬" },
    { code: "JO", dial: "+962", name: "Jordan",                 flag: "🇯🇴" },
    { code: "LB", dial: "+961", name: "Lebanon",                flag: "🇱🇧" },
    { code: "US", dial: "+1",   name: "United States",          flag: "🇺🇸" },
    { code: "CA", dial: "+1",   name: "Canada",                 flag: "🇨🇦" },
    { code: "GB", dial: "+44",  name: "United Kingdom",         flag: "🇬🇧" },
    { code: "DE", dial: "+49",  name: "Germany",                flag: "🇩🇪" },
    { code: "FR", dial: "+33",  name: "France",                 flag: "🇫🇷" },
    { code: "ES", dial: "+34",  name: "Spain",                  flag: "🇪🇸" },
    { code: "IT", dial: "+39",  name: "Italy",                  flag: "🇮🇹" },
    { code: "NL", dial: "+31",  name: "Netherlands",            flag: "🇳🇱" },
    { code: "AU", dial: "+61",  name: "Australia",              flag: "🇦🇺" },
    { code: "NZ", dial: "+64",  name: "New Zealand",            flag: "🇳🇿" },
    { code: "IN", dial: "+91",  name: "India",                  flag: "🇮🇳" },
    { code: "PK", dial: "+92",  name: "Pakistan",               flag: "🇵🇰" },
    { code: "BD", dial: "+880", name: "Bangladesh",             flag: "🇧🇩" },
    { code: "ID", dial: "+62",  name: "Indonesia",              flag: "🇮🇩" },
    { code: "MY", dial: "+60",  name: "Malaysia",               flag: "🇲🇾" },
    { code: "SG", dial: "+65",  name: "Singapore",              flag: "🇸🇬" },
    { code: "PH", dial: "+63",  name: "Philippines",            flag: "🇵🇭" },
    { code: "TH", dial: "+66",  name: "Thailand",               flag: "🇹🇭" },
    { code: "VN", dial: "+84",  name: "Vietnam",                flag: "🇻🇳" },
    { code: "JP", dial: "+81",  name: "Japan",                  flag: "🇯🇵" },
    { code: "KR", dial: "+82",  name: "South Korea",            flag: "🇰🇷" },
    { code: "CN", dial: "+86",  name: "China",                  flag: "🇨🇳" },
    { code: "HK", dial: "+852", name: "Hong Kong",              flag: "🇭🇰" },
    { code: "TW", dial: "+886", name: "Taiwan",                 flag: "🇹🇼" },
    { code: "ZA", dial: "+27",  name: "South Africa",           flag: "🇿🇦" },
    { code: "NG", dial: "+234", name: "Nigeria",                flag: "🇳🇬" },
    { code: "KE", dial: "+254", name: "Kenya",                  flag: "🇰🇪" },
    { code: "TR", dial: "+90",  name: "Turkey",                 flag: "🇹🇷" },
    { code: "MX", dial: "+52",  name: "Mexico",                 flag: "🇲🇽" },
    { code: "BR", dial: "+55",  name: "Brazil",                 flag: "🇧🇷" },
];

function splitPhone(stored?: string): { country: PhoneCountry; number: string } {
    if (!stored) return { country: PHONE_COUNTRIES[0], number: "" };
    const byLongestDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const match = byLongestDial.find(c => stored.startsWith(c.dial));
    if (!match) return { country: PHONE_COUNTRIES[0], number: stored.replace(/\D/g, "") };
    return { country: match, number: stored.slice(match.dial.length).replace(/\D/g, "") };
}

function PhoneCountryDropdown({ value, onChange }: { value: PhoneCountry; onChange: (c: PhoneCountry) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const filtered = !search ? PHONE_COUNTRIES : PHONE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
        || c.dial.includes(search)
        || c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="h-10 flex items-center gap-1.5 px-[14px] border-r border-[#d0d5dd] text-[16px] text-[#101828] hover:bg-[#f9fafb] transition-colors">
                <span className="text-[16px]">{value.flag}</span>
                {value.dial}
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-[280px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] overflow-hidden flex flex-col max-h-[320px]">
                    <div className="p-2 border-b border-[#e4e7ec]">
                        <div className="relative">
                            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search country or code"
                                className="w-full h-9 pl-9 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                        {filtered.map(c => (
                            <button key={c.code} type="button"
                                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f9fafb] text-left">
                                <span className="text-[16px]">{c.flag}</span>
                                <span className="flex-1 text-[14px] text-[#344054] truncate">{c.name}</span>
                                <span className="text-[13px] text-[#667085]">{c.dial}</span>
                                {c.code === value.code && <Check className="w-4 h-4 text-[#658774]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Initials helper ───────────────────────────────────────────────────────

function initialsOf(first: string, last: string): string {
    const a = first.trim().charAt(0).toUpperCase();
    const b = last.trim().charAt(0).toUpperCase();
    return (a + b) || "?";
}

// All staff avatars render with the same neutral chrome — matching the role
// avatar (gray-100 bg + dark initials). Tied to the same `#f2f4f7` token
// consumers store in the `color` field so list rendering stays consistent.
const NEUTRAL_AVATAR_BG = "#f2f4f7";

// ─── Form atoms ────────────────────────────────────────────────────────────

// ─── Multi-select dropdown — used by the Categories field ──────────────────
//
// Behaviour mirrors `SelectInput` chrome (left chevron, focus ring, sage
// hover) but the trigger renders SELECTED ITEMS AS PILLS instead of one
// label, and the panel rows are checkable. Closes on outside click + Esc.

function MultiCategoryDropdown({ options, selectedIds, onChange, onCreateCategory }: {
    options: { id: string; name: string }[];
    selectedIds: string[];
    onChange: (next: string[]) => void;
    /** Client 2026-07-31 — opens the parent's "+ Create class category"
     *  modal. A button at the TOP of the open dropdown fires this so
     *  admins can add a missing category directly from the staff form
     *  without leaving the flow. */
    onCreateCategory?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({ position: "fixed", visibility: "hidden" });
    const ref = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function clickAway(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        function escape(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("mousedown", clickAway);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", clickAway);
            document.removeEventListener("keydown", escape);
        };
    }, []);

    // Position the menu with `position: fixed` computed from the trigger
    // rect so it escapes the staff form's scrollable panel overflow
    // (client 2026-07-31 clip fix). Without this the multi-select popup
    // clipped at the panel's overflow boundary when opened near the
    // bottom of a long form.
    useLayoutEffect(() => {
        if (!open || !ref.current) return;
        const r = ref.current.getBoundingClientRect();
        const headerExtra = onCreateCategory ? 44 : 0;
        const optionListH = Math.min(260, Math.max(1, options.length) * 40 + 12);
        const menuH = optionListH + headerExtra;
        const spaceBelow = window.innerHeight - r.bottom;
        const flipUp = spaceBelow < menuH + 8 && r.top > menuH + 8;
        setMenuStyle({
            position: "fixed",
            left: r.left,
            width: r.width,
            zIndex: 9999,
            maxHeight: Math.max(120, (flipUp ? r.top : spaceBelow) - 12),
            ...(flipUp ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
        });
    }, [open, options.length, onCreateCategory]);
    // Fixed box can't track its trigger through page scrolls — close it
    // on any scroll originating OUTSIDE the menu.
    useEffect(() => {
        if (!open) return;
        function onScroll(e: Event) {
            const target = e.target as Node | null;
            if (menuRef.current && target && menuRef.current.contains(target)) return;
            setOpen(false);
        }
        window.addEventListener("scroll", onScroll, true);
        return () => window.removeEventListener("scroll", onScroll, true);
    }, [open]);

    function toggle(id: string) {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    }
    function remove(id: string) { onChange(selectedIds.filter(x => x !== id)); }

    const selectedOptions = selectedIds
        .map(id => options.find(o => o.id === id))
        .filter((o): o is { id: string; name: string } => !!o);

    return (
        <div ref={ref} className="relative w-full">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn(
                    "flex items-center gap-2 w-full min-h-[40px] px-[14px] py-[6px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all",
                    open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#aad4bd]",
                )}>
                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {selectedOptions.length === 0 ? (
                        <span className="text-[14px] text-[#667085]">Select categories</span>
                    ) : (
                        selectedOptions.map(o => (
                            <span key={o.id}
                                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-[2px] rounded-full text-[13px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]">
                                {o.name}
                                <span role="button" tabIndex={0} aria-label={`Remove ${o.name}`}
                                    onClick={e => { e.stopPropagation(); remove(o.id); }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); remove(o.id); } }}
                                    className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#475467] hover:bg-[#f2f4f7] transition-colors text-[16px] leading-none cursor-pointer">×</span>
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
                <div ref={menuRef} style={menuStyle}
                    className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                    {/* Client 2026-07-31 — "+ Create class category" is
                        always the first row so admins can add a missing
                        category without leaving the staff form. Mirrors
                        the same top-of-dropdown pattern used on retail-
                        product forms + schedule / service / class-type
                        creation flows. */}
                    {onCreateCategory && (
                        <button
                            type="button"
                            onClick={() => { setOpen(false); onCreateCategory(); }}
                            className="shrink-0 flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#658774] hover:bg-[#f9fafb] transition-colors text-left"
                        >
                            <Plus className="w-4 h-4" />
                            Create class category
                        </button>
                    )}
                    <div className="py-1.5 overflow-y-auto flex-1">
                        {options.length === 0 ? (
                            <p className="px-4 py-3 text-[14px] text-[#667085]">No categories available.</p>
                        ) : (
                            options.map(opt => {
                                const selected = selectedIds.includes(opt.id);
                                return (
                                    <button key={opt.id} type="button" onClick={() => toggle(opt.id)}
                                        className="flex items-center gap-3 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors text-left">
                                        <span className={cn(
                                            "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                            selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                                        )}>
                                            {selected && <Check className="w-3 h-3 text-white" />}
                                        </span>
                                        {opt.name}
                                    </button>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Shift format helpers ──────────────────────────────────────────────────

/** "07:00" → "07:00 AM"; "12:00" → "12:00 PM". */
function to12h(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h < 12 ? "AM" : "PM";
    const hr = h % 12 === 0 ? 12 : h % 12;
    return `${String(hr).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

/** 7-bit [Sun..Sat] mask → "Mon - Sat" / "Mon, Wed, Fri" / "Every day". */
function shiftDaysLabel(days: boolean[]): string {
    const NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const on = days.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
    if (on.length === 0) return "No days";
    if (on.length === 7) return "Every day";
    const contiguous = on.length === on[on.length - 1] - on[0] + 1;
    if (contiguous && on.length >= 3) return `${NAMES[on[0]]} - ${NAMES[on[on.length - 1]]}`;
    return on.map(i => NAMES[i]).join(", ");
}

// ─── Multi-select dropdown — Assign shift ──────────────────────────────────
//
// Mirrors `MultiCategoryDropdown`'s chrome (pill trigger, checkable panel,
// closes on outside click + Esc) so the design stays consistent with the
// Categories field. Adds shift-specific behaviour:
//   • each row shows a "Mon - Sat • 07:00 AM - 12:00 PM" subtitle;
//   • a shift that overlaps an ALREADY-SELECTED shift (shared weekday +
//     clashing clock time) is disabled and shows an "Overlap with another
//     shift" amber badge — a staff member can hold multiple shifts, but
//     never two that collide (client 2026-07-24).

function MultiShiftDropdown({ options, selectedIds, onChange, disabled, emptyLabel }: {
    options: Shift[];
    selectedIds: string[];
    onChange: (next: string[]) => void;
    /** When true the trigger is inert (e.g. no branch picked yet). */
    disabled?: boolean;
    /** Panel message when there are no options. */
    emptyLabel?: string;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function clickAway(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        function escape(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
        document.addEventListener("mousedown", clickAway);
        document.addEventListener("keydown", escape);
        return () => {
            document.removeEventListener("mousedown", clickAway);
            document.removeEventListener("keydown", escape);
        };
    }, []);

    const byId = useMemo(() => new Map(options.map(o => [o.id, o] as const)), [options]);

    /** True when `shift` clashes on a shared weekday + time with any shift
     *  already selected (excluding itself). */
    function overlapsSelection(shift: Shift): boolean {
        return selectedIds.some(id => {
            if (id === shift.id) return false;
            const other = byId.get(id);
            return !!other
                && daysIntersect(shift.working_days, other.working_days)
                && timeRangesOverlap(shift.start_time, shift.end_time, other.start_time, other.end_time);
        });
    }

    function toggle(id: string) {
        onChange(selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);
    }
    function remove(id: string) { onChange(selectedIds.filter(x => x !== id)); }

    const selectedOptions = selectedIds
        .map(id => byId.get(id))
        .filter((o): o is Shift => !!o);

    return (
        <div ref={ref} className="relative w-full">
            <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(p => !p)}
                className={cn(
                    "flex items-center gap-2 w-full min-h-[40px] px-[14px] py-[6px] border-1 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-all",
                    disabled
                        ? "bg-[#f9fafb] border-[#e4e7ec] cursor-not-allowed"
                        : open
                            ? "bg-white border-[#7ba08c] ring-2 ring-[#aad4bd]"
                            : "bg-white border-[#d0d5dd] hover:border-[#aad4bd]",
                )}>
                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                    {selectedOptions.length === 0 ? (
                        <span className="text-[14px] text-[#667085]">
                            {disabled ? "Select a branch first" : "No shift assigned"}
                        </span>
                    ) : (
                        selectedOptions.map(o => (
                            <span key={o.id}
                                className="inline-flex items-center gap-1.5 pl-2 pr-1 py-[2px] rounded-full text-[13px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]">
                                {o.name}
                                <span role="button" tabIndex={0} aria-label={`Remove ${o.name}`}
                                    onClick={e => { e.stopPropagation(); remove(o.id); }}
                                    onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); remove(o.id); } }}
                                    className="w-4 h-4 inline-flex items-center justify-center rounded-full text-[#98a2b3] hover:text-[#475467] hover:bg-[#f2f4f7] transition-colors text-[16px] leading-none cursor-pointer">×</span>
                            </span>
                        ))
                    )}
                </div>
                <ChevronDown className={cn("w-4 h-4 text-[#667085] shrink-0 transition-transform", open && "rotate-180")} />
            </button>
            {open && !disabled && (
                <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 max-h-[300px] overflow-y-auto">
                    {options.length === 0 ? (
                        <p className="px-4 py-3 text-[14px] text-[#667085]">{emptyLabel ?? "No shifts available."}</p>
                    ) : (
                        options.map(opt => {
                            const selected = selectedIds.includes(opt.id);
                            const overlap = !selected && overlapsSelection(opt);
                            return (
                                <button key={opt.id} type="button"
                                    disabled={overlap}
                                    onClick={() => !overlap && toggle(opt.id)}
                                    className={cn(
                                        "flex items-center gap-3 w-full px-4 py-[10px] text-left transition-colors",
                                        overlap ? "cursor-not-allowed opacity-60" : "hover:bg-[#f9fafb]",
                                    )}>
                                    <span className={cn(
                                        "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors mt-[2px]",
                                        selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                                    )}>
                                        {selected && <Check className="w-3 h-3 text-white" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block text-[14px] font-medium text-[#344054]">{opt.name}</span>
                                        <span className="block text-[13px] text-[#667085]">
                                            {shiftDaysLabel(opt.working_days)} • {to12h(opt.start_time)} - {to12h(opt.end_time)}
                                        </span>
                                    </span>
                                    {overlap && (
                                        <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-medium bg-[#fffaeb] border-1 border-[#fedf89] text-[#b54708] whitespace-nowrap">
                                            Overlap with another shift
                                        </span>
                                    )}
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// Local FieldLabel removed — uses canonical `<FieldLabel label="..." />`
// from `@/components/patterns/FieldLabel`.

function TextInput({ value, onChange, placeholder, type = "text" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
        />
    );
}

// ─── Image upload ──────────────────────────────────────────────────────────

function ImageUpload({ value, initials, onChange }: {
    value?: string; initials: string; onChange: (url?: string) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    function pick() { ref.current?.click(); }
    function onFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        onChange(url);
    }
    return (
        <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 border-1 border-[#e4e7ec]"
                style={{ backgroundColor: NEUTRAL_AVATAR_BG }}>
                {value
                    ? <img src={value} alt="" className="w-full h-full object-cover" />
                    : initials === "?"
                        ? <User01 className="w-10 h-10 text-[#475467]" />
                        : <span className="font-semibold text-[24px] text-[#475467]">{initials}</span>
                }
            </div>
            <Button variant="secondary-gray" size="md"
                leftIcon={<Upload01 className="w-4 h-4" />}
                onClick={pick}>
                Upload image
            </Button>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
    );
}

// ─── Preview card (right rail) — Figma 6236-395270 ─────────────────────────
//
// Avatar top-left (NOT centered), name + email below, then a left-aligned
// list of metadata rows with icons. Phone-bullets render the temp password
// as masked dots — never the plain text.

function StaffPreview({ form, roleName, payRateName, branchLabel, joinedLabel }: {
    form: FormValue; roleName: string; payRateName: string; branchLabel: string; joinedLabel: string;
}) {
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const initials = initialsOf(form.firstName, form.lastName);
    const passwordMask = form.tempPassword ? "•".repeat(Math.min(12, form.tempPassword.length)) : "";
    const phoneDisplay = form.phone.trim() ? `${form.phoneCountry.dial} ${form.phone.trim()}` : "Phone number";
    return (
        <div className="w-[400px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shrink-0">
            <div className="p-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">User preview</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">This is how user overview will look like.</p>
            </div>
            <div className="bg-[#f6f6f3] flex flex-col gap-5 p-6 w-full">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4">
                    {/* Avatar top-left — same chrome as the role preview. */}
                    <div className="w-[80px] h-[80px] rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0 overflow-hidden">
                        {form.imageUrl
                            ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                            : initials === "?"
                                ? <User01 className="w-9 h-9 text-[#475467]" />
                                : <span className="font-semibold text-[28px] text-[#475467]">{initials}</span>
                        }
                    </div>

                    <div className="flex flex-col gap-1">
                        <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                            {fullName || "User name"}
                        </p>
                        <p className="text-[14px] text-[#667085]">{form.email.trim() || "User email"}</p>
                    </div>

                    <div className="flex flex-col gap-2.5 text-[14px] text-[#667085]">
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" />{joinedLabel || "Joined date"}</div>
                        <div className="flex items-center gap-2"><Mail01 className="w-4 h-4 shrink-0" />{form.email.trim() || "Email"}</div>
                        <div className="flex items-center gap-2">
                            <Lock01 className="w-4 h-4 shrink-0" />
                            <span className="font-mono tracking-wider">{passwordMask || "Temporary password"}</span>
                        </div>
                        <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" />{phoneDisplay}</div>
                        <div className="flex items-center gap-2"><MarkerPin01 className="w-4 h-4 shrink-0" />{branchLabel}</div>
                        <div className="flex items-center gap-2"><UserSquare className="w-4 h-4 shrink-0" />{roleName || "User role"}</div>
                        <div className="flex items-center gap-2"><CoinsHand className="w-4 h-4 shrink-0" />{payRateName || "Default pay rate"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Validation ────────────────────────────────────────────────────────────

function isFormValid(form: FormValue, requireTempPassword = true): boolean {
    return !!form.firstName.trim()
        && !!form.lastName.trim()
        // Centralized email rule — same `isValidEmail` the admin Change
        // Email modal + Customer form + Instructor Edit profile all use.
        && isValidEmail(form.email)
        // Temp password is set at creation and never re-entered on edit (the
        // edit save doesn't overwrite it), so it's only required in create mode.
        && (!requireTempPassword || !!form.tempPassword.trim())
        && !!form.phone.trim()
        && !!form.roleId;
    // payRateId is required only when role.type === "instructor" — handled
    // dynamically at submit time below.
}

// ─── Pay-rate step primitives (client 2026-07-24) ───────────────────────────
// Mirror the PayRateFormPage Toggle / ToggleCard styling so the new Pay rate
// step reads identically to the rest of the pay-rate module.
function PayToggle({ value, onChange, disabled }: { value: boolean; onChange: (n: boolean) => void; disabled?: boolean }) {
    return (
        <button type="button" role="switch" aria-checked={value} disabled={disabled}
            onClick={() => !disabled && onChange(!value)}
            className={cn(
                "w-9 h-5 rounded-full p-[2px] flex items-center transition-colors shrink-0",
                value ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
                disabled && "opacity-60 cursor-not-allowed",
            )}>
            <span className="block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

/** A single toggle row (title + subtitle + switch) for the "Pay rate
 *  configuration" section. The toggles are grouped at the top now; each enabled
 *  track renders its own titled config section below (Figma 8132:481109). */
function PayToggleRow({ title, subtitle, enabled, onToggle, disabled }: {
    title: string; subtitle: string; enabled: boolean; onToggle: (n: boolean) => void; disabled?: boolean;
}) {
    return (
        <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <PayToggle value={enabled} onChange={onToggle} disabled={disabled} />
        </div>
    );
}

/** 18px section header for the pay-rate configuration groups. */
function PaySectionHeader({ title }: { title: string }) {
    return <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">{title}</p>;
}

/** AED-prefixed amount input (matches PayRateFormPage's AedInput chrome). */
function PayAedInput({ value, onChange, placeholder = "Enter amount" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all overflow-hidden">
            <span className="flex items-center px-[14px] text-[16px] text-[#475467] leading-[24px] border-r border-[#d0d5dd] shrink-0 select-none">AED</span>
            <input type="text" inputMode="numeric" value={value}
                onChange={e => onChange(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={placeholder}
                className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent" />
        </div>
    );
}

// ─── Top-level component ───────────────────────────────────────────────────

export interface StaffFormPageProps {
    mode: "create" | "edit";
    staffId?: string;
    returnTo?: string;
    /** Prefill the role (create-staff-from-a-role). Side-panel equivalent of the
     *  legacy `?roleId=` query param. */
    roleId?: string;
    /** When provided the form renders as SIDE-PANEL content and this closes the
     *  panel instead of navigating (client 2026-07-30). */
    onClose?: () => void;
}

export default function StaffFormPage({ mode, staffId, returnTo = "/admin/staff", roleId, onClose }: StaffFormPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const prefilledRoleId = roleId ?? searchParams.get("roleId") ?? "";
    const panel = !!onClose;
    const exit = onClose ?? (() => router.push(returnTo));

    const allRoles    = useAppStore(s => s.roles);
    const allStaff    = useAppStore(s => s.staff);
    const allPayRates = useAppStore(s => s.payRates);
    const branches    = useAppStore(s => s.branches);
    const shifts      = useAppStore(s => s.shifts);
    const shiftAssignments = useAppStore(s => s.shiftAssignments);
    const classCategories = useAppStore(s => s.classCategories);
    const addStaff    = useAppStore(s => s.addStaff);
    const updateStaff = useAppStore(s => s.updateStaff);
    const addShiftAssignment    = useAppStore(s => s.addShiftAssignment);
    const removeShiftAssignment = useAppStore(s => s.removeShiftAssignment);
    const showToast        = useAppStore(s => s.showToast);
    const addClassCategory = useAppStore(s => s.addClassCategory);

    // Client 2026-07-31 — inline "+ Create class category" modal reachable
    // from the Categories multi-select dropdown when adding an Instructor.
    // Admin never leaves the staff creation flow to add a missing category.
    const [creatingCategory, setCreatingCategory] = useState(false);

    const existing = mode === "edit" && staffId ? allStaff.find(s => s.id === staffId) : undefined;

    // Current shift ids for an edited staff — union of their M2M assignments
    // + the legacy primary `shiftId`, so the form reflects everything they
    // already hold.
    const assignedShiftIds = useMemo(() => {
        if (!existing) return [];
        // Legacy primary first so a no-op re-save keeps the same "primary"
        // shift pointer (shiftIds[0] → staff.shiftId). Then the M2M rows.
        const set = new Set<string>();
        if (existing.shiftId) set.add(existing.shiftId);
        for (const a of shiftAssignments) if (a.staff_id === existing.id) set.add(a.shift_id);
        return Array.from(set);
    }, [existing, shiftAssignments]);

    const [form, setForm] = useState<FormValue>(() => {
        if (existing) return formFromStaff(existing, assignedShiftIds);
        const empty = emptyForm();
        if (prefilledRoleId) empty.roleId = prefilledRoleId;
        return empty;
    });
    const [hydrated, setHydrated] = useState(!!existing);

    useEffect(() => {
        if (mode === "edit" && existing && !hydrated) {
            setForm(formFromStaff(existing, assignedShiftIds));
            setHydrated(true);
        }
    }, [mode, existing, hydrated, assignedShiftIds]);

    useEffect(() => {
        if (mode === "edit" && staffId && allStaff.length > 0 && !existing) {
            showToast("Staff not found", "Returned to the staff list.", "error");
            exit();
        }
    }, [mode, staffId, allStaff, existing, router, returnTo, showToast]);

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }

    // Two-step wizard: step 1 = User details, step 2 = Pay rate (client
    // 2026-07-24). `step` resets to 1 whenever the form re-seeds (edit load).
    const [step, setStep] = useState<1 | 2>(1);

    /** Patch one pay-config track. The Default track also mirrors its rate onto
     *  the canonical `payRateId` so the preview + save path stay in sync. */
    function setPayTrack<K extends keyof StaffPayConfig>(key: K, patch: Partial<StaffPayConfig[K]>) {
        setForm(prev => {
            const nextTrack = { ...prev.payConfig[key], ...patch } as StaffPayConfig[K];
            const nextConfig = { ...prev.payConfig, [key]: nextTrack };
            return {
                ...prev,
                payConfig: nextConfig,
                payRateId: key === "default"
                    ? ((nextTrack as StaffPayConfig["default"]).payRateId ?? "")
                    : prev.payRateId,
            };
        });
    }

    // Options: only active roles for assignment.
    const roleOptions = useMemo(
        () => allRoles
            .filter(r => r.status === "active")
            .map(r => ({ value: r.id, label: r.name })),
        [allRoles],
    );
    // Every active pay rate is selectable for any role — commission refactor
    // Phase 3 lets instructors earn commission too, so there's no longer a
    // role-based restriction on which rates they can be assigned.
    const payRateOptions = useMemo(
        () => allPayRates
            .filter(p => p.status === "active")
            // Commission refactor Phase 3: instructors CAN now earn commission,
            // so every active rate is selectable for any role (the old
            // "instructors can't have a commission rate" guard is removed).
            .map(p => ({ value: p.id, label: p.name })),
        [allPayRates],
    );

    // Active branches for the assignment picker.
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // Shifts offered in the Assign shift picker — scoped to the person's OWN
    // branch (a South staffer can only hold South shifts). Owner spans every
    // location, so they see all active shifts. Empty until a branch is picked.
    const isOwnerRoleSel = allRoles.find(r => r.id === form.roleId)?.type === "owner";
    const shiftOptions = useMemo(
        () => shifts.filter(sh =>
            sh.status === "active"
            && (isOwnerRoleSel || (!!form.branchId && sh.branch_id === form.branchId)),
        ),
        [shifts, form.branchId, isOwnerRoleSel],
    );

    // Resolve selected role + pay rate for the preview + the instructor branch.
    const selectedRole    = allRoles.find(r => r.id === form.roleId);
    const selectedPayRate = allPayRates.find(p => p.id === form.payRateId);
    const isInstructor    = selectedRole?.type === "instructor";
    // Owner spans every location — its staff carry no single branch.
    const isOwnerRole     = selectedRole?.type === "owner";

    // Branch label for the preview — driven by the person's own branch pick
    // (roles are branch-agnostic). Owner shows "All locations".
    const branchLabel = isOwnerRole
        ? "All locations"
        : form.branchId
            ? branches.find(b => b.id === form.branchId)?.name ?? "—"
            : "Branch location";

    function handleSave() {
        if (!isFormValid(form, mode === "create")) return;
        if (!selectedRole) return;
        const isInstr = selectedRole.type === "instructor";
        // Non-instructor roles only ever carry the Default track (always on).
        const effectivePayConfig: StaffPayConfig = isInstr
            ? form.payConfig
            : {
                default: { enabled: true, payRateId: form.payConfig.default.payRateId },
                perClass: { enabled: false },
                perAppointment: { enabled: false },
            };
        const defaultRateId = effectivePayConfig.default.payRateId || undefined;
        // Every enabled track needs a rate; ≥1 track must be enabled.
        const enabled = [
            effectivePayConfig.default,
            ...(isInstr ? [effectivePayConfig.perClass, effectivePayConfig.perAppointment] : []),
        ].filter(t => t.enabled);
        // ≥1 track enabled always; instructors additionally need a rate on each
        // enabled track (non-instructor Default rate stays optional).
        if (enabled.length === 0 || (isInstr && enabled.some(t => !t.payRateId))) {
            showToast("Pay rate required", "Enable at least one pay rate configuration and pick a rate for each.", "error");
            setStep(2);
            return;
        }

        const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
        const initials = initialsOf(form.firstName, form.lastName);
        const phoneStored = `${form.phoneCountry.dial} ${form.phone.trim()}`;

        if (mode === "create") {
            // Format "Mar 14, 2026" — match existing seed convention.
            const now = new Date();
            const joinedDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            const newStaffId = addStaff({
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                fullName,
                email: form.email.trim().toLowerCase(),
                phone: phoneStored,
                imageUrl: form.imageUrl,
                initials,
                color: NEUTRAL_AVATAR_BG,
                roleId: form.roleId,
                branchId: isOwnerRole ? null : form.branchId,
                status: "pending" as StaffStatus,
                tempPassword: form.tempPassword,
                payRateId: defaultRateId,
                payConfig: effectivePayConfig,
                joinedDate,
                // Assign shift — ALL roles now. The first selected shift is
                // the legacy primary (mirrored into the M2M table by addStaff);
                // the rest are added as M2M rows below.
                shiftId: form.shiftIds[0] || undefined,
                // Instructor-only — guarded behind isInstructor so non-
                // instructor rows don't pick up empty optional fields.
                ...(isInstructor ? {
                    shortIntro: form.shortIntro.trim() || undefined,
                    workingExperienceYears: form.workingExperienceYears
                        ? Number(form.workingExperienceYears) : undefined,
                    categoryIds: form.categoryIds.length > 0 ? form.categoryIds : undefined,
                } : {}),
            });
            // Additional shifts beyond the primary → M2M assignments.
            for (const sid of form.shiftIds.slice(1)) {
                addShiftAssignment({ shift_id: sid, staff_id: newStaffId });
            }
            showToast("Invitation sent", `Invite sent to ${form.email.trim().toLowerCase()}.`, "success", "check");
            exit();
            return;
        }
        if (!staffId || !existing) return;
        // Edit mode does NOT mutate role — the dedicated Change role modal
        // owns that path. We also don't overwrite the existing color so we
        // don't blast historical seeds even though all new rows use the
        // neutral token.
        updateStaff(staffId, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            fullName,
            email: form.email.trim().toLowerCase(),
            phone: phoneStored,
            imageUrl: form.imageUrl,
            initials,
            // Branch is editable here — roles are branch-agnostic, so moving a
            // person between branches is a staff-record edit (Owner = null).
            branchId: isOwnerRole ? null : form.branchId,
            payRateId: defaultRateId,
            payConfig: effectivePayConfig,
            // Assign shift — ALL roles. Primary = first selected; the M2M
            // reconcile below adds the rest and drops any deselected shift.
            shiftId: form.shiftIds[0] || undefined,
            // Same guard as create — instructor-specific fields only
            // patched when the row is an instructor.
            ...(isInstructor ? {
                shortIntro: form.shortIntro.trim() || undefined,
                workingExperienceYears: form.workingExperienceYears
                    ? Number(form.workingExperienceYears) : undefined,
                categoryIds: form.categoryIds.length > 0 ? form.categoryIds : undefined,
            } : {}),
        });
        // Reconcile M2M shift assignments — add every selected shift
        // (idempotent) and remove any the admin deselected. updateStaff already
        // set the primary row for shiftIds[0]; addShiftAssignment is a no-op for
        // pairs that already exist.
        for (const sid of form.shiftIds) {
            addShiftAssignment({ shift_id: sid, staff_id: staffId });
        }
        for (const a of shiftAssignments.filter(a => a.staff_id === staffId && !form.shiftIds.includes(a.shift_id))) {
            removeShiftAssignment(a.id);
        }
        showToast("Staff updated", `${fullName} details saved.`, "success", "check");
        exit();
    }

    // A branch must be picked unless the role is Owner (all-locations).
    const branchValid = isOwnerRole || !!form.branchId;
    // Step 1 (User details) validity — everything except pay rate. Temp
    // password is only required in create mode (never overwritten on edit).
    const step1Valid = isFormValid(form, mode === "create") && branchValid;

    // Step 2 (Pay rate) validity. The enabled tracks depend on role: an
    // instructor may use all three, every other role only Default. At least
    // one track must stay enabled, and every enabled track needs a rate.
    const pc = form.payConfig;
    const enabledTracks = [
        pc.default.enabled ? pc.default : null,
        isInstructor && pc.perClass.enabled ? pc.perClass : null,
        isInstructor && pc.perAppointment.enabled ? pc.perAppointment : null,
    ].filter(Boolean) as { enabled: boolean; payRateId?: string }[];
    const enabledCount = enabledTracks.length;
    // Every enabled track needs a rate — but only for instructors. A
    // non-instructor's Default rate stays optional (pre-existing contract), so
    // an Operator / Front Desk can be saved without picking a rate.
    const step2Valid = enabledCount >= 1 && (!isInstructor || enabledTracks.every(t => !!t.payRateId));
    const formValid = step1Valid && step2Valid;

    /** Toggle a track on/off, enforcing "at least one enabled". */
    function toggleTrack(key: keyof StaffPayConfig, next: boolean) {
        if (!next && enabledCount <= 1 && pc[key].enabled) {
            showToast("At least one required", "Keep at least one pay rate configuration enabled.", "error");
            return;
        }
        setPayTrack(key, { enabled: next } as never);
    }

    return (
        <>
            {/* Side-panel header */}
            <div className="flex items-center justify-between px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                    {mode === "create" ? "Add new staff" : "Edit staff"}
                </h2>
                <button type="button" onClick={exit} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>

            {/* Two-step stepper (User details › Pay rate). Step 2 only reachable
                once step-1 fields validate. */}
            <PanelStepper
                steps={[{ n: 1, label: "User details" }, { n: 2, label: "Pay rate" }]}
                current={step}
                onStep={(n) => { if (n === 1 || step1Valid) setStep(n as 1 | 2); }}
            />

            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 py-5">
                        <div className="flex flex-col gap-5 w-full">
                            <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{step === 1 ? "Staff details" : "Pay rate"}</p>

                            {step === 1 && (<>
                            <ImageUpload
                                value={form.imageUrl}
                                initials={initialsOf(form.firstName, form.lastName)}
                                onChange={url => set({ imageUrl: url })}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel label="First name" />
                                    <TextInput value={form.firstName} onChange={v => set({ firstName: v })} placeholder="Enter first name" />
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel label="Last name" />
                                    <TextInput value={form.lastName} onChange={v => set({ lastName: v })} placeholder="Enter last name" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel label="Email" />
                                    <TextInput value={form.email} onChange={v => set({ email: v })} placeholder="Enter email" type="email" />
                                    {form.email.trim().length > 0 && !isValidEmail(form.email) && (
                                        <p className="text-[14px] text-[#b42318] leading-5">
                                            Please enter a valid email address.
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel label="Temporary password" />
                                    <TextInput value={form.tempPassword} onChange={v => set({ tempPassword: v })} placeholder="Enter temporary password" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-[6px]">
                                <FieldLabel label="Phone number" />
                                <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <PhoneCountryDropdown
                                        value={form.phoneCountry}
                                        onChange={c => set({ phoneCountry: c })}
                                    />
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={form.phone}
                                        onChange={e => set({ phone: e.target.value.replace(/\D/g, "") })}
                                        placeholder="Phone number..."
                                        className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent rounded-r-[8px]"
                                    />
                                </div>
                            </div>

                            {/* Role selection — CREATE mode only. Edit mode hides
                                this field because the dedicated "Change role"
                                modal owns role mutation (Figma 6247-223715). */}
                            {mode === "create" && (
                                <>
                                    <div className="flex flex-col gap-[6px]">
                                        <FieldLabel label="Select role" />
                                        <SelectInput
                                            placeholder="Select role"
                                            options={roleOptions}
                                            value={form.roleId}
                                            onChange={v => {
                                                // Switching to a non-instructor role collapses the pay
                                                // config to Default-only (always enabled) so the locked
                                                // Default card can never be left disabled + unrecoverable.
                                                const nextIsInstructor = allRoles.find(r => r.id === v)?.type === "instructor";
                                                set(nextIsInstructor
                                                    ? { roleId: v }
                                                    : {
                                                        roleId: v,
                                                        payConfig: {
                                                            default: { enabled: true, payRateId: form.payConfig.default.payRateId },
                                                            perClass: { enabled: false },
                                                            perAppointment: { enabled: false },
                                                        },
                                                    });
                                            }}
                                            width="w-full"
                                        />
                                    </div>

                                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                                        <p className="text-[14px] text-[#475467] leading-[20px]">
                                            This staff will inherit all permissions from the selected role. Their branch is set below.
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Branch — roles are branch-agnostic, so the
                                person's location is chosen here at assignment
                                time (editable in both create + edit). Owner
                                spans all locations, so the picker is locked. */}
                            <div className="flex flex-col gap-[6px]">
                                <FieldLabel label="Branch" />
                                {isOwnerRole ? (
                                    <div className="h-10 w-full px-[14px] flex items-center border-1 border-[#d0d5dd] rounded-[8px] bg-[#f9fafb] text-[14px] text-[#667085] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        All locations
                                    </div>
                                ) : (
                                    <SelectInput
                                        placeholder="Select branch"
                                        options={branchOptions}
                                        value={form.branchId}
                                        // Changing branch clears the shift picks —
                                        // shifts are branch-scoped, so a South
                                        // shift can't linger when moving to North.
                                        onChange={v => set({ branchId: v, shiftIds: [] })}
                                        width="w-full"
                                    />
                                )}
                            </div>

                            {/* Instructor-only fields (Figma 7471:170327) —
                                Short introduction, Working experience, Assign
                                shift. Categories live below the pay rate. */}
                            {isInstructor && (
                                <>
                                    <div className="flex flex-col gap-[6px]">
                                        <FieldLabel label="Short introduction" />
                                        <textarea
                                            value={form.shortIntro}
                                            onChange={e => set({ shortIntro: e.target.value })}
                                            placeholder="Briefly introduce this instructor — surfaces on the customer-facing profile."
                                            rows={4}
                                            className="w-full px-[14px] py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-none"
                                        />
                                    </div>

                                    <div className="flex flex-col gap-[6px]">
                                        <FieldLabel label="Working experience" />
                                        <input
                                            type="number"
                                            value={form.workingExperienceYears}
                                            onChange={e => set({ workingExperienceYears: e.target.value.replace(/[^\d]/g, "") })}
                                            placeholder="0"
                                            min={0}
                                            className="h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                                        />
                                        <p className="text-[14px] text-[#475467]">in year</p>
                                    </div>
                                </>
                            )}

                            {/* Assign shift removed from the form (client 2026-08) —
                                shifts are assigned ONLY via the "Assign shift" quick
                                action + the Staff Schedule module. Existing
                                assignments are preserved on save (see handleSave),
                                the form just no longer edits them. */}

                            {/* Categories — instructor-only multi-select
                                dropdown. Drives the cross-module instructor
                                gating (templates / schedules / services /
                                appts). 1 instructor → many categories. */}
                            {isInstructor && (
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel label="Categories" />
                                    <MultiCategoryDropdown
                                        options={classCategories.filter(c => c.status === "active").map(c => ({ id: c.id, name: c.name }))}
                                        selectedIds={form.categoryIds}
                                        onChange={ids => set({ categoryIds: ids })}
                                        onCreateCategory={() => setCreatingCategory(true)}
                                    />
                                    <p className="text-[14px] text-[#475467]">Instructors can only be assigned to classes whose category they hold.</p>
                                </div>
                            )}
                            </>)}

                            {/* ── Step 2 — Pay rate ─────────────────────────────
                                Instructors configure up to three tracks; every
                                other role only the Default track (always on).
                                At least one track must stay enabled. */}
                            {step === 2 && (
                                <div className="flex flex-col gap-8">
                                    {/* Section 1 — the toggles, grouped (Figma 8132:481109) */}
                                    <div className="flex flex-col gap-4">
                                        <PaySectionHeader title="Pay rate configuration" />
                                        <div className="flex flex-col gap-4">
                                            <PayToggleRow
                                                title="Fixed salary"
                                                subtitle="Base salary for this staff."
                                                enabled={form.payConfig.default.enabled}
                                                onToggle={n => toggleTrack("default", n)}
                                                disabled={!isInstructor}
                                            />
                                            {isInstructor && (
                                                <PayToggleRow
                                                    title="Pay per class"
                                                    subtitle="Salary for every class taught."
                                                    enabled={form.payConfig.perClass.enabled}
                                                    onToggle={n => toggleTrack("perClass", n)}
                                                />
                                            )}
                                            {isInstructor && (
                                                <PayToggleRow
                                                    title="Pay per appointment"
                                                    subtitle="Salary for every appointment completed."
                                                    enabled={form.payConfig.perAppointment.enabled}
                                                    onToggle={n => toggleTrack("perAppointment", n)}
                                                />
                                            )}
                                        </div>
                                    </div>

                                    {/* Section 2 — Default pay rate config (when Fixed salary is on) */}
                                    {form.payConfig.default.enabled && (
                                        <div className="flex flex-col gap-4">
                                            <PaySectionHeader title="Default pay rate" />
                                            <div className="flex flex-col gap-[6px]">
                                                <FieldLabel label="Pay rate" />
                                                <SelectInput
                                                    placeholder="Select pay rate"
                                                    options={payRateOptions}
                                                    value={form.payConfig.default.payRateId ?? ""}
                                                    onChange={v => setPayTrack("default", { payRateId: v })}
                                                    width="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 3 — Pay per class config */}
                                    {isInstructor && form.payConfig.perClass.enabled && (
                                        <div className="flex flex-col gap-4">
                                            <PaySectionHeader title="Pay per class" />
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="flex flex-col gap-[6px]">
                                                    <FieldLabel label="Pay rate" />
                                                    <SelectInput
                                                        placeholder="Select pay rate"
                                                        options={payRateOptions}
                                                        value={form.payConfig.perClass.payRateId ?? ""}
                                                        onChange={v => setPayTrack("perClass", { payRateId: v })}
                                                        width="w-full"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-[6px]">
                                                    <FieldLabel label="Substitute pay rate (optional)" />
                                                    <SelectInput
                                                        placeholder="Select pay rate"
                                                        options={payRateOptions}
                                                        value={form.payConfig.perClass.substitutePayRateId ?? ""}
                                                        onChange={v => setPayTrack("perClass", { substitutePayRateId: v })}
                                                        width="w-full"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-[6px]">
                                                <FieldLabel label="Substitutions" />
                                                <PayAedInput
                                                    value={form.payConfig.perClass.substitutionAmountAed != null ? String(form.payConfig.perClass.substitutionAmountAed) : ""}
                                                    onChange={v => setPayTrack("perClass", { substitutionAmountAed: v === "" ? undefined : Number(v) })}
                                                />
                                                <p className="text-[14px] text-[#475467]">Per class for which the instructor is added as a substitute.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Section 4 — Pay per appointment config */}
                                    {isInstructor && form.payConfig.perAppointment.enabled && (
                                        <div className="flex flex-col gap-4">
                                            <PaySectionHeader title="Pay per appointment" />
                                            <div className="flex flex-col gap-[6px]">
                                                <FieldLabel label="Pay rate" />
                                                <SelectInput
                                                    placeholder="Select pay rate"
                                                    options={payRateOptions}
                                                    value={form.payConfig.perAppointment.payRateId ?? ""}
                                                    onChange={v => setPayTrack("perAppointment", { payRateId: v })}
                                                    width="w-full"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

            {/* Side-panel footer — Cancel + Back/Continue/Save. */}
            <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                <Button variant="secondary-gray" size="md" onClick={exit}>Cancel</Button>
                <div className="flex items-center gap-3">
                    {step === 2 && (
                        <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                    )}
                    {step === 1 ? (
                        <Button variant="primary" size="md" disabled={!step1Valid} onClick={() => setStep(2)}>Continue</Button>
                    ) : (
                        <Button variant="primary" size="md" disabled={!formValid} onClick={handleSave}>
                            {mode === "create" ? "Add staff" : "Save changes"}
                        </Button>
                    )}
                </div>
            </div>

            <Toast />

            {/* Client 2026-07-31 — same CategoryModal the admin uses on
                /admin/categories. Every consumer subscribing to the
                classCategories slice sees the new row in the same
                render cycle. Live duplicate check via `takenNames`
                surfaces "already exists" inline. On success we auto-
                add the fresh category id to this instructor's
                `categoryIds` so it's immediately checked in the
                multi-select. */}
            {creatingCategory && (
                <CategoryModal
                    onClose={() => setCreatingCategory(false)}
                    takenNames={classCategories.map(c => c.name)}
                    onSubmit={({ name, image_url }) => {
                        const cleanName = name.trim();
                        if (!cleanName) return;
                        const next: ClassCategory = {
                            id: `cat_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                            name: cleanName,
                            color_hex: "#f9fafb",
                            status: "active",
                            image_url: image_url || undefined,
                        };
                        addClassCategory(next);
                        set({ categoryIds: [...form.categoryIds, next.id] });
                        setCreatingCategory(false);
                        showToast(
                            "Category created",
                            `"${cleanName}" has been added to your categories.`,
                            "success", "check",
                        );
                    }}
                />
            )}
        </>
    );
}
