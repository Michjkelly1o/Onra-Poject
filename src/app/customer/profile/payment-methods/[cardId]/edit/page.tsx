"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { detectBrand, removeCard, updateCard, usePaymentMethods } from "@/lib/customer/payment-methods";
import { CardForm, type CardFormData } from "@/components/customer/profile/CardForm";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

const LIST = "/customer/profile/payment-methods";

function parseExp(expiry: string): { expMonth: number; expYear: number } {
    const [mm, yy] = expiry.split("/").map((s) => s.trim());
    return { expMonth: Number(mm) || 1, expYear: 2000 + (Number(yy) || 0) };
}

export default function EditCardPage() {
    const router = useRouter();
    const { cardId } = useParams<{ cardId: string }>();
    const { cards } = usePaymentMethods();
    const member = useCurrentCustomer();
    const showToast = useAppStore((s) => s.showToast);
    const [sheetOpen, setSheetOpen] = useState(false);

    const card = cards.find((c) => c.id === cardId);
    // A membership with recurring payments needs at least one card on file.
    const blocked = cards.length <= 1 && member?.planKind === "membership";

    if (!card) {
        return (
            <div className="flex min-h-full items-center justify-center px-6 text-center">
                <p className="text-base leading-6 text-[#475467]">This card is no longer available.</p>
            </div>
        );
    }

    function submit(d: CardFormData) {
        if (!card) return;
        const digits = d.number.replace(/\D/g, "");
        const { expMonth, expYear } = parseExp(d.expiry);
        updateCard(card.id, {
            brand: detectBrand(digits),
            last4: digits.slice(-4),
            number: digits,
            holder: d.holder.trim(),
            expMonth,
            expYear,
        });
        showToast("Card updated", "All changes has been saved.", "success");
        router.replace(LIST);
    }
    function confirmDelete() {
        if (!card) return;
        removeCard(card.id);
        showToast("Payment method has been removed", "Payment method successfully removed and no longer be use.", "success", "trash");
        router.replace(LIST);
    }

    const initial: Partial<CardFormData> = {
        holder: card.holder,
        number: card.number ?? card.last4,
        expiry: `${String(card.expMonth).padStart(2, "0")} / ${String(card.expYear).slice(-2)}`,
        cvv: "",
    };

    return (
        <>
            <CardForm
                title="Edit payment method"
                submitLabel="Save changes"
                initial={initial}
                onSubmit={submit}
                onDelete={() => setSheetOpen(true)}
            />

            <CustomerSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
                {blocked ? (
                    <>
                        <SheetToolbar title="" onClose={() => setSheetOpen(false)} />
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-[#f2f4f7]">
                                <Trash01 className="size-6 text-[#667085]" aria-hidden />
                            </div>
                            <div>
                                <p className="text-lg font-semibold leading-7 text-[var(--brand-text)]">You can&apos;t delete this payment method</p>
                                <p className="mt-1 text-sm leading-5 text-[#475467]">
                                    Your membership has recurring payments. Please add a new card before removing this one.
                                </p>
                            </div>
                            <Button
                                variant="secondary-gray"
                                size="xl"
                                className="mt-1 w-full rounded-full"
                                onClick={() => {
                                    setSheetOpen(false);
                                    router.push(`${LIST}/new`);
                                }}
                            >
                                Add new card
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <SheetToolbar title="" onClose={() => setSheetOpen(false)} />
                        <div className="flex flex-col items-center gap-4 text-center">
                            <div className="flex size-12 items-center justify-center rounded-full bg-[#fee4e2]">
                                <Trash01 className="size-6 text-[#d92d20]" aria-hidden />
                            </div>
                            <div>
                                <p className="text-lg font-semibold leading-7 text-[var(--brand-text)]">Delete this payment method?</p>
                                <p className="mt-1 text-sm leading-5 text-[#475467]">
                                    This will remove all of the payment information and no longer can be use.
                                </p>
                            </div>
                            <Button variant="destructive-secondary" size="xl" className="mt-1 w-full rounded-full" onClick={confirmDelete}>
                                Delete
                            </Button>
                        </div>
                    </>
                )}
            </CustomerSheet>
        </>
    );
}
