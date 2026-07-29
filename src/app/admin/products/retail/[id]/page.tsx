"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail product detail (/admin/products/retail/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase B (2026-07-29). Full detail view — product info card + per-branch
// stock table + adjustment history. Row actions on the header let admins
// Edit, Archive/Reactivate/Recover, Delete, or open the Configure-stock
// modal to adjust units for any branch (writes go through the store's
// adjustRetailStock action so the audit log stays in lockstep).

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
    ChevronLeft, Edit02, Archive, RefreshCcw01, Trash01, Trash02, Check, XClose,
    Image01, Package,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { RowActions } from "@/components/patterns/RowActions";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import {
    useAppStore,
    RETAIL_ADJUST_REASONS,
    type RetailProduct,
    type RetailAdjustReason,
    type RetailStockAdjustment,
} from "@/lib/store";

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

function formatDate(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function ProductThumb({ imageUrl, alt }: { imageUrl?: string; alt: string }) {
    if (imageUrl) {
        return (
            <div className="relative w-16 h-16 rounded-[12px] overflow-hidden bg-[#f2f4f7] shrink-0">
                <Image src={imageUrl} alt={alt} fill sizes="64px" className="object-cover" unoptimized />
            </div>
        );
    }
    return (
        <div className="w-16 h-16 rounded-[12px] bg-[#f2f4f7] border-1 border-[#eaecf0] flex items-center justify-center shrink-0" aria-hidden>
            <Image01 className="w-6 h-6 text-[#98a2b3]" />
        </div>
    );
}

// ─── Configure-stock side panel ─────────────────────────────────────────────

const ADJUST_REASON_TO_KIND: Record<RetailAdjustReason, RetailStockAdjustment["kind"]> = {
    "Received shipment":  "receive",
    "Manual adjustment":  "adjust",
    "Lost":               "loss",
    "Damaged":            "loss",
    "Reconciliation":     "adjust",
};

function ConfigureStockPanel({ open, onClose, product }: {
    open: boolean;
    onClose: () => void;
    product: RetailProduct;
}) {
    const branches   = useAppStore(s => s.branches);
    const stockRows  = useAppStore(s => s.retailStock);
    const adjustRetailStock = useAppStore(s => s.adjustRetailStock);
    const showToast  = useAppStore(s => s.showToast);

    const activeBranches = branches.filter(b => b.status !== "archive");

    const currentByBranch = useMemo(() => {
        const map = new Map<string, number>();
        stockRows
            .filter(s => s.productId === product.id)
            .forEach(s => map.set(s.branchId, s.unitsOnHand));
        return map;
    }, [stockRows, product.id]);

    // Draft units per branch — populated from live current values whenever
    // the panel opens. String-typed so the numeric input handles blanking
    // + leading-zero cleanup the same way every other numeric input does.
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [reason, setReason] = useState<RetailAdjustReason>("Received shipment");

    useMemo(() => {
        if (open) {
            const next: Record<string, string> = {};
            for (const b of activeBranches) {
                next[b.id] = String(currentByBranch.get(b.id) ?? 0);
            }
            setDrafts(next);
            setReason("Received shipment");
        }
        return null;
    }, [open, activeBranches, currentByBranch]);

    function handleSave() {
        const kind = ADJUST_REASON_TO_KIND[reason];
        let changed = 0;
        for (const b of activeBranches) {
            const raw = drafts[b.id] ?? "0";
            const next = Number(raw);
            if (Number.isNaN(next) || next < 0 || !Number.isInteger(next)) continue;
            const current = currentByBranch.get(b.id) ?? 0;
            const delta = next - current;
            if (delta === 0) continue;
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
                        {activeBranches.map(b => (
                            <div key={b.id} className="flex items-center justify-between gap-3">
                                <div className="flex flex-col min-w-0">
                                    <p className="text-[14px] text-[#101828] truncate">{b.name}</p>
                                    <p className="text-[12px] text-[#667085]">Current: {currentByBranch.get(b.id) ?? 0}</p>
                                </div>
                                <div className="w-[120px]">
                                    <NumericStringInput
                                        value={drafts[b.id] ?? "0"}
                                        onChange={v => setDrafts(d => ({ ...d, [b.id]: v }))}
                                        placeholder="0"
                                        className={cn(
                                            "w-full rounded-[8px] border-1 border-[#d0d5dd] px-3 py-2",
                                            "text-[16px] text-[#101828] bg-white",
                                            "focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c]",
                                        )}
                                    />
                                </div>
                            </div>
                        ))}
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

// ─── Detail page ────────────────────────────────────────────────────────────

type ActionKind = "archive" | "reactivate" | "recover" | "delete";

export default function RetailProductDetailPage() {
    const params = useParams();
    const router = useRouter();
    const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

    const product      = useAppStore(s => s.retailProducts.find(p => p.id === id));
    const categories   = useAppStore(s => s.retailCategories);
    const branches     = useAppStore(s => s.branches);
    const stockRows    = useAppStore(s => s.retailStock);
    const adjRows      = useAppStore(s => s.retailStockAdjustments);
    const transactions = useAppStore(s => s.customerTransactions);
    const setRetailProductStatus = useAppStore(s => s.setRetailProductStatus);
    const deleteRetailProducts   = useAppStore(s => s.deleteRetailProducts);
    const showToast    = useAppStore(s => s.showToast);

    const [configureOpen, setConfigureOpen] = useState(false);
    const [pending, setPending] = useState<ActionKind | null>(null);

    if (!product) {
        return (
            <div className="flex-1 flex items-center justify-center px-6 py-10">
                <div className="max-w-md text-center flex flex-col gap-3">
                    <p className="text-[18px] font-semibold text-[#101828]">Product not found</p>
                    <p className="text-[14px] text-[#667085]">
                        This product may have been deleted. Head back to the retail list.
                    </p>
                    <Button variant="primary" size="md" onClick={() => router.push("/admin/products/retail")}>
                        Back to Retail
                    </Button>
                </div>
            </div>
        );
    }

    const categoryLabel = categories.find(c => c.id === product.categoryId)?.label ?? "—";
    const rowsForProduct = stockRows.filter(s => s.productId === product.id);
    const stockAggregate = rowsForProduct.reduce((sum, r) => sum + r.unitsOnHand, 0);
    const stockValue = stockAggregate * product.unitCostAed;
    const hasHistory = transactions.some(t => t.retailProductId === product.id);

    // Sort adjustment history newest first for the timeline table.
    const historyForProduct = useMemo(
        () =>
            adjRows
                .filter(a => a.productId === product.id)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 20),
        [adjRows, product.id],
    );

    function performAction(kind: ActionKind) {
        if (kind === "archive") {
            setRetailProductStatus([product!.id], "archived");
            showToast("Product archived", `${product!.name} moved to Archive.`, "success", "check");
        } else if (kind === "reactivate") {
            setRetailProductStatus([product!.id], "active");
            showToast("Product reactivated", `${product!.name} is Active again.`, "success", "check");
        } else if (kind === "recover") {
            setRetailProductStatus([product!.id], "active");
            showToast("Product recovered", `${product!.name} moved from Archive to Active.`, "success", "check");
        } else if (kind === "delete") {
            const { deleted, blocked } = deleteRetailProducts([product!.id]);
            if (deleted.length > 0) {
                showToast("Product deleted", `${product!.name} has been permanently removed.`, "success", "trash");
                setPending(null);
                router.push("/admin/products/retail");
                return;
            }
            if (blocked.length > 0) {
                showToast("Cannot delete", "This product has past transactions. Archive it instead.", "warning", "check");
            }
        }
        setPending(null);
    }

    const modalConfig: Record<ActionKind, {
        title: string;
        description: React.ReactNode;
        confirmLabel: string;
        tone: "danger" | "success";
        icon: React.ElementType;
    }> = {
        archive: {
            title: "Archive this product?",
            description: <><span className="font-medium text-[#344054]">{product.name}</span> will be hidden from POS and the default admin list. You can recover it later.</>,
            confirmLabel: "Archive",
            tone: "success",
            icon: Archive,
        },
        reactivate: {
            title: "Reactivate this product?",
            description: <><span className="font-medium text-[#344054]">{product.name}</span> will be sellable in POS and the customer shop again.</>,
            confirmLabel: "Reactivate",
            tone: "success",
            icon: Check,
        },
        recover: {
            title: "Recover this product?",
            description: <><span className="font-medium text-[#344054]">{product.name}</span> will move back to Active status.</>,
            confirmLabel: "Recover",
            tone: "success",
            icon: RefreshCcw01,
        },
        delete: {
            title: "Delete this product?",
            description: <><span className="font-medium text-[#344054]">{product.name}</span> will be permanently removed along with its per-branch stock rows. This cannot be undone.</>,
            confirmLabel: "Delete",
            tone: "danger",
            icon: Trash02,
        },
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/admin/products/retail")}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                        aria-label="Back"
                    >
                        <ChevronLeft className="w-5 h-5 text-[#667085]" />
                    </button>
                    <div className="flex flex-col">
                        <p className="text-[20px] font-semibold text-[#101828] leading-7">{product.name}</p>
                        <p className="text-[13px] text-[#667085] leading-5">Retail product · {product.sku}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<Package className="w-4 h-4" />}
                        onClick={() => setConfigureOpen(true)}
                    >
                        Configure stock
                    </Button>
                    {product.status !== "archived" && (
                        <Button
                            variant="secondary-gray"
                            size="md"
                            leftIcon={<Edit02 className="w-4 h-4" />}
                            onClick={() => router.push(`/admin/products/retail/${product.id}/edit`)}
                        >
                            Edit
                        </Button>
                    )}
                    <RowActions
                        items={[
                            { label: "Archive",    icon: Archive,     onClick: () => setPending("archive"),    hidden: product.status === "archived" },
                            { label: "Reactivate", icon: Check,       onClick: () => setPending("reactivate"), hidden: product.status !== "inactive" },
                            { label: "Recover",    icon: RefreshCcw01,onClick: () => setPending("recover"),    hidden: product.status !== "archived" },
                            { label: "Delete",     icon: Trash01,     onClick: () => setPending("delete"), danger: true, hidden: hasHistory },
                        ]}
                    />
                </div>
            </div>

            {/* Summary card */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex gap-6">
                <ProductThumb imageUrl={product.imageUrl} alt={product.name} />
                <div className="flex-1 flex flex-col gap-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge type="product" status={product.status} />
                        <span className="text-[13px] text-[#667085]">Category — {categoryLabel}</span>
                    </div>
                    {product.description && (
                        <p className="text-[14px] text-[#475467] leading-5">{product.description}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        <Stat label="Price" value={formatAed(product.priceAed)} />
                        <Stat label="Unit cost" value={formatAed(product.unitCostAed)} />
                        <Stat label="Total stock" value={`${stockAggregate} units`} />
                        <Stat label="Stock value" value={formatAed(stockValue)} />
                    </div>
                </div>
            </div>

            {/* Per-branch stock */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <p className="text-[16px] font-semibold text-[#101828]">Stock by branch</p>
                    <Button
                        variant="secondary-gray"
                        size="sm"
                        leftIcon={<Package className="w-4 h-4" />}
                        onClick={() => setConfigureOpen(true)}
                    >
                        Adjust
                    </Button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr>
                                <th className={cn(TH, "min-w-[220px]")}>Branch</th>
                                <th className={cn(TH, "w-[140px]")}>Units on hand</th>
                                <th className={cn(TH, "w-[140px]")}>Reorder at</th>
                                <th className={cn(TH, "w-[180px]")}>Last adjusted</th>
                            </tr>
                        </thead>
                        <tbody>
                            {branches.filter(b => b.status !== "archive").map(b => {
                                const row = rowsForProduct.find(s => s.branchId === b.id);
                                const units = row?.unitsOnHand ?? 0;
                                const isLow = units <= product.reorderThreshold;
                                const isOut = units === 0;
                                return (
                                    <tr key={b.id}>
                                        <td className={TD}>{b.name}</td>
                                        <td className={cn(TD, "whitespace-nowrap")}>
                                            <span className={cn(
                                                isOut && "text-[#b42318] font-medium",
                                                !isOut && isLow && "text-[#b54708] font-medium",
                                            )}>
                                                {isOut ? "Out of stock" : `${units} units`}
                                            </span>
                                        </td>
                                        <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                            {product.reorderThreshold}
                                        </td>
                                        <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                            {formatDate(row?.lastAdjustedAt)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Adjustment history */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-4">
                <p className="text-[16px] font-semibold text-[#101828]">Recent stock activity</p>
                {historyForProduct.length === 0 ? (
                    <div className="relative" style={{ minHeight: 200 }}>
                        <EmptyState title="No activity yet" subtitle="Stock changes and POS sales will appear here." />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[180px]")}>Date</th>
                                    <th className={cn(TH, "min-w-[180px]")}>Branch</th>
                                    <th className={cn(TH, "w-[120px]")}>Kind</th>
                                    <th className={cn(TH, "w-[100px]")}>Delta</th>
                                    <th className={cn(TH, "min-w-[200px]")}>Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyForProduct.map(a => {
                                    const branch = branches.find(b => b.id === a.branchId);
                                    const positive = a.delta > 0;
                                    return (
                                        <tr key={a.id}>
                                            <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>{formatDate(a.createdAt)}</td>
                                            <td className={TD}>{branch?.name ?? "—"}</td>
                                            <td className={cn(TD, "capitalize")}>{a.kind}</td>
                                            <td className={cn(TD, "whitespace-nowrap font-medium", positive ? "text-[#067647]" : "text-[#b42318]")}>
                                                {positive ? `+${a.delta}` : a.delta}
                                            </td>
                                            <td className={cn(TD, "text-[#475467]")}>{a.reason ?? "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {pending && (() => {
                const cfg = modalConfig[pending];
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPending(null)}
                        icon={cfg.icon}
                        tone={cfg.tone}
                        title={cfg.title}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performAction(pending)}
                    />
                );
            })()}

            <ConfigureStockPanel
                open={configureOpen}
                onClose={() => setConfigureOpen(false)}
                product={product}
            />

            <Toast />
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-0.5">
            <p className="text-[12px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-semibold text-[#101828]">{value}</p>
        </div>
    );
}
