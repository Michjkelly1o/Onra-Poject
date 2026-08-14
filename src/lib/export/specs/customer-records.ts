// ─────────────────────────────────────────────────────────────────────────────
// Export specs — Customer child records  (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// The relationship/child tables hung off a customer: plans held, wallet ledger,
// POS/payment transactions, referrals, signed agreements. Each carries its
// `customer_id` parent FK (+ readable name) plus its own FKs (product_id,
// branch_id, agreement_id, referrer/referred ids, gift-card/appointment ids),
// its `status`, and machine values — so a migration reconstructs the full
// customer history, not just the person row.

import type {
    CustomerPlan, WalletTransaction, CustomerTransaction, CustomerReferral, CustomerAgreement,
} from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

const boolCell = (v?: boolean): string => (v === undefined ? "" : v ? "true" : "false");

// ─── Customer plans (memberships / packages held) ────────────────────────────

export function customerPlansExportData(rows: CustomerPlan[], customerName: (id: string) => string): ExportData<CustomerPlan> {
    const columns: ExportColumn<CustomerPlan>[] = [
        { key: "id", value: p => p.id },
        { key: "customer_id", value: p => p.customerId },
        { key: "customer_name", value: p => customerName(p.customerId) },
        { key: "kind", value: p => p.kind },
        { key: "product_id", value: p => p.productId ?? "" },
        { key: "name", value: p => p.name },
        { key: "plan_type_label", value: p => p.planTypeLabel },
        { key: "status", value: p => p.status },
        { key: "purchased_at", value: p => p.purchasedAtISO },
        { key: "expiry", value: p => p.expiryISO },
        { key: "price_aed", value: p => p.priceAed ?? "" },
        { key: "total_credits", value: p => p.totalCredits ?? "" },
        { key: "credits_used", value: p => p.creditsUsed ?? "" },
        { key: "credits_label", value: p => p.creditsLabel },
        { key: "free_credits", value: p => p.freeCredits ?? "" },
        { key: "auto_renew", value: p => boolCell(p.autoRenew) },
        { key: "next_billing_amount_aed", value: p => p.nextBillingAmountAed ?? "" },
        { key: "freeze_start", value: p => p.freezeStartISO ?? "" },
        { key: "freeze_end", value: p => p.freezeEndISO ?? "" },
        { key: "freeze_source", value: p => p.freezeSource ?? "" },
        { key: "freeze_count", value: p => p.freezeCount ?? "" },
        { key: "freeze_reason", value: p => p.freezeReason ?? "" },
        { key: "grant_reason", value: p => p.grantReason ?? "" },
        { key: "grant_issued_by", value: p => p.grantIssuedBy ?? "" },
        { key: "grant_issued_role", value: p => p.grantIssuedRole ?? "" },
        { key: "cancel_mode", value: p => p.cancelMode ?? "" },
        { key: "cancel_reason", value: p => p.cancelReason ?? "" },
        { key: "cancelled_at", value: p => p.cancelledAtISO ?? "" },
        { key: "remove_reason", value: p => p.removeReason ?? "" },
        { key: "removed_by", value: p => p.removedBy ?? "" },
        { key: "removed_by_role", value: p => p.removedByRole ?? "" },
        { key: "removed_at", value: p => p.removedAtISO ?? "" },
    ];
    return { entity: "customer-plans", columns, rows };
}

// ─── Wallet transactions (account-credit ledger) ─────────────────────────────

export function walletTransactionsExportData(rows: WalletTransaction[], customerName: (id: string) => string): ExportData<WalletTransaction> {
    const columns: ExportColumn<WalletTransaction>[] = [
        { key: "id", value: w => w.id },
        { key: "customer_id", value: w => w.customerId },
        { key: "customer_name", value: w => customerName(w.customerId) },
        { key: "branch_id", value: w => w.branchId },
        { key: "type", value: w => w.type },
        { key: "amount_aed", value: w => w.amountAed },
        { key: "reason", value: w => w.reason },
        { key: "reference_type", value: w => w.referenceType ?? "" },
        { key: "reference_id", value: w => w.referenceId ?? "" },
        { key: "created_at", value: w => w.createdAtISO },
        { key: "created_by", value: w => w.createdBy ?? "" },
    ];
    return { entity: "wallet-transactions", columns, rows };
}

// ─── Customer transactions (POS / payment history) ───────────────────────────

