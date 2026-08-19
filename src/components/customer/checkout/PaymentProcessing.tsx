"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — PaymentProcessing (shared) — Figma 3298-70428 / 3160-46725
// ─────────────────────────────────────────────────────────────────────────────
//
// Transient loader (booking-processing pattern, payment copy). Applies the
// purchase once on mount, snapshots the order for the success screen, clears the
// cart, then routes to `successHref`. Origin-agnostic (the caller passes the cart
// origin id + the success route).

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppStore, walletBalanceAed } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import {
    abbrevSize,
    cartCount,
    cartTotal,
    computeTotals,
    ensurePurchaseCart,
    lastOrder,
    purchaseCart,
    retailCartBranchId,
    useStandardVatPct,
    usePricesIncludeTax,
    usePromo,
} from "@/lib/customer/purchase";
import { addPaymentRecord, methodKind } from "@/lib/customer/payment-history";
import { spendGiftCards } from "@/lib/customer/gift-cards";

const STEPS = ["Processing payment", "Securing your payment", "Confirming your purchase"];
const STEP_MS = 900;

function StepLine({ text, variant }: { text: string; variant: "done" | "active" | "next" }) {
    if (variant === "active") {
        return <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">{text}</p>;
    }
    return (
        <p className={`text-base font-semibold leading-6 text-[var(--colors-text-secondary)] ${variant === "done" ? "opacity-30" : "opacity-10"}`}>
            {text || " "}
        </p>
    );
}

