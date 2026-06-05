"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4468:21332 — Branding landing.
//
// Two outer cards stacked vertically with the same chrome family the rest of
// the Settings sub-section landings already use (Referral, Tax, Agreements):
//
//   • Card 1 — Design settings
//       Header  : title + subtitle + "Customize" button (top-right).
//       Body    : 2-column / 2-row grid showing the four preview rows
//                 (Display name + Primary color / Background color +
//                 Text color). Each color row has a 20-px circular swatch
//                 + the hex / label.
//
//   • Card 2 — Portal preferences
//       Header  : title + subtitle + "Customize" button (top-right).
//       Body    : top 2-column grid (Live portal URL + Menu bar badge);
//                 1-px divider; bottom row of "Visible menu items" chips.
//
// Phase 1 scope:
//   ✓ Static landing data sourced from a small local default object so the
//     layout renders even before Phase 3 ships the seed (graceful empty
//     state — never an unstyled blank). Phase 3 will swap this for
//     `branding_settings` from `src/data/mock/`.
//   ✓ Both "Customize" buttons fire success-toast placeholders. Phase 2 will
//     route them to dedicated `/admin/settings/branding/design` and
//     `/admin/settings/branding/portal` sub-pages.
//   ✓ The Live portal URL chip fires a "Customer portal isn't built yet"
//     info toast on click (per the brief — the customer-facing portal
//     isn't implemented; this is the placeholder hand-off).
//
// NB — page chrome (admin layout + Header) is owned by `app/admin/layout.tsx`
// already. We render just the inner card stack here.

import { useRouter } from "next/navigation";
import { Edit02, Share04 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BrandingPage() {
    const router = useRouter();
    const b = useAppStore(s => s.brandingSettings);
    const showToast = useAppStore(s => s.showToast);

    function customizeDesign() {
        router.push("/settings/branding/design");
    }

    function customizePortal() {
        router.push("/settings/branding/portal");
    }

    function openLivePortal() {
        // Customer-facing portal isn't built yet — per the brief, surface an
        // info toast so the click clearly communicates the integration is
        // pending.
        showToast(
            "Customer portal not built yet",
            "We'll wire the live portal preview when the customer-facing app ships.",
            "success",
            "check",
        );
    }

    return (
        <div className="flex flex-col gap-5 w-full">
            {/* ── Card 1 — Design settings ────────────────────────────── */}
            <SectionCard
                title="Design settings"
                subtitle="Customize how your brand appears in the customer portal."
                onCustomize={customizeDesign}
            >
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 w-full">
                    <PreviewRow
                        label="Display name"
                        value={<span className="text-[16px] font-medium text-[#101828] leading-6">{b.displayName}</span>}
                    />
                    <PreviewRow
                        label="Primary color"
                        value={<SwatchValue color={b.primaryColor} label={b.primaryColor} />}
                    />
                    <PreviewRow
                        label="Background color"
                        value={<SwatchValue color={b.backgroundColor} label={b.backgroundColor} />}
                    />
                    <PreviewRow
                        label="Text color"
                        value={<SwatchValue color={b.textColor} label={b.textColorLabel} />}
                    />
                </div>
            </SectionCard>

            {/* ── Card 2 — Portal preferences ─────────────────────────── */}
            <SectionCard
                title="Portal preferences"
                subtitle="Manage your website portal URL and navigation menu."
                onCustomize={customizePortal}
            >
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 w-full">
                    <PreviewRow
                        label="Live portal URL"
                        value={
                            <button
                                type="button"
                                onClick={openLivePortal}
                                className="flex items-center gap-1 text-[16px] font-medium text-[#101828] leading-6 hover:text-[#475467] transition-colors"
                                title="Open live customer portal"
                            >
                                <span>{b.portalUrl}</span>
                                <Share04 className="w-5 h-5 text-[#475467]" />
                            </button>
                        }
                    />
                    <PreviewRow
                        label="Menu bar"
                        value={<VisibilityBadge visible={b.menuBarVisible} />}
                    />
                </div>

                <div className="h-px w-full bg-[#e4e7ec]" />

                <div className="flex flex-col gap-1 w-full">
                    <p className="text-[14px] text-[#667085] leading-5">Visible menu items</p>
                    <div className="flex flex-wrap gap-2 w-full">
                        {b.menuItems.map(item => (
                            <MenuItemChip
                                key={item.id}
                                label={item.label}
                                enabled={item.enabled}
                            />
                        ))}
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

/** Outer card chrome — used by both Design settings + Portal preferences.
 *  Matches the Referral / Tax / Agreements landing card shape exactly
 *  (rounded-3xl, border-secondary, p-6, gap-6) so the Branding page reads
 *  like a sibling of those landings. */
function SectionCard({
    title,
    subtitle,
    onCustomize,
    children,
}: {
    title: string;
    subtitle: string;
    onCustomize: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">{title}</p>
                    <p className="text-[14px] text-[#475467] leading-5">{subtitle}</p>
                </div>
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<Edit02 className="w-5 h-5" />}
                    onClick={onCustomize}
                >
                    Customize
                </Button>
            </div>
            {children}
        </div>
    );
}

/** Small label-over-value preview block. Value is `ReactNode` so cards can
 *  inline swatches, badges, or anchor buttons without bespoke variants. */
function PreviewRow({
    label,
    value,
}: {
    label: string;
    value: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <div className="flex items-center">{value}</div>
        </div>
    );
}

/** 20-px circular color swatch + adjacent hex/label text. The contrast
 *  hairline (rgba(0,0,0,0.08)) is the same border the Figma uses on the
 *  avatar primitive to keep light swatches readable on white bg. */
function SwatchValue({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1">
            <div
                className="w-5 h-5 rounded-full shrink-0 relative"
                style={{ backgroundColor: color }}
            >
                <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none" />
            </div>
            <p className="text-[16px] font-medium text-[#101828] leading-6">{label}</p>
        </div>
    );
}

/** Visible / Hidden pill — same success/neutral palette the rest of the
 *  app uses for status badges. */
function VisibilityBadge({ visible }: { visible: boolean }) {
    return (
        <span
            className={
                visible
                    ? "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
                    : "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]"
            }
        >
            {visible ? "Visible" : "Hidden"}
        </span>
    );
}

/** Single chip in the "Visible menu items" row. Disabled chips use the
 *  Figma's `bg-disabled_subtle` / `border-disabled` / `text-disabled`
 *  triplet so they read clearly as "hidden from portal nav". */
function MenuItemChip({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div
            className={
                enabled
                    ? "border-1 border-[#e4e7ec] bg-white rounded-[8px] px-4 py-2 text-[14px] font-medium text-[#344054] leading-5"
                    : "border-1 border-[#d0d5dd] bg-[#f9fafb] rounded-[8px] px-4 py-2 text-[14px] font-medium text-[#667085] leading-5"
            }
        >
            {label}
        </div>
    );
}
