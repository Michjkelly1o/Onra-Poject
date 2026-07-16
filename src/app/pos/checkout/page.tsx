"use client";

// ─────────────────────────────────────────────────────────────────────────────
// POS module checkout — Module 05 entry point
// ─────────────────────────────────────────────────────────────────────────────
//
// This route LIVES OUTSIDE /admin/ on purpose — the admin layout would inject
// the sidebar and the checkout needs to render full-screen. Schedule's
// checkout follows the same convention (/schedule/[classId]/checkout, also
// outside /admin/).
//
// It mirrors the schedule mini-POS checkout 1:1 visually (same Figma source,
// same subcomponents from /components/checkout/CheckoutScreen.tsx) but owns
// its own state machine + redirect/toast behavior:
//
//   • On `Complete transaction` → applyPurchase, fire success toast directly,
//     redirect to /admin/pos (the POS main view).
//   • On close (X) → drops the pending purchase and returns to /admin/pos.
//
// No query-param round-trip — `showToast()` is fired before the redirect, and
// the toast lives in Zustand state so it survives the route change cleanly.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, walletBalanceAed } from "@/lib/store";
import {
    CheckoutShell, PaymentConfirmationStep, ReceiptStep, ProcessingPaymentCard,
    describePayment, computeTotals, enabledMethodsFromProviders,
    type PaymentMethod,
} from "@/components/checkout/CheckoutScreen";

export const dynamic = "force-dynamic";

export default function POSCheckoutPage() {
    return (
        <Suspense fallback={null}>
            <POSCheckoutInner />
        </Suspense>
    );
}