function Processing({ originId, successHref, method: methodProp, onDone }: { originId: string; successHref?: string; method?: string; onDone?: () => void }) {
    const router = useRouter();
    const search = useSearchParams();
    const method = methodProp ?? search.get("method") ?? "Apple pay";

    const { member, selectedBranchId } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const applyPurchase = useAppStore((s) => s.applyPurchase);
    // Live wallet balance drives the "Redeem Account Credit" toggle. Reading
    // it once at mount is sufficient — the write is a one-shot on mount.
    // NOTE: no separate `debitWallet` selector — `applyPurchase` handles the
    // debit in the same tick when we pass the credit as its 5th arg (Jul 2026
    // merge — friend's version imported `debitWallet` for a manual debit call
    // that has been dropped to prevent double-debiting the wallet).
    const walletTxns = useAppStore((s) => s.walletTransactions);
    const promo = usePromo(purchaseCart.promoId);
    const vatPct = useStandardVatPct();
    const inclusive = usePricesIncludeTax();
    const [step, setStep] = useState(0);
    const wroteRef = useRef(false);

    ensurePurchaseCart(originId);

    useEffect(() => {
        if (!wroteRef.current && member && purchaseCart.items.length > 0) {
            wroteRef.current = true;

            const items = purchaseCart.items;
            const totalItems = cartCount();
            // Account Credit applied (order: subtotal → tax → discount → credit).
            // The store's `applyPurchase` (5th arg below) also debits the
            // wallet ledger + stamps the credit on the transaction so a later
            // refund can restore it — no separate `debitWallet` call needed.
            const balance = walletBalanceAed(walletTxns, member.id);
            const totals = computeTotals(cartTotal(), promo, vatPct, purchaseCart.redeemAccountCredit ? balance : 0, inclusive);
            const kinds = Array.from(new Set(items.map((it) => it.kind)));

            // Snapshot the shared txn ids so we can link the ones applyPurchase
            // is about to create to the local Payment-history record (dedupe).
            const txnIdsBefore = new Set(useAppStore.getState().customerTransactions.map((t) => t.id));

            applyPurchase(
                member.id,
                items.map((it) => ({
                    productId: it.id,
                    productType: it.kind,
                    name: it.name,
                    unitPrice: it.price,
                    quantity: it.quantity,
                    size: it.size,
                })),
                // Member self-checkout in the app → tag the origin as the
                // customer portal (not the front-desk POS). Self-service sales
                // stay unattributed, so no staff earns commission on them.
                "customer_portal",
                undefined,
                totals.accountCredit > 0 ? totals.accountCredit : undefined,
                // Retail is collected in person → decrement stock + stamp the
                // transaction at the pickup branch the shopper bought from (all
                // retail in one invoice shares it), NOT the buyer's home branch,
                // so the Admin retail stock + purchase history stay accurate.
                retailCartBranchId() ?? undefined,
                undefined,
                // Applied promo → records the redemption (stamps the txn +
                // bumps usage_count) so the customer-side sale reflects in the
                // Promo Redemptions report exactly like a POS redemption.
                promo ? { code: promo.code, discountAed: totals.discount } : undefined,
                // Original payment source, mapped from the checkout method label
                // so a later refund goes back to it. Gift-card / other-card fall
                // back to "card" (gift-card spend is tracked separately above).
                method.toLowerCase().includes("apple") ? "applepay"
                    : method.toLowerCase().includes("google") ? "googlepay"
                    : method.toLowerCase().includes("cash") ? "cash"
                    : method.toLowerCase().includes("bank") ? "banktransfer"
                    : "card",
            );

            // The store txns applyPurchase just created (one per line) — linked
            // onto the local record so the merged history lists the order once.
            const newTxnIds = useAppStore
                .getState()
                .customerTransactions.filter((t) => !txnIdsBefore.has(t.id))
                .map((t) => t.id);

            const now = new Date();
            // Keep the size on the receipt for sized retail so the invoice never
            // loses that detail (e.g. "Onra Studio Tank · Size S").
            const orderLines = items.map((it) => ({
                name: it.kind === "retail" && it.size ? `${it.name} · Size ${abbrevSize(it.size)}` : it.name,
                quantity: it.quantity,
                price: it.price,
            }));
            const txnId = `#P${Math.floor(100000000 + Math.random() * 900000000)}`;
            // Retail is collected in person → capture the pickup branch name so
            // the success screen can tell the shopper where to collect.
            const pickupBranchName = kinds.includes("retail")
                ? branches.find((b) => b.id === selectedBranchId)?.name ?? ""
                : "";
            lastOrder.value = {
                ...totals,
                totalItems,
                method,
                kinds,
                pickupBranchName,
                items: orderLines,
                txnId,
                dateLabel: now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
                timeLabel: now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }),
            };

            // Gift card — client 2026-07-31. The "Forma gift card" payment
            // method used to select fine and complete the order while
            // NOTHING debited the balance, so a card could be spent
            // forever. Now the paid total is deducted from the customer's
            // redeemed cards (oldest-expiry first, partial redemption
            // supported). Only fires when the customer actually chose the
            // gift-card method — any other method leaves the balance alone.
            if (method.toLowerCase().includes("gift") && totals.total > 0) {
                // Real issued cards debit through the store (admin balances
                // reflect); the local demo cards cover any remainder.
                spendGiftCards(member.id, totals.total);
            }

            // NOTE: `applyPurchase` above already debited the wallet ledger
            // (with `referenceType: "pos_sale"` on the same tick) and stamped
            // `accountCreditAppliedAed` on the first sale transaction, so a
            // later refund can restore it. Do NOT add a separate
            // `debitWallet` call here — it would double-debit the balance.

            // Record the payment in the customer's Payment history (Products flow).
            const pad = (n: number) => String(n).padStart(2, "0");
            addPaymentRecord({
                type: "products",
                method: methodKind(method),
                methodLabel: method,
                amount: totals.total,
                status: "success",
                dateISO: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
                timeLabel: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
                txnId,
                items: orderLines,
                totalItems,
                subtotal: totals.subtotal,
                discount: totals.discount,
                tax: totals.tax,
                accountCredit: totals.accountCredit,
                txnStoreIds: newTxnIds,
            });

            purchaseCart.classId = null;
            purchaseCart.items = [];
            purchaseCart.promoId = null;
            purchaseCart.redeemAccountCredit = false;
        }

        const t1 = setTimeout(() => setStep(1), STEP_MS);
        const t2 = setTimeout(() => setStep(2), STEP_MS * 2);
        // In-sheet host handles the "done" transition (slide back); otherwise
        // navigate to the standalone success route.
        const t3 = setTimeout(() => (onDone ? onDone() : successHref && router.replace(successHref)), STEP_MS * 3);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-12 px-4">
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[var(--brand-primary)]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>

            <div className="flex w-[343px] max-w-full flex-col items-center gap-4 text-center">
                <StepLine text={step > 0 ? STEPS[step - 1] : ""} variant={step > 0 ? "done" : "next"} />
                <StepLine text={STEPS[step]} variant="active" />
                <StepLine text={STEPS[step + 1] ?? ""} variant="next" />
                <StepLine text={STEPS[step + 2] ?? ""} variant="next" />
            </div>
        </div>
    );
}

export function PaymentProcessing({ originId, successHref, method, onDone }: { originId: string; successHref?: string; method?: string; onDone?: () => void }) {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <Processing originId={originId} successHref={successHref} method={method} onDone={onDone} />
        </Suspense>
    );
}
