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

import { Fragment, useState } from "react";
import {
    XClose, ChevronLeft, ChevronRight, Share02,
    ClockFastForward, Users01, UserCheck01, Grid01,
    CheckCircle, MarkerPin01, UploadCloud02, Image01,
    SearchSm, ShoppingBag03, User01, HomeLine, Mail01, MessageChatCircle,
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
                                {previewTab === "login" && <LoginPreview brand={previewBrand} />}
                                {previewTab === "home"  && <HomePreview  brand={previewBrand} />}
                                {previewTab === "class" && <ClassPreview brand={previewBrand} />}
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

// ─── Login preview ──────────────────────────────────────────────────────────
// Figma 7627:316999 — phone screen with logo + display name centered on a
// soft background → primary gradient that rises through the lower 60%, with
// "powered by Onra" at the foot. The Forma-logo glyph is the placeholder
// when the admin hasn't uploaded a custom logo yet.

function LoginPreview({ brand }: { brand: PreviewBrand }) {
    const fontFamily = brandTypefaceFontFamily(brand.typeface);
    return (
        <div
            className="absolute inset-0 flex flex-col"
            style={{
                backgroundColor: brand.backgroundColor,
                color: brand.textColor,
                fontFamily,
                backgroundImage: `linear-gradient(180deg, ${brand.backgroundColor} 0%, ${brand.backgroundColor} 40%, ${brand.primaryColor}cc 100%)`,
            }}
        >
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
                <div className="w-20 h-20 flex items-center justify-center">
                    {brand.logoUrl
                        ? <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
                        : <FormaGlyph color={brand.textColor} />}
                </div>
                <p className="text-[32px] font-semibold leading-[40px] tracking-[-0.01em]">
                    {brand.displayName || "Forma"}
                </p>
            </div>
            <div className="shrink-0 flex items-center justify-center pb-7 pt-2">
                <p className="text-[13px] font-medium opacity-50 flex items-center gap-1.5" style={{ color: brand.textColor }}>
                    <span>powered by</span>
                    <OnraGlyph color={brand.textColor} />
                    <span>Onra</span>
                </p>
            </div>
        </div>
    );
}

/** Default "Forma" 4-quadrant logo glyph rendered when the admin hasn't
 *  uploaded their own logo. Recolors with brand.textColor so it reads
 *  on any background. */
function FormaGlyph({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 56 56" className="w-full h-full" aria-hidden="true">
            <g fill={color}>
                <path d="M28 4 C20 4, 16 8, 16 16 C16 20, 18 22, 22 22 C26 22, 28 24, 28 28 C28 24, 30 22, 34 22 C38 22, 40 20, 40 16 C40 8, 36 4, 28 4 Z" />
                <path d="M28 28 C28 24, 30 22, 34 22 C38 22, 40 24, 40 28 C40 36, 36 40, 28 40 C20 40, 16 36, 16 28 C16 24, 18 22, 22 22 C26 22, 28 24, 28 28 Z" opacity="0.55" />
                <path d="M28 52 C20 52, 16 48, 16 40 C16 36, 18 34, 22 34 C26 34, 28 32, 28 28 C28 32, 30 34, 34 34 C38 34, 40 36, 40 40 C40 48, 36 52, 28 52 Z" opacity="0.35" />
            </g>
        </svg>
    );
}

/** Tiny "✦ Onra" logomark next to the powered-by footer text. */
function OnraGlyph({ color }: { color: string }) {
    return (
        <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true">
            <path
                d="M6 0 L7 5 L12 6 L7 7 L6 12 L5 7 L0 6 L5 5 Z"
                fill={color}
                opacity="0.6"
            />
        </svg>
    );
}

// ─── Home preview ───────────────────────────────────────────────────────────
// Figma 7627:317355 — All Branches picker → What's on card with countdown +
// stock image → Instructor cards with photos → Categories tiles with
// activity images → sticky Book class CTA → 4-icon bottom nav. Scrolls
// vertically inside the device frame.

function HomePreview({ brand }: { brand: PreviewBrand }) {
    const fontFamily = brandTypefaceFontFamily(brand.typeface);
    return (
        <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
                backgroundColor: brand.backgroundColor,
                color: brand.textColor,
                fontFamily,
            }}
        >
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-4 pb-[160px] px-4 pt-5">
                {/* All Branches picker */}
                <div
                    className="flex items-center gap-2.5 px-4 h-[52px] rounded-[12px] border-1 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.04)]"
                    style={{ borderColor: `${brand.textColor}1a`, backgroundColor: brand.backgroundColor }}
                >
                    <MarkerPin01 className="w-[18px] h-[18px] opacity-70" />
                    <span className="flex-1 text-[14px] font-medium">All Branches</span>
                    <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 opacity-60"><path d="M3 4 L6 7 L9 4" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>

                {/* What's on */}
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] font-semibold">What&apos;s on</p>
                    <div
                        className="rounded-[14px] overflow-hidden h-[130px] relative"
                        style={{
                            backgroundImage: "url(/images/class-template/hot-yoga.webp)",
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                        }}
                    >
                        {/* Dark gradient overlay so the text reads on any image */}
                        <div className="absolute inset-0" style={{
                            backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 100%)",
                        }} />
                        <div className="absolute top-2.5 left-2.5 rounded-[6px] px-2 py-0.5 text-[11px] font-medium tracking-[0.02em] backdrop-blur-sm"
                            style={{ backgroundColor: "rgba(0,0,0,0.4)", color: "#ffffff" }}>
                            13h : 33m : 50s
                        </div>
                        <div className="absolute bottom-3 left-3 right-3 flex flex-col gap-0.5 text-white">
                            <span className="text-[11px] font-medium tracking-[0.12em] opacity-90">WEEKEND</span>
                            <span className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">Workout Pass</span>
                            <span className="text-[10px] opacity-70">*T&amp;Cs Apply</span>
                        </div>
                    </div>
                    {/* Page dots */}
                    <div className="flex items-center justify-center gap-1 pt-0.5">
                        <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${brand.textColor}33` }} />
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${brand.textColor}33` }} />
                    </div>
                </div>

                {/* Instructor */}
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] font-semibold">Instructor</p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                        {[
                            { name: "Liam Chen", count: "3 active classes", img: "/images/instructors/liam-chen.webp" },
                            { name: "Sara-Al Rashid", count: "4 active classes", img: "/images/instructors/sarah%20al%20rashid.webp" },
                            { name: "Maya Johnson", count: "2 active classes", img: "/images/instructors/maya-johnson.webp" },
                        ].map((i, idx) => (
                            <div key={idx}
                                className="rounded-[10px] shrink-0 w-[170px] h-[72px] flex items-center justify-between overflow-hidden"
                                style={{ backgroundColor: brand.tertiaryColor }}>
                                <div className="flex flex-col gap-0.5 pl-3 pr-2 py-2 min-w-0">
                                    <span className="text-[12px] font-semibold leading-tight truncate">{i.name}</span>
                                    <span className="text-[10px] opacity-60">{i.count}</span>
                                </div>
                                <img src={i.img} alt="" className="w-[70px] h-full object-cover shrink-0"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] font-semibold">Categories</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: "Yoga",    img: "/images/class-categories/yoga.png" },
                            { label: "Pilates", img: "/images/class-categories/pilates.png" },
                            { label: "Barre",   img: "/images/class-categories/barre.png" },
                            { label: "Cycling", img: "/images/class-categories/cycling.png" },
                        ].map(c => (
                            <div key={c.label}
                                className="rounded-[10px] p-3 h-[80px] flex justify-between items-end relative overflow-hidden"
                                style={{ backgroundColor: brand.tertiaryColor }}>
                                <span className="text-[13px] font-medium relative z-10 self-start">{c.label}</span>
                                <img src={c.img} alt="" className="w-10 h-10 object-contain self-end opacity-90"
                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Book class CTA dock — full-width backdrop with a
                soft gradient fade so scrolled content underneath doesn't
                peek around the pill. The pill itself sits 16px above the
                bottom nav so it reads as a sticky action hovering above
                the tab bar. z-10 keeps the dock above scrolled content. */}
            <div className="absolute bottom-[52px] left-0 right-0 px-4 pt-6 pb-4 z-10 pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(180deg, ${brand.backgroundColor}00 0%, ${brand.backgroundColor}ee 40%, ${brand.backgroundColor} 100%)`,
                }}>
                <div className="w-full rounded-full px-4 py-3 text-center text-[15px] font-semibold shadow-[0px_8px_20px_-4px_rgba(16,24,40,0.18)] pointer-events-auto"
                    style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                    Book class
                </div>
            </div>

            {/* Bottom nav — z-20 so it stacks above the CTA dock + any
                scrolled content. */}
            <div className="absolute bottom-0 left-0 right-0 h-[52px] pb-1.5 flex items-center justify-around z-20"
                style={{
                    backgroundColor: brand.backgroundColor,
                    borderTop: `1px solid ${brand.textColor}11`,
                }}>
                {[
                    { Icon: HomeLine, label: "Home", active: true },
                    { Icon: SearchSm, label: "Search" },
                    { Icon: ShoppingBag03, label: "Products" },
                    { Icon: User01, label: "Profile" },
                ].map((n, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 relative">
                        {n.active && (
                            <span className="absolute -top-1.5 w-6 h-[2px] rounded-full"
                                style={{ backgroundColor: brand.primaryColor }} />
                        )}
                        <n.Icon className="w-5 h-5" style={{ color: n.active ? brand.primaryColor : `${brand.textColor}77` }} />
                        <span className="text-[10px] font-medium"
                            style={{ color: n.active ? brand.primaryColor : `${brand.textColor}77` }}>{n.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Class preview ──────────────────────────────────────────────────────────
// Figma 7628:324590 — cover image at the top with back + share overlay,
// class title + date overlaid on the bottom, "8 spots left" pill on the
// right. Below: Class details copy + 4 metric tiles (2×2 grid) on the
// tertiary surface + Equipment list + Check-in guidance + sticky footer
// with "20 credits left" and Book class CTA.

function ClassPreview({ brand }: { brand: PreviewBrand }) {
    const fontFamily = brandTypefaceFontFamily(brand.typeface);
    return (
        <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
                backgroundColor: brand.backgroundColor,
                color: brand.textColor,
                fontFamily,
            }}
        >
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-[72px]">
                {/* Cover */}
                <div
                    className="mx-4 mt-5 rounded-[14px] overflow-hidden h-[170px] relative"
                    style={{
                        backgroundImage: "url(/images/class-template/reformer-pilates.webp)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundColor: brand.textColor,
                    }}
                >
                    {/* Vignette so overlay text reads on bright photos */}
                    <div className="absolute inset-0" style={{
                        backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.55) 100%)",
                    }} />
                    <button className="absolute top-3 left-3 w-8 h-8 rounded-full bg-[rgba(0,0,0,0.4)] backdrop-blur-sm flex items-center justify-center">
                        <ChevronLeft className="w-4 h-4 text-white" />
                    </button>
                    <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-[rgba(0,0,0,0.4)] backdrop-blur-sm flex items-center justify-center">
                        <Share02 className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between gap-2">
                        <div className="flex flex-col gap-0.5 text-white min-w-0">
                            <span className="text-[18px] font-semibold leading-tight tracking-[-0.01em]">Mat Pilates</span>
                            <span className="text-[11px] opacity-90">Sun, 20 Feb 2025 at 10:00 AM</span>
                        </div>
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-medium flex items-center gap-1 shrink-0"
                            style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                            <CheckCircle className="w-3 h-3" />
                            8 spots left
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="px-4 pt-5 flex flex-col gap-5">
                    <div className="flex flex-col gap-2.5">
                        <p className="text-[16px] font-semibold">Class details</p>
                        <p className="text-[12px] leading-[17px] opacity-70">
                            This classic mat-based Pilates class focuses on strengthening the core through controlled and precise movements. <span className="font-semibold underline" style={{ color: brand.textColor }}>See more</span>
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                            {[
                                { Icon: ClockFastForward, label: "Duration",   value: "60 minutes" },
                                { Icon: Users01,          label: "Capacity",   value: "8 participants" },
                                { Icon: UserCheck01,      label: "Instructor", value: "Liam Chen", instructor: true },
                                { Icon: Grid01,           label: "Class type", value: "Group" },
                            ].map((m, idx) => (
                                <div key={idx}
                                    className="rounded-[10px] p-3 flex items-start gap-2.5"
                                    style={{ backgroundColor: brand.tertiaryColor }}>
                                    <m.Icon className="w-4 h-4 mt-0.5 shrink-0 opacity-70" />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-[11px] opacity-60 leading-tight">{m.label}</span>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            {m.instructor && (
                                                <img src="/images/instructors/liam-chen.webp" alt=""
                                                    className="w-4 h-4 rounded-full object-cover shrink-0"
                                                    onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                                            )}
                                            <span className="text-[12px] font-semibold leading-tight truncate">{m.value}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-[16px] font-semibold">Equipment</p>
                        <div className="flex flex-col gap-1 text-[12px] opacity-80">
                            {["Mat", "Resistance band"].map(item => (
                                <div key={item} className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${brand.textColor}77` }} />
                                    <span>{item}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-3 border-t" style={{ borderColor: `${brand.textColor}14` }}>
                        <p className="text-[16px] font-semibold">Check-in or arrival guidance</p>
                        <div className="flex items-center gap-2 text-[12px]">
                            <CheckCircle className="w-4 h-4" style={{ color: brand.primaryColor }} />
                            <span>Arrive 10 minutes early</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky CTA — credits left text + book pill */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pt-3 pb-4 flex items-center justify-between gap-3"
                style={{ backgroundColor: brand.backgroundColor, borderTop: `1px solid ${brand.textColor}11` }}>
                <span className="text-[12px] font-medium opacity-70">20 credits left</span>
                <div className="rounded-full px-5 py-2 text-[14px] font-semibold"
                    style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                    Book class
                </div>
            </div>
        </div>
    );
}
