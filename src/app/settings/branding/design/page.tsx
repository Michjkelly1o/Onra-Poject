"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize design settings (3-step)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4468:23149 (shell) + 7624:315609 (Step 1) + 7627:317328 (Step 2)
//        + 7628:324559 (Step 3) + 7667:16737 / 17041 / 17345 (template
//        preview tabs — Login / Home / Class).
//
// Lives under `/settings/` (not `/admin/`) so it escapes the admin layout
// chrome (Sidebar + Header). Same convention as the other multi-step
// settings forms (agreements, products, services).
//
// Layout — 3-column body inside a full-height white shell:
//   • Left   (260 px) — stepper sidebar with 3 steps (Identity / Colors &
//                       typography / Messages & notifications). Past steps
//                       are clickable so the admin can jump back.
//   • Center (628 px) — form card whose body swaps per step. Each step has
//                       its own footer (Back + Continue, or Back + Save).
//   • Right  (320 px) — Template preview card with 3 tabs (Login / Home /
//                       Class). All three render the live in-progress
//                       brand values so the admin can switch tabs without
//                       losing form state.
//
// On Save (Step 3 footer "Save changes"):
//   (1) `updateBrandingSettings({...all 13 fields...})` — partial-merge into
//       the store so landing + portal step 1 + customer portal all reflect
//       immediately.
//   (2) Success toast "Design settings updated".
//   (3) router.push back to `/admin/settings/branding`.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, ChevronLeft, Share02,
    ClockFastForward, Users01, UserCheck01, Grid01,
    CheckCircle, MarkerPin01, UploadCloud02, Image01,
    SearchSm, ShoppingBag03, User01, HomeLine, Mail01, MessageChatCircle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type BrandTypeface } from "@/lib/store";
import { brandTypefaceFontFamily, brandTypefaceLabel, brandTypefaceTagline } from "@/app/branding-fonts";

const RETURN_ROUTE = "/admin/settings/branding";

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

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CustomizeDesignSettingsPage() {
    const router = useRouter();
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

    const canContinueStep1 = displayName.trim().length > 0;

    function handleClose() {
        router.push(RETURN_ROUTE);
    }

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
        router.push(RETURN_ROUTE);
    }

    // Live preview data bag — passed to every template preview tab so they
    // all theme off the in-progress form state, not the saved store state.
    const previewBrand: PreviewBrand = {
        displayName, logoUrl,
        primaryColor, backgroundColor, tertiaryColor, textColor,
        typeface,
    };

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    Customize design settings
                </h1>
            </div>

            {/* 3-column body */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">
                    {/* Left: stepper */}
                    <div className="w-[260px] shrink-0 flex flex-col pt-2">
                        {STEPS.map(s => (
                            <StepItem
                                key={s.n}
                                n={s.n}
                                label={s.label}
                                current={step}
                                isLast={s.n === STEPS.length}
                                onClick={() => {
                                    // Can jump to any step that's <= the current step
                                    // (past steps stay accessible). Forward jumps are
                                    // gated by the per-step Continue button.
                                    if (s.n <= step) setStep(s.n as 1 | 2 | 3);
                                }}
                            />
                        ))}
                    </div>

                    {/* Middle: form */}
                    <div className="flex-1 min-w-0 flex flex-col">
                        {step === 1 && (
                            <IdentityStep
                                displayName={displayName} setDisplayName={setDisplayName}
                                logoUrl={logoUrl} setLogoUrl={setLogoUrl}
                                appIconUrl={appIconUrl} setAppIconUrl={setAppIconUrl}
                                favIconUrl={favIconUrl} setFavIconUrl={setFavIconUrl}
                                canContinue={canContinueStep1}
                                onContinue={() => setStep(2)}
                            />
                        )}
                        {step === 2 && (
                            <ColorsTypographyStep
                                primaryColor={primaryColor} setPrimaryColor={setPrimaryColor}
                                backgroundColor={backgroundColor} setBackgroundColor={setBackgroundColor}
                                tertiaryColor={tertiaryColor} setTertiaryColor={setTertiaryColor}
                                textColor={textColor} setTextColor={setTextColor}
                                typeface={typeface} setTypeface={setTypeface}
                                onBack={() => setStep(1)}
                                onContinue={() => setStep(3)}
                            />
                        )}
                        {step === 3 && (
                            <NotificationsStep
                                emailOn={emailOn} setEmailOn={setEmailOn}
                                whatsappOn={whatsappOn} setWhatsappOn={setWhatsappOn}
                                smsOn={smsOn} setSmsOn={setSmsOn}
                                onBack={() => setStep(2)}
                                onSave={handleSave}
                            />
                        )}
                    </div>

                    {/* Right: template preview */}
                    <div className="w-[340px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden flex flex-col self-start">
                        <div className="px-6 pt-6 pb-4 shrink-0">
                            <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Template preview</p>
                            <p className="text-[14px] text-[#6e776f] mt-1">This is how your class template will look like.</p>
                        </div>
                        <div className="px-6 shrink-0">
                            <PreviewTabs current={previewTab} onChange={setPreviewTab} />
                        </div>
                        <div className="bg-[#f6f6f3] px-4 py-6 flex justify-center">
                            <PhoneMock>
                                {previewTab === "login" && <LoginPreview brand={previewBrand} />}
                                {previewTab === "home"  && <HomePreview  brand={previewBrand} />}
                                {previewTab === "class" && <ClassPreview brand={previewBrand} />}
                            </PhoneMock>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Stepper sidebar ────────────────────────────────────────────────────────

function StepItem({ n, label, current, isLast, onClick }: {
    n: number;
    label: string;
    current: number;
    isLast: boolean;
    onClick: () => void;
}) {
    const active   = n === current;
    const complete = n < current;
    const clickable = n <= current;
    return (
        <button
            type="button"
            onClick={clickable ? onClick : undefined}
            disabled={!clickable}
            className={cn(
                "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full text-left",
                active && "bg-[#f5fffa]",
                clickable && !active && "hover:bg-[#f9fafb]",
                !clickable && "cursor-not-allowed opacity-50",
            )}
        >
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]",
            )}>
                {label}
            </span>
        </button>
    );
}

