// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Integration category helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Per Figma 7632:17561, the Apps tab groups integrations by category. We
// derive the category from the slug rather than storing it on the seed —
// keeps the data shape stable and avoids a second source of truth that
// could drift out of sync with the slug union.

import type { IntegrationSlug } from "@/lib/store";

export type IntegrationCategory =
    | "calendar"
    | "marketing"
    | "analytics";

export interface IntegrationCategoryDef {
    key: IntegrationCategory;
    label: string;
}

export const INTEGRATION_CATEGORIES: IntegrationCategoryDef[] = [
    { key: "calendar",  label: "Calendar"                  },
    { key: "marketing", label: "Marketing & communication" },
    { key: "analytics", label: "Analytics & accounting"    },
];

const SLUG_CATEGORY_MAP: Record<IntegrationSlug, IntegrationCategory> = {
    // Calendar
    google_calendar:       "calendar",
    apple_calendar:        "calendar",
    outlook_microsoft365:  "calendar",
    // Marketing & communication
    whatsapp_business:     "marketing",
    mailchimp:             "marketing",
    instagram_meta:        "marketing",
    // Analytics & accounting
    google_analytics:      "analytics",
    xero:                  "analytics",
};

/** Returns the category an integration slug belongs to. */
export function integrationCategoryFor(slug: IntegrationSlug): IntegrationCategory {
    return SLUG_CATEGORY_MAP[slug];
}

/** Returns the human label for a category. */
export function integrationCategoryLabel(category: IntegrationCategory): string {
    return INTEGRATION_CATEGORIES.find(c => c.key === category)?.label ?? category;
}
