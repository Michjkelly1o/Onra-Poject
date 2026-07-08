// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing KPIs
// ─────────────────────────────────────────────────────────────────────────────
//
// KPI cards for the Marketing tab of /admin/kpi. Reads through the same
// slices Marketing reports use (leads · marketingCampaignStats ·
// marketingSpend · customerReferrals · customerTransactions).
//
// KPIs implemented (per new-prd/Onra_KPI_Catalogue.pdf §Marketing):
//   46  New leads                       Lookback  count of leads added_at in window
//   47  Leads by source (top source)    Lookback  top source + share
//   48  Lead → trial conversion         Lookback  % · lead stage advanced to trial+
//   49  Lead → paid conversion          Lookback  % · lead stage=paid
//   50  Avg time to convert             Lookback  days from added_at to first_purchase
//   51  Open leads by stage             Snapshot  count in follow-up stages
//   52  Avg time to first contact       Lookback  hours from added_at to first_contact
//   53  Campaign reach / sends          Lookback  sum sends
//   54  Campaign engagement             Lookback  avg open+read rate %
//   55  Campaign-attributed bookings    Lookback  sum attributed_bookings
//   56  Campaign-attributed revenue     Lookback  sum attributed_revenue
//   57  Promo redemptions               Lookback  count of transactions with discount_code
//   58  Referrals & referral conversion Lookback  referrals count + conversion %
//   59  CPL                             Lookback  spend ÷ new leads
//   60  CAC                             Lookback  spend ÷ new members
//   61  ROAS                            Lookback  attributed revenue ÷ spend
//   62  CAC:LTV ratio                   Snapshot  CAC ÷ avg LTV
//
// Not skipped — Marketing has no Forward/live KPIs in the PDF (all
// 17 map into Lookback or Snapshot).

import type { AppState } from "@/lib/store";
import type { Metric } from "@/components/insights/InsightMetricCard";
import { selectCustomers } from "@/lib/reports/selectors";
import type { Window, RangePair } from "./date-range";
import { aed, num, pct, delta, inWindow, branchOk } from "./financial";

// ─── Public API ──────────────────────────────────────────────────────────

