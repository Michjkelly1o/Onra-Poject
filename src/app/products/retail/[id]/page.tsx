"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Retail product detail (/products/retail/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-07-29 (round 2) — restructured to match /products/[id]
// (membership) exactly: 72px top header + DetailPageShell 320px LEFT
// sidebar (banner + product image + key stats + action buttons) + right
// panel with tabs (Product details · Stock by branch · Activity).
//
// Every primitive (LeftSidebar / RightPanel / SidebarField / ActionBtn /
// SectionHeading / DescriptionCard / InlineStat) mirrors the membership
// detail page so the two products render as siblings without needing to
// re-learn either. Actions (Configure stock · Edit · Archive/Reactivate/
// Recover · Delete) live in the sidebar action footer, not the header.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    Edit02, Archive, RefreshCcw01, Trash01, Trash02, Check, XClose,
    Package, CoinsHand, Tag01, CalendarPlus02, SlashCircle01,
    BankNote01, ShoppingBag01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ConfigureStockPanel } from "@/components/retail/ConfigureStockPanel";
import { TABLE_TH as TH, TABLE_TD as TD } from "@/lib/table-styles";
import {
    useAppStore,
    type RetailProduct,
    type RetailStockAdjustment,
} from "@/lib/store";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

/** Client 2026-07-29 — friendly labels for RetailStockAdjustment.kind on
 *  the Activity tab. The raw enum is technical; the UI shows the human
 *  copy instead. */
const KIND_LABEL: Record<RetailStockAdjustment["kind"], string> = {
    sale:    "Sale",
    receive: "Received",
    adjust:  "Adjusted",
    loss:    "Loss",
    refund:  "Refunded",
};

// ─── Modal config (mirrors /products/[id]) ──────────────────────────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const MODAL_TONE: Record<ModalAction, "danger" | "success"> = {
    archive: "success",
    deactivate: "danger",
    recover: "success",
    reactivate: "success",
    delete: "danger",
};

const MODAL_CONFIG: Record<ModalAction, {
    IconComp: React.ElementType;
    title: string; description: string;
    confirmLabel: string;
}> = {
    archive: {
        IconComp: Archive,
        title: "Archive this retail product?",
        description: "This product will be hidden from POS and the customer shop. You can recover archived products at any time.",
        confirmLabel: "Archive",
    },
    deactivate: {
        IconComp: SlashCircle01,
        title: "Deactivate this retail product?",
        description: "This product will be hidden from new POS sales. Existing stock stays where it is.",
        confirmLabel: "Deactivate",
    },
    recover: {
        IconComp: RefreshCcw01,
        title: "Recover this retail product?",
        description: "This product will be restored to Active status and become sellable again.",
        confirmLabel: "Recover",
    },
    reactivate: {
        IconComp: Check,
        title: "Reactivate this retail product?",
        description: "This product will become available again in POS and on the customer shop.",
        confirmLabel: "Reactivate",
    },
    delete: {
        IconComp: Trash02,
        title: "Delete this retail product?",
        description: "This product will be permanently removed along with its per-branch stock rows. This cannot be undone.",
        confirmLabel: "Delete",
    },
};

// ─── Sidebar primitives (mirror /products/[id]) ─────────────────────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

function SidebarField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
        </div>
    );
}

/** Banner — uses the uploaded imageUrl when set (matching class-template
 *  detail's cover image pattern). Falls back to a sage gradient with a
 *  centered Image01 glyph when no image was uploaded yet. */
function ProductBanner({ imageUrl, name, status }: {
    imageUrl?: string; name: string; status: RetailProduct["status"];
}) {
    return (
        <div className="relative h-[155px] shrink-0 overflow-hidden">
            {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrl}
                    alt={name}
                    className={cn("absolute inset-0 w-full h-full object-cover", status !== "active" && "grayscale")}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
            ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#e9fff3] to-[#f5fffa]" />
            )}
            <div className="absolute top-3 right-3">
                <StatusBadge type="product" status={status} size="lg" />
            </div>
        </div>
    );
}

