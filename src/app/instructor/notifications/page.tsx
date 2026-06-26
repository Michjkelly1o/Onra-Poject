"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor notifications full page
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • All tab      — 6378:244664
//   • Bookings tab — 6378:242005
//   • Earnings tab — 6378:244916
//
// Mirrors the admin notifications page 1:1 in structure (tab strip,
// bordered view card, Today / Past sections, NotificationRow style) so the
// two surfaces feel like one product. The differences are scoped:
//   1. Audience filter — only `audience === "instructor"` rows
//   2. Tabs — All / Bookings / Earnings (instead of Bookings / Payments)
//   3. No branch picker — instructor has a single branch (`branch_id` on
//      the staff profile), and CLAUDE.md doesn't surface a branch toggle
//      on instructor-side pages.
//   4. Empty-state copy adapts to the instructor's perspective.
//
// ──────────────────────────────────────────────────────────────────
// ROLE-SCOPED VIEW — same centralized store + same Notification type
// the admin reads. Instructor scoping is `.filter(n => n.audience ===
// "instructor")`. When this app moves to Supabase, the same filter
// becomes an RLS policy on the `audience` column. Do NOT fork the
// notifications seed file.
// ──────────────────────────────────────────────────────────────────

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell01 } from "@untitledui/icons";
import { useAppStore, type Notification } from "@/lib/store";
import { instructor_profile } from "@/data/mock/instructor_profile";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/button";
import {
    iconForNotification,
    relativeTime,
    bucketByDay,
    routeForNotification,
} from "@/components/notifications/notification-utils";
import { cn } from "@/lib/utils";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { SectionHeader } from "@/components/patterns/SectionHeader";

// ─── Tab definitions ─────────────────────────────────────────────────────────

type InstructorTabKey = "all" | "booking" | "earnings";

const TABS: { key: InstructorTabKey; label: string }[] = [
    { key: "all",      label: "All" },
    { key: "booking",  label: "Bookings" },
    { key: "earnings", label: "Earnings" },
];

// ─── Section atoms ───────────────────────────────────────────────────────────

function TabButton({ label, count, active, onClick }: {
    label: string; count: number; active: boolean; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-[48px] flex items-center gap-2 px-3 transition-colors whitespace-nowrap",
                active
                    ? "border-b-2 border-[#101828] text-[#101828]"
                    : "text-[#667085] hover:text-[#344054]",
            )}
        >
            <span className="text-[14px] font-semibold">{label}</span>
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

// Local NotificationRow removed — uses canonical from
// `@/components/notifications/NotificationRow`.

// Local SectionHeader removed — uses canonical from `@/components/patterns/SectionHeader`.

function Divider() {
    return <div className="h-px bg-[#e4e7ec] w-full" />;
}

