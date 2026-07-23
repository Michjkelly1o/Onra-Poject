// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — class ratings
// ─────────────────────────────────────────────────────────────────────────────
//
// Reviews customers left after classes. Two HARD FKs — customer by email +
// schedule by (class name × date). Skips rows whose either FK can't resolve.
// Score clamped to 1-5.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const classRatingsEntity: EntityDef = {
    key: "class_ratings",
    label: "class ratings",
    singular: "class rating",
    fields: [
        { key: "customer_email", label: "Customer email", required: true },
        { key: "class_name",     label: "Class name", required: true },
        { key: "class_date",     label: "Class date", required: true },
        { key: "score",          label: "Score (1-5)", required: true },
        { key: "comment",        label: "Comment" },
        { key: "submitted_at",   label: "Submitted date" },
    ],
    dict: {
        "customer email": "customer_email",
        email:            "customer_email",
        "class name":     "class_name",
        class:            "class_name",
        "class date":     "class_date",
        date:             "class_date",
        "session date":   "class_date",
        score:            "score",
        rating:           "score",
        stars:            "score",
        comment:          "comment",
        review:           "comment",
        note:             "comment",
        feedback:         "comment",
        "submitted at":   "submitted_at",
        "submitted date": "submitted_at",
        "rated at":       "submitted_at",
    },
    validate: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        const score = inv.score ? row[inv.score]?.trim() : "";
        if (!email || !name || !date || !score) return false;
        const n = Number(score.replace(/[^0-9.\-]/g, ""));
        return !Number.isNaN(n) && n > 0;
    },
    dedupeKey: (row, inv) => {
        const email = inv.customer_email ? row[inv.customer_email]?.trim().toLowerCase() : "";
        const name = inv.class_name ? row[inv.class_name]?.trim().toLowerCase() : "";
        const date = inv.class_date ? row[inv.class_date]?.trim() : "";
        return email && name && date ? `${email}::${name}::${date}` : null;
    },
};
