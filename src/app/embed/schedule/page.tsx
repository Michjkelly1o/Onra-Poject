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
// Layout follows Figma 8097-77632 (Calendar - List): header, headline row
// (selected date + count + search / instructor / location), a 7-day week strip,
// then class cards (fixed-width time block · circular cover image · name +
// status · instructor · spots / location / gender · Book now + price). Uses the
// studio's live brand tokens; real class data (cover, name, instructor, etc.).

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SearchMd, User01, MarkerPin01, Users01, ChevronLeft, ChevronRight } from "@untitledui/icons";
import { useAppStore, resolveTemplateCoverImage, type ClassSchedule } from "@/lib/store";
import { SelectInput } from "@/components/ui/select-input";
import { genderAccessIcon } from "@/components/ui/gender-icons";
import { InstructorAvatar } from "@/components/ui/InstructorAvatar";
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
/** Monday of the calendar week containing `d`. */
function mondayOf(d: Date): Date {
    const x = new Date(d);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    x.setHours(0, 0, 0, 0);
    return x;
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
/** "09:00" → "9:00 AM" — single start time, like the attendee card. */
function to12h(hhmm: string): string {
    const [h, m] = (hhmm || "").split(":").map(Number);
    if (Number.isNaN(h)) return hhmm;
    const period = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function EmbedScheduleInner() {
    const params = useSearchParams();
    const win = params.get("window") ?? "2w";

    const classSchedules = useAppStore(s => s.classSchedules);
    const classTemplates = useAppStore(s => s.classTemplates);
    const classCategories = useAppStore(s => s.classCategories);
    const branches = useAppStore(s => s.branches);
    const staff = useAppStore(s => s.staff);
    const branding = useAppStore(s => s.brandingSettings);

    // Real instructor photo by instructor id (colored-initials fallback).
    const instrImgById = useMemo(() => new Map(staff.map(st => [st.id, st.imageUrl])), [staff]);

    const days = WINDOW_DAYS[win] ?? 14;
    const today = new Date();
    const todayISO = localISO(today);
    const endISO = localISO(addDays(today, days - 1));

    // Real class cover per template (template's own upload, else its category
    // image). Keyed by template id so each schedule resolves its real image.
    const coverByTemplate = useMemo(() => {
        const m = new Map<string, string | undefined>();
        for (const t of classTemplates) m.set(t.id, resolveTemplateCoverImage(t, classCategories));
        return m;
    }, [classTemplates, classCategories]);

    // Filters — location (visitor-facing), instructor, search.
    const [locId, setLocId] = useState("");
    const [instructor, setInstructor] = useState("");
    const [q, setQ] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);

    const inWindow = useMemo(() => classSchedules
        .filter(s => s.type === "class" && s.status !== "Cancelled")
        .filter(s => { const d = s.dateISO.slice(0, 10); return d >= todayISO && d <= endISO; })
        .filter(s => !locId || s.branchId === locId)
        .filter(s => !instructor || s.instructorName === instructor)
        .filter(s => !q.trim() || s.name.toLowerCase().includes(q.trim().toLowerCase())),
        [classSchedules, todayISO, endISO, locId, instructor, q],
    );

    const firstWithClasses = useMemo(() => {
        const set = new Set(inWindow.map(s => s.dateISO.slice(0, 10)));
        for (let i = 0; i < days; i++) {
            const iso = localISO(addDays(today, i));
            if (set.has(iso)) return iso;
        }
        return todayISO;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [inWindow, days]);

    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const activeDay = selectedDay ?? firstWithClasses;

    // 7-day week strip. `weekStart` = Monday of the shown week; nav pages
    // through the window's weeks.
    const todayMondayISO = localISO(mondayOf(today));
    const [weekStart, setWeekStart] = useState<string>(todayMondayISO);
    const weekDays = useMemo(
        () => Array.from({ length: 7 }, (_, i) => localISO(addDays(parseISO(weekStart), i))),
        [weekStart],
    );
    const canPrev = weekStart > todayMondayISO;
    const canNext = localISO(addDays(parseISO(weekStart), 7)) <= endISO;
    const showNav = canPrev || canNext;

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
    // Book now = the studio's PRIMARY brand button (solid) + white text.
    const bookBg = accent;

    return (
        <div className="min-h-screen bg-[var(--colors-bg-secondary)] px-6 md:px-16 py-10">
            <div className="max-w-[1024px] mx-auto flex flex-col gap-8">
                {/* Header */}
                <h1 className="text-[30px] md:text-[36px] font-semibold tracking-[-0.72px] text-[var(--colors-text-primary)] leading-tight">
                    Class schedule
                </h1>

                <div className="flex flex-col gap-6">
                    {/* Headline row */}
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

                    {/* Date strip — 7 days in one row (a week); nav pages the window. */}
                    <div className="flex items-center gap-3">
                        {showNav && (
                            <button type="button" onClick={() => setWeekStart(localISO(addDays(parseISO(weekStart), -7)))}
                                disabled={!canPrev} aria-label="Previous week"
                                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white text-[var(--colors-text-quaternary)] disabled:opacity-30 hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                        )}
                        <div className="flex-1 grid grid-cols-7 gap-3">
                            {weekDays.map(iso => {
                                const d = parseISO(iso);
                                const disabled = iso < todayISO || iso > endISO;
                                const selected = iso === activeDay;
                                return (
                                    <button
                                        key={iso}
                                        type="button"
                                        disabled={disabled}
                                        onClick={() => setSelectedDay(iso)}
                                        className="flex flex-col items-center gap-1 p-3 rounded-[16px] border bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        style={selected
                                            ? { borderColor: accent, borderWidth: 2 }
                                            : { borderColor: "var(--colors-border-secondary)" }}
                                    >
                                        <span className="text-[12px] leading-[18px]" style={{ color: selected ? accent : "var(--colors-text-quaternary)" }}>
                                            {d.toLocaleDateString("en-US", { weekday: "short" })}
                                        </span>
                                        <span className="text-[20px] font-semibold leading-[30px]" style={{ color: selected ? accent : "var(--colors-text-primary)" }}>
                                            {d.getDate()}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {showNav && (
                            <button type="button" onClick={() => setWeekStart(localISO(addDays(parseISO(weekStart), 7)))}
                                disabled={!canNext} aria-label="Next week"
                                className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white text-[var(--colors-text-quaternary)] disabled:opacity-30 hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>

                    {/* List */}
                    {dayClasses.length === 0 ? (
                        <div className="border border-[var(--colors-border-secondary)] rounded-[20px] py-16 text-center text-[14px] text-[var(--colors-text-quaternary)]">
                            No classes scheduled on this day.
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {dayClasses.map(s => (
                                <ClassCard key={s.id} s={s} cover={coverByTemplate.get(s.templateId)} instructorImageUrl={instrImgById.get(s.instructorId)} bookBg={bookBg} />
                            ))}
                        </div>
                    )}
                </div>

                {/* powered by — Onra wordmark (masked so it tints to the label colour). */}
                <div className="flex items-center justify-center gap-[5px] pt-2">
                    <span className="text-[12px] font-normal text-[#667085] leading-[18px]">powered by</span>
                    <span
                        role="img"
                        aria-label="Onra"
                        className="block shrink-0"
                        style={{
                            width: "42px",
                            height: "11px",
                            backgroundColor: "#667085",
                            WebkitMaskImage: "url('/brand-logo/wordmark/Wordmark%20-%20Black.svg')",
                            maskImage: "url('/brand-logo/wordmark/Wordmark%20-%20Black.svg')",
                            WebkitMaskRepeat: "no-repeat",
                            maskRepeat: "no-repeat",
                            WebkitMaskSize: "contain",
                            maskSize: "contain",
                            WebkitMaskPosition: "center",
                            maskPosition: "center",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

function ClassCard({ s, cover, instructorImageUrl, bookBg }: { s: ClassSchedule; cover?: string; instructorImageUrl?: string; bookBg: string }) {
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
            {/* Time block — FIXED width so the image aligns across every card. */}
            <div className="w-[92px] shrink-0 flex flex-col gap-1 whitespace-nowrap">
                <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6">{to12h(s.startTime)}</p>
                {dur != null && <p className="text-[14px] font-medium text-[var(--colors-text-quaternary)] leading-5">{dur} minutes</p>}
            </div>

            {/* Cover image circle — real template / category image. */}
            <div className="size-[88px] shrink-0 rounded-full bg-[var(--colors-bg-secondary)] overflow-hidden flex items-center justify-center">
                {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={cover} alt="" className="w-full h-full object-cover" />
                    : <span className="text-[28px] font-semibold text-[var(--colors-text-tertiary)]">{initial}</span>}
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
                    <div className="flex items-center gap-2">
                        <InstructorAvatar imageUrl={instructorImageUrl} initials={s.instructorInitials || (s.instructorName || "?").charAt(0)} color={s.instructorColor} size={20} />
                        <span className="text-[14px] leading-5 text-[var(--colors-text-secondary)] truncate">{s.instructorName || "Open session"}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[14px] text-[var(--colors-text-quaternary)]">
                    <span className="inline-flex items-center gap-1.5"><Users01 className="w-4 h-4" />{s.booked ?? 0}/{s.capacity ?? 0} spots</span>
                    <span className="w-px h-4 bg-[var(--colors-border-secondary)]" aria-hidden />
                    <span className="inline-flex items-center gap-1.5"><MarkerPin01 className="w-4 h-4" />{s.room || s.location}</span>
                    <span className="w-px h-4 bg-[var(--colors-border-secondary)]" aria-hidden />
                    <span className="inline-flex items-center gap-1.5">{genderAccessIcon(s.genderAccess, "w-4 h-4 text-[var(--colors-text-quaternary)]")}{genderLabel(s.genderAccess)}</span>
                </div>
            </div>

            {/* Action */}
            <div className="flex flex-col items-center gap-2 shrink-0">
                <Link
                    href={`/embed/classes/${s.id}`}
                    className="w-[240px] h-11 inline-flex items-center justify-center rounded-full border-2 border-white/[0.12] text-[16px] font-semibold text-white shadow-[inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] transition-opacity hover:opacity-90"
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
