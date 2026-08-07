"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Edit studio profile
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4098:128977 — full-page modal shell with single "Studio details"
// step, center form card, and right-side "Studio preview" card that updates
// live as the form changes.
//
// Phase 2 scope:
//   ✓ Logo upload (data-URL via FileReader — Phase 4 swaps for real CDN)
//   ✓ Studio name, Website (http:// prefix), Country / Currency / Time zone
//     dropdowns, Primary contact name + email
//   ✓ Live "Studio preview" panel on the right reflecting all picks
//   ✓ X close → router.push back to /admin/settings
//   ✓ Update profile → success toast + router.push back
//
// Phase 4 wires `updateStudioProfile(...)` action to push the saved values
// through to data-store.studio + (future) business_profile seed, so the
// Sidebar brand label, Branding display-name fallback, and notification
// templates pick the new name up automatically.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Image01, UploadCloud02, MarkerPin01, Coins01, Phone } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore } from "@/lib/store";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import {
    PhoneCountryDropdown, splitPhone,
    type PhoneCountry,
} from "@/components/customers/CustomerFormPage";
import {
    COUNTRIES, CURRENCIES, countryByName,
} from "@/lib/data/locales";

const RETURN_ROUTE = "/admin/settings/business-locations";

export function StudioProfileFormPage() {
    const router = useRouter();
    const profile = useAppStore(s => s.businessProfile);
    const updateBusinessProfile = useAppStore(s => s.updateBusinessProfile);
    const showToast = useAppStore(s => s.showToast);

    const initialPhone = splitPhone(profile.contactPhone || undefined);

    const [logoDataUrl,  setLogoDataUrl]  = useState<string>(profile.logoUrl);
    const [studioName,   setStudioName]   = useState<string>(profile.name);
    const [website,      setWebsite]      = useState<string>(profile.website);
    // Per Figma 7619:39071 — Legal business name + Trade license number
    // are the new optional fields. Submit is still gated only on
    // Studio name (per the answered question — optional, blank-safe).
    const [legalName,    setLegalName]    = useState<string>(profile.legalBusinessName);
    const [tradeLicense, setTradeLicense] = useState<string>(profile.tradeLicenseNumber);
    const [country,      setCountry]      = useState<string>(profile.country);
    const [currency,     setCurrency]     = useState<string>(profile.currency);
    const [timezone,     setTimezone]     = useState<string>(profile.timezone);
    const [contactName,  setContactName]  = useState<string>(profile.contactName);
    const [contactMail,  setContactMail]  = useState<string>(profile.contactEmail);
    const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(initialPhone.country);
    const [phoneNumber,  setPhoneNumber]  = useState<string>(initialPhone.number);

    /** Changing Country auto-fills Currency + Time zone to that country's
     *  defaults — admin can still override either afterwards. */
    function handleCountryChange(name: string) {
        setCountry(name);
        const meta = countryByName(name);
        if (meta) {
            setCurrency(meta.defaultCurrency);
            setTimezone(meta.defaultTimezone);
        }
    }

    const fileRef = useRef<HTMLInputElement>(null);

    const canSubmit = studioName.trim().length > 0;

    function handleClose() {
        router.push(RETURN_ROUTE);
    }

    function handleUploadClick() {
        fileRef.current?.click();
    }
    function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setLogoDataUrl(String(reader.result || ""));
        reader.readAsDataURL(file);
    }

    function handleSubmit() {
        if (!canSubmit) return;
        const fullPhone = phoneNumber.trim()
            ? `${phoneCountry.dial} ${phoneNumber.trim()}`
            : "";
        updateBusinessProfile({
            name: studioName.trim(),
            logoUrl: logoDataUrl,
            website: website.trim(),
            legalBusinessName: legalName.trim(),
            tradeLicenseNumber: tradeLicense.trim(),
            country,
            currency,
            timezone,
            contactName: contactName.trim(),
            contactEmail: contactMail.trim(),
            contactPhone: fullPhone,
        });
        showToast(
            "Studio profile updated",
            "Your studio profile has been saved.",
            "success", "check",
        );
        router.push(RETURN_ROUTE);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <FormHeader title="Edit studio profile" onClose={handleClose} />

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">
                    <StepSidebar steps={[{ n: 1, label: "Studio details" }]} current={1} />

                    {/* Center form card */}
                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-1 -mx-1 min-h-0">
                                <SectionHeader title="Studio details" />

                                {/* Logo upload */}
                                <div className="flex items-center gap-4 w-full">
                                    <LogoPreview src={logoDataUrl} size={96} />
                                    <input
                                        ref={fileRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFilePicked}
                                        className="hidden"
                                    />
                                    <Button
                                        variant="secondary-gray"
                                        size="md"
                                        leftIcon={<UploadCloud02 className="w-5 h-5" />}
                                        onClick={handleUploadClick}
                                    >
                                        Upload image
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Studio name">
                                        <TextInput value={studioName} onChange={setStudioName} placeholder="Enter studio name" />
                                    </Field>
                                    <Field label="Website">
                                        <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)]">
                                            <span className="h-10 flex items-center px-3 text-[16px] text-[var(--colors-text-tertiary)] bg-[var(--colors-bg-secondary)] border-r border-[var(--colors-border-primary)]">
                                                http://
                                            </span>
                                            <input
                                                type="text"
                                                value={website}
                                                onChange={e => setWebsite(e.target.value)}
                                                placeholder="your-studio.com"
                                                className="flex-1 h-10 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent min-w-0"
                                            />
                                        </div>
                                    </Field>
                                </div>

                                {/* Legal business name + Trade license number — both optional
                                    per the user direction; submit stays gated on Studio name only.
                                    Layout matches Figma 7619:39071 (paired 2-col row). */}
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Legal business name">
                                        <TextInput value={legalName} onChange={setLegalName} placeholder="Enter legal business name" />
                                    </Field>
                                    <Field label="Trade license number">
                                        <TextInput value={tradeLicense} onChange={setTradeLicense} placeholder="Enter license number" />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Country">
                                        <SelectInput
                                            value={country}
                                            onChange={handleCountryChange}
                                            placeholder="Select country"
                                            options={COUNTRIES.map(c => ({
                                                value: c.name,
                                                label: `${c.flag}  ${c.name}`,
                                            }))}
                                            width="w-full"
                                        />
                                    </Field>
                                    <Field label="Currency">
                                        <SelectInput
                                            value={currency}
                                            onChange={setCurrency}
                                            placeholder="Select currency"
                                            options={CURRENCIES.map(c => ({
                                                value: c.code,
                                                label: c.label,
                                            }))}
                                            width="w-full"
                                        />
                                    </Field>
                                </div>

                                {/* Studio-wide "Time zone" picker removed per
                                    client Jul 2026 — each branch now owns its
                                    own timezone (auto-derived from address
                                    on the Branch form). The studio-level
                                    field is still written on save for legacy
                                    consumers (customer app default etc.), but
                                    it's no longer editable here.
                                    See src/data/mock/_types.ts → Branch.timezone. */}

                                <SectionHeader title="Primary contact" small />

                                <Field label="Primary contact name">
                                    <TextInput value={contactName} onChange={setContactName} placeholder="Enter name" />
                                </Field>

                                <Field label="Primary contact email">
                                    <TextInput value={contactMail} onChange={setContactMail} placeholder="Enter email" type="email" />
                                </Field>

                                <Field label="Primary contact phone number">
                                    <div className="flex items-stretch border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <PhoneCountryDropdown value={phoneCountry} onChange={setPhoneCountry} />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                                            placeholder="Enter phone number"
                                            className="flex-1 h-10 px-[14px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none bg-transparent min-w-0 rounded-r-[8px]"
                                        />
                                    </div>
                                </Field>
                            </div>

                            <div className="shrink-0 flex items-center justify-end w-full">
                                <Button variant="primary" size="md" disabled={!canSubmit} onClick={handleSubmit}>
                                    Update profile
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right preview — hugs its content vertically so the panel
                        doesn't run the full viewport height. */}
                    <div className="w-[360px] shrink-0 self-start">
                        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                            <div className="flex flex-col gap-1 px-6 pt-6 pb-5">
                                <p className="text-[18px] font-semibold text-[var(--colors-text-primary)] leading-7">Studio preview</p>
                                <p className="text-[14px] text-[#6e776f] leading-5">This is how studio overview will look like.</p>
                            </div>
                            <div className="h-px w-full bg-[var(--colors-bg-quaternary)]" />
                            <div className="bg-[#f8f8f6] p-6 flex items-start justify-center">
                                <div className="w-full bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] p-5 flex flex-col gap-3">
                                    <LogoPreview src={logoDataUrl} size={96} />
                                    <div>
                                        <p className="text-[18px] font-semibold text-[var(--colors-text-primary)] leading-7">{studioName || "Forma Studio"}</p>
                                    </div>
                                    <div className="flex flex-col gap-1.5 mt-1">
                                        <PreviewLine icon={<MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />} text={country} />
                                        <PreviewLine icon={<Coins01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />}     text={currency} />
                                        <PreviewLine icon={<Phone className="w-4 h-4 text-[var(--colors-text-quaternary)]" />}     text={phoneNumber ? `${phoneCountry.dial} ${phoneNumber}` : "Phone number"} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Shared form primitives ────────────────────────────────────────────────

