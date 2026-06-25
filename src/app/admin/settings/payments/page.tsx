"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payments module (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • List view (3-col card grid)         — 4108-87030
//   • Connected card state                 — 5360-60337
//   • Connect Stripe modal                 — 4108-87633
//   • Loading modal — "I already have"     — 4108-87842
//   • Loading modal — "I need to create"   — 4108-119779
//   • Success toast                        — 4108-120051
//   • View modal — Stripe account details  — 4108-119070
//   • Enable Apple Pay / Google Pay        — 4108-132536
//   • Disconnect toast                     — (same shell as Integrations)
//
// Phase 2 scope (Brief §2):
//   ✓ Stripe Connect modal — radio between "I already have a Stripe account"
//      and "I need to create a Stripe account" + Cancel/Continue
//   ✓ Loading modal — auto-resolves after LOADING_MS, opens the right
//      Stripe URL in a new tab (login vs register based on radio choice),
//      flips state, fires success toast
//   ✓ View modal — Status / Account / Business / Connected date with
//      Cancel + Disconnect footer
//   ✓ Apple Pay / Google Pay Enable action modal — centered logo,
//      "Enable [Wallet]?" + "This will enable all of customer to pay with
//      [Wallet] on the checkout." + Cancel/Enable
//   ✓ Disconnect modal — gateway cascade warning + error-tone toast
//   ✓ Single discriminated-union state machine drives the entire chain

import { useEffect, useState } from "react";
import { XClose, InfoCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    useAppStore,
    type PaymentProvider, type PaymentProviderSlug,
} from "@/lib/store";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ─── Per-provider config (logo + Connect modal + View fields) ───────────────

interface ProviderConfig {
    logo: string;
    /** Connect-modal subtitle (gateways only). */
    connectSubtitle?: string;
    /** Consent URL opened in a new tab after the Loading modal resolves.
     *  For Stripe we have two — one for "I already have" (login) and one
     *  for "I need to create" (signup). Wallets enable in-app so no URL. */
    consentUrlExisting?: string;
    consentUrlCreate?: string;
    /** Default account label persisted on connect/enable — shown in the
     *  View modal's Account row. */
    defaultAccountLabel: string;
    /** Per-provider middle rows in the View modal (Status + Connected
     *  date are always rendered around these). */
    viewFields: { label: string; value: string }[];
    /** Enable-wallet modal subtitle (wallets only). */
    enableSubtitle?: string;
}

const PROVIDER_CONFIG: Record<PaymentProviderSlug, ProviderConfig> = {
    stripe: {
        logo: "https://api.iconify.design/logos:stripe.svg",
        connectSubtitle: "Connect your Stripe account to start accepting payments",
        consentUrlExisting: "https://dashboard.stripe.com/login",
        consentUrlCreate:   "https://dashboard.stripe.com/register",
        defaultAccountLabel: "studio@example.com",
        viewFields: [
            { label: "Account",  value: "studio@example.com" },
            { label: "Business", value: "Forma studio" },
        ],
    },
    apple_pay: {
        logo: "https://api.iconify.design/logos:apple-pay.svg",
        defaultAccountLabel: "merchant.com.formastudio",
        viewFields: [
            { label: "Account",  value: "merchant.com.formastudio" },
            { label: "Provider", value: "Stripe" },
        ],
        enableSubtitle: "This will enable all of customer to pay with Apple Pay on the checkout.",
    },
    google_pay: {
        logo: "https://api.iconify.design/logos:google-pay.svg",
        defaultAccountLabel: "Google Pay merchant account",
        viewFields: [
            { label: "Account",  value: "BCR2DN4T***QZX9" },
            { label: "Provider", value: "Stripe" },
        ],
        enableSubtitle: "This will enable all of customer to pay with Google Pay on the checkout.",
    },
};

function configFor(p: PaymentProvider): ProviderConfig {
    return PROVIDER_CONFIG[p.slug];
}

// ─── Logo tiles — three sizes ───────────────────────────────────────────────

