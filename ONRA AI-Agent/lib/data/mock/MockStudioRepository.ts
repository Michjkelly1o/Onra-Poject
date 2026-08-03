// ─────────────────────────────────────────────────────────────────────────────
// MockStudioRepository — reads the mock-data seed arrays. Return shapes mirror
// what the future Onra API will return, so ApiStudioRepository is a drop-in.
// ─────────────────────────────────────────────────────────────────────────────
import type { AuthContext } from "@/lib/agent/auth";
import { branchFilter } from "@/lib/data/scope";
import { AED, type InsightCard } from "@/lib/agent/cards";
import type {
  StudioRepository,
  RevenueQuery,
  AttendanceQuery,
  ClassQuery,
  CustomerQuery,
  InstructorQuery,
  TrendQuery,
} from "@/lib/data/StudioRepository";
import type {
  BranchRow,
  CustomerRow,
  TransactionRow,
  ClassScheduleRow,
  ClassBookingRow,
  ClassTemplateRow,
  StaffProfileRow,
} from "@/lib/data/types";

// Import only self-contained seed files (avoid the barrel + the 3 files with
// external type imports: account_profile, instructor_profile, branding_settings).
import { branches as _branches } from "@/mock-data/branches";
import { customers as _customers } from "@/mock-data/customers";
import { customer_transactions as _txns } from "@/mock-data/customer_transactions";
import { class_schedule as _schedule } from "@/mock-data/class_schedule";
import { class_bookings as _bookings } from "@/mock-data/class_bookings";
import { class_templates as _templates } from "@/mock-data/class_templates";
import { staff_profiles as _instructors } from "@/mock-data/staff_profiles";

const branches = _branches as unknown as BranchRow[];
const customers = _customers as unknown as CustomerRow[];
const txns = _txns as unknown as TransactionRow[];
const schedule = _schedule as unknown as ClassScheduleRow[];
const bookings = _bookings as unknown as ClassBookingRow[];
const templates = _templates as unknown as ClassTemplateRow[];
const instructors = _instructors as unknown as StaffProfileRow[];

const branchName = (id: string) =>
  branches.find((b) => b.id === id)?.name ?? id;
const templateName = (id: string) =>
  templates.find((t) => t.id === id)?.name ?? id;
const instructorName = (id: string) =>
  instructors.find((s) => s.id === id)?.full_name ?? id;

function inRange(iso: string, from?: string, to?: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (from && t < Date.parse(from)) return false;
  if (to && t > Date.parse(to + "T23:59:59Z")) return false;
  return true;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 100));

export class MockStudioRepository implements StudioRepository {
  getOverview(ctx: AuthContext): InsightCard {
    const activeMembers = branchFilter(ctx, customers).filter(
      (c) => c.status === "active",
    ).length;
    const visibleBranches =
      ctx.branchScope === "all"
        ? branches.filter((b) => b.status === "active").length
        : ctx.branchScope.length;
    const instr = branchFilter(ctx, instructors).length;
    const classes = branchFilter(ctx, schedule).length;
    return {
      card: "metric_group",
      title: "Studio snapshot",
      tiles: [
        { label: "Active members", value: String(activeMembers) },
        { label: "Branches", value: String(visibleBranches) },
        { label: "Instructors", value: String(instr) },
        { label: "Scheduled classes", value: String(classes) },
      ],
      note:
        ctx.branchScope === "all"
          ? "Across all branches."
          : `Scoped to ${ctx.branchScope.map(branchName).join(", ")}.`,
    };
  }

