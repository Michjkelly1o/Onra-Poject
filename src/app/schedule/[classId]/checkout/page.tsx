"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Schedule mini-POS checkout — Module 03 → 05 hand-off
// ─────────────────────────────────────────────────────────────────────────────
//
// This is the dedicated screen at /schedule/[classId]/checkout. Visually it's
// identical to /admin/pos/checkout (both mount the same subcomponents from
// /components/checkout/CheckoutScreen.tsx) but it has its own state machine +
// redirect behavior:
//
//   • On `Complete transaction` → applyPurchase, round-trip back to the class
//     detail with ?paymentSuccess=1&customerId=… so the schedule page can
//     re-open the PaymentConfirmation modal with the newly-bought plan and
//     fire its own toast. DOES NOT clear pendingPurchase here — that races
//     against the redirect and wipes the success params.
//   • On close (X) → drops the pending purchase and returns to /schedule/[id].

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore, walletBalanceAed } from "@/lib/store";
import {
    CheckoutShell, PaymentConfirmationStep, ReceiptStep, ProcessingPaymentCard,
    describePayment, savedCardsFor, computeTotals, enabledMethodsFromProviders,
    type PaymentMethod,
} from "@/components/checkout/CheckoutScreen";

export const dynamic = "force-dynamic";

export default function ScheduleCheckoutPage() {
    return (
        <Suspense fallback={null}>
            <ScheduleCheckoutInner />
        </Suspense>
    );
}

