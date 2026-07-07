"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Search (`/customer/search`) — Classes + Appointments tabs
// ─────────────────────────────────────────────────────────────────────────────
//
// Two tabs under the shared header (studio chip + filter + bell):
//   • Classes — date-driven group sessions (date selector + class list).
//   • Appointments — bookable services (Private / Open session), no date axis here
//     (date/instructor are chosen in the future booking flow).
// Each tab has its own filter state, persisted across navigation within Search via
// the `searchUi` cache. The Classes filter = Time + Instructor + Categories; the
// Appointments filter = Categories only (same modal, sections hidden).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell01, ChevronDown, FilterLines, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import { addDaysISO, firstOfMonthISO, monthYearOf, REAL_TODAY_ISO, to12h } from "@/lib/customer/dates";
import {
    applyFilters,
    cardPresentation,
    EMPTY_FILTERS,
    filterCount,
    searchUi,
    useDayClasses,
    type SearchFilters,
} from "@/lib/customer/search-data";
import { useAppointments } from "@/lib/customer/appointments-data";
import { useUnreadNotifCount } from "@/lib/customer/notifications-feed";
import { useIsAuthenticated } from "@/lib/customer/auth";
import { useFilterInstructors } from "@/lib/customer/instructors";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { ScheduleDateBar } from "@/components/customer/classes/ScheduleDateBar";
import { ClassScheduleCard } from "@/components/customer/classes/ClassScheduleCard";
import { AppointmentCard } from "@/components/customer/appointments/AppointmentCard";
import { resetAppointmentDraft } from "@/lib/customer/booking-flow";
import { MonthPickerSheet } from "@/components/customer/home/MonthPickerSheet";
import { ClassesFilterModal } from "@/components/customer/home/ClassesFilterModal";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";

type Tab = "classes" | "appointments";

