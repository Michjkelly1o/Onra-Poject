"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Embeddable class schedule (public widget)
// ─────────────────────────────────────────────────────────────────────────────
//
// The schedule a studio embeds on its own website via the iframe snippet from
// Settings → Branding → Embed website. Reads `?window=1w|2w|3w|1m`. Shows CLASS
// (group) sessions only — private / recovery never appear. "Book now" hands off
// to the existing customer flow, which gates guests through login / sign-up.
//
// Layout matches Figma 8097-77632 (Calendar - List): header, a headline row
// (selected date + count + search / instructor / location), a date strip, then
// class cards (time block · circular image · name + status · instructor · spots
// / location / gender meta · Book now + price). Phase 2.

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchMd, User01, MarkerPin01, Users01, ChevronDown } from "@untitledui/icons";
import { useAppStore, type ClassSchedule } from "@/lib/store";
import { SelectInput } from "@/components/ui/select-input";
import { genderAccessIcon } from "@/components/ui/gender-icons";
import { DROP_IN_PRICE_AED } from "@/lib/customer/booking-flow";

const WINDOW_DAYS: Record<string, number> = { "1w": 7, "2w": 14, "3w": 21, "1m": 30 };

function localISO(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}
function parseISO(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}
function fullDateLabel(iso: string): string {
    return parseISO(iso).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}
function durationMin(start?: string, end?: string): number | null {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : null;
}
function genderLabel(g: string): string {
    return g === "male" ? "Male only" : g === "female" ? "Female only" : "All gender";
}

