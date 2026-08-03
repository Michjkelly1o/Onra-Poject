"use client";

// Shared "Configure stock" side panel.
//
// Extracted from `src/app/products/retail/[id]/page.tsx` (2026-07-30) so
// the retail LIST view can open the panel directly without bouncing
// through the detail route. Both surfaces render the same component; the
// list page just skips the `?configureStock=1` deep-link plumbing.
//
// Client 2026-08-03 — sized products (product.sizes) are configured per
// (branch × size); sizeless products stay per-branch. A flat draft map keyed
// by `stockKey` covers both paths.

import { useEffect, useMemo, useState } from "react";
import { XClose, ChevronSelectorVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import {
    useAppStore,
    type RetailProduct,
    type RetailStockAdjustment,
} from "@/lib/store";

/** Infer the audit-log `kind` from the delta direction — inbound stock
 *  reads as a receive event (drives Units received in the Stock on Hand
 *  report); outbound stock reads as a manual adjustment. The panel used
 *  to key this off a closed reason picker but admin asked for a free-
 *  form reason field, so direction is now the only signal we trust. */
export function resolveAdjustKind(
    _reason: string,
    delta: number,
): RetailStockAdjustment["kind"] {
    return delta > 0 ? "receive" : "adjust";
}

// Draft map keys — per (branch) for sizeless products, per (branch × size)
// for sized ones.
const KEY_SEP = "::";
function stockKey(branchId: string, size?: string): string {
    return size ? `${branchId}${KEY_SEP}${size}` : branchId;
}

/** 112×40 units field with the stacked up/down stepper (Onra DS pattern). */
function UnitsStepper({ value, onChange, ariaLabel }: {
    value: string; onChange: (next: string) => void; ariaLabel: string;
}) {
    const displayed = value === "0" ? "" : value;
    const numeric = Number(value) || 0;
    const setValue = (next: number) => onChange(String(Math.max(0, Math.trunc(next))));
    return (
        <div className="w-[112px] h-10 flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:border-[#7ba08c] transition-colors overflow-hidden">
            <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                aria-label={ariaLabel}
                value={displayed}
                onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "");
                    const trimmed = digits.replace(/^0+(?=\d)/, "");
                    onChange(trimmed === "" ? "0" : trimmed);
                }}
                onBlur={() => { if (value.length === 0) onChange("0"); }}
                className="flex-1 min-w-0 h-full px-3 text-right text-[16px] text-[#101828] bg-transparent focus:outline-none placeholder:text-[#98a2b3]"
            />
            <div className="relative w-6 h-full shrink-0 select-none border-l border-[#e4e7ec] flex items-center justify-center">
                <ChevronSelectorVertical className="pointer-events-none relative z-10 w-4 h-4 text-[#667085]" />
                <button
                    type="button"
                    onClick={() => setValue(numeric + 1)}
                    aria-label={`Increase ${ariaLabel}`}
                    className="absolute inset-x-0 top-0 h-1/2 cursor-pointer hover:bg-[#f9fafb] transition-colors"
                />
                <button
                    type="button"
                    onClick={() => setValue(numeric - 1)}
                    disabled={numeric <= 0}
                    aria-label={`Decrease ${ariaLabel}`}
                    className="absolute inset-x-0 bottom-0 h-1/2 cursor-pointer hover:bg-[#f9fafb] transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
                />
            </div>
        </div>
    );
}