export default function SearchPage() {
    const router = useRouter();
    const { selectedBranchId, timezone } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const categories = useAppStore((s) => s.classCategories);
    const showToast = useAppStore((s) => s.showToast);
    const bookingOpenDays = useAppStore((s) => s.classesSettings.booking_open_value);

    // Search always opens on the Classes tab (Home "Book class" + the Search nav
    // both land here) — the Appointments tab is a deliberate switch, never the
    // default. The rest of the Search state still persists across round-trips.
    const [tab, setTabState] = useState<Tab>("classes");
    useEffect(() => {
        searchUi.tab = "classes";
    }, []);
    const [selectedISO, setSelectedISOState] = useState<string>(() => searchUi.selectedISO ?? REAL_TODAY_ISO);
    const [applied, setAppliedState] = useState<SearchFilters>(() => searchUi.applied);
    const [draft, setDraftState] = useState<SearchFilters>(() => searchUi.draft);
    const [apptApplied, setApptAppliedState] = useState<SearchFilters>(() => searchUi.apptApplied);
    const [apptDraft, setApptDraftState] = useState<SearchFilters>(() => searchUi.apptDraft);
    const [filterOpen, setFilterOpenState] = useState<boolean>(() => searchUi.filterOpen);
    const [monthOpen, setMonthOpen] = useState(false);

    function setTab(t: Tab) {
        searchUi.tab = t;
        setTabState(t);
    }
    function setSelectedISO(iso: string) {
        searchUi.selectedISO = iso;
        setSelectedISOState(iso);
    }
    function setApplied(f: SearchFilters) {
        searchUi.applied = f;
        setAppliedState(f);
    }
    function setDraft(f: SearchFilters) {
        searchUi.draft = f;
        setDraftState(f);
    }
    function setApptApplied(f: SearchFilters) {
        searchUi.apptApplied = f;
        setApptAppliedState(f);
    }
    function setApptDraft(f: SearchFilters) {
        searchUi.apptDraft = f;
        setApptDraftState(f);
    }
    function setFilterOpen(v: boolean) {
        searchUi.filterOpen = v;
        setFilterOpenState(v);
    }

    const isClasses = tab === "classes";
    const isAll = selectedBranchId === ALL_BRANCHES;
    const studioName = isAll ? "All branches" : branches.find((b) => b.id === selectedBranchId)?.name ?? "Select branch";
    const activeCategories = categories.filter((c) => c.status === "active").map((c) => c.name);
    // Shared, branch-scoped instructor list — identical to the Bookings filter.
    const activeInstructors = useFilterInstructors();

    // Active-tab filter wiring.
    const activeDraft = isClasses ? draft : apptDraft;
    const setActiveDraft = isClasses ? setDraft : setApptDraft;
    const activeApplied = isClasses ? applied : apptApplied;
    const setActiveApplied = isClasses ? setApplied : setApptApplied;

    const dayClasses = applyFilters(useDayClasses(selectedISO), applied);
    const appointments = useAppointments(apptApplied);
    const unreadNotifs = useUnreadNotifCount();
    const isAuth = useIsAuthenticated();
    const fcount = filterCount(activeApplied);
    const { month, year } = monthYearOf(selectedISO);
    const todayYear = monthYearOf(REAL_TODAY_ISO).year;

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader
                overlap
                subBar={
                    <div className="flex w-full gap-3 pt-1">
                        {(["classes", "appointments"] as Tab[]).map((t) => {
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
                                    {t === "classes" ? "Classes" : "Appointments"}
                                </button>
                            );
                        })}
                    </div>
                }
            >
                <button
                    type="button"
                    onClick={() => router.push("/customer/select-branch")}
                    aria-label={`Current studio: ${studioName}. Tap to switch.`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[#e4e7ec] bg-white px-3 py-2 text-left transition-colors active:bg-gray-50"
                >
                    <MarkerPin01 className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-base font-normal leading-6 text-[#667085]">
                        {studioName}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-[#667085]" aria-hidden />
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setActiveDraft(activeApplied);
                        setFilterOpen(true);
                    }}
                    aria-label="Filter"
                    className="relative flex shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white p-2.5 transition-colors active:bg-gray-50"
                >
                    <FilterLines className="size-5 text-[#344054]" aria-hidden />
                    {fcount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#658774] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                            {fcount}
                        </span>
                    )}
                </button>

                {isAuth && (
                    <button
                        type="button"
                        onClick={() => router.push("/customer/notifications")}
                        aria-label={unreadNotifs > 0 ? `Notifications, ${unreadNotifs} unread` : "Notifications"}
                        className="relative flex shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white p-2.5 transition-colors active:bg-gray-50"
                    >
                        <Bell01 className="size-5 text-[#344054]" aria-hidden />
                        {unreadNotifs > 0 && (
                            <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#658774] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                                {unreadNotifs > 9 ? "9+" : unreadNotifs}
                            </span>
                        )}
                    </button>
                )}
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-[116px]">
                {isClasses ? (
                    <>
                        <ScheduleDateBar
                            selectedISO={selectedISO}
                            onSelect={setSelectedISO}
                            timezone={timezone}
                            onMonthClick={() => setMonthOpen(true)}
                            onTimezoneClick={() => router.push("/customer/search/timezone")}
                            bookingOpenDays={bookingOpenDays}
                        />

                        {dayClasses.length > 0 ? (
                            <div className="flex flex-col gap-4">
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
                                            timeLabel={c.state === "closed" ? "" : `${to12h(c.startTime)} • ${c.durationMins} mins`}
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
                            <div className="flex min-h-[calc(100dvh-260px)] flex-1 items-center justify-center">
                                <SearchEmptyState />
                            </div>
                        )}
                    </>
                ) : appointments.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {appointments.map((a) => (
                            <AppointmentCard
                                key={a.id}
                                name={a.name}
                                type={a.type}
                                price={a.price}
                                durationMins={a.durationMins}
                                branch={a.branchName}
                                coverImage={a.coverImage}
                                coverColor={a.coverColor}
                                capacity={a.capacity}
                                ctaLabel={isAuth ? "Book now" : "Log in to book"}
                                onBook={() => {
                                    // Guests must log in before starting a booking flow.
                                    if (!isAuth) {
                                        router.push("/customer/auth");
                                        return;
                                    }
                                    // Fresh entry — clear any abandoned instructor/slot pick.
                                    resetAppointmentDraft();
                                    router.push(
                                        a.type === "private"
                                            ? `/customer/appointments/${a.id}/instructor`
                                            : `/customer/appointments/${a.id}/slot`,
                                    );
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[calc(100dvh-260px)] flex-1 items-center justify-center">
                        <SearchEmptyState
                            title="No appointment found"
                            description="Try selecting another branch to find available appointments."
                        />
                    </div>
                )}
            </div>

            <MonthPickerSheet
                open={monthOpen}
                onClose={() => setMonthOpen(false)}
                month={month}
                year={year}
                minYear={todayYear}
                maxYear={todayYear + 1}
                onApply={(m, y) => {
                    const first = firstOfMonthISO(m, y);
                    const lastBookable = addDaysISO(REAL_TODAY_ISO, bookingOpenDays);
                    setSelectedISO(first < REAL_TODAY_ISO ? REAL_TODAY_ISO : first > lastBookable ? lastBookable : first);
                }}
            />
            <ClassesFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                draft={activeDraft}
                onDraftChange={setActiveDraft}
                showTime={isClasses}
                showInstructor={isClasses}
                categories={activeCategories}
                instructors={activeInstructors}
                onSeeAll={() => router.push("/customer/search/instructors")}
                onReset={() => {
                    setActiveDraft(EMPTY_FILTERS);
                    setActiveApplied(EMPTY_FILTERS);
                }}
                onApply={() => {
                    setActiveApplied(activeDraft);
                    setFilterOpen(false);
                }}
            />
        </div>
    );
}
