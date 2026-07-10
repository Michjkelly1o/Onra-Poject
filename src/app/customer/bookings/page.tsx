"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Bookings list (`/customer/bookings`) — Figma 2134-28989 / 2175-30812
// ─────────────────────────────────────────────────────────────────────────────
//
// Tab 3 of the bottom nav. Header = "Bookings" + filter, with Upcoming / Past
// segmented tabs in the header subBar (sticky, frosts with the header). Each row
// is the shared <BookingCard>; tapping opens the Booking Detail. The filter modal
// (Class type · Instructor · Categories) narrows the active tab. Tab + filters
// persist across detail round-trips via a module cache.

import { useEffect, useMemo, useReducer, useState } from "react";
import { useRouter } from "next/navigation";
import { FilterLines, RefreshCcw01, SlashCircle01 } from "@untitledui/icons";
import {
    applyBookingFilters,
    bookingFilterCount,
    bookingsUi,
    BOOKING_STATUS,
    EMPTY_BOOKING_FILTERS,
    useMemberBookings,
    type BookingFilters,
    type BookingTab,
} from "@/lib/customer/bookings-data";
import { useFilterInstructors } from "@/lib/customer/instructors";
import { BookingCard } from "@/components/customer/bookings/BookingCard";
import { BookingsFilterModal } from "@/components/customer/bookings/BookingsFilterModal";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { REAL_TODAY_ISO, to12h } from "@/lib/customer/dates";
import { useAppointmentBookings } from "@/lib/customer/appointment-bookings";
import { useIsAuthenticated } from "@/lib/customer/auth";

function fmtShortDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