// ─── Step 1 — Identity ──────────────────────────────────────────────────────

function IdentityStep({
    displayName, setDisplayName, logoUrl, setLogoUrl,
    appIconUrl, setAppIconUrl, favIconUrl, setFavIconUrl,
    canContinue, onContinue,
}: {
    displayName: string; setDisplayName: (v: string) => void;
    logoUrl: string; setLogoUrl: (v: string) => void;
    appIconUrl: string; setAppIconUrl: (v: string) => void;
    favIconUrl: string; setFavIconUrl: (v: string) => void;
    canContinue: boolean;
    onContinue: () => void;
}) {
    return (
        <FormCard
            footer={
                <div className="flex items-center justify-end">
                    <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>
                        Continue
                    </Button>
                </div>
            }
        >
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
    typeface, setTypeface, onBack, onContinue,
}: {
    primaryColor: string; setPrimaryColor: (v: string) => void;
    backgroundColor: string; setBackgroundColor: (v: string) => void;
    tertiaryColor: string; setTertiaryColor: (v: string) => void;
    textColor: string; setTextColor: (v: string) => void;
    typeface: BrandTypeface; setTypeface: (v: BrandTypeface) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    return (
        <FormCard
            footer={
                <div className="flex items-center justify-between">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" onClick={onContinue}>Continue</Button>
                </div>
            }
        >
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
    onBack, onSave,
}: {
    emailOn: boolean; setEmailOn: (v: boolean) => void;
    whatsappOn: boolean; setWhatsappOn: (v: boolean) => void;
    smsOn: boolean; setSmsOn: (v: boolean) => void;
    onBack: () => void;
    onSave: () => void;
}) {
    return (
        <FormCard
            footer={
                <div className="flex items-center justify-between">
                    <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                    <Button variant="primary" size="md" onClick={onSave}>Save changes</Button>
                </div>
            }
        >
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

function FormCard({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                {children}
            </div>
            <div className="shrink-0 px-6 pb-6">
                {footer}
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

/** iPhone-style outer frame — 296x640px to match the existing class preview
 *  size. Children render inside the rounded inner area. */
function PhoneMock({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-[280px] h-[600px] bg-[#101828] rounded-[32px] p-[3px] shadow-[0px_12px_24px_-8px_rgba(16,24,40,0.18)]">
            <div className="w-full h-full rounded-[29px] overflow-hidden bg-white relative">
                {children}
            </div>
        </div>
    );
}

/** Tiny status bar (9:41 + signal/wifi/battery). Used by every preview. */
function StatusBar({ textColor }: { textColor: string }) {
    return (
        <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0" style={{ color: textColor }}>
            <span className="text-[12px] font-semibold">9:41</span>
            <div className="flex items-center gap-1">
                {/* Signal */}
                <svg viewBox="0 0 20 14" className="w-4 h-3"><rect x="0" y="9" width="3" height="4" rx="0.5" fill="currentColor"/><rect x="4" y="6" width="3" height="7" rx="0.5" fill="currentColor"/><rect x="8" y="3" width="3" height="10" rx="0.5" fill="currentColor"/><rect x="12" y="0" width="3" height="13" rx="0.5" fill="currentColor"/></svg>
                {/* Wifi */}
                <svg viewBox="0 0 16 12" className="w-4 h-3 fill-current"><path d="M8 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm-3.2-3.5a4.5 4.5 0 0 1 6.4 0l-.95.95a3.2 3.2 0 0 0-4.5 0l-.95-.95zM2 5.7A7.7 7.7 0 0 1 14 5.7l-1 .95a6.4 6.4 0 0 0-10 0l-1-.95z"/></svg>
                {/* Battery */}
                <svg viewBox="0 0 22 12" className="w-5 h-3"><rect x="0.5" y="0.5" width="19" height="11" rx="2.5" stroke="currentColor" fill="none"/><rect x="2" y="2" width="16" height="8" rx="1" fill="currentColor"/><rect x="20" y="4" width="1.5" height="4" rx="0.5" fill="currentColor"/></svg>
            </div>
        </div>
    );
}

/** Bottom home indicator bar (the iPhone "swipe up" line). */
function HomeIndicator({ color }: { color: string }) {
    return (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-[100px] h-[3px] rounded-full" style={{ backgroundColor: color }} />
    );
}

// ─── Login preview ──────────────────────────────────────────────────────────

function LoginPreview({ brand }: { brand: PreviewBrand }) {
    const fontFamily = brandTypefaceFontFamily(brand.typeface);
    return (
        <div
            className="absolute inset-0 flex flex-col"
            style={{
                backgroundColor: brand.backgroundColor,
                color: brand.textColor,
                fontFamily,
            }}
        >
            <StatusBar textColor={brand.textColor} />
            {/* Logo + display name centered, with the brand-primary gradient
                rising from the bottom 60% of the screen — matches the
                Figma 7667:16737 login template exactly. */}
            <div
                className="flex-1 flex flex-col items-center justify-center gap-3 px-6 relative"
                style={{
                    backgroundImage: `linear-gradient(180deg, ${brand.backgroundColor} 0%, ${brand.backgroundColor} 35%, ${brand.primaryColor}66 100%)`,
                }}
            >
                <div className="w-16 h-16 rounded-[16px] bg-white border-1 border-[#e4e7ec] flex items-center justify-center overflow-hidden">
                    {brand.logoUrl
                        ? <img src={brand.logoUrl} alt="" className="w-full h-full object-contain" />
                        : <Image01 className="w-7 h-7 text-[#98a2b3]" />}
                </div>
                <p className="text-[24px] font-semibold leading-[32px]">
                    {brand.displayName || "Name"}
                </p>
            </div>
            <div className="shrink-0 flex items-center justify-center pb-3 pt-2">
                <p className="text-[11px] opacity-60" style={{ color: brand.textColor }}>powered by ✦ Onra</p>
            </div>
            <HomeIndicator color={brand.textColor} />
        </div>
    );
}

// ─── Home preview ───────────────────────────────────────────────────────────

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
            <StatusBar textColor={brand.textColor} />
            <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-3 pb-16 px-3 pt-1">
                {/* All Branches picker */}
                <div
                    className="flex items-center gap-2 px-3 py-2 rounded-[10px] border-1"
                    style={{ borderColor: `${brand.textColor}22`, backgroundColor: brand.tertiaryColor }}
                >
                    <MarkerPin01 className="w-3 h-3" />
                    <span className="flex-1 text-[10px] font-medium">All Branches</span>
                </div>

                {/* What's on */}
                <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold">What&apos;s on</p>
                    <div className="rounded-[12px] overflow-hidden h-[90px] relative"
                        style={{ backgroundColor: brand.textColor }}>
                        <div className="absolute top-1.5 left-1.5 rounded-[6px] px-1.5 py-0.5 text-[8px] font-medium"
                            style={{ backgroundColor: `${brand.backgroundColor}cc`, color: brand.textColor }}>
                            13h : 33m : 50s
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-0.5"
                            style={{ color: brand.backgroundColor }}>
                            <span className="text-[8px] opacity-80">WEEKEND</span>
                            <span className="text-[13px] font-semibold leading-tight">Workout Pass</span>
                            <span className="text-[7px] opacity-60">*T&amp;Cs Apply</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-1 pt-0.5">
                        <span className="w-3 h-1 rounded-full" style={{ backgroundColor: brand.primaryColor }} />
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: `${brand.textColor}33` }} />
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: `${brand.textColor}33` }} />
                    </div>
                </div>

                {/* Instructor */}
                <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold">Instructor</p>
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                        {[
                            { name: "Liam Chen", count: "3 active classes" },
                            { name: "Sara-Al Rashid", count: "4 active classes" },
                        ].map((i, idx) => (
                            <div key={idx} className="rounded-[10px] p-2 shrink-0 w-[110px] flex items-center justify-between"
                                style={{ backgroundColor: brand.tertiaryColor }}>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[8px] font-semibold">{i.name}</span>
                                    <span className="text-[7px] opacity-60">{i.count}</span>
                                </div>
                                <div className="w-5 h-5 rounded-full bg-[#dbdbdb]" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Categories */}
                <div className="flex flex-col gap-1.5">
                    <p className="text-[11px] font-semibold">Categories</p>
                    <div className="grid grid-cols-2 gap-1.5">
                        {["Yoga", "Pilates"].map(c => (
                            <div key={c} className="rounded-[10px] p-2 h-[60px] flex flex-col justify-between"
                                style={{ backgroundColor: brand.tertiaryColor }}>
                                <span className="text-[10px] font-medium">{c}</span>
                                <div className="self-end w-6 h-6 rounded-full bg-[#dbdbdb]" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky Book class CTA */}
            <div className="absolute bottom-9 left-3 right-3">
                <div className="w-full rounded-full px-4 py-2 text-center text-[11px] font-semibold"
                    style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                    Book class
                </div>
            </div>

            {/* Bottom nav */}
            <div className="absolute bottom-0 left-0 right-0 h-9 flex items-center justify-around"
                style={{ backgroundColor: brand.backgroundColor, borderTop: `1px solid ${brand.textColor}11` }}>
                {[
                    { Icon: HomeLine, label: "Home", active: true },
                    { Icon: SearchSm, label: "Search" },
                    { Icon: ShoppingBag03, label: "Products" },
                    { Icon: User01, label: "Profile" },
                ].map((n, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-0.5">
                        <n.Icon className="w-3 h-3" style={{ color: n.active ? brand.primaryColor : `${brand.textColor}77` }} />
                        <span className="text-[7px]" style={{ color: n.active ? brand.primaryColor : `${brand.textColor}77` }}>{n.label}</span>
                    </div>
                ))}
            </div>
            <HomeIndicator color={brand.textColor} />
        </div>
    );
}

// ─── Class preview ──────────────────────────────────────────────────────────

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
            <StatusBar textColor={brand.textColor} />
            <div className="flex-1 overflow-y-auto scrollbar-hide pb-14">
                {/* Cover */}
                <div className="mx-3 mt-1 rounded-[12px] overflow-hidden h-[120px] relative"
                    style={{ backgroundColor: brand.textColor }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(0,0,0,0.4)] to-[rgba(0,0,0,0.6)]" />
                    <button className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[rgba(0,0,0,0.4)] flex items-center justify-center">
                        <ChevronLeft className="w-3 h-3 text-white" />
                    </button>
                    <button className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-[rgba(0,0,0,0.4)] flex items-center justify-center">
                        <Share02 className="w-3 h-3 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between gap-2">
                        <div className="flex flex-col gap-0.5 text-white">
                            <span className="text-[13px] font-semibold leading-tight">Mat Pilates</span>
                            <span className="text-[8px] opacity-90">Sun, 20 Feb 2025 at 10:00 AM</span>
                        </div>
                        <span className="rounded-full px-2 py-0.5 text-[8px] font-medium"
                            style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                            8 spots left
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="px-3 pt-3 flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[11px] font-semibold">Class details</p>
                        <p className="text-[9px] opacity-70 leading-tight">
                            This classic mat-based Pilates class focuses on strengthening the core through controlled and precise movements. <span className="font-medium" style={{ color: brand.primaryColor }}>See more</span>
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                            {[
                                { Icon: ClockFastForward, label: "Duration", value: "60 minutes" },
                                { Icon: Users01,          label: "Capacity", value: "8 participants" },
                                { Icon: UserCheck01,      label: "Instructor", value: "Liam Chen" },
                                { Icon: Grid01,           label: "Class type", value: "Group" },
                            ].map((m, idx) => (
                                <div key={idx} className="rounded-[8px] p-2 flex items-start gap-1.5"
                                    style={{ backgroundColor: brand.tertiaryColor }}>
                                    <m.Icon className="w-3 h-3 mt-0.5 shrink-0" />
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <span className="text-[7px] opacity-70 leading-tight">{m.label}</span>
                                        <span className="text-[8px] font-medium leading-tight truncate">{m.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <p className="text-[11px] font-semibold">Equipment</p>
                        <div className="flex flex-col gap-0.5 text-[9px] opacity-80">
                            <span>· Mat</span>
                            <span>· Resistance band</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1 pt-1 border-t border-[rgba(0,0,0,0.08)]">
                        <p className="text-[11px] font-semibold">Check-in or arrival guidance</p>
                        <div className="flex items-center gap-1 text-[9px]">
                            <CheckCircle className="w-3 h-3" style={{ color: brand.primaryColor }} />
                            <span>Arrive 10 minutes early</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sticky CTA */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                <span className="text-[9px] opacity-70">20 credits left</span>
                <div className="rounded-full px-4 py-1.5 text-[11px] font-semibold"
                    style={{ backgroundColor: brand.primaryColor, color: brand.textColor }}>
                    Book class
                </div>
            </div>
            <HomeIndicator color={brand.textColor} />
        </div>
    );
}
