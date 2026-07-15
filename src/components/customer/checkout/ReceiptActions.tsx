"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — ReceiptActions (shared) — the receipt footer: Share + Download + CTA
// ─────────────────────────────────────────────────────────────────────────────
//
// Share opens the same <ShareSheet> used by Class / Appointment details; Download
// saves the receipt as a PNG. The primary CTA ("Done" / "View plan" / "Continue
// booking") is passed as children. Used by the purchase success screen AND the
// Payment history detail page.

import { useState, type ReactNode } from "react";
import { Download01, Share01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { ShareSheet } from "@/components/customer/shell/ShareSheet";
import { downloadReceiptPng, composeReceiptShareText, type ReceiptData } from "@/lib/customer/receipt-download";

export function ReceiptActions({ receipt, children }: { receipt: ReceiptData; children: ReactNode }) {
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    const [shareOpen, setShareOpen] = useState(false);

    const iconBtn = "flex size-[52px] shrink-0 items-center justify-center rounded-full border border-[#d0d5dd] bg-white transition-colors active:bg-gray-50";

    return (
        <>
            <div
                className={`sticky bottom-0 z-10 flex items-center gap-3 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <button type="button" onClick={() => setShareOpen(true)} aria-label="Share receipt" className={iconBtn}>
                    <Share01 className="size-5 text-[#344054]" aria-hidden />
                </button>
                <button
                    type="button"
                    onClick={() => {
                        downloadReceiptPng(receipt);
                        showToast("Receipt downloaded", "Your receipt has been saved as a PNG.", "success");
                    }}
                    aria-label="Download receipt"
                    className={iconBtn}
                >
                    <Download01 className="size-5 text-[#344054]" aria-hidden />
                </button>
                <div className="flex-1">{children}</div>
            </div>

            <ShareSheet
                open={shareOpen}
                onClose={() => setShareOpen(false)}
                title="Share receipt"
                message={composeReceiptShareText(receipt)}
            />
        </>
    );
}
