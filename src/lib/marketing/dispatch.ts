// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Campaign dispatch / recipient resolution
// ─────────────────────────────────────────────────────────────────────────────
//
// A Campaign is "something to send: a message to a chosen segment". This module
// is the single source of truth for WHO a campaign reaches — used both by the
// create form (live "will reach N" count) and by the store's send dispatch, so
// the previewed number is exactly the number delivered.
//
// Delivery gate (mirrors the customer marketing-preferences contract): a
// customer receives a campaign only when BOTH the Push channel AND the
// campaign's topic are opted in.

import type { Customer, CustomerPlan, CustomerTransaction } from "@/lib/store";
import { customerSegment } from "@/lib/customer/segment";

export type CampaignTopic = "new_class_launch" | "special_offers" | "promo_code_offers";
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

/** The customer's opt-in flag for a campaign topic. No topic → passes. */
function topicOptIn(customer: Customer, topic: CampaignTopic | undefined): boolean {
    switch (topic) {
        case "new_class_launch":  return !!customer.marketingTopicNewClassLaunch;
        case "special_offers":    return !!customer.marketingTopicSpecialOffers;
        case "promo_code_offers": return !!customer.marketingTopicPromoCodeOffers;
        default:                  return true;
    }
}

/** A customer receives a campaign push only when BOTH the Push channel AND the
 *  campaign's topic are opted in. */
export function receivesCampaign(customer: Customer, topic: CampaignTopic | undefined): boolean {
    return !!customer.marketingChannelPush && topicOptIn(customer, topic);
}

/** Customers matching the audience + branch scope (BEFORE the consent gate). */
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

/** Final recipients — audience ∩ consent (Push channel + topic). */
export function campaignRecipients(
    a: AudienceSpec,
    topic: CampaignTopic | undefined,
    customers: Customer[],
    plans: CustomerPlan[],
    transactions: CustomerTransaction[],
): Customer[] {
    return audienceMatch(a, customers, plans, transactions).filter(c => receivesCampaign(c, topic));
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
