"use client";

// ─────────────────────────────────────────────────────────────────────────────
// POS checkout — right-side slide panel (client 2026-08 — "like branding")
// ─────────────────────────────────────────────────────────────────────────────
//
// Same 2-step payment flow the old full-page /pos/checkout ran, but rendered in
// a 720px SlidePanel over /admin/pos instead of navigating away. Compact chrome
// (header + inline "Step N of 2") replaces the full-page vertical step rail; the
// payment / receipt step content is fluid, so it reflows to the panel width.
//
// PosCheckoutBody mounts fresh every time the panel opens (SlidePanel unmounts
// its children when closed), so the checkout state resets per sale — no manual
// reset needed. On complete it writes the sale + fires the toast, then signals
// the POS page (onComplete) to wipe the cart; cancel just drops the pending sale.

import { useEffect, useMemo, useState } from "react";
import { XClose } from "@untitledui/icons";
import { useAppStore, walletBalanceAed } from "@/lib/store";
import { SlidePanel } from "@/components/ui/SlidePanel";
import {
    PaymentConfirmationStep, ReceiptStep, ProcessingPaymentCard,
    describePayment, computeTotals, enabledMethodsFromProviders,
    type PaymentMethod,
} from "@/components/checkout/CheckoutScreen";

export function PosCheckoutPanel({ open, onClose }: {
    open: boolean;
    /** completed=true → the sale went through (POS should wipe its cart). */
    onClose: (completed: boolean) => void;
}) {
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    const cancel = () => { setPendingPurchase(null); onClose(false); };
    return (
        <SlidePanel open={open} onClose={cancel} width={720}>
            <PosCheckoutBody onCancel={cancel} onComplete={() => onClose(true)} />
        </SlidePanel>
    );
}

function PosCheckoutBody({ onCancel, onComplete }: {
    onCancel: () => void;
    onComplete: () => void;
}) {
    const pendingPurchase = useAppStore(s => s.pendingPurchase);
    const customers = useAppStore(s => s.customers);
    const staff = useAppStore(s => s.staff);
    const roles = useAppStore(s => s.roles);
    const currentUser = useAppStore(s => s.currentUser);
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    const applyPurchase = useAppStore(s => s.applyPurchase);
    const showToast = useAppStore(s => s.showToast);

    const sellerOptions = useMemo(() => staff
        .filter(st => st.status === "active")
        .map(st => ({ value: st.id, label: `${st.fullName} — ${roles.find(r => r.id === st.roleId)?.name ?? "Staff"}` })),
        [staff, roles]);
    const walletTransactions = useAppStore(s => s.walletTransactions);
    const taxRules         = useAppStore(s => s.taxRules);
    const taxRates         = useAppStore(s => s.taxRates);
    const pricesIncludeTax = useAppStore(s => s.taxSettings.pricesIncludeTax);
    const roundingMode     = useAppStore(s => s.taxSettings.roundingMode);
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
    // Still editable / clearable — it stays optional.
    const [sellerStaffId, setSellerStaffId] = useState<string | null>(() => {
        const candidate = currentUser?.staff_id ?? currentUser?.id ?? null;
        return candidate && sellerOptions.some(o => o.value === candidate) ? candidate : null;
    });
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [cashReceived, setCashReceived] = useState<string>("");
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [useAccountCredit, setUseAccountCredit] = useState<boolean>(false);
    const [useGiftCard, setUseGiftCard] = useState<boolean>(false);
    const issuedGiftCards    = useAppStore(s => s.issuedGiftCards);
    const giftCardBalanceFor = useAppStore(s => s.giftCardBalanceFor);
    const redeemGiftCards    = useAppStore(s => s.redeemGiftCards);
    const [loading, setLoading] = useState(false);
    const [receiptNumber] = useState(() => `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`);
    const [transactionId] = useState(() => Math.random().toString(36).slice(2, 10));

    // Cascade safety — drop a selected method that just got disabled.
    useEffect(() => {
        if (paymentMethod !== null && !enabledMethods.includes(paymentMethod)) {
            setPaymentMethod(null);
        }
    }, [paymentMethod, enabledMethods]);

    if (!pendingPurchase || !customer) return null;

    const walletBalance = walletBalanceAed(walletTransactions, customer.id);
    void issuedGiftCards;
    const giftCardBalance = giftCardBalanceFor(customer.id);
    const { subtotal, discountAmount, taxRate, taxAmount, taxIncluded, accountCreditApplied, giftCardApplied, total } = computeTotals(
        pendingPurchase.items, pendingPurchase.discountPercent, pendingPurchase.promoDiscountAed ?? 0,
        { taxRules, taxRates, pricesIncludeTax, roundingMode },
        useAccountCredit ? walletBalance : 0,
        useGiftCard ? giftCardBalance : 0,
    );
    const cashReceivedNum = Number(cashReceived) || 0;
    const change = Math.max(0, cashReceivedNum - total);
    const { label: paymentMethodLabel, chargedTo } = describePayment(paymentMethod, selectedCardId, cashReceivedNum);

    function canConfirm(): boolean {
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

    function handleComplete() {
        if (!customer || !pendingPurchase) return;
        const giftDebits = giftCardApplied > 0
            ? redeemGiftCards(customer.id, giftCardApplied).debits
            : undefined;
        applyPurchase(
            customer.id, pendingPurchase.items, "pos",
            sellerStaffId ?? undefined,
            accountCreditApplied > 0 ? accountCreditApplied : undefined,
            pendingPurchase.saleBranchId,
            giftDebits,
        );
        setPendingPurchase(null);
        showToast(
            "Transaction complete",
            "The payment was successful and the record is saved.",
            "success", "check",
        );
        onComplete();
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

    return (
        <>
            {/* Compact header — close + title + inline step (no vertical rail). */}
            <header className="shrink-0 h-[68px] flex items-center px-6 gap-3 border-b border-[#e4e7ec]">
                <button type="button" onClick={onCancel} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] text-[#667085] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5" />
                </button>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6 truncate">Checkout</p>
                    <p className="text-[13px] text-[#667085] leading-[18px]">
                        Step {step} of 2 · {step === 1 ? "Payment confirmation" : "Receipt"}
                    </p>
                </div>
            </header>
            <div className="flex-1 min-h-0 flex flex-col px-6 py-5">
                {body}
            </div>
        </>
    );
}
