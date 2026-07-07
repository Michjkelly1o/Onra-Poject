"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Instructor Detail (`/customer/instructors/[id]`) — PRD 13 §6
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached ONLY by tapping an instructor card in the Home Instructor Overview.
// Reuses the live admin `instructors` row (read-only) + that instructor's
// `class_schedule` rows. Two tabs:
//   • Details — phone, derived work experience, and the branch location.
//   • Class schedule — a week strip + the instructor's upcoming classes per day.
// The hero overlays the shared <CustomerHeader> (back + share, dark over the photo),
// so the sticky header + fixed background behave like every other member screen.
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j nodes 3244-65717 (Details) + 3244-65853 (Classes).

import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useParams, useRouter } from "next/navigation";
import { Briefcase01, ChevronLeft, Cryptocurrency04, Maximize01, MarkerPin01, Phone, Share02, UserCircle } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCustomerInstructors } from "@/lib/customer/instructors";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { firstOfMonthISO, monthYearOf, REAL_TODAY_ISO, to12h } from "@/lib/customer/dates";
import { cardPresentation, useInstructorDayClasses } from "@/lib/customer/search-data";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { ScheduleDateBar } from "@/components/customer/classes/ScheduleDateBar";
import { MonthPickerSheet } from "@/components/customer/home/MonthPickerSheet";
import { ClassScheduleCard } from "@/components/customer/classes/ClassScheduleCard";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { Button } from "@/components/ui/button";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// ── pure helpers ──────────────────────────────────────────────────────────────
// Date helpers (to12h / durationMins / REAL_TODAY_ISO …) are shared in
// `@/lib/customer/dates` (LOCAL date math, matching the admin seed's isoDay).

/** Work experience from the joined date (e.g. "Feb 1, 2024"), to the real today. */
function workExperience(joinedDate: string): string {
    const joined = new Date(joinedDate);
    if (Number.isNaN(joined.getTime())) return "—";
    const ms = new Date().getTime() - joined.getTime();
    const years = Math.floor(ms / (365.25 * 86_400_000));
    if (years >= 1) return `${years} year${years === 1 ? "" : "s"}`;
    const months = Math.floor(ms / (30.44 * 86_400_000));
    return months <= 0 ? "New" : `${months} month${months === 1 ? "" : "s"}`;
}

/** Deterministic career-experience years (5–10), stable per instructor id. */
function experienceYears(id: string): number {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return 5 + (h % 6);
}

/** Templated bio — there is no bio field in the seed, so it is generated
 *  deterministically from the instructor's name + primary category. */
function introduction(name: string, primaryCategory: string, years: number): string {
    const firstName = name.split(" ")[0];
    return `With ${years} years of experience, ${name} brings dedicated expertise to every ${primaryCategory} session. With a strong background in fitness, ${firstName} empowers clients to master body awareness, functional movement, and core strength.`;
}

// ── small presentational pieces ────────────────────────────────────────────────

