"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Breadcrumbs
// ─────────────────────────────────────────────────────────────────────────────
//
// Renders the clickable crumb trail returned by
// `resolveBreadcrumbs(pathname, store)`.
//
// Two mount points:
//   1. `AdminLayout` + `InstructorLayout` — between the Header and page
//      content, covers every `/admin/*` and `/instructor/*` route.
//   2. Directly inside each detail-takeover page (routes that live OUTSIDE
//      `/admin/*`, e.g. `/customers/[id]`, `/schedule/[classId]`). Those
//      pages replace their static "Class details" h1 with `<Breadcrumbs />`.
//
// Module-rooted per client Jul 2026 — no "Home" crumb, no home icon.
// Auto-hides on top-level dashboards where the trail would be a single crumb.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { resolveBreadcrumbs } from "@/config/breadcrumbs";
import { cn } from "@/lib/utils";

/** Max characters shown per crumb before we truncate with a middle
 *  ellipsis. Sized so a "Muhammed Abdulrahman Al-Farooq" name reads as
 *  "Muhammed Abd…l-Farooq" — start + end preserved, middle collapsed. */
const TRUNCATE_MAX = 34;

function truncate(label: string): string {
    if (label.length <= TRUNCATE_MAX) return label;
    const half = Math.floor((TRUNCATE_MAX - 1) / 2);
    return `${label.slice(0, half)}…${label.slice(-half)}`;
}

export interface BreadcrumbsProps {
    /** Extra classes applied to the outer `<nav>` — pass zero-padding
     *  utilities when the caller wants to control spacing themselves
     *  (e.g. detail-page headers that already own their own padding). */
    className?: string;
}

export function Breadcrumbs({ className }: BreadcrumbsProps = {}) {
    const pathname = usePathname();
    // Full store snapshot — the resolver needs to look up customer names,
    // class names, staff names, etc. against the live slices.
    const store = useAppStore(s => s);
    const segments = resolveBreadcrumbs(pathname ?? "", store);

    // Render only when there's an actual PATH to show (2+ crumbs). A lone
    // crumb — e.g. "Customers" on the customers LIST page — just duplicates
    // the header title, so we hide it. Detail / edit / settings-sub pages
    // always have 2+ crumbs and show the full trail.
    if (segments.length < 2) return null;

    return (
        <nav
            aria-label="Breadcrumb"
            className={cn(
                "flex items-center gap-1.5 text-[13px] leading-[18px] flex-shrink-0 min-w-0",
                // Default padding when caller doesn't override — matches the
                // 24px horizontal alignment used across the admin chrome.
                className ?? "px-6 pt-3 pb-1",
            )}
        >
            {segments.map((seg, i) => {
                const isLast = i === segments.length - 1;
                const inner = (
                    <span
                        className={cn(
                            "truncate",
                            isLast
                                ? "text-[#344054] font-semibold"
                                : "text-[#667085]",
                        )}
                        title={seg.label}
                    >
                        {truncate(seg.label)}
                    </span>
                );
                return (
                    <div key={i} className="flex items-center gap-1.5 min-w-0">
                        {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#d0d5dd] shrink-0" />}
                        {isLast || !seg.href ? (
                            inner
                        ) : (
                            <Link
                                href={seg.href}
                                className="flex items-center min-w-0 hover:text-[#101828] transition-colors"
                            >
                                {inner}
                            </Link>
                        )}
                    </div>
                );
            })}
        </nav>
    );
}
