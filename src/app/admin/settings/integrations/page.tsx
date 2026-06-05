"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Integrations module (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • List view (3-col card grid)   — 4457-22091
//   • Connected card state           — 5335-98795
//   • Connect Google Calendar modal  — 4457-22869
//   • Connect WhatsApp Business      — 4457-22960
//   • Connect Apple Calendar         — 4457-23052
//   • Connect Google Analytics       — 4457-23144
//   • Loading modal                  — 4457-22530
//   • View modal                     — 4457-22433
//   • Success toast                  — 4457-22222
//   • Disconnect toast               — 4457-23238
//
// Phase 2 scope (Brief §2):
//   ✓ Per-tool Connect modal (shared shell, per-tool copy via INTEGRATION_CONFIG)
//   ✓ Loading modal — per-tool logo + "Redirecting to [Tool]..." copy +
//     skeleton illustration · auto-resolves after ~1500ms
//   ✓ View modal — Status / Account / Calendar (or Business name / Property)
//     / Connected date / Last sync · footer Cancel + Disconnect
//   ✓ Disconnect confirmation modal (carries through from Phase 1) +
//     ERROR-tone toast on confirm (Figma 4457-23238 uses the pink toast shell)
//
// Logos: pulled from iconify.design's free CDN (multi-color brand SVGs).

import { useEffect, useState } from "react";
import { XClose, CheckCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type Integration, type IntegrationSlug } from "@/lib/store";

// ─── Per-tool config (logo URL + Connect modal copy + View modal fields) ────
//
// Single source of truth for everything per-tool. The page components
// (cards, Connect modal, Loading modal, View modal) all read from here so
// adding a 5th integration would only require:
//   1. New row in src/data/mock/integrations.ts (+ slug type)
//   2. New entry in this map

interface IntegrationConfig {
    /** Iconify CDN URL. Renders inside the 36×36 white tile on cards and
     *  the 44×44 / 32×32 tiles in modals. */
    logo: string;
    /** Used in "Continue to [Provider]" CTA + toast copy. */
    providerName: string;
    /** Connect modal subtitle. */
    connectSubtitle: string;
    /** Connect modal section header — "What will be synced:" /
     *  "Notifications enabled:" / "What will be tracked:". */
    listHeader: string;
    /** Bullet items shown in the Connect modal. */
    listItems: string[];
    /** View modal extra fields — Status / Connected date / Last sync are
     *  always rendered; these are the per-tool middle rows (Account +
     *  Calendar for Google/Apple, Account + Business name for WhatsApp,
     *  Account + Property for Analytics). */
    accountFields: { label: string; value: string }[];
    /** "Consent screen" URL — opened in a new tab after the Loading modal
     *  resolves, simulating the OAuth handoff. For the prototype we point
     *  at the provider's own app URL (no real OAuth — Phase 3 brief).
     *  When the real backend lands, swap this for the actual OAuth
     *  authorize URL with your client_id. */
    consentUrl: string;
}

