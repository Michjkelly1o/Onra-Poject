"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor profile · Notification settings tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 6378:524545 — three toggle rows inside the bordered card:
//   • Email notifications      / Receive updates via email.
//   • WhatsApp notifications   / Receive quick updates.
//   • Push notifications       / Get instant alerts on your device.
//
// Toggle ON tints the row's border sage-green to match the Figma. Reads +
// writes flow through `currentUser` + `updateAccountProfile` — the same
// centralized mutator the Personal info tab uses — so flipping any
// channel persists immediately and syncs with anything else that reads
// these flags later (a future per-channel send guard, etc).

import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type ChannelKey = "notify_email" | "notify_whatsapp" | "notify_push";

interface ChannelDef {
    key: ChannelKey;
    title: string;
    description: string;
}

const CHANNELS: ReadonlyArray<ChannelDef> = [
    { key: "notify_email",    title: "Email notifications",    description: "Receive updates via email." },
    { key: "notify_whatsapp", title: "WhatsApp notifications", description: "Receive quick updates." },
    { key: "notify_push",     title: "Push notifications",     description: "Get instant alerts on your device." },
];

export function NotificationSettingsTab() {
    const currentUser          = useAppStore(s => s.currentUser);
    const updateAccountProfile = useAppStore(s => s.updateAccountProfile);
    const showToast            = useAppStore(s => s.showToast);

    function toggle(key: ChannelKey) {
        const next = !(currentUser[key] ?? true);
        updateAccountProfile({ [key]: next });
        const channelLabel = CHANNELS.find(c => c.key === key)?.title ?? "Notifications";
        showToast(
            next ? `${channelLabel} enabled` : `${channelLabel} disabled`,
            next
                ? "You'll start receiving updates on this channel."
                : "You'll stop receiving updates on this channel.",
            "success",
            "check",
        );
    }

    return (
        // `min-h-[760px]` follows CLAUDE.md rule #7 — view cards fill,
        // never hug. Keeps this tab the same visual footprint as the
        // Personal info one so the page doesn't jump between tabs.
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)] p-6 w-full min-h-[760px]">
            <div className="flex flex-col gap-5 w-full">
                <p className="text-[18px] font-semibold text-[#101828] leading-7">Notification settings</p>

                <div className="flex flex-col gap-3 w-full">
                    {CHANNELS.map(ch => {
                        const on = currentUser[ch.key] ?? true;
                        return (
                            <ChannelRow
                                key={ch.key}
                                title={ch.title}
                                description={ch.description}
                                on={on}
                                onToggle={() => toggle(ch.key)}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

interface ChannelRowProps {
    title: string;
    description: string;
    on: boolean;
    onToggle: () => void;
}
function ChannelRow({ title, description, on, onToggle }: ChannelRowProps) {
    return (
        <div
            className={cn(
                "flex items-center justify-between gap-4 px-5 py-3.5 rounded-[12px] border-1 transition-colors",
                on
                    ? "border-[#7ba08c] bg-white"
                    : "border-[#e4e7ec] bg-white",
            )}
        >
            <div className="flex-1 min-w-0">
                <p className="text-[16px] font-semibold text-[#101828] leading-6">{title}</p>
                <p className="text-[14px] text-[#667085] leading-5 mt-0.5">{description}</p>
            </div>
            <Toggle on={on} onChange={onToggle} ariaLabel={title} />
        </div>
    );
}

/** Toggle switch — mirrors the existing booking-rules Toggle so the
 *  on-color (sage `#658774`) stays consistent with admin. */
function Toggle({ on, onChange, ariaLabel }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            onClick={onChange}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}
        >
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}
