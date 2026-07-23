"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports landing (/admin/reports)
// ─────────────────────────────────────────────────────────────────────────────
//
// Six categories per the Excel spec's Sheet 1:
//   Financial · Membership & Package · Customer ·
//   Activity / Class · Staff / Instructor · Marketing
//
// Every item is a plain link. Clicking navigates to /reports/{slug}.
// Built reports render on the shell. Unbuilt slugs 404 naturally —
// the client sees the full catalogue that's coming (matches the Excel
// scope) and knows what's still queued.

import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useCallback } from "react";
import type { ComponentType, SVGProps } from "react";
import {
    BankNote01, CreditCard02, Activity, User01, Users01, Announcement01, Star01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { isReportCategoryDisabled, isReportSlugDisabled } from "@/config/feature-flags";

// ─── Favourites (persisted per-browser) ──────────────────────────────────────
//
// A report is starred by slug. The set is saved to localStorage under the
// same `onra-reports:` namespace the column-visibility prefs use, so a
// tester's favourites survive refresh + tab close. Favourited reports pin
// to the TOP of their own category (order otherwise preserved).
const FAV_STORAGE_KEY = "onra-reports:favorites";

function loadFavorites(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(FAV_STORAGE_KEY);
        return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
        return new Set();
    }
}

function saveFavorites(favs: Set<string>): void {
    try {
        window.localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(Array.from(favs)));
    } catch {
        /* storage full / unavailable — favourites stay in-memory only */
    }
}

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
            { slug: "total-sales",         label: "Total Sales"                  },
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
        title: "Customer",
        description:
            "How customers interact with the studio — active vs inactive, sign-ups, churn, retention, win-back.",
        icon: User01,
        items: [
            { slug: "customer-data",       label: "Customer Data (Active vs Inactive)"      },
            { slug: "member-movement",     label: "Customer Movement (Sign-ups & Net Change)" },
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
            { slug: "promo-redemptions",      label: "Promotion Redemptions"  },
            { slug: "referrals",              label: "Referral Report"        },
            { slug: "acquisition-efficiency", label: "Acquisition Efficiency" },
        ],
    },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ReportsPage() {
    const router = useRouter();

    // Favourites hydrate AFTER mount (SSR renders none → no hydration
    // mismatch; the pin order settles on the first client tick).
    const [favorites, setFavorites] = useState<Set<string>>(() => new Set());
    useEffect(() => { setFavorites(loadFavorites()); }, []);

    const toggleFavorite = useCallback((slug: string) => {
        setFavorites(prev => {
            const next = new Set(prev);
            if (next.has(slug)) next.delete(slug); else next.add(slug);
            saveFavorites(next);
            return next;
        });
    }, []);

    function handleSelect(item: ReportItem) {
        // Every item routes to /reports/{slug}. Built ones render on the
        // shell; unbuilt slugs 404 naturally — the client sees the full
        // Excel catalogue on the landing.
        router.push(`/reports/${item.slug}`);
    }

    // Filter categories + items via feature-flags so QA can hide whole
    // categories (uncomment all its slugs in DISABLED_ROUTE_PREFIXES) or
    // individual reports. Categories with no enabled items drop entirely.
    const visibleCategories = useMemo(() =>
        CATEGORIES
            .filter(cat => !isReportCategoryDisabled(cat.id))
            .map(cat => ({
                ...cat,
                items: cat.items.filter(item => !isReportSlugDisabled(item.slug)),
            }))
            .filter(cat => cat.items.length > 0),
    []);

    return (
        <div className="flex flex-col gap-6 w-full">
            {visibleCategories.map(category => (
                <CategoryCard
                    key={category.id}
                    category={category}
                    favorites={favorites}
                    onToggleFavorite={toggleFavorite}
                    onSelect={handleSelect}
                />
            ))}
        </div>
    );
}

// ─── Card ──────────────────────────────────────────────────────────────────

function CategoryCard({
    category,
    favorites,
    onToggleFavorite,
    onSelect,
}: {
    category: ReportCategory;
    favorites: Set<string>;
    onToggleFavorite: (slug: string) => void;
    onSelect: (item: ReportItem) => void;
}) {
    const Icon = category.icon;

    // Pin favourited reports to the top of this category. Array partition
    // preserves each group's original spec order (stable — no reshuffling
    // within the starred or unstarred groups).
    const orderedItems = useMemo(() => {
        const starred = category.items.filter(i => favorites.has(i.slug));
        const rest    = category.items.filter(i => !favorites.has(i.slug));
        return [...starred, ...rest];
    }, [category.items, favorites]);

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

            {/* Right — report items as a divider-separated list. Each row is a
                star toggle (left) + the report link (fills the rest). */}
            <ul className="flex-1 min-w-0 flex flex-col rounded-[12px] overflow-hidden py-1">
                {orderedItems.map((item, idx) => {
                    const isFav = favorites.has(item.slug);
                    return (
                        <li key={item.slug} className="flex flex-col w-full">
                            <div className="flex items-center gap-1.5 px-[10px] py-[9px] mx-[6px] rounded-[6px] hover:bg-[#f9fafb] transition-colors">
                                <button
                                    type="button"
                                    onClick={() => onToggleFavorite(item.slug)}
                                    aria-label={isFav ? `Unpin ${item.label}` : `Pin ${item.label} to top`}
                                    aria-pressed={isFav}
                                    title={isFav ? "Remove from favourites" : "Add to favourites"}
                                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-[4px] hover:bg-[#f2f4f7] transition-colors"
                                >
                                    <Star01
                                        className={cn(
                                            "w-4 h-4 transition-colors",
                                            isFav ? "text-[#fdb022]" : "text-[#d0d5dd] hover:text-[#98a2b3]",
                                        )}
                                        fill={isFav ? "#fdb022" : "none"}
                                    />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onSelect(item)}
                                    className="flex-1 min-w-0 text-left truncate rounded-[6px] text-[14px] font-medium leading-[20px] text-[#344054]"
                                >
                                    {item.label}
                                </button>
                            </div>
                            {idx < orderedItems.length - 1 && (
                                <div className="h-px bg-[#e4e7ec] my-1" />
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