export function ConfigureStockPanel({ open, onClose, product }: {
    open: boolean;
    onClose: () => void;
    product: RetailProduct;
}) {
    const branches   = useAppStore(s => s.branches);
    const stockRows  = useAppStore(s => s.retailStock);
    const adjustRetailStock = useAppStore(s => s.adjustRetailStock);
    const showToast  = useAppStore(s => s.showToast);

    const sizes = useMemo(() => product.sizes ?? [], [product.sizes]);

    // activeBranches MUST be memoised — a fresh array every render would
    // re-fire the drafts-seeding effect below, tripping React's re-render
    // limit the moment the panel deep-links open.
    const activeBranches = useMemo(
        () => branches.filter(b => b.status !== "archive"),
        [branches],
    );

    // (branch × size) combos to render + save.
    const combos = useMemo(
        () => activeBranches.flatMap(b =>
            (sizes.length > 0 ? sizes.map(sz => ({ branch: b, size: sz as string | undefined })) : [{ branch: b, size: undefined }])
                .map(c => ({ ...c, key: stockKey(c.branch.id, c.size) })),
        ),
        [activeBranches, sizes],
    );

    const currentByKey = useMemo(() => {
        const map = new Map<string, number>();
        stockRows
            .filter(s => s.productId === product.id)
            .forEach(s => map.set(stockKey(s.branchId, s.size), s.unitsOnHand));
        return map;
    }, [stockRows, product.id]);

    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [reason, setReason] = useState<string>("");

    useEffect(() => {
        if (!open) return;
        const next: Record<string, string> = {};
        for (const c of combos) next[c.key] = String(currentByKey.get(c.key) ?? 0);
        setDrafts(next);
        setReason("");
    }, [open, combos, currentByKey]);

    function handleSave() {
        // Fallback so audit rows aren't blank when admin skips the field.
        const trimmedReason = reason.trim() || "Manual adjustment";
        let changed = 0;
        for (const c of combos) {
            const raw = drafts[c.key] ?? "0";
            const next = Number(raw);
            if (Number.isNaN(next) || next < 0 || !Number.isInteger(next)) continue;
            const current = currentByKey.get(c.key) ?? 0;
            const delta = next - current;
            if (delta === 0) continue;
            adjustRetailStock({
                productId: product.id,
                branchId: c.branch.id,
                size: c.size,
                delta,
                kind: resolveAdjustKind(trimmedReason, delta),
                reason: trimmedReason,
            });
            changed += 1;
        }
        if (changed === 0) {
            showToast("No changes", "None of the stock counts were changed.", "warning", "check");
        } else {
            showToast(
                "Stock updated",
                `${product.name} — ${changed} ${changed === 1 ? "count" : "counts"} adjusted.`,
                "success",
                "check",
            );
        }
        onClose();
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={480}>
            <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                <p className="flex-1 font-semibold text-[18px] text-[#101828]">Configure stock</p>
                <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors" aria-label="Close">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-5">
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] text-[#667085]">Product</p>
                    <p className="text-[16px] font-medium text-[#101828]">{product.name}</p>
                    <p className="text-[13px] text-[#667085]">{product.sku}</p>
                </div>

                <div className="flex flex-col gap-2">
                    <label className="text-[14px] font-medium text-[#344054]" htmlFor="configure-stock-reason">Reason</label>
                    <input
                        id="configure-stock-reason"
                        type="text"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder="Enter reason"
                        className={cn(
                            "w-full h-10 px-[14px] rounded-[8px] border-1 border-[#d0d5dd] bg-white",
                            "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                            "text-[16px] text-[#101828] placeholder:text-[#98a2b3]",
                            "focus:outline-none focus:border-[#7ba08c] transition-colors",
                        )}
                    />
                    <p className="text-[13px] text-[#667085]">
                        Every changed count will get an audit-log entry with this reason.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-medium text-[#344054]">
                        {sizes.length > 0 ? "Units on hand — per branch, per size" : "Units on hand — per branch"}
                    </p>
                    <div className="flex flex-col gap-3">
                        {sizes.length > 0 ? (
                            activeBranches.map(b => (
                                <div key={b.id} className="flex flex-col gap-2 border-1 border-[#e4e7ec] rounded-[10px] p-3">
                                    <p className="text-[14px] font-medium text-[#101828]">{b.name}</p>
                                    <div className="flex flex-col gap-2">
                                        {sizes.map(sz => {
                                            const key = stockKey(b.id, sz);
                                            return (
                                                <div key={sz} className="grid grid-cols-[1fr_112px] items-center gap-3">
                                                    <div className="flex flex-col min-w-0">
                                                        <p className="text-[14px] text-[#475467] truncate">{sz}</p>
                                                        <p className="text-[12px] text-[#667085]">Current: {currentByKey.get(key) ?? 0}</p>
                                                    </div>
                                                    <UnitsStepper
                                                        value={drafts[key] ?? "0"}
                                                        onChange={v => setDrafts(d => ({ ...d, [key]: v }))}
                                                        ariaLabel={`units at ${b.name}, size ${sz}`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            activeBranches.map(b => {
                                const key = stockKey(b.id);
                                return (
                                    <div key={b.id} className="grid grid-cols-[1fr_112px] items-center gap-3">
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-[14px] text-[#101828] truncate">{b.name}</p>
                                            <p className="text-[12px] text-[#667085]">Current: {currentByKey.get(key) ?? 0}</p>
                                        </div>
                                        <UnitsStepper
                                            value={drafts[key] ?? "0"}
                                            onChange={v => setDrafts(d => ({ ...d, [key]: v }))}
                                            ariaLabel={`units at ${b.name}`}
                                        />
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
            <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
            </div>
        </SlidePanel>
    );
}