export function FormHeader({ title, onClose }: { title: string; onClose: () => void }) {
    return (
        <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
            <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0"
            >
                <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
            </button>
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">
                    {title}
                </h1>
                <Breadcrumbs className="p-0 text-[12px]" />
            </div>
        </div>
    );
}

export function StepSidebar({ steps, current }: {
    steps: { n: number; label: string }[];
    current: number;
}) {
    return (
        <div className="w-[300px] shrink-0 flex flex-col">
            {steps.map((s, i) => (
                <StepRow key={s.n} step={s} current={current} isLast={i === steps.length - 1} />
            ))}
        </div>
    );
}

function StepRow({ step, current, isLast }: {
    step: { n: number; label: string };
    current: number;
    isLast: boolean;
}) {
    const active   = step.n === current;
    const complete = step.n < current;
    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active   ? "bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                    : complete ? "bg-[var(--colors-secondary-600)] text-white"
                    : "bg-[var(--colors-bg-tertiary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                )}>
                    {step.n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[var(--colors-bg-quaternary)] rounded-[2px]" />}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[var(--colors-text-quaternary)]"
            )}>
                {step.label}
            </span>
        </div>
    );
}

// Local SectionHeader replaced by re-export of canonical so the 5 existing
// `import { SectionHeader } from "@/components/settings/business/StudioProfileFormPage"`
// importers keep working without a code change.
export { SectionHeader } from "@/components/patterns/SectionHeader";


