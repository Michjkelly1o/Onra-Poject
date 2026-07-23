// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — class bookings
// ─────────────────────────────────────────────────────────────────────────────
//
// Historical bookings. Two HARD FKs — the customer (by email) and the class
// schedule (matched by class template name + date). Rows whose either FK can't
// resolve are skipped so the roster never carries a booking for a class or
// customer that doesn't exist.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const classBookingsEntity: EntityDef = {
    key: "class_bookings",
    label: "class bookings",
    singular: "class booking",
    fields: [
        { key: "customer_email",     label: "Customer email", required: true },
        { key: "class_name",         label: "Class name", required: true },
        { key: "class_date",         label: "Class date", required: true },
        { key: "status",             label: "Status (booked / waitlisted / cancelled)" },
        { key: "attendance",         label: "Attendance (present / no_show / pending)" },
        { key: "booking_date",       label: "Booking date" },
    ],
    dict: {
        "customer email":      "customer_email",
        email:                 "customer_email",
        "member email":        "customer_email",
        "class name":          "class_name",
        "class template":      "class_name",
        "template name":       "class_name",
        class:                 "class_name",
        session:               "class_name",
        "class date":          "class_date",
        "session date":        "class_date",
        date:                  "class_date",
        status:                "status",
        "booking status":      "status",
        attendance:            "attendance",
        "attendance status":   "attendance",
        attended:              "attendance",
        "booking date":        "booking_date",
        "booked at":           "booking_date",
        "created at":          "booking_date",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        return !!email && !!name && !!date;
    },
    dedupeKey: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim().toLowerCase() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim().toLowerCase() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        return email && name && date ? `${email}::${name}::${date}` : null;
    },
};
