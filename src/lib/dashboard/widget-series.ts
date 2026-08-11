// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Dashboard widget series (REAL data, centralized mock)
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the hard-coded SEEDS in DashboardWidgetCard with values aggregated
// LIVE from the store (which is seeded from the centralized mock data in
// src/data/mock/). Every series is:
//   • bucketed to the SAME period points the x-axis labels use (one source of
//     truth: `bucketsForPeriod` → the widget card's `pointsForPeriod` derives
//     its labels from these buckets, so bars/points always line up), and
//   • branch-scoped by REAL filtering on each row's branchId (no fake
//     per-branch multiplier) — changing the location dropdown re-aggregates.
//
// Money uses the shared recognized-revenue engine + honest ledger so a widget
// and its KPI card agree: Sales = gross at sale, Revenue = recognized.

import type { CustomerTransaction, ClassBooking } from "@/lib/store";
import { computeRecognizedRevenue } from "@/lib/reports/recognized-revenue";
import { resolveLedger, signedAmount } from "@/lib/reports/refunds";
import type { DateFilter } from "@/components/ui/date-range-filter";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtMMMD(d: Date): string {
    return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
}

/** One x-axis point with its concrete date-range bounds (ms, inclusive). */
export interface WidgetBucket {
    label: string;
    fromMs: number;
    toMs: number;
}

/** Resolve a preset period LABEL to concrete from/to bounds anchored to today.
 *  Mirrors the widget card's `resolvePresetBounds` exactly so labels align. */
function resolvePresetBounds(period: DateFilter): { from: Date; to: Date } {
    if (period.type === "custom") return { from: period.from, to: period.to };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const label = period.label.toLowerCase();
    switch (period.type) {
        case "day": {
            if (label.includes("yesterday")) {
                const y = new Date(today); y.setDate(y.getDate() - 1);
                return { from: y, to: y };
            }
            if (label.includes("last 7 days"))  { const from = new Date(today); from.setDate(from.getDate() - 6);  return { from, to: today }; }
            if (label.includes("last 30 days")) { const from = new Date(today); from.setDate(from.getDate() - 29); return { from, to: today }; }
            if (label.includes("last 90 days")) { const from = new Date(today); from.setDate(from.getDate() - 89); return { from, to: today }; }
            return { from: today, to: today };
        }
        case "week": {
            const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
            const start = new Date(today); start.setDate(start.getDate() - dow);
            const end = new Date(start); end.setDate(end.getDate() + 6);
            if (label.includes("last")) { start.setDate(start.getDate() - 7); end.setDate(end.getDate() - 7); }
            return { from: start, to: end };
        }
        case "month": {
            const y = today.getFullYear(); const m = today.getMonth();
            if (label.includes("last month")) return { from: new Date(y, m - 1, 1), to: new Date(y, m, 0) };
            if (label.includes("last 12"))    { const from = new Date(today); from.setMonth(from.getMonth() - 11); return { from, to: today }; }
            const first = new Date(y, m, 1);
            const last  = label.includes("to date") ? today : new Date(y, m + 1, 0);
            return { from: first, to: last };
        }
        case "year": {
            const y = today.getFullYear();
            if (label.includes("last year")) return { from: new Date(y - 1, 0, 1), to: new Date(y - 1, 11, 31) };
            const from = new Date(y, 0, 1);
            const to = label.includes("to date") ? today : new Date(y, 11, 31);
            return { from, to };
        }
    }
    return { from: today, to: today };
}

const DAY_MS = 86_400_000;
function dayStart(d: Date): number { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }
function dayEnd(d: Date): number { const x = new Date(d); x.setHours(23, 59, 59, 999); return x.getTime(); }

/** The x-axis points for a period, each with concrete date bounds. Labels are
 *  IDENTICAL to the widget card's `pointsForPeriod` (which now derives its
 *  labels from here), so every widget's bars/points align with the axis. */
