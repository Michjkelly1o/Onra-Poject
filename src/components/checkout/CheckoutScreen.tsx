"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Checkout subcomponents (Module 05 — POS)
// ─────────────────────────────────────────────────────────────────────────────
//
// SHARED VISUAL BUILDING BLOCKS — the actual page wiring (state, redirects,
// toasts) lives in each entry point's page.tsx:
//
//   • /schedule/[classId]/checkout/page.tsx — mini-POS entry (round-trips back
//     to the class detail to re-open the Payment confirmation modal)
//   • /admin/pos/checkout/page.tsx         — POS module entry (fires a toast
//     + redirects to /admin/pos on Complete transaction)
//
// Each page builds its own state machine + its own onComplete handler around
// these subcomponents so the redirect / side-effect behavior can differ per
// entry point WITHOUT a "context" branch inside this file.
//
// Figma:
//   • Step 1 (Payment confirmation): 5087:126203
//   • Step 2 (Receipt):              5087:126928
//   • Loading state:                 6891:75669

import { useMemo } from "react";
import {
    XClose, Check, CreditCard02, CreditCard01, BankNote01, Package,
    Lightbulb02, CheckCircle, Gift01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS, type Customer, type PurchaseLineItem } from "@/lib/store";

export type PaymentMethod = "cash" | "card" | "applepay";

// Sourced from the centralized `payment_methods` seed.
const SAVED_CARDS = PAYMENT_METHODS.map(pm => ({
    id: pm.id,
    brand: pm.brand,
    last4: pm.last4,
}));

// ─── Top-level shell (header + 2-step body) ──────────────────────────────────

export interface CheckoutShellProps {
    step: 1 | 2;
    loading: boolean;
    paymentMethod: PaymentMethod | null;
    onClose: () => void;
    body: React.ReactNode;
}

export function CheckoutShell({ step, body, onClose }: { step: 1 | 2; body: React.ReactNode; onClose: () => void }) {
    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white relative">
            <header className="shrink-0 h-[72px] flex items-center px-6 gap-3">
                <button type="button" onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <p className="flex-1 text-[20px] font-semibold text-[#101828]">Create payment</p>
            </header>

            <div className="flex flex-1 overflow-hidden gap-8 px-6 py-6">
                <div className="w-[260px] shrink-0 flex flex-col gap-0 pt-2">
                    <StepItem n={1} label="Payment confirmation" current={step} total={2} />
                    <StepItem n={2} label="Receipt" current={step} total={2} />
                </div>
                <main className="flex-1 max-w-[720px] flex flex-col min-h-0">
                    {body}
                </main>
            </div>
        </div>
    );
}