export function customerTransactionsExportData(rows: CustomerTransaction[], customerName: (id: string) => string): ExportData<CustomerTransaction> {
    const columns: ExportColumn<CustomerTransaction>[] = [
        { key: "id", value: t => t.id },
        { key: "customer_id", value: t => t.customerId },
        { key: "customer_name", value: t => customerName(t.customerId) },
        { key: "branch_id", value: t => t.branchId },
        { key: "branch_id_at_sale", value: t => t.branchIdAtSale ?? "" },
        { key: "kind", value: t => t.kind },
        { key: "product_id", value: t => t.productId },
        { key: "name", value: t => t.name },
        { key: "status", value: t => t.status },
        { key: "transaction_type", value: t => t.transactionType ?? "" },
        { key: "original_transaction_id", value: t => t.originalTransactionId ?? "" },
        { key: "amount_aed", value: t => t.amountAed },
        { key: "subtotal_aed", value: t => t.subtotalAed ?? "" },
        { key: "tax_aed", value: t => t.taxAed ?? "" },
        { key: "tax_rate_percentage", value: t => t.taxRatePercentage ?? "" },
        { key: "tax_inclusive", value: t => boolCell(t.taxInclusive) },
        { key: "tax_treatment", value: t => t.taxTreatment ?? "" },
        { key: "payment_method", value: t => t.paymentMethod },
        { key: "payment_source", value: t => t.paymentSource ?? "" },
        { key: "payment_type", value: t => t.paymentType ?? "" },
        { key: "card_type", value: t => t.cardType ?? "" },
        { key: "created_at", value: t => t.createdAtISO },
        { key: "settlement_iso", value: t => t.settlementISO ?? "" },
        { key: "refunded_at", value: t => t.refundedAtISO ?? "" },
        { key: "refund_method", value: t => t.refundMethod ?? "" },
        { key: "refund_reason", value: t => t.refundReason ?? "" },
        { key: "staff_id", value: t => t.staffId ?? "" },
        { key: "discount_code", value: t => t.discountCode ?? "" },
        { key: "discount_value", value: t => t.discountValue ?? "" },
        { key: "payout_id", value: t => t.payoutId ?? "" },
        { key: "processor_fee", value: t => t.processorFee ?? "" },
        { key: "quantity", value: t => t.quantity ?? "" },
        { key: "retail_product_id", value: t => t.retailProductId ?? "" },
        { key: "retail_size", value: t => t.retailSize ?? "" },
        { key: "issued_gift_card_id", value: t => t.issuedGiftCardId ?? "" },
        { key: "appointment_id", value: t => t.appointmentId ?? "" },
    ];
    return { entity: "customer-transactions", columns, rows };
}

// ─── Referrals ───────────────────────────────────────────────────────────────

export function referralsExportData(rows: CustomerReferral[], customerName: (id: string) => string): ExportData<CustomerReferral> {
    const columns: ExportColumn<CustomerReferral>[] = [
        { key: "id", value: r => r.id },
        { key: "referrer_customer_id", value: r => r.referrerCustomerId },
        { key: "referrer_name", value: r => customerName(r.referrerCustomerId) },
        { key: "referred_customer_id", value: r => r.referredCustomerId ?? "" },
        { key: "referred_name", value: r => r.referredName },
        { key: "referred_email", value: r => r.referredEmail },
        { key: "benefit_type", value: r => r.benefitType },
        { key: "benefit_credits", value: r => r.benefitCredits },
        { key: "benefit_amount", value: r => r.benefitAmount },
        { key: "referred_at", value: r => r.referredAtISO },
        { key: "expires_at", value: r => r.expiresAtISO ?? "" },
        { key: "origin_branch_id", value: r => r.originBranchId ?? "" },
        { key: "reward_issued_at", value: r => r.rewardIssuedAtISO ?? "" },
        { key: "campaign", value: r => r.campaign ?? "" },
        { key: "reactivated", value: r => boolCell(r.reactivated) },
        { key: "reactivation_date", value: r => r.reactivationDateISO ?? "" },
        { key: "new_plan_id", value: r => r.newPlanId ?? "" },
        { key: "revenue_recovered_aed", value: r => r.revenueRecoveredAed ?? "" },
    ];
    return { entity: "referrals", columns, rows };
}

// ─── Customer agreements (signature records) ─────────────────────────────────

export function customerAgreementsExportData(rows: CustomerAgreement[], customerName: (id: string) => string): ExportData<CustomerAgreement> {
    const columns: ExportColumn<CustomerAgreement>[] = [
        { key: "id", value: a => a.id },
        { key: "customer_id", value: a => a.customerId },
        { key: "customer_name", value: a => customerName(a.customerId) },
        { key: "agreement_id", value: a => a.agreementId },
        { key: "title", value: a => a.title },
        { key: "version", value: a => a.version },
        { key: "branch_id", value: a => a.branchId },
        { key: "class_template_ids", value: a => a.classTemplateIds.join("; ") },
        { key: "status", value: a => a.status },
        { key: "signed_at", value: a => a.signedAtISO ?? "" },
        { key: "guardian_consent", value: a => boolCell(a.guardianConsent) },
    ];
    return { entity: "customer-agreements", columns, rows };
}
