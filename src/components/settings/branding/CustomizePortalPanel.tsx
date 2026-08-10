"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize embed website (SlidePanel)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-08: the old 2-step "Portal preferences" form (Portal link +
// Embed website) is reduced to a single embed-only screen — no stepper, no
// portal URL / menu-bar / links. Just the embed code + one configuration
// (how far ahead the embedded schedule shows). Location is NOT configured here
// — the embed widget itself carries a location dropdown for the visitor.
//
//   • Header — "Customize embed website" + close X
//   • Body   — Embed code (derived, copyable) + Configuration (schedule window)
//   • Footer — Cancel (left) · Preview + Save changes (right). Preview opens
//              the live /embed/schedule page the iframe points at.

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Copy03, Check, Calendar, Lightbulb02 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore } from "@/lib/store";

// ─── Embed configuration ────────────────────────────────────────────────────

type EmbedWindow = "1w" | "2w" | "3w" | "1m";
const WINDOW_OPTIONS = [
    { value: "1w", label: "1 week"   },
    { value: "2w", label: "2 weeks"  },
    { value: "3w", label: "3 weeks"  },
    { value: "1m", label: "1 month"  },
];

/** Host portion of the embed iframe src — strips protocol / trailing slash. */
function embedHost(portalUrl: string): string {
    const cleaned = portalUrl.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
    return cleaned || "yourstudio.book.com";
}

/** The iframe snippet the admin pastes into their site. Derived live from the
 *  schedule window so the code always matches the config, and points at the
 *  same /embed/schedule route the Preview button opens. Location is chosen by
 *  the visitor inside the widget, so it isn't baked into the snippet. */
function buildEmbedCode(portalUrl: string, win: EmbedWindow): string {
    return `<iframe
  src="https://${embedHost(portalUrl)}/embed/schedule?window=${win}"
  title="Class schedule"
  width="100%" height="720" style="border:0" loading="lazy">
</iframe>`;
}

