// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration entity — marketing campaigns
// ─────────────────────────────────────────────────────────────────────────────
//
// Member-facing marketing items (announcements / new-class / event cards).
// Self-contained — CTA class/package links aren't imported (they'd need FKs
// the source rarely carries); an imported campaign lands as a simple card.

import type { EntityDef } from "@/ai-agent/migration/entities";

export const campaignsEntity: EntityDef = {
    key: "campaigns",
    label: "campaigns",
    singular: "campaign",
    fields: [
        { key: "title",        label: "Title", required: true },
        { key: "type",         label: "Type (announcement / new class / event)" },
        { key: "description",  label: "Description" },
        { key: "publish_date", label: "Publish date" },
        { key: "expiry_date",  label: "Expiry date" },
        { key: "external_url", label: "Link URL" },
    ],
    dict: {
        title:            "title",
        name:             "title",
        headline:         "title",
        type:             "type",
        "campaign type":  "type",
        description:      "description",
        message:          "description",
        body:             "description",
        copy:             "description",
        "publish date":   "publish_date",
        "start date":     "publish_date",
        "send date":      "publish_date",
        date:             "publish_date",
        "expiry date":    "expiry_date",
        "end date":       "expiry_date",
        expiry:           "expiry_date",
        url:              "external_url",
        link:             "external_url",
        "link url":       "external_url",
        "external url":   "external_url",
    },
    validate: (row, inv) => {
        const title = inv.title ? row[inv.title]?.trim() : "";
        return !!title;
    },
    dedupeKey: (row, inv) =>
        inv.title ? row[inv.title]?.trim().toLowerCase() || null : null,
};
