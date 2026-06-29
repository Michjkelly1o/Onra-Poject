"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Payments tab (inside the unified Integrations module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: 7564:188282 (Payments tab — gateway + payment methods +
// other methods + add-provider footer card). Stripe-connected variant:
// 7564:190092.
//
// Renders inside /admin/settings/integrations as the Payments tab. The
// modal chain (Connect / Loading / View / Enable / Disconnect) is
// PRESERVED VERBATIM from the previous standalone /admin/settings/payments
// page — only the body layout changed. Store actions + cascade rules are
// unchanged.

import { useEffect, useState } from "react";
import { XClose, InfoCircle, BankNote01, CreditCardCheck, Plus } from "@untitledui/icons";
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
    // ── Additions per Figma 7564:188282 ────────────────────────────────────
    cards: {
        // Mastercard glyph is the most-recognisable "cards" mark from the
        // Figma; iconify provides a clean SVG.
        logo: "https://api.iconify.design/logos:mastercard.svg",
        defaultAccountLabel: "Cards via Stripe",
        viewFields: [
            { label: "Provider", value: "Stripe" },
            { label: "Networks", value: "Visa, Mastercard, Amex" },
        ],
        enableSubtitle: "This will enable cards (Visa, Mastercard, Amex) on the checkout.",
    },
    cash: {
        // Cash + Bank transfer render with a simple icon tile inside the
        // body (BankNote01 / CreditCardCheck) instead of the iconify SVG
        // logos used by branded providers. The `logo` URL here is unused
        // for these manual methods (the modal swaps to the ManualMethodIcon
        // tile based on provider.kind === "manual"). Set to empty string
        // to keep the type happy.
        logo: "",
        defaultAccountLabel: "Front-desk cash drawer",
        viewFields: [
            { label: "Provider", value: "Manual" },
            { label: "Type",     value: "Cash / Pay at studio" },
        ],
        enableSubtitle: "This will let customers pay in cash at the front desk.",
    },
    bank_transfer: {
        logo: "",
        defaultAccountLabel: "Manual bank reconciliation",
        viewFields: [
            { label: "Provider", value: "Manual" },
            { label: "Type",     value: "Bank transfer" },
        ],
        enableSubtitle: "This will let customers pay by bank transfer, reconciled manually.",
    },
};

function configFor(p: PaymentProvider): ProviderConfig {
    return PROVIDER_CONFIG[p.slug];
}

// ─── Toggle (Figma 7564:188282 — payment-method rows + Other methods) ──────
//
// Lightweight pill toggle matching the Figma rest state (16px white knob
// inside 36×20 grey track) + sage-green active state (#658774 track).
// Inline here because the Payments tab is the only consumer in this
// module and the chrome differs subtly from other toggles in the codebase
// (smaller knob, no shadow rim).

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            onClick={onClick}
            className={cn(
                "relative w-9 h-5 rounded-full transition-colors shrink-0 flex items-center px-0.5",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}
        >
            <span
                className={cn(
                    "block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                    on ? "translate-x-4" : "translate-x-0",
                )}
            />
        </button>
    );
}

// ─── Manual-method icon tile (Cash / Bank transfer) ────────────────────────
// Rendered instead of LogoTile for the manual payment methods — no brand
// SVG to display, so we show a clean icon inside the same 46×32 tile chrome.

