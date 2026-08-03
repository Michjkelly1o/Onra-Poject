// Narrow row shapes for the fields the agent actually reads. Decoupled from
// mock-data/_types so the repository doesn't depend on the full seed typings.
// These match the mock-data snake_case columns exactly (see AI-AGENT-DESIGN-REFERENCE.md).

export interface BranchRow {
  id: string;
  name: string;
  status: "active" | "inactive";
  kind: "club" | "spa";
  is_main: boolean;
}

export interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  branch_id: string;
  plan_kind: "membership" | "package" | null;
  plan_name?: string;
  status: "active" | "inactive" | "archived";
  last_visit_iso?: string;
  plan_expiry_iso?: string;
  created_at: string;
}

export interface TransactionRow {
  id: string;
  branch_id: string;
  kind: "membership" | "package" | "cancellation_penalty";
  name: string;
  amount_aed: number;
  status: "complete" | "pending" | "failed" | "refunded";
  transaction_type?: "sale" | "refund" | "void" | "write_off";
  payment_method: "card" | "cash";
  created_at: string;
  product_id: string;
}

export interface ClassScheduleRow {
  id: string;
  template_id: string;
  branch_id: string;
  instructor_id: string;
  date_iso: string;
  capacity: number;
  booked: number;
  rating: number;
  rating_count: number;
  status: "Completed" | "Cancelled" | "Ongoing" | "Upcoming";
}

export interface ClassBookingRow {
  id: string;
  class_schedule_id: string;
  branch_id: string;
  status: "booked" | "waitlisted" | "cancelled";
  attendance_status: "present" | "no_show" | "pending" | "late_cancel";
}

export interface ClassTemplateRow {
  id: string;
  name: string;
  category_id: string;
}

export interface StaffProfileRow {
  id: string;
  full_name: string;
  branch_id: string;
}
