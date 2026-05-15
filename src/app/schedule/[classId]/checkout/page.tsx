"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    XClose, Check, CreditCard02, CreditCard01, BankNote01, Package, Lightbulb02, CheckCircle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, PAYMENT_METHODS, type PurchaseLineItem } from "@/lib/store";

// ─── POS Checkout — Figma 5087:126203 + 5087:126928 ──────────────────────────
//
// Two-step full-screen flow:
//   Step 1: Payment confirmation — pick payment method (Cash / Card on file /
//           Apple Pay) and supply method-specific details, then "Confirm
//           purchase" triggers the loading state.
//   Step 2: Receipt — success summary with receipt #, line items, totals,
//           payment method, and a "Complete transaction" button.
//
// State flow:
//   Reads `pendingPurchase` from the Zustand store (set by
//   /schedule/[classId]'s CheckoutConfirmationModal). On completion, calls
//   `applyPurchase()` to update the customer's plan, clears the pending
//   purchase, and routes back to /schedule/[classId]?paymentSuccess=1&customerId=…
//   so the schedule page can re-open the PaymentConfirmation modal with the
//   newly-bought plan and surface a toast.

export const dynamic = "force-dynamic";

type PaymentMethod = "cash" | "card" | "applepay";

// Sourced from the centralized `payment_methods` seed. The seed shape is
// snake_case (DB-ready); we surface only the display fields the card picker UI
// needs (id / brand / last4) without a renaming layer.
const SAVED_CARDS = PAYMENT_METHODS.map(pm => ({
    id: pm.id,
    brand: pm.brand,
    last4: pm.last4,
}));

export default function CheckoutPage() {
    return (
        <Suspense fallback={null}>
            <CheckoutInner />
        </Suspense>
    );
}