function Section({ title, items, onRowClick, headerRight }: {
    title: string;
    items: Notification[];
    onRowClick: (n: Notification) => void;
    /** Optional content rendered on the right side of the section header
     *  row — used by the first visible section to host the
     *  "Mark all as read" button inline with the section label. */
    headerRight?: React.ReactNode;
}) {
    if (items.length === 0) return null;
    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between gap-4">
                <SectionHeader title={title} />
                {headerRight && <div className="shrink-0">{headerRight}</div>}
            </div>
            <div className="flex flex-col">
                {items.map((n, idx) => (
                    <div key={n.id}>
                        <NotificationRow n={n} onClick={() => onRowClick(n)} />
                        {idx < items.length - 1 && (
                            <div className="my-1"><Divider /></div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

const TAB_EMPTY_COPY: Record<InstructorTabKey, { title: string; subtitle: string }> = {
    all: {
        title: "You're all caught up",
        subtitle: "No notifications yet. New bookings and earnings will appear here as they happen.",
    },
    booking: {
        title: "No booking notifications",
        subtitle: "When members book, cancel, or no-show your classes, it will appear here.",
    },
    earnings: {
        title: "No earnings notifications",
        subtitle: "Per-class payouts and weekly earning summaries will appear here as they're processed.",
    },
};

export default function InstructorNotificationsPage() {
    const router = useRouter();
    const notifications = useAppStore(s => s.notifications);
    const markNotificationRead = useAppStore(s => s.markNotificationRead);
    const currentUser = useAppStore(s => s.currentUser);

    const [activeTab, setActiveTab] = useState<InstructorTabKey>("all");

    // Resolve the current instructor's staff profile id — same fallback
    // pattern the dashboard uses so admin actions emitting instructor
    // notifications land in Liam's feed during the demo.
    const currentStaffId = (currentUser as typeof currentUser & { staff_profile_id?: string }).staff_profile_id
        ?? instructor_profile.staff_profile_id;

    // Sort newest-first once — every downstream filter preserves this order.
    const sorted = useMemo(
        () => [...notifications].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        [notifications],
    );

    // Audience-scoped feed — instructor-only rows, further scoped to the
    // current instructor's `targetInstructorId`. Rows without a target
    // (legacy / system-wide events) stay visible to every instructor.
    const scoped = useMemo(
        () => sorted.filter(n => {
            if (n.audience !== "instructor") return false;
            return !n.targetInstructorId || n.targetInstructorId === currentStaffId;
        }),
        [sorted, currentStaffId],
    );

    // Per-tab counts for the pill badges.
    const counts = useMemo(() => ({
        all:      scoped.length,
        booking:  scoped.filter(n => n.tab === "booking").length,
        earnings: scoped.filter(n => n.tab === "earnings").length,
    }), [scoped]);

    // Filtered list for the active tab.
    const filtered = useMemo(
        () => activeTab === "all" ? scoped : scoped.filter(n => n.tab === activeTab),
        [scoped, activeTab],
    );

    // Today / Yesterday / Earlier this week / Older bucket split.
    const { today, yesterday, earlierThisWeek, older } = useMemo(() => bucketByDay(filtered), [filtered]);
    // First non-empty bucket — its section header hosts the "Mark all as
    // read" button inline with the title.
    const firstFilledBucket: "today" | "yesterday" | "earlierThisWeek" | "older" | null =
        today.length        > 0 ? "today" :
        yesterday.length    > 0 ? "yesterday" :
        earlierThisWeek.length > 0 ? "earlierThisWeek" :
        older.length        > 0 ? "older" : null;

    function handleRowClick(n: Notification) {
        markNotificationRead(n.id);
        router.push(routeForNotification(n));
    }

    // Whether any visible notification in the current filtered view is
    // still unread. Drives the "Mark all as read" button's disabled state.
    const hasUnreadInView = filtered.some(n => !n.isRead);

    function handleMarkAllAsRead() {
        // Mark only the rows currently in view (respects the active tab
        // scope). Avoids accidentally clearing unread state on rows the
        // instructor can't see right now.
        for (const n of filtered) {
            if (!n.isRead) markNotificationRead(n.id);
        }
    }

    const markAllButton = (
        <Button
            variant="secondary-gray" size="md"
            disabled={!hasUnreadInView}
            onClick={handleMarkAllAsRead}
        >
            Mark all as read
        </Button>
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Tab strip */}
            <div className="shrink-0 px-0">
                <div className="border-b border-[#e4e7ec]">
                    <div className="flex gap-1 items-end">
                        {TABS.map(t => (
                            <TabButton
                                key={t.key}
                                label={t.label}
                                count={counts[t.key]}
                                active={activeTab === t.key}
                                onClick={() => setActiveTab(t.key)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Bordered view card — `min-h-[760px]` keeps the surface from
                hugging content per the project rule on view-card sizing. */}
            <div className="relative min-h-[760px] border-1 border-[#e4e7ec] rounded-[20px] bg-white overflow-hidden flex flex-col">
                {filtered.length === 0 ? (
                    <div className="relative flex-1">
                        <EmptyState
                            title={TAB_EMPTY_COPY[activeTab].title}
                            subtitle={TAB_EMPTY_COPY[activeTab].subtitle}
                            icon={Bell01}
                        />
                    </div>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 pt-6 pb-8">
                        <div className="flex flex-col gap-6 w-full">
                            <Section title="Today" items={today} onRowClick={handleRowClick}
                                headerRight={firstFilledBucket === "today" ? markAllButton : undefined} />
                            <Section title="Yesterday" items={yesterday} onRowClick={handleRowClick}
                                headerRight={firstFilledBucket === "yesterday" ? markAllButton : undefined} />
                            <Section title="Earlier this week" items={earlierThisWeek} onRowClick={handleRowClick}
                                headerRight={firstFilledBucket === "earlierThisWeek" ? markAllButton : undefined} />
                            <Section title="Older" items={older} onRowClick={handleRowClick}
                                headerRight={firstFilledBucket === "older" ? markAllButton : undefined} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
