"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor Earnings · Class details (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   Cancelled class · Booked     — 6616:333535
//   Cancelled class · Waitlisted — 6616:333744
//   Cancelled class · Cancelled  — 6616:333836
//   Completed class · Booked     — 6616:333463
//   Completed class · Waitlisted — 6616:333695
//   Completed class · Cancelled  — 6616:333793
//   Completed class · Reviews    — 6616:333879
//   Reviews filter side panel    — 6616:334154
//
// **Per the brief: "MOSTLY THIS MODULE IS THE DUPLICATION OF THE MODULE IN
// ADMIN SIDE"** — every primitive on this page comes from the admin class
// detail at [/schedule/[classId]/page.tsx](src/app/schedule/[classId]/page.tsx):
//   • Same left-sidebar layout (cover → status badge → name → meta rows →
//     rating summary)
//   • Same tab strip pattern (border-b underline + count badge)
//   • Same filter side panel architecture (FilterPill multi-select +
//     Clear / Apply footer)
//   • Same per-status status-badge palette (Completed = mint, Cancelled = red)
//
// Instructor-specific simplifications: NO bulk actions, NO row actions, NO
// "Add customer" / "Cancel class". The page is read-only — the instructor
// is reviewing what happened, not editing.
//
// ──────────────────────────────────────────────────────────────────
// ROLE-SCOPED VIEW — reads the SAME centralized store the admin page
// reads. Per-instructor scoping: if the class's `instructorId` doesn't
// match the current staff id, we redirect back to the earnings list
// (instructors should never see another instructor's class detail).
// ──────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    XClose, SearchMd, FilterLines, Star01, User01,
    CheckCircle, AlertCircle, Calendar,
} from "@untitledui/icons";
import {
    useAppStore,
    type ClassSchedule, type ClassStatus, type ClassBooking,
    type ClassRating, type Customer,
} from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { FilterPill } from "@/components/ui/FilterPill";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { TableAvatar } from "@/components/ui/avatar";
import {
    PresentBadge,
    NoShowBadge,
    BookingStatusBadge as RowCancellationBadge,
    cancellationBadgeKind,
} from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ────────────────────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────────────────────

/** Spot labels for the "Spot" column — A1..A4 then B1..B4. The seed data
 *  doesn't currently carry a per-booking spot id, so we synthesize one
 *  deterministically off the row index, matching the Figma's A/B grid. */
function spotLabelFor(index: number): string {
    const row = Math.floor(index / 4);
    const col = (index % 4) + 1;
    return `${String.fromCharCode(65 + row)}${col}`;
}

/** Six "What stood out" tags — match the Figma 6616:334154 filter panel. */
const STOOD_OUT_TAGS = ["Instructor", "Atmosphere", "Difficulty", "Pacing", "Music", "Equipment"];

/** Star ratings — five chips, 5 down to 1. */
const RATING_VALUES = [5, 4, 3, 2, 1];

// ────────────────────────────────────────────────────────────────────────────
// Status badge — same shape across admin + instructor
// ────────────────────────────────────────────────────────────────────────────

/** Class status badge — VERBATIM admin's
 *  [/schedule/[classId]/page.tsx:65](src/app/schedule/[classId]/page.tsx).
 *  Same `px-[10px] py-[2px] text-[13px]` + `border-1` per status, exact
 *  color tokens admin uses on the class-detail sidebar. */