function EmbedScheduleInner() {
    const params = useSearchParams();
    const win = params.get("window") ?? "2w";

    const classSchedules = useAppStore(s => s.classSchedules);
    const branches = useAppStore(s => s.branches);
    const branding = useAppStore(s => s.brandingSettings);

    const days = WINDOW_DAYS[win] ?? 14;
    const today = new Date();
    const todayISO = localISO(today);
    const endISO = localISO(addDays(today, days - 1));

    // Filters — location (visitor-facing, matches Figma), instructor, search.
    const [locId, setLocId] = useState("");
    const [instructor, setInstructor] = useState("");
    const [q, setQ] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);

    // Class (group) sessions in the window, respecting location / instructor /
    // search. Cancelled sessions are dropped.
    const inWindow = useMemo(() => classSchedules
        .filter(s => s.type === "class" && s.status !== "Cancelled")
        .filter(s => { const d = s.dateISO.slice(0, 10); return d >= todayISO && d <= endISO; })
        .filter(s => !locId || s.branchId === locId)
        .filter(s => !instructor || s.instructorName === instructor)
        .filter(s => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())),
        [classSchedules, todayISO, endISO, locId, instructor, q],
    );

    // Days that actually have classes drive the date strip; default the
    // selected day to the first one with classes (else today).
    const daysWithClasses = useMemo(() => {
        const set = new Set(inWindow.map(s => s.dateISO.slice(0, 10)));
        return Array.from({ length: days }, (_, i) => localISO(addDays(today, i)))
            .map(iso => ({ iso, count: set.has(iso) ? inWindow.filter(s => s.dateISO.slice(0, 10) === iso).length : 0 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inWindow, days]);

    const firstWithClasses = daysWithClasses.find(d => d.count > 0)?.iso ?? todayISO;
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const activeDay = selectedDay ?? firstWithClasses;

    const dayClasses = useMemo(() => inWindow
        .filter(s => s.dateISO.slice(0, 10) === activeDay)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
        [inWindow, activeDay],
    );

    const locationOptions = useMemo(() => [
        { value: "", label: "All locations" },
        ...branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
    ], [branches]);
    const instructorOptions = useMemo(() => {
        const names = Array.from(new Set(
            classSchedules.filter(s => s.type === "class" && (!locId || s.branchId === locId)).map(s => s.instructorName).filter(Boolean),
        )).sort();
        return [{ value: "", label: "All instructors" }, ...names.map(n => ({ value: n, label: n }))];
    }, [classSchedules, locId]);

    const accent = branding.primaryColor || "#164E52";
    const bookBg = branding.tertiaryColor || "#c4edd6";

    return (
        <div className="min-h-screen bg-[var(--colors-bg-secondary)] py-8 px-4">
            <div className="max-w-[1024px] mx-auto bg-white border border-[var(--colors-border-secondary)] rounded-[24px] px-6 md:px-12 py-10 flex flex-col gap-8">
                {/* Header */}
                <h1 className="text-[30px] md:text-[36px] font-semibold tracking-[-0.72px] text-[var(--colors-text-primary)] leading-tight">
                    Class schedule
                </h1>

                <div className="flex flex-col gap-6">
                    {/* Headline row — date + count on the left, filters on the right. */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">{fullDateLabel(activeDay)}</p>
                            <p className="text-[14px] text-[var(--colors-text-tertiary)]">
                                {dayClasses.length} upcoming class{dayClasses.length === 1 ? "" : "es"}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {searchOpen ? (
                                <div className="flex items-center gap-2 h-10 px-3 bg-white border border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <SearchMd className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
                                    <input
                                        autoFocus
                                        value={q}
                                        onChange={e => setQ(e.target.value)}
                                        onBlur={() => { if (!q) setSearchOpen(false); }}
                                        placeholder="Search classes..."
                                        className="w-[180px] text-[14px] bg-transparent focus:outline-none text-[var(--colors-text-primary)]"
                                    />
                                </div>
                            ) : (
                                <button type="button" onClick={() => setSearchOpen(true)} aria-label="Search"
                                    className="w-10 h-10 shrink-0 flex items-center justify-center bg-white border border-[var(--colors-border-primary)] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                    <SearchMd className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                                </button>
                            )}
                            <div className="w-[180px]">
                                <SelectInput
                                    triggerIcon={<User01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />}
                                    options={instructorOptions}
                                    value={instructor}
                                    onChange={setInstructor}
                                    placeholder="Instructor"
                                    width="w-full"
                                />
                            </div>
                            <div className="w-[200px]">
                                <SelectInput
                                    triggerIcon={<MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />}
                                    options={locationOptions}
                                    value={locId}
                                    onChange={setLocId}
                                    placeholder="All locations"
                                    width="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Date strip — scrolls when the window is longer than a week. */}
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                        {daysWithClasses.map(({ iso }) => {
                            const d = parseISO(iso);
                            const selected = iso === activeDay;
                            return (
                                <button
                                    key={iso}
                                    type="button"
                                    onClick={() => setSelectedDay(iso)}
                                    className="flex-1 min-w-[72px] flex flex-col items-center gap-1 p-3 rounded-[16px] border bg-white transition-colors"
                                    style={selected
                                        ? { borderColor: accent, borderWidth: 2, color: accent }
                                        : { borderColor: "var(--colors-border-secondary)" }}
                                >
                                    <span className="text-[12px] leading-[18px]" style={selected ? { color: accent } : { color: "var(--colors-text-quaternary)" }}>
                                        {d.toLocaleDateString("en-US", { weekday: "short" })}
                                    </span>
                                    <span className="text-[20px] font-semibold leading-[30px]" style={selected ? { color: accent } : { color: "var(--colors-text-primary)" }}>
                                        {d.getDate()}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* List */}
                    {dayClasses.length === 0 ? (
                        <div className="border border-[var(--colors-border-secondary)] rounded-[20px] py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                            No classes scheduled on this day.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {dayClasses.map(s => (
                                <ClassCard key={s.id} s={s} bookBg={bookBg} />
                            ))}
                        </div>
                    )}
                </div>

                <p className="text-center text-[12px] text-[var(--colors-text-quaternary)]">Powered by Onra</p>
            </div>
        </div>
    );
}

function ClassCard({ s, bookBg }: { s: ClassSchedule; bookBg: string }) {
    const endTime = (s as ClassSchedule & { endTime?: string }).endTime;
    const dur = durationMin(s.startTime, endTime);
    const left = Math.max(0, (s.capacity ?? 0) - (s.booked ?? 0));
    // "Ongoing" = the class is happening right now (today, within start–end).
    const now = new Date();
    const toMin = (t?: string): number | null => {
        if (!t) return null;
        const [h, m] = t.split(":").map(Number);
        return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
    };
    const sMin = toMin(s.startTime);
    const eMin = toMin(endTime);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const ongoing = s.dateISO.slice(0, 10) === localISO(now) && sMin != null && sMin <= nowMin && (eMin == null || nowMin < eMin);
    const initial = (s.name || "?").trim().charAt(0).toUpperCase();
    return (
        <div className="bg-white border border-[var(--colors-border-secondary)] rounded-[20px] p-5 flex items-center gap-6">
            {/* Time block */}
            <div className="flex flex-col gap-1 shrink-0 whitespace-nowrap">
                <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6">{s.displayTime}</p>
                {dur != null && <p className="text-[14px] font-medium text-[var(--colors-text-quaternary)] leading-5">{dur} minutes</p>}
            </div>

            {/* Image circle */}
            <div className="size-[88px] shrink-0 rounded-full bg-[var(--colors-bg-secondary)] overflow-hidden flex items-center justify-center">
                <span className="text-[28px] font-semibold text-[var(--colors-text-tertiary)]">{initial}</span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6 truncate">{s.name}</p>
                        {ongoing && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#eff8ff] border border-[#b2ddff] text-[12px] font-medium text-[#175cd3] shrink-0">
                                Ongoing
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="size-4 shrink-0 rounded-full bg-[var(--colors-bg-tertiary)] flex items-center justify-center text-[9px] font-semibold text-[var(--colors-text-tertiary)]">
                            {s.instructorInitials || (s.instructorName || "?").charAt(0)}
                        </span>
                        <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{s.instructorName || "Instructor"}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-[var(--colors-text-quaternary)]">
                    <span className="inline-flex items-center gap-1.5"><Users01 className="w-4 h-4" />{s.booked ?? 0}/{s.capacity ?? 0} spots</span>
                    <span className="w-px h-4 bg-[var(--colors-border-secondary)]" aria-hidden />
                    <span className="inline-flex items-center gap-1.5"><MarkerPin01 className="w-4 h-4" />{s.room || s.location}</span>
                    <span className="w-px h-4 bg-[var(--colors-border-secondary)]" aria-hidden />
                    <span className="inline-flex items-center gap-1.5">{genderAccessIcon(s.genderAccess, "w-4 h-4")}{genderLabel(s.genderAccess)}</span>
                </div>
            </div>

            {/* Action */}
            <div className="flex flex-col items-center gap-2 shrink-0">
                <Link
                    href={`/customer/classes/${s.id}?b=book`}
                    className="w-[240px] h-11 inline-flex items-center justify-center rounded-full border-2 border-white/[0.12] text-[16px] font-semibold text-[#101828] shadow-[inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] transition-opacity hover:opacity-90"
                    style={{ backgroundColor: bookBg }}
                >
                    {left === 0 ? "Join waitlist" : "Book now"}
                </Link>
                <p className="text-[14px] font-medium text-[var(--colors-text-quaternary)]">1 credit or AED {DROP_IN_PRICE_AED}</p>
            </div>
        </div>
    );
}

export default function EmbedSchedulePage() {
    return (
        <Suspense fallback={null}>
            <EmbedScheduleInner />
        </Suspense>
    );
}