export function bucketsForPeriod(period: DateFilter): WidgetBucket[] {
    const dailyRange = (from: Date, count: number): WidgetBucket[] =>
        Array.from({ length: count }, (_, i) => {
            const d = new Date(from); d.setDate(d.getDate() + i);
            return { label: fmtMMMD(d), fromMs: dayStart(d), toMs: dayEnd(d) };
        });

    switch (period.type) {
        case "day": {
            const label = period.label.toLowerCase();
            if (label.includes("last 7 days"))  return dailyRange(resolvePresetBounds(period).from, 7);
            if (label.includes("last 30 days")) return dailyRange(resolvePresetBounds(period).from, 30);
            if (label.includes("last 90 days")) {
                const { from } = resolvePresetBounds(period);
                return Array.from({ length: 13 }, (_, i) => {
                    const start = new Date(from); start.setDate(start.getDate() + i * 7);
                    const end = new Date(start); end.setDate(end.getDate() + 6);
                    return { label: `Wk of ${fmtMMMD(start)}`, fromMs: dayStart(start), toMs: dayEnd(end) };
                });
            }
            // Today / Yesterday → 24 hourly buckets on the resolved day.
            const { from } = resolvePresetBounds(period);
            const base = dayStart(from);
            return Array.from({ length: 24 }, (_, i) => ({
                label: `${String(i).padStart(2, "0")}:00`,
                fromMs: base + i * 3_600_000,
                toMs: base + (i + 1) * 3_600_000 - 1,
            }));
        }
        case "week":
            return dailyRange(resolvePresetBounds(period).from, 7);
        case "month": {
            const label = period.label.toLowerCase();
            if (label.includes("last 12")) {
                const today = new Date(); today.setDate(1); today.setHours(0, 0, 0, 0);
                return Array.from({ length: 12 }, (_, i) => {
                    const d = new Date(today); d.setMonth(d.getMonth() - (11 - i));
                    const from = new Date(d.getFullYear(), d.getMonth(), 1);
                    const to = new Date(d.getFullYear(), d.getMonth() + 1, 0);
                    return { label: MONTH_LABELS[d.getMonth()], fromMs: dayStart(from), toMs: dayEnd(to) };
                });
            }
            const { from, to } = resolvePresetBounds(period);
            const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / DAY_MS) + 1);
            return dailyRange(from, days);
        }
        case "year": {
            const { from } = resolvePresetBounds(period);
            const y = from.getFullYear();
            return Array.from({ length: 12 }, (_, m) => {
                const s = new Date(y, m, 1); const e = new Date(y, m + 1, 0);
                return { label: MONTH_LABELS[m], fromMs: dayStart(s), toMs: dayEnd(e) };
            });
        }
        case "custom": {
            const days = Math.max(1, Math.min(60, Math.round((period.to.getTime() - period.from.getTime()) / DAY_MS) + 1));
            return dailyRange(period.from, days);
        }
    }
    return [];
}

// ─── Financial widget aggregators ───────────────────────────────────────────

export interface WidgetInput {
    transactions: CustomerTransaction[];
    bookings: ClassBooking[];
    packages: { id: string; credits: number; name?: string; isIntro?: boolean }[];
    memberships: { id: string; credits: number | string; duration_months?: number; name?: string; isIntro?: boolean }[];
    /** Non-archived flag comes via `status`; archived customers are excluded
     *  from member/count surfaces. */
    customers: { id: string; createdAt: string; status: "active" | "archived"; marketingSource?: string; branchId: string }[];
    customerPlans: { id: string; customerId: string; kind: "membership" | "package" | "complimentary"; productId?: string; status: string; purchasedAtISO: string; expiryISO: string; cancelledAtISO?: string; priceAed?: number }[];
    /** Class schedule instances — Class widgets bucket bookings by the class's
     *  `dateISO` (not booking time) and read booked/capacity for occupancy. */
    schedules: { id: string; dateISO: string; branchId: string; booked: number; capacity: number; type: string }[];
    /** Selected branch scope. Empty/undefined = all branches (aggregate). */
    branchIds?: string[];
}

/** Transaction kinds that count as a real product purchase. */
const PURCHASE_KIND = new Set(["membership", "package", "retail", "gift_card", "private", "recovery"]);

function branchOk(branchId: string, branchIds: string[] | undefined): boolean {
    if (!branchIds || branchIds.length === 0) return true;
    return branchIds.includes(branchId);
}
function txnMs(t: { createdAtISO: string }): number { return new Date(t.createdAtISO).getTime(); }
function inBucket(ms: number, b: WidgetBucket): boolean { return ms >= b.fromMs && ms <= b.toMs; }

/** Real per-period series for a widget (Financial or Customer category), or
 *  null if `id` isn't one this module handles. Row shape matches `buildSeries`:
 *  `{ date: label, ...keys }` for time-series; a ranked/funnel array otherwise. */