function CheckoutInner() {
    const router = useRouter();
    const params = useParams();
    const classId = String(params.classId);

    const pendingPurchase = useAppStore(s => s.pendingPurchase);
    const customers = useAppStore(s => s.customers);
    const setPendingPurchase = useAppStore(s => s.setPendingPurchase);
    const applyPurchase = useAppStore(s => s.applyPurchase);

    const customer = useMemo(
        () => pendingPurchase ? customers.find(c => c.id === pendingPurchase.customerId) ?? null : null,
        [pendingPurchase, customers],
    );

    const [step, setStep] = useState<1 | 2>(1);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
    const [cashReceived, setCashReceived] = useState<string>("");
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [receiptNumber] = useState(() => `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`);
    const [transactionId] = useState(() => Math.random().toString(36).slice(2, 10));

    // Bail to the schedule detail if a user lands here without a pending purchase
    // (e.g. direct URL hit, hard refresh that lost in-memory state).
    useEffect(() => {
        if (!pendingPurchase) {
            router.replace(`/schedule/${classId}`);
        }
    }, [pendingPurchase, classId, router]);

    if (!pendingPurchase || !customer) return null;

    // Derived totals (mirror CheckoutConfirmationModal math so receipt matches exactly).
    const subtotal = pendingPurchase.items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const discountPercent = pendingPurchase.discountPercent;
    const discountAmount = Math.round(subtotal * (discountPercent / 100));
    const taxRate = 10;
    const taxAmount = Math.round((subtotal - discountAmount) * (taxRate / 100));
    const total = subtotal - discountAmount + taxAmount;

    const cashReceivedNum = Number(cashReceived) || 0;
    const change = Math.max(0, cashReceivedNum - total);

    /** Step 1 → step 2 — runs the loading animation, then advances. */
    function handleConfirmPurchase() {
        if (!canConfirm()) return;
        setLoading(true);
        // Simulated processing delay; real implementation would await a payment
        // intent / terminal response here.
        window.setTimeout(() => {
            setLoading(false);
            setStep(2);
        }, 1600);
    }

    function canConfirm(): boolean {
        if (paymentMethod === null) return false;
        if (paymentMethod === "cash") return cashReceivedNum >= total;
        if (paymentMethod === "card") return selectedCardId !== null;
        if (paymentMethod === "applepay") return true;
        return false;
    }

    /** Step 2 "Complete transaction" — commit + go home.
     *  IMPORTANT: don't clear pendingPurchase here — doing so re-triggers the
     *  "missing purchase → redirect" guard effect which races against this
     *  router.replace and wipes the success params. The schedule page's
     *  paymentSuccess handler clears pendingPurchase after the modal re-opens.
     */
    function handleComplete() {
        if (!customer || !pendingPurchase) return;
        applyPurchase(customer.id, pendingPurchase.items);
        router.replace(`/schedule/${classId}?paymentSuccess=1&customerId=${customer.id}`);
    }

    function handleClose() {
        setPendingPurchase(null);
        router.replace(`/schedule/${classId}`);
    }

    // Payment method label/charge target shown on the receipt
    const paymentMethodLabel =
        paymentMethod === "cash" ? "Cash"
            : paymentMethod === "card" ? "Card on file"
                : paymentMethod === "applepay" ? "Apple Pay"
                    : "—";
    const chargedTo =
        paymentMethod === "card" && selectedCardId
            ? (() => {
                const c = SAVED_CARDS.find(c => c.id === selectedCardId);
                return c ? `${c.brand} ****${c.last4}` : "—";
            })()
            : paymentMethod === "cash" ? `Cash (AED ${cashReceivedNum})`
                : paymentMethod === "applepay" ? "Apple Pay"
                    : "—";

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white relative">
            {/* Top bar — close + title (no border, matches Schedule form chrome) */}
            <header className="shrink-0 h-[72px] flex items-center px-6 gap-3">
                <button type="button" onClick={handleClose} className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <p className="flex-1 text-[20px] font-semibold text-[#101828]">Create payment</p>
            </header>

            {/* Body — sidebar + form card, matching ScheduleFormPage layout */}
            <div className="flex flex-1 overflow-hidden gap-8 px-6 py-6">
                {/* Steps sidebar (260px, with connector line between steps) */}
                <div className="w-[260px] shrink-0 flex flex-col gap-0 pt-2">
                    <StepItem n={1} label="Payment confirmation" current={step} total={2} />
                    <StepItem n={2} label="Receipt" current={step} total={2} />
                </div>

                {/* Form card — flex-1 fills the rest of the body height */}
                <main className="flex-1 max-w-[720px] flex flex-col min-h-0">
                    {step === 1 && (
                        loading
                            ? <ProcessingPaymentCard method={paymentMethod!} chargedTo={chargedTo} />
                            : <PaymentConfirmationStep
                                customer={customer}
                                items={pendingPurchase.items}
                                subtotal={subtotal}
                                discountPercent={discountPercent}
                                discountAmount={discountAmount}
                                promoCode={pendingPurchase.promoCode}
                                taxRate={taxRate}
                                taxAmount={taxAmount}
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
                            />
                    )}
                    {step === 2 && (
                        <ReceiptStep
                            receiptNumber={receiptNumber}
                            transactionId={transactionId}
                            customer={customer}
                            items={pendingPurchase.items}
                            subtotal={subtotal}
                            discountPercent={discountPercent}
                            discountAmount={discountAmount}
                            promoCode={pendingPurchase.promoCode}
                            taxRate={taxRate}
                            taxAmount={taxAmount}
                            total={total}
                            paymentMethodLabel={paymentMethodLabel}
                            chargedTo={chargedTo}
                            onBack={() => setStep(1)}
                            onComplete={handleComplete}
                        />
                    )}
                </main>
            </div>
        </div>
    );
}

// ─── Sidebar step row — mirrors ScheduleFormPage.tsx StepItem (with connector line) ─
function StepItem({ n, label, current, total }: { n: number; label: string; current: number; total: number }) {
    const active = n === current;
    const complete = n < current;
    const isLast = n === total;
    return (
        <div className={cn("flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full", active && "bg-[#f5fffa]")}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]")}>
                    {complete ? <Check className="w-3 h-3" /> : n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />}
            </div>
            <span className={cn("text-[14px]", active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]")}>
                {label}
            </span>
        </div>
    );
}

