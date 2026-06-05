"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize design settings
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4468:23149 — single-step form with live portal preview on the right.
//
// Lives under `/settings/` (not `/admin/`) so it escapes the admin layout
// chrome (Sidebar + Header). Same convention as `/settings/agreements/new`.
//
// Layout — 3-column body inside a full-height white shell:
//   • Left   (300 px) — step indicator with one "Design settings" step.
//   • Center (max-w-628) — form card: Display name + 3 color rows + footer
//                          "Save changes" button.
//   • Right  (400 px) — Template preview card showing a simplified phone
//                       mockup whose accent / background / text colors live-
//                       update from the form state so the admin can preview
//                       the customer-portal effect.
//
// On Save:
//   (1) `updateBrandingSettings({ displayName, primaryColor, ... })` —
//       partial-merge into the store so landing + portal step 1 + (future
//       customer portal) all reflect immediately.
//   (2) Success toast "Design settings updated".
//   (3) router.push back to `/admin/settings/branding`.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, ChevronLeft, Share02, ClockFastForward, Users01,
    UserCheck01, Coins01, Grid01, CheckCircle, MarkerPin01, Maximize01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

const RETURN_ROUTE = "/admin/settings/branding";

const NAMED_COLOR_LABELS: Record<string, string> = {
    "#000000": "Black",
    "#101828": "Black",
    "#ffffff": "White",
    "#fafafa": "Off white",
};

/** Resolve the human-friendly label printed beside the swatch. Falls back
 *  to the hex string itself for anything not in the named map. */
function colorLabelFor(hex: string): string {
    return NAMED_COLOR_LABELS[hex.toLowerCase()] ?? hex.toUpperCase();
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CustomizeDesignSettingsPage() {
    const router = useRouter();
    const stored = useAppStore(s => s.brandingSettings);
    const updateBrandingSettings = useAppStore(s => s.updateBrandingSettings);
    const showToast = useAppStore(s => s.showToast);

    const [displayName,     setDisplayName]     = useState(stored.displayName);
    const [primaryColor,    setPrimaryColor]    = useState(stored.primaryColor);
    const [backgroundColor, setBackgroundColor] = useState(stored.backgroundColor);
    const [textColor,       setTextColor]       = useState(stored.textColor);

    const canSave = displayName.trim().length > 0;

    function handleClose() {
        router.push(RETURN_ROUTE);
    }

    function handleSave() {
        if (!canSave) return;
        updateBrandingSettings({
            displayName: displayName.trim(),
            primaryColor,
            backgroundColor,
            textColor,
            textColorLabel: colorLabelFor(textColor),
        });
        showToast(
            "Design settings updated",
            "Your design settings have been updated.",
            "success",
            "check",
        );
        router.push(RETURN_ROUTE);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* ── Header (72 px) ──────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    Customize design settings
                </h1>
            </div>

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">

                    {/* Left: step indicator */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        <StepItem n={1} label="Design settings" active />
                    </div>

                    {/* Middle: form card */}
                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        {/* `min-h-0` on the card lets the inner `overflow-y-auto` engage
                            once content exceeds the body height (flex items default to
                            `min-height: auto` which makes them grow to fit content). */}
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            {/* `overflow-y-auto` is a scroll container which clips children on
                                BOTH axes — the 2-px focus ring on inputs would get visually
                                cut at the left/right edges. The small `px-1` interior padding
                                keeps the ring inside the scrollable area, so focus styles
                                render in full. */}
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-1 -mx-1 min-h-0">
                                <p className="text-[18px] font-semibold text-[#101828] leading-7">
                                    Design settings
                                </p>
                                <FormField label="Display name">
                                    <TextInput
                                        value={displayName}
                                        onChange={setDisplayName}
                                        placeholder="Enter studio name"
                                    />
                                </FormField>
                                <FormField label="Primary color">
                                    <ColorPickerInput
                                        value={primaryColor}
                                        onChange={setPrimaryColor}
                                    />
                                </FormField>
                                <FormField label="Background color">
                                    <ColorPickerInput
                                        value={backgroundColor}
                                        onChange={setBackgroundColor}
                                    />
                                </FormField>
                                <FormField label="Text color">
                                    <ColorPickerInput
                                        value={textColor}
                                        onChange={setTextColor}
                                        displayLabel={colorLabelFor(textColor)}
                                    />
                                </FormField>
                            </div>
                            <div className="flex items-center justify-end shrink-0">
                                <Button
                                    variant="primary"
                                    size="md"
                                    disabled={!canSave}
                                    onClick={handleSave}
                                >
                                    Save changes
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right: template preview */}
                    <div className="w-[400px] shrink-0 flex flex-col">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex-1 flex flex-col overflow-hidden">
                            <div className="flex flex-col gap-1 px-6 pt-6 pb-5">
                                <p className="text-[18px] font-semibold text-[#101828] leading-7">
                                    Template preview
                                </p>
                                <p className="text-[14px] text-[#6e776f] leading-5">
                                    This is how your class template will look like.
                                </p>
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                            {/* `items-start` (not `items-center`) keeps the phone pinned to
                                the top so the `py-10` top padding is always visible — when
                                the phone is taller than the container, vertical centering
                                would push the top above the visible scroll area. */}
                            <div className="flex-1 bg-[#f8f8f6] py-10 flex items-start justify-center overflow-y-auto">
                                <PortalPreview
                                    displayName={displayName || stored.displayName}
                                    primaryColor={primaryColor}
                                    backgroundColor={backgroundColor}
                                    textColor={textColor}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function StepItem({ n, label, active }: { n: number; label: string; active: boolean }) {
    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {n}
                </div>
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]"
            )}>
                {label}
            </span>
        </div>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054] leading-5">{label}</label>
            {children}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function TextInput({ value, onChange, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={INPUT_CLS}
        />
    );
}

