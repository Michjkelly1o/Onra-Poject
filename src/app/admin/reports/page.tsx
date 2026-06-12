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

const CATEGORIES: ReportCategory[] = [
    {
        id: "financial",
        title: "Financial reports",
        description:
            "Track your studio's financial performance, including total sales, payments, refunds, and revenue breakdown across different services and products.",
        icon: BankNote01,
        items: [
            { slug: "total-sales",       label: "Total sales (orders)", ready: true },
            { slug: "sales-by-category", label: "Sales by category",    ready: true },
            { slug: "payments",          label: "Payments",             ready: true },
            { slug: "gift-cards",        label: "Gift card",            ready: true },
        ],
    },
    {
        id: "memberships",
        title: "Membership & package reports",
        description:
            "Monitor the status of memberships, subscriptions, and packages. Track active plans, remaining credits, and expiration details.",
        icon: CreditCard02,
        items: [
            { slug: "memberships",   label: "Memberships",   ready: true },
            { slug: "subscriptions", label: "Subscriptions", ready: true },
            { slug: "packages",      label: "Packages",      ready: true },
        ],
    },
    {
        id: "activity",
        title: "Activity reports",
        description:
            "Gain insights into booking activity across your studio. Analyze class attendance, cancellations, no shows, and overall service performance.",
        icon: Activity,
        items: [
            { slug: "bookings-by-class-events", label: "Bookings by class events", ready: true },
            { slug: "bookings-by-customer",     label: "Bookings by customer",     ready: true },
            { slug: "all-cancellations",        label: "All cancellations",        ready: true },
            { slug: "all-no-shows",             label: "All no shows",             ready: true },
            { slug: "all-bookings",             label: "All bookings",             ready: true },
            { slug: "instructor-attendance",    label: "Instructor attendance",    ready: true },
        ],
    },
    {
        id: "customer",
        title: "Customer reports",
        description:
            "Understand how customers interact with your studio. Analyze attendance patterns, retention trends, active users, and popular services.",
        icon: User01,
        items: [
            { slug: "attendance-frequency",  label: "Attendance frequency",    ready: true },
            { slug: "retention",             label: "Retention",               ready: true },
            { slug: "active-vs-inactive",    label: "Active vs inactive users",ready: true },
            { slug: "top-services-used",     label: "Top services used",       ready: true },
            { slug: "referral",              label: "Referral",                ready: true },
        ],
    },
    {
        id: "frozen",
        title: "Frozen package",
        description:
            "Track memberships and packages that are currently frozen and analyze how freezes impact usage, attendance, and revenue.",
        icon: CoinsSwap02,
        items: [
            { slug: "all-frozen-packages", label: "All frozen packages", ready: true },
            { slug: "freeze-impact",       label: "Freeze impact",       ready: true },
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

            {/* Right — report items as a divider-separated list */}
            <ul className="flex-1 min-w-0 flex flex-col rounded-[12px] overflow-hidden py-1">
                {category.items.map((item, idx) => (
                    <li key={item.slug} className="flex flex-col w-full">
                        <button
                            type="button"
                            onClick={() => onSelect(item)}
                            className="w-full text-left px-[10px] py-[9px] mx-[6px] rounded-[6px] hover:bg-[#f9fafb] transition-colors text-[14px] font-medium leading-[20px] text-[#344054]"
                        >
                            {item.label}
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