function LogoTile({ provider, size = "card" }: {
    provider: PaymentProvider;
    /** "card" = 46×32 (Figma 7182:21589 — payment cards · view modal header).
     *  "modal" = 58×40 (Figma 5282:255678 — Enable wallet modal centered).
     *  "loading" = 34×24 (Figma 5360:62349 — Loading skeleton illustration). */
    size?: "card" | "modal" | "loading";
}) {
    const cfg = configFor(provider);
    return (
        <div className={cn(
            "relative rounded-[4px] border-1 border-[#e4e7ec] bg-white overflow-hidden flex items-center justify-center shrink-0",
            size === "card"    && "w-[46px] h-8",
            size === "modal"   && "w-[58px] h-10 rounded-[6px]",
            size === "loading" && "w-[34px] h-6",
        )}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={cfg.logo}
                alt={provider.name}
                className="max-w-[80%] max-h-[80%] object-contain"
                loading="lazy"
            />
        </div>
    );
}

/** Hoverable info icon shown next to the wallet name when Stripe isn't
 *  connected. Tooltip uses the same dark-pill pattern as the rest of the
 *  app (see `CsSpotCircle` in ScheduleFormPage) — CSS-only show/hide via
 *  `group-hover` so no state is needed. */
function RequiresStripeTooltip() {
    return (
        <span className="relative group inline-flex items-center" tabIndex={0} aria-label="Requires Stripe to be connected to enable">
            <InfoCircle className="w-4 h-4 text-[#dc6803] shrink-0 cursor-help" />
            <span className="absolute left-1/2 -translate-x-1/2 -top-[34px] z-20 whitespace-nowrap bg-[#101828] text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                Requires Stripe to be connected to enable
                <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#101828]" />
            </span>
        </span>
    );
}

// ─── Card ───────────────────────────────────────────────────────────────────

function ProviderCard({ provider, gatewayConnected, onConnect, onEnable, onView, onDisconnect }: {
    provider: PaymentProvider;
    gatewayConnected: boolean;
    onConnect: (p: PaymentProvider) => void;
    onEnable: (p: PaymentProvider) => void;
    onView: (p: PaymentProvider) => void;
    onDisconnect: (p: PaymentProvider) => void;
}) {
    const connected = provider.status === "connected";
    const isWallet = provider.kind === "wallet";
    const showStripeHint = isWallet && !connected && !gatewayConnected;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 w-full">
            <div className="relative flex flex-col gap-4 w-full">
                <LogoTile provider={provider} size="card" />
                <div className="flex flex-col gap-1 w-full pr-[88px]">
                    <div className="flex items-center gap-1.5">
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">{provider.name}</p>
                        {showStripeHint && <RequiresStripeTooltip />}
                    </div>
                    <p className="text-[14px] text-[#6e776f] leading-5">{provider.description}</p>
                </div>
                <div className="absolute top-0 right-0">
                    <StatusBadge type="payment" status={connected ? "connected" : "disconnected"} size="sm" />
                </div>
            </div>

            {connected ? (
                <div className="flex items-center gap-4 w-full">
                    <Button variant="secondary-gray" size="md" className="flex-1" onClick={() => onView(provider)}>
                        View
                    </Button>
                    <Button variant="destructive-secondary" size="md" className="flex-1" onClick={() => onDisconnect(provider)}>
                        Disconnect
                    </Button>
                </div>
            ) : isWallet ? (
                <Button
                    variant="secondary-gray"
                    size="md"
                    className="w-full"
                    disabled={!gatewayConnected}
                    onClick={() => onEnable(provider)}>
                    Enable
                </Button>
            ) : (
                <Button variant="secondary-gray" size="md" className="w-full" onClick={() => onConnect(provider)}>
                    Connect
                </Button>
            )}
        </div>
    );
}

// ─── Modal shell (shared with Connect / View) ───────────────────────────────

function ModalShell({ title, subtitle, onClose, children, footer, width = 560 }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer: React.ReactNode;
    width?: number;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div
                className="relative bg-white rounded-[16px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
                style={{ width }}>
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
                <div className="px-6 py-5">{children}</div>
                <div className="border-t border-[#e4e7ec] px-6 py-5">{footer}</div>
            </div>
        </div>
    );
}

