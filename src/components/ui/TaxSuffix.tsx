"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — TaxSuffix
// ─────────────────────────────────────────────────────────────────────────────
//
// Single-line price suffix that reflects:
//   • the global "Prices include tax" toggle
//   • the active `tax_rule` for the given category + optional branchId
//
// Returns null when no active rule applies — call sites can render the price
// without a wrapper conditional.
//
// Used on every price-display site outside the POS cart:
//   • /admin/products list   (memberships / packages)
//   • /admin/products/gift-cards list
//   • /products/[id]         (membership/package detail)
//   • /products/gift-cards/[id]
//   • /member/packages       (customer-facing portal)
//   • payroll views (pay-rate category)

import { useAppStore, type TaxRuleCategory } from "@/lib/store";
import { findActiveTaxRuleFor } from "@/lib/tax-calc";
import { cn } from "@/lib/utils";

export interface TaxSuffixProps {
    category: TaxRuleCategory;
    /** Optional branch context — when set, branch-specific rules take
     *  precedence over `all_locations` rules. List-view contexts that
     *  don't have a current branch should omit this prop. */
    branchId?: string;
    /** Override the class string. Defaults to a subtle 12px gray line that
     *  fits below a primary price. */
    className?: string;
}

export function TaxSuffix({ category, branchId, className }: TaxSuffixProps) {
    const taxRules = useAppStore(s => s.taxRules);
    const taxRates = useAppStore(s => s.taxRates);
    const pricesIncludeTax = useAppStore(s => s.taxSettings.pricesIncludeTax);

    const match = findActiveTaxRuleFor({ taxRules, taxRates }, category, branchId);
    if (!match) return null;

    return (
        <span className={cn("text-[12px] text-[#667085] whitespace-nowrap", className)}>
            {pricesIncludeTax
                ? `Inc. ${match.rate.ratePercentage}% tax`
                : `+ ${match.rate.ratePercentage}% tax`}
        </span>
    );
}
