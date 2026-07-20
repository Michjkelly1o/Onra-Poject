"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — BookingsView (shared) — Figma 2134-28989 / 2175-30812
// ─────────────────────────────────────────────────────────────────────────────
//
// The bookings list, rendered as TWO separate pages (Upcoming / Past) rather than
// one tabbed page — the `tab` prop fixes which set is shown and drives the header
// title ("Upcoming bookings" / "Past bookings"). A level-2 page (back → Profile,
// no bottom nav). Each row is the shared <BookingCard>; tapping opens the Booking
// Detail. The filter modal (Type · Date range · Instructor · Categories) narrows
// the list. Filter state persists across detail round-trips via a module cache.

import { useEffect, useMemo, useReducer, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "@/lib/customer/auth-flow";
import { ChevronLeft, FilterLines, RefreshCcw01, SlashCircle01 } from "@untitledui/icons";
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
import { useAppStore } from "@/lib/store";

function fmtShortDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** ISO date → "Wed 15 Jul 2026" for the day group headers. */
function dayLabelOf(dateISO: string): string {
    return new Date(`${dateISO}T00:00:00`)
        .toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
        .replace(",", "");
}

export function BookingsView({ tab }: { tab: BookingTab }) {
    const router = useRouter();
    const pathname = usePathname();
    // Bookings is auth-only — a guest (reachable by deep link) is redirected to
    // the login front door.
    const isAuth = useIsAuthenticated();
    useEffect(() => {
        if (!isAuth) router.replace(loginHref(pathname));
    }, [isAuth, router]);
    // Keep the module cache in sync with this page so the "See all" instructor
    // round-trip + notification deep-links stay coherent.
    useEffect(() => {
        bookingsUi.tab = tab;
    }, [tab]);

    const { upcoming, past } = useMemberBookings();
    // Booked appointments (UI-only store) show alongside class bookings: active
    // future ones under Upcoming, cancelled/past ones under Past.
    const apptBookings = useAppointmentBookings();
    const apptSplit = useMemo(() => {
        return {
            upcoming: apptBookings.filter((a) => a.status !== "cancelled" && a.slotISO >= REAL_TODAY_ISO),
            past: apptBookings.filter((a) => a.status === "cancelled" || a.slotISO < REAL_TODAY_ISO),
        };
    }, [apptBookings]);
    const showAppts = tab === "upcoming" ? apptSplit.upcoming : apptSplit.past;
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

    const applied = bookingsUi.applied;
    const baseList = tab === "upcoming" ? upcoming : past;
    const list = applyBookingFilters(baseList, applied);
    const fcount = bookingFilterCount(applied);

    // Session type per appointment booking — from the live service (fallback:
    // open sessions are recovery, everything else private) — so the Type filter
    // can split Private vs Recovery appointments.
    const services = useAppStore((s) => s.services);
    const serviceType = useMemo(() => new Map(services.map((s) => [s.id, s.type])), [services]);
    // Shared predicate so the applied list and the filter modal's live
    // "Show N results" count can never disagree about what a filter means.
    const matchesApptFilters = (a: (typeof showAppts)[number], f: BookingFilters) => {
        if (f.type === "Classes") return false;
        const sType = serviceType.get(a.appointmentId) ?? (a.type === "open" ? "recovery" : "private");
        if (f.type === "Private" && sType !== "private") return false;
        if (f.type === "Recovery" && sType !== "recovery") return false;
        return (
            (f.instructorIds.length === 0 || (a.instructorId != null && f.instructorIds.includes(a.instructorId))) &&
            (f.categories.length === 0 || f.categories.includes(a.category)) &&
            (!f.dateFrom || a.slotISO >= f.dateFrom) &&
            (!f.dateTo || a.slotISO <= f.dateTo)
        );
    };
    const filteredAppts = showAppts.filter((a) => matchesApptFilters(a, applied));
    // Live count for the DRAFT selection — classes + appointments, same as the
    // merged list the customer is about to see.
    const draftResultCount =
        applyBookingFilters(baseList, draft).length + showAppts.filter((a) => matchesApptFilters(a, draft)).length;

    // Merge appointments + class bookings into ONE list sorted by date/time —
    // Upcoming = soonest first, Past = most recent first.
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
                    name={b.guestName ? `${b.name} · Guest: ${b.guestName}` : b.name}
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

    // Group by day for the section headers ("Wed 15 Jul 2026").
    const dayGroups: { key: string; label: string; rows: typeof mergedRows }[] = [];
    for (const row of mergedRows) {
        const key = row.sortKey.slice(0, 10);
        const last = dayGroups[dayGroups.length - 1];
        if (last && last.key === key) last.rows.push(row);
        else dayGroups.push({ key, label: dayLabelOf(key), rows: [row] });
    }

    const instructors = useFilterInstructors();
    const categories = useMemo(() => {
        const cats = new Set<string>();
        for (const b of [...upcoming, ...past]) cats.add(b.category);
        for (const a of apptBookings) if (a.category) cats.add(a.category);
        return Array.from(cats);
    }, [upcoming, past, apptBookings]);

    if (!isAuth) return null;

    return (
        <div className="flex min-h-[100dvh] flex-col">
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
                                    onClick={() => router.replace(`/customer/bookings/${t}`)}
                                    className={`flex h-8 flex-1 items-center justify-center px-2 pb-3 text-sm leading-5 transition-colors ${
                                        active
                                            ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
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
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile")}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">Bookings</p>
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
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                            {fcount}
                        </span>
                    )}
                </button>
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-4 pt-[116px]">
                {/* Result total — shown whenever a filter narrows the list. */}
                {fcount > 0 && (
                    <p className="pb-3 text-sm font-normal leading-5 text-[#475467]">
                        {list.length + filteredAppts.length} result{list.length + filteredAppts.length === 1 ? "" : "s"}
                    </p>
                )}
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
                        <div className="flex flex-1 items-center justify-center">
                            <SearchEmptyState
                                title={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
                                description={
                                    tab === "upcoming"
                                        ? "Find a class to book and it'll show up here."
                                        : "Your attended and cancelled classes will appear here."
                                }
                            />
                        </div>
                    )
                ) : (
                    <div className="flex flex-col gap-6">
                        {dayGroups.map((g) => (
                            <div key={g.key} className="flex flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{g.label}</p>
                                <div className="flex flex-col gap-3">{g.rows.map((r) => r.el)}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <BookingsFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                draft={draft}
                onDraftChange={setDraft}
                resultCount={draftResultCount}
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