/** Color input combining a 20-px swatch with an inline hex string. Clicking
 *  the swatch opens the native color picker; typing in the hex field updates
 *  the color immediately. The native picker covers every browser without
 *  bringing a heavy dependency, and the visible field stays as text so the
 *  hex is always readable. */
function ColorPickerInput({ value, onChange, displayLabel }: {
    value: string;
    onChange: (hex: string) => void;
    /** Optional override for the visible label (e.g. "Black" instead of
     *  "#101828"). The underlying value stays as hex. */
    displayLabel?: string;
}) {
    const label = displayLabel ?? value.toUpperCase();
    return (
        <div className="bg-white border-1 border-[#d0d5dd] rounded-[8px] flex items-center gap-2 px-[14px] py-[10px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]">
            <label className="relative w-5 h-5 rounded-full shrink-0 cursor-pointer" style={{ backgroundColor: value }}>
                <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none" />
                <input
                    type="color"
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
            </label>
            <input
                type="text"
                value={label}
                onChange={e => {
                    const v = e.target.value.trim();
                    // Only update when the field is a valid 6-digit hex; the
                    // label may be a free-form word like "Black" otherwise.
                    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
                }}
                className="flex-1 bg-transparent text-[16px] text-[#101828] focus:outline-none min-w-0"
            />
        </div>
    );
}

/** iPhone-style customer-portal preview — matches Figma 6677:2984 (Class
 *  details, available-spot variant) with the picked colors live-applied so
 *  the admin sees the customer-portal effect of their choices in real time:
 *
 *    • backgroundColor → phone body fill (visible behind every section
 *                        that doesn't have an explicit background).
 *    • textColor       → every text node that doesn't carry brand-specific
 *                        chroma (titles, body copy, metric labels).
 *    • primaryColor    → the "Book class" CTA in the sticky bottom sheet.
 *
 *  The chevron-left + share buttons in the top nav, the green "spots left"
 *  pill, the location callout, and other ancillary chrome use static
 *  palette so they read as portal chrome rather than branded content. */
