"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Gift Card Information (`/customer/products/gift-card/[designId]`) — Figma 2452-33549
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached from a gift card's "+" on the catalog. Collects the recipient, the
// amount (custom designs only — validated against the design's min/max), and an
// optional message, then adds the configured gift card to the cart (non-exclusive)
// and returns to the catalog + Floating Cart.

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { ChevronLeft, ChevronSelectorVertical } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable, useMainScrolled } from "@/lib/customer/use-scrollable";
import { addGiftCardToCart, ensurePurchaseCart, type PlanRow } from "@/lib/customer/purchase";
import { Button } from "@/components/ui/button";

const MSG_MAX = 120;

function fmtLong(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Base field (no focus border — applied conditionally so the error border wins).
const FIELD =
    "w-full rounded-lg border bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none placeholder:text-[#667085]";
const FIELD_OK = "border-[#d0d5dd] focus:border-[var(--brand-primary)]";
const FIELD_ERR = "border-[#fda29b] focus:border-[#fda29b]";

export default function GiftCardInfoPage() {
    const router = useRouter();
    const goBack = useCustomerBack("/customer/products");
    const { designId } = useParams<{ designId: string }>();
    const giftCardDesigns = useAppStore((s) => s.giftCardDesigns);
    const customers = useAppStore((s) => s.customers);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();
    const scrollable = useMainScrollable();

    ensurePurchaseCart("products");
    const design = giftCardDesigns.find((g) => g.id === designId && g.status === "active");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [message, setMessage] = useState("");

    function Back() {
        return (
            <button
                type="button"
                onClick={goBack}
                aria-label="Back"
                className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
            >
                <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
            </button>
        );
    }

    if (!design) {
        return (
            <div className="flex min-h-full flex-col">
                <header className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3">
                    <Back />
                </header>
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                    <p className="text-sm text-[#475467]">This gift card is no longer available.</p>
                </div>
            </div>
        );
    }

    const isCustom = design.value_type === "custom";
    const min = design.min_value_aed ?? 0;
    const max = design.max_value_aed ?? 0;
    const fixed = design.fixed_value_aed ?? design.price_aed ?? 0;
    const amountNum = Number(amount);
    const amountValid =
        !isCustom || (amount.trim() !== "" && Number.isFinite(amountNum) && amountNum >= min && amountNum <= max);
    const amountError = isCustom && amount.trim() !== "" && !amountValid;

    // Recipient must be an existing customer. Validate reactively once BOTH fields
    // are filled — the error surfaces immediately (not on Confirm), and Confirm
    // stays disabled until a real recipient is matched.
    const recipient = customers.find((c) => c.email.trim().toLowerCase() === email.trim().toLowerCase());
    const bothFilled = name.trim() !== "" && email.trim() !== "";
    const recipientError = bothFilled && !recipient;
    const valid = bothFilled && !!recipient && amountValid;

    function confirm() {
        if (!valid || !design || !recipient) return;
        const face = isCustom ? amountNum : fixed;
        const validLabel = design.no_expiry ? "No expiry" : `Valid until ${fmtLong(design.valid_until_date)}`;
        const row: PlanRow = {
            id: design.id,
            kind: "gift_card",
            name: design.name,
            sub: validLabel,
            price: face,
            giftCard: {
                valueType: design.value_type,
                fixedValue: design.fixed_value_aed,
                minValue: design.min_value_aed,
                maxValue: design.max_value_aed,
                validLabel,
            },
        };
        addGiftCardToCart(row, {
            amount: face,
            recipientName: name.trim(),
            recipientEmail: email.trim(),
            message: message.trim() || undefined,
        });
        showToast("Added to cart", `${design.name} added to your cart.`, "success", "check");
        router.push("/customer/products");
    }

    return (
        <div className="flex min-h-full flex-col">
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <Back />
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Gift card information
                </p>
                <span aria-hidden className="size-10 shrink-0" />
            </header>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-2">
                {/* Recipient name */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">Recipient name</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Recipient name…"
                        className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`}
                    />
                </div>

                {/* Recipient email */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">Recipient email</label>
                    <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        type="email"
                        placeholder="Recipient email…"
                        className={`${FIELD} ${recipientError ? FIELD_ERR : FIELD_OK}`}
                    />
                    {recipientError && (
                        <p className="text-sm font-normal leading-5 text-[#b42318]">
                            We couldn&apos;t find a customer with this name and email.
                        </p>
                    )}
                </div>

                {/* Amount — custom designs only */}
                {isCustom && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium leading-5 text-[#344054]">Amount</label>
                        <div className="relative">
                            <input
                                value={amount}
                                onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
                                inputMode="numeric"
                                placeholder="AED gift card amount"
                                className={`${FIELD} pr-10 ${amountError ? FIELD_ERR : FIELD_OK}`}
                            />
                            <ChevronSelectorVertical
                                className="pointer-events-none absolute right-3 top-1/2 size-5 -translate-y-1/2 text-[#667085]"
                                aria-hidden
                            />
                        </div>
                        <p className={`text-sm font-normal leading-5 ${amountError ? "text-[#b42318]" : "text-[#475467]"}`}>
                            Enter an amount between AED {min} and AED {max}
                        </p>
                    </div>
                )}

                {/* Personal message */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium leading-5 text-[#344054]">
                        Add personal message <span className="font-normal text-[#667085]">(optional)</span>
                    </label>
                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value.slice(0, MSG_MAX))}
                        rows={4}
                        placeholder="e.g Happy birthday Paula! Enjoy your classes 🎉"
                        className={`${FIELD} resize-none`}
                    />
                    <p className="text-sm font-normal leading-5 text-[#667085]">
                        {message.length}/{MSG_MAX}
                    </p>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="primary"
                    size="xl"
                    disabled={!valid}
                    className="w-full rounded-full"
                    onClick={confirm}
                >
                    Confirm
                </Button>
            </div>
        </div>
    );
}
