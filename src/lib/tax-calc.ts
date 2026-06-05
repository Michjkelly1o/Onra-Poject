// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax computation helpers (Phase 4 cross-module wiring)
// ─────────────────────────────────────────────────────────────────────────────
//
// One canonical place that knows how to:
//   • find the active `tax_rule` for a given (category, branchId) pair
//   • resolve that rule's `tax_rate` (active rates only)
//   • compute the subtotal / tax / total breakdown for a raw AED price under
//     the global "Prices include tax" toggle (exclusive vs inclusive)
//
// Consumers (POS checkout, product list price suffixes, etc.) just import
// `findActiveTaxRuleFor` + `computeLineTax` + `categoryForProductType`.
//
// Math reminders:
//   • Exclusive (toggle OFF): raw is pre-tax, tax is added on top.
//       subtotal = raw      ; tax = raw × r/100      ; total = raw + tax
//   • Inclusive (toggle ON):  raw is the total the customer pays, tax is
//                             backed out of it.
//       total = raw         ; tax = raw × r/(100+r)  ; subtotal = total − tax

import type { TaxRule, TaxRuleCategory, TaxRate } from "./store";

/** Pair returned when an active rule + rate is found for a (category, branch). */
export interface ActiveTaxMatch {
    rule: TaxRule;
    rate: TaxRate;
}

/** Find the best-matching active tax rule for the given category + branch.
 *
 *  Match precedence:
 *    1. A branch-specific rule whose `locationIds` contains `branchId`
 *       (only attempted when `branchId` is provided)
 *    2. An `all_locations` rule
 *    3. **Catalog fallback** — any branch-specific rule under this category.
 *       Used by branch-agnostic surfaces (product list / detail, member
 *       portal) so a category with branch-scoped rules still shows the
 *       configured rate. Picks the lowest rate to avoid over-stating.
 *
 *  In all cases the rule must:
 *    • be `status: "active"` (toggle on)
 *    • have a `taxRateId` set (not the "Select tax rate" placeholder)
 *    • point at a `tax_rate` that is itself `status: "active"`
 */
export function findActiveTaxRuleFor(
    state: { taxRules: TaxRule[]; taxRates: TaxRate[] },
    category: TaxRuleCategory,
    branchId: string | undefined,
): ActiveTaxMatch | null {
    const candidates = state.taxRules.filter(r =>
        r.category === category
        && r.status === "active"
        && r.taxRateId !== undefined,
    );

    // 1. Branch-specific takes precedence when we have a branch context.
    let matched: TaxRule | undefined;
    if (branchId) {
        matched = candidates.find(r => !r.allLocations && r.locationIds.includes(branchId));
    }
    // 2. All-locations rule.
    if (!matched) {
        matched = candidates.find(r => r.allLocations);
    }
    // 3. Catalog fallback — if no all_locations rule exists but at least one
    //    branch-specific rule does, expose the configured rate so the catalog
    //    surface (which has no branch context) still shows the suffix.
    if (!matched && !branchId) {
        const branchSpecific = candidates.filter(r => !r.allLocations && r.locationIds.length > 0);
        if (branchSpecific.length > 0) {
            // Pick the rule whose rate has the lowest active percentage so
            // the catalog suffix understates rather than overstates.
            let best: { rule: TaxRule; rate: TaxRate } | null = null;
            for (const candidate of branchSpecific) {
                if (!candidate.taxRateId) continue;
                const r = state.taxRates.find(t => t.id === candidate.taxRateId && t.status === "active");
                if (!r) continue;
                if (!best || r.ratePercentage < best.rate.ratePercentage) {
                    best = { rule: candidate, rate: r };
                }
            }
            if (best) return best;
        }
    }
    if (!matched || !matched.taxRateId) return null;

    const rate = state.taxRates.find(t => t.id === matched!.taxRateId);
    if (!rate || rate.status !== "active") return null;

    return { rule: matched, rate };
}

// ─── Line-level breakdown ────────────────────────────────────────────────────

export interface LineTaxBreakdown {
    /** Pre-tax line amount. Exclusive: equals raw. Inclusive: raw − tax. */
    subtotalAed: number;
    /** Tax amount in AED. Zero when no active rule matches. */
    taxAed: number;
    /** What the customer pays for this line. Exclusive: raw + tax. Inclusive: raw. */
    totalAed: number;
    /** The percentage that drove `taxAed` — 0 when no rule matched. */
    ratePercentage: number;
}

/** Round to the nearest whole AED — every other money figure in the app uses
 *  whole numbers (see `formatAed` etc.). */
function roundAed(n: number): number {
    return Math.round(n);
}

/** Compute the tax breakdown for a single line at a given raw AED price.
 *  Pass `pricesIncludeTax = state.taxSettings.pricesIncludeTax`. */
export function computeLineTax(
    rawAed: number,
    ratePercentage: number,
    pricesIncludeTax: boolean,
): LineTaxBreakdown {
    if (ratePercentage <= 0 || rawAed <= 0) {
        return { subtotalAed: rawAed, taxAed: 0, totalAed: rawAed, ratePercentage: 0 };
    }
    if (pricesIncludeTax) {
        const total = rawAed;
        const tax = roundAed(total * ratePercentage / (100 + ratePercentage));
        const subtotal = total - tax;
        return { subtotalAed: subtotal, taxAed: tax, totalAed: total, ratePercentage };
    }
    const subtotal = rawAed;
    const tax = roundAed(subtotal * ratePercentage / 100);
    const total = subtotal + tax;
    return { subtotalAed: subtotal, taxAed: tax, totalAed: total, ratePercentage };
}

// ─── POS product-type → tax-rule category bridge ─────────────────────────────

/** POS cart items carry a `productType` enum that doesn't quite match the
 *  tax-rule `category` enum. This bridge maps one to the other.
 *
 *  `gift_card` is intentionally unmapped: the "Gift card (redeemed tax)"
 *  category in Apply tax rates applies at REDEMPTION time, not at purchase.
 *  Buying a gift card is a pre-paid balance transfer with no tax of its own.
 *
 *  Unmapped types (`gift_card`, `drop_in`, anything new) return `null` so
 *  the caller skips them when iterating cart lines. */
export function categoryForProductType(
    type: "membership" | "package" | "gift_card" | "drop_in",
): TaxRuleCategory | null {
    switch (type) {
        case "membership": return "membership";
        case "package":    return "credit_package";
        case "gift_card":  return null;
        case "drop_in":    return null;
    }
}