function PortalPreview({
    displayName,
    primaryColor,
    backgroundColor,
    textColor,
}: {
    displayName: string;
    primaryColor: string;
    backgroundColor: string;
    textColor: string;
}) {
    const mutedText = `${textColor}99`; // ~60% — quaternary "500" feel
    return (
        <div
            className="w-[296px] h-[640px] rounded-[20px] overflow-hidden border-1 border-[#e4e7ec] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col relative shrink-0"
            style={{ backgroundColor }}
        >
            {/* ── Hero (chevron + share, image, title, spots badge) ──── */}
            <div className="h-[189px] relative shrink-0">
                {/* gradient backdrop — placeholder for the Figma's hero photo */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#dbcaa5] via-[#9fa78f] to-[#54635b]" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/70" />

                {/* Status bar + top nav buttons (chevron-left + share-02) */}
                <div className="absolute left-0 right-0 top-0 px-3 pt-7">
                    <div className="flex items-center justify-between">
                        <div className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center">
                            <ChevronLeft className="w-4 h-4 text-white" />
                        </div>
                        <div className="w-7 h-7 rounded-full bg-black/40 flex items-center justify-center">
                            <Share02 className="w-3.5 h-3.5 text-white" />
                        </div>
                    </div>
                </div>

                {/* Title + date + 8-spots badge — bottom-aligned in hero */}
                <div className="absolute left-3 right-3 bottom-3 flex items-end justify-between gap-2">
                    <div className="flex flex-col">
                        <p className="text-white text-[15px] font-semibold leading-[23px]">Mat Pilates</p>
                        <p className="text-[#d0d5dd] text-[11px] leading-4">Sun, 20 Feb 2025 at 10:00 AM</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[#067647] text-[9px] font-medium whitespace-nowrap shrink-0">
                        <CheckCircle className="w-2.5 h-2.5" />
                        8 spots left
                    </span>
                </div>
            </div>

            {/* ── Scrollable body ────────────────────────────────────── */}
            <div className="flex-1 px-3 pt-4 pb-4 overflow-y-auto flex flex-col gap-4">
                {/* Class details */}
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-semibold leading-[19px]" style={{ color: textColor }}>
                        Class details
                    </p>
                    <p className="text-[11px] leading-4" style={{ color: mutedText }}>
                        This classic mat-based Pilates class focuses on strengthening the core through controlled and
                        precise movements. <span style={{ color: textColor }} className="font-medium">See more</span>
                    </p>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                        <MetricTile icon={<ClockFastForward className="w-3 h-3" style={{ color: mutedText }} />} label="Duration" value="60 minutes" textColor={textColor} mutedText={mutedText} />
                        <MetricTile icon={<Users01 className="w-3 h-3" style={{ color: mutedText }} />} label="Capacity" value="8 participants" textColor={textColor} mutedText={mutedText} />
                        <MetricTile icon={<UserCheck01 className="w-3 h-3" style={{ color: mutedText }} />} label="Instructor" value="Liam Chen" textColor={textColor} mutedText={mutedText} />
                        <MetricTile icon={<Coins01 className="w-3 h-3" style={{ color: mutedText }} />} label="Class type" value="Group" textColor={textColor} mutedText={mutedText} />
                    </div>
                </div>

                <PreviewDivider />

                {/* Equipment */}
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-semibold leading-[19px]" style={{ color: textColor }}>Equipment</p>
                    <EquipmentRow label="Mat" mutedText={mutedText} />
                    <EquipmentRow label="Resistance band" mutedText={mutedText} />
                </div>

                <PreviewDivider />

                {/* Check-in or arrival guidance */}
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-semibold leading-[19px]" style={{ color: textColor }}>
                        Check-in or arrival guidance
                    </p>
                    <GuidanceRow label="Arrive 10 minutes early" mutedText={mutedText} />
                    <GuidanceRow label="Late entry not permitted after 5 min" mutedText={mutedText} />
                </div>

                <PreviewDivider />

                {/* Cancellation policy */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <p className="text-[12px] font-semibold leading-[19px]" style={{ color: textColor }}>
                            Cancellation policy
                        </p>
                        <p className="text-[11px] font-semibold text-[#4f6e5d]">Show policy</p>
                    </div>
                    <p className="text-[11px] leading-4" style={{ color: mutedText }}>
                        Full refund if you cancel 24 hours before.
                    </p>
                </div>

                <PreviewDivider />

                {/* Location */}
                <div className="flex flex-col gap-2">
                    <p className="text-[12px] font-semibold leading-[19px]" style={{ color: textColor }}>Location</p>
                    {/* Map placeholder w/ pin + maximize chip */}
                    <div className="h-[126px] bg-[#e9eef2] rounded-[10px] relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-[#dde6ee] via-[#cdd9e1] to-[#bccbd4]" />
                        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white border border-[#f2f4f7] flex items-center justify-center shadow-[0px_1px_2px_rgba(16,24,40,0.05)]">
                            <Maximize01 className="w-3.5 h-3.5 text-[#475467]" />
                        </div>
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#101828] border-[2px] border-black/20 flex items-center justify-center">
                            <MarkerPin01 className="w-3 h-3 text-white" />
                        </div>
                    </div>
                    <div className="flex gap-1.5 items-start">
                        <MarkerPin01 className="w-3 h-3 mt-1 shrink-0" style={{ color: mutedText }} />
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[11px] leading-4">
                                <span style={{ color: textColor }} className="font-medium">{`Mat Studio — ${displayName} (South)`}</span>
                            </p>
                            <p className="text-[11px] leading-4" style={{ color: mutedText }}>
                                Palm View Residences Unit G-12, Al Sufouh Road Dubai Marina, Dubai United Arab Emirates
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Sticky bottom action bar ───────────────────────────── */}
            <div className="bg-white border-t border-[#e4e7ec] px-3 pt-3 pb-1 flex flex-col gap-2 shrink-0">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[12px] font-semibold text-[#101828]">20 credits left</p>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-full text-[12px] font-semibold shadow-[0px_1px_2px_rgba(16,24,40,0.06)] border border-white/10"
                        style={{ backgroundColor: primaryColor, color: textColor }}
                    >
                        Book class
                    </button>
                </div>
                {/* iPhone home bar */}
                <div className="h-5 flex items-center justify-center">
                    <div className="w-20 h-1 rounded-full bg-black" />
                </div>
            </div>
        </div>
    );
}

function PreviewDivider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}

function MetricTile({ icon, label, value, textColor, mutedText }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    textColor: string;
    mutedText: string;
}) {
    return (
        <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-[6px] border border-[#e4e7ec] flex items-center justify-center shrink-0 bg-white">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <p className="text-[9px] leading-[14px]" style={{ color: mutedText }}>{label}</p>
                <p className="text-[11px] font-medium leading-4 truncate" style={{ color: textColor }}>{value}</p>
            </div>
        </div>
    );
}

function EquipmentRow({ label, mutedText }: { label: string; mutedText: string }) {
    return (
        <div className="flex items-start gap-1.5">
            <Grid01 className="w-3 h-3 mt-0.5 shrink-0" style={{ color: mutedText }} />
            <p className="text-[11px] leading-4" style={{ color: mutedText }}>{label}</p>
        </div>
    );
}

function GuidanceRow({ label, mutedText }: { label: string; mutedText: string }) {
    return (
        <div className="flex items-start gap-1.5">
            <CheckCircle className="w-3 h-3 mt-0.5 shrink-0" style={{ color: mutedText }} />
            <p className="text-[11px] leading-4" style={{ color: mutedText }}>{label}</p>
        </div>
    );
}
