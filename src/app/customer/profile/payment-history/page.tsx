"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Payment history (`/customer/profile/payment-history`) — Figma 4479-142532
// ─────────────────────────────────────────────────────────────────────────────
//
// A level-2 profile page (back → Profile, no bottom nav). Every completed
// payment (Products / Service) grouped by month, newest first: a featured icon,
// the payment type, date • time, status (Success / Failed) and the amount. A
// filter (date range · payment type · payment method) narrows the list.

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { loginHref } from "@/lib/customer/auth-flow";
import { CheckCircle, ChevronLeft, Sliders02, Package, CalendarCheck02, XCircle } from "@untitledui/icons";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { SearchEmptyState } from "@/components/customer/home/SearchEmptyState";
import { useIsAuthenticated } from "@/lib/customer/auth";
import { usePaymentHistory, PAYMENT_TYPE_LABEL, type PaymentRecord } from "@/lib/customer/payment-history";
import {
    PaymentHistoryFilterModal,
    EMPTY_PAYMENT_FILTERS,
    paymentFilterCount,
    type PaymentHistoryFilters,
} from "@/components/customer/profile/PaymentHistoryFilterModal";

function fmtRowDate(iso: string): string {
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function monthLabel(key: string): string {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
function fmtAmount(n: number): string {
    return n.toLocaleString("en-US");
}

function applyFilters(list: PaymentRecord[], f: PaymentHistoryFilters): PaymentRecord[] {
    return list.filter(
        (r) =>
            (!f.dateFrom || r.dateISO >= f.dateFrom) &&
            (!f.dateTo || r.dateISO <= f.dateTo) &&
            (!f.type || f.type === r.type) &&
            (f.methods.length === 0 || f.methods.includes(r.method)),
    );
}

function PaymentRow({ r, onClick }: { r: PaymentRecord; onClick: () => void }) {
    const Icon = r.type === "service" ? CalendarCheck02 : Package;
    const ok = r.status === "success";
    return (
        <button type="button" onClick={onClick} className="flex w-full items-center gap-3 text-left transition-opacity active:opacity-70">
            <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)]">
                    <Icon className="size-5 text-[#344054]" aria-hidden />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <p className="truncate text-sm font-semibold leading-5 text-[#344054]">{PAYMENT_TYPE_LABEL[r.type]}</p>
                    <p className="text-xs font-normal leading-[18px] text-[#475467]">
                        {fmtRowDate(r.dateISO)} • {r.timeLabel}
                    </p>
                    <span className="flex items-center gap-1">
                        {ok ? (
                            <CheckCircle className="size-3.5 shrink-0 text-[#17b26a]" aria-hidden />
                        ) : (
                            <XCircle className="size-3.5 shrink-0 text-[#d92d20]" aria-hidden />
                        )}
                        <span className="text-xs font-normal leading-[18px] text-[#475467]">{ok ? "Success" : "Failed"}</span>
                    </span>
                </div>
            </div>
            <p className="shrink-0 text-sm font-semibold leading-5 text-[#344054]">−AED {fmtAmount(r.amount)}</p>
        </button>
    );
}

export default function PaymentHistoryPage() {
    const router = useRouter();
    const goBack = useCustomerBack("/customer/profile");
    const pathname = usePathname();
    const isAuth = useIsAuthenticated();
    useEffect(() => {
        if (!isAuth) router.replace(loginHref(pathname));
    }, [isAuth, router]);

    const records = usePaymentHistory();
    const [applied, setApplied] = useState<PaymentHistoryFilters>(EMPTY_PAYMENT_FILTERS);
    const [draft, setDraft] = useState<PaymentHistoryFilters>(EMPTY_PAYMENT_FILTERS);
    const [filterOpen, setFilterOpen] = useState(false);

    const groups = useMemo(() => {
        const list = applyFilters(records, applied).sort((a, b) =>
            `${b.dateISO} ${b.timeLabel}`.localeCompare(`${a.dateISO} ${a.timeLabel}`),
        );
        const byMonth = new Map<string, PaymentRecord[]>();
        for (const r of list) {
            const key = r.dateISO.slice(0, 7);
            (byMonth.get(key) ?? byMonth.set(key, []).get(key)!).push(r);
        }
        return Array.from(byMonth.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    }, [records, applied]);

    const fcount = paymentFilterCount(applied);
    // Live count for the draft selection — same predicate as the applied list.
    const draftResultCount = applyFilters(records, draft).length;
    const filteredCount = applyFilters(records, applied).length;

    if (!isAuth) return null;

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Payment history</h1>
                <button
                    type="button"
                    onClick={() => {
                        setDraft(applied);
                        setFilterOpen(true);
                    }}
                    aria-label="Filter"
                    className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <Sliders02 className="size-5 text-[#344054]" aria-hidden />
                    {fcount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
                            {fcount}
                        </span>
                    )}
                </button>
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pb-8 pt-[80px]">
                {/* Result total — shown whenever a filter narrows the list. */}
                {fcount > 0 && (
                    <p className="pb-3 text-sm font-normal leading-5 text-[#475467]">
                        {filteredCount} result{filteredCount === 1 ? "" : "s"}
                    </p>
                )}
                {groups.length === 0 ? (
                    <div className="flex flex-1 items-center justify-center">
                        <SearchEmptyState
                            icon={fcount > 0 ? Sliders02 : Package}
                            title={fcount > 0 ? "No payments match" : "No payments yet"}
                            description={
                                fcount > 0
                                    ? "Try clearing or changing your filters."
                                    : "Your purchases and payments will appear here."
                            }
                        />
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {groups.map(([key, rows]) => (
                            <div key={key} className="flex flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{monthLabel(key)}</p>
                                <div className="flex flex-col gap-3">
                                    {rows.map((r, i) => (
                                        <div key={r.id} className="flex flex-col gap-3">
                                            {i > 0 && <div className="h-px w-full bg-[#e4e7ec]" />}
                                            <PaymentRow r={r} onClick={() => router.push(`/customer/profile/payment-history/${r.id}`)} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <PaymentHistoryFilterModal
                open={filterOpen}
                onClose={() => setFilterOpen(false)}
                draft={draft}
                onDraftChange={setDraft}
                resultCount={draftResultCount}
                onReset={() => {
                    setDraft(EMPTY_PAYMENT_FILTERS);
                    setApplied(EMPTY_PAYMENT_FILTERS);
                }}
                onApply={() => {
                    setApplied(draft);
                    setFilterOpen(false);
                }}
            />
        </div>
    );
}
