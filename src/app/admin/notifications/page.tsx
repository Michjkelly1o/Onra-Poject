"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Notifications full page (PRD 12 §3.3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • All tab      — 2853-99755
//   • Bookings tab — 2853-100180
//   • Payments tab — 2854-100625
//
// Layout:
//   • Tab strip with All / Bookings / Payments — each tab shows a gray pill
//     badge with the count of notifications in that tab. Active tab is
//     underlined with a 2px bottom border and bold text.
//   • Below tabs: a rounded bordered container with notifications grouped
//     into "Today" and "Past" sections. Each row has the featured-icon tile,
//     title + relative time, body, and an unread dot on the right.
//   • Empty states for each tab — a centered tile + caption that adapts to
//     which tab is active.
//
// Reads notifications from the central AppStore slice — same source the bell
// dropdown uses — so the page and the bell stay in lock-step with every
// create / mark-read / dismiss event across the app.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell01, MarkerPin01 } from "@untitledui/icons";
import { useAppStore, DEFAULT_BRANCH_ID, type Notification } from "@/lib/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectInput } from "@/components/ui/select-input";
import {
    iconForNotification,
    relativeTime,
    bucketByDay,
    routeForNotification,
} from "@/components/notifications/notification-utils";
import { useTeamActivity, TeamActivityRow } from "@/components/dashboard/team-activity";
import { cn } from "@/lib/utils";

// ─── Tab definitions ─────────────────────────────────────────────────────────

// Admin tabs are a strict subset of the platform-wide `NotificationTab`
// type — the "earnings" tab is instructor-only and lives on
// `/instructor/notifications`. Narrowing the key here keeps the
// `counts`/`TAB_EMPTY_COPY` Records exhaustive for THIS page without
// having to declare an unused "earnings" branch.
//
// `team` is a separate, derived feed (not a real `NotificationTab` on the
// store) — it surfaces the same activity stream the dashboard's "Recent
// activity" widget reads, as the last tab so the dashboard's "See all"
// shortcut can deep-link straight into the full list.
type TabKey = "all" | "booking" | "payment" | "team";