// ─── Connect modal (Figma 4108-87633) — Stripe only ─────────────────────────

function ConnectModal({ provider, onContinue, onClose }: {
    provider: PaymentProvider;
    /** `createNew` = true when the user picked "I need to create a Stripe
     *  account" — the Loading modal swaps the subtitle copy + the consent
     *  URL routes to register instead of login. */
    onContinue: (createNew: boolean) => void;
    onClose: () => void;
}) {
    const cfg = configFor(provider);
    // Default to "I already have" — matches Figma 4108:110751 (sage-green
    // border + filled radio dot).
    const [createNew, setCreateNew] = useState(false);
    return (
        <ModalShell
            title={`Connect ${provider.name}`}
            subtitle={cfg.connectSubtitle}
            onClose={onClose}
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={() => onContinue(createNew)}>
                        Continue
                    </Button>
                </div>
            }
        >
            <div className="flex flex-col gap-4">
                <h4 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Choose your option</h4>
                <RadioCard
                    selected={!createNew}
                    label={`I already have a ${provider.name} account`}
                    onSelect={() => setCreateNew(false)}
                />
                <RadioCard
                    selected={createNew}
                    label={`I need to create a ${provider.name} account`}
                    onSelect={() => setCreateNew(true)}
                />
            </div>
        </ModalShell>
    );
}

function RadioCard({ selected, label, onSelect }: {
    selected: boolean; label: string; onSelect: () => void;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "w-full flex items-center p-4 rounded-[12px] bg-white transition-all text-left",
                selected
                    ? "border-2 border-[#658774]"
                    : "border-1 border-[#e4e7ec] hover:bg-[#fafafa]",
            )}>
            <span className="flex-1 text-[16px] font-medium text-[#344054]">{label}</span>
            <span className={cn(
                "w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                selected ? "bg-[#658774]" : "border-1 border-[#d0d5dd] bg-white",
            )}>
                {selected && <span className="w-2 h-2 rounded-full bg-white" />}
            </span>
        </button>
    );
}

// ─── Loading modal (Figma 4108-87842 / 4108-119779) ─────────────────────────

function LoadingModal({ provider, createNew, onClose }: {
    provider: PaymentProvider;
    createNew: boolean;
    onClose: () => void;
}) {
    // Subtitle varies by radio choice (Figma diff between 4108-87842 and 4108-119779)
    const subtitle = createNew
        ? `You'll be redirected to ${provider.name} to create an account and authorize the payment method.`
        : `You'll be redirected to ${provider.name} to authorize and access your account.`;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[560px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col items-center px-6 py-20 overflow-hidden">
                {/* Skeleton illustration card — payment-card variant (Figma
                    5360:62349 — wider than the Integrations Loading variant,
                    with the logo top-left + two skeleton text columns + a
                    skeleton button on the right). */}
                <div className="bg-[#f9fafb] rounded-[16px] h-[150px] w-[320px] flex flex-col justify-between p-3 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] mb-6">
                    <div className="bg-white rounded-[10.18px] w-[50.9px] h-[50.9px] flex items-center justify-center shadow-[0px_1.48px_3.82px_rgba(0,0,0,0.02),-2.96px_4.44px_10.18px_rgba(0,0,0,0.02)]">
                        <LogoTile provider={provider} size="loading" />
                    </div>
                    <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col gap-2 w-[100px]">
                            <div className="h-[13px] rounded-full bg-[#f2f4f7] w-full" />
                            <div className="h-[13px] rounded-full bg-[#f2f4f7] w-[32px]" />
                        </div>
                        <div className="h-[18px] rounded-full bg-[#f2f4f7] w-[64px]" />
                    </div>
                </div>

                <div className="flex flex-col items-center gap-1 text-center max-w-[352px]">
                    <p className="font-semibold text-[16px] leading-6 text-[#101828]">
                        Redirecting to {provider.name} account...
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        {subtitle}
                    </p>
                </div>
            </div>
        </div>
    );
}

// ─── View modal (Figma 4108-119070) ─────────────────────────────────────────

function formatConnectedAt(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    return `${date} - ${time}`;
}

