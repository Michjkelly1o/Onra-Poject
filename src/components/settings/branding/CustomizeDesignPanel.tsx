"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize design settings (SlidePanel)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 7824:122617 (slide-panel shell) + 7624:315609 / 7627:317328 /
//        7628:324559 (step content) + 7667:16737 / 17041 / 17345 (template
//        preview tabs — Login / Home / Class).
//
// Refactored Jul 2026 (client): the multi-step form now opens as a
// right-anchored slide panel over the Branding landing page instead of a
// full-page route. Same animation as every other slide panel in the app
// (see `SlidePanel` — the primitive the POS "Add new customer" panel uses).
// Internal content, save action, and store integration are UNCHANGED from
// the previous page implementation — only the outer shell (SlidePanel +
// breadcrumb stepper + panel footer) is new.
//
// Panel layout (Figma 7824:122617):
//   • Header — title "Customize design settings" + close X (top-right)
//   • Breadcrumb stepper — horizontal, chevron-separated. Any step click
//                          jumps directly (no linear-only gate)
//   • Body — 2-column: form (flex-1) + preview panel (320 px, sticky)
//   • Footer — Cancel (left) + Save changes (right)

import { Fragment, useEffect, useRef, useState } from "react";
import {
    XClose, ChevronRight,
    UploadCloud02, Image01, Mail01, MessageChatCircle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { useAppStore, type BrandTypeface } from "@/lib/store";
import { brandTypefaceFontFamily, brandTypefaceLabel, brandTypefaceTagline } from "@/app/branding-fonts";

const NAMED_COLOR_LABELS: Record<string, string> = {
    "#000000": "Black",
    "#101828": "Black",
    "#ffffff": "White",
    "#fafafa": "Off white",
};

function colorLabelFor(hex: string): string {
    return NAMED_COLOR_LABELS[hex.toLowerCase()] ?? hex.toUpperCase();
}

const STEPS = [
    { n: 1, label: "Identity" },
    { n: 2, label: "Colors & typography" },
    { n: 3, label: "Messages & notifications" },
] as const;

const TYPEFACE_OPTIONS: BrandTypeface[] = [
    "dm_sans", "inter", "avenir", "playfair_display", "cormorant_garamond", "lora",
];

type PreviewTab = "login" | "home" | "class";

// ─── Panel ──────────────────────────────────────────────────────────────────

export function CustomizeDesignPanel({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const stored = useAppStore(s => s.brandingSettings);
    const updateBrandingSettings = useAppStore(s => s.updateBrandingSettings);
    const showToast = useAppStore(s => s.showToast);

    // ── Wizard state ──────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [previewTab, setPreviewTab] = useState<PreviewTab>("login");

    // ── Step 1 — Identity ─────────────────────────────────────────────────
    const [displayName, setDisplayName] = useState(stored.displayName);
    const [logoUrl,     setLogoUrl]     = useState(stored.logoUrl);
    const [appIconUrl,  setAppIconUrl]  = useState(stored.appIconUrl);
    const [favIconUrl,  setFavIconUrl]  = useState(stored.favIconUrl);

    // ── Step 2 — Colors & typography ──────────────────────────────────────
    const [primaryColor,    setPrimaryColor]    = useState(stored.primaryColor);
    const [backgroundColor, setBackgroundColor] = useState(stored.backgroundColor);
    const [tertiaryColor,   setTertiaryColor]   = useState(stored.tertiaryColor);
    const [textColor,       setTextColor]       = useState(stored.textColor);
    const [typeface,        setTypeface]        = useState<BrandTypeface>(stored.typeface);

    // ── Step 3 — Notification channels ────────────────────────────────────
    const [emailOn,    setEmailOn]    = useState(stored.notificationBranding.email);
    const [whatsappOn, setWhatsappOn] = useState(stored.notificationBranding.whatsapp);
    const [smsOn,      setSmsOn]      = useState(stored.notificationBranding.sms);

    function handleSave() {
        updateBrandingSettings({
            displayName: displayName.trim(),
            logoUrl,
            appIconUrl,
            favIconUrl,
            primaryColor,
            backgroundColor,
            tertiaryColor,
            textColor,
            textColorLabel: colorLabelFor(textColor),
            typeface,
            notificationBranding: { email: emailOn, whatsapp: whatsappOn, sms: smsOn },
        });
        showToast(
            "Design settings updated",
            "Your brand identity has been saved.",
            "success", "check",
        );
        onClose();
    }

    // Live preview data bag — passed to every template preview tab so they
    // all theme off the in-progress form state, not the saved store state.
    const previewBrand: PreviewBrand = {
        displayName, logoUrl,
        primaryColor, backgroundColor, tertiaryColor, textColor,
        typeface,
    };

    return (
        <SlidePanel open={open} onClose={onClose} width={960}>
            {/* Header — title + close X (top-right) per Figma 7824:122617. */}
            <div className="relative shrink-0 border-b border-[#e4e7ec] px-6 py-4">
                <div className="pr-10">
                    <p className="text-[18px] font-medium leading-[28px] text-[#101828]">
                        Customize design settings
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5 mt-1">
                        Set your brand identity, colors, and messaging across every touchpoint.
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="absolute top-3 right-4 w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>

            {/* Breadcrumb stepper — horizontal, chevron-separated. Any step
                click jumps directly (per Figma). */}
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 py-4 flex items-center gap-2">
                {STEPS.map((s, i) => (
                    <Fragment key={s.n}>
                        <button
                            type="button"
                            onClick={() => setStep(s.n as 1 | 2 | 3)}
                            className={cn(
                                "text-[14px] font-semibold py-1 px-1 transition-colors",
                                step === s.n
                                    ? "text-[#4f6e5d]"
                                    : "text-[#475467] hover:text-[#344054]",
                            )}
                        >
                            {s.label}
                        </button>
                        {i < STEPS.length - 1 && (
                            <ChevronRight className="w-4 h-4 text-[#98a2b3]" />
                        )}
                    </Fragment>
                ))}
            </div>

            {/* Body — 2-column: form + preview. Scrolls inside. */}
            <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
                <div className="flex gap-6 h-full items-stretch">
                    {/* Form (flex-1) */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {step === 1 && (
                            <IdentityStep
                                displayName={displayName} setDisplayName={setDisplayName}
                                logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                                appIconUrl={appIconUrl} setAppIconUrl={setAppIconUrl}
                                favIconUrl={favIconUrl} setFavIconUrl={setFavIconUrl}
                            />
                        )}
                        {step === 2 && (
                            <ColorsTypographyStep
                                primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                                backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                                tertiaryColor={tertiaryColor} setTertiaryColor={setTertiaryColor}
                                textColor={textColor} setTextColor={setTextColor}
                                typeface={typeface} setTypeface={setTypeface}
                            />
                        )}
                        {step === 3 && (
                            <NotificationsStep
                                emailOn={emailOn} setEmailOn={setEmailOn}
                                whatsappOn={whatsappOn} setWhatsappOn={setWhatsappOn}
                                smsOn={smsOn} setSmsOn={setSmsOn}
                            />
                        )}
                    </div>

                    {/* Preview panel — 320 px per Figma. */}
                    <div className="w-[320px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden flex flex-col">
                        <div className="px-5 pt-5 pb-3 shrink-0 border-b border-[#e4e7ec]">
                            <p className="font-semibold text-[16px] leading-[24px] text-[#101828]">Template preview</p>
                            <p className="text-[13px] text-[#6e776f] mt-1">This is how your class template will look like.</p>
                        </div>
                        <div className="px-5 pt-3 pb-3 shrink-0">
                            <PreviewTabs current={previewTab} onChange={setPreviewTab} />
                        </div>
                        <div className="flex-1 min-h-0 bg-[#f8f8f6] overflow-y-auto scrollbar-hide flex justify-center items-start py-4 px-2">
                            <PhoneMock>
                                <IframePreview tab={previewTab} brand={previewBrand} />
                            </PhoneMock>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer — Cancel left / Save right per Figma. */}
            <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
            </div>
        </SlidePanel>
    );
}

// ─── Step 1 — Identity ──────────────────────────────────────────────────────

function IdentityStep({
    displayName, setDisplayName, logoUrl, setLogoUrl,
    appIconUrl, setAppIconUrl, favIconUrl, setFavIconUrl,
}: {
    displayName: string; setDisplayName: (v: string) => void;
    logoUrl: string; setLogoUrl: (v: string) => void;
    appIconUrl: string; setAppIconUrl: (v: string) => void;
    favIconUrl: string; setFavIconUrl: (v: string) => void;
}) {
    return (
        <FormCard>
            <Section title="Brand name">
                <FormField label="Display name">
                    <TextInput value={displayName} onChange={setDisplayName} placeholder="Enter display name" />
                </FormField>
            </Section>

            <Section title="Logo & icons">
                <UploadRow
                    label="Primary logo"
                    hint="Full-colour logo with transparent background. PNG or JPEG · Up to 2 MB"
                    url={logoUrl}
                    onChange={setLogoUrl}
                />
                <UploadRow
                    label="App icon"
                    hint="PNG or JPEG · Up to 2 MB"
                    url={appIconUrl}
                    onChange={setAppIconUrl}
                />
                <UploadRow
                    label="Fav icon"
                    hint="PNG or JPEG · Up to 2 MB"
                    url={favIconUrl}
                    onChange={setFavIconUrl}
                />
            </Section>
        </FormCard>
    );
}

function UploadRow({ label, hint, url, onChange }: {
    label: string;
    hint: string;
    url: string;
    onChange: (v: string) => void;
}) {
    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => onChange(String(reader.result || ""));
        reader.readAsDataURL(file);
    }
    return (
        <div className="flex items-start gap-4 w-full">
            <div className="w-16 h-16 rounded-[8px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0 overflow-hidden">
                {url
                    ? <img src={url} alt="" className="w-full h-full object-contain" />
                    : <Image01 className="w-6 h-6 text-[#98a2b3]" />}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{label}</p>
                    <p className="text-[14px] text-[#475467] leading-5">{hint}</p>
                </div>
                <label className="cursor-pointer inline-flex">
                    <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={handleFile} />
                    <span className="inline-flex items-center gap-2 h-9 px-3 rounded-[8px] border-1 border-[#d0d5dd] bg-white text-[14px] font-semibold text-[#344054] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <UploadCloud02 className="w-4 h-4 text-[#475467]" />
                        Upload image
                    </span>
                </label>
            </div>
        </div>
    );
}

// ─── Step 2 — Colors & typography ───────────────────────────────────────────

function ColorsTypographyStep({
    primaryColor, setPrimaryColor, backgroundColor, setBackgroundColor,
    tertiaryColor, setTertiaryColor, textColor, setTextColor,
    typeface, setTypeface,
}: {
    primaryColor: string; setPrimaryColor: (v: string) => void;
    backgroundColor: string; setBackgroundColor: (v: string) => void;
    tertiaryColor: string; setTertiaryColor: (v: string) => void;
    textColor: string; setTextColor: (v: string) => void;
    typeface: BrandTypeface; setTypeface: (v: BrandTypeface) => void;
}) {
    return (
        <FormCard>
            <Section title="Brand colors">
                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Primary color">
                        <ColorInput value={primaryColor} onChange={setPrimaryColor} />
                    </FormField>
                    <FormField label="Background color">
                        <ColorInput value={backgroundColor} onChange={setBackgroundColor} />
                    </FormField>
                    <FormField label="Tertiary color">
                        <ColorInput value={tertiaryColor} onChange={setTertiaryColor} />
                    </FormField>
                    <FormField label="Text color">
                        <ColorInput value={textColor} onChange={setTextColor} />
                    </FormField>
                </div>
            </Section>

            <Section title="Typography">
                <FormField label="Choose a typeface">
                    <div className="grid grid-cols-2 gap-3">
                        {TYPEFACE_OPTIONS.map(t => (
                            <TypefaceCard
                                key={t}
                                typeface={t}
                                selected={typeface === t}
                                onClick={() => setTypeface(t)}
                            />
                        ))}
                    </div>
                </FormField>
            </Section>
        </FormCard>
    );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    // Normalise to hex so the native color picker accepts the seed value.
    const safe = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
    return (
        <div className="flex items-center gap-2 h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]">
            <label className="relative w-6 h-6 rounded-full shrink-0 cursor-pointer overflow-hidden">
                <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none z-10" />
                <div className="absolute inset-0 rounded-full" style={{ backgroundColor: safe }} />
                <input
                    type="color"
                    value={safe}
                    onChange={e => onChange(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    aria-label="Pick color"
                />
            </label>
            <input
                type="text"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="flex-1 h-full bg-transparent text-[14px] text-[#101828] focus:outline-none placeholder:text-[#667085]"
                placeholder="#RRGGBB"
            />
        </div>
    );
}

function TypefaceCard({ typeface, selected, onClick }: {
    typeface: BrandTypeface;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex flex-col items-start gap-1 p-4 rounded-[12px] text-left transition-colors relative",
                selected
                    ? "border-1 border-[#7ba08c] bg-[#f5fffa]"
                    : "border-1 border-[#e4e7ec] bg-white hover:border-[#d0d5dd]",
            )}
        >
            <span className="text-[12px] text-[#667085] leading-[18px]">{brandTypefaceLabel(typeface)}</span>
            <span
                className="text-[18px] text-[#101828] leading-[28px]"
                style={{ fontFamily: brandTypefaceFontFamily(typeface) }}
            >
                The quick brown fox
            </span>
            <span className="text-[12px] text-[#667085] leading-[18px]">{brandTypefaceTagline(typeface)}</span>
            <div className={cn(
                "absolute top-4 right-4 w-4 h-4 rounded-full flex items-center justify-center transition-colors",
                selected ? "bg-[#658774] text-white" : "bg-white border-1 border-[#d0d5dd]",
            )}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

// ─── Step 3 — Messages & notifications ──────────────────────────────────────

function NotificationsStep({
    emailOn, setEmailOn, whatsappOn, setWhatsappOn, smsOn, setSmsOn,
}: {
    emailOn: boolean; setEmailOn: (v: boolean) => void;
    whatsappOn: boolean; setWhatsappOn: (v: boolean) => void;
    smsOn: boolean; setSmsOn: (v: boolean) => void;
}) {
    return (
        <FormCard>
            <Section
                title="Notification channels"
                subtitle="Each channel carries your logo, colors, and display name. Toggle which ones use your branding."
            >
                <ChannelRow
                    title="Email"
                    subtitle="Booking confirmations, reminders, receipts"
                    icon={<Mail01 className="w-5 h-5 text-[#475467]" />}
                    iconBg="bg-white border-1 border-[#e4e7ec]"
                    on={emailOn}
                    onChange={() => setEmailOn(!emailOn)}
                />
                <ChannelRow
                    title="WhatsApp"
                    subtitle="Class reminders and booking updates"
                    icon={<WhatsAppGlyph />}
                    iconBg="bg-[#25D366]"
                    on={whatsappOn}
                    onChange={() => setWhatsappOn(!whatsappOn)}
                />
                <ChannelRow
                    title="SMS"
                    subtitle="Sender name shown to recipients"
                    icon={<MessageChatCircle className="w-5 h-5 text-[#475467]" />}
                    iconBg="bg-white border-1 border-[#e4e7ec]"
                    on={smsOn}
                    onChange={() => setSmsOn(!smsOn)}
                />
            </Section>
        </FormCard>
    );
}

function ChannelRow({ title, subtitle, icon, iconBg, on, onChange }: {
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBg: string;
    on: boolean;
    onChange: () => void;
}) {
    return (
        <div className="flex items-center gap-3 py-2">
            <div className={cn("w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0", iconBg)}>
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-5">{title}</p>
                <p className="text-[14px] text-[#475467] leading-5">{subtitle}</p>
            </div>
            <Toggle on={on} onChange={onChange} ariaLabel={`Toggle ${title}`} />
        </div>
    );
}

function WhatsAppGlyph() {
    return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
            <path d="M17.6 6.32A7.85 7.85 0 0 0 12.05 4C7.7 4 4.16 7.53 4.16 11.88a7.84 7.84 0 0 0 1.05 3.94L4.1 20l4.31-1.13a7.9 7.9 0 0 0 3.64.93h.01c4.35 0 7.89-3.54 7.89-7.89a7.83 7.83 0 0 0-2.34-5.59zm-5.55 12.13h-.01a6.5 6.5 0 0 1-3.32-.91l-.24-.14-2.56.67.68-2.5-.16-.26a6.5 6.5 0 0 1-1-3.47c0-3.6 2.94-6.53 6.55-6.53a6.54 6.54 0 0 1 6.54 6.55c0 3.6-2.93 6.59-6.48 6.59zm3.59-4.9c-.2-.1-1.16-.57-1.35-.64-.18-.06-.31-.1-.44.1-.13.2-.51.64-.62.77-.12.13-.23.15-.42.05-.2-.1-.83-.3-1.58-.97a5.95 5.95 0 0 1-1.1-1.36c-.11-.2-.01-.3.09-.4.09-.09.2-.23.3-.34.1-.12.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.06-.6-1.45-.16-.38-.32-.33-.44-.34h-.38a.73.73 0 0 0-.53.25c-.18.2-.7.68-.7 1.66 0 .98.71 1.92.82 2.06.1.13 1.4 2.14 3.4 3.01a11.7 11.7 0 0 0 1.13.42c.48.15.91.13 1.25.08.38-.06 1.16-.47 1.32-.93.17-.46.17-.85.12-.93-.06-.09-.18-.13-.38-.23z"/>
        </svg>
    );
}

function Toggle({ on, onChange, ariaLabel }: { on: boolean; onChange: () => void; ariaLabel: string }) {
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

// ─── Shared form chrome ─────────────────────────────────────────────────────

function FormCard({ children }: { children: React.ReactNode }) {
    // Footer removed Jul 2026 — Cancel + Save moved up to the panel-level
    // sticky footer per Figma 7824:122617.
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                {children}
            </div>
        </div>
    );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
                <p className="font-semibold text-[16px] leading-[24px] text-[#101828]">{title}</p>
                {subtitle && <p className="text-[14px] text-[#475467] leading-5">{subtitle}</p>}
            </div>
            <div className="flex flex-col gap-3">{children}</div>
        </div>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-medium text-[#344054] leading-5">{label}</span>
            {children}
        </div>
    );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all"
        />
    );
}

// ─── Preview tabs + Phone mock + Templates ──────────────────────────────────

interface PreviewBrand {
    displayName: string;
    logoUrl: string;
    primaryColor: string;
    backgroundColor: string;
    tertiaryColor: string;
    textColor: string;
    typeface: BrandTypeface;
}

function PreviewTabs({ current, onChange }: { current: PreviewTab; onChange: (t: PreviewTab) => void }) {
    const TABS: { key: PreviewTab; label: string }[] = [
        { key: "login", label: "Login" },
        { key: "home",  label: "Home"  },
        { key: "class", label: "Class" },
    ];
    return (
        <div className="flex items-center bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1 gap-1">
            {TABS.map(t => {
                const active = current === t.key;
                return (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => onChange(t.key)}
                        className={cn(
                            "flex-1 px-4 py-[6px] rounded-[8px] text-[14px] font-medium transition-all",
                            active
                                ? "bg-white text-[#101828] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                : "text-[#667085] hover:text-[#344054]",
                        )}
                    >
                        {t.label}
                    </button>
                );
            })}
        </div>
    );
}

/** iPhone-style outer frame — fixed 300×620 device so the inner layout
 *  stays consistent regardless of how tall the outer preview card grows.
 *  Inner children render inside the rounded viewport; Home + Class tabs
 *  scroll inside it. Now bezel-less: the dark frame was reading as
 *  visual noise, so the device is just the inner white viewport with
 *  a soft drop shadow + rounded corners. */
function PhoneMock({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-[300px] h-[620px] shrink-0 rounded-[28px] overflow-hidden bg-white relative shadow-[0px_12px_28px_-10px_rgba(16,24,40,0.18)] border-1 border-[#e4e7ec]">
            {children}
        </div>
    );
}


// ─── Iframe preview ─────────────────────────────────────────────────────────
// Renders the REAL customer screen (Login = /customer/welcome, Home =
// /customer, Class = /customer/classes/[first-schedule-id]) inside the
// device viewport by mounting an <iframe>. The iframe URL only carries the
// tab route + `?preview=1` gate — draft brand values (unsaved form state)
// stream in via `postMessage`, so:
//
//   • Uploaded logos (base64 data URLs, potentially 100KB+) cross the
//     boundary without breaking URL length limits.
//   • Colour scrubs / typeface picks / logo swaps DON'T reload the iframe
//     (no flash) — the customer-side `BrandTokens` listens for messages
//     and updates its state in place.
//   • Only a Login/Home/Class tab change triggers navigation.
//
// A `ready` handshake covers the mount race: the iframe posts
// `onra-brand-preview-ready` once mounted, and the parent replies with
// the current draft. See `BrandTokens` in src/components/customer/shell/
// for the receiver.
//
// An absolute overlay above the iframe blocks all pointer events (clicks,
// scrolls, focus) so the preview stays display-only — the admin can look
// but not accidentally navigate away, submit a login, or scroll a page
// out of view (client Jul 2026).

function IframePreview({ tab, brand }: { tab: PreviewTab; brand: PreviewBrand }) {
    // Grab the first available class schedule to build a real Class detail
    // route. Falls back to a stable placeholder id so the iframe still
    // resolves to a customer screen (the 404 branch renders friendly
    // chrome, which is fine as a "no data" preview state).
    const firstClassId = useAppStore(s => s.classSchedules[0]?.id) ?? "preview";

    const route =
        tab === "login" ? "/customer/welcome"
      : tab === "home"  ? "/customer"
      :                    `/customer/classes/${firstClassId}`;

    // URL only carries the preview gate — brand values arrive via message.
    // Include the tab in the src so switching tabs remounts the iframe
    // (React sees a different src prop and navigates).
    const src = `${route}?preview=1`;

    const iframeRef = useRef<HTMLIFrameElement | null>(null);

    // Build the payload once per render; used both by the "ready" reply
    // and the effect that broadcasts on every brand change.
    const payload = {
        primaryColor:    brand.primaryColor,
        backgroundColor: brand.backgroundColor,
        tertiaryColor:   brand.tertiaryColor,
        textColor:       brand.textColor,
        typeface:        brand.typeface,
        logoUrl:         brand.logoUrl,
        displayName:     brand.displayName,
    };

    // Rebroadcast on every brand change so live scrubs paint immediately.
    useEffect(() => {
        const win = iframeRef.current?.contentWindow;
        if (!win) return;
        win.postMessage({ type: "onra-brand-preview", payload }, "*");
        // payload fields listed exhaustively so this fires on any change.
    }, [payload.primaryColor, payload.backgroundColor, payload.tertiaryColor,
        payload.textColor, payload.typeface, payload.logoUrl, payload.displayName]);

    // Handshake — reply with the current payload when the iframe reports
    // ready (covers the mount race where the iframe finishes loading AFTER
    // the parent's initial useEffect ran).
    useEffect(() => {
        function onMessage(e: MessageEvent) {
            if (e.data?.type !== "onra-brand-preview-ready") return;
            if (e.source !== iframeRef.current?.contentWindow) return;
            iframeRef.current?.contentWindow?.postMessage(
                { type: "onra-brand-preview", payload },
                "*",
            );
        }
        window.addEventListener("message", onMessage);
        return () => window.removeEventListener("message", onMessage);
    }, [payload]);

    // Forward wheel events to the iframe's scrolling `<main>` element so
    // the admin can scroll the customer preview without unlocking clicks.
    // Same-origin iframe → contentDocument access is allowed (see sandbox
    // note below). The customer layout scrolls its `<main>` (not the
    // document), so we target that directly and fall back to the document
    // element for older screens.
    function forwardWheel(e: React.WheelEvent<HTMLDivElement>) {
        const doc = iframeRef.current?.contentDocument;
        if (!doc) return;
        const main = doc.querySelector("main") ?? doc.scrollingElement;
        if (main) {
            main.scrollTop += e.deltaY;
            main.scrollLeft += e.deltaX;
        }
    }

    return (
        <>
            <iframe
                ref={iframeRef}
                src={src}
                title={`Customer ${tab} preview`}
                className="absolute inset-0 w-full h-full border-0"
                // Extra broadcast on load — belt-and-suspenders on top of
                // the ready handshake, so late-loading iframes still get
                // the current draft even if their ready message got lost.
                onLoad={() => {
                    iframeRef.current?.contentWindow?.postMessage(
                        { type: "onra-brand-preview", payload },
                        "*",
                    );
                }}
                // Sandbox: `allow-same-origin` so BrandTokens can read the
                // parent's localStorage-backed Zustand store; `allow-scripts`
                // to actually execute the app. No `allow-forms` — the admin
                // preview is display-only; a stray tap on Login won't sign
                // anyone in.
                sandbox="allow-same-origin allow-scripts"
            />
            {/* Click blocker — the preview must not be interactive, but MUST
                stay scrollable so admin can see full Home / Class detail.
                Overlay sits above the iframe (z-10) and intercepts click /
                mousedown, then forwards wheel + touch scroll into the
                iframe's `<main>` scroll container. */}
            <div
                className="absolute inset-0 z-10 cursor-default select-none"
                aria-hidden="true"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onMouseDown={(e) => e.preventDefault()}
                onWheel={forwardWheel}
            />
        </>
    );
}
