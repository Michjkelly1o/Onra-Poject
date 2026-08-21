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

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Briefcase01, ChevronLeft, Mail01, Phone, Share02, Sun } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCustomerInstructors } from "@/lib/customer/instructors";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { cardPresentation, useInstructorDayClasses } from "@/lib/customer/search-data";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { ScheduleDateBar } from "@/components/customer/classes/ScheduleDateBar";
import { TimeZoneSheet } from "@/components/customer/shell/TimeZoneSheet";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { ClassScheduleCard } from "@/components/customer/classes/ClassScheduleCard";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/customer/classes/ClassDetailLayout";
import { BranchLocationCard } from "@/components/customer/branch/BranchLocationCard";

// ── pure helpers ──────────────────────────────────────────────────────────────
// Date helpers (to12h / durationMins / REAL_TODAY_ISO …) are shared in
// `@/lib/customer/dates` (LOCAL date math, matching the admin seed's isoDay).

// ── small presentational pieces ────────────────────────────────────────────────

// Last selected schedule date per instructor — preserved for the session (in-memory,
// resets on a full reload) so revisiting the screen restores the member's choice.
const lastSelectedByInstructor = new Map<string, string>();

// ── page ────────────────────────────────────────────────────────────────────────

export default function InstructorDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const instructors = useCustomerInstructors();
    const staff = useAppStore((s) => s.staff);
    const branches = useAppStore((s) => s.branches);
    const schedules = useAppStore((s) => s.classSchedules);
    const showToast = useAppStore((s) => s.showToast);

    const { timezone, setTimezone, localTimezone } = useCurrentCustomerContext();
    const [tab, setTab] = useState<"details" | "schedule">("details");
    const [tzOpen, setTzOpen] = useState(false);
    const [descOpen, setDescOpen] = useState(false);
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
                    <p className="text-base font-semibold text-[var(--brand-text)]">Instructor not found</p>
                    <p className="text-sm text-[var(--colors-text-quaternary)]">This instructor is no longer available.</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer")}>
                        Back to Home
                    </Button>
                </div>
            </div>
        );
    }

    const branch = branches.find((b) => b.id === instructor.branchId) ?? null;

    // Short intro — the SAME copy admin sets on the staff detail + the instructor
    // sees on their account page (single source: the staff row). Instructor id
    // maps 1:1 to the staff row id.
    const introText = staff.find((s) => s.id === instructor.id)?.shortIntro ?? "";
    // Work experience — read from the SAME staff row (single source) so it stays
    // in sync with the admin staff detail + the instructor's account page.
    const workExpYears = staff.find((s) => s.id === instructor.id)?.workingExperienceYears;
    const workExpText = workExpYears != null && workExpYears > 0
        ? `${workExpYears} year${workExpYears === 1 ? "" : "s"} work experience`
        : "";
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

            {/* Hero — instructor photo + name + email over a dark gradient. Responsive
                4:3 banner (height follows device width, matching class/appointment). */}
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-[var(--colors-bg-secondary)]">
                {instructor.imageUrl ? (
                    // Instructor assets are circular avatars (transparent corners); scaling up
                    // crops the circle so the photo fills the hero as a full rectangle.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={instructor.imageUrl} alt="" className="absolute inset-0 size-full scale-[1.4] object-cover" />
                ) : (
                    // No photo → neutral placeholder avatar (Figma 4214-40762): grey
                    // bg + grey initials, never the brand colour.
                    <div className="absolute inset-0 flex items-center justify-center bg-[var(--colors-bg-tertiary)]">
                        <span className="text-5xl font-semibold text-[var(--colors-text-quaternary)]">{instructor.initials}</span>
                    </div>
                )}
                <div className="absolute inset-x-0 bottom-0 h-[160px] bg-gradient-to-b from-transparent to-black/65" />
                <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
                    <p className="text-xl font-semibold leading-[30px] text-white">{instructor.name}</p>
                    <p className="text-sm font-normal leading-5 text-[var(--colors-border-primary)]">{instructor.email}</p>
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
                                        ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
                                        : "font-medium text-[var(--colors-text-quaternary)]"
                                }`}
                            >
                                {key === "details" ? "Details" : "Class schedule"}
                            </button>
                        );
                    })}
                </div>

                {tab === "details" ? (
                    <div className="flex w-full flex-col gap-6">
                        {/* Introduction — same short intro as admin detail +
                            instructor account (single source: staff row). Work
                            experience stays removed (client 2026-08-19). */}
                        {introText && (
                            <section className="flex w-full flex-col gap-2">
                                <p className={`text-sm font-normal leading-5 text-[var(--colors-text-tertiary)] ${descOpen ? "" : "line-clamp-3"}`}>
                                    {introText}
                                </p>
                                {introText.length > 120 && (
                                    <button
                                        type="button"
                                        onClick={() => setDescOpen((v) => !v)}
                                        className="self-start text-sm font-semibold text-[var(--brand-text)]"
                                    >
                                        {descOpen ? "See less" : "See more"}
                                    </button>
                                )}
                            </section>
                        )}
                        {/* Info list — single-column inline rows (matches Class details) */}
                        <div className="flex w-full flex-col gap-4">
                            <InfoRow icon={Mail01}>
                                <span className="truncate">{instructor.email}</span>
                            </InfoRow>
                            <InfoRow icon={Phone}>
                                <span>{instructor.phone}</span>
                            </InfoRow>
                            {workExpText && (
                                <InfoRow icon={Briefcase01}>
                                    <span>{workExpText}</span>
                                </InfoRow>
                            )}
                            <InfoRow icon={Sun}>
                                <span>{categoriesText}</span>
                            </InfoRow>
                        </div>

                        <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />

                        <BranchLocationCard branch={branch} heading="Branch location" />
                    </div>
                ) : (
                    <div className="flex w-full flex-col gap-6">
                        <ScheduleDateBar
                            selectedISO={selectedDate}
                            onSelect={selectDate}
                            timezone={timezone}
                            onTimezoneClick={() => setTzOpen(true)}
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
                                            timeLabel={`${timeInZoneLabel(c.dateISO, c.startTime, branches.find((b) => b.id === c.branchId), timezone)} • ${c.durationMins} mins`}
                                            badgeLabel={p.badgeLabel}
                                            badgeTone={p.badgeTone}
                                            badgeIcon={p.badgeIcon}
                                            statusPill={p.statusPill}
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

            <TimeZoneSheet
                open={tzOpen}
                onClose={() => setTzOpen(false)}
                branch={branches.find((b) => b.status === "active") ?? branches[0]}
                localCity={localTimezone}
                value={timezone}
                onSelect={(city) => {
                    setTimezone(city);
                    setTzOpen(false);
                }}
            />
        </div>
    );
}