const INTEGRATION_CONFIG: Record<IntegrationSlug, IntegrationConfig> = {
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
        // Emoji tear-off-calendar instead. It's the classic white-card with
        // red header and a date number, which is visually almost identical
        // to Apple Calendar's actual macOS / iOS app icon — much better
        // recognition than the Apple logo or App Store mark.
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

function configFor(i: Integration): IntegrationConfig {
    return INTEGRATION_CONFIG[i.slug];
}

// ─── Logo tile ──────────────────────────────────────────────────────────────
//
// Used at three sizes: 36 (card), 44 (Connect modal), 32 (Loading modal).
// The actual logo loads from iconify's CDN via a regular <img>.

function LogoTile({ integration, size }: { integration: Integration; size: 36 | 44 | 32 }) {
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

// ─── Status badge (top-right of card) ───────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
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

// ─── Card ───────────────────────────────────────────────────────────────────

function IntegrationCard({ integration, onConnect, onView, onDisconnect }: {
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

// ─── Modal shell (shared structure for Connect / View) ──────────────────────

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

// ─── Connect modal (Figma 4457-22869 + per-tool variants) ───────────────────

function ConnectModal({ integration, onContinue, onClose }: {
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
            {/* Inner sync-list card (Figma 4457:22873) */}
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

// ─── Loading modal (Figma 4457-22530) ───────────────────────────────────────
//
// "Redirecting to [Tool]..." with a skeleton-card illustration centered on
// the modal. Auto-closes after ~1500ms via the parent's setTimeout.

function LoadingModal({ integration, onClose }: {
    integration: Integration;
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[560px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col items-center px-6 py-20 overflow-hidden">
                {/* Skeleton illustration card */}
                <div className="bg-[#f9fafb] rounded-[16px] h-[150px] w-[194px] flex flex-col items-center gap-3 p-3 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] mb-6">
                    {/* Mini card with logo */}
                    <div className="bg-white rounded-[10.18px] w-[50.9px] h-[50.9px] flex items-center justify-center shadow-[0px_1.48px_3.82px_rgba(0,0,0,0.02),-2.96px_4.44px_10.18px_rgba(0,0,0,0.02)]">
                        <LogoTile integration={integration} size={32} />
                    </div>
                    {/* Skeleton lines */}
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

                {/* Copy */}
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

// ─── View modal (Figma 4457-22433) ──────────────────────────────────────────
//
// Account-details modal shown when admin clicks "View" on a connected card.
// Fields: Status (green "Connected") · per-tool accountFields · Connected
// date · Last sync · Footer Cancel + Disconnect.

function formatConnectedAt(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} - ${time}`;
}

function ViewModal({ integration, onDisconnect, onClose }: {
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
                {/* Status (always first, always "Connected" since modal is
                    only reachable from connected cards) */}
                <ViewField
                    label="Status"
                    value="Connected"
                    valueColor="text-[#079455]"
                />
                {/* Per-tool fields */}
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

// ─── Disconnect confirmation ────────────────────────────────────────────────

function DisconnectConfirm({ integration, onConfirm, onCancel }: {
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

// ─── Page ───────────────────────────────────────────────────────────────────

// One discriminated-union flow state covering every modal step.
type FlowState =
    | { kind: "idle" }
    | { kind: "connect"; integration: Integration }
    | { kind: "loading"; integration: Integration }
    | { kind: "view"; integration: Integration }
    | { kind: "disconnect"; integration: Integration };

const LOADING_MS = 1500;

export default function IntegrationsPage() {
    const integrations = useAppStore(s => s.integrations);
    const connectIntegration = useAppStore(s => s.connectIntegration);
    const disconnectIntegration = useAppStore(s => s.disconnectIntegration);
    const showToast = useAppStore(s => s.showToast);

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Loading modal auto-resolves after LOADING_MS — closes itself, opens
    // the provider's consent screen in a new tab (simulated OAuth handoff
    // for the demo), flips status, fires the success toast.
    //
    // The consent URL is the provider's own app URL — pointing at the real
    // OAuth `authorize` endpoint with a placeholder client_id would show
    // Google's "invalid_client" error page, which is worse UX. When the
    // real backend lands, swap `cfg.consentUrl` to the actual OAuth
    // authorize URL with your real client_id and the same flow keeps
    // working.
    useEffect(() => {
        if (flow.kind !== "loading") return;
        const integration = flow.integration;
        const cfg = configFor(integration);
        const t = setTimeout(() => {
            // Open the consent/provider page in a new tab. Some browsers
            // (Safari + Firefox strict mode) may block this since it's
            // dispatched from a setTimeout rather than the original click;
            // we accept that — the in-app success flow still completes.
            try {
                window.open(cfg.consentUrl, "_blank", "noopener,noreferrer");
            } catch {
                // Popup blocked — ignore; the toast + state flip still fire.
            }
            connectIntegration(integration.id, cfg.accountFields[0]?.value);
            showToast(
                `${integration.name} connected successfully`,
                `Your ${integration.name} account is now connected!`,
                "success", "check",
            );
            setFlow({ kind: "idle" });
        }, LOADING_MS);
        return () => clearTimeout(t);
    }, [flow, connectIntegration, showToast]);

    function handleDisconnectConfirmed(i: Integration) {
        disconnectIntegration(i.id);
        // Figma 4457-23238 — pink/red toast tone with broken-link icon.
        // Closest match: error type + slash icon.
        showToast(
            `${i.name} account has been disconnected`,
            `${i.name} account information and access has been remove.`,
            "error", "slash",
        );
        setFlow({ kind: "idle" });
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Section header (Figma 4457:22112) */}
            <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828] leading-6">Integrations</p>
                <p className="text-[14px] text-[#6e776f] leading-5">
                    Supercharge business workflow and connect with the every day tools
                </p>
            </div>

            {/* Grid — 1 / 2 / 3 cols depending on viewport */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map(i => (
                    <IntegrationCard
                        key={i.id}
                        integration={i}
                        onConnect={int   => setFlow({ kind: "connect",    integration: int })}
                        onView={int      => setFlow({ kind: "view",       integration: int })}
                        onDisconnect={int => setFlow({ kind: "disconnect", integration: int })}
                    />
                ))}
            </div>

            {/* ── Modal chain ──────────────────────────────────────────── */}

            {flow.kind === "connect" && (
                <ConnectModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                    onContinue={() => setFlow({ kind: "loading", integration: flow.integration })}
                />
            )}

            {flow.kind === "loading" && (
                <LoadingModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                />
            )}

            {flow.kind === "view" && (
                <ViewModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                    onDisconnect={() => setFlow({ kind: "disconnect", integration: flow.integration })}
                />
            )}

            {flow.kind === "disconnect" && (
                <DisconnectConfirm
                    integration={flow.integration}
                    onCancel={() => setFlow({ kind: "idle" })}
                    onConfirm={() => handleDisconnectConfirmed(flow.integration)}
                />
            )}
        </div>
    );
}
