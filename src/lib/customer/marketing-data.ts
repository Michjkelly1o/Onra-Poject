"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Marketing detail data (What's on → campaign detail)
// ─────────────────────────────────────────────────────────────────────────────
//
// Resolves a single `marketing_items` row (the admin Marketing module data) into
// the view-model the customer detail page renders. The info + terms mirror the
// admin campaign card exactly — same Type / Action / Locations / "Valid until"
// labels — so the two surfaces never drift.

import { useAppStore } from "@/lib/store";
import type { MarketingItem } from "@/data/mock";

const TYPE_LABEL: Record<MarketingItem["type"], string> = {
    new_class: "New class",
    announcement: "Announcement",
    event: "Event",
};

const ACTION_LABEL: Record<MarketingItem["action_type"], string> = {
    book_event: "Book an event",
    buy_ticket: "Buy a ticket",
    external_link: "External link",
    no_action: "No action",
};

/** "All branches" when the item covers every branch, else "N branches". */
function branchLabel(branchIds: string[] | undefined, totalBranches: number): string {
    const n = branchIds?.length ?? 0;
    if (n === 0 || n >= totalBranches) return "All branches";
    return `${n} ${n === 1 ? "branch" : "branches"}`;
}

/** Admin's "Valid until" formatting — "DD/MM/YYYY, H:MM AM" (or "No expiry"). */
function formatValidUntil(iso?: string): string {
    if (!iso) return "No expiry";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
    let h = d.getUTCHours();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    return `${dd}/${mo}/${d.getUTCFullYear()}, ${h}:${mm} ${ampm}`;
}

export interface MarketingDetailVM {
    id: string;
    title: string;
    image?: string;
    description: string;
    type: MarketingItem["type"];
    typeLabel: string;
    actionType: MarketingItem["action_type"];
    actionLabel: string;
    ticketPrice?: number;
    externalUrl?: string;
    ctaClassId?: string;
    locationsLabel: string;
    validUntil: string;
    countdown: boolean;
    expiryISO?: string;
}

/** Resolve a marketing campaign by id into the customer detail view-model. */
export function useMarketingItem(id: string): MarketingDetailVM | null {
    const items = useAppStore((s) => s.marketingItems);
    const totalBranches = useAppStore((s) => s.branches.length);
    const schedules = useAppStore((s) => s.classSchedules);
    const m = items.find((x) => x.id === id);
    if (!m) return null;

    // "Book an event" target = the admin-picked class_schedule id (cta_class_id).
    // Fall back to the next upcoming schedule of one of the campaign's target
    // class templates (e.g. Aerial Yoga → Reformer Pilates) so the CTA always
    // opens a real class even before an admin explicitly links one.
    let ctaClassId = m.cta_class_id;
    if (m.action_type === "book_event" && !ctaClassId) {
        const targets = m.target_class_ids ?? [];
        if (targets.length > 0) {
            const next = schedules
                .filter(
                    (s) =>
                        s.type === "class" &&
                        s.status !== "Cancelled" &&
                        s.status !== "Completed" &&
                        targets.includes(s.templateId),
                )
                .sort((a, b) => (a.dateISO + a.startTime).localeCompare(b.dateISO + b.startTime))[0];
            ctaClassId = next?.id;
        }
    }

    return {
        id: m.id,
        title: m.title,
        image: m.cover_image_url,
        description: m.short_description,
        type: m.type,
        typeLabel: TYPE_LABEL[m.type],
        actionType: m.action_type,
        actionLabel: ACTION_LABEL[m.action_type],
        ticketPrice: m.ticket_price,
        externalUrl: m.external_url,
        ctaClassId,
        locationsLabel: branchLabel(m.branch_ids, totalBranches),
        validUntil: formatValidUntil(m.expiry_date),
        countdown: m.countdown ?? false,
        expiryISO: m.expiry_date,
    };
}
