// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Reports · shared CustomerPlanRow → display-row mapper
// ─────────────────────────────────────────────────────────────────────────────
//
// Reused by the 4 Phase-4C reports that share `selectMemberships`:
// Memberships & Packages, Frozen, Intro Offers, Upgrades & Downgrades.
// Each report picks a SUBSET of the fields returned here to hand to the
// shell. Keeping the mapping in one place means fixing a label / adding
// a computed field lands the same way on every consumer.

import type { CustomerPlanRow } from "./selectors";

// ─── Label lookup tables ──────────────────────────────────────────────────

const KIND_LABEL: Record<CustomerPlanRow["kind"], string> = {
    membership:    "Membership",
    package:       "Package / Credits",
    complimentary: "Complimentary",
};

const STATUS_LABEL: Record<CustomerPlanRow["status"], string> = {
    active:    "Active",
    expired:   "Expired",
    frozen:    "Frozen",
    cancelled: "Cancelled",
    removed:   "Removed",
};

const FREEZE_SOURCE_LABEL: Record<NonNullable<CustomerPlanRow["freezeSource"]>, string> = {
    customer_portal: "Customer portal",
    admin:           "Admin",
    front_desk:      "Front desk",
};

const CHANGE_LABEL: Record<NonNullable<CustomerPlanRow["changeVsPrev"]>, string> = {
    first:     "First plan",
    upgrade:   "Upgrade",
    downgrade: "Downgrade",
    same:      "Renewal (same price)",
};

// ─── The mapped shape ─────────────────────────────────────────────────────

export interface PlanDisplayRow {
    [k: string]: unknown;
    id:               string;
    customerId:       string;
    customerName:     string;
    customerEmail:    string;
    planName:         string;
    kindLabel:        string;
    planTypeLabel:    string;
    creditsLabel:     string;
    statusLabel:      string;
    priceAed:         number;
    purchasedAtISO:   string;
    expiryISO:        string;
    freezeStartISO:   string;
    freezeEndISO:     string;
    freezeSourceLbl:  string;
    freezeDays:       number;
    cancelledAtISO:   string;
    cancelReason:     string;
    isFirstPlanLbl:   "Yes" | "No";
    changeVsPrevLbl:  string;
    priceDeltaAed:    number;
    branchId:         string;
    location:         string;
}

// ─── Mapper ───────────────────────────────────────────────────────────────

export function mapPlanRow(r: CustomerPlanRow): PlanDisplayRow {
    return {
        id:              r.id,
        customerId:      r.customerId,
        customerName:    r.customerName,
        customerEmail:   r.customerEmail,
        planName:        r.planName,
        kindLabel:       KIND_LABEL[r.kind] ?? r.kind,
        planTypeLabel:   r.planTypeLabel,
        creditsLabel:    r.creditsLabel,
        statusLabel:     STATUS_LABEL[r.status] ?? r.status,
        priceAed:        r.priceAed,
        purchasedAtISO:  r.purchasedAtISO.slice(0, 10),
        expiryISO:       r.expiryISO.slice(0, 10),
        freezeStartISO:  r.freezeStartISO ? r.freezeStartISO.slice(0, 10) : "",
        freezeEndISO:    r.freezeEndISO   ? r.freezeEndISO.slice(0, 10)   : "",
        freezeSourceLbl: r.freezeSource ? FREEZE_SOURCE_LABEL[r.freezeSource] : "",
        freezeDays:      r.freezeDays,
        cancelledAtISO:  r.cancelledAtISO ? r.cancelledAtISO.slice(0, 10) : "",
        cancelReason:    r.cancelReason ?? "",
        isFirstPlanLbl:  r.isFirstPlan ? "Yes" : "No",
        changeVsPrevLbl: r.changeVsPrev ? CHANGE_LABEL[r.changeVsPrev] : "",
        priceDeltaAed:   r.priceDeltaAed,
        branchId:        r.branchId,
        location:        r.location,
    };
}