function ViewModal({ provider, onDisconnect, onClose }: {
    provider: PaymentProvider;
    onDisconnect: () => void;
    onClose: () => void;
}) {
    const cfg = configFor(provider);
    return (
        <ModalShell
            title={`${provider.name} account details`}
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
                <ViewField label="Status" value="Connected" valueColor="text-[#079455]" />
                {cfg.viewFields.map(f => (
                    <ViewField key={f.label} label={f.label} value={f.value} />
                ))}
                <ViewField
                    label="Connected date"
                    value={formatConnectedAt(provider.connectedAt)}
                />
            </div>
        </ModalShell>
    );
}

function ViewField({ label, value, valueColor }: {
    label: string; value: string; valueColor?: string;
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

// ─── Enable wallet modal (Figma 4108-132536) ────────────────────────────────

function EnableWalletModal({ provider, onConfirm, onClose }: {
    provider: PaymentProvider;
    onConfirm: () => void;
    onClose: () => void;
}) {
    const cfg = configFor(provider);
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[400px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header — centered logo + centered title + subtitle */}
                <div className="pt-6 px-6 pb-5 border-b border-[#e4e7ec] relative flex flex-col items-center gap-4">
                    <LogoTile provider={provider} size="modal" />
                    <div className="flex flex-col items-center gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            Enable {provider.name}?
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-5">
                            {cfg.enableSubtitle}
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                {/* Footer */}
                <div className="px-6 pt-6 pb-6 flex gap-3">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" onClick={onConfirm}>Enable</Button>
                </div>
            </div>
        </div>
    );
}

// ─── Disconnect confirmation ────────────────────────────────────────────────

function DisconnectConfirm({ provider, cascadeWalletNames, onConfirm, onCancel }: {
    provider: PaymentProvider;
    cascadeWalletNames: string[];
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
                <div className="flex flex-col items-center gap-4 pt-6 px-6">
                    <LogoTile provider={provider} size="card" />
                    <div className="flex flex-col gap-1 text-center w-full">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            {provider.kind === "gateway" ? "Disconnect" : "Disable"} {provider.name}?
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            <span className="font-medium text-[#344054]">{provider.name}</span>
                            {" "}will stop processing payments at the studio. You can re-{provider.kind === "gateway" ? "connect" : "enable"} at any time.
                        </p>
                        {cascadeWalletNames.length > 0 && (
                            <p className="text-[14px] text-[#dc6803] leading-[20px] mt-2">
                                {cascadeWalletNames.join(" and ")} will also be disabled because they require {provider.name}.
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="destructive" size="lg" className="flex-1" onClick={onConfirm}>
                        {provider.kind === "gateway" ? "Disconnect" : "Disable"}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

// Discriminated-union state machine covering every modal step. Same
// pattern as the Integrations module's FlowState — clean and exhaustive.
type FlowState =
    | { kind: "idle" }
    | { kind: "connect"; provider: PaymentProvider }
    | { kind: "loading"; provider: PaymentProvider; createNew: boolean }
    | { kind: "view"; provider: PaymentProvider }
    | { kind: "enable_wallet"; provider: PaymentProvider }
    | { kind: "disconnect"; provider: PaymentProvider };

const LOADING_MS = 1500;

export default function PaymentsPage() {
    const paymentProviders = useAppStore(s => s.paymentProviders);
    const connectPaymentProvider = useAppStore(s => s.connectPaymentProvider);
    const disconnectPaymentProvider = useAppStore(s => s.disconnectPaymentProvider);
    const showToast = useAppStore(s => s.showToast);

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Loading auto-resolves: closes modal, opens consent URL (login vs
    // register based on radio), flips state, fires success toast.
    useEffect(() => {
        if (flow.kind !== "loading") return;
        const provider = flow.provider;
        const createNew = flow.createNew;
        const cfg = configFor(provider);
        const t = setTimeout(() => {
            const consentUrl = createNew ? cfg.consentUrlCreate : cfg.consentUrlExisting;
            if (consentUrl) {
                try {
                    window.open(consentUrl, "_blank", "noopener,noreferrer");
                } catch {
                    // Popup blocked — in-app flow still completes.
                }
            }
            connectPaymentProvider(provider.id, cfg.defaultAccountLabel);
            showToast(
                `${provider.name} connected successfully`,
                `Your ${provider.name} account is now connected!`,
                "success", "check",
            );
            setFlow({ kind: "idle" });
        }, LOADING_MS);
        return () => clearTimeout(t);
    }, [flow, connectPaymentProvider, showToast]);

    function gatewayConnectedFor(p: PaymentProvider): boolean {
        if (p.kind === "gateway") return true;
        const gw = paymentProviders.find(x => x.slug === p.requiresProviderSlug);
        return gw?.status === "connected";
    }

    function handleEnableConfirmed(p: PaymentProvider) {
        const cfg = configFor(p);
        connectPaymentProvider(p.id, cfg.defaultAccountLabel);
        showToast(
            `${p.name} enabled successfully`,
            `${p.name} is now enabled for POS payments.`,
            "success", "check",
        );
        setFlow({ kind: "idle" });
    }

    function handleDisconnectConfirmed(p: PaymentProvider) {
        const cascadedNames = p.kind === "gateway"
            ? paymentProviders
                .filter(x => x.requiresProviderSlug === p.slug && x.status === "connected")
                .map(x => x.name)
            : [];
        disconnectPaymentProvider(p.id);
        if (cascadedNames.length > 0) {
            showToast(
                `${p.name} account has been disconnected`,
                `${cascadedNames.join(" and ")} ${cascadedNames.length === 1 ? "was" : "were"} also disabled because they require ${p.name}.`,
                "error", "slash",
            );
        } else {
            showToast(
                `${p.name} account has been disconnected`,
                `${p.name} account information and access has been remove.`,
                "error", "slash",
            );
        }
        setFlow({ kind: "idle" });
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Section header (Figma 4108:87084) */}
            <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828] leading-6">Payment method</p>
                <p className="text-[14px] text-[#6e776f] leading-5">
                    View and update your payment details
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paymentProviders.map(p => (
                    <ProviderCard
                        key={p.id}
                        provider={p}
                        gatewayConnected={gatewayConnectedFor(p)}
                        onConnect={int    => setFlow({ kind: "connect",       provider: int })}
                        onEnable={int     => setFlow({ kind: "enable_wallet", provider: int })}
                        onView={int       => setFlow({ kind: "view",          provider: int })}
                        onDisconnect={int => setFlow({ kind: "disconnect",    provider: int })}
                    />
                ))}
            </div>

            {/* ── Modal chain ──────────────────────────────────────────── */}

            {flow.kind === "connect" && (
                <ConnectModal
                    provider={flow.provider}
                    onClose={() => setFlow({ kind: "idle" })}
                    onContinue={createNew => setFlow({ kind: "loading", provider: flow.provider, createNew })}
                />
            )}

            {flow.kind === "loading" && (
                <LoadingModal
                    provider={flow.provider}
                    createNew={flow.createNew}
                    onClose={() => setFlow({ kind: "idle" })}
                />
            )}

            {flow.kind === "view" && (
                <ViewModal
                    provider={flow.provider}
                    onClose={() => setFlow({ kind: "idle" })}
                    onDisconnect={() => setFlow({ kind: "disconnect", provider: flow.provider })}
                />
            )}

            {flow.kind === "enable_wallet" && (
                <EnableWalletModal
                    provider={flow.provider}
                    onClose={() => setFlow({ kind: "idle" })}
                    onConfirm={() => handleEnableConfirmed(flow.provider)}
                />
            )}

            {flow.kind === "disconnect" && (
                <DisconnectConfirm
                    provider={flow.provider}
                    cascadeWalletNames={
                        flow.provider.kind === "gateway"
                            ? paymentProviders
                                .filter(x => x.requiresProviderSlug === flow.provider.slug && x.status === "connected")
                                .map(x => x.name)
                            : []
                    }
                    onCancel={() => setFlow({ kind: "idle" })}
                    onConfirm={() => handleDisconnectConfirmed(flow.provider)}
                />
            )}
        </div>
    );
}
