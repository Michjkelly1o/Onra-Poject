"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports landing (/admin/reports)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 6755:314471 — Reports module landing. Five category cards stacked
// vertically; each card lists the individual reports inside that category.
// Clicking a report item navigates to its detail page (Phase 2 — built one
// at a time).
//
// Layout per Figma:
//   • Page chrome ("Reports" title + bell) comes from <Header /> (admin layout)
//   • Body: vertical stack of 5 cards, 24px gap, full content width
//   • Card: left = featured icon + title + description · right = menu list
//   • Menu items separated by 1px dividers (#e4e7ec), each row clickable
//
// Phase 1 (this file): the landing view. Every report item shows a "coming
// soon" toast on click — the slug is already wired so swapping to a real
// router.push() per detail page is a one-line change when each detail
// page lands.

import { useRouter } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
    BankNote01, CreditCard02, Activity, User01, CoinsSwap02,
} from "@untitledui/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
import { useAppStore } from "@/lib/store";

// ─── Category model ────────────────────────────────────────────────────────
//
// `slug` is the URL fragment we'll eventually mount detail pages under
// (e.g. `/admin/reports/total-sales`). `ready` flips to true once the
// corresponding detail page is built — at that point the row navigates
// instead of toasting.

interface ReportItem {
    slug: string;
    label: string;
    ready?: boolean;
}

interface ReportCategory {
    id: string;
    title: string;
    description: string;
    icon: IconComponent;
    items: ReportItem[];
}

// Item `ready: true` means the detail page is built on the new shell and
// routes via `router.push(/reports/<slug>)`. Any item without `ready`
// fires the "coming soon" toast — kept intentionally so the client sees
// the full report catalogue and knows what's still queued.
const CATEGORIES: ReportCategory[] = [
    {
        id: "financial",
        title: "Financial reports",
        description:
            "Track your studio's financial performance — sales, refunds, discounts, gift cards, tax, revenue recognition, and per-visit / per-member economics.",
        icon: BankNote01,
        items: [
            { slug: "total-sales",         label: "Total sales (orders)",     ready: true },
            { slug: "sales-by-category",   label: "Sales by category",        ready: true },
            { slug: "sales-by-item",       label: "Sales by item",            ready: true },
            { slug: "payments",            label: "Payments",                 ready: true },
            { slug: "refunds",             label: "Refunds",                  ready: true },
            { slug: "discounts",           label: "Discounts",                ready: true },
            { slug: "gift-cards",          label: "Gift cards",               ready: true },
            { slug: "tax-vat-export",      label: "Tax / VAT export",         ready: true },
            { slug: "revenue-recognition", label: "Revenue recognition",      ready: true },
            { slug: "revenue-per-class",   label: "Revenue per class / visit", ready: true },
        ],
    },
    {
        id: "memberships",
        title: "Membership & package reports",
        description:
            "Monitor active plans, intro offers, plan changes, and recurring revenue. See who upgraded, who downgraded, and what MRR/ARPM look like month-over-month.",
        icon: CreditCard02,
        items: [
            { slug: "memberships-packages", label: "Memberships & packages",  ready: true },
            { slug: "intro-offers",         label: "Intro offers",            ready: true },
            { slug: "upgrades-downgrades",  label: "Upgrades & downgrades",   ready: true },
            { slug: "mrr",                  label: "MRR — Monthly Recurring Revenue", ready: true },
            { slug: "arpm",                 label: "ARPM — Avg Revenue Per Member", ready: true },
        ],
    },
    {
        id: "activity",
        title: "Activity reports",
        description:
            "Bookings, class attendance, cancellations, and no-shows across your studio.",
        icon: Activity,
        items: [
            { slug: "bookings-by-class-events", label: "Bookings by class events" },
            { slug: "bookings-by-customer",     label: "Bookings by customer"     },
            { slug: "all-cancellations",        label: "All cancellations"        },
            { slug: "all-no-shows",             label: "All no shows"             },
            { slug: "all-bookings",             label: "All bookings"             },
            { slug: "instructor-attendance",    label: "Instructor attendance"    },
        ],
    },
    {
        id: "customer",
        title: "Customer reports",
        description:
            "Understand how customers interact with your studio. Attendance patterns, retention, active vs inactive, referrals.",
        icon: User01,
        items: [
            { slug: "attendance-frequency",  label: "Attendance frequency"     },
            { slug: "retention",             label: "Retention"                },
            { slug: "active-vs-inactive",    label: "Active vs inactive users" },
            { slug: "top-services-used",     label: "Top services used"        },
            { slug: "referral",              label: "Referral"                 },
        ],
    },
    {
        id: "frozen",
        title: "Frozen package",
        description:
            "Currently-frozen memberships and packages — freeze source, days-so-far, plan value at risk.",
        icon: CoinsSwap02,
        items: [
            { slug: "frozen",        label: "All frozen packages", ready: true },
            { slug: "freeze-impact", label: "Freeze impact" },
        ],
    },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
    const router = useRouter();
    const showToast = useAppStore(s => s.showToast);

    function handleSelect(category: ReportCategory, item: ReportItem) {
        if (item.ready) {
            // Report detail pages live at the root `/reports/<slug>` so they
            // render full-bleed (no admin sidebar / header), matching the
            // Figma "X close" chrome.
            router.push(`/reports/${item.slug}`);
            return;
        }
        // Detail page not built yet — surface a clear "in progress" toast so
        // the admin knows the link is real, just unfinished, instead of
        // bouncing to a 404 mid-demo.
        showToast(
            "Report coming soon",
            `${item.label} (${category.title}) is being built.`,
            "success",
        );
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            {CATEGORIES.map(category => (
                <CategoryCard
                    key={category.id}
                    category={category}
                    onSelect={item => handleSelect(category, item)}
                />
            ))}
        </div>
    );
}