function ScheduleCheckoutInner() {
    const router = useRouter();
    const params = useParams();
    const classId = String(params.classId);

    const pendingPurchase = useAppStore(s => s.pendingPurchase);
    const customers = useAppStore(s => s.customers);
    const staff = useAppStore(s => s.staff);
    const roles = useAppStore(s => s.roles);
    // Signed-in staff running the sale — pre-fills "Credited to" (demo user id === staff id).
    const currentUser = useAppStore(s => s.currentUser);
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    const applyPurchase = useAppStore(s => s.applyPurchase);
    // Account credit — same shape as /admin/pos/checkout. No longer a
    // standalone payment method; applied via a reduction toggle above the
    // payment picker. `applyPurchase` debits the wallet in the same tick.
    const walletTransactions = useAppStore(s => s.walletTransactions);
    // Tax module wiring (Phase 4) — same shape as /admin/pos so the
    // schedule-flow checkout honours archived rates + the global toggle.
    const taxRules = useAppStore(s => s.taxRules);
    const taxRates = useAppStore(s => s.taxRates);
    const pricesIncludeTax = useAppStore(s => s.taxSettings.pricesIncludeTax);
    // New (Tax module v22): per-line vs per-invoice rounding. Drives whether
    // each line's tax is rounded before summing (per_line) or summed raw
    // then rounded once (per_invoice). Configured in /admin/settings/tax.
    const roundingMode = useAppStore(s => s.taxSettings.roundingMode);
    const classSchedules = useAppStore(s => s.classSchedules);
    // Phase 3 — same subscription as /admin/pos/checkout. Hides the Card /
    // Apple Pay / Google Pay tiles when their provider isn't connected,
    // including cascade-disconnects from Stripe.
    const paymentProviders = useAppStore(s => s.paymentProviders);
    const enabledMethods = useMemo(
        () => enabledMethodsFromProviders(paymentProviders),
        [paymentProviders],
    );

    const customer = useMemo(
        () => pendingPurchase ? customers.find(c => c.id === pendingPurchase.customerId) ?? null : null,
        [pendingPurchase, customers],
    );

    const [step, setStep] = useState<1 | 2>(1);
    // "Credited to" auto-fills to the signed-in user's linked staff record
    // (account `staff_id`, falls back to the user id) when that staff is active.
    const [sellerStaffId, setSellerStaffId] = useState<string | null>(() => {
        const candidate = currentUser?.staff_id ?? currentUser?.id ?? null;
        return candidate && staff.some(st => st.status === "active" && st.id === candidate) ? candidate : null;
    });
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);

    // "Credited to" — active staff labelled with their role (commission Phase 2).
    const sellerOptions = useMemo(() => staff
        .filter(st => st.status === "active")
        .map(st => ({ value: st.id, label: `${st.fullName} — ${roles.find(r => r.id === st.roleId)?.name ?? "Staff"}` })),
        [staff, roles]);
    const [cashReceived, setCashReceived] = useState<string>("");
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    // "Use account credit" toggle — when on, the customer's balance is
    // applied as a reduction (capped at the post-discount total).
    const [useAccountCredit, setUseAccountCredit] = useState<boolean>(false);
    // Gift card — client 2026-07-31. Same reduction-toggle model as account
    // credit; parity with the main POS checkout so both entry points behave
    // identically for every product type.
    const [useGiftCard, setUseGiftCard] = useState<boolean>(false);
    const issuedGiftCards    = useAppStore(s => s.issuedGiftCards);
    const giftCardBalanceFor = useAppStore(s => s.giftCardBalanceFor);
    const redeemGiftCards    = useAppStore(s => s.redeemGiftCards);
    const [loading, setLoading] = useState(false);
    const [receiptNumber] = useState(() => `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`);
    const [transactionId] = useState(() => Math.random().toString(36).slice(2, 10));

    useEffect(() => {
        if (!pendingPurchase) router.replace(`/schedule/${classId}`);
    }, [pendingPurchase, classId, router]);

    // Cascade safety — if a Settings change just hid the currently-selected
    // method (e.g. disconnecting Stripe while this page was open), drop the
    // selection so the picker doesn't show a stale active state.
    useEffect(() => {
        if (paymentMethod !== null && !enabledMethods.includes(paymentMethod)) {
            setPaymentMethod(null);
        }
    }, [paymentMethod, enabledMethods]);

    // Resolve branch from the originating schedule so branch-specific tax
    // rules apply (falls back to undefined → all_locations rule).
    //
    // IMPORTANT: this `useMemo` MUST stay above the `pendingPurchase`/`customer`
    // null-guard early-return below — when the user closes checkout the store
    // clears `pendingPurchase`, the component re-renders briefly before the
    // router.replace navigates away, and if any hook here is skipped we hit
    // "Rendered fewer hooks than expected" and the app falls into error.tsx.
    const branchId = useMemo(
        () => pendingPurchase
            ? classSchedules.find(s => s.id === pendingPurchase.classScheduleId)?.branchId
            : undefined,
        [classSchedules, pendingPurchase],
    );

    if (!pendingPurchase || !customer) return null;
    const walletBalance = walletBalanceAed(walletTransactions, customer.id);
    // Subscribing to `issuedGiftCards` keeps this recomputing as cards are
    // spent/refunded elsewhere; the selector itself reads from get().
    void issuedGiftCards;
    const giftCardBalance = giftCardBalanceFor(customer.id);
    const { subtotal, discountAmount, taxRate, taxAmount, taxIncluded, accountCreditApplied, giftCardApplied, total } = computeTotals(
        pendingPurchase.items,
        pendingPurchase.discountPercent,
        pendingPurchase.promoDiscountAed,
        { taxRules, taxRates, pricesIncludeTax, roundingMode, branchId },
        useAccountCredit ? walletBalance : 0,
        useGiftCard ? giftCardBalance : 0,
    );
    const cashReceivedNum = Number(cashReceived) || 0;
    const change = Math.max(0, cashReceivedNum - total);
    const { label: paymentMethodLabel, chargedTo } = describePayment(paymentMethod, selectedCardId, cashReceivedNum, savedCardsFor(customer?.id));

    function canConfirm(): boolean {
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

    /** Step 2 "Complete transaction" — schedule entry path.
     *
     *  IMPORTANT: don't clear pendingPurchase here — doing so re-triggers the
     *  "missing purchase → redirect" guard effect which races against this
     *  router.replace and wipes the success params. The schedule page's
     *  paymentSuccess handler clears pendingPurchase after the modal re-opens. */
    function handleComplete() {
        if (!customer || !pendingPurchase) return;
        // Account credit debit rides inside `applyPurchase` now — same store
        // path as /admin/pos so the ledger + balance stay in sync.
        // Retail note (v83 audit-2, 2026-07-29): if a future spec adds
        // retail to the schedule mini-POS flow, pass
        // `pendingPurchase.saleBranchId` as the 6th arg so retail stock
        // decrements at the physical sale branch. Today's flow only sells
        // memberships/packages/gift-cards, so the omission is safe — the
        // fallback to buyer.branchId inside applyPurchase does the right
        // thing for non-retail lines.
        // Gift-card debit first so the per-card breakdown can be stamped on
        // the transaction — same order as the main POS checkout.
        const giftDebits = giftCardApplied > 0
            ? redeemGiftCards(customer.id, giftCardApplied).debits
            : undefined;
        applyPurchase(
            customer.id, pendingPurchase.items, "pos",
            sellerStaffId ?? undefined,
            accountCreditApplied > 0 ? accountCreditApplied : undefined,
            undefined,
            giftDebits,
            pendingPurchase.promoCode
                ? { code: pendingPurchase.promoCode, discountAed: pendingPurchase.promoDiscountAed ?? 0 }
                : undefined,
        );
        router.replace(`/schedule/${classId}?paymentSuccess=1&customerId=${customer.id}`);
    }

    function handleClose() {
        setPendingPurchase(null);
        router.replace(`/schedule/${classId}`);
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
                taxIncluded={taxIncluded}
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
                giftCardApplied={giftCardApplied}
                giftCardBalance={giftCardBalance}
                                useGiftCard={useGiftCard}
                setUseGiftCard={setUseGiftCard}
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
            taxIncluded={taxIncluded}
            accountCreditApplied={accountCreditApplied}
            giftCardApplied={giftCardApplied}
            total={total}
            paymentMethodLabel={paymentMethodLabel}
            chargedTo={chargedTo}
            onBack={() => setStep(1)}
            onComplete={handleComplete}
        />;

    return <CheckoutShell step={step} body={body} onClose={handleClose} />;
}
