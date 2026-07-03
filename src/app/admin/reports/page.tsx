"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports landing (/admin/reports)
// ─────────────────────────────────────────────────────────────────────────────
//
// Six categories per the Excel spec's Sheet 1:
//   Financial · Membership & Package · Client / Customer ·
//   Activity / Class · Staff / Instructor · Marketing
//
// Every item is a plain link. Clicking navigates to /reports/{slug}.
// Built reports render on the shell. Unbuilt slugs 404 naturally —
// the client sees the full catalogue that's coming (matches the Excel
// scope) and knows what's still queued.

import { useRouter } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
    BankNote01, CreditCard02, Activity, User01, Users01, Announcement01,
} from "@untitledui/icons";

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;

interface ReportItem {
    slug: string;
    label: string;
}

interface ReportCategory {
    id: string;
    title: string;
    description: string;
    icon: IconComponent;
    items: ReportItem[];
}

// Category structure + item labels mirror new-prd/Onra_Reporting.xlsx
// Sheet 1 "Reports" VERBATIM (rows B5-B45). Order preserved. Retail's
// 2 reports are skipped per plan (see new-prd/reports-implementation-plan.md
// §1). Any label change here must land in the corresponding registry
// entry's `title` field too so the report page + landing agree.
const CATEGORIES: ReportCategory[] = [
    {
        id: "financial",
        title: "Financial",
        description:
            "Track studio performance — sales, refunds, discounts, gift cards, tax, revenue recognition, MRR, ARPM, and per-visit economics.",
        icon: BankNote01,
        items: [
            { slug: "total-sales",         label: "Total Sales (orders)"         },
            { slug: "sales-by-category",   label: "Sales by Category (stream)"   },
            { slug: "sales-by-item",       label: "Sales by Item"                },
            { slug: "payments",            label: "Payments"                     },
            { slug: "refunds",             label: "Refunds"                      },
            { slug: "discounts",           label: "Discounts"                    },
            { slug: "tax-vat-export",      label: "Tax / VAT Export"             },
            { slug: "gift-cards",          label: "Gift Card"                    },
            { slug: "revenue-recognition", label: "Revenue Recognition"          },
            { slug: "revenue-per-class",   label: "Revenue per Class / Visit"    },
            { slug: "arpm",                label: "Revenue per Member (ARPM)"    },
            { slug: "mrr",                 label: "Recurring Revenue (MRR)"      },
        ],
    },
    {
        id: "membership_package",
        title: "Membership & Package",
        description:
            "Active plans, frozen packages, intro offers, and plan changes.",
        icon: CreditCard02,
        items: [
            { slug: "memberships-packages", label: "Memberships & Packages"           },
            { slug: "frozen",               label: "Frozen Memberships / Packages"    },
            { slug: "intro-offers",         label: "Intro Offers"                     },
            { slug: "upgrades-downgrades",  label: "Upgrades / Downgrades"            },
        ],
    },
    {
        id: "customer",
        title: "Client / Customer",
        description:
            "How customers interact with the studio — active vs inactive, sign-ups, churn, retention, win-back.",
        icon: User01,
        items: [
            { slug: "customer-data",       label: "Customer Data (Active vs Inactive)"      },
            { slug: "member-movement",     label: "Member Movement (Sign-ups & Net Change)" },
            { slug: "retention-churn",     label: "Retention & Churn"                       },
            { slug: "win-back",            label: "Win-back"                                },
        ],
    },
    {
        id: "class",
        title: "Activity / Class",
        description:
            "Bookings, class performance, cancellations, no-shows, and the top classes and services.",
        icon: Activity,
        items: [
            { slug: "bookings",              label: "Bookings"                 },
            { slug: "class-performance",     label: "Class Performance"        },
            { slug: "cancellations-noshows", label: "Cancellations & No-shows" },
            { slug: "top-classes-services",  label: "Top Classes & Services"   },
        ],
    },
    {
        id: "staff",
        title: "Staff / Instructor",
        description:
            "Instructor performance and staff attendance. Owner / manager / payroll access only.",
        icon: Users01,
        items: [
            { slug: "instructor-performance", label: "Instructor Performance" },
            { slug: "staff-attendance",       label: "Staff Attendance"       },
        ],
    },
    {
        id: "marketing",
        title: "Marketing",
        description:
            "Leads, campaigns, promos, referrals, and acquisition efficiency.",
        icon: Announcement01,
        items: [
            { slug: "lead-data",              label: "Lead Data"              },
            { slug: "lead-conversion",        label: "Lead Conversion"        },
            { slug: "campaign-performance",   label: "Campaign Performance"   },
            { slug: "promo-redemptions",      label: "Promo Redemptions"      },
            { slug: "referrals",              label: "Referral Report"        },
            { slug: "acquisition-efficiency", label: "Acquisition Efficiency" },
        ],
    },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
    const router = useRouter();

    function handleSelect(item: ReportItem) {
        // Every item routes to /reports/{slug}. Built ones render on the
        // shell; unbuilt slugs 404 naturally — the client sees the full
        // Excel catalogue on the landing.
        router.push(`/reports/${item.slug}`);
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            {CATEGORIES.map(category => (
                <CategoryCard
                    key={category.id}
                    category={category}
                    onSelect={handleSelect}
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
