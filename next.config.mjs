/** @type {import('next').NextConfig} */
const nextConfig = {
    // Legacy /reports/{slug} → new shell equivalents. Kept as PERMANENT
    // redirects so old bookmarks + external links (email, print, etc.)
    // don't break. Each mapping is annotated with why — see also the
    // full audit in new-prd/reports-implementation-plan.md.
    async redirects() {
        return [
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