function InfoRow({
    icon: Icon,
    label,
    value,
    multiline = false,
}: {
    icon: IconType;
    label: string;
    value: string;
    /** Top-align the icon and let the value wrap (used by the Introduction bio). */
    multiline?: boolean;
}) {
    return (
        <div className={`flex w-full gap-3 ${multiline ? "items-start" : "items-center"}`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <Icon className="size-5 text-[#344054]" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs font-normal leading-[18px] text-[#667085]">{label}</span>
                <span
                    className={`text-sm text-[#101828] ${
                        multiline ? "font-normal leading-[22px]" : "truncate font-medium leading-5"
                    }`}
                >
                    {value}
                </span>
            </div>
        </div>
    );
}

// Last selected schedule date per instructor — preserved for the session (in-memory,
// resets on a full reload) so revisiting the screen restores the member's choice.
const lastSelectedByInstructor = new Map<string, string>();

// ── page ────────────────────────────────────────────────────────────────────────

export default function InstructorDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const instructors = useCustomerInstructors();
    const branches = useAppStore((s) => s.branches);
    const schedules = useAppStore((s) => s.classSchedules);
    const showToast = useAppStore((s) => s.showToast);

    const { timezone } = useCurrentCustomerContext();
    const [tab, setTab] = useState<"details" | "schedule">("details");
    const [monthOpen, setMonthOpen] = useState(false);
    // Default to today; restore the session's last pick for this instructor if any.
    const [selectedDate, setSelectedDate] = useState<string>(
        () => lastSelectedByInstructor.get(id) ?? REAL_TODAY_ISO,
    );

    const instructor = instructors.find((i) => i.id === id) ?? null;

    // Schedule tab — the instructor's classes for the selected day, built from the
    // SAME view-model as Search (live admin classSchedules).
    const dayClasses = useInstructorDayClasses(id, selectedDate);

    // Categories the instructor teaches — derived from every class they're on
    // (any status), deduped in first-seen order. Drives the Categories row + the
    // bio's primary category.
    const categories = useMemo(() => {
        const seen = new Set<string>();
        for (const s of schedules) {
            if (s.instructorId === id && s.category) seen.add(s.category);
        }
        return Array.from(seen);
    }, [schedules, id]);

    // Edge case — instructor missing/archived: graceful not-found, not a crash.
    if (!instructor) {
        return (
            <div className="flex min-h-full flex-col">
                <CustomerHeader>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                    >
                        <ChevronLeft className="size-5 text-white" aria-hidden />
                    </button>
                    <div className="flex-1" />
                </CustomerHeader>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-base font-semibold text-[#101828]">Instructor not found</p>
                    <p className="text-sm text-[#667085]">This instructor is no longer available.</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer")}>
                        Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    const branch = branches.find((b) => b.id === instructor.branchId) ?? null;
    const branchAddress = branch ? [branch.address, branch.country].filter(Boolean).join(", ") : "";

    const primaryCategory = categories[0] ?? "fitness";
    const introText = introduction(instructor.name, primaryCategory, experienceYears(instructor.id));
    const categoriesText = categories.length > 0 ? categories.join(", ") : "—";

    function selectDate(dateISO: string) {
        setSelectedDate(dateISO);
        lastSelectedByInstructor.set(id, dateISO);
    }

    return (
        <div className="flex min-h-full flex-col">
            {/* Shared header (back + share) — dark buttons sit over the hero photo. */}
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                >
                    <ChevronLeft className="size-5 text-white" aria-hidden />
                </button>
                <div className="flex-1" />
                <button
                    type="button"
                    onClick={() => showToast("Share", `Share ${instructor.name}'s profile — coming soon.`, "success")}
                    aria-label={`Share ${instructor.name}'s profile`}
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                >
                    <Share02 className="size-5 text-white" aria-hidden />
                </button>
            </CustomerHeader>

            {/* Hero — instructor photo + name + email over a dark gradient. */}
            <div className="relative h-[240px] w-full shrink-0 overflow-hidden bg-[#f9fafb]">
                {instructor.imageUrl ? (
                    // Instructor assets are circular avatars (transparent corners); scaling up
                    // crops the circle so the photo fills the hero as a full rectangle.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={instructor.imageUrl} alt="" className="absolute inset-0 size-full scale-[1.4] object-cover" />
                ) : (
                    // No photo → neutral placeholder avatar (Figma 4214-40762): grey
                    // bg + grey initials, never the brand colour.
                    <div className="absolute inset-0 flex items-center justify-center bg-[#f2f4f7]">
                        <span className="text-5xl font-semibold text-[#667085]">{instructor.initials}</span>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-black/65" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
                    <p className="text-xl font-semibold leading-[30px] text-white">{instructor.name}</p>
                    <p className="text-sm font-normal leading-5 text-[#d0d5dd]">{instructor.email}</p>
                </div>
            </div>

            {/* Tabs + content. */}
            <div className="flex w-full flex-col gap-6 px-4 pb-12 pt-6">
                <div className="flex w-full gap-3">
                    {(["details", "schedule"] as const).map((key) => {
                        const active = tab === key;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setTab(key)}
                                className={`flex flex-1 items-center justify-center pb-3 text-sm leading-5 transition-colors ${
                                    active
                                        ? "border-b-2 border-[#101828] font-semibold text-[#101828]"
                                        : "font-medium text-[#667085]"
                                }`}
                            >
                                {key === "details" ? "Details" : "Class schedule"}
                            </button>
                        );
                    })}
                </div>

                {tab === "details" ? (
                    <div className="flex w-full flex-col gap-6">
                        <div className="flex w-full flex-col gap-3">
                            <InfoRow icon={UserCircle} label="Introduction" value={introText} multiline />
                            <InfoRow icon={Phone} label="Phone" value={instructor.phone} />
                            <InfoRow icon={Briefcase01} label="Work experience" value={workExperience(instructor.joinedDate)} />
                            <InfoRow icon={Cryptocurrency04} label="Categories" value={categoriesText} />
                        </div>

                        <div className="h-px w-full bg-[#e4e7ec]" />

                        <div className="flex w-full flex-col gap-3">
                            <p className="text-base font-semibold leading-6 text-[#101828]">Branch location</p>
                            <div className="relative h-[160px] w-full overflow-hidden rounded-xl bg-white">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src="/images/customer/branch-map.png" alt="" className="absolute inset-0 size-full object-cover" />
                                <span className="absolute left-1/2 top-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-black/20 bg-[#101828]">
                                    <MarkerPin01 className="size-5 text-white" aria-hidden />
                                </span>
                                <button
                                    type="button"
                                    onClick={() => showToast("Map", "Full map view is coming soon.", "success")}
                                    aria-label="Expand map"
                                    className="absolute right-4 top-4 flex items-center justify-center rounded-full border border-[#f2f4f7] bg-white p-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                >
                                    <Maximize01 className="size-5 text-[#344054]" aria-hidden />
                                </button>
                            </div>
                            <div className="flex w-full items-start gap-2">
                                <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                                <div className="flex min-w-0 flex-1 flex-col gap-1">
                                    <p className="text-sm font-medium leading-5 text-[#101828]">{branch?.name ?? "—"}</p>
                                    <p className="text-sm font-normal leading-5 text-[#475467]">{branchAddress}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex w-full flex-col gap-6">
                        <ScheduleDateBar
                            selectedISO={selectedDate}
                            onSelect={selectDate}
                            timezone={timezone}
                            onMonthClick={() => setMonthOpen(true)}
                            onTimezoneClick={() => router.push("/customer/search/timezone")}
                        />

                        {dayClasses.length > 0 ? (
                            <div className="flex w-full flex-col gap-4">
                                {dayClasses.map((c) => {
                                    const p = cardPresentation(c);
                                    return (
                                        <ClassScheduleCard
                                            key={c.id}
                                            name={c.name}
                                            instructorName={c.instructorName}
                                            coverImage={c.coverImage}
                                            coverColor={c.coverColor}
                                            room={c.room}
                                            branch={c.branchName}
                                            timeLabel={`${to12h(c.startTime)} • ${c.durationMins} mins`}
                                            badgeLabel={p.badgeLabel}
                                            badgeTone={p.badgeTone}
                                            ctaLabel={p.ctaLabel}
                                            ctaVariant={p.ctaVariant}
                                            ctaDisabled={false}
                                            onAction={() => router.push(`/customer/classes/${c.id}`)}
                                        />
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-1 items-center justify-center py-8">
                                <SearchEmptyState
                                    title="No classes scheduled"
                                    description="Jump to the next available dates or try a different day."
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>

            <MonthPickerSheet
                open={monthOpen}
                onClose={() => setMonthOpen(false)}
                month={monthYearOf(selectedDate).month}
                year={monthYearOf(selectedDate).year}
                minYear={monthYearOf(REAL_TODAY_ISO).year}
                maxYear={monthYearOf(REAL_TODAY_ISO).year + 1}
                onApply={(m, y) => {
                    const first = firstOfMonthISO(m, y);
                    selectDate(first < REAL_TODAY_ISO ? REAL_TODAY_ISO : first);
                }}
            />
        </div>
    );
}
