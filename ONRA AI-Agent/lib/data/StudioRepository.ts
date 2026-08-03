// The READ contract for Insight. MockStudioRepository reads mock-data today;
// ApiStudioRepository (later) calls the Onra API. Same signatures → the agent
// never notices the swap. Every method takes AuthContext and enforces scope.
import type { AuthContext } from "@/lib/agent/auth";
import type { InsightCard } from "@/lib/agent/cards";

export type DateRange = { from?: string; to?: string }; // ISO dates, inclusive

export interface RevenueQuery extends DateRange {
  group_by?: "branch" | "day" | "product";
  branch_id?: string;
}
export interface AttendanceQuery extends DateRange {
  branch_id?: string;
}
export interface ClassQuery {
  branch_id?: string;
  status?: "Completed" | "Cancelled" | "Ongoing" | "Upcoming";
}
export interface CustomerQuery {
  signal?: "churn_risk" | "expiring_soon" | "new_this_period";
  status?: "active" | "inactive" | "archived";
  branch_id?: string;
  from?: string;
  to?: string;
  limit?: number;
}
export interface InstructorQuery {
  branch_id?: string;
}
export interface TrendQuery extends DateRange {
  metric: "bookings" | "revenue";
  branch_id?: string;
}

export interface StudioRepository {
  getOverview(ctx: AuthContext): InsightCard;
  queryRevenue(ctx: AuthContext, q: RevenueQuery): InsightCard;
  queryAttendance(ctx: AuthContext, q: AttendanceQuery): InsightCard;
  queryClasses(ctx: AuthContext, q: ClassQuery): InsightCard;
  queryCustomers(ctx: AuthContext, q: CustomerQuery): InsightCard;
  queryInstructors(ctx: AuthContext, q: InstructorQuery): InsightCard;
  queryTrend(ctx: AuthContext, q: TrendQuery): InsightCard;
}