// ─── Sidebar step row ────────────────────────────────────────────────────────
export function StepItem({ n, label, current, total }: { n: number; label: string; current: number; total: number }) {
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

// ─── Step 1: Payment confirmation card ───────────────────────────────────────

export interface PaymentConfirmationStepProps {
    customer: Customer;
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
}
export function PaymentConfirmationStep(p: PaymentConfirmationStepProps) {
    return (
        <div className="flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
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

                <div className="flex flex-col gap-4">
                    <p className="text-[18px] font-semibold text-[#101828]">Payment method</p>
                    <div className="grid grid-cols-2 gap-4">
                        <PaymentMethodCard
                            selected={p.paymentMethod === "cash"}
                            onSelect={() => p.setPaymentMethod("cash")}
                            title="Cash" subtitle="Payment via cash"
                            icon={<BankNote01 className="w-4 h-4 text-[#475467]" />}
                        />
                        <PaymentMethodCard
                            selected={p.paymentMethod === "card"}
                            onSelect={() => p.setPaymentMethod("card")}
                            title="Card on file" subtitle="Payment via card"
                            icon={<CreditCard01 className="w-4 h-4 text-[#475467]" />}
                        />
                        <PaymentMethodCard
                            selected={p.paymentMethod === "applepay"}
                            onSelect={() => p.setPaymentMethod("applepay")}
                            title="Apple Pay" subtitle="Payment via Apple Pay"
                            icon={<AppleLogo />}
                        />
                    </div>
                </div>

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

            <div className="shrink-0 px-6 py-4 flex justify-end">
                <Button variant="primary" size="lg" disabled={!p.canConfirm} onClick={p.onConfirm}>
                    Confirm purchase
                </Button>
            </div>
        </div>
    );
}

function PaymentInformation({ customer, items, subtotal, discountPercent, discountAmount, promoCode, taxRate, taxAmount, total }: {
    customer: Customer;
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

            <p className="text-[14px] font-medium text-[#101828]">Detail product</p>
            <div className="flex flex-col gap-3">
                {items.map(it => (
                    <div key={it.productId} className="flex items-center gap-3">
                        <ProductIcon type={it.productType} />
                        <div className="flex-1 flex flex-col gap-1">
                            <p className="text-[14px] font-medium text-[#101828]">{it.name}</p>
                            <p className="text-[14px] text-[#658774]">AED {it.unitPrice.toLocaleString()}</p>
                        </div>
                        <p className="text-[14px] font-medium text-[#101828] whitespace-nowrap">{it.quantity}x</p>
                    </div>
                ))}
            </div>

            <div className="h-px w-full bg-[#e4e7ec]" />

            <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <p className="text-[14px] text-[#667085]">Subtotal</p>
                    <p className="text-[16px] font-medium text-[#101828]">AED {subtotal.toLocaleString()}</p>
                </div>
                {discountAmount > 0 && (
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
                {/* Tax row only renders when a product carries a tax rate.
                    Default is 0 (per-product tax ships with the Tax settings
                    module / PRD 11) so this is hidden today. */}
                {taxRate > 0 && (
                    <div className="flex items-center justify-between">
                        <p className="text-[14px] text-[#667085]">Tax rate (<span className="font-medium text-[#101828]">{taxRate}%</span>)</p>
                        <p className="text-[16px] font-medium text-[#101828]">AED {taxAmount.toLocaleString()}</p>
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <p className="text-[14px] font-semibold text-[#101828]">Total</p>
                    <p className="text-[16px] font-semibold text-[#101828]">AED {total.toLocaleString()}</p>
                </div>
            </div>
        </div>
    );
}

function ProductIcon({ type }: { type: PurchaseLineItem["productType"] }) {
    const tint =
        type === "membership" ? { bg: "bg-[#e0eaff]", color: "text-[#3538cd]" } :
        type === "package"    ? { bg: "bg-[#c4edd6]", color: "text-[#658774]" } :
                                 { bg: "bg-[#e0f9f4]", color: "text-[#4b8c9a]" };
    const Icon = type === "membership" ? CreditCard02 : type === "package" ? Package : Gift01;
    return (
        <div className={cn("w-10 h-10 rounded-[8px] flex items-center justify-center shrink-0", tint.bg)}>
            <Icon className={cn("w-5 h-5", tint.color)} />
        </div>
    );
}

function PaymentMethodCard({ selected, onSelect, title, subtitle, icon }: {
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
export function ProcessingPaymentCard({ method, chargedTo }: { method: PaymentMethod; chargedTo: string }) {
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

export interface ReceiptStepProps {
    receiptNumber: string;
    transactionId: string;
    customer: Customer;
    items: PurchaseLineItem[];
    subtotal: number; discountPercent: number; discountAmount: number;
    promoCode?: string;
    taxRate: number; taxAmount: number; total: number;
    paymentMethodLabel: string;
    chargedTo: string;
    onBack: () => void;
    onComplete: () => void;
}

export function ReceiptStep(p: ReceiptStepProps) {
    const dateLabel = useMemo(() => {
        const d = new Date();
        return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
    }, []);

    return (
        <div className="flex-1 min-h-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-6">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] px-6 pt-6 pb-6 flex flex-col gap-5 relative shrink-0 overflow-hidden">
                    <ReceiptHeaderDecoration />

                    <div className="relative flex flex-col items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-[0_0_0_4px_rgba(123,160,140,0.3),0_0_0_12px_rgba(123,160,140,0.1)]">
                            <CheckCircle className="w-7 h-7 text-[#658774]" />
                        </div>
                        <p className="text-[18px] font-semibold text-[#101828] text-center">Transaction complete</p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <ReceiptRow label="Receipt" value={`#${p.receiptNumber}`} />
                        <ReceiptRow label="Customer" value={`${p.customer.firstName} ${p.customer.lastName}`} />
                        <ReceiptRow label="Date" value={dateLabel} />
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-3">
                        <p className="text-[14px] font-medium text-[#101828]">Detail product</p>
                        {p.items.map(it => (
                            <div key={it.productId} className="flex items-center gap-3">
                                <ProductIcon type={it.productType} />
                                <div className="flex-1 flex flex-col gap-1">
                                    <p className="text-[14px] font-medium text-[#101828]">{it.name}</p>
                                    <p className="text-[14px] text-[#658774]">AED {it.unitPrice.toLocaleString()}</p>
                                </div>
                                <p className="text-[14px] font-medium text-[#101828] whitespace-nowrap">{it.quantity}x</p>
                            </div>
                        ))}
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-2">
                        <p className="text-[14px] font-medium text-[#101828]">Detail payment</p>
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] text-[#667085]">Subtotal</p>
                            <p className="text-[16px] font-medium text-[#101828]">AED {p.subtotal.toLocaleString()}</p>
                        </div>
                        {p.discountAmount > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[#667085]">
                                    {p.promoCode
                                        ? <>Promo code (<span className="font-medium text-[#101828]">{p.promoCode}</span>)</>
                                        : <>Discount (<span className="font-medium text-[#101828]">{p.discountPercent}%</span>)</>
                                    }
                                </p>
                                <p className="text-[16px] font-medium text-[#d92d20]">-AED {p.discountAmount.toLocaleString()}</p>
                            </div>
                        )}
                        {/* Tax row hidden until a product carries a tax rate
                            (Tax settings module / PRD 11 will set per-product
                            rates). Default taxRate=0 keeps it off everywhere. */}
                        {p.taxRate > 0 && (
                            <div className="flex items-center justify-between">
                                <p className="text-[14px] text-[#667085]">Tax rate (<span className="font-medium text-[#101828]">{p.taxRate}%</span>)</p>
                                <p className="text-[16px] font-medium text-[#101828]">AED {p.taxAmount.toLocaleString()}</p>
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <p className="text-[14px] font-semibold text-[#101828]">Total</p>
                            <p className="text-[16px] font-semibold text-[#101828]">AED {p.total.toLocaleString()}</p>
                        </div>
                    </div>
                    <div className="h-px w-full bg-[#e4e7ec]" />

                    <div className="flex flex-col gap-3">
                        <p className="text-[14px] font-medium text-[#101828]">Payment method</p>
                        <div className="flex flex-col gap-2">
                            <ReceiptRow label="Method" value={p.paymentMethodLabel} />
                            <ReceiptRow label="Charged to" value={p.chargedTo} />
                            <ReceiptRow label="Transaction ID" value={p.transactionId} />
                            <ReceiptRow label="Status" value="Approved" valueClass="text-[#079455]" />
                        </div>
                    </div>
                </div>

                <div className="bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] flex items-center gap-4 p-4">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0" />
                    <p className="text-[14px] text-[#475467]">This receipt will be automatically sent to the customer via email and SMS.</p>
                </div>
            </div>

            <div className="shrink-0 px-6 py-4 border-[#e4e7ec] flex items-center justify-between">
                <Button variant="secondary-gray" size="lg" onClick={p.onBack}>Back</Button>
                <Button variant="primary" size="lg" onClick={p.onComplete}>Complete transaction</Button>
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

function ReceiptHeaderDecoration() {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[inherit]">
            <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[#7ba08c]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[#7ba08c]" />
            </div>
            <div className="absolute right-0 top-0 translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] opacity-[0.05]">
                <div className="absolute inset-0 rounded-full border-[8px] border-[#7ba08c]" />
                <div className="absolute inset-[60px] rounded-full border-[8px] border-[#7ba08c]" />
            </div>
        </div>
    );
}

// ─── Shared helpers exported for both entry points ──────────────────────────

/** Resolve the payment-method label + charge target string shown on the receipt. */
export function describePayment(paymentMethod: PaymentMethod | null, selectedCardId: string | null, cashReceivedNum: number): { label: string; chargedTo: string } {
    const label =
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
    return { label, chargedTo };
}

/** Cart-line math used by both step 1 and step 2 of either checkout entry point.
 *  `promoDiscountAed` is an optional flat AED promo discount applied ON TOP of
 *  the custom-discount percentage. Promo + custom discount are mutually
 *  exclusive in the POS UI, but the math handles both being present and caps
 *  the combined discount at the subtotal. */
export function computeTotals(items: PurchaseLineItem[], discountPercent: number, promoDiscountAed = 0) {
    const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const pctDiscount = Math.round(subtotal * (discountPercent / 100));
    const discountAmount = Math.min(subtotal, pctDiscount + Math.round(promoDiscountAed));
    // Tax defaults to 0 — per-product tax rates ship with the Tax settings
    // module (PRD 11). Until then we display no tax row anywhere.
    const taxRate = 0;
    const taxAmount = Math.round((subtotal - discountAmount) * (taxRate / 100));
    const total = subtotal - discountAmount + taxAmount;
    return { subtotal, discountAmount, taxRate, taxAmount, total };
}
