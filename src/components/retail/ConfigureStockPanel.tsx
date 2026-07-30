"use client";

// Shared "Configure stock" side panel.
//
// Extracted from `src/app/products/retail/[id]/page.tsx` (2026-07-30) so
// the retail LIST view can open the panel directly without bouncing
// through the detail route. Both surfaces render the same component; the
// list page just skips the `?configureStock=1` deep-link plumbing.

import { useEffect, useMemo, useState } from "react";
import { XClose, ChevronSelectorVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import {
    useAppStore,
    RETAIL_ADJUST_REASONS,
    type RetailProduct,
    type RetailAdjustReason,
    type RetailStockAdjustment,
} from "@/lib/store";

/** Map the free-form reason picker to the audit log's `kind` enum. */
export function resolveAdjustKind(
    reason: RetailAdjustReason,
    delta: number,
): RetailStockAdjustment["kind"] {
    if (reason === "Lost" || reason === "Damaged") return "loss";
    if (reason === "Received shipment") return delta > 0 ? "receive" : "adjust";
    // "Manual adjustment" + "Reconciliation" — either sign is honest as
    // an admin edit; both map to `adjust` regardless of direction.
    return "adjust";
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

    // activeBranches MUST be memoised — a fresh array every render would
    // re-fire the drafts-seeding effect below, tripping React's re-render
    // limit the moment the panel deep-links open.
    const activeBranches = useMemo(
        () => branches.filter(b => b.status !== "archive"),
        [branches],
    );

    const currentByBranch = useMemo(() => {
        const map = new Map<string, number>();
        stockRows
            .filter(s => s.productId === product.id)
            .forEach(s => map.set(s.branchId, s.unitsOnHand));
        return map;
    }, [stockRows, product.id]);

    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [reason, setReason] = useState<RetailAdjustReason>("Received shipment");

    useEffect(() => {
        if (!open) return;
        const next: Record<string, string> = {};
        for (const b of activeBranches) {
            next[b.id] = String(currentByBranch.get(b.id) ?? 0);
        }
        setDrafts(next);
        setReason("Received shipment");
    }, [open, activeBranches, currentByBranch]);

    function handleSave() {
        let changed = 0;
        for (const b of activeBranches) {
            const raw = drafts[b.id] ?? "0";
            const next = Number(raw);
            if (Number.isNaN(next) || next < 0 || !Number.isInteger(next)) continue;
            const current = currentByBranch.get(b.id) ?? 0;
            const delta = next - current;
            if (delta === 0) continue;
            const kind = resolveAdjustKind(reason, delta);
            adjustRetailStock({
                productId: product.id,
                branchId: b.id,
                delta,
                kind,
                reason,
            });
            changed += 1;
        }
        if (changed === 0) {
            showToast("No changes", "None of the branch counts were changed.", "warning", "check");
        } else {
            showToast(
                "Stock updated",
                `${product.name} — ${changed} ${changed === 1 ? "branch" : "branches"} adjusted.`,
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
                    <label className="text-[14px] font-medium text-[#344054]">Reason</label>
                    <SelectInput
                        value={reason}
                        onChange={(v) => setReason(v as RetailAdjustReason)}
                        options={RETAIL_ADJUST_REASONS.map(r => ({ value: r, label: r }))}
                        width="w-full"
                    />
                    <p className="text-[13px] text-[#667085]">
                        Every changed branch will get an audit-log entry with this reason.
                    </p>
                </div>

                <div className="flex flex-col gap-3">
                    <p className="text-[14px] font-medium text-[#344054]">Units on hand — per branch</p>
                    <div className="flex flex-col gap-3">
                        {activeBranches.map(b => {
                            const raw = drafts[b.id] ?? "0";
                            // Empty state: `"0"` shows as blank so the placeholder
                            // "0" is what admins see, matching the memory rule.
                            const displayed = raw === "0" ? "" : raw;
                            const numeric = Number(raw) || 0;
                            const setValue = (next: number) => {
                                const clamped = Math.max(0, Math.trunc(next));
                                setDrafts(d => ({ ...d, [b.id]: String(clamped) }));
                            };
                            return (
                                <div key={b.id} className="grid grid-cols-[1fr_112px] items-center gap-3">
                                    <div className="flex flex-col min-w-0">
                                        <p className="text-[14px] text-[#101828] truncate">{b.name}</p>
                                        <p className="text-[12px] text-[#667085]">Current: {currentByBranch.get(b.id) ?? 0}</p>
                                    </div>
                                    {/* Fixed 112 × 40 box: text field + stacked up/down
                                        stepper on the right (Onra DS pattern). `type="text"`
                                        + `inputMode="numeric"` keeps the browser off its own
                                        native spinner so the display value never desyncs.
                                        Focus state swaps border colour only — no `ring-2`
                                        bloom, so all rows read at the same visual size. */}
                                    <div className="w-[112px] h-10 flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:border-[#7ba08c] transition-colors overflow-hidden">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="[0-9]*"
                                            placeholder="0"
                                            aria-label={`Units at ${b.name}`}
                                            value={displayed}
                                            onChange={e => {
                                                const digits = e.target.value.replace(/\D/g, "");
                                                const trimmed = digits.replace(/^0+(?=\d)/, "");
                                                setDrafts(d => ({ ...d, [b.id]: trimmed === "" ? "0" : trimmed }));
                                            }}
                                            onBlur={() => {
                                                setDrafts(d => ({
                                                    ...d,
                                                    [b.id]: (d[b.id] ?? "").length === 0 ? "0" : d[b.id],
                                                }));
                                            }}
                                            className="flex-1 min-w-0 h-full px-3 text-right text-[16px] text-[#101828] bg-transparent focus:outline-none placeholder:text-[#98a2b3]"
                                        />
                                        <div className="relative w-6 h-full shrink-0 select-none border-l border-[#e4e7ec] flex items-center justify-center">
                                            {/* z-10 keeps the glyph on top of the two absolute
                                                buttons — otherwise the buttons' hover fill paints
                                                over the chevron and it looks like it disappeared. */}
                                            <ChevronSelectorVertical className="pointer-events-none relative z-10 w-4 h-4 text-[#667085]" />
                                            <button
                                                type="button"
                                                onClick={() => setValue(numeric + 1)}
                                                aria-label={`Increase units at ${b.name}`}
                                                className={cn(
                                                    "absolute inset-x-0 top-0 h-1/2 cursor-pointer",
                                                    "hover:bg-[#f9fafb] transition-colors",
                                                )}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setValue(numeric - 1)}
                                                disabled={numeric <= 0}
                                                aria-label={`Decrease units at ${b.name}`}
                                                className={cn(
                                                    "absolute inset-x-0 bottom-0 h-1/2 cursor-pointer",
                                                    "hover:bg-[#f9fafb] transition-colors",
                                                    "disabled:cursor-not-allowed disabled:hover:bg-transparent",
                                                )}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
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
