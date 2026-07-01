// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Agreement display + coverage helpers
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared by:
//   • /admin/settings/agreements list (Coverage column + Branch location column)
//   • /admin/settings/agreements/[id] detail page (rule pills, sidebar)
//   • Acceptance status tab (3 KPI cards + 3 sub-tabs)
//   • Customer-detail Agreements tab (status pill copy)
//
// Lives outside the page.tsx file because Next.js App Router disallows
// non-default exports from a Server / Client Component page module.

import type { Agreement, Branch, CustomerAgreement } from "@/lib/store";

/** Renders the Branch-location column: comma-separated branch names
 *  when scoped to specific branches, "All locations" when the
 *  agreement covers every branch. Falls back to the branch id if the
 *  branch has been deleted. */
export function branchLocationText(a: Agreement, branchById: Map<string, Branch>): string {
    if (a.allLocations) return "All locations";
    return a.locationIds.map(id => branchById.get(id)?.name ?? id).join(", ");
}

/** Coverage % + re-accept pending count for a single agreement.
 *  Denominator = every customer with ANY row on this agreement (signed
 *  historic + re_accept_due + never_signed). Numerator = customers with
 *  a "signed" row on the agreement's CURRENT version. Also surfaces the
 *  two "not signed" bucket sizes for the Acceptance-status KPI cards. */
export interface AgreementCoverage {
    percent: number;
    signedCurrent: number;
    total: number;
    pendingReAccept: number;
    pendingNever: number;
}
export function computeCoverage(
    agreement: Agreement,
    customerAgreements: CustomerAgreement[],
): AgreementCoverage {
    const rowsForAgreement = customerAgreements.filter(ca => ca.agreementId === agreement.id);
    // Each customer counted once, regardless of how many version rows
    // they carry for this agreement.
    const customersTouched = new Set(rowsForAgreement.map(ca => ca.customerId));
    const total = customersTouched.size;

    // A customer counts as "signed current version" when they have a
    // row on the current version with status === "signed".
    const signedIds = new Set(
        rowsForAgreement
            .filter(ca => ca.version === agreement.currentVersion && ca.status === "signed")
            .map(ca => ca.customerId),
    );
    const reAcceptIds = new Set(
        rowsForAgreement
            .filter(ca => ca.version === agreement.currentVersion && ca.status === "re_accept_due")
            .map(ca => ca.customerId),
    );
    const neverIds = new Set(
        rowsForAgreement
            .filter(ca => ca.version === agreement.currentVersion && ca.status === "never_signed")
            .map(ca => ca.customerId),
    );

    const percent = total === 0 ? 0 : Math.round((signedIds.size / total) * 100);
    return {
        percent,
        signedCurrent:   signedIds.size,
        total,
        pendingReAccept: reAcceptIds.size,
        pendingNever:    neverIds.size,
    };
}
