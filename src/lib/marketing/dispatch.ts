// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Campaign audience / recipient resolution
// ─────────────────────────────────────────────────────────────────────────────
//
// A Campaign is "something to send: a message to a chosen segment". This module
// is the single source of truth for WHO a campaign reaches — used both by the
// create form (live "will reach N" count) and by the store's send dispatch, so
// the previewed number is exactly the number recorded.
//
// `audienceMatch` resolves the chosen audience within branch scope (targets by
// segment, not consent). The final send count then applies each customer's
// marketing topic + channel opt-in via `marketingReach` — so the previewed
// "will reach N" already reflects consent.

import type { Customer, CustomerPlan, CustomerTransaction, NotificationSetting, MarketingItem } from "@/lib/store";
import { customerSegment } from "@/lib/customer/segment";

export type AudienceKind = "everyone" | "membership" | "segment" | "specific";
export type WalletSegment = "lead" | "member" | "inactive";

export interface AudienceSpec {
    kind: AudienceKind;
    membershipIds?: string[];
    segments?: WalletSegment[];
    customerIds?: string[];
    /** Branch scope — empty = all branches. */
    branchIds: string[];
}

/** Customers matching the audience + branch scope. */
export function audienceMatch(
    a: AudienceSpec,
    customers: Customer[],
    plans: CustomerPlan[],
    transactions: CustomerTransaction[],
): Customer[] {
    const branchOk = (c: Customer) =>
        a.branchIds.length === 0 || (c.branchId ? a.branchIds.includes(c.branchId) : true);
    const base = customers.filter(c => c.status !== "archived" && branchOk(c));
    switch (a.kind) {
        case "everyone":
            return base;
        case "membership":
            return base.filter(c => !!c.membershipId && (a.membershipIds ?? []).includes(c.membershipId));
        case "segment": {
            const segs = new Set(a.segments ?? []);
            return base.filter(c => segs.has(customerSegment(c, plans, transactions)));
        }
        case "specific":
            return base.filter(c => (a.customerIds ?? []).includes(c.id));
        default:
            return [];
    }
}

// ── Content type ↔ channel config ↔ consent ──────────────────────────────────
//
// Each marketing send has a "content type" that maps 1-for-1 to a client-defined
// Customer-notifications row (`ns_<topic>`, which carries the Email/WhatsApp/SMS
// channel toggles) AND to a customer opt-in field (`marketingTopic<Topic>`).
// A customer receives a send on a channel only when BOTH the topic AND that
// channel are opted in (the client's documented dispatch rule). Push (in-app) is
// always an available channel; Email/WhatsApp/SMS must also be enabled on the
// admin row. Real external delivery is simulated — the demo records + shows it.

export type MarketingTopic = "studio_announcements" | "new_class_launch" | "special_offers" | "promo_code_offers";
export type MarketingChannel = "push" | "email" | "whatsapp" | "sms";
export const MARKETING_CHANNEL_LABEL: Record<MarketingChannel, string> = {
    push: "Push", email: "Email", whatsapp: "WhatsApp", sms: "SMS",
};

/** The content topic a marketing item sends under. */
export function contentTopic(item: Pick<MarketingItem, "type" | "topic">): MarketingTopic {
    if (item.type === "announcement") return "studio_announcements";
    return item.topic ?? "new_class_launch";
}

function topicOptIn(c: Customer, t: MarketingTopic): boolean {
    switch (t) {
        case "studio_announcements": return !!c.marketingTopicStudioAnnouncements;
        case "new_class_launch":     return !!c.marketingTopicNewClassLaunch;
        case "special_offers":       return !!c.marketingTopicSpecialOffers;
        case "promo_code_offers":    return !!c.marketingTopicPromoCodeOffers;
    }
}
function channelOptIn(c: Customer, ch: MarketingChannel): boolean {
    switch (ch) {
        case "push":     return !!c.marketingChannelPush;
        case "email":    return !!c.marketingChannelEmail;
        case "whatsapp": return !!c.marketingChannelWhatsapp;
        case "sms":      return !!c.marketingChannelSms;
    }
}

/** Channels a topic can send on: Push (always, in-app) + the Email/WhatsApp/SMS
 *  the admin enabled on the matching Customer-notifications row. */
export function enabledChannels(topic: MarketingTopic, notifSettings: NotificationSetting[]): MarketingChannel[] {
    const row = notifSettings.find(n => n.id === `ns_${topic}`);
    const out: MarketingChannel[] = ["push"];
    if (row?.emailEnabled)    out.push("email");
    if (row?.whatsappEnabled) out.push("whatsapp");
    if (row?.smsEnabled)      out.push("sms");
    return out;
}

export interface MarketingReach {
    /** Distinct customers who receive the send on ≥1 channel. */
    total: number;
    /** Per-channel recipient counts. */
    perChannel: Record<MarketingChannel, number>;
    /** Channels that actually reach someone (for the "Sent via …" summary). */
    channels: MarketingChannel[];
}

/** Reach across the audience for a content topic: for each customer, honour the
 *  topic opt-in + each enabled channel's opt-in. */
export function marketingReach(audience: Customer[], topic: MarketingTopic, notifSettings: NotificationSetting[]): MarketingReach {
    const chans = enabledChannels(topic, notifSettings);
    const perChannel: Record<MarketingChannel, number> = { push: 0, email: 0, whatsapp: 0, sms: 0 };
    let total = 0;
    for (const c of audience) {
        if (!topicOptIn(c, topic)) continue;
        let any = false;
        for (const ch of chans) {
            if (channelOptIn(c, ch)) { perChannel[ch]++; any = true; }
        }
        if (any) total++;
    }
    return { total, perChannel, channels: chans.filter(ch => perChannel[ch] > 0) };
}

/** Whether a specific viewer (the customer bell) receives an item on Push —
 *  topic opt-in + Push channel opt-in. */
export function viewerReceivesPush(c: Customer, topic: MarketingTopic): boolean {
    return topicOptIn(c, topic) && channelOptIn(c, "push");
}

/** Human label for an audience spec (list + detail summary). */
export function audienceLabel(a: Pick<AudienceSpec, "kind" | "membershipIds" | "segments" | "customerIds">): string {
    switch (a.kind) {
        case "everyone":   return "Everyone";
        case "membership": return `${a.membershipIds?.length ?? 0} membership${(a.membershipIds?.length ?? 0) === 1 ? "" : "s"}`;
        case "segment":    return (a.segments ?? []).map(s => s[0].toUpperCase() + s.slice(1)).join(" · ") || "Segment";
        case "specific":   return `${a.customerIds?.length ?? 0} customer${(a.customerIds?.length ?? 0) === 1 ? "" : "s"}`;
        default:           return "—";
    }
}