export default function BookingsPage() {
    const router = useRouter();
    // Bookings is auth-only — a guest (tab hidden, but reachable by deep link) is
    // redirected to the login front door.
    const isAuth = useIsAuthenticated();
    useEffect(() => {
        if (!isAuth) router.replace("/customer/auth");
    }, [isAuth, router]);
    const { upcoming, past } = useMemberBookings();
    // Booked appointments (UI-only store) show alongside class bookings: active
    // future ones under Upcoming, cancelled/past ones under Past.
    const apptBookings = useAppointmentBookings();
    const apptSplit = useMemo(() => {
        // Date-based (like classes: today still counts as upcoming). Any non-cancelled
        // record — including legacy rows written before `status` existed — is bookable.
        return {
            upcoming: apptBookings.filter((a) => a.status !== "cancelled" && a.slotISO >= REAL_TODAY_ISO),
            past: apptBookings.filter((a) => a.status === "cancelled" || a.slotISO < REAL_TODAY_ISO),
        };
    }, [apptBookings]);
    const showAppts = bookingsUi.tab === "upcoming" ? apptSplit.upcoming : apptSplit.past;
    const [, force] = useReducer((x) => x + 1, 0);
    // Draft + filterOpen persist in bookingsUi so they survive the "See all"
    // instructor screen round-trip (mirrors the Search filter).
    const [draft, setDraftState] = useState<BookingFilters>(() => bookingsUi.draft);
    const [filterOpen, setFilterOpenState] = useState<boolean>(() => bookingsUi.filterOpen);
    function setDraft(f: BookingFilters) {
        bookingsUi.draft = f;
        setDraftState(f);
    }
    function setFilterOpen(v: boolean) {
        bookingsUi.filterOpen = v;
        setFilterOpenState(v);
    }

    const tab = bookingsUi.tab;
    const setTab = (t: BookingTab) => {
        bookingsUi.tab = t;
        force();
    };

    const applied = bookingsUi.applied;
    const baseList = tab === "upcoming" ? upcoming : past;
    const list = applyBookingFilters(baseList, applied);
    const fcount = bookingFilterCount(applied);

    // Appointment bookings honour the SAME filter: "Group" hides them (they're the
    // Appointment kind); instructor + category narrow them just like class rows.
    const filteredAppts = showAppts.filter(
        (a) =>
            applied.classType !== "Group" &&
            (applied.instructorIds.length === 0 ||
                (a.instructorId != null && applied.instructorIds.includes(a.instructorId))) &&
            (applied.categories.length === 0 || applied.categories.includes(a.category)),
    );

    // Merge appointments + class bookings into ONE list sorted by date/time —
    // Upcoming = soonest first, Past = most recent first — so the two kinds
    // interleave chronologically instead of appointments always sitting on top.
    const mergedRows: { sortKey: string; el: React.ReactNode }[] = [
        ...filteredAppts.map((a) => ({
            sortKey: `${a.slotISO}T${a.slotTime}`,
            el: (
                <BookingCard
                    key={`appt-${a.id}`}
                    name={a.name}
                    date={fmtShortDate(a.slotISO)}
                    time={to12h(a.slotTime)}
                    location={a.branchName}
                    status={
                        a.status === "cancelled"
                            ? {
                                  label: a.lateCancel ? "Cancelled (late)" : "Cancelled (no charge)",
                                  tone: "error" as const,
                                  icon: a.lateCancel ? SlashCircle01 : RefreshCcw01,
                              }
                            : tab === "past"
                              ? { label: "Completed", tone: "success" as const }
                              : { label: "Booked", tone: "success" as const }
                    }
                    mutedCover={a.status === "cancelled"}
                    image={a.coverImage}
                    imageColor={a.coverColor}
                    onClick={() => router.push(`/customer/bookings/appointment/${a.id}`)}
                />
            ),
        })),
        ...list.map((b) => ({
            sortKey: b.sortKey,
            el: (
                <BookingCard
                    key={b.bookingId}
                    name={b.name}
                    date={b.dateShort}
                    time={b.time}
                    location={b.location}
                    status={BOOKING_STATUS[b.viewStatus].card}
                    mutedCover={BOOKING_STATUS[b.viewStatus].mutedCover}
                    image={b.coverImage}
                    imageColor={b.coverColor}
                    onClick={() => router.push(`/customer/bookings/${b.bookingId}`)}
                />
            ),
        })),
    ].sort((x, y) =>
        tab === "upcoming" ? x.sortKey.localeCompare(y.sortKey) : y.sortKey.localeCompare(x.sortKey),
    );

    // Instructors — the SAME shared, branch-scoped list as the Search filter.
    const instructors = useFilterInstructors();
    // Categories present across the member's bookings — class AND appointment — so
    // an appointment-only category is still selectable in the filter.
    const categories = useMemo(() => {
        const cats = new Set<string>();
        for (const b of [...upcoming, ...past]) cats.add(b.category);
        for (const a of apptBookings) if (a.category) cats.add(a.category);
        return Array.from(cats);
    }, [upcoming, past, apptBookings]);

    // Guest — nothing personal renders while the redirect effect runs.
    if (!isAuth) return null;

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader
                overlap
                subBar={
                    <div className="flex w-full gap-3 pt-1">
                        {(["upcoming", "past"] as BookingTab[]).map((t) => {
                            const active = tab === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTab(t)}
                                    className={`flex h-8 flex-1 items-center justify-center px-2 pb-3 text-sm leading-5 transition-colors ${
                                        active
                                            ? "border-b-2 border-[#101828] font-semibold text-[#101828]"
                                            : "font-medium text-[#667085]"
                                    }`}
                                >
                                    {t === "upcoming" ? "Upcoming" : "Past"}
                                </button>
                            );
                        })}
                    </div>
                }
            >
                <div className="size-10 shrink-0" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[#101828]">
                    Bookings
                </p>
                <button
                    type="button"
                    onClick={() => {
                        setDraft(applied);
                        setFilterOpen(true);
                    }}
                    aria-label="Filter"
                    className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <FilterLines className="size-5 text-[#344054]" aria-hidden />
                    {fcount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#658774] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                            {fcount}
                        </span>
                    )}
                </button>
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-[116px]">
                {list.length === 0 && showAppts.length === 0 ? (
                    fcount > 0 ? (
                        <div className="flex flex-1 items-center justify-center">
                            <SearchEmptyState
                                icon={FilterLines}
                                title="No bookings match"
                                description="Try clearing or changing your filters."
                            />
                        </div>
                    ) : (
                        <SearchEmptyState
                            title={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
                            description={
                                tab === "upcoming"
                                    ? "Find a class to book and it'll show up here."
                                    : "Your attended and cancelled classes will appear here."
                            }
                        />
                    )
                ) : (
                    <div className="flex flex-col gap-3">{mergedRows.map((r) => r.el)}</div>
                )}
            </div>

            <BookingsFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                draft={draft}
                onDraftChange={setDraft}
                instructors={instructors}
                categories={categories}
                onSeeAll={() => router.push("/customer/bookings/instructors")}
                onReset={() => {
                    setDraft(EMPTY_BOOKING_FILTERS);
                    bookingsUi.applied = EMPTY_BOOKING_FILTERS;
                    force();
                }}
                onApply={() => {
                    bookingsUi.applied = draft;
                    setFilterOpen(false);
                    force();
                }}
            />
        </div>
    );
}