function POSCheckoutInner() {
    const router = useRouter();
    const pendingPurchase = useAppStore(s => s.pendingPurchase);
    const customers = useAppStore(s => s.customers);
    const staff = useAppStore(s => s.staff);
    const roles = useAppStore(s => s.roles);
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    const applyPurchase = useAppStore(s => s.applyPurchase);
    const showToast = useAppStore(s => s.showToast);

    // "Credited to" — active staff the sale can be attributed to, labelled
    // with their role (commission refactor Phase 2).
    const sellerOptions = useMemo(() => staff
        .filter(st => st.status === "active")
        .map(st => ({ value: st.id, label: `${st.fullName} — ${roles.find(r => r.id === st.roleId)?.name ?? "Staff"}` })),
        [staff, roles]);
    // Account credit — the customer's balance (referral rewards + refunds +
    // manual grants). No longer a standalone payment method (client Jul 2026);
    // now applied as a reduction toggle before payment method. `applyPurchase`
    // debits the wallet in the same tick, so no separate `debitWallet` call.
    const walletTransactions = useAppStore(s => s.walletTransactions);
    // Phase 3 — POS subscribes to the live Payments-Settings store so that
    // toggling Stripe / Apple Pay / Google Pay (or disconnecting Stripe and
    // cascading the wallets off) hides their cards from the picker grid in
    // the same render cycle.
    const paymentProviders = useAppStore(s => s.paymentProviders);
    const enabledMethods = useMemo(
        () => enabledMethodsFromProviders(paymentProviders),
        [paymentProviders],
    );

    const customer = useMemo(
        () => pendingPurchase ? customers.find(c => c.id === pendingPurchase.customerId) ?? null : null,
        [pendingPurchase, customers],
    );

    // Local state — fully owned by this page so the POS redirect logic stays
    // isolated from the schedule mini-POS flow.
    const [step, setStep] = useState<1 | 2>(1);
    const [sellerStaffId, setSellerStaffId] = useState<string | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [cashReceived, setCashReceived] = useState<string>("");
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    // "Use account credit" toggle — when on, the customer's balance is
    // applied as a reduction (capped at the post-discount total).
    const [useAccountCredit, setUseAccountCredit] = useState<boolean>(false);
    const [loading, setLoading] = useState(false);
    const [receiptNumber] = useState(() => `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`);
    const [transactionId] = useState(() => Math.random().toString(36).slice(2, 10));

    // Direct-hit guard — bounce back to /admin/pos if there's no pending sale.
    useEffect(() => {
        if (!pendingPurchase) router.replace("/admin/pos");
    }, [pendingPurchase, router]);

    // Cascade safety — if the currently-selected method just disappeared
    // from `enabledMethods` (e.g. the user disconnected Stripe in another
    // tab while this checkout was open), drop the selection so the picker
    // stops claiming a hidden card is active.
    useEffect(() => {
        if (paymentMethod !== null && !enabledMethods.includes(paymentMethod)) {
            setPaymentMethod(null);
        }
    }, [paymentMethod, enabledMethods]);

    if (!pendingPurchase || !customer) return null;

    const walletBalance = walletBalanceAed(walletTransactions, customer.id);
    // Pass the toggle-driven credit request into `computeTotals`; the helper
    // caps the applied credit at the post-discount total and returns the
    // resolved figure alongside the new total.
    const { subtotal, discountAmount, taxRate, taxAmount, accountCreditApplied, total } = computeTotals(
        pendingPurchase.items, pendingPurchase.discountPercent, pendingPurchase.promoDiscountAed ?? 0,
        undefined,
        useAccountCredit ? walletBalance : 0,
    );
    const cashReceivedNum = Number(cashReceived) || 0;
    const change = Math.max(0, cashReceivedNum - total);
    const { label: paymentMethodLabel, chargedTo } = describePayment(paymentMethod, selectedCardId, cashReceivedNum);

    function canConfirm(): boolean {
        // Sales must be credited to a staff member before completing.
        if (sellerStaffId === null) return false;
        // Account credit alone can cover a sale — no payment method needed
        // when the credit fully zeroes the total.
        if (total === 0) return true;
        if (paymentMethod === null) return false;
        if (paymentMethod === "cash") return cashReceivedNum >= total;
        if (paymentMethod === "card") return selectedCardId !== null;
        if (paymentMethod === "applepay") return true;
        if (paymentMethod === "googlepay") return true;
        return false;
    }

    function handleConfirmPurchase() {
        if (!canConfirm()) return;
        setLoading(true);
        window.setTimeout(() => { setLoading(false); setStep(2); }, 1600);
    }

    /** Step 2 "Complete transaction" — POS entry path.
     *
     *  Fires the success toast directly (Zustand keeps it across the route
     *  change so the alert is visible instantly on the POS main view, not
     *  after a query-param round-trip) and redirects to the POS main view.
     *  The `?paymentSuccess=1` flag is still appended so the POS page knows
     *  to reset its local cart state — but the toast itself is already up. */
    function handleComplete() {
        if (!customer || !pendingPurchase) return;
        // Account credit debit rides inside `applyPurchase` now — the store
        // debits the wallet in the same tick, so the ledger + balance stay in
        // sync with what the receipt shows. No separate `debitWallet` call.
        applyPurchase(
            customer.id, pendingPurchase.items, "pos",
            sellerStaffId ?? undefined,
            accountCreditApplied > 0 ? accountCreditApplied : undefined,
        );
        setPendingPurchase(null);
        showToast(
            "Transaction complete",
            "The payment was successful and the record is saved.",
            "success", "check",
        );
        router.replace("/admin/pos?paymentSuccess=1");
    }

    function handleClose() {
        setPendingPurchase(null);
        router.replace("/admin/pos");
    }

    const body = step === 1
        ? (loading
            ? <ProcessingPaymentCard method={paymentMethod!} chargedTo={chargedTo} />
            : <PaymentConfirmationStep
                customer={customer}
                items={pendingPurchase.items}
                subtotal={subtotal}
                discountPercent={pendingPurchase.discountPercent}
                discountAmount={discountAmount}
                promoCode={pendingPurchase.promoCode}
                taxRate={taxRate}
                taxAmount={taxAmount}
                accountCreditApplied={accountCreditApplied}
                total={total}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                cashReceived={cashReceived}
                setCashReceived={setCashReceived}
                selectedCardId={selectedCardId}
                setSelectedCardId={setSelectedCardId}
                change={change}
                canConfirm={canConfirm()}
                onConfirm={handleConfirmPurchase}
                enabledMethods={enabledMethods}
                walletBalance={walletBalance}
                useAccountCredit={useAccountCredit}
                setUseAccountCredit={setUseAccountCredit}
                sellerStaffId={sellerStaffId}
                setSellerStaffId={setSellerStaffId}
                sellerOptions={sellerOptions}
            />)
        : <ReceiptStep
            receiptNumber={receiptNumber}
            transactionId={transactionId}
            customer={customer}
            items={pendingPurchase.items}
            subtotal={subtotal}
            discountPercent={pendingPurchase.discountPercent}
            discountAmount={discountAmount}
            promoCode={pendingPurchase.promoCode}
            taxRate={taxRate}
            taxAmount={taxAmount}
            accountCreditApplied={accountCreditApplied}
            total={total}
            paymentMethodLabel={paymentMethodLabel}
            chargedTo={chargedTo}
            onBack={() => setStep(1)}
            onComplete={handleComplete}
        />;

    return <CheckoutShell step={step} body={body} onClose={handleClose} />;
}