export function Field({ label, children, error }: {
    label: string;
    children: React.ReactNode;
    /** Optional inline error line rendered directly below the field in
     *  the DS error tone (`#d92d20`). Used for live-validation feedback
     *  (e.g. the CategoryModal's duplicate-name check) so admins see
     *  the error next to the offending input instead of via toast. */
    error?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)] leading-5">{label}</label>
            {children}
            {error && (
                <p className="text-[13px] leading-5 text-[#d92d20]">{error}</p>
            )}
        </div>
    );
}

const INPUT_CLS       = "h-10 w-full px-[14px] border-1 rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";
const INPUT_CLS_OK    = "border-[var(--colors-border-primary)] focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)]";
const INPUT_CLS_ERROR = "border-[#fda29b] focus:ring-[#fecdca] focus:border-[#d92d20]";

export function TextInput({ value, onChange, placeholder, type = "text", invalid = false }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "email" | "tel" | "url";
    /** When true, swaps the border/ring to the DS error tone so a live
     *  validation error reads the moment the admin types. */
    invalid?: boolean;
}) {
    return (
        <input
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            aria-invalid={invalid || undefined}
            className={`${INPUT_CLS} ${invalid ? INPUT_CLS_ERROR : INPUT_CLS_OK}`}
        />
    );
}

export function NumberInput({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <input
            type="number"
            min="0"
            value={value}
            onChange={e => onChange(e.target.value.replace(/^0+(?=\d)/, ""))}
            placeholder={placeholder ?? "0"}
            className={INPUT_CLS}
        />
    );
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-[14px] py-[10px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y"
        />
    );
}

export function LogoPreview({ src, size }: { src: string; size: number }) {
    return (
        <div
            className="relative rounded-full bg-[var(--colors-bg-tertiary)] border-4 border-white shrink-0 overflow-hidden flex items-center justify-center"
            style={{
                width: size,
                height: size,
                boxShadow: "0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)",
            }}
        >
            {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" className="w-full h-full object-cover rounded-full" />
                : <Image01 className="w-1/2 h-1/2 text-[var(--colors-fg-quaternary)]" />
            }
            <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none" />
        </div>
    );
}

function PreviewLine({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5 truncate">{text}</p>
        </div>
    );
}