/** "First timer" pill from Figma 6616:333463. Indigo tone. */
function FirstTimerBadge() {
    return (
        <span className="inline-flex items-center px-[8px] py-[1px] rounded-full text-[12px] font-medium bg-[#eef4ff] border-1 border-[#c7d7fe] text-[#3538cd]">
            First timer
        </span>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab + filter state
// ────────────────────────────────────────────────────────────────────────────

type TabKey = "booked" | "waitlisted" | "cancelled" | "reviews";

interface ReviewFilterState {
    startDate: string;
    endDate:   string;
    tags:      string[];
    ratings:   number[];
}
const EMPTY_REVIEW_FILTER: ReviewFilterState = {
    startDate: "",
    endDate: "",
    tags: [],
    ratings: [],
};
function reviewFilterHasAny(f: ReviewFilterState): boolean {
    return f.startDate !== "" || f.endDate !== ""
        || f.tags.length > 0 || f.ratings.length > 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Time helper
// ────────────────────────────────────────────────────────────────────────────

function fmtBookingTime(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    let h = d.getHours();
    const mm = String(d.getMinutes()).padStart(2, "0");
    const period = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${y}-${m}-${day}, ${String(h).padStart(2, "0")}:${mm} ${period}`;
}

function fmtFullDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
        weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
}

function diffMinutes(startHHMM: string, endHHMM: string): number {
    const [sh, sm] = startHHMM.split(":").map(n => parseInt(n, 10));
    const [eh, em] = endHHMM.split(":").map(n => parseInt(n, 10));
    if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return 0;
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
}

// ────────────────────────────────────────────────────────────────────────────
// Main page
// ────────────────────────────────────────────────────────────────────────────

export default function InstructorClassDetailPage() {
    const router = useRouter();
    const params = useParams();
    const classId = String(params.classId ?? "");
    // X-close target — driven by `?returnTo=` so closing this page
    // lands back wherever the user came from (earnings list OR schedule
    // popup). Default is the earnings list since that's the page's
    // canonical entry point.
    const searchParams = useSearchParams();
    const returnTo = searchParams?.get("returnTo") || "/instructor/earnings";

    const currentUser     = useAppStore(s => s.currentUser);
    const currentRole     = useAppStore(s => s.currentRole);
    const setCurrentUser  = useAppStore(s => s.setCurrentUser);
    const classSchedules  = useAppStore(s => s.classSchedules);
    const classBookings   = useAppStore(s => s.classBookings);
    const classRatings    = useAppStore(s => s.classRatings);
    const customers       = useAppStore(s => s.customers);

    // The page lives at `/earnings/[classId]` — outside the instructor
    // layout — so the persona auto-flip from `InstructorLayout` doesn't
    // fire here. Flip on mount the same way so deep-linking into a class
    // detail still shows the instructor as the active user.
    useEffect(() => {
        if (currentRole !== "instructor") setCurrentUser(instructor_profile);
    }, [currentRole, setCurrentUser]);

    const staffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;

    const cls = useMemo(
        () => classSchedules.find(c => c.id === classId),
        [classSchedules, classId],
    );

    // Bounce non-owners back to the list — instructors should not see
    // another instructor's class detail.
    useEffect(() => {
        if (cls && cls.instructorId !== staffId) {
            router.replace("/instructor/earnings");
        }
    }, [cls, staffId, router]);

    const isCompleted = cls?.status === "Completed";
    const isCancelled = cls?.status === "Cancelled";

    // ── Bookings + ratings scoped to this class ──
    const bookings = useMemo(
        () => classBookings.filter(b => b.classScheduleId === classId),
        [classBookings, classId],
    );
    const ratings = useMemo(
        () => classRatings.filter(r => r.classScheduleId === classId && !r.deletedAt),
        [classRatings, classId],
    );

    const customerById = useMemo(
        () => new Map<string, Customer>(customers.map(c => [c.id, c])),
        [customers],
    );

    // ── Per-tab booking partition — **tab-preservation cancel model** ──
    //
    // Bookings keep their ORIGINAL `status` regardless of the parent
    // class's state. On a Cancelled class, the row's status BADGE flips
    // to "Cancelled" in the Booked tab — but the row stays on the
    // Booked tab. Mirrors admin
    // ([/schedule/[classId]/page.tsx](src/app/schedule/[classId]/page.tsx))
    // and the store mutator ([store.ts cancelClassSchedule](src/lib/store.ts)):
    // when admin or instructor cancels the class, both detail pages
    // render the SAME view — Booked tab full, Waitlisted tab full,
    // Cancelled tab still shows customer-self-cancellations only.
    const bookedList = useMemo(
        () => bookings.filter(b => b.status === "booked"),
        [bookings],
    );

    const waitlistList = useMemo(
        () => bookings
            .filter(b => b.status === "waitlisted")
            .sort((a, b) => (a.waitlistPosition ?? 99) - (b.waitlistPosition ?? 99)),
        [bookings],
    );

    const cancelledList = useMemo(
        () => bookings.filter(b => b.status === "cancelled"),
        [bookings],
    );

    // ── Tab definitions (Reviews only when Completed) ──
    type Tab = { id: TabKey; label: string; count: number };
    const tabs: Tab[] = useMemo(() => {
        const base: Tab[] = [
            { id: "booked",      label: "Booked",     count: bookedList.length },
            { id: "waitlisted",  label: "Waitlisted", count: waitlistList.length },
            { id: "cancelled",   label: "Cancelled",  count: cancelledList.length },
        ];
        if (isCompleted) {
            base.push({ id: "reviews", label: "Reviews & Rating", count: ratings.length });
        }
        return base;
    }, [bookedList.length, waitlistList.length, cancelledList.length, ratings.length, isCompleted]);

    const [tab, setTab] = useState<TabKey>("booked");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Filter side panel (Reviews tab only)
    const [reviewFilter, setReviewFilter] = useState<ReviewFilterState>(EMPTY_REVIEW_FILTER);
    const [filterOpen, setFilterOpen] = useState(false);

    // ── Search + filter pipeline per tab ──
    function customerNameOf(b: ClassBooking | ClassRating): string {
        const cust = customerById.get(b.customerId);
        return cust ? `${cust.firstName} ${cust.lastName}`.trim() : "Unknown";
    }

    function bookingMatchesSearch(b: ClassBooking): boolean {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const cust = customerById.get(b.customerId);
        const hay = `${cust?.firstName ?? ""} ${cust?.lastName ?? ""} ${cust?.email ?? ""}`.toLowerCase();
        return hay.includes(q);
    }

    const filteredBooked     = useMemo(() => bookedList.filter(bookingMatchesSearch),    [bookedList, search, customerById]);
    const filteredWaitlisted = useMemo(() => waitlistList.filter(bookingMatchesSearch), [waitlistList, search, customerById]);
    const filteredCancelled  = useMemo(() => cancelledList.filter(bookingMatchesSearch), [cancelledList, search, customerById]);

    const filteredReviews = useMemo(() => {
        const q = search.trim().toLowerCase();
        return ratings.filter(r => {
            if (q) {
                const name = customerNameOf(r).toLowerCase();
                if (!name.includes(q) && !r.comment.toLowerCase().includes(q)) return false;
            }
            if (reviewFilter.startDate && r.submittedAt.slice(0, 10) < reviewFilter.startDate) return false;
            if (reviewFilter.endDate   && r.submittedAt.slice(0, 10) > reviewFilter.endDate)   return false;
            if (reviewFilter.ratings.length > 0 && !reviewFilter.ratings.includes(Math.floor(r.score))) return false;
            if (reviewFilter.tags.length > 0) {
                const rowTags = r.tags ?? [];
                if (!reviewFilter.tags.some(t => rowTags.includes(t))) return false;
            }
            return true;
        });
    }, [ratings, search, reviewFilter, customerById]);

    // Reset page when filters / search / tab change.
    useEffect(() => { setPage(1); }, [search, reviewFilter, tab, pageSize]);

    // ── Loading guard ──
    if (!cls) {
        return (
            <div className="h-screen bg-white flex flex-col overflow-hidden">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button
                        type="button"
                        onClick={() => router.push(returnTo)}
                        aria-label="Back to earnings"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class details</h1>
                </div>
                <div className="relative flex-1">
                    <EmptyState
                        title="Class not found"
                        subtitle="The class you're looking for doesn't exist or was removed."
                        icon={AlertCircle}
                    />
                </div>
                <Toast />
            </div>
        );
    }

    return (
        // Full-screen takeover — EXACT shell admin uses on /schedule/[classId]:
        //   h-screen + bg-white, h-[72px] header strip, scrollable content
        //   area at flex-1 with px-6 py-6 + two-column flex inside at h-[832px].
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={() => router.push(returnTo)}
                    aria-label="Back to earnings"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Class details</h1>
            </div>

            {/* Two-column content area — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={<ClassSidebar cls={cls} avgRating={avgRating(ratings)} ratingCount={ratings.length} />}
                main={<>

                {/* Right panel — same shell as admin's right panel:
                    border + rounded-[20px], no shadow, white bg via the
                    page-level white container. */}
                <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px] relative">
                    {/* Tabs */}
                    <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-5">
                        <div className="flex gap-1">
                            {tabs.map(t => (
                                <TabButton
                                    key={t.id}
                                    label={t.label}
                                    count={t.count}
                                    active={tab === t.id}
                                    onClick={() => setTab(t.id)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Toolbar — Total + Search (+ Filter on Reviews tab) */}
                    <div className="shrink-0 flex items-center justify-between gap-3 px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-[14px] text-[#475467] leading-5">Total</span>
                            <span className="text-[16px] font-semibold text-[#101828] leading-6">
                                {tab === "reviews"
                                    ? `${filteredReviews.length} rating${filteredReviews.length === 1 ? "" : "s"}`
                                    : `${tabCount(tab, filteredBooked, filteredWaitlisted, filteredCancelled)} customer${tabCount(tab, filteredBooked, filteredWaitlisted, filteredCancelled) === 1 ? "" : "s"}`}
                            </span>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="relative w-[280px]">
                                <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder={tab === "reviews" ? "Search rating..." : "Search customer..."}
                                    className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                />
                            </div>

                            {tab === "reviews" && (
                                <Button
                                    variant="secondary-gray"
                                    size="md"
                                    leftIcon={
                                        <div className="relative">
                                            <FilterLines className="w-4 h-4" />
                                            {reviewFilterHasAny(reviewFilter) && (
                                                <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />
                                            )}
                                        </div>
                                    }
                                    onClick={() => setFilterOpen(true)}
                                >
                                    Filter
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Tab content — scrollable, takes remaining vertical
                        space so Pagination below stays pinned and visible. */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide px-6 pb-2">
                        {tab === "booked" && (
                            <BookedTable
                                rows={filteredBooked}
                                customerById={customerById}
                                classStatus={cls.status}
                                page={page}
                                pageSize={pageSize}
                            />
                        )}
                        {tab === "waitlisted" && (
                            <WaitlistTable
                                rows={filteredWaitlisted}
                                customerById={customerById}
                                page={page}
                                pageSize={pageSize}
                            />
                        )}
                        {tab === "cancelled" && (
                            <CancelledTable
                                rows={filteredCancelled}
                                customerById={customerById}
                                cls={cls}
                                page={page}
                                pageSize={pageSize}
                            />
                        )}
                        {tab === "reviews" && (
                            <ReviewsTable
                                rows={filteredReviews}
                                customerById={customerById}
                                page={page}
                                pageSize={pageSize}
                            />
                        )}
                    </div>

                    {/* Pagination — admin's canonical Pagination, pinned at
                        the bottom of the right panel via `shrink-0` inside
                        the Pagination component itself. */}
                    <div className="px-6 shrink-0">
                        <Pagination
                            page={page}
                            total={paginationTotal(tab, filteredBooked, filteredWaitlisted, filteredCancelled, filteredReviews)}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={(s) => { setPageSize(s); setPage(1); }}
                        />
                    </div>
                </div>
                </>}
            />

            {/* ── Reviews filter side panel — admin's verbatim ─────── */}
            <ReviewFilterPanel
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                applied={reviewFilter}
                onApply={setReviewFilter}
            />

            {/* Standalone Toast — instructor layout isn't wrapping us, so
                we render the toast portal ourselves. */}
            <Toast />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Sidebar — class meta + rating summary
// ────────────────────────────────────────────────────────────────────────────

/** Sidebar — VERBATIM admin `LeftPanel` from
 *  [/schedule/[classId]/page.tsx:1737](src/app/schedule/[classId]/page.tsx).
 *  Same w-[320px] shell, same banner, same name/description fonts, same
 *  field grid (date & time full width → class type + gender access in
 *  2-col → duration/capacity/location full width), same `font-medium`
 *  value weight (admin uses MEDIUM, not SEMIBOLD), same rating summary. */
function ClassSidebar({ cls, avgRating, ratingCount }: {
    cls: ClassSchedule;
    avgRating: number;
    ratingCount: number;
}) {
    const genderText = cls.genderAccess === "female" ? "Female only"
                     : cls.genderAccess === "male"   ? "Male only"
                     : "All genders";
    return (
        <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div
                className="relative h-[155px] shrink-0 overflow-hidden"
                style={{ backgroundColor: cls.coverColor || "#aad4bd" }}
            >
                {cls.coverImage ? (
                    <img
                        src={cls.coverImage}
                        alt={cls.name}
                        className="absolute inset-0 w-full h-full object-cover"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[36px] font-bold" style={{ color: "#3b5446" }}>
                            {cls.name.split(" ").map(w => w[0]).join("").slice(0, 2)}
                        </span>
                    </div>
                )}
                <div className="absolute top-3 right-3">
                    <StatusBadge type="class-detail" status={cls.status} />
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    {/* Name + description */}
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{cls.name}</h2>
                        <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-2">
                            {cls.description || "—"}
                        </p>
                    </div>

                    {/* Info fields — admin's exact layout */}
                    <div className="flex flex-col gap-3">
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Date &amp; time</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {fmtFullDate(cls.dateISO)} • {cls.displayTime}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Class type</p>
                                <p className="text-[16px] font-medium text-[#101828]">{cls.classType} class</p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[14px] text-[#667085]">Gender access</p>
                                <p className="text-[16px] font-medium text-[#101828]">{genderText}</p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Duration</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {diffMinutes(cls.startTime, cls.endTime)} minutes
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Class capacity</p>
                            <p className="text-[16px] font-medium text-[#101828]">
                                {cls.capacity} participants
                            </p>
                        </div>
                        <div className="flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Location</p>
                            <p className="text-[16px] font-medium text-[#101828]">{cls.room || "—"}</p>
                        </div>
                    </div>
                </div>

                {/* Rating summary at the bottom — instructor sidebar always
                    shows it since the page only renders for completed +
                    cancelled classes (which is where ratings apply). */}
                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-3">Rating summary</p>
                    <RatingStars rating={avgRating} size="lg" />
                    <p className="text-[18px] font-semibold text-[#101828] leading-7 mt-2">
                        {avgRating > 0 ? avgRating.toFixed(1) : "0"}
                        <span className="text-[14px] font-normal text-[#667085]"> ({ratingCount} ratings)</span>
                    </p>
                </div>
            </div>
        </div>
    );
}

function avgRating(rs: ClassRating[]): number {
    if (rs.length === 0) return 0;
    const sum = rs.reduce((s, r) => s + r.score, 0);
    return sum / rs.length;
}

// ────────────────────────────────────────────────────────────────────────────
// Tab button
// ────────────────────────────────────────────────────────────────────────────

function TabButton({ label, count, active, onClick }: {
    label: string; count: number; active: boolean; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-[48px] px-3 text-[14px] font-semibold transition-colors flex items-center gap-2 whitespace-nowrap",
                active ? "border-b-2 border-[#101828] text-[#101828]" : "text-[#667085] hover:text-[#344054]",
            )}
        >
            {label}
            <span className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium",
                active
                    ? "bg-[#f2f4f7] text-[#344054]"
                    : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#667085]",
            )}>
                {count}
            </span>
        </button>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Booked tab table
// ────────────────────────────────────────────────────────────────────────────

interface BookedTableProps {
    rows: ClassBooking[];
    customerById: Map<string, Customer>;
    classStatus: ClassStatus;
    page: number;
    pageSize: number;
}
function BookedTable({ rows, customerById, classStatus, page, pageSize }: BookedTableProps) {
    const paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);
    const showStatusCol = classStatus === "Completed" || classStatus === "Cancelled";

    if (rows.length === 0) {
        return (
            <div className="relative" style={{ minHeight: 360 }}>
                <EmptyState
                    title="No customers booked"
                    subtitle="Customers who booked this class will appear here."
                    icon={User01}
                />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[300px]")}>Customer</th>
                        <th className={cn(TH, "w-[120px]")}>Spot</th>
                        {showStatusCol && <th className={cn(TH, "w-[180px]")}>Status</th>}
                    </tr>
                </thead>
                <tbody>
                    {paged.map(b => {
                        const cust = customerById.get(b.customerId);
                        const name = cust ? `${cust.firstName} ${cust.lastName}`.trim() : "Unknown";
                        const indexInList = rows.indexOf(b);
                        const showFirstTimer = indexInList === 0; // demo heuristic
                        return (
                            <tr key={b.id} className="transition-colors hover:bg-[#f9fafb]">
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <TableAvatar
                                            initials={cust?.initials ?? ""}
                                            imageUrl={cust?.imageUrl}
                                            size={40}
                                        />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <div className="text-[14px] font-medium text-[#101828]">{name}</div>
                                                {showFirstTimer && <FirstTimerBadge />}
                                            </div>
                                            <div className="text-[13px] text-[#667085]">{fmtBookingTime(b.bookingTime)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}>{spotLabelFor(indexInList)}</td>
                                {showStatusCol && (
                                    <td className={TD}>
                                        {/* Booked tab on a Cancelled class — class-level
                                            "Cancelled" badge (tab-preservation model;
                                            see store.ts cancelClassSchedule). */}
                                        {classStatus === "Cancelled" ? (
                                            <RowCancellationBadge kind="class" />
                                        ) : b.attendanceStatus === "present" ? (
                                            <PresentBadge />
                                        ) : b.attendanceStatus === "no_show" ? (
                                            <NoShowBadge />
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Waitlist tab table
// ────────────────────────────────────────────────────────────────────────────

function WaitlistTable({ rows, customerById, page, pageSize }: {
    rows: ClassBooking[];
    customerById: Map<string, Customer>;
    page: number;
    pageSize: number;
}) {
    const paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    if (rows.length === 0) {
        return (
            <div className="relative" style={{ minHeight: 360 }}>
                <EmptyState
                    title="No one on the waitlist"
                    subtitle="When the class fills up, new bookings join the waitlist."
                    icon={User01}
                />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[300px]")}>Customer</th>
                        <th className={cn(TH, "w-[180px]")}>Waitlist position</th>
                        <th className={cn(TH, "w-[120px]")}>Spot</th>
                    </tr>
                </thead>
                <tbody>
                    {paged.map((b, idx) => {
                        const cust = customerById.get(b.customerId);
                        const name = cust ? `${cust.firstName} ${cust.lastName}`.trim() : "Unknown";
                        return (
                            <tr key={b.id} className="transition-colors hover:bg-[#f9fafb]">
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <TableAvatar
                                            initials={cust?.initials ?? ""}
                                            imageUrl={cust?.imageUrl}
                                            size={40}
                                        />
                                        <div>
                                            <div className="text-[14px] font-medium text-[#101828]">{name}</div>
                                            <div className="text-[13px] text-[#667085]">{fmtBookingTime(b.bookingTime)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}>#{b.waitlistPosition ?? idx + 1}</td>
                                <td className={TD}>-</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Cancelled tab table
// ────────────────────────────────────────────────────────────────────────────

function CancelledTable({ rows, customerById, cls, page, pageSize }: {
    rows: ClassBooking[];
    customerById: Map<string, Customer>;
    cls: ClassSchedule;
    page: number;
    pageSize: number;
}) {
    const paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    if (rows.length === 0) {
        return (
            <div className="relative" style={{ minHeight: 360 }}>
                <EmptyState
                    title="No cancellations"
                    subtitle="Cancelled bookings for this class will appear here."
                    icon={User01}
                />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[300px]")}>Customer</th>
                        <th className={cn(TH, "w-[120px]")}>Spot</th>
                        <th className={cn(TH, "w-[200px]")}>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {paged.map(b => {
                        const cust = customerById.get(b.customerId);
                        const name = cust ? `${cust.firstName} ${cust.lastName}`.trim() : "Unknown";
                        const indexInList = rows.indexOf(b);
                        const kind = cancellationBadgeKind({
                            cancelledAt: b.cancelledAt,
                            classDateISO: cls.dateISO,
                            classStartTime: cls.startTime,
                        });
                        return (
                            <tr key={b.id} className="transition-colors hover:bg-[#f9fafb]">
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <TableAvatar
                                            initials={cust?.initials ?? ""}
                                            imageUrl={cust?.imageUrl}
                                            size={40}
                                        />
                                        <div>
                                            <div className="text-[14px] font-medium text-[#101828]">{name}</div>
                                            <div className="text-[13px] text-[#667085]">{fmtBookingTime(b.bookingTime)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}>{spotLabelFor(indexInList)}</td>
                                <td className={TD}><RowCancellationBadge kind={kind} /></td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Reviews & Rating table
// ────────────────────────────────────────────────────────────────────────────

function ReviewsTable({ rows, customerById, page, pageSize }: {
    rows: ClassRating[];
    customerById: Map<string, Customer>;
    page: number;
    pageSize: number;
}) {
    const paged = rows.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize);

    if (rows.length === 0) {
        return (
            <div className="relative" style={{ minHeight: 360 }}>
                <EmptyState
                    title="No reviews yet"
                    subtitle="Customer ratings and reviews for this class will appear here."
                    icon={Star01}
                />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr>
                        <th className={cn(TH, "w-[200px]")}>Customer</th>
                        <th className={cn(TH, "w-[140px]")}>Ratings</th>
                        <th className={TH}>Reviews</th>
                        <th className={cn(TH, "w-[200px]")}>What stood out</th>
                    </tr>
                </thead>
                <tbody>
                    {paged.map(r => {
                        const cust = customerById.get(r.customerId);
                        const name = cust ? `${cust.firstName} ${cust.lastName}`.trim() : "Unknown";
                        const tags = r.tags ?? [];
                        return (
                            <tr key={r.id} className="transition-colors hover:bg-[#f9fafb]">
                                <td className={TD}>
                                    <div className="flex items-center gap-3">
                                        <TableAvatar
                                            initials={cust?.initials ?? ""}
                                            imageUrl={cust?.imageUrl}
                                            size={40}
                                        />
                                        <div>
                                            <div className="text-[14px] font-medium text-[#101828]">{name}</div>
                                            <div className="text-[13px] text-[#667085]">{fmtBookingTime(r.submittedAt)}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}><RatingStars rating={r.score} /></td>
                                <td className={cn(TD, "text-[14px] text-[#475467] leading-[20px]")}>
                                    <p className="max-w-[420px]">{r.comment}</p>
                                </td>
                                <td className={TD}>
                                    <div className="flex flex-wrap gap-1.5">
                                        {tags.map(t => (
                                            <span
                                                key={t}
                                                className="inline-flex items-center px-[8px] py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#475467]"
                                            >
                                                {t}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

// CustomerCell helper removed — every table now inlines admin's exact
// JSX (TableAvatar + name/date stack) directly so there's only one
// canonical pattern to maintain.

// ────────────────────────────────────────────────────────────────────────────
// Rating stars
// ────────────────────────────────────────────────────────────────────────────

function RatingStars({ rating, size = "md" }: { rating: number; size?: "md" | "lg" }) {
    const full = Math.round(rating);
    const px = size === "lg" ? "w-5 h-5" : "w-4 h-4";
    return (
        <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map(i => (
                <Star01
                    key={i}
                    className={cn(
                        px,
                        i < full ? "text-[#f79009] fill-[#f79009]" : "text-[#d0d5dd]",
                    )}
                />
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Pagination helpers
// ────────────────────────────────────────────────────────────────────────────

/** Total row count for the active tab — feeds the shared `Pagination`. */
function paginationTotal(
    tab: TabKey,
    booked: ClassBooking[], waitlisted: ClassBooking[],
    cancelled: ClassBooking[], reviews: ClassRating[],
): number {
    if (tab === "booked")     return booked.length;
    if (tab === "waitlisted") return waitlisted.length;
    if (tab === "cancelled")  return cancelled.length;
    return reviews.length;
}

function tabCount(
    tab: TabKey,
    booked: ClassBooking[], waitlisted: ClassBooking[], cancelled: ClassBooking[],
): number {
    if (tab === "booked")     return booked.length;
    if (tab === "waitlisted") return waitlisted.length;
    if (tab === "cancelled")  return cancelled.length;
    return 0;
}

// ────────────────────────────────────────────────────────────────────────────
// Reviews filter side panel — Figma 6616:334154
// ────────────────────────────────────────────────────────────────────────────

/** Filter pill — VERBATIM from admin's
 *  [/schedule/[classId]/page.tsx:73](src/app/schedule/[classId]/page.tsx) */

/** VERBATIM admin Reviews & Rating filter panel
 *  ([/schedule/[classId]/page.tsx:193](src/app/schedule/[classId]/page.tsx)).
 *  Same w-[400px] shell, same `DatePicker` 2-col grid, same `FilterPill`
 *  for "What stood out", same custom rating buttons with star icon, same
 *  Clear + Apply footer (both disabled when no filter set). */
function ReviewFilterPanel({ open, onClose, applied, onApply }: {
    open: boolean;
    onClose: () => void;
    applied: ReviewFilterState;
    onApply: (next: ReviewFilterState) => void;
}) {
    const [pending, setPending] = useState<ReviewFilterState>(EMPTY_REVIEW_FILTER);

    // Sync the draft with the applied state every time the panel re-opens.
    useEffect(() => {
        if (open) setPending({ ...applied, tags: [...applied.tags], ratings: [...applied.ratings] });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (open) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);


    function toggleTag(t: string) {
        setPending(p => ({ ...p, tags: p.tags.includes(t) ? p.tags.filter(x => x !== t) : [...p.tags, t] }));
    }
    function toggleRating(n: number) {
        setPending(p => ({ ...p, ratings: p.ratings.includes(n) ? p.ratings.filter(x => x !== n) : [...p.ratings, n] }));
    }

    const hasAny = reviewFilterHasAny(pending);

    return (
        <SlidePanel open={open} onClose={onClose} width={400}>
{/* Header */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-medium text-[18px] leading-[28px] text-[#101828]">Filter</p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-6">
                    {/* Date range */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Date range</p>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <DatePicker
                                    value={pending.startDate}
                                    onChange={v => setPending(p => {
                                        const next = { ...p, startDate: v };
                                        if (p.endDate && v && p.endDate < v) next.endDate = "";
                                        return next;
                                    })}
                                    placeholder="Start date"
                                />
                            </div>
                            <div className="flex-1">
                                <DatePicker
                                    value={pending.endDate}
                                    onChange={v => setPending(p => ({ ...p, endDate: v }))}
                                    placeholder="End date"
                                    minDate={pending.startDate || undefined}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* What stood out */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">What stood out</p>
                        <div className="flex flex-wrap gap-2">
                            {STOOD_OUT_TAGS.map(t => (
                                <FilterPill
                                    key={t}
                                    label={t}
                                    selected={pending.tags.includes(t)}
                                    onClick={() => toggleTag(t)}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* Ratings */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#344054]">Ratings</p>
                        <div className="flex flex-wrap gap-2">
                            {RATING_VALUES.map(n => {
                                const sel = pending.ratings.includes(n);
                                return (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => toggleRating(n)}
                                        className={cn(
                                            "h-9 px-3 rounded-[8px] border text-[14px] font-medium transition-colors inline-flex items-center gap-1.5",
                                            sel
                                                ? "bg-[#e9fff3] border-[#7ba08c] text-[#344054]"
                                                : "bg-white border-[#d0d5dd] text-[#344054] hover:border-[#aad4bd]",
                                        )}
                                    >
                                        <Star01 className="w-4 h-4 text-[#fdb022]" fill="#fdb022" />
                                        {n} star
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        disabled={!hasAny}
                        onClick={() => { setPending(EMPTY_REVIEW_FILTER); onApply(EMPTY_REVIEW_FILTER); onClose(); }}
                    >
                        Clear filter
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        disabled={!hasAny}
                        onClick={() => { onApply(pending); onClose(); }}
                    >
                        Apply
                    </Button>
                </div>
        </SlidePanel>
    );
}