// ─── Card ──────────────────────────────────────────────────────────────────

function CategoryCard({
    category,
    onSelect,
}: {
    category: ReportCategory;
    onSelect: (item: ReportItem) => void;
}) {
    const Icon = category.icon;
    return (
        <section className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex gap-16 items-start">
            {/* Left — featured icon + title + description */}
            <div className="flex-1 min-w-0 flex gap-3 items-start">
                <div className="shrink-0 w-8 h-8 rounded-[6px] border-1 border-[#e4e7ec] flex items-center justify-center overflow-hidden">
                    <Icon className="w-4 h-4 text-[#475467]" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                        {category.title}
                    </h2>
                    <p className="text-[14px] leading-[20px] text-[#475467]">
                        {category.description}
                    </p>
                </div>
            </div>

            {/* Right — report items as a divider-separated list. Built
                items surface a "New" chip so testers can see at a glance
                which reports route to the new centralized shell. */}
            <ul className="flex-1 min-w-0 flex flex-col rounded-[12px] overflow-hidden py-1">
                {category.items.map((item, idx) => (
                    <li key={item.slug} className="flex flex-col w-full">
                        <button
                            type="button"
                            onClick={() => onSelect(item)}
                            className="w-full text-left px-[10px] py-[9px] mx-[6px] rounded-[6px] hover:bg-[#f9fafb] transition-colors flex items-center gap-2"
                        >
                            <span className="text-[14px] font-medium leading-[20px] text-[#344054] flex-1 min-w-0 truncate">
                                {item.label}
                            </span>
                            {item.ready && (
                                <span className="shrink-0 inline-flex items-center justify-center h-[20px] px-2 rounded-full bg-[#e9fff3] border-1 border-[#7ba08c] text-[11px] font-semibold text-[#065f46] tracking-wide">
                                    NEW
                                </span>
                            )}
                        </button>
                        {idx < category.items.length - 1 && (
                            <div className="h-px bg-[#e4e7ec] my-1" />
                        )}
                    </li>
                ))}
            </ul>
        </section>
    );
}
