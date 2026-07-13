"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { addCard, consumeScan, detectBrand } from "@/lib/customer/payment-methods";
import { CardForm, type CardFormData } from "@/components/customer/profile/CardForm";

function parseExp(expiry: string): { expMonth: number; expYear: number } {
    const [mm, yy] = expiry.split("/").map((s) => s.trim());
    return { expMonth: Number(mm) || 1, expYear: 2000 + (Number(yy) || 0) };
}

export default function AddCardPage() {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    // If we arrived from the scan flow, prefill with the scanned demo card.
    const [scanned] = useState(() => consumeScan());
    const initial: Partial<CardFormData> | undefined = scanned
        ? { holder: "Kelly M", number: "1234567890000000", expiry: "12 / 29", cvv: "124" }
        : undefined;

    function submit(d: CardFormData) {
        const digits = d.number.replace(/\D/g, "");
        const { expMonth, expYear } = parseExp(d.expiry);
        addCard({
            brand: detectBrand(digits),
            last4: digits.slice(-4),
            number: digits,
            holder: d.holder.trim(),
            expMonth,
            expYear,
        });
        showToast("Payment method has been added", "New payment method has been added, now you can start buy product.", "success");
        router.replace("/customer/profile/payment-methods");
    }

    return <CardForm title="Add payment method" submitLabel="Add card" initial={initial} onSubmit={submit} />;
}