export function computeWidgetSeries(
    id: string,
    period: DateFilter,
    input: WidgetInput,
): Record<string, string | number>[] | null {
    const buckets = bucketsForPeriod(period);
    const { branchIds } = input;

    // Branch-scoped copies used by every money aggregate below.
    const txns = input.transactions.filter(t => branchOk(t.branchId, branchIds));
    const scheduleBranchOk = (b: ClassBooking) => branchOk(b.branchId, branchIds);
    const bookings = input.bookings.filter(scheduleBranchOk);
    const revInput = { transactions: txns, bookings, packages: input.packages, memberships: input.memberships };

    // Honest ledger (settled sales only, refunds netted on their own date),
    // branch-scoped — used by revenue-by-type's private/recovery columns.
    const ledger = resolveLedger(input.transactions).filter(r => branchOk(r.branchId, branchIds));

    // ── Customer-widget scoping ──────────────────────────────────────────
    // Non-archived customers in branch scope; plans joined to their customer's
    // branch (plans carry no branchId) and excluded when the customer is
    // archived — matches the customers list + KPI.
    const custById = new Map(input.customers.map(c => [c.id, c]));
    const custInScope = (cid: string) => { const c = custById.get(cid); return !!c && c.status !== "archived" && branchOk(c.branchId, branchIds); };
    const scopedCustomers = input.customers.filter(c => c.status !== "archived" && branchOk(c.branchId, branchIds));
    const scopedPlans = input.customerPlans.filter(p => custInScope(p.customerId));
    const introIds = new Set<string>([
        ...input.packages.filter(p => p.isIntro).map(p => p.id),
        ...input.memberships.filter(m => m.isIntro).map(m => m.id),
    ]);
    const planStartMs = (p: WidgetInput["customerPlans"][number]) => Date.parse(p.purchasedAtISO);
    const planEndMs = (p: WidgetInput["customerPlans"][number]) => Date.parse((p.status === "cancelled" || p.status === "removed") && p.cancelledAtISO ? p.cancelledAtISO : p.expiryISO);
    const activeDuring = (p: WidgetInput["customerPlans"][number], b: WidgetBucket) => planStartMs(p) <= b.toMs && planEndMs(p) >= b.fromMs;

    // ── Class-widget scoping ─────────────────────────────────────────────
    // Class bookings bucket by their schedule's dateISO (the class date), not
    // the booking time. `bookings` is already branch-scoped (booking.branchId).
    const schedById = new Map(input.schedules.map(s => [s.id, s]));
    const classDateMs = (bk: ClassBooking): number | null => {
        const s = schedById.get(bk.classScheduleId);
        return s ? Date.parse(s.dateISO) : null;
    };
    const scopedClassSchedules = input.schedules.filter(s => s.type === "class" && branchOk(s.branchId, branchIds));

    const isSettledSale = (t: CustomerTransaction) =>
        t.status === "complete" && (t.transactionType === undefined || t.transactionType === "sale");

    switch (id) {
        case "revenue-overview": {
            // Recognized revenue per bucket + the same bucket one period earlier.
            const span = buckets.length ? (buckets[buckets.length - 1].toMs - buckets[0].fromMs) : 0;
            return buckets.map(b => ({
                date: b.label,
                revenue: Math.round(computeRecognizedRevenue(revInput, b.fromMs, b.toMs)),
                lastWeek: Math.round(computeRecognizedRevenue(revInput, b.fromMs - span, b.toMs - span)),
            }));
        }
        case "revenue-vs-new-customers": {
            // Recognized revenue + count of non-archived customers who joined
            // in the bucket, branch-scoped.
            return buckets.map(b => ({
                date: b.label,
                revenue: Math.round(computeRecognizedRevenue(revInput, b.fromMs, b.toMs)),
                newCustomers: scopedCustomers.filter(c => inBucket(Date.parse(c.createdAt), b)).length,
            }));
        }
        case "sales-by-product": {
            // Gross SALES (settled) AED by product kind per bucket.
            return buckets.map(b => {
                let membership = 0, pkg = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    if (t.kind === "membership") membership += t.amountAed;
                    else if (t.kind === "package") pkg += t.amountAed;
                }
                return { date: b.label, membership: Math.round(membership), package: Math.round(pkg) };
            });
        }
        case "revenue-by-type": {
            // classes = recognized revenue from membership/package plans;
            // private/recovery = net (recognized-at-sale) from the ledger.
            const classInput = { ...revInput, transactions: txns.filter(t => t.kind === "membership" || t.kind === "package") };
            return buckets.map(b => {
                const classes = Math.round(computeRecognizedRevenue(classInput, b.fromMs, b.toMs));
                let priv = 0, recovery = 0;
                for (const r of ledger) {
                    const ms = new Date(r.createdAtISO).getTime();
                    if (!inBucket(ms, b)) continue;
                    if (r.kind === "private") priv += signedAmount(r);
                    else if (r.kind === "recovery") recovery += signedAmount(r);
                }
                return { date: b.label, classes, private: Math.round(priv), recovery: Math.round(recovery) };
            });
        }
        case "payments-collected": {
            // Money actually received = settled sale transactions gross.
            return buckets.map(b => {
                let v = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    v += t.amountAed;
                }
                return { date: b.label, v: Math.round(v) };
            });
        }
        case "payments-by-source": {
            // COUNT of settled payments by origin. Real paymentSource
            // (pos / customer_portal / admin) mapped to the widget's 3 buckets:
            //   crm ← admin (back-office)   app ← customer_portal   web ← pos.
            return buckets.map(b => {
                let crm = 0, app = 0, web = 0;
                for (const t of txns) {
                    if (!isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    const src = t.paymentSource ?? "pos";
                    if (src === "admin") crm += 1;
                    else if (src === "customer_portal") app += 1;
                    else web += 1;  // pos + any other
                }
                return { date: b.label, crm, app, web };
            });
        }

        // ── Customer widgets ────────────────────────────────────────────
        case "active-memberships": {
            const mem = scopedPlans.filter(p => p.kind === "membership");
            return buckets.map(b => ({ date: b.label, v: mem.filter(p => activeDuring(p, b)).length }));
        }
        case "active-credits": {
            const pkg = scopedPlans.filter(p => p.kind === "package");
            return buckets.map(b => ({ date: b.label, v: pkg.filter(p => activeDuring(p, b)).length }));
        }
        case "memberships-sold": {
            // Count of settled membership sales per bucket, grouped into the 3
            // tiers by the membership product (unlimited credits / "advanced" in
            // the name / else beginner).
            const tierOf = new Map(input.memberships.map(m => {
                const name = (m.name ?? "").toLowerCase();
                const tier = m.credits === "unlimited" || name.includes("unlimited") ? "unlimited"
                    : name.includes("advanced") ? "advanced" : "beginner";
                return [m.id, tier as "beginner" | "advanced" | "unlimited"];
            }));
            return buckets.map(b => {
                const c = { beginner: 0, advanced: 0, unlimited: 0 };
                for (const t of txns) {
                    if (t.kind !== "membership" || !isSettledSale(t) || !inBucket(txnMs(t), b)) continue;
                    c[tierOf.get(t.productId) ?? "beginner"] += (t.quantity ?? 1);
                }
                return { date: b.label, ...c };
            });
        }
        case "returning-vs-new": {
            // Per bucket: distinct customers with a purchase in the bucket, split
            // into NEW (their first-ever purchase is in this bucket) vs RETURNING.
            const firstPurchaseMs = new Map<string, number>();
            for (const t of txns) {
                if (!isSettledSale(t) || !PURCHASE_KIND.has(t.kind) || !custInScope(t.customerId)) continue;
                const ms = txnMs(t);
                const cur = firstPurchaseMs.get(t.customerId);
                if (cur === undefined || ms < cur) firstPurchaseMs.set(t.customerId, ms);
            }
            return buckets.map(b => {
                const active = new Set<string>();
                for (const t of txns) {
                    if (!isSettledSale(t) || !PURCHASE_KIND.has(t.kind) || !custInScope(t.customerId)) continue;
                    if (inBucket(txnMs(t), b)) active.add(t.customerId);
                }
                let nw = 0, ret = 0;
                Array.from(active).forEach(cid => {
                    const first = firstPurchaseMs.get(cid);
                    if (first !== undefined && inBucket(first, b)) nw++; else ret++;
                });
                return { date: b.label, returning: ret, new: nw };
            });
        }
        case "new-customers-source": {
            // Ranked: non-archived customers who joined in the PERIOD, grouped
            // by marketing source (top 5).
            const from = buckets[0]?.fromMs ?? 0;
            const to = buckets[buckets.length - 1]?.toMs ?? 0;
            const counts = new Map<string, number>();
            for (const c of scopedCustomers) {
                const ms = Date.parse(c.createdAt);
                if (ms < from || ms > to) continue;
                const src = c.marketingSource || "Other";
                counts.set(src, (counts.get(src) ?? 0) + 1);
            }
            const palette = ["#b892ba", "#90a099", "#92d1de", "#f7b955", "#94aeaf"];
            return Array.from(counts.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([name, v], i) => ({ name, v, color: palette[i % palette.length] }));
        }
        case "top-memberships": {
            // Ranked: membership products by CURRENT live-holder count (top 5).
            const counts = new Map<string, number>();
            for (const p of scopedPlans) {
                if (p.kind !== "membership" || !p.productId) continue;
                if (!(p.status === "active" || p.status === "frozen" || p.status === "freeze_requested")) continue;
                counts.set(p.productId, (counts.get(p.productId) ?? 0) + 1);
            }
            const nameOf = new Map(input.memberships.map(m => [m.id, m.name ?? "Membership"]));
            return Array.from(counts.entries())
                .sort((a, b) => b[1] - a[1]).slice(0, 5)
                .map(([pid, v]) => ({ name: nameOf.get(pid) ?? "Membership", v }));
        }
        case "intro-member-funnel": {
            // Funnel (strict subsets): tried an intro → returned (a present
            // visit) → bought a non-intro plan.
            const tried = new Set<string>();
            for (const p of scopedPlans) if (p.productId && introIds.has(p.productId)) tried.add(p.customerId);
            const presentCustomers = new Set(bookings.filter(bk => bk.attendanceStatus === "present").map(bk => bk.customerId));
            const returned = new Set(Array.from(tried).filter(c => presentCustomers.has(c)));
            const boughtNonIntro = new Set<string>();
            for (const p of scopedPlans) {
                if ((p.kind === "membership" || p.kind === "package") && p.productId && !introIds.has(p.productId)) boughtNonIntro.add(p.customerId);
            }
            const bought = new Set(Array.from(returned).filter(c => boughtNonIntro.has(c)));
            return [
                { stage: "Tried an intro", sublabel: "trial / drop-in",     count: tried.size },
                { stage: "Returned",       sublabel: "booked a 2nd+ visit", count: returned.size },
                { stage: "Bought a plan",  sublabel: "membership or pack",  count: bought.size },
            ];
        }

        // ── Class widgets ───────────────────────────────────────────────
        case "class-bookings": {
            const booked = bookings.filter(bk => bk.status === "booked");
            return buckets.map(b => ({
                date: b.label,
                v: booked.filter(bk => { const ms = classDateMs(bk); return ms !== null && inBucket(ms, b); }).length,
            }));
        }
        case "bookings-by-source": {
            // Booking counts by origin, mapped to the widget's 3 buckets:
            // crm ← admin, app ← customer_portal, web ← front_desk / pos / other.
            return buckets.map(b => {
                let crm = 0, app = 0, web = 0;
                for (const bk of bookings) {
                    if (bk.status !== "booked") continue;
                    const ms = classDateMs(bk);
                    if (ms === null || !inBucket(ms, b)) continue;
                    const src = bk.bookingSource ?? "pos";
                    if (src === "admin") crm += 1;
                    else if (src === "customer_portal") app += 1;
                    else web += 1;
                }
                return { date: b.label, crm, app, web };
            });
        }
        case "bookings-vs-visits": {
            return buckets.map(b => {
                let bk = 0, vis = 0;
                for (const x of bookings) {
                    const ms = classDateMs(x);
                    if (ms === null || !inBucket(ms, b)) continue;
                    if (x.status === "booked") bk += 1;
                    if (x.attendanceStatus === "present") vis += 1;
                }
                return { date: b.label, bookings: bk, visits: vis };
            });
        }
        case "attendance-overview": {
            return buckets.map(b => {
                let visits = 0, cancellations = 0, noShow = 0;
                for (const x of bookings) {
                    const ms = classDateMs(x);
                    if (ms === null || !inBucket(ms, b)) continue;
                    if (x.attendanceStatus === "present") visits += 1;
                    else if (x.status === "cancelled" || x.attendanceStatus === "late_cancel") cancellations += 1;
                    else if (x.attendanceStatus === "no_show") noShow += 1;
                }
                return { date: b.label, visits, cancellations, noShow };
            });
        }
        case "no-show-rate": {
            return buckets.map(b => {
                let present = 0, noShow = 0;
                for (const x of bookings) {
                    const ms = classDateMs(x);
                    if (ms === null || !inBucket(ms, b)) continue;
                    if (x.attendanceStatus === "present") present += 1;
                    else if (x.attendanceStatus === "no_show") noShow += 1;
                }
                const denom = present + noShow;
                return { date: b.label, rate: denom > 0 ? Math.round((noShow / denom) * 100) : 0 };
            });
        }
        case "underfilled-trend": {
            // Class instances in the bucket filled under 30% of capacity.
            return buckets.map(b => ({
                date: b.label,
                count: scopedClassSchedules.filter(s => {
                    const ms = Date.parse(s.dateISO);
                    if (!inBucket(ms, b)) return false;
                    const occ = s.capacity > 0 ? (s.booked ?? 0) / s.capacity : 0;
                    return occ < 0.3;
                }).length,
            }));
        }

        default:
            return null;
    }
}