export function computeMarketingKpis(
    state: AppState,
    range: RangePair,
    branchFilter: Set<string> | null,
): Metric[] {
    const { current, prior, priorLabel } = range;
    const period = priorLabel;

    const leads = state.leads.filter(l => branchOk(l.branch_id, branchFilter));
    const campaigns = state.marketingCampaignStats.filter(c => branchOk(c.branch_id, branchFilter));
    const spend = state.marketingSpend.filter(s => branchOk(s.branch_id, branchFilter));
    const referrals = state.customerReferrals;

    // ── 46. New leads in window ──────────────────────────────────────────
    const newLeadsCur   = leads.filter(l => inWindow(l.added_at, current)).length;
    const newLeadsPrior = leads.filter(l => inWindow(l.added_at, prior)).length;

    // ── 47. Leads by source — top source in window ──────────────────────
    const bySource = new Map<string, number>();
    for (const l of leads) {
        if (!inWindow(l.added_at, current)) continue;
        bySource.set(l.source, (bySource.get(l.source) ?? 0) + 1);
    }
    let topSource = "—";
    let topSourceCount = 0;
    for (const [src, count] of Array.from(bySource.entries())) {
        if (count > topSourceCount) { topSource = src; topSourceCount = count; }
    }
    const topSourcePct = newLeadsCur > 0 ? (topSourceCount / newLeadsCur) * 100 : 0;

    // ── 48/49. Funnel conversions ────────────────────────────────────────
    const leadsInWin = leads.filter(l => inWindow(l.added_at, current));
    const leadsInPrior = leads.filter(l => inWindow(l.added_at, prior));
    const trialStages = new Set(["trial-booked", "trial-attended", "paid"]);
    const trialsCur   = leadsInWin.filter(l => trialStages.has(l.stage)).length;
    const paidCur     = leadsInWin.filter(l => l.stage === "paid").length;
    const trialsPrior = leadsInPrior.filter(l => trialStages.has(l.stage)).length;
    const paidPrior   = leadsInPrior.filter(l => l.stage === "paid").length;
    const leadToTrialCur   = leadsInWin.length   > 0 ? (trialsCur   / leadsInWin.length)   * 100 : 0;
    const leadToTrialPrior = leadsInPrior.length > 0 ? (trialsPrior / leadsInPrior.length) * 100 : 0;
    const leadToPaidCur    = leadsInWin.length   > 0 ? (paidCur     / leadsInWin.length)   * 100 : 0;
    const leadToPaidPrior  = leadsInPrior.length > 0 ? (paidPrior   / leadsInPrior.length) * 100 : 0;

    // ── 50. Avg time to convert (days) ───────────────────────────────────
    const convertDays: number[] = [];
    for (const l of leadsInWin) {
        if (!l.first_purchase_at) continue;
        const diff = (new Date(l.first_purchase_at).getTime() - new Date(l.added_at).getTime()) / (24 * 60 * 60 * 1000);
        if (Number.isFinite(diff) && diff >= 0) convertDays.push(diff);
    }
    const avgTimeConvertCur = convertDays.length > 0 ? convertDays.reduce((a, b) => a + b, 0) / convertDays.length : 0;

    // ── 51. Open leads by stage — Snapshot ───────────────────────────────
    // Sum of leads currently in follow-up stages (not paid, not lost).
    const followUpStages = new Set(["new", "contacted", "trial-booked", "trial-attended"]);
    const openLeadsNow = leads.filter(l => followUpStages.has(l.stage)).length;

    // ── 52. Avg time to first contact (hours) ────────────────────────────
    const contactHours: number[] = [];
    for (const l of leadsInWin) {
        if (!l.first_contact_at) continue;
        const diff = (new Date(l.first_contact_at).getTime() - new Date(l.added_at).getTime()) / (60 * 60 * 1000);
        if (Number.isFinite(diff) && diff >= 0) contactHours.push(diff);
    }
    const avgTimeContactCur = contactHours.length > 0 ? contactHours.reduce((a, b) => a + b, 0) / contactHours.length : 0;

    // ── 53. Campaign reach / sends ───────────────────────────────────────
    const campCur   = campaigns.filter(c => inWindow(c.sent_at, current));
    const campPrior = campaigns.filter(c => inWindow(c.sent_at, prior));
    const sendsCur   = campCur.reduce((s, c) => s + c.sends, 0);
    const sendsPrior = campPrior.reduce((s, c) => s + c.sends, 0);

    // ── 54. Campaign engagement — avg open/read rate ────────────────────
    const engagementCur = campCur.length > 0
        ? campCur.reduce((s, c) => s + (c.sends > 0 ? (c.opens_reads / c.sends) * 100 : 0), 0) / campCur.length
        : 0;
    const engagementPrior = campPrior.length > 0
        ? campPrior.reduce((s, c) => s + (c.sends > 0 ? (c.opens_reads / c.sends) * 100 : 0), 0) / campPrior.length
        : 0;

    // ── 55/56. Attributed bookings + revenue ────────────────────────────
    const attrBookCur   = campCur.reduce((s, c) => s + c.attributed_bookings, 0);
    const attrBookPrior = campPrior.reduce((s, c) => s + c.attributed_bookings, 0);
    const attrRevCur   = campCur.reduce((s, c) => s + c.attributed_revenue_aed, 0);
    const attrRevPrior = campPrior.reduce((s, c) => s + c.attributed_revenue_aed, 0);

    // ── 57. Promo redemptions ────────────────────────────────────────────
    const txPromoCur = state.customerTransactions.filter(t =>
        t.discountCode && inWindow(t.createdAtISO, current) && branchOk(t.branchId, branchFilter)
    );
    const txPromoPrior = state.customerTransactions.filter(t =>
        t.discountCode && inWindow(t.createdAtISO, prior) && branchOk(t.branchId, branchFilter)
    );
    const promoRedeemedCur   = txPromoCur.length;
    const promoRedeemedPrior = txPromoPrior.length;

    // ── 58. Referrals & referral conversion ─────────────────────────────
    const refCur   = referrals.filter(r => inWindow(r.referredAtISO, current));
    const refPrior = referrals.filter(r => inWindow(r.referredAtISO, prior));
    const refConvCur   = refCur.length   > 0 ? (refCur.filter(r => r.reactivated).length   / refCur.length)   * 100 : 0;
    const refConvPrior = refPrior.length > 0 ? (refPrior.filter(r => r.reactivated).length / refPrior.length) * 100 : 0;

    // ── 59/60/61. CPL / CAC / ROAS ──────────────────────────────────────
    // Spend rows are per-month; sum spend for months that intersect the
    // window (loose approximation for the demo — precise attribution
    // needs pro-rata by day).
    function monthInWindow(m: string, w: Window): boolean {
        const first = `${m}-01`;
        const last = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).toISOString().slice(0, 10);
        return !(last < w.fromISO || first > w.toISO);
    }
    const spendCur   = spend.filter(s => monthInWindow(s.month, current)).reduce((sum, s) => sum + s.spend_aed, 0);
    const spendPrior = spend.filter(s => monthInWindow(s.month, prior)).reduce((sum, s)   => sum + s.spend_aed, 0);
    // Leads = leadsInWin.length (already computed).
    // New members = paidCur (leads who reached paid stage).
    const cplCur   = newLeadsCur   > 0 ? spendCur   / newLeadsCur   : 0;
    const cplPrior = newLeadsPrior > 0 ? spendPrior / newLeadsPrior : 0;
    const cacCur   = paidCur   > 0 ? spendCur   / paidCur   : 0;
    const cacPrior = paidPrior > 0 ? spendPrior / paidPrior : 0;
    const roasCur   = spendCur   > 0 ? attrRevCur   / spendCur   : 0;
    const roasPrior = spendPrior > 0 ? attrRevPrior / spendPrior : 0;

    // ── 62. CAC : LTV ratio — Snapshot ──────────────────────────────────
    const customersRows = selectCustomers(state);
    const ltvValues = customersRows.map(c => c.lifetimeValue).filter(v => v > 0);
    const avgLtv = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;
    const cacLtvRatio = avgLtv > 0 ? cacCur / avgLtv : 0;

    return [
        { label: "New leads",                   value: num(newLeadsCur),                 change: delta(newLeadsCur, newLeadsPrior),   period,
          description: "New prospects captured in period, by configurable source.",
          drillTo: "/reports/lead-data" },
        { label: "Top source",                  value: `${topSource} · ${pct(topSourcePct)}`,                                                                       period: `top of ${num(newLeadsCur)} leads`,
          description: "Highest-volume acquisition source in period.",
          drillTo: "/reports/lead-data" },
        { label: "Lead → trial conversion",     value: pct(leadToTrialCur),              change: delta(leadToTrialCur, leadToTrialPrior), period,
          description: "Leads who booked a trial / intro.",
          drillTo: "/reports/lead-conversion" },
        { label: "Lead → paid conversion",      value: pct(leadToPaidCur),               change: delta(leadToPaidCur, leadToPaidPrior),   period,
          description: "Leads who became paying members (full funnel).",
          drillTo: "/reports/lead-conversion" },
        { label: "Avg time to convert",         value: `${avgTimeConvertCur.toFixed(1)} days`,                                                                     period,
          description: "Avg days from lead created to first purchase.",
          drillTo: "/reports/lead-conversion" },
        { label: "Open leads by stage",         value: num(openLeadsNow),                                                                                          period: "as of today",
          description: "Leads currently in follow-up (New, Contacted, Trial booked).",
          drillTo: "/reports/lead-data" },
        { label: "Avg time to first contact",   value: `${avgTimeContactCur.toFixed(1)} hrs`,                                                                     period,
          description: "Avg time from lead created to first staff touch.",
          drillTo: "/reports/lead-conversion" },
        { label: "Campaign reach / sends",      value: num(sendsCur),                    change: delta(sendsCur, sendsPrior),          period,
          description: "Messages sent across email, WhatsApp, push.",
          drillTo: "/reports/campaign-performance" },
        { label: "Campaign engagement",         value: pct(engagementCur),               change: delta(engagementCur, engagementPrior), period,
          description: "Open / click (email), read (WhatsApp), tap (push).",
          drillTo: "/reports/campaign-performance" },
        { label: "Campaign-attributed bookings", value: num(attrBookCur),                change: delta(attrBookCur, attrBookPrior),     period,
          description: "Bookings driven by a campaign within the attribution window.",
          drillTo: "/reports/campaign-performance" },
        { label: "Campaign-attributed revenue", value: aed(attrRevCur),                  change: delta(attrRevCur, attrRevPrior),       period,
          description: "Revenue driven by a campaign / channel.",
          drillTo: "/reports/campaign-performance" },
        { label: "Promotion redemptions",       value: num(promoRedeemedCur),            change: delta(promoRedeemedCur, promoRedeemedPrior), period,
          description: "Promotions redeemed in period.",
          drillTo: "/reports/promo-redemptions" },
        { label: "Referrals",                   value: num(refCur.length),               change: delta(refCur.length, refPrior.length), period,
          description: "Referrals captured in period.",
          drillTo: "/reports/referrals" },
        { label: "Referral conversion",         value: pct(refConvCur),                  change: delta(refConvCur, refConvPrior),        period,
          description: "Referred members who reactivated / joined ÷ total referrals.",
          drillTo: "/reports/referrals" },
        { label: "Cost per lead (CPL)",         value: aed(cplCur),                      change: delta(cplCur, cplPrior),                period,
          description: "Marketing spend ÷ new leads.",
          drillTo: "/reports/acquisition-efficiency" },
        { label: "Customer acquisition cost (CAC)", value: aed(cacCur),                  change: delta(cacCur, cacPrior),                period,
          description: "Marketing spend ÷ new members acquired.",
          drillTo: "/reports/acquisition-efficiency" },
        { label: "Return on ad spend (ROAS)",   value: `${roasCur.toFixed(2)}×`,         change: delta(roasCur, roasPrior),              period,
          description: "Attributed revenue ÷ marketing spend.",
          drillTo: "/reports/acquisition-efficiency" },
        { label: "CAC : LTV ratio",             value: cacLtvRatio > 0 ? `1 : ${(avgLtv / cacCur).toFixed(2)}` : "—",                                              period: "as of today",
          description: "Acquisition cost vs lifetime value.",
          drillTo: "/reports/acquisition-efficiency" },
    ];
}
