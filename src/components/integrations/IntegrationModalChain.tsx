"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared Integration modal chain
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the integration card + 4-modal flow:
//
//   • IntegrationCard      — list view tile (logo, name, description,
//                            Connected / Not connected badge, Connect or
//                            View+Disconnect button row)
//   • ConnectModal         — per-tool consent screen with feature checklist
//   • LoadingModal         — "Redirecting to {Provider}..." skeleton card,
//                            auto-resolves after 1500ms via the caller's
//                            setTimeout
//   • ViewModal            — account-details modal (Status, Account, Provider
//                            fields, Connected date, Last sync) + Disconnect CTA
//   • DisconnectConfirm    — 440px confirmation modal with destructive button
//
// Originally lived inline in `/admin/settings/integrations/page.tsx`. Extracted
// here so the instructor profile's Integrations tab (Figma 6378:524321) gets
// the EXACT same flow + visual treatment without forking. Both admin and
// instructor pages now import from this file.
//
// Admin passes the full `Integration` shape from the studio-level seed.
// Instructor passes an Integration-shaped object built from the per-instructor
// `InstructorIntegration` row (slug + per-tool copy from INTEGRATION_CONFIG).

import { useEffect } from "react";
import { XClose, CheckCircle } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Integration, IntegrationSlug } from "@/lib/store";

// ────────────────────────────────────────────────────────────────────────────
// Per-tool config (logo + Connect copy + View modal fields)
// ────────────────────────────────────────────────────────────────────────────

export interface IntegrationConfig {
    logo: string;
    providerName: string;
    connectSubtitle: string;
    listHeader: string;
    listItems: string[];
    accountFields: { label: string; value: string }[];
    consentUrl: string;
}

export const INTEGRATION_CONFIG: Record<IntegrationSlug, IntegrationConfig> = {
    google_calendar: {
        logo: "https://api.iconify.design/logos:google-calendar.svg",
        providerName: "Google",
        connectSubtitle: "Sync your class schedules to Google Calendar",
        listHeader: "What will be synced:",
        listItems: [
            "All class schedules",
            "Class times and instructors",
            "Room and location information",
            "Booking capacity and availability",
            "Automatic updates when schedule changes",
        ],
        accountFields: [
            { label: "Account",  value: "studio@example.com" },
            { label: "Calendar", value: "SyncFit - Downtown Fitness" },
        ],
        consentUrl: "https://calendar.google.com",
    },
    apple_calendar: {
        // No iconify "logos:apple-calendar" exists — use Microsoft's Fluent
        // Emoji tear-off-calendar instead. It's visually almost identical to
        // Apple Calendar's actual macOS / iOS app icon — better recognition
        // than the Apple logo or App Store mark.
        logo: "https://api.iconify.design/fluent-emoji-flat:tear-off-calendar.svg",
        providerName: "Apple",
        connectSubtitle: "Sync your teaching schedule across all Apple devices",
        listHeader: "What will be synced:",
        listItems: [
            "All class schedules",
            "Class times and instructors",
            "Updates on iPhone, iPad, and Mac",
            "Schedule changes in real-time",
            "Booking capacity and availability",
        ],
        accountFields: [
            { label: "Account",  value: "studio@icloud.com" },
            { label: "Calendar", value: "SyncFit - Downtown Fitness" },
        ],
        consentUrl: "https://www.icloud.com/calendar/",
    },
    google_analytics: {
        logo: "https://api.iconify.design/logos:google-analytics.svg",
        providerName: "Google",
        connectSubtitle: "Track dashboard traffic and user booking behavior",
        listHeader: "What will be tracked:",
        listItems: [
            "Page views and unique visitors",
            "Class booking conversion funnel",
            "User session duration",
            "Top performing pages",
            "Member acquisition source",
        ],
        accountFields: [
            { label: "Account",  value: "studio@example.com" },
            { label: "Property", value: "SyncFit Studio - GA4" },
        ],
        consentUrl: "https://analytics.google.com",
    },
    whatsapp_business: {
        logo: "https://api.iconify.design/logos:whatsapp-icon.svg",
        providerName: "WhatsApp",
        connectSubtitle: "Send automated booking confirmations and reminders",
        listHeader: "Notifications enabled:",
        listItems: [
            "Booking confirmations",
            "Class reminders (24h and 1h before)",
            "Cancellation alerts",
            "Waitlist promotions",
            "Membership and package updates",
        ],
        accountFields: [
            { label: "Account",       value: "+971 50 123 4567" },
            { label: "Business name", value: "SyncFit Studio" },
        ],
        consentUrl: "https://business.whatsapp.com/",
    },
};

