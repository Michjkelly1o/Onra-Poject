"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Search (`/customer/search`) — Classes / Private / Recovery tabs
// ─────────────────────────────────────────────────────────────────────────────
//
// Three tabs under the shared header (studio chip + filter + bell):
//   • Classes  — date-driven group sessions (date selector + class list).
//   • Private  — bookable 1:1 private services (no date axis here).
//   • Recovery — bookable recovery / wellness services (no date axis here).
// Private and Recovery mirror the admin session-type split; each is pinned to its
// own service type. Classes has its own filter state; Private + Recovery share a
// Categories-only filter. State persists across navigation via the `searchUi`
// cache. The Classes filter = Time + Instructor + Categories.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { loginHref } from "@/lib/customer/auth-flow";
import { ChevronDown, Sliders02, MarkerPin01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import { addDaysISO, REAL_TODAY_ISO, to12h } from "@/lib/customer/dates";
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
import { NotificationBell } from "@/components/customer/shell/NotificationBell";
import { ScheduleDateBar } from "@/components/customer/classes/ScheduleDateBar";
import { ReviewBookSheet } from "@/components/customer/classes/ReviewBookSheet";
import { AppointmentBookingFlow } from "@/components/customer/appointments/AppointmentBookingSheets";
import { ClassScheduleCard } from "@/components/customer/classes/ClassScheduleCard";
import { AppointmentCard } from "@/components/customer/appointments/AppointmentCard";
import { resetAppointmentDraft } from "@/lib/customer/booking-flow";
import { ClassesFilterModal } from "@/components/customer/home/ClassesFilterModal";
import { BranchSelectorSheet } from "@/components/customer/branch/BranchSelectorSheet";
import { TimeZoneSheet } from "@/components/customer/shell/TimeZoneSheet";
import { branchTimezone } from "@/lib/branch-time";
import { offsetForCity, offsetLabel, shouldAutoOpenTzSheet, tzGate } from "@/lib/customer/timezones";
import { timeInZoneLabel } from "@/lib/customer/class-time";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";

// Three tabs, matching the admin Private/Recovery split — "Appointments" is no
// longer a single lumped tab (client 2026-07-30).
type Tab = "classes" | "private" | "recovery";
const TAB_LABEL: Record<Tab, string> = { classes: "Classes", private: "Private", recovery: "Recovery" };

export default function SearchPage() {
    const router = useRouter();
    const pathname = usePathname();
    const { selectedBranchId, timezone, setTimezone, localTimezone } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const categories = useAppStore((s) => s.classCategories);
    const showToast = useAppStore((s) => s.showToast);
    const bookingOpenDays = useAppStore((s) => s.classesSettings.booking_open_value);

    // Search always opens on the Classes tab (Home "Book class" + the Search nav
    // both land here) — the Appointments tab is a deliberate switch, never the
    // default. The rest of the Search state still persists across round-trips.
    // A Home discover rail can request a specific tab via `searchUi.forceTab`
    // (one-shot) — honour it once, otherwise Search always opens on Classes.
    const [tab, setTabState] = useState<Tab>(() => searchUi.forceTab ?? "classes");
    useEffect(() => {
        searchUi.tab = searchUi.forceTab ?? "classes";
        searchUi.forceTab = undefined;
    }, []);
    const [selectedISO, setSelectedISOState] = useState<string>(() => searchUi.selectedISO ?? REAL_TODAY_ISO);
    const [applied, setAppliedState] = useState<SearchFilters>(() => searchUi.applied);
    const [draft, setDraftState] = useState<SearchFilters>(() => searchUi.draft);
    const [apptApplied, setApptAppliedState] = useState<SearchFilters>(() => searchUi.apptApplied);
    const [apptDraft, setApptDraftState] = useState<SearchFilters>(() => searchUi.apptDraft);
    const [filterOpen, setFilterOpenState] = useState<boolean>(() => searchUi.filterOpen);
    const [branchSheet, setBranchSheet] = useState(false);
    const [tzOpen, setTzOpen] = useState(false);
    // Review & Book bottom sheet, opened directly over Search from a class card.
    const [bookSheet, setBookSheet] = useState<{ classId: string; mode: "book" | "waitlist" } | null>(null);
    // Private/Recovery appointment booking, run as chained sheets over Search.
    const [apptFlow, setApptFlow] = useState<string | null>(null);
    // Out-of-zone gate: when the customer's device zone differs from the branch,
    // show the Time Zone sheet ONCE on entry (their local zone pre-selected as
    // "Your time") so they confirm before browsing class times.
    const tzBranch = branches.find((b) => b.id === selectedBranchId) ?? branches.find((b) => b.status === "active") ?? branches[0];
    const outOfZone = tzBranch ? offsetLabel(branchTimezone(tzBranch)) !== offsetForCity(localTimezone) : false;
    useEffect(() => {
        // Auto-open once per BRANCH ZONE: marked seen the moment it opens, so
        // navigating away and back (e.g. Class Details → Search) never re-opens
        // it, whether or not the customer tapped Confirm. Switching to a branch
        // in a different zone prompts again — the old offset no longer applies.
        if (outOfZone && tzBranch && shouldAutoOpenTzSheet(branchTimezone(tzBranch))) {
            setTzOpen(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outOfZone, tzBranch?.id]);

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

    // On the Private / Recovery tabs, the appointment list is pinned to that
    // service type (the tab IS the type — no separate type filter).
    const apptType = tab === "classes" ? undefined : tab;
    const allDayClasses = useDayClasses(selectedISO);
    const dayClasses = applyFilters(allDayClasses, applied);
    const appointments = useAppointments(apptApplied, apptType);
    // What the DRAFT selection would return — recomputed on every toggle so the
    // filter's primary action reads "Show N results" live.
    const draftAppointments = useAppointments(apptDraft, apptType);
    const draftResultCount = isClasses ? applyFilters(allDayClasses, draft).length : draftAppointments.length;
    const unreadNotifs = useUnreadNotifCount();
    const isAuth = useIsAuthenticated();
    const fcount = filterCount(activeApplied);

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader
                overlap
                subBar={
                    <div className="flex w-full gap-3 pt-1">
                        {(["classes", "private", "recovery"] as Tab[]).map((t) => {
                            const active = tab === t;
                            return (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setTab(t)}
                                    className={`flex h-8 flex-1 items-center justify-center px-2 pb-3 text-sm leading-5 transition-colors ${
                                        active
                                            ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
                                            : "font-medium text-[var(--colors-text-quaternary)]"
                                    }`}
                                >
                                    {TAB_LABEL[t]}
                                </button>
                            );
                        })}
                    </div>
                }
            >
                <button
                    type="button"
                    onClick={() => setBranchSheet(true)}
                    aria-label={`Current studio: ${studioName}. Tap to switch.`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--colors-border-secondary)] bg-white px-3 py-2 text-left transition-colors active:bg-gray-50"
                >
                    <MarkerPin01 className="size-5 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-base font-normal leading-6 text-[var(--colors-text-quaternary)]">
                        {studioName}
                    </span>
                    <ChevronDown className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setActiveDraft(activeApplied);
                        setFilterOpen(true);
                    }}
                    aria-label="Filter"
                    className="relative flex shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white p-2.5 transition-colors active:bg-gray-50"
                >
                    <Sliders02 className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    {fcount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                            {fcount}
                        </span>
                    )}
                </button>

                {isAuth && (
                    <NotificationBell count={unreadNotifs} onClick={() => router.push("/customer/notifications")} />
                )}
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-[116px]">
                {isClasses ? (
                    <>
                        <ScheduleDateBar
                            selectedISO={selectedISO}
                            onSelect={setSelectedISO}
                            timezone={timezone}
                            onTimezoneClick={() => setTzOpen(true)}
                            bookingOpenDays={bookingOpenDays}
                        />

                        {/* Result total — shown whenever a filter narrows the list. */}
                        {fcount > 0 && (
                            <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">
                                {dayClasses.length} result{dayClasses.length === 1 ? "" : "s"}
                            </p>
                        )}
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
                                            timeLabel={`${timeInZoneLabel(c.dateISO, c.startTime, branches.find((b) => b.id === c.branchId), timezone)} • ${c.durationMins} mins`}
                                            badgeLabel={p.badgeLabel}
                                            badgeTone={p.badgeTone}
                                            badgeIcon={p.badgeIcon}
                                            statusPill={p.statusPill}
                                            ctaLabel={p.ctaLabel}
                                            ctaVariant={p.ctaVariant}
                                            ctaDisabled={false}
                                            onAction={() => router.push(`/customer/classes/${c.id}`)}
                                            onBook={() => {
                                                // Book now / Join waitlist open the Review & Book sheet right
                                                // over Search (background stays); other states open details.
                                                if (!isAuth) {
                                                    router.push(loginHref(`/customer/classes/${c.id}`));
                                                } else if (c.state === "available") {
                                                    setBookSheet({ classId: c.id, mode: "book" });
                                                } else if (c.state === "waitlist") {
                                                    setBookSheet({ classId: c.id, mode: "waitlist" });
                                                } else {
                                                    router.push(`/customer/classes/${c.id}`);
                                                }
                                            }}
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
                                        router.push(loginHref(pathname));
                                        return;
                                    }
                                    // Fresh entry — clear any abandoned instructor/slot pick,
                                    // then open the booking flow as sheets over Search.
                                    resetAppointmentDraft();
                                    setApptFlow(a.id);
                                }}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex min-h-[calc(100dvh-260px)] flex-1 items-center justify-center">
                        <SearchEmptyState
                            title={tab === "recovery" ? "No recovery session found" : "No private session found"}
                            description="Try selecting another branch to find available sessions."
                        />
                    </div>
                )}
            </div>

            <ReviewBookSheet
                open={bookSheet != null}
                classId={bookSheet?.classId ?? ""}
                mode={bookSheet?.mode ?? "book"}
                onClose={() => setBookSheet(null)}
            />

            <AppointmentBookingFlow
                appointmentId={apptFlow ?? ""}
                open={apptFlow != null}
                onClose={() => setApptFlow(null)}
            />

            <BranchSelectorSheet open={branchSheet} onClose={() => setBranchSheet(false)} />

            <TimeZoneSheet
                open={tzOpen}
                onClose={() => {
                    tzGate.shownForZone = tzBranch ? branchTimezone(tzBranch) : tzGate.shownForZone;
                    setTzOpen(false);
                }}
                branch={branches.find((b) => b.id === selectedBranchId) ?? branches.find((b) => b.status === "active") ?? branches[0]}
                localCity={localTimezone}
                value={timezone}
                onSelect={(city) => {
                    setTimezone(city);
                    setTzOpen(false);
                }}
                onConfirm={() => {
                    tzGate.shownForZone = tzBranch ? branchTimezone(tzBranch) : tzGate.shownForZone;
                }}
            />

            <ClassesFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                draft={activeDraft}
                onDraftChange={setActiveDraft}
                showTime={isClasses}
                showInstructor={isClasses}
                showType={false}
                categories={activeCategories}
                instructors={activeInstructors}
                onSeeAll={() => router.push("/customer/search/instructors")}
                resultCount={draftResultCount}
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