export function CustomizePortalPanel({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const stored = useAppStore(s => s.brandingSettings);
    const updateBrandingSettings = useAppStore(s => s.updateBrandingSettings);
    const showToast = useAppStore(s => s.showToast);

    const [embedWindow, setEmbedWindow] = useState<EmbedWindow>(stored.embedWindow ?? "2w");
    // Re-sync from the store each time the panel opens.
    useEffect(() => {
        if (open) setEmbedWindow(stored.embedWindow ?? "2w");
    }, [open, stored]);

    const embedCode = useMemo(
        () => buildEmbedCode(stored.portalUrl, embedWindow),
        [stored.portalUrl, embedWindow],
    );

    // Preview — open the live embed schedule (the same route the iframe points
    // at) in a new tab, so the admin sees exactly what visitors would.
    function handlePreview() {
        if (typeof window !== "undefined") {
            window.open(`/embed/schedule?window=${embedWindow}`, "_blank", "noopener");
        }
    }

    function handleSave() {
        updateBrandingSettings({ embedWindow, embedCode });
        showToast(
            "Embed website updated",
            "Your embed settings have been saved.",
            "success", "check",
        );
        onClose();
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={720}>
            {/* Header — title + close X (top-right). */}
            <div className="relative shrink-0 border-b border-[var(--colors-border-secondary)] px-6 py-4">
                <div className="pr-10">
                    <p className="text-[18px] font-medium leading-[28px] text-[var(--colors-text-primary)]">
                        Customize embed website
                    </p>
                    <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5 mt-1">
                        Embed your class schedule on your own website.
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="absolute top-3 right-4 w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                    <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                </button>
            </div>

            {/* Body — single column, no stepper. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-8">
                {/* Embed code */}
                <div className="flex flex-col gap-4 w-full">
                    <SectionHeader title="Embed code" />
                    <FormField label="Paste this code into your website">
                        <div className="flex items-start gap-3 w-full">
                            <textarea
                                value={embedCode}
                                readOnly
                                className="flex-1 h-[140px] bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-primary)] rounded-[8px] px-[14px] py-3 text-[14px] leading-6 text-[var(--colors-text-tertiary)] font-mono shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-y focus:outline-none"
                            />
                            <CopyButton text={embedCode} title="Copy embed code" />
                        </div>
                    </FormField>

                    {/* How-to — plain steps for a non-technical studio owner. */}
                    <div className="flex items-start gap-3 rounded-[12px] bg-[#f1f2ed] px-4 py-3.5">
                        <Lightbulb02 className="w-5 h-5 shrink-0 text-[#475467] mt-0.5" />
                        <div className="flex flex-col gap-1.5 text-[13px] leading-5 text-[#475467]">
                            <p className="font-semibold">How to add this to your website</p>
                            <ol className="list-decimal pl-4 flex flex-col gap-1">
                                <li>Copy the code above using the copy button.</li>
                                <li>Open the page where you want the schedule to appear. In your website builder (Wix, Squarespace, WordPress, Webflow, etc.), add an <span className="font-medium">“Embed”</span> or <span className="font-medium">“Custom HTML”</span> block.</li>
                                <li>Paste the code into that block and place it where you want the schedule to show.</li>
                                <li>Save and publish — the schedule stays in sync with your live classes automatically.</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Configuration */}
                <div className="flex flex-col gap-4 w-full">
                    <SectionHeader title="Configuration" />
                    <FormField label="Schedule window">
                        <SelectInput
                            triggerIcon={<Calendar className="w-4 h-4 text-[var(--colors-text-quaternary)]" />}
                            options={WINDOW_OPTIONS}
                            value={embedWindow}
                            onChange={(v) => setEmbedWindow(v as EmbedWindow)}
                            width="w-full"
                        />
                    </FormField>
                </div>
            </div>

            {/* Footer — Cancel left · Preview + Save changes right. */}
            <div className="shrink-0 border-t border-[var(--colors-border-secondary)] px-6 py-4 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                <div className="flex items-center gap-3">
                    <Button variant="secondary-gray" size="md" onClick={handlePreview}>Preview</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </SlidePanel>
    );
}

// ─── Shared primitives ─────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)] leading-5">{label}</label>
            {children}
        </div>
    );
}

/** Copy button + inline "Copied!" tooltip. Tooltip is portalled so it
 *  escapes the panel's overflow clip. */
function CopyButton({ text, title }: { text: string; title: string }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [copied, setCopied] = useState(false);
    const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    useEffect(() => {
        if (!copied) return;
        const id = window.setTimeout(() => {
            setCopied(false);
            setTipPos(null);
        }, 1500);
        return () => window.clearTimeout(id);
    }, [copied]);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Fallback for browsers without the async Clipboard API.
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch { /* ignore */ }
            document.body.removeChild(ta);
        }
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            setTipPos({
                left: rect.left + rect.width / 2,
                top:  rect.top - 8,
            });
        }
        setCopied(true);
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={handleCopy}
                title={title}
                aria-label={title}
                className={cn(
                    "w-11 h-11 shrink-0 border-1 rounded-[8px] flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                    copied
                        ? "border-[#94aeaf] bg-[#eff6f3]"
                        : "border-[var(--colors-border-primary)] bg-white hover:bg-[var(--colors-bg-secondary)]",
                )}
            >
                {copied
                    ? <Check className="w-5 h-5 text-[#164e52]" />
                    : <Copy03 className="w-5 h-5 text-[var(--colors-text-tertiary)]" />
                }
            </button>
            {mounted && copied && tipPos && createPortal(
                <div
                    className="fixed z-[9999] -translate-x-1/2 -translate-y-full whitespace-nowrap bg-[var(--colors-text-primary)] text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.10),0px_2px_4px_-2px_rgba(16,24,40,0.06)] pointer-events-none"
                    style={{ left: tipPos.left, top: tipPos.top }}
                    role="status"
                    aria-live="polite"
                >
                    Copied!
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--colors-text-primary)]" />
                </div>,
                document.body,
            )}
        </>
    );
}
