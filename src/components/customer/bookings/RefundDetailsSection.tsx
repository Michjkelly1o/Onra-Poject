"use client";

// Customer — "Refund details" section for a CANCELLED booking detail.
// Shown under Location on the class + appointment booking detail pages so the
// customer can always see the cancellation outcome: whether a credit (class) or
// money (appointment) was returned, how much, and — for currency — the refund
// method ("Refund via"). Reused across both booking kinds.

export interface RefundLine {
    label: string;
    value: string;
    tone?: "default" | "success" | "muted";
}

export function RefundDetailsSection({ lines }: { lines: RefundLine[] }) {
    return (
        <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold leading-6 text-[#101828]">Refund details</h2>
            <div className="flex flex-col gap-2 rounded-2xl border border-[#e4e7ec] bg-[#f9fafb] p-4 text-sm leading-5">
                {lines.map((l, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                        <span className="font-normal text-[#475467]">{l.label}</span>
                        <span
                            className={`text-right font-medium ${
                                l.tone === "success"
                                    ? "text-[#067647]"
                                    : l.tone === "muted"
                                      ? "text-[#667085]"
                                      : "text-[#101828]"
                            }`}
                        >
                            {l.value}
                        </span>
                    </div>
                ))}
            </div>
        </section>
    );
}
