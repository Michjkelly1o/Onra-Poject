"use client";

// Customer — "Refund details" section for a CANCELLED booking detail.
// Shown under Location on the class + appointment booking detail pages so the
// customer can always see the cancellation outcome: whether a credit (class) or
// money (appointment) was returned, how much, and — for currency — the refund
// method ("Refund via"). Reused across both booking kinds. A leading divider
// separates it from the Location section above, matching every other section
// break on the shared detail layout.

export interface RefundLine {
    label: string;
    value: string;
    tone?: "default" | "success" | "muted";
}

export function RefundDetailsSection({ lines }: { lines: RefundLine[] }) {
    return (
        <>
            <div className="h-px w-full bg-[#e4e7ec]" />
            <section className="flex flex-col gap-3">
                <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">Refund details</h2>
                <div className="flex flex-col gap-2 text-sm leading-5">
                    {lines.map((l, i) => (
                        <div key={i} className="flex items-center justify-between gap-4">
                            <span className="font-normal text-[#475467]">{l.label}</span>
                            <span
                                className={`text-right font-medium ${
                                    l.tone === "success"
                                        ? "text-[var(--brand-primary)]"
                                        : l.tone === "muted"
                                          ? "text-[#667085]"
                                          : "text-[var(--brand-text)]"
                                }`}
                            >
                                {l.value}
                            </span>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
