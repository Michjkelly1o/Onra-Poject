"use client";

// Customer — the "Book to" + "Payment detail" pair shown on every booking detail
// (class + appointment, Myself + Guest). Kept in one component so the two sections
// always render together, in the same order, with the same dividers wherever a
// booking is shown.
//
//   • Book to — an avatar + name (+ email) card. "You" for a self booking, the
//     guest's name + email with a "Guest" badge for a guest booking (mirrors the
//     Review & Book guest row).
//   • Payment detail — the booked item's NAME as the amount row label
//     ("Mat Pilates .......... 1 credit"), then "Pay with" (always a real method
//     or plan — never "—").

/** Refund breakdown folded into Payment detail for a cancelled booking. */
export type BookingRefund = {
    /** Amount returned — "1 credit" / "AED 170" / "0 credit". */
    amount: string;
    /** Outcome line — "Returned to your account" / "Not returned — …". */
    status: string;
};

export function BookingDetailSections({
    name,
    email,
    isGuest = false,
    initial,
    imageUrl,
    amount,
    payWith,
    refund,
}: {
    /** Who the booking is for — the member's name, or the guest's name. */
    name: string;
    email?: string;
    /** Guest booking → "Guest" badge + fallback avatar; else a "You" badge. */
    isGuest?: boolean;
    /** Avatar letter override (member initials); defaults to the name's first char. */
    initial?: string;
    /** Real avatar photo (the member's portrait) — matches the Review & Book card;
     *  falls back to the initials tile when absent (guests have no photo). */
    imageUrl?: string;
    /** Amount paid — "1 credit" / "AED 170" / "—". */
    amount: string;
    /** Selected payment method or plan — always a real value, never "—". */
    payWith: string;
    /** Present for a cancelled booking → refund rows fold into Payment detail. */
    refund?: BookingRefund | null;
}) {
    const av = ((initial ?? name.trim().slice(0, 1)).toUpperCase() || (isGuest ? "G" : "Y")).slice(0, 2);

    return (
        <>
            {/* ── Book to ─────────────────────────────────────────── */}
            <div className="h-px w-full bg-[#e4e7ec]" />
            <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Book to</h2>
                <div className="flex items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4">
                    {/* Real portrait when we have one (self booking), else the
                        initials tile — identical to the Review & Book guest/self card. */}
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7] text-sm font-semibold text-[#667085]">
                        {imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={imageUrl} alt="" className="size-full object-cover" />
                        ) : (
                            av
                        )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{name}</span>
                        {email && <span className="truncate text-sm font-normal leading-5 text-[#475467]">{email}</span>}
                    </div>
                    <span className="shrink-0 rounded-full border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 text-xs font-medium text-[#475467]">
                        {isGuest ? "Guest" : "You"}
                    </span>
                </div>
            </section>

            {/* ── Payment detail ──────────────────────────────────── */}
            <PaymentDetailSection amount={amount} payWith={payWith} refund={refund} />
        </>
    );
}

function PayRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <span className="shrink-0 font-normal text-[#475467]">{label}</span>
            {/* Every value uses the same primary text color for a consistent column. */}
            <span className="min-w-0 truncate text-right font-medium text-[var(--brand-text)]">{value}</span>
        </div>
    );
}

/** The "Payment detail" section — a leading divider + heading + rows. A live
 *  booking shows "You've paid" + "Pay with"; a cancelled booking folds the refund
 *  breakdown into the SAME section (You've paid · Your refund · Pay with · Status)
 *  so there's no separate Refund detail section. */
export function PaymentDetailSection({ amount, payWith, refund }: {
    /** Amount paid — "1 credit" / "AED 170". */
    amount: string;
    /** Always a real method — never "—" when a payment option was chosen. */
    payWith: string;
    /** Present for a cancelled booking → adds "Your refund" + "Status" rows. */
    refund?: BookingRefund | null;
}) {
    return (
        <>
            <div className="h-px w-full bg-[#e4e7ec]" />
            <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Payment detail</h2>
                <div className="flex flex-col gap-2 text-sm leading-5">
                    <PayRow label="You've paid" value={amount} />
                    {refund && <PayRow label="Your refund" value={refund.amount} />}
                    <PayRow label="Pay with" value={payWith} />
                    {refund && <PayRow label="Status" value={refund.status} />}
                </div>
            </section>
        </>
    );
}