function ManualMethodIcon({ slug }: { slug: PaymentProviderSlug }) {
    const Icon = slug === "cash" ? BankNote01 : CreditCardCheck;
    return (
        <div className="w-[46px] h-8 rounded-[4px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-[#475467]" />
        </div>
    );
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
                {/* Header — centered logo + centered title + subtitle.
                    Border between header and footer dropped per client
                    feedback so the modal reads as a single visual unit. */}
                <div className="pt-6 px-6 pb-5 relative flex flex-col items-center gap-4">
                    {/* Manual methods (Cash / Bank transfer) have no brand
                        SVG logo — swap to the same icon tile the row uses
                        so the modal logo matches what the admin tapped. */}
                    {provider.kind === "manual"
                        ? <div className="w-[58px] h-10 rounded-[6px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0">
                            {provider.slug === "cash"
                                ? <BankNote01 className="w-5 h-5 text-[#475467]" />
                                : <CreditCardCheck className="w-5 h-5 text-[#475467]" />}
                          </div>
                        : <LogoTile provider={provider} size="modal" />}
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
                {/* Footer — no border-top, header carries no border-bottom */}
                <div className="px-6 pb-6 flex gap-3">
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

export function PaymentsTab() {
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

    // Group providers per Figma:
    //   • gatewayBlock — Stripe + its three wallets (Cards, Apple Pay,
    //     Google Pay). Rendered as one bordered card with the gateway at
    //     the top and the wallets as rows beneath a "Payment methods"
    //     sub-header.
    //   • manualBlock — Cash + Bank transfer. Standalone "Other methods"
    //     card with their own toggles (no gateway dependency).
    const stripe       = paymentProviders.find(p => p.slug === "stripe");
    const stripeWallets = paymentProviders.filter(p =>
        p.kind === "wallet" && p.requiresProviderSlug === "stripe",
    );
    const manualMethods = paymentProviders.filter(p => p.kind === "manual");
    const stripeConnected = stripe?.status === "connected";

    /** Single toggle handler shared by wallet rows (Cards / Apple Pay /
     *  Google Pay) and manual rows (Cash / Bank transfer). EVERY toggle —
     *  enable or disable — surfaces a confirmation modal first so the
     *  admin can't accidentally flip a payment method on the customer
     *  checkout. Per client direction: no silent toggles.
     *    • Enable  → EnableWalletModal (centered logo + "Enable X?" + Cancel/Enable)
     *    • Disable → DisconnectConfirm (cascade warning if applicable + Disconnect) */
    function handlePaymentToggle(p: PaymentProvider) {
        if (p.status === "connected") {
            setFlow({ kind: "disconnect", provider: p });
        } else {
            setFlow({ kind: "enable_wallet", provider: p });
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {/* ── Gateway block: Stripe + payment-method rows ─────────── */}
            {stripe && (
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                    {/* Stripe row — Connect or View / Disconnect actions */}
                    <div className="px-6 py-5 flex items-center gap-4">
                        <LogoTile provider={stripe} size="card" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[16px] font-semibold text-[#101828] leading-6">{stripe.name}</p>
                            <p className="text-[14px] text-[#6e776f] leading-5">{stripe.description}</p>
                        </div>
                        {stripeConnected ? (
                            <div className="flex items-center gap-3 shrink-0">
                                <Button variant="secondary-gray" size="md" onClick={() => setFlow({ kind: "view", provider: stripe })}>View</Button>
                                <Button variant="destructive-secondary" size="md" onClick={() => setFlow({ kind: "disconnect", provider: stripe })}>Disconnect</Button>
                            </div>
                        ) : (
                            <Button variant="secondary-gray" size="md" className="shrink-0" onClick={() => setFlow({ kind: "connect", provider: stripe })}>
                                Connect
                            </Button>
                        )}
                    </div>

                    {/* "Payment methods" sub-header + the 3 wallet rows */}
                    <div className="border-t border-[#e4e7ec]" />
                    <div className="px-6 pt-4 pb-2">
                        <p className="text-[14px] font-medium text-[#475467]">Payment methods</p>
                    </div>
                    {stripeWallets.map((w, i) => (
                        <div key={w.id}>
                            {i > 0 && <div className="border-t border-[#e4e7ec]" />}
                            <div className="px-6 py-4 flex items-center gap-4">
                                <LogoTile provider={w} size="card" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[16px] font-semibold text-[#101828] leading-6">{w.name}</p>
                                    <p className="text-[14px] text-[#6e776f] leading-5">{w.description}</p>
                                </div>
                                {stripeConnected ? (
                                    <Toggle on={w.status === "connected"} onClick={() => handlePaymentToggle(w)} />
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#dc6803] shrink-0">
                                        <InfoCircle className="w-4 h-4" />
                                        via Stripe
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Other methods block: Cash + Bank transfer ──────────── */}
            {manualMethods.length > 0 && (
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                    <div className="px-6 pt-5 pb-3 flex flex-col gap-0.5">
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">Other methods</p>
                        <p className="text-[14px] text-[#6e776f] leading-5">No providers needed</p>
                    </div>
                    {manualMethods.map((m, i) => (
                        <div key={m.id}>
                            <div className={cn("border-t border-[#e4e7ec]", i === 0 && "border-t")} />
                            <div className="px-6 py-4 flex items-center gap-4">
                                <ManualMethodIcon slug={m.slug} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[16px] font-semibold text-[#101828] leading-6">{m.name}</p>
                                    <p className="text-[14px] text-[#6e776f] leading-5">{m.description}</p>
                                </div>
                                <Toggle on={m.status === "connected"} onClick={() => handlePaymentToggle(m)} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Add a payment provider footer ──────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                <div className="px-6 py-5 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">Add a payment provider</p>
                        <p className="text-[14px] text-[#6e776f] leading-5">
                            UAE options : Tap Payments, Pay Tabs, Telr, Network International (N-Genius) · BNPL: Tabby, Tamara
                        </p>
                    </div>
                    {/* Placeholder per the brief — no real navigation yet. */}
                    <Button
                        variant="primary"
                        size="md"
                        className="shrink-0"
                        leftIcon={<Plus className="w-4 h-4" />}
                        onClick={() => showToast(
                            "Coming soon",
                            "Additional provider connections will land in a future release.",
                            "success", "check",
                        )}
                    >
                        Add provider
                    </Button>
                </div>
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
