/** @type {import('next').NextConfig} */
const nextConfig = {
    // Legacy /reports/{slug} → new shell equivalents. Kept as PERMANENT
    // redirects so old bookmarks + external links (email, print, etc.)
    // don't break. Each mapping is annotated with why — see also the
    // full audit in new-prd/reports-implementation-plan.md.
    async redirects() {
        return [
            // ── URL consistency refactor — old module URLs → nav-matching URLs ──
            // Phase 1 · Payroll: /admin/compensation → /admin/staff/payroll
            { source: "/admin/compensation",   destination: "/admin/staff/payroll", permanent: true },
            { source: "/compensation/:path*",  destination: "/staff/payroll/:path*", permanent: true },
            // Phase 2 · Referrals: /admin/settings/referral → /admin/marketing/referrals
            { source: "/admin/settings/referral",   destination: "/admin/marketing/referrals", permanent: true },
            { source: "/settings/referral/:path*",  destination: "/marketing/referrals/:path*", permanent: true },
            // Phase 3 · Promotions: /admin/products/promo-codes → /admin/marketing/promotions
            { source: "/admin/products/promo-codes",  destination: "/admin/marketing/promotions", permanent: true },
            { source: "/products/promo-codes/:path*", destination: "/marketing/promotions/:path*", permanent: true },
            // Phase 4 · Classes: /admin/class-types → /admin/products/classes
            { source: "/admin/class-types",  destination: "/admin/products/classes", permanent: true },
            { source: "/class-types/:path*", destination: "/products/classes/:path*", permanent: true },
            // Phase 5 · Instructor takeover details → under /instructor/*
            { source: "/class/:path*",    destination: "/instructor/class/:path*",    permanent: true },
            { source: "/earnings/:path*", destination: "/instructor/earnings/:path*", permanent: true },
            // Phase 6 · Private / Recovery: /admin/services?type=… → own paths
            { source: "/admin/services", has: [{ type: "query", key: "type", value: "private" }],  destination: "/admin/products/private",  permanent: true },
            { source: "/admin/services", has: [{ type: "query", key: "type", value: "recovery" }], destination: "/admin/products/recovery", permanent: true },

            // Financial legacy → new consolidated / renamed reports
            { source: "/reports/memberships",         destination: "/reports/memberships-packages", permanent: true },
            { source: "/reports/packages",            destination: "/reports/memberships-packages", permanent: true },
            { source: "/reports/subscriptions",       destination: "/reports/mrr",                  permanent: true },

            // Frozen legacy → new snapshot report
            { source: "/reports/all-frozen-packages", destination: "/reports/frozen",               permanent: true },
            { source: "/reports/freeze-impact",       destination: "/reports/frozen",               permanent: true },

            // Customer legacy → Excel spec's canonical name
            { source: "/reports/active-vs-inactive",  destination: "/reports/customer-data",        permanent: true },
            { source: "/reports/attendance-frequency", destination: "/reports/customer-data",       permanent: true },
            { source: "/reports/retention",           destination: "/reports/retention-churn",      permanent: true },

            // Activity legacy → Bookings + Cancellations & No-shows + Top Classes
            { source: "/reports/all-bookings",              destination: "/reports/bookings",              permanent: true },
            { source: "/reports/bookings-by-class-events",  destination: "/reports/bookings",              permanent: true },
            { source: "/reports/bookings-by-customer",      destination: "/reports/bookings",              permanent: true },
            { source: "/reports/all-cancellations",         destination: "/reports/cancellations-noshows", permanent: true },
            { source: "/reports/all-no-shows",              destination: "/reports/cancellations-noshows", permanent: true },
            { source: "/reports/top-services-used",         destination: "/reports/top-classes-services",  permanent: true },

            // Staff legacy → new Staff Attendance
            { source: "/reports/instructor-attendance", destination: "/reports/staff-attendance",   permanent: true },

            // Marketing legacy → new Referral Report slug
            { source: "/reports/referral",              destination: "/reports/referrals",          permanent: true },
        ];
    },
};

export default nextConfig;
