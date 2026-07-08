"use client";

// Customer — Notification settings (`/customer/profile/notifications`). Two grouped
// cards: delivery channels + marketing opt-ins. Each toggle persists + toasts.

import { useRouter } from "next/navigation";
import { ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { setNotifPref, useNotifPrefs, type NotifPrefs } from "@/lib/customer/notification-prefs";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Switch } from "@/components/customer/shell/Switch";

type NotifRow = { key: keyof NotifPrefs; title: string; sub: string };

const CHANNELS: NotifRow[] = [
    { key: "email", title: "Email notifications", sub: "Receive updates via email" },
    { key: "whatsapp", title: "WhatsApp notifications", sub: "Receive quick updates" },
    { key: "sms", title: "SMS notifications", sub: "Receive updates via text message." },
    { key: "push", title: "Push notifications", sub: "Get instant alerts on your device" },
];
const MARKETING: NotifRow[] = [
    { key: "studioAnnouncements", title: "Studio announcements", sub: "Receive studio announcements." },
    { key: "newClassLaunch", title: "New class launch", sub: "Be notified about new classes." },
    { key: "specialOffers", title: "Special offers", sub: "Receive exclusive promotions and offers." },
    { key: "promoCodeOffers", title: "Promotion offers", sub: "Get notified about new promotions." },
];

export default function NotificationSettingsPage() {
    const router = useRouter();
    const prefs = useNotifPrefs();
    const showToast = useAppStore((s) => s.showToast);

    function toggle(key: keyof NotifPrefs, title: string, next: boolean) {
        setNotifPref(key, next);
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
                            <p className="text-base font-medium leading-6 text-[#101828]">{row.title}</p>
                            <p className="text-sm leading-5 text-[#475467]">{row.sub}</p>
                        </div>
                        <Switch
                            checked={prefs[row.key]}
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
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">
                    Notification settings
                </h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-[80px]">
                <Group rows={CHANNELS} />
                <Group rows={MARKETING} />
            </div>
        </div>
    );
}
