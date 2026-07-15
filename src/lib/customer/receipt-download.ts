"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — receipt PNG download + share text (no external deps)
// ─────────────────────────────────────────────────────────────────────────────
//
// Draws a payment receipt onto a <canvas> and triggers a PNG download — used by
// the receipt Share/Download actions. Also composes a plain-text summary for the
// share sheet.

import type { OrderLine } from "@/lib/customer/purchase";

export interface ReceiptData {
    title: string;
    txnId: string;
    dateLabel: string;
    timeLabel: string;
    methodLabel: string;
    total: number;
    status: "success" | "failed";
    items?: OrderLine[];
}

/** Plain-text receipt summary for the share sheet. */
export function composeReceiptShareText(r: ReceiptData): string {
    const lines = [
        `${r.title} — Onra`,
        `Transaction ${r.txnId}`,
        `${r.dateLabel} · ${r.timeLabel}`,
        `Payment method: ${r.methodLabel}`,
        `Total: AED ${r.total.toLocaleString("en-US")}`,
        `Status: ${r.status === "success" ? "Success" : "Failed"}`,
    ];
    return lines.join("\n");
}

/** Render the receipt to a PNG and download it. Client-only. */
export function downloadReceiptPng(r: ReceiptData): void {
    if (typeof document === "undefined") return;
    const scale = 2;
    const W = 400;
    const pad = 28;
    const rowH = 30;

    const orderRows: [string, string][] = [
        ["Transaction ID", r.txnId],
        ["Date", r.dateLabel],
        ["Time", r.timeLabel],
        ["Payment method", r.methodLabel],
    ];
    const items = r.items ?? [];
    const totalRows = 2; // Total + Status
    const H =
        pad + 66 + // header
        24 + orderRows.length * rowH + // order section
        (items.length ? 30 + items.length * rowH : 0) + // items
        16 + totalRows * rowH + // totals
        pad;

    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(scale, scale);
    ctx.textBaseline = "top";

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // Header
    ctx.fillStyle = "#101828";
    ctx.font = "600 20px system-ui, sans-serif";
    ctx.fillText(r.title, pad, pad);
    ctx.fillStyle = "#475467";
    ctx.font = "400 14px system-ui, sans-serif";
    ctx.fillText(
        `AED ${r.total.toLocaleString("en-US")}  ·  ${r.status === "success" ? "Success" : "Failed"}`,
        pad,
        pad + 30,
    );

    let y = pad + 66;
    const trunc = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1)}…` : t);
    const row = (label: string, value: string) => {
        ctx.textAlign = "left";
        ctx.fillStyle = "#475467";
        ctx.font = "400 14px system-ui, sans-serif";
        ctx.fillText(trunc(label, 30), pad, y);
        ctx.textAlign = "right";
        ctx.fillStyle = "#101828";
        ctx.font = "500 14px system-ui, sans-serif";
        ctx.fillText(value, W - pad, y);
        ctx.textAlign = "left";
        y += rowH;
    };
    const divider = () => {
        ctx.strokeStyle = "#f2f4f7";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, y + 2);
        ctx.lineTo(W - pad, y + 2);
        ctx.stroke();
        y += 16;
    };

    orderRows.forEach(([l, v]) => row(l, v));

    if (items.length) {
        divider();
        ctx.fillStyle = "#101828";
        ctx.font = "600 15px system-ui, sans-serif";
        ctx.fillText("Item", pad, y);
        y += rowH;
        items.forEach((it) => row(`${it.name} (x${it.quantity})`, `AED ${(it.price * it.quantity).toLocaleString("en-US")}`));
    }

    divider();
    row("Total", `AED ${r.total.toLocaleString("en-US")}`);
    row("Status", r.status === "success" ? "Success" : "Failed");

    const png = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = png;
    a.download = `onra-receipt-${(r.txnId || "receipt").replace(/[^a-z0-9]/gi, "")}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