export function configFor(i: { slug: IntegrationSlug }): IntegrationConfig {
    return INTEGRATION_CONFIG[i.slug];
}

// ────────────────────────────────────────────────────────────────────────────
// Logo tile
// ────────────────────────────────────────────────────────────────────────────

export function LogoTile({ integration, size }: {
    integration: Pick<Integration, "slug" | "name">;
    size: 36 | 44 | 32;
}) {
    const cfg = configFor(integration);
    return (
        <div
            className={cn(
                "relative rounded-[6px] border-[0.75px] border-[#e4e7ec] bg-white overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex items-center justify-center shrink-0",
                size === 36 && "w-9 h-9",
                size === 44 && "w-11 h-11",
                size === 32 && "w-8 h-8",
            )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={cfg.logo}
                alt={integration.name}
                className="w-[80%] h-[80%]"
                loading="lazy"
            />
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Status badge
// ────────────────────────────────────────────────────────────────────────────

export function StatusBadge({ connected }: { connected: boolean }) {
    return (
        <span className={cn(
            "inline-flex items-center px-[8px] py-[2px] rounded-full text-[12px] font-medium whitespace-nowrap",
            connected
                ? "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
                : "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
        )}>
            {connected ? "Connected" : "Not connected"}
        </span>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────────────

export function IntegrationCard({ integration, onConnect, onView, onDisconnect }: {
    integration: Integration;
    onConnect: (i: Integration) => void;
    onView: (i: Integration) => void;
    onDisconnect: (i: Integration) => void;
}) {
    const connected = integration.status === "connected";

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 w-full">
            <div className="relative flex flex-col gap-4 w-full">
                <LogoTile integration={integration} size={36} />
                <div className="flex flex-col gap-1 w-full pr-[88px]">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">{integration.name}</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">{integration.description}</p>
                </div>
                <div className="absolute top-0 right-0">
                    <StatusBadge connected={connected} />
                </div>
            </div>

            {connected ? (
                <div className="flex items-center gap-4 w-full">
                    <Button variant="secondary-gray" size="md" className="flex-1" onClick={() => onView(integration)}>
                        View
                    </Button>
                    <Button variant="destructive-secondary" size="md" className="flex-1" onClick={() => onDisconnect(integration)}>
                        Disconnect
                    </Button>
                </div>
            ) : (
                <Button variant="secondary-gray" size="md" className="w-full" onClick={() => onConnect(integration)}>
                    Connect
                </Button>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Modal shell — used by Connect + View
// ────────────────────────────────────────────────────────────────────────────

function ModalShell({ title, subtitle, onClose, children, footer }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[560px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="pt-6 px-6 pb-5 border-b border-[#e4e7ec] relative">
                    <div className="flex flex-col gap-1 pr-10">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
                        {subtitle && (
                            <p className="text-[14px] text-[#475467] leading-5">{subtitle}</p>
                        )}
                    </div>
                    <button type="button" onClick={onClose}
                        className="absolute right-[12px] top-[12px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                {/* Body */}
                <div className="px-6 py-5">{children}</div>
                {/* Footer */}
                <div className="border-t border-[#e4e7ec] px-6 py-5">
                    {footer}
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ConnectModal — per-tool consent screen
// ────────────────────────────────────────────────────────────────────────────

export function ConnectModal({ integration, onContinue, onClose }: {
    integration: Integration;
    onContinue: () => void;
    onClose: () => void;
}) {
    const cfg = configFor(integration);
    return (
        <ModalShell
            title={`Connect ${integration.name}`}
            subtitle={cfg.connectSubtitle}
            onClose={onClose}
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={onContinue}>
                        Continue to {cfg.providerName}
                    </Button>
                </div>
            }
        >
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <LogoTile integration={integration} size={44} />
                <h4 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{cfg.listHeader}</h4>
                <ul className="flex flex-col gap-2">
                    {cfg.listItems.map(item => (
                        <li key={item} className="flex items-center gap-2">
                            <CheckCircle className="w-[18px] h-[18px] text-[#658774] shrink-0" />
                            <span className="text-[16px] text-[#101828] leading-6">{item}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </ModalShell>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// LoadingModal — Redirecting to {Provider}...
// ────────────────────────────────────────────────────────────────────────────

export function LoadingModal({ integration, onClose }: {
    integration: Integration;
    onClose: () => void;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[560px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col items-center px-6 py-20 overflow-hidden">
                <div className="bg-[#f9fafb] rounded-[16px] h-[150px] w-[194px] flex flex-col items-center gap-3 p-3 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] mb-6">
                    <div className="bg-white rounded-[10.18px] w-[50.9px] h-[50.9px] flex items-center justify-center shadow-[0px_1.48px_3.82px_rgba(0,0,0,0.02),-2.96px_4.44px_10.18px_rgba(0,0,0,0.02)]">
                        <LogoTile integration={integration} size={32} />
                    </div>
                    <div className="flex flex-col gap-2 w-full flex-1 justify-between pb-1">
                        <div className="flex flex-col gap-2 w-full">
                            <div className="h-[13px] rounded-full bg-[#f2f4f7] w-full" />
                            <div className="flex gap-2 w-full">
                                <div className="h-[13px] rounded-full bg-[#f2f4f7] flex-1" />
                                <div className="h-[13px] rounded-full bg-[#f2f4f7] flex-1" />
                            </div>
                        </div>
                        <div className="flex justify-center">
                            <div className="h-[13px] rounded-full bg-[#f2f4f7] w-[95px]" />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1 text-center max-w-[352px]">
                    <p className="font-semibold text-[16px] leading-6 text-[#101828]">
                        Redirecting to {integration.name}...
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        You&apos;ll be redirected to {integration.name} to authorize and access your account.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// ViewModal — account-details
// ────────────────────────────────────────────────────────────────────────────

export function formatConnectedAt(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} - ${time}`;
}

export function ViewModal({ integration, onDisconnect, onClose }: {
    integration: Integration;
    onDisconnect: () => void;
    onClose: () => void;
}) {
    const cfg = configFor(integration);
    return (
        <ModalShell
            title={`${integration.name} account details`}
            onClose={onClose}
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="destructive-secondary" size="lg" className="flex-1" onClick={onDisconnect}>
                        Disconnect
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <ViewField
                    label="Status"
                    value="Connected"
                    valueColor="text-[#079455]"
                />
                {cfg.accountFields.map(f => (
                    <ViewField key={f.label} label={f.label} value={f.value} />
                ))}
                <ViewField
                    label="Connected date"
                    value={formatConnectedAt(integration.connectedAt)}
                />
                <ViewField
                    label="Last sync"
                    value="2 minutes ago"
                />
            </div>
        </ModalShell>
    );
}

function ViewField({ label, value, valueColor }: {
    label: string;
    value: string;
    valueColor?: string;
}) {
    return (
        <div className="flex flex-col">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className={cn("text-[16px] font-medium leading-6", valueColor ?? "text-[#101828]")}>
                {value}
            </p>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// DisconnectConfirm
// ────────────────────────────────────────────────────────────────────────────

export function DisconnectConfirm({ integration, onConfirm, onCancel }: {
    integration: Integration;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onCancel]);

    return (
        <div className="fixed inset-0 z-[310] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button type="button" onClick={onCancel}
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10">
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <LogoTile integration={integration} size={44} />
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            Disconnect {integration.name}?
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{integration.name}</span>
                            {" "}will stop syncing with Onra. You can reconnect at any time.
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        Disconnect
                    </Button>
                </div>
            </div>
        </div>
    );
}