  queryRevenue(ctx: AuthContext, q: RevenueQuery): InsightCard {
    const rows = branchFilter(ctx, txns, q.branch_id).filter((t) =>
      inRange(t.created_at, q.from, q.to),
    );
    const sales = rows.filter(
      (t) => t.status === "complete" && t.transaction_type !== "refund",
    );
    const refunds = rows.filter(
      (t) => t.status === "refunded" || t.transaction_type === "refund",
    );
    const gross = sum(sales.map((t) => t.amount_aed));
    const refunded = sum(refunds.map((t) => t.amount_aed));

    if (sales.length === 0) {
      return {
        card: "empty",
        message: `No completed transactions found${
          q.from || q.to ? " in that date range" : ""
        }. The demo data is concentrated in early–mid 2026.`,
      };
    }

    if (q.group_by) {
      const key = (t: TransactionRow) =>
        q.group_by === "branch"
          ? branchName(t.branch_id)
          : q.group_by === "day"
            ? t.created_at.slice(0, 10)
            : t.name;
      const groups = new Map<string, number>();
      for (const t of sales)
        groups.set(key(t), (groups.get(key(t)) ?? 0) + t.amount_aed);
      const sorted = [...groups.entries()].sort((a, b) => b[1] - a[1]);
      return {
        card: "bar_chart",
        title: `Revenue by ${q.group_by}`,
        unit: "AED",
        bars: sorted.map(([k, v]) => ({ label: k, value: v })),
        note: `Net ${AED(gross - refunded)} across ${sales.length} sales.`,
        deepLink: "Go to insight",
      };
    }

    return {
      card: "metric_group",
      title: "Revenue",
      tiles: [
        { label: "Gross", value: AED(gross) },
        { label: "Refunds", value: AED(refunded) },
        { label: "Net", value: AED(gross - refunded) },
        { label: "Transactions", value: String(sales.length) },
      ],
      note: "Completed transactions only. All amounts in AED.",
    };
  }

  queryAttendance(ctx: AuthContext, q: AttendanceQuery): InsightCard {
    // class_schedule carries the date; join bookings by class_schedule_id.
    const sched = branchFilter(ctx, schedule, q.branch_id).filter((s) =>
      inRange(s.date_iso, q.from, q.to),
    );
    const ids = new Set(sched.map((s) => s.id));
    const bk = branchFilter(ctx, bookings, q.branch_id).filter((b) =>
      ids.has(b.class_schedule_id),
    );
    const present = bk.filter((b) => b.attendance_status === "present").length;
    const noShow = bk.filter((b) => b.attendance_status === "no_show").length;
    const total = present + noShow;
    if (total === 0)
      return { card: "empty", message: "No attended/no-show bookings found in that window." };
    return {
      card: "donut",
      title: "Attendance",
      unit: "count",
      segments: [
        { label: "Attended", value: present },
        { label: "No-shows", value: noShow },
      ],
      centerValue: `${pct(present, total)}%`,
      centerLabel: "attended",
      note: `${total} completed bookings · ${pct(noShow, total)}% no-show rate.`,
    };
  }

  queryClasses(ctx: AuthContext, q: ClassQuery): InsightCard {
    let sched = branchFilter(ctx, schedule, q.branch_id);
    if (q.status) sched = sched.filter((s) => s.status === q.status);
    // Aggregate by template: total booked / total capacity → occupancy.
    const agg = new Map<string, { booked: number; capacity: number; instr: string }>();
    for (const s of sched) {
      const cur = agg.get(s.template_id) ?? {
        booked: 0,
        capacity: 0,
        instr: s.instructor_id,
      };
      cur.booked += s.booked;
      cur.capacity += s.capacity;
      agg.set(s.template_id, cur);
    }
    const rows = [...agg.entries()]
      .map(([tid, v]) => ({
        title: templateName(tid),
        subtitle: instructorName(v.instr),
        booked: v.booked,
        occ: pct(v.booked, v.capacity),
      }))
      .sort((a, b) => b.booked - a.booked);
    if (rows.length === 0)
      return { card: "empty", message: "No classes match that filter." };
    return {
      card: "bar_chart",
      title: "Class by popularity",
      unit: "count",
      bars: rows.map((r) => ({
        label: r.title,
        sublabel: `${r.subtitle} · ${r.occ}% full`,
        value: r.booked,
      })),
      note: "Bar length = total bookings.",
      deepLink: "Go to insight",
    };
  }