const TABS: { key: TabKey; label: string }[] = [
    { key: "all", label: "All" },
    { key: "booking", label: "Bookings" },
    { key: "payment", label: "Payments" },
    { key: "team", label: "Team activity" },
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
            {/* Badge — matches the schedule detail tab badge style: filled
                gray for active, hairline-bordered light gray for inactive. */}
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

function NotificationRow({ n, onClick }: { n: Notification; onClick: () => void }) {
    const Icon = iconForNotification(n.icon);
    return (
        <button
            type="button"
            onClick={onClick}
            className="w-full flex gap-3 items-center text-left py-1.5 -mx-2 px-2 rounded-[8px] hover:bg-[#f9fafb] transition-colors"
        >
            {/* Featured icon tile (48px) */}
            <div className="shrink-0 w-12 h-12 rounded-[10px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shadow-[0px_1.481px_1.481px_rgba(0,0,0,0.04)]">
                <Icon className="w-6 h-6 text-[#475467]" />
            </div>
            {/* Text block */}
            <div className="flex-1 min-w-0 flex flex-col gap-[2px]">
                <div className="flex items-baseline gap-[6px] flex-wrap">
                    <p className="text-[16px] font-semibold leading-[24px] text-[#344054]">
                        {n.title}
                    </p>
                    <p className="text-[16px] font-normal leading-[24px] text-[#667085]">
                        {relativeTime(n.createdAt)}
                    </p>
                </div>
                <p className="text-[16px] font-normal leading-[24px] text-[#475467]">
                    {n.body}
                </p>
            </div>
            {/* Unread dot — 10px for the page, matches Figma */}
            {!n.isRead && (
                <span className="shrink-0 w-[10px] h-[10px] bg-[#658774] rounded-full" />
            )}
        </button>
    );
}

function SectionHeader({ label }: { label: string }) {
    return (
        <p className="text-[18px] font-semibold leading-[28px] text-[#101828]">
            {label}
        </p>
    );
}

function Divider() {
    return <div className="h-px bg-[#e4e7ec] w-full" />;
}

function Section({ title, items, onRowClick, headerRight }: {
    title: string;
    items: Notification[];
    onRowClick: (n: Notification) => void;
    /** Optional content rendered on the right side of the section header
     *  row — used by the first visible section to host the location
     *  filter inline with the "Today" / "Past" label. */
    headerRight?: React.ReactNode;
}) {
    if (items.length === 0) return null;
    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between gap-4">
                <SectionHeader label={title} />
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

const TAB_EMPTY_COPY: Record<TabKey, { title: string; subtitle: string }> = {
    all: {
        title: "You're all caught up",
        subtitle: "No notifications yet. Activity will appear here as things happen in your studio.",
    },
    booking: {
        title: "No booking notifications",
        subtitle: "When customers book, cancel, or no-show a class, it will appear here.",
    },
    payment: {
        title: "No payment notifications",
        subtitle: "Completed sales and refunds will appear here as soon as they're processed.",
    },
    team: {
        title: "No team activity yet",
        subtitle: "Member bookings, purchases, and check-ins will appear here as they happen.",
    },
};

// The default export below wraps this component in a `<Suspense>` boundary
// because `useSearchParams()` triggers a Next.js prerender bail-out without
// one (see the same pattern in /customers/new/page.tsx + /[id]/edit/page.tsx).
function NotificationsPage() {
    const router = useRouter();
    const notifications = useAppStore(s => s.notifications);
    const branches = useAppStore(s => s.branches);
    const markNotificationRead = useAppStore(s => s.markNotificationRead);
    // Live team-activity feed — same hook the dashboard widget reads.
    // Drives both the "Team activity" tab count + body so every booking,
    // sale, refund, cancellation, and signup across the studio surfaces
    // here in the same render cycle.
    const teamActivity = useTeamActivity();

    // Initial tab is taken from the `?tab=` URL param so the dashboard's
    // "See all" shortcut can deep-link straight into Team activity. Unknown
    // values silently fall back to "all".
    const searchParams = useSearchParams();
    const initialTab: TabKey = (() => {
        const t = searchParams.get("tab");
        return t === "booking" || t === "payment" || t === "team" ? t : "all";
    })();
    const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
    // Sync tab state with subsequent URL changes (e.g. browser back/forward
    // between the bell-click destination and the team-activity destination).
    useEffect(() => {
        const t = searchParams.get("tab");
        if (t === "booking" || t === "payment" || t === "team") setActiveTab(t);
        else setActiveTab("all");
    }, [searchParams]);
    // Branch scope — empty string = "All branches" (no scope). Defaults to
    // the main active branch so the feed opens pre-scoped like the other
    // admin lists (customers, staff, etc.) instead of leaking every branch.
    const [branchId, setBranchId] = useState<string>(DEFAULT_BRANCH_ID);

    // Active branches drive the picker — matches the toolbar pattern on
    // `/admin/customers` and `/admin/staff` (MarkerPin trigger icon).
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // Sort newest-first once — every downstream filter preserves this order.
    const sorted = useMemo(
        () => [...notifications].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ),
        [notifications],
    );

    // Branch-scoped list — composed with the tab filter below. "All branches"
    // (branchId === "") passes everything through; otherwise we keep only
    // notifications whose seed `branch_id` matches the selected branch.
    // Notifications without a `branchId` (rare — system-level events) are
    // shown across every branch scope.
    const branchScoped = useMemo(
        () => branchId === ""
            ? sorted
            : sorted.filter(n => !n.branchId || n.branchId === branchId),
        [sorted, branchId],
    );

    // Per-tab counts for the pill badges — derived AFTER branch scoping so
    // the numbers always describe what the user will actually see. The
    // "team" tab counts the dashboard activity feed, which lives outside
    // the notifications store (separate seed, no branch scope).
    const counts = useMemo<Record<TabKey, number>>(() => ({
        all: branchScoped.length,
        booking: branchScoped.filter(n => n.tab === "booking").length,
        payment: branchScoped.filter(n => n.tab === "payment").length,
        team: teamActivity.length,
    }), [branchScoped, teamActivity]);

    // Filtered notifications list — `team` is rendered separately below
    // (different row component + no branch scope), so this filter only
    // runs for the notifications-backed tabs.
    const filtered = useMemo(
        () => activeTab === "all" ? branchScoped
            : activeTab === "team" ? []
            : branchScoped.filter(n => n.tab === activeTab),
        [branchScoped, activeTab],
    );

    // Today / Past bucket split.
    const { today, past } = useMemo(() => bucketByDay(filtered), [filtered]);

    function handleRowClick(n: Notification) {
        markNotificationRead(n.id);
        router.push(routeForNotification(n));
    }

    // Location filter — defined once and slotted into whichever section
    // header renders first (Today when populated, otherwise Past), so the
    // filter sits inline with the first visible section label.
    const locationFilter = (
        <SelectInput
            triggerIcon={<MarkerPin01 className="w-4 h-4" />}
            placeholder="Select location"
            options={[{ value: "", label: "All locations" }, ...branchOptions]}
            value={branchId}
            onChange={setBranchId}
            width="w-[220px]"
        />
    );

    return (
        // Outer is content-sized (no `h-full`) — same pattern as the
        // `/admin/products` view card. The bordered card below uses a fixed
        // `h-[760px]` so its bottom edge sits 24px above main's chrome
        // (main's own `p-6` from the admin layout).
        <div className="flex flex-col gap-6">
            {/* Tab strip — `px-6` on the wrapper gives 24px L/R padding so
                the buttons + border line don't sit flush against the page
                edge (the user explicitly asked for this). */}
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

            {/* Bordered view card — fixed `h-[760px]` mirrors the
                `/admin/products` pattern. Main's `p-6` (inherited from
                admin layout) gives the 24px gap below the card. Inner
                content scrolls so the card edge never moves. The branch
                picker is rendered INLINE with the first visible section
                header (Today / Past) — same level as the section label
                so the right edge stays aligned with the page chrome. */}
            <div className="relative h-[760px] border-1 border-[#e4e7ec] rounded-[20px] bg-white overflow-hidden flex flex-col">
                {activeTab === "team" ? (
                    // Team activity tab — separate render path. Reads the
                    // shared activity seed (no branch scope, different row
                    // component) so the feed matches the dashboard widget
                    // exactly.
                    teamActivity.length === 0 ? (
                        <div className="relative flex-1">
                            <EmptyState
                                title={TAB_EMPTY_COPY.team.title}
                                subtitle={TAB_EMPTY_COPY.team.subtitle}
                                icon={Bell01}
                            />
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 pt-6 pb-8">
                            <div className="flex flex-col gap-3 w-full">
                                <SectionHeader label="Recent activity" />
                                <div className="flex flex-col">
                                    {teamActivity.map((item, idx) => (
                                        <div key={item.id}>
                                            <TeamActivityRow item={item} />
                                            {idx < teamActivity.length - 1 && (
                                                <div className="my-1"><Divider /></div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                ) : filtered.length === 0 ? (
                    <>
                        {/* No notifications — still show the picker so the
                            user can switch branches and reveal data. */}
                        <div className="shrink-0 flex items-center justify-end px-6 pt-6">
                            {locationFilter}
                        </div>
                        <div className="relative flex-1">
                            <EmptyState
                                title={TAB_EMPTY_COPY[activeTab].title}
                                subtitle={TAB_EMPTY_COPY[activeTab].subtitle}
                                icon={Bell01}
                            />
                        </div>
                    </>
                ) : (
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-6 pt-6 pb-8">
                        <div className="flex flex-col gap-6 w-full">
                            <Section title="Today" items={today} onRowClick={handleRowClick}
                                headerRight={today.length > 0 ? locationFilter : undefined} />
                            <Section title="Past" items={past} onRowClick={handleRowClick}
                                headerRight={today.length === 0 ? locationFilter : undefined} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// Suspense wrapper — required because `NotificationsPage` reads `?tab=` via
// `useSearchParams()`, which triggers Next.js's CSR-bailout error at build
// time when the page is statically prerendered without a boundary.
export default function NotificationsRoute() {
    return (
        <Suspense fallback={null}>
            <NotificationsPage />
        </Suspense>
    );
}