// ─── LeftSidebar ────────────────────────────────────────────────────────────

function LeftSidebar({
    product, categoryLabel, stockAggregate, stockValue, hasHistory,
    onAction, onConfigureStock,
}: {
    product: RetailProduct;
    categoryLabel: string;
    stockAggregate: number;
    stockValue: number;
    hasHistory: boolean;
    onAction: (a: "edit" | ModalAction) => void;
    onConfigureStock: () => void;
}) {
    const status = product.status;

    const actions = (() => {
        // Same status-aware ladder as memberships/packages:
        //  · archived → Recover only (Delete surfaces when no history).
        //  · inactive → Configure stock + Reactivate + Archive (+ Delete
        //               only when no history).
        //  · active   → Configure stock + Edit + Archive + terminal
        //               swap: Delete (no history) OR Deactivate (has
        //               history — hides the product from POS but keeps
        //               stock intact).
        if (status === "archived") {
            return (
                <>
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover product" onClick={() => onAction("recover")} />
                    {!hasHistory && (
                        <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete product" danger onClick={() => onAction("delete")} />
                    )}
                </>
            );
        }
        if (status === "inactive") {
            return (
                <>
                    <ActionBtn icon={<Package className="w-5 h-5" />} label="Configure stock" onClick={onConfigureStock} />
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Reactivate product" onClick={() => onAction("reactivate")} />
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive product" onClick={() => onAction("archive")} />
                    {!hasHistory && (
                        <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete product" danger onClick={() => onAction("delete")} />
                    )}
                </>
            );
        }
        // active
        return (
            <>
                <ActionBtn icon={<Package className="w-5 h-5" />} label="Configure stock" onClick={onConfigureStock} />
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label="Edit product" onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive product" onClick={() => onAction("archive")} />
                {hasHistory ? (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate product" danger onClick={() => onAction("deactivate")} />
                ) : (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete product" danger onClick={() => onAction("delete")} />
                )}
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <ProductBanner imageUrl={product.imageUrl} name={product.name} status={status} />

            <div className="flex flex-col flex-1">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <div>
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{product.name}</h2>
                        {product.description && (
                            <p className="text-[14px] text-[#667085] leading-[20px] mt-1 line-clamp-2">{product.description}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <SidebarField label="Price" value={formatAed(product.priceAed)} />
                        <SidebarField label="Unit cost" value={formatAed(product.unitCostAed)} />
                        <SidebarField label="SKU" value={product.sku} />
                        <SidebarField label="Retail category" value={categoryLabel} />
                        <SidebarField label="Total stock" value={`${stockAggregate} units`} />
                        <SidebarField label="Stock value" value={formatAed(stockValue)} />
                    </div>
                </div>

                <div className="px-6 pb-6 mt-auto">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Retail product actions</p>
                    <div className="flex flex-col gap-4">{actions}</div>
                </div>
            </div>
        </div>
    );
}

// ─── RightPanel — tabs ─────────────────────────────────────────────────────

type TabId = "details" | "stock" | "activity";

function RightPanel({ product, categoryLabel, stockRows, adjRows, branches }: {
    product: RetailProduct;
    categoryLabel: string;
    stockRows: import("@/lib/store").RetailStock[];
    adjRows: RetailStockAdjustment[];
    branches: import("@/lib/store").Branch[];
}) {
    const [tab, setTab] = useState<TabId>("details");

    const tabsCopy: { id: TabId; label: string }[] = [
        { id: "details",  label: "Product details" },
        { id: "stock",    label: "Stock by branch" },
        { id: "activity", label: "Activity" },
    ];

    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                <div className="flex gap-1">
                    {tabsCopy.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={cn(
                                "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                tab === t.id
                                    ? "border-b-2 border-[#101828] text-[#101828]"
                                    : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "details" && (
                <ProductDetailsTab product={product} categoryLabel={categoryLabel} />
            )}
            {tab === "stock" && (
                <StockByBranchTab
                    product={product}
                    stockRows={stockRows}
                    adjRows={adjRows}
                    branches={branches}
                />
            )}
            {tab === "activity" && (
                <ActivityTab product={product} adjRows={adjRows} branches={branches} />
            )}
        </div>
    );
}

// ─── Right-panel primitives (mirror /products/[id]) ─────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[14px] text-[#667085] mt-2 first:mt-0">{children}</p>
    );
}

function DescriptionCard({ label, body }: { label: string; body: string }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className="text-[16px] text-[#101828] leading-6 whitespace-pre-line">{body || "—"}</p>
        </div>
    );
}

function InlineStatRow({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function InlineStat({ icon, label, value }: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0 text-[#475467]">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <p className="text-[14px] text-[#667085] leading-5">{label}</p>
                <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{value}</p>
            </div>
        </div>
    );
}

// ─── Tab 1: Product details ─────────────────────────────────────────────────

function ProductDetailsTab({ product, categoryLabel }: {
    product: RetailProduct;
    categoryLabel: string;
}) {
    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            <SectionHeading>Basic information</SectionHeading>
            <DescriptionCard label="Description" body={product.description ?? ""} />
            <InlineStatRow>
                <InlineStat
                    icon={<BankNote01 className="w-5 h-5" />}
                    label="Price"
                    value={formatAed(product.priceAed)}
                />
                <InlineStat
                    icon={<CoinsHand className="w-5 h-5" />}
                    label="Unit cost"
                    value={formatAed(product.unitCostAed)}
                />
            </InlineStatRow>

            <SectionHeading>Product configuration</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<Tag01 className="w-5 h-5" />}
                    label="SKU"
                    value={product.sku}
                />
                <InlineStat
                    icon={<ShoppingBag01 className="w-5 h-5" />}
                    label="Retail category"
                    value={categoryLabel}
                />
            </InlineStatRow>

            {product.sizes && product.sizes.length > 0 && (
                <>
                    <SectionHeading>Sizes</SectionHeading>
                    <div className="flex flex-wrap gap-2">
                        {product.sizes.map(s => (
                            <span key={s} className="inline-flex items-center px-3 py-1 rounded-full bg-[#f2f4f7] text-[14px] font-medium text-[#344054]">
                                {s}
                            </span>
                        ))}
                    </div>
                </>
            )}

            <SectionHeading>Stock alert</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<Package className="w-5 h-5" />}
                    label="Reorder threshold"
                    value={`${product.reorderThreshold} units`}
                />
                <InlineStat
                    icon={<CalendarPlus02 className="w-5 h-5" />}
                    label="Created on"
                    value={formatDate(product.createdAt)}
                />
            </InlineStatRow>
        </div>
    );
}

// ─── Tab 2: Stock by branch ─────────────────────────────────────────────────

function StockByBranchTab({ product, stockRows, adjRows, branches }: {
    product: RetailProduct;
    stockRows: import("@/lib/store").RetailStock[];
    adjRows: RetailStockAdjustment[];
    branches: import("@/lib/store").Branch[];
}) {
    const rowsForProduct = stockRows.filter(s => s.productId === product.id);
    const activeBranches = branches.filter(b => b.status !== "archive");
    const sizes = product.sizes ?? [];
    const isSized = sizes.length > 0;

    // Client 2026-07-31 — "Sold" column shows the ALL-TIME total units sold
    // for this product. Reads from retail_stock_adjustments filtered to
    // kind = "sale" (deltas are negative on sales; abs → positive count).
    // Keyed per branch, or per (branch × size) for a sized product. Refunds
    // NOT netted here — they live on the Activity tab.
    const soldByKey = useMemo(() => {
        const map = new Map<string, number>();
        for (const a of adjRows) {
            if (a.productId !== product.id) continue;
            if (a.kind !== "sale") continue;
            const key = a.size ? `${a.branchId}|${a.size}` : a.branchId;
            map.set(key, (map.get(key) ?? 0) + Math.abs(a.delta));
        }
        return map;
    }, [adjRows, product.id]);

    // One entry per branch (sizeless) or per (branch × size) — flattened so the
    // table renders a single tbody either way.
    const cells = activeBranches.flatMap(b =>
        isSized
            ? sizes.map(sz => ({
                key: `${b.id}|${sz}`,
                branchName: b.name,
                size: sz as string | undefined,
                row: rowsForProduct.find(s => s.branchId === b.id && s.size === sz),
                sold: soldByKey.get(`${b.id}|${sz}`) ?? 0,
            }))
            : [{
                key: b.id,
                branchName: b.name,
                size: undefined as string | undefined,
                row: rowsForProduct.find(s => s.branchId === b.id),
                sold: soldByKey.get(b.id) ?? 0,
            }],
    );

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-4">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={cn(TH, "min-w-[200px]")}>Branch</th>
                            {isSized && <th className={cn(TH, "w-[120px]")}>Size</th>}
                            <th className={cn(TH, "w-[160px]")}>Units on hand</th>
                            <th className={cn(TH, "w-[120px]")}>Sold</th>
                            <th className={cn(TH, "w-[140px]")}>Reorder at</th>
                            <th className={cn(TH, "w-[180px]")}>Last updated</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cells.map(c => {
                            const units = c.row?.unitsOnHand ?? 0;
                            const isLow = units <= product.reorderThreshold;
                            const isOut = units === 0;
                            return (
                                <tr key={c.key}>
                                    <td className={TD}>{c.branchName}</td>
                                    {isSized && <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>{c.size}</td>}
                                    <td className={cn(TD, "whitespace-nowrap")}>
                                        <span className={cn(
                                            isOut && "text-[#b42318] font-medium",
                                            !isOut && isLow && "text-[#dc6803] font-medium",
                                        )}>
                                            {isOut ? "Out of stock" : `${units} units`}
                                        </span>
                                    </td>
                                    <td className={cn(TD, "whitespace-nowrap tabular-nums")}>
                                        {c.sold > 0 ? `${c.sold} units` : "—"}
                                    </td>
                                    <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                        {product.reorderThreshold}
                                    </td>
                                    <td className={cn(TD, "whitespace-nowrap text-[#475467]")}>
                                        {formatDate(c.row?.lastAdjustedAt)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Tab 3: Activity ────────────────────────────────────────────────────────

function ActivityTab({ product, adjRows, branches }: {
    product: RetailProduct;
    adjRows: RetailStockAdjustment[];
    branches: import("@/lib/store").Branch[];
}) {
    const historyForProduct = useMemo(
        () =>
            adjRows
                .filter(a => a.productId === product.id)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .slice(0, 50),
        [adjRows, product.id],
    );

    if (historyForProduct.length === 0) {
        return (
            <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6">
                <div className="relative" style={{ minHeight: 300 }}>
                    <EmptyState title="No activity yet" subtitle="Stock changes and POS sales will show up here." />
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-4">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={cn(TH, "w-[180px]")}>Date</th>
                            <th className={cn(TH, "min-w-[180px]")}>Branch</th>
                            <th className={cn(TH, "w-[140px]")}>Type</th>
                            <th className={cn(TH, "w-[120px]")}>Change</th>
                            <th className={cn(TH, "min-w-[220px]")}>Reason</th>
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
                                    <td className={cn(TD)}>{KIND_LABEL[a.kind]}</td>
                                    <td className={cn(TD, "whitespace-nowrap font-medium", positive ? "text-[#067647]" : "text-[#b42318]")}>
                                        {positive ? `+${a.delta} units` : `${a.delta} units`}
                                    </td>
                                    <td className={cn(TD, "text-[#475467]")}>{a.reason ?? "—"}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Configure-stock side panel (unchanged from prior detail impl) ─────────

/** v83 audit-1 (2026-07-29) — reason → kind resolver that honours the
 *  delta sign. Previously a static Record; a "Received shipment" reason
 *  with a NEGATIVE delta (admin lowering the count) would write a
 *  `kind: "receive"` row, which reads as nonsense in the audit log.
 *  Now: "Lost" / "Damaged" are always loss (negative deltas), and
 *  positive/negative for the other reasons picks kind by sign. */
// ─── Detail page ────────────────────────────────────────────────────────────

function RetailProductDetailPageInner() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
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

    // Configure-stock panel is opened either from the sidebar action here
    // OR from the retail list's row action (`?configureStock=1` deep link).
    // The list route pushes here with the query param so admins don't need
    // to click through the detail page first.
    const [configureOpen, setConfigureOpen] = useState(() => searchParams.get("configureStock") === "1");
    const [pending, setPending] = useState<ModalAction | null>(null);

    // Clean the query param once the panel state has taken effect so a
    // back-nav doesn't re-open it. Runs once per mount, matches the
    // returnTo cleanup pattern other detail pages use.
    useEffect(() => {
        if (searchParams.get("configureStock") === "1") {
            const url = new URL(window.location.href);
            url.searchParams.delete("configureStock");
            window.history.replaceState({}, "", url.toString());
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (!product) {
        return (
            <div className="h-screen bg-white flex items-center justify-center px-6 py-10">
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
    // hasHistory mirrors the store's canDeleteRetailProduct guard —
    // past receipts (customerTransactions with retailProductId) OR any
    // stock-adjustment audit row (receive / sale / adjust / loss /
    // refund). Products with any history are Archive/Deactivate only.
    const hasHistory =
        transactions.some(t => t.retailProductId === product.id)
        || adjRows.some(a => a.productId === product.id);

    function handleAction(a: "edit" | ModalAction) {
        if (a === "edit") {
            router.push(`/products/retail/${product!.id}/edit?returnTo=${encodeURIComponent(`/products/retail/${product!.id}`)}`);
            return;
        }
        setPending(a);
    }

    function performAction(kind: ModalAction) {
        if (kind === "archive") {
            setRetailProductStatus([product!.id], "archived");
            showToast("Product archived", `${product!.name} moved to Archive.`, "success", "check");
        } else if (kind === "reactivate") {
            setRetailProductStatus([product!.id], "active");
            showToast("Product reactivated", `${product!.name} is Active again.`, "success", "check");
        } else if (kind === "recover") {
            setRetailProductStatus([product!.id], "active");
            showToast("Product recovered", `${product!.name} moved from Archive to Active.`, "success", "check");
        } else if (kind === "deactivate") {
            setRetailProductStatus([product!.id], "inactive");
            showToast("Product deactivated", `${product!.name} is now Inactive.`, "success", "check");
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

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Top header (72px) — same chrome as membership / gift-card
                detail. NO border-bottom per the shared pattern; the
                sidebar + right-panel cards below carry the visual weight. */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={() => router.push("/admin/products/retail")}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    aria-label="Close"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Retail product details</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body — canonical DetailPageShell (832px two-column frame). */}
            <DetailPageShell
                sidebar={
                    <LeftSidebar
                        product={product}
                        categoryLabel={categoryLabel}
                        stockAggregate={stockAggregate}
                        stockValue={stockValue}
                        hasHistory={hasHistory}
                        onAction={handleAction}
                        onConfigureStock={() => setConfigureOpen(true)}
                    />
                }
                main={
                    <RightPanel
                        product={product}
                        categoryLabel={categoryLabel}
                        stockRows={stockRows}
                        adjRows={adjRows}
                        branches={branches}
                    />
                }
            />

            {pending && (() => {
                const cfg = MODAL_CONFIG[pending];
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPending(null)}
                        icon={cfg.IconComp}
                        tone={MODAL_TONE[pending]}
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

// Suspense wrapper — Next.js 14 requires useSearchParams (read for the
// ?configureStock=1 deep-link auto-open) to sit inside a Suspense
// boundary; without it the page throws during static prerender + on
// hydration. Same pattern as /products/gift-cards/[id].
export default function RetailProductDetailPage() {
    return (
        <Suspense fallback={null}>
            <RetailProductDetailPageInner />
        </Suspense>
    );
}
