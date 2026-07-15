"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Wallet (`/customer/profile/wallet`)
// ─────────────────────────────────────────────────────────────────────────────
//
// The customer's account-credit (AED) wallet: a Forma balance card (reusing the
// gift-card art) + the credit/debit ledger grouped by month. Read from the same
// admin `walletTransactions` ledger the Customer-detail Wallet tab + POS Member
// Wallet use; the balance is DERIVED (`walletBalanceAed`), never stored. A level-2
// profile page (back → Profile, no bottom nav). View-only — credit is added by
// staff (referral rewards, manual grants, refunds → wallet).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BankNote01, ChevronLeft, CoinsHand, Gift01, RefreshCcw01 } from "@untitledui/icons";
import type { ComponentType, SVGProps } from "react";
import { useAppStore, walletBalanceAed, type WalletTransaction } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useIsAuthenticated } from "@/lib/customer/auth";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { WalletBalanceCard } from "@/components/customer/profile/WalletBalanceCard";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";

const REF_ICON: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
    referral: Gift01,
    pos_sale: BankNote01,
    refund: RefreshCcw01,
    manual: CoinsHand,
};

function fmtDate(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function monthLabelOf(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function fmtAmount(n: number): string {
    return n.toLocaleString("en-US");
}

function TxnRow({ t }: { t: WalletTransaction }) {
    const Icon = REF_ICON[t.referenceType ?? "manual"] ?? CoinsHand;
    const credit = t.type === "credit";
    return (
        <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)]">
                <Icon className="size-5 text-[#344054]" aria-hidden />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-sm font-semibold leading-5 text-[#344054]">{t.reason}</p>
                <p className="text-xs font-normal leading-[18px] text-[#475467]">
                    {fmtDate(t.createdAtISO)} · {fmtTime(t.createdAtISO)}
                </p>
            </div>
            <p className={`shrink-0 text-sm font-semibold leading-5 ${credit ? "text-[#17b26a]" : "text-[#344054]"}`}>
                {credit ? "+" : "−"}AED {fmtAmount(t.amountAed)}
            </p>
        </div>
    );
}

export default function WalletPage() {
    const router = useRouter();
    const isAuth = useIsAuthenticated();
    useEffect(() => {
        if (!isAuth) router.replace("/customer/auth");
    }, [isAuth, router]);

    const member = useCurrentCustomer();
    const allTxns = useAppStore((s) => s.walletTransactions);
    const [hidden, setHidden] = useState(false);

    const { balance, groups } = useMemo(() => {
        const id = member?.id ?? "";
        const bal = walletBalanceAed(allTxns, id);
        const mine = allTxns
            .filter((t) => t.customerId === id)
            .sort((a, b) => b.createdAtISO.localeCompare(a.createdAtISO));
        const g: { key: string; label: string; rows: WalletTransaction[] }[] = [];
        for (const t of mine) {
            const key = t.createdAtISO.slice(0, 7);
            const last = g[g.length - 1];
            if (last && last.key === key) last.rows.push(t);
            else g.push({ key, label: monthLabelOf(key), rows: [t] });
        }
        return { balance: bal, groups: g };
    }, [allTxns, member?.id]);

    if (!isAuth) return null;

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile")}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Wallet</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-8 pt-[80px]">
                <WalletBalanceCard balance={balance} hidden={hidden} onToggle={() => setHidden((v) => !v)} />

                {groups.length > 0 ? (
                    <div className="flex flex-col gap-6">
                        {groups.map((g) => (
                            <div key={g.key} className="flex flex-col gap-3">
                                <p className="text-sm font-medium leading-5 text-[#344054]">{g.label}</p>
                                <div className="flex flex-col gap-3">
                                    {g.rows.map((t, i) => (
                                        <div key={t.id} className="flex flex-col gap-3">
                                            {i > 0 && <div className="h-px w-full bg-[#e4e7ec]" />}
                                            <TxnRow t={t} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={CoinsHand}
                            title="No wallet activity yet"
                            description="Account credit from rewards and refunds will appear here."
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
