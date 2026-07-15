"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — WalletBalanceCard — the account-credit hero card
// ─────────────────────────────────────────────────────────────────────────────
//
// A rich dark-green brand card (deliberately distinct from the light-wash gift
// card): the Forma lockup, a show/hide toggle, the "Wallet balance" label and
// the derived AED balance, with decorative concentric arcs + a soft mint glow.

import { Eye, EyeOff } from "@untitledui/icons";

export function WalletBalanceCard({
    balance,
    hidden,
    onToggle,
}: {
    balance: number;
    hidden: boolean;
    onToggle: () => void;
}) {
    return (
        <div
            className="relative aspect-[335/190] w-full overflow-hidden rounded-2xl shadow-[0px_10px_28px_-10px_rgba(51,71,60,0.55)]"
            style={{ backgroundImage: "linear-gradient(145deg, #6f9481 0%, #4a6455 52%, #30443a 100%)" }}
        >
            {/* Decorative concentric arcs (top-right) */}
            <svg
                aria-hidden
                viewBox="0 0 320 320"
                className="pointer-events-none absolute -right-16 -top-24 size-[320px] text-white/10"
            >
                {[160, 124, 88, 52].map((r) => (
                    <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="currentColor" strokeWidth="1.5" />
                ))}
            </svg>
            {/* Soft mint glow (bottom-left) */}
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-16 -left-10 size-40 rounded-full opacity-25 blur-2xl"
                style={{ background: "#c4edd6" }}
            />

            {/* Top row — Forma lockup + show/hide toggle */}
            <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
                <div className="flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/pay/forma-logomark.svg" alt="" className="h-6 w-5 shrink-0 brightness-0 invert" />
                    <span className="text-base font-semibold leading-6 text-white">Forma</span>
                </div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={hidden ? "Show balance" : "Hide balance"}
                    className="flex size-9 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors active:bg-white/25"
                >
                    {hidden ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
            </div>

            {/* Bottom — label + balance + credit chip */}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5">
                <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-sm font-normal leading-5 text-white/70">Wallet balance</p>
                    <p className="truncate text-[28px] font-semibold leading-9 text-white">
                        {hidden ? "AED ••••••" : `AED ${balance.toLocaleString("en-US")}`}
                    </p>
                </div>
                <span className="mb-0.5 shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-medium leading-[18px] text-white backdrop-blur-sm">
                    Account credit
                </span>
            </div>
        </div>
    );
}