// ─── Step 1: Payment confirmation ─────────────────────────────────────────────

type Step1Props = {
    customer: import("@/lib/store").Customer;
    items: PurchaseLineItem[];
    subtotal: number; discountPercent: number; discountAmount: number;
    promoCode?: string;
    taxRate: number; taxAmount: number; total: number;
    paymentMethod: PaymentMethod | null;
    setPaymentMethod: (m: PaymentMethod) => void;
    cashReceived: string; setCashReceived: (v: string) => void;
    selectedCardId: string | null; setSelectedCardId: (id: string) => void;
    change: number;
    canConfirm: boolean;
    onConfirm: () => void;
};
function PaymentConfirmationStep(p: Step1Props) {
    return (
        <div className="flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
                {/* Payment information (summary mirrored from the confirmation modal) */}
                <PaymentInformation
                    customer={p.customer}
                    items={p.items}
                    subtotal={p.subtotal}
                    discountPercent={p.discountPercent}
                    discountAmount={p.discountAmount}
                    promoCode={p.promoCode}
                    taxRate={p.taxRate}
                    taxAmount={p.taxAmount}
                    total={p.total}
                />

                {/* Payment method picker */}
                <div className="flex flex-col gap-4">
                    <p className="text-[18px] font-semibold text-[#101828]">Payment method</p>
                    <div className="grid grid-cols-2 gap-4">
                        <PaymentMethodCard
                            method="cash" selected={p.paymentMethod === "cash"}
                            onSelect={() => p.setPaymentMethod("cash")}
                            title="Cash" subtitle="Payment via cash"
                            icon={<BankNote01 className="w-4 h-4 text-[#475467]" />}
                        />
                        <PaymentMethodCard
                            method="card" selected={p.paymentMethod === "card"}
                            onSelect={() => p.setPaymentMethod("card")}
                            title="Card on file" subtitle="Payment via card"
                            icon={<CreditCard01 className="w-4 h-4 text-[#475467]" />}
                        />
                        <PaymentMethodCard
                            method="applepay" selected={p.paymentMethod === "applepay"}
                            onSelect={() => p.setPaymentMethod("applepay")}
                            title="Apple Pay" subtitle="Payment via Apple Pay"
                            icon={<AppleLogo />}
                        />
                    </div>
                </div>

                {/* Payment confirmation — method-specific */}
                {p.paymentMethod !== null && (
                    <div className="flex flex-col gap-4">
                        <p className="text-[18px] font-semibold text-[#101828]">Payment confirmation</p>
                        {p.paymentMethod === "cash" && (
                            <CashConfirmation cashReceived={p.cashReceived} setCashReceived={p.setCashReceived} total={p.total} change={p.change} />
                        )}
                        {p.paymentMethod === "card" && (
                            <CardConfirmation selectedCardId={p.selectedCardId} setSelectedCardId={p.setSelectedCardId} />
                        )}
                        {p.paymentMethod === "applepay" && (
                            <ApplePayConfirmation total={p.total} />
                        )}
                    </div>
                )}

            </div>

            {/* Footer — sticky, no top border per design */}
            <div className="shrink-0 px-6 py-4 flex justify-end">
                <Button variant="primary" size="lg" disabled={!p.canConfirm} onClick={p.onConfirm}>
                    Confirm purchase
                </Button>
            </div>
        </div>
    );
}

