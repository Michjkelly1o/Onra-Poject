// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Tax computation helpers (Phase 4 cross-module wiring)
// ─────────────────────────────────────────────────────────────────────────────
//
// One canonical place that knows how to:
//   • find the active `tax_rule` for a given (category, branchId) pair
//   • resolve that rule's `tax_rate` (active rates only). Honours the new
//     `type` field: Exempt rates resolve to a 0% effective rate; Zero-rated
//     rates also resolve to 0% (but are still TAXABLE on record).
//   • compute the subtotal / tax / total breakdown for a raw AED price under
//     the global "Prices include tax" toggle (exclusive vs inclusive)
//   • aggregate a multi-line cart honouring the per-line vs per-invoice
//     rounding mode from `taxSettings.roundingMode`.
//
// Consumers (POS checkout, product list price suffixes, etc.) import
// `findActiveTaxRuleFor` + `computeLineTax` + `computeCartTax` +
// `categoryForProductType`.
//
// Math reminders:
//   • Exclusive (toggle OFF): raw is pre-tax, tax is added on top.
//       subtotal = raw      ; tax = raw × r/100      ; total = raw + tax
//   • Inclusive (toggle ON):  raw is the total the customer pays, tax is
//                             backed out of it.
//       total = raw         ; tax = raw × r/(100+r)  ; subtotal = total − tax

import type { TaxRule, TaxRuleCategory, TaxRate, TaxRoundingMode } from "./store";

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
 *  Pass `pricesIncludeTax = state.taxSettings.pricesIncludeTax`.
 *
 *  When `roundingMode = "per_invoice"` the line returns UN-ROUNDED tax +
 *  total so the cart aggregator can round once after summing. Set to
 *  "per_line" (the default) to round each line independently — matches
 *  the legacy behaviour. */
export function computeLineTax(
    rawAed: number,
    ratePercentage: number,
    pricesIncludeTax: boolean,
    roundingMode: TaxRoundingMode = "per_line",
): LineTaxBreakdown {
    if (ratePercentage <= 0 || rawAed <= 0) {
        return { subtotalAed: rawAed, taxAed: 0, totalAed: rawAed, ratePercentage: 0 };
    }
    const round = roundingMode === "per_line" ? roundAed : (n: number) => n;
    if (pricesIncludeTax) {
        const total = rawAed;
        const tax = round(total * ratePercentage / (100 + ratePercentage));
        const subtotal = total - tax;
        return { subtotalAed: subtotal, taxAed: tax, totalAed: total, ratePercentage };
    }
    const subtotal = rawAed;
    const tax = round(subtotal * ratePercentage / 100);
    const total = subtotal + tax;
    return { subtotalAed: subtotal, taxAed: tax, totalAed: total, ratePercentage };
}

// ─── Cart-level aggregator (multi-line) ──────────────────────────────────────
//
// `computeCartTax` is the entry point POS + customer checkout call. It
// honours `taxSettings.roundingMode`:
//
//   • "per_line"    — each line is computed + rounded independently, then
//                     summed. Receipt lines show whole-AED tax per row.
//   • "per_invoice" — each line is computed UN-ROUNDED, summed, then
//                     rounded ONCE at the invoice total. Per-line receipt
//                     entries show fractional values; only the invoice
//                     total is rounded.
//
// Either mode returns the same shape so callers don't need to branch.

export interface CartLineInput {
    /** Raw AED price for the line. */
    rawAed: number;
    /** Effective tax % to apply. Resolve via `findActiveTaxRuleFor` +
     *  honour `type`: Exempt → 0, Zero-rated → 0, Default → rate.
     *  Callers that don't have a rule pass 0 here (no tax). */
    ratePercentage: number;
}

export interface CartTaxBreakdown {
    /** Sum of pre-tax line amounts. Rounded by mode. */
    subtotalAed: number;
    /** Aggregated tax. */
    taxAed: number;
    /** Final invoice total. */
    totalAed: number;
    /** Per-line breakdown — useful for receipts. Always rounded for
     *  display so the receipt math reconciles cleanly. */
    lines: LineTaxBreakdown[];
}

export function computeCartTax(
    lines: CartLineInput[],
    pricesIncludeTax: boolean,
    roundingMode: TaxRoundingMode = "per_line",
): CartTaxBreakdown {
    const perLineBreakdowns = lines.map(l =>
        computeLineTax(l.rawAed, l.ratePercentage, pricesIncludeTax, roundingMode),
    );

    if (roundingMode === "per_line") {
        const subtotal = perLineBreakdowns.reduce((s, b) => s + b.subtotalAed, 0);
        const tax      = perLineBreakdowns.reduce((s, b) => s + b.taxAed, 0);
        const total    = perLineBreakdowns.reduce((s, b) => s + b.totalAed, 0);
        return { subtotalAed: subtotal, taxAed: tax, totalAed: total, lines: perLineBreakdowns };
    }

    // Per-invoice rounding: round AT the totals; lines stay un-rounded
    // internally but we round their display values for the receipt panel.
    const rawSubtotal = perLineBreakdowns.reduce((s, b) => s + b.subtotalAed, 0);
    const rawTax      = perLineBreakdowns.reduce((s, b) => s + b.taxAed, 0);
    const rawTotal    = perLineBreakdowns.reduce((s, b) => s + b.totalAed, 0);
    return {
        subtotalAed: roundAed(rawSubtotal),
        taxAed:      roundAed(rawTax),
        totalAed:    roundAed(rawTotal),
        lines: perLineBreakdowns.map(b => ({
            subtotalAed:    roundAed(b.subtotalAed),
            taxAed:         roundAed(b.taxAed),
            totalAed:       roundAed(b.totalAed),
            ratePercentage: b.ratePercentage,
        })),
    };
}

/** Resolve the effective tax rate from a TaxRate row, honouring its `type`.
 *  • "default"     — admin-configured percentage.
 *  • "zero_rated"  — 0% (rate is still applied to the line but charges nothing).
 *  • "exempt"      — 0% AND the line should be skipped on the receipt's tax
 *                    breakdown (callers can check `rate.type === "exempt"`
 *                    to suppress the per-line tax row entirely). */
export function effectiveRatePercentage(rate: TaxRate | undefined | null): number {
    if (!rate) return 0;
    if (rate.type === "exempt" || rate.type === "zero_rated") return 0;
    return rate.ratePercentage;
}

// ─── POS product-type → tax-rule category bridge ─────────────────────────────

/** POS cart items carry a `productType` enum that doesn't quite match the
 *  tax-rule `category` enum. This bridge maps one to the other.
 *
 *  `gift_card` is intentionally unmapped: the "Gift card (redeemed tax)"
 *  category in Apply tax rates applies at REDEMPTION time, not at purchase.
 *  Buying a gift card is a pre-paid balance transfer with no tax of its own.
 *
 *  `appointment` was added in Module 13 (currency-priced appointment
 *  services). It maps directly to the new `appointment` tax rule category
 *  so the per-branch + all-locations lookup precedence applies the same
 *  way as memberships + credit packages.
 *
 *  Unmapped types (`gift_card`, `drop_in`, anything new) return `null` so
 *  the caller skips them when iterating cart lines. */
export function categoryForProductType(
    type: "membership" | "package" | "appointment" | "gift_card" | "drop_in",
): TaxRuleCategory | null {
    switch (type) {
        case "membership":  return "membership";
        case "package":     return "credit_package";
        case "appointment": return "appointment";
        case "gift_card":   return null;
        case "drop_in":     return null;
    }
}
