"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — receipt PNG download + share text
// ─────────────────────────────────────────────────────────────────────────────
//
// The download captures the ACTUAL rendered receipt DOM node (badge · title ·
// Order / Item / Payment card) with html-to-image, so the PNG is pixel-identical
// to what's on screen — real icons, brand colours and fonts included. The share
// sheet still gets a plain-text summary.

import { toPng } from "html-to-image";
import type { OrderLine } from "@/lib/customer/purchase";

export interface ReceiptData {
    title?: string;
    txnId: string;
    dateLabel: string;
    timeLabel: string;
    methodLabel: string;
    items: OrderLine[];
    totalItems: number;
    discount: number;
    tax: number;
    accountCredit?: number;
    total: number;
    status: "success" | "failed";
}

/** Plain-text receipt summary for the share sheet. */
export function composeReceiptShareText(r: ReceiptData): string {
    const lines = [
        `${r.title ?? "Payment receipt"} — Onra`,
        `Transaction ${r.txnId}`,
        `${r.dateLabel} · ${r.timeLabel}`,
        `Payment method: ${r.methodLabel}`,
        `Total: AED ${r.total.toLocaleString("en-US")}`,
        `Status: ${r.status === "success" ? "Success" : "Failed"}`,
    ];
    return lines.join("\n");
}

/** Capture a receipt DOM node to a PNG (2× for retina) and download it. */
export async function downloadReceiptNode(node: HTMLElement, txnId: string): Promise<void> {
    if (typeof document === "undefined") return;
    const dataUrl = await toPng(node, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: "#ffffff",
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `onra-receipt-${(txnId || "receipt").replace(/[^a-z0-9]/gi, "")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