function PaymentInformation({ customer, items, subtotal, discountPercent, discountAmount, promoCode, taxRate, taxAmount, total }: {
    customer: import("@/lib/store").Customer;
    items: PurchaseLineItem[];
    subtotal: number; discountPercent: number; discountAmount: number; promoCode?: string;
    taxRate: number; taxAmount: number; total: number;
}) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[18px] font-semibold text-[#101828]">Payment information</p>
            <div className="flex items-center justify-between">
                <p className="text-[14px] text-[#667085]">Customer</p>
                <div className="flex items-center gap-2">
                    {customer.imageUrl
                        ? <img src={customer.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                        : <div className="w-6 h-6 rounded-full bg-[#e0e0e0] flex items-center justify-center text-[10px] font-semibold text-[#667085]">{customer.initials}</div>
                    }
                    <p className="text-[16px] font-medium text-[#101828]">{customer.firstName} {customer.lastName}</p>
                </div>
            </div>

            <div className="h-px w-full bg-[#e4e7ec]" />

            {/* Detail product */}
            <p className="text-[14px] font-medium text-[#101828]">Detail product</p>
            <div className="flex flex-col gap-3">
                {items.map(it => (
                    <div key={it.productId} className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0",
                            it.productType === "membership" ? "bg-[#e0eaff]" : "bg-[#c4edd6]"
                        )}>
                            {it.productType === "membership"
                                ? <CreditCard02 className="w-5 h-5 text-[#3538cd]" />
                                : <Package className="w-5 h-5 text-[#658774]" />}
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                            <p className="text-[14px] font-medium text-[#101828]">{it.name}</p>
                            <p className="text-[14px] text-[#658774]">AED {it.unitPrice.toLocaleString()}</p>
                        </div>
                        <p className="text-[14px] font-medium text-[#101828] whitespace-nowrap">{it.quantity}x</p>
                    </div>
                ))}
            </div>

            <div className="h-px w-full bg-[#e4e7ec]" />

            {/* Detail payment */}
            <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Subtotal</p>
                    <p className="text-[16px] font-medium text-[#101828]">AED {subtotal.toLocaleString()}</p>
                </div>
                {discountPercent > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-[14px] text-[#667085]">
                            {promoCode
                                ? <>Promo code (<span className="font-medium text-[#101828]">{promoCode}</span>)</>
                                : <>Discount (<span className="font-medium text-[#101828]">{discountPercent}%</span>)</>
                            }
                        </p>
                        <p className="text-[16px] font-medium text-[#d92d20]">-AED {discountAmount.toLocaleString()}</p>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Tax rate (<span className="font-medium text-[#101828]">{taxRate}%</span>)</p>
                    <p className="text-[16px] font-medium text-[#101828]">AED {taxAmount.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#101828]">Total</p>
                    <p className="text-[16px] font-semibold text-[#101828]">AED {total.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

function PaymentMethodCard({ selected, onSelect, title, subtitle, icon }: {
    method: PaymentMethod;
    selected: boolean;
    onSelect: () => void;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "flex items-center gap-3 p-4 bg-white rounded-[12px] text-left transition-colors",
                selected
                    ? "border-2 border-[#658774] bg-[#f5fffa]"
                    : "border-1 border-[#e4e7ec] hover:bg-[#f9fafb]"
            )}>
            <div className="w-8 h-8 rounded-[6px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#344054]">{title}</p>
                <p className="text-[14px] text-[#475467]">{subtitle}</p>
            </div>
            <div className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border-1",
                selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]"
            )}>
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

function AppleLogo() {
    // Tiny inline SVG for the Apple logo so we don't need a new icon dep.
    return (
        <svg viewBox="0 0 16 16" className="w-4 h-4 text-[#101828]" fill="currentColor">
            <path d="M11.45 8.13c-.02-2 1.64-2.96 1.72-3-.94-1.37-2.4-1.56-2.92-1.58-1.24-.13-2.42.73-3.05.73-.64 0-1.6-.71-2.64-.7-1.35.02-2.6.79-3.3 2-1.41 2.45-.36 6.06.99 8.05.67.98 1.45 2.07 2.49 2.03 1-.04 1.38-.65 2.59-.65 1.21 0 1.55.65 2.6.63 1.08-.02 1.76-.99 2.42-1.97.77-1.13 1.08-2.23 1.1-2.29-.03-.01-2.11-.81-2.13-3.21l.13-.04zM9.55 2.4c.55-.66.92-1.59.82-2.5-.79.03-1.75.53-2.32 1.2-.51.58-.95 1.53-.83 2.42.88.07 1.78-.45 2.33-1.11z" />
        </svg>
    );
}

function CashConfirmation({ cashReceived, setCashReceived, total, change }: {
    cashReceived: string; setCashReceived: (v: string) => void; total: number; change: number;
}) {
    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
                <label className="text-[14px] font-medium text-[#344054]">Cash received</label>
                <div className="flex items-center h-10 bg-white border-1 border-[#d0d5dd] rounded-[8px] px-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)]">
                    <span className="text-[16px] text-[#667085] mr-2">AED</span>
                    <input type="number" min="0" value={cashReceived}
                        onChange={e => setCashReceived(e.target.value.replace(/^0+(?=\d)/, ""))}
                        placeholder="0"
                        className="flex-1 bg-transparent text-[16px] text-[#101828] placeholder-[#667085] focus:outline-none" />
                </div>
            </div>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Method</p>
                    <p className="text-[16px] font-medium text-[#101828]">Cash</p>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Amount due</p>
                    <p className="text-[16px] font-medium text-[#101828]">AED {total.toLocaleString()}</p>
                </div>
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Change</p>
                    <p className="text-[16px] font-medium text-[#101828]">AED {change.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

function CardConfirmation({ selectedCardId, setSelectedCardId }: { selectedCardId: string | null; setSelectedCardId: (id: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <p className="text-[14px] text-[#667085]">Method</p>
                <p className="text-[16px] font-medium text-[#101828]">Card on file</p>
            </div>
            <div className="flex flex-col gap-2 mt-2">
                {SAVED_CARDS.map(card => {
                    const selected = selectedCardId === card.id;
                    return (
                        <button key={card.id} type="button" onClick={() => setSelectedCardId(card.id)}
                            className={cn(
                                "flex items-center gap-3 p-4 bg-white rounded-[12px] text-left transition-colors",
                                selected ? "border-2 border-[#658774] bg-[#f5fffa]" : "border-1 border-[#e4e7ec] hover:bg-[#f9fafb]"
                            )}>
                            <div className="w-10 h-7 rounded-[4px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0">
                                {card.brand === "Master Card" ? <MasterCardLogo /> : <VisaLogo />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#101828]">{card.brand}</p>
                                <p className="text-[14px] text-[#667085]">****{card.last4}</p>
                            </div>
                            <div className={cn(
                                "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border-1",
                                selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]"
                            )}>
                                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function ApplePayConfirmation({ total }: { total: number }) {
    return (
        <div className="flex flex-col gap-3 items-center bg-white border-1 border-[#e4e7ec] rounded-[12px] p-6">
            <div className="w-12 h-12 rounded-[12px] bg-[#101828] flex items-center justify-center">
                <AppleLogo />
            </div>
            <p className="text-[16px] font-semibold text-[#101828]">Confirm with Apple Pay</p>
            <p className="text-[14px] text-[#475467] text-center">
                Charge of <span className="font-medium text-[#101828]">AED {total.toLocaleString()}</span> will be billed to the customer&apos;s Apple Pay on confirmation.
            </p>
        </div>
    );
}

// ─── Loading state — Figma 6891:75669 ─────────────────────────────────────────
function ProcessingPaymentCard({ method, chargedTo }: { method: PaymentMethod; chargedTo: string }) {
    return (
        <div className="flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-8">
            <p className="text-[18px] font-semibold text-[#101828] text-center">Processing payment</p>
            <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[16px] h-[150px] w-[320px] p-3 flex flex-col justify-between animate-pulse">
                    <div className="bg-white rounded-[10px] shadow-[0px_1.5px_4px_rgba(0,0,0,0.04)] w-[51px] h-[51px] flex items-center justify-center">
                        <PaymentMethodLogo method={method} />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-2 w-[100px]">
                            <div className="h-3 bg-[#f2f4f7] rounded-full" />
                            <div className="h-3 bg-[#f2f4f7] rounded-full w-8" />
                        </div>
                        <div className="h-[18px] w-[64px] bg-[#f2f4f7] rounded-full" />
                    </div>
                </div>
                <div className="flex flex-col items-center gap-1 max-w-[352px] text-center">
                    <p className="text-[16px] font-semibold text-[#101828]">Charging {chargedTo}</p>
                    <p className="text-[14px] text-[#475467]">Please wait...</p>
                </div>
            </div>
        </div>
    );
}

function PaymentMethodLogo({ method }: { method: PaymentMethod }) {
    if (method === "cash") return <BankNote01 className="w-6 h-6 text-[#658774]" />;
    if (method === "applepay") return <div className="w-6 h-6 rounded-md bg-[#101828] flex items-center justify-center"><AppleLogo /></div>;
    return <MasterCardLogo />;
}

function MasterCardLogo() {
    return (
        <svg viewBox="0 0 24 14" className="w-7 h-5">
            <circle cx="9" cy="7" r="6" fill="#EB001B" />
            <circle cx="15" cy="7" r="6" fill="#F79E1B" />
            <path d="M12 2.5a6 6 0 010 9 6 6 0 010-9z" fill="#FF5F00" />
        </svg>
    );
}

function VisaLogo() {
    return (
        <svg viewBox="0 0 32 12" className="w-7 h-3">
            <text x="0" y="10" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="10" fill="#1A1F71" letterSpacing="-0.5">VISA</text>
        </svg>
    );
}

// ─── Step 2: Receipt — Figma 5087:126928 ──────────────────────────────────────
function ReceiptStep({
    receiptNumber, transactionId, customer, items, subtotal, discountPercent, discountAmount, promoCode,
    taxRate, taxAmount, total, paymentMethodLabel, chargedTo, onBack, onComplete,
}: {
    receiptNumber: string;
    transactionId: string;
    customer: import("@/lib/store").Customer;
    items: PurchaseLineItem[];
    subtotal: number; discountPercent: number; discountAmount: number; promoCode?: string;
    taxRate: number; taxAmount: number; total: number;
    paymentMethodLabel: string;
    chargedTo: string;
    onBack: () => void;
    onComplete: () => void;
}) {
    const dateLabel = useMemo(() => {
        const d = new Date();
        return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    }, []);

    return (
        <div className="flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            {/* Scrollable receipt body — content stretches naturally; this wrapper scrolls when too tall. */}
            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-6 pt-6 pb-6 flex flex-col gap-5 relative shrink-0 overflow-hidden">
                    {/* Decorative wave patterns — Figma 5087:126928. Small brand-green
                    concentric rings rotated and positioned at both top corners. */}
                    <ReceiptHeaderDecoration />

                    {/* Hero: check icon + title. Concentric ring halo is rendered via
                        box-shadow (spread), so the icon stays in normal flow and the
                        rings naturally sit centered behind it without absolute positioning. */}
                    <div className="relative flex flex-col items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_4px_rgba(123,160,140,0.3),0_0_0_12px_rgba(123,160,140,0.1)]">
                            <CheckCircle className="w-7 h-7 text-[#658774]" />
                        </div>
                        <p className="text-[18px] font-semibold text-[#101828] text-center">Transaction complete</p>
                    </div>

                    {/* Receipt header rows */}
                    <div className="flex flex-col gap-2">
                        <ReceiptRow label="Receipt" value={`#${receiptNumber}`} />
                        <ReceiptRow label="Customer" value={`${customer.firstName} ${customer.lastName}`} />
                        <ReceiptRow label="Date" value={dateLabel} />
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* Detail product */}
                    <div className="flex flex-col gap-3">
                        <p className="text-[14px] font-medium text-[#101828]">Detail product</p>
                        {items.map(it => (
                            <div key={it.productId} className="flex items-center gap-3">
                                <div className={cn(
                                    "w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0",
                                    it.productType === "membership" ? "bg-[#e0eaff]" : "bg-[#c4edd6]"
                                )}>
                                    {it.productType === "membership"
                                        ? <CreditCard02 className="w-5 h-5 text-[#3538cd]" />
                                        : <Package className="w-5 h-5 text-[#658774]" />}
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    <p className="text-[14px] font-medium text-[#101828]">{it.name}</p>
                                    <p className="text-[14px] text-[#658774]">AED {it.unitPrice.toLocaleString()}</p>
                                </div>
                                <p className="text-[14px] font-medium text-[#101828] whitespace-nowrap">{it.quantity}x</p>
                            </div>
                        ))}
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* Detail payment */}
                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] text-[#667085]">Subtotal</p>
                            <p className="text-[16px] font-medium text-[#101828]">AED {subtotal.toLocaleString()}</p>
                        </div>
                        {discountPercent > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[#667085]">
                                    {promoCode
                                        ? <>Promo code (<span className="font-medium text-[#101828]">{promoCode}</span>)</>
                                        : <>Discount (<span className="font-medium text-[#101828]">{discountPercent}%</span>)</>
                                    }
                                </p>
                                <p className="text-[16px] font-medium text-[#d92d20]">-AED {discountAmount.toLocaleString()}</p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] text-[#667085]">Tax rate (<span className="font-medium text-[#101828]">{taxRate}%</span>)</p>
                            <p className="text-[16px] font-medium text-[#101828]">AED {taxAmount.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] font-semibold text-[#101828]">Total</p>
                            <p className="text-[16px] font-semibold text-[#101828]">AED {total.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    {/* Payment method info */}
                    <div className="flex flex-col gap-3">
                        <p className="text-[14px] font-medium text-[#101828]">Payment method</p>
                        <div className="flex flex-col gap-2">
                            <ReceiptRow label="Method" value={paymentMethodLabel} />
                            <ReceiptRow label="Charged to" value={chargedTo} />
                            <ReceiptRow label="Transaction ID" value={transactionId} />
                            <ReceiptRow label="Status" value="Approved" valueClass="text-[#079455]" />
                        </div>
                    </div>
                </div>

                {/* Auto-send alert */}
                <div className="bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] flex items-center gap-4 p-4">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0" />
                    <p className="text-[14px] text-[#475467]">This receipt will be automatically sent to the customer via email and SMS.</p>
                </div>
            </div>

            {/* Sticky footer */}
            <div className="shrink-0 px-6 py-4 border-[#e4e7ec] flex items-center justify-between">
                <Button variant="secondary-gray" size="lg" onClick={onBack}>Back</Button>
                <Button variant="primary" size="lg" onClick={onComplete}>Complete transaction</Button>
            </div>
        </div>
    );
}

function ReceiptRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
    return (
        <div className="flex items-center justify-between">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className={cn("text-[16px] font-medium text-[#101828]", valueClass)}>{value}</p>
        </div>
    );
}

// ─── Receipt header decoration (Figma 5087:126928) ────────────────────────────
// Renders soft brand-green concentric rounded-rect waves at both top corners,
// rotated to angle inward toward the central check icon. The wrapping container
// must be `relative` + `overflow-hidden` for the SVGs to clip properly.
function ReceiptHeaderDecoration() {
    // Two concentric ring pairs (Figma 6893:85078) anchored at the top-left and
    // top-right corners of the card. Each pair = an outer ring + an inner ring,
    // centered ON the corner so only the inward quadrant is visible — the rest
    // is clipped by the card's overflow-hidden. Rendered at 5% opacity for a
    // very subtle decorative effect.
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
            {/* Top-left: two concentric rings centered at the corner */}
            <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[#7ba08c]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[#7ba08c]" />
            </div>

            {/* Top-right: mirrored pair, centered at the right corner */}
            <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[#7ba08c]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[#7ba08c]" />
            </div>
        </div>
    );
}
