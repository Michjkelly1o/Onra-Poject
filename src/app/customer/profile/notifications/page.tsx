"use client";

// Customer — Notification settings (`/customer/profile/notifications`).
//
// Wired to the CUSTOMER RECORD (Jul 2026): every toggle now writes directly
// to the current member's 8 marketing consent fields on the `customers`
// slice — the same fields the admin's Customer detail → Details tab reads
// and the admin's Customer notifications module counts for its "opted in"
// banner. Flipping a toggle here reflects on the admin side in the same
// render cycle (Zustand + the demo persist store's cross-tab bus).
//
// Guest (unauthenticated) users see a friendly empty state — no toggles,
// since there's no record to write to.

import { useRouter } from "next/navigation";
import { ChevronLeft } from "@untitledui/icons";
import { useAppStore, type Customer } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Switch } from "@/components/customer/shell/Switch";

/** One of the 8 marketing-consent fields on the Customer record. Every
 *  row on this page toggles exactly one of these. Grouped into "channels"
 *  (how the customer wants to hear from us) and "topics" (which
 *  marketing categories they've opted in to). */
type MarketingField =
    | "marketingChannelEmail"
    | "marketingChannelWhatsapp"
    | "marketingChannelSms"
    | "marketingChannelPush"
    | "marketingTopicStudioAnnouncements"
    | "marketingTopicNewClassLaunch"
    | "marketingTopicSpecialOffers"
    | "marketingTopicPromoCodeOffers";

type NotifRow = { key: MarketingField; title: string; sub: string };

const CHANNELS: NotifRow[] = [
    { key: "marketingChannelEmail",    title: "Email notifications",    sub: "Receive updates via email" },
    { key: "marketingChannelWhatsapp", title: "WhatsApp notifications", sub: "Receive quick updates" },
    { key: "marketingChannelSms",      title: "SMS notifications",      sub: "Receive updates via text message." },
    { key: "marketingChannelPush",     title: "Push notifications",     sub: "Get instant alerts on your device" },
];

const MARKETING: NotifRow[] = [
    { key: "marketingTopicStudioAnnouncements", title: "Studio announcements", sub: "Receive studio announcements." },
    { key: "marketingTopicNewClassLaunch",      title: "New class launch",     sub: "Be notified about new classes." },
    { key: "marketingTopicSpecialOffers",       title: "Special offers",       sub: "Receive exclusive promotions and offers." },
    { key: "marketingTopicPromoCodeOffers",     title: "Promotion offers",     sub: "Get notified about new promotions." },
];

/** Fields default to true when the customer's record has never been set
 *  (undefined) — matches the seed defaults + "opt-out required" semantics. */
function isOn(member: Customer, key: MarketingField): boolean {
    const v = member[key];
    return v === undefined ? true : !!v;
}

export default function NotificationSettingsPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const updateCustomer = useAppStore((s) => s.updateCustomer);
    const showToast = useAppStore((s) => s.showToast);

    function toggle(key: MarketingField, title: string, next: boolean) {
        if (!member) return;
        // Same mutator the admin's Customer detail → Details tab uses — one
        // write, seen everywhere the record is read (admin Details tab
        // badges, marketing-banner count, cross-tab).
        updateCustomer(member.id, { [key]: next } as Partial<Omit<Customer, "id">>);
        showToast(
            `${title} ${next ? "on" : "off"}`,
            next ? "You'll receive these updates." : "You won't receive these updates.",
            "success",
        );
    }

    function Group({ rows }: { rows: NotifRow[] }) {
        return (
            <div className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white">
                {rows.map((row, i) => (
                    <div
                        key={row.key}
                        className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? "border-t border-[#f2f4f7]" : ""}`}
                    >
                        <div className="min-w-0 flex-1">
                            <p className="text-base font-medium leading-6 text-[var(--brand-text)]">{row.title}</p>
                            <p className="text-sm leading-5 text-[#475467]">{row.sub}</p>
                        </div>
                        <Switch
                            checked={member ? isOn(member, row.key) : false}
                            onChange={(next) => toggle(row.key, row.title, next)}
                            aria-label={row.title}
                        />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">
                    Notification settings
                </h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-[80px]">
                {member ? (
                    <>
                        <Group rows={CHANNELS} />
                        <Group rows={MARKETING} />
                    </>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white p-6 text-center">
                        <p className="text-base font-semibold text-[var(--brand-text)]">Sign in required</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">
                            Log in to manage your notification preferences.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