  queryCustomers(ctx: AuthContext, q: CustomerQuery): InsightCard {
    const limit = q.limit ?? 15;
    let rows = branchFilter(ctx, customers, q.branch_id);
    if (q.status) rows = rows.filter((c) => c.status === q.status);

    if (q.signal === "churn_risk" || q.signal === "expiring_soon") {
      const now = Date.parse("2026-07-09");
      const soon = now + 21 * 864e5; // 21 days
      const atRisk = rows
        .filter((c) => c.status === "active")
        .filter((c) => {
          const exp = c.plan_expiry_iso ? Date.parse(c.plan_expiry_iso) : NaN;
          const expiring = !Number.isNaN(exp) && exp <= soon;
          const stale =
            q.signal === "churn_risk" &&
            c.last_visit_iso &&
            Date.parse(c.last_visit_iso) < now - 30 * 864e5;
          return expiring || stale;
        })
        .slice(0, limit);
      if (atRisk.length === 0)
        return { card: "empty", message: "No at-risk members found — nice." };
      return {
        card: "ranked_list",
        title: q.signal === "expiring_soon" ? "Plans expiring soon" : "Members at churn risk",
        rows: atRisk.map((c) => ({
          title: `${c.first_name} ${c.last_name}`,
          subtitle: c.plan_name ?? c.plan_kind ?? "no plan",
          right1: c.plan_expiry_iso
            ? `expires ${c.plan_expiry_iso.slice(0, 10)}`
            : undefined,
          right2: c.last_visit_iso
            ? `last visit ${c.last_visit_iso.slice(0, 10)}`
            : undefined,
        })),
      };
    }

    // composition → donut
    const active = rows.filter((c) => c.status === "active").length;
    const withMembership = rows.filter((c) => c.plan_kind === "membership").length;
    const withPackage = rows.filter((c) => c.plan_kind === "package").length;
    const noPlan = rows.filter((c) => c.plan_kind == null).length;
    return {
      card: "donut",
      title: "Members by plan",
      unit: "count",
      segments: [
        { label: "Membership", value: withMembership },
        { label: "Package", value: withPackage },
        { label: "No plan", value: noPlan },
      ],
      centerValue: String(rows.length),
      centerLabel: "members",
      note: `${active} active.`,
    };
  }

  queryInstructors(ctx: AuthContext, q: InstructorQuery): InsightCard {
    const sched = branchFilter(ctx, schedule, q.branch_id).filter(
      (s) => s.rating_count > 0,
    );
    const agg = new Map<string, { score: number; count: number; classes: number }>();
    for (const s of sched) {
      const cur = agg.get(s.instructor_id) ?? { score: 0, count: 0, classes: 0 };
      cur.score += s.rating * s.rating_count;
      cur.count += s.rating_count;
      cur.classes += 1;
      agg.set(s.instructor_id, cur);
    }
    const rows = [...agg.entries()]
      .map(([id, v]) => ({
        title: instructorName(id),
        avg: v.count ? v.score / v.count : 0,
        classes: v.classes,
        count: v.count,
      }))
      .sort((a, b) => b.avg - a.avg);
    if (rows.length === 0)
      return { card: "empty", message: "No rated classes found yet." };
    return {
      card: "bar_chart",
      title: "Top-rated instructors",
      unit: "rating",
      maxValue: 5,
      bars: rows.map((r) => ({
        label: r.title,
        sublabel: `${r.classes} classes · ${r.count} ratings`,
        value: r.avg,
      })),
      note: "Rated out of 5.",
      deepLink: "Go to insight",
    };
  }

  queryTrend(ctx: AuthContext, q: TrendQuery): InsightCard {
    const byDay = new Map<string, number>();
    if (q.metric === "revenue") {
      const rows = branchFilter(ctx, txns, q.branch_id)
        .filter((t) => t.status === "complete" && t.transaction_type !== "refund")
        .filter((t) => inRange(t.created_at, q.from, q.to));
      for (const t of rows) {
        const d = t.created_at.slice(0, 10);
        byDay.set(d, (byDay.get(d) ?? 0) + t.amount_aed);
      }
    } else {
      const rows = branchFilter(ctx, schedule, q.branch_id).filter((s) =>
        inRange(s.date_iso, q.from, q.to),
      );
      for (const s of rows) {
        const d = s.date_iso.slice(0, 10);
        byDay.set(d, (byDay.get(d) ?? 0) + s.booked);
      }
    }
    const series = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, v]) => ({ label: fmtDay(d), value: Math.round(v) }));
    if (series.length < 2)
      return {
        card: "empty",
        message: `Not enough ${q.metric} data points to chart${
          q.from || q.to ? " in that range" : ""
        }. Demo data clusters in early–mid 2026.`,
      };
    return {
      card: "line_chart",
      title: q.metric === "revenue" ? "Revenue over time" : "Class bookings",
      series,
      unit: q.metric === "revenue" ? "AED" : "count",
      valueLabel: q.metric === "revenue" ? "Revenue" : "Total bookings",
      deepLink: "Go to insight",
    };
  }
}

function fmtDay(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
