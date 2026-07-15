"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize portal preferences (SlidePanel)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client Jul 2026: the portal-preferences 2-step form now opens as a
// right-anchored slide panel over the Branding landing page — same chrome
// as the Customize design settings panel (SlidePanel + chevron breadcrumb
// stepper + panel footer). Replaces the previous full-page route at
// `/settings/branding/portal`.
//
// Panel layout (matches CustomizeDesignPanel):
//   • Header — title "Customize portal preferences" + close X (top-right)
//   • Breadcrumb stepper — horizontal, chevron-separated. Any step click
//                          jumps directly (no linear-only gate)
//   • Body — single column (no preview panel — portal prefs has no live
//            preview). Scrolls inside.
//   • Footer — Cancel (left) + Continue / Save changes (right).
//              Continue advances step 1 → 2; Save changes commits on step 2.
//
// Steps:
//   1 — Portal link       (portal URL, menu bar toggle, per-item toggles
//                          with drag-to-reorder)
//   2 — Embed website     (embed URL, embed code, per-item deep-link rows)
//
// On Save (step 2):
//   • `updateBrandingSettings({ portalUrl, menuBarVisible, menuItems })`
//   • success toast + panel closes.

import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    XClose, ChevronRight, Share04, Copy03, Trash01, DotsGrid, Check,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { SectionHeader } from "@/components/patterns/SectionHeader";
import { useAppStore, type PortalMenuItem } from "@/lib/store";

const STEPS = [
    { n: 1, label: "Portal link"    },
    { n: 2, label: "Embed website"  },
] as const;

export function CustomizePortalPanel({ open, onClose }: {
    open: boolean;
    onClose: () => void;
}) {
    const stored = useAppStore(s => s.brandingSettings);
    const updateBrandingSettings = useAppStore(s => s.updateBrandingSettings);
    const showToast = useAppStore(s => s.showToast);

    // Wizard state — local working copy, commits on Save changes.
    const [step, setStep] = useState<1 | 2>(1);
    const [portalUrl, setPortalUrl] = useState(stored.portalUrl);
    const [menuBarVisible, setMenuBarVisible] = useState(stored.menuBarVisible);
    const [menuItems, setMenuItems] = useState<PortalMenuItem[]>(() =>
        stored.menuItems.map(i => ({ ...i })),
    );

    // Re-sync local buffer each time the panel opens so a fresh open reads
    // the current store value (never a stale prior draft).
    useEffect(() => {
        if (!open) return;
        setStep(1);
        setPortalUrl(stored.portalUrl);
        setMenuBarVisible(stored.menuBarVisible);
        setMenuItems(stored.menuItems.map(i => ({ ...i })));
    }, [open, stored]);

    function toggleMenuItem(id: string, next: boolean) {
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, enabled: next } : i));
    }

    // ── Drag-to-reorder (HTML5 native DnD) ────────────────────────────────
    // Same logic the old page used — tracks by id (not index) so the
    // reorder stays stable as the array reshuffles during live drag.
    const [draggedId, setDraggedId] = useState<string | null>(null);
    function handleDragStartItem(id: string) { setDraggedId(id); }
    function handleDragOverItem(overId: string) {
        if (!draggedId || draggedId === overId) return;
        setMenuItems(prev => {
            const fromIdx = prev.findIndex(i => i.id === draggedId);
            const toIdx   = prev.findIndex(i => i.id === overId);
            if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev;
            const next = [...prev];
            const [moved] = next.splice(fromIdx, 1);
            next.splice(toIdx, 0, moved);
            return next;
        });
    }
    function handleDragEnd() { setDraggedId(null); }

    function openLivePortal() {
        // Customer portal isn't wired to preview yet — surface the same
        // hand-off toast the landing uses.
        showToast(
            "Customer portal not built yet",
            "We'll wire the live portal preview when the customer-facing app ships.",
            "success", "check",
        );
    }

    function handleSave() {
        updateBrandingSettings({
            portalUrl: portalUrl.trim(),
            menuBarVisible,
            menuItems,
        });
        showToast(
            "Portal preferences updated",
            "Your portal preferences have been updated.",
            "success", "check",
        );
        onClose();
    }

    return (
        <SlidePanel open={open} onClose={onClose} width={720}>
            {/* Header — title + close X (top-right). */}
            <div className="relative shrink-0 border-b border-[#e4e7ec] px-6 py-4">
                <div className="pr-10">
                    <p className="text-[18px] font-medium leading-[28px] text-[#101828]">
                        Customize portal preferences
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5 mt-1">
                        Manage your website portal URL, menu bar, and embed code.
                    </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close"
                    className="absolute top-3 right-4 w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
            </div>

            {/* Breadcrumb stepper — matches CustomizeDesignPanel. Any step
                click jumps directly. */}
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 py-4 flex items-center gap-2">
                {STEPS.map((s, i) => (
                    <Fragment key={s.n}>
                        <button
                            type="button"
                            onClick={() => setStep(s.n as 1 | 2)}
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

            {/* Body — single column form (no preview). Scrolls inside. */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 flex flex-col gap-8">
                {step === 1 ? (
                    <Step1
                        portalUrl={portalUrl}
                        setPortalUrl={setPortalUrl}
                        menuBarVisible={menuBarVisible}
                        setMenuBarVisible={setMenuBarVisible}
                        menuItems={menuItems}
                        toggleMenuItem={toggleMenuItem}
                        onOpenLivePortal={openLivePortal}
                        draggedId={draggedId}
                        onDragStartItem={handleDragStartItem}
                        onDragOverItem={handleDragOverItem}
                        onDragEnd={handleDragEnd}
                    />
                ) : (
                    <Step2
                        portalUrl={portalUrl}
                        setPortalUrl={setPortalUrl}
                        embedCode={stored.embedCode}
                        menuItems={menuItems}
                        onOpenLink={openLivePortal}
                    />
                )}
            </div>

            {/* Footer — Cancel left / Continue or Save right. */}
            <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                {step === 1 ? (
                    <Button variant="primary" size="md" onClick={() => setStep(2)}>Continue</Button>
                ) : (
                    <div className="flex items-center gap-3">
                        <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                        <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                    </div>
                )}
            </div>
        </SlidePanel>
    );
}

// ─── Step 1 — Portal address + Menu bar ─────────────────────────────────────

function Step1({
    portalUrl, setPortalUrl, menuBarVisible, setMenuBarVisible, menuItems,
    toggleMenuItem, onOpenLivePortal,
    draggedId, onDragStartItem, onDragOverItem, onDragEnd,
}: {
    portalUrl: string;
    setPortalUrl: (v: string) => void;
    menuBarVisible: boolean;
    setMenuBarVisible: (v: boolean) => void;
    menuItems: PortalMenuItem[];
    toggleMenuItem: (id: string, next: boolean) => void;
    onOpenLivePortal: () => void;
    draggedId: string | null;
    onDragStartItem: (id: string) => void;
    onDragOverItem: (id: string) => void;
    onDragEnd: () => void;
}) {
    return (
        <>
            <SectionHeader title="Portal address" />
            <FormField label="Live portal URL">
                <div className="flex items-end gap-3 w-full">
                    <input
                        type="url"
                        value={portalUrl}
                        onChange={e => setPortalUrl(e.target.value)}
                        placeholder="formastudio.book.com"
                        className={cn(INPUT_CLS, "flex-1")}
                    />
                    <IconButton onClick={onOpenLivePortal} title="Open live portal">
                        <Share04 className="w-5 h-5 text-[#475467]" />
                    </IconButton>
                    <CopyButton text={portalUrl} title="Copy URL" />
                </div>
            </FormField>

            <div className="flex items-center gap-16 w-full">
                <div className="flex-1 flex flex-col gap-1">
                    <p className="text-[18px] font-semibold text-[#101828] leading-7">Menu bar</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">
                        Show the menu bar on your website portal
                    </p>
                </div>
                <Toggle on={menuBarVisible} onChange={setMenuBarVisible} ariaLabel="Toggle menu bar visibility" />
            </div>

            <div className="flex flex-col gap-4 w-full">
                {menuItems.map(item => (
                    <MenuItemRow
                        key={item.id}
                        item={item}
                        onToggle={(next) => toggleMenuItem(item.id, next)}
                        disabled={!menuBarVisible}
                        isDragging={draggedId === item.id}
                        onDragStart={() => onDragStartItem(item.id)}
                        onDragOver={() => onDragOverItem(item.id)}
                        onDragEnd={onDragEnd}
                    />
                ))}
            </div>
        </>
    );
}

function MenuItemRow({
    item, onToggle, disabled, isDragging, onDragStart, onDragOver, onDragEnd,
}: {
    item: PortalMenuItem;
    onToggle: (next: boolean) => void;
    disabled: boolean;
    isDragging: boolean;
    onDragStart: () => void;
    onDragOver: () => void;
    onDragEnd: () => void;
}) {
    return (
        <div
            draggable
            onDragStart={(e) => {
                onDragStart();
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onDragOver();
            }}
            onDrop={(e) => { e.preventDefault(); onDragEnd(); }}
            onDragEnd={onDragEnd}
            className={cn(
                "bg-white border-1 border-[#e4e7ec] rounded-[12px] flex items-center gap-1 p-4 transition-all select-none",
                isDragging
                    ? "opacity-50 border-[#7ba08c] shadow-[0px_8px_16px_-4px_rgba(16,24,40,0.10)]"
                    : "hover:border-[#d0d5dd]",
                disabled && "opacity-60",
            )}
        >
            <div className="flex-1 flex items-center gap-3 min-w-0">
                <DotsGrid className={cn(
                    "w-4 h-4 shrink-0 transition-colors",
                    isDragging ? "text-[#475467] cursor-grabbing" : "text-[#98a2b3] cursor-grab",
                )} />
                <p className="text-[14px] font-medium text-[#344054] leading-5">{item.label}</p>
            </div>
            <Toggle
                on={item.enabled && !disabled}
                onChange={onToggle}
                ariaLabel={`Toggle ${item.label} visibility`}
                disabled={disabled}
            />
        </div>
    );
}

// ─── Step 2 — Embed + Links ────────────────────────────────────────────────

function Step2({
    portalUrl, setPortalUrl, embedCode, menuItems, onOpenLink,
}: {
    portalUrl: string;
    setPortalUrl: (v: string) => void;
    embedCode: string;
    menuItems: PortalMenuItem[];
    onOpenLink: () => void;
}) {
    return (
        <>
            <div className="flex flex-col gap-4 w-full">
                <SectionHeader title="Embed" />
                <FormField label="Embed URL">
                    <div className="flex items-end gap-3 w-full">
                        <input
                            type="url"
                            value={portalUrl}
                            onChange={e => setPortalUrl(e.target.value)}
                            className={cn(INPUT_CLS, "flex-1")}
                        />
                        <IconButton onClick={() => setPortalUrl("")} title="Clear">
                            <Trash01 className="w-5 h-5 text-[#475467]" />
                        </IconButton>
                    </div>
                </FormField>
                <FormField label="Embed code">
                    <div className="flex items-start gap-3 w-full">
                        <textarea
                            value={embedCode}
                            readOnly
                            className="flex-1 h-[140px] bg-[#f9fafb] border-1 border-[#d0d5dd] rounded-[8px] px-[14px] py-3 text-[14px] leading-6 text-[#475467] font-mono shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-y focus:outline-none"
                        />
                        <CopyButton text={embedCode} title="Copy embed code" />
                    </div>
                </FormField>
            </div>

            <div className="flex flex-col gap-4 w-full">
                <SectionHeader title="Links" />
                {menuItems.map(item => (
                    <FormField key={item.id} label={item.label}>
                        <div className="flex items-end gap-3 w-full">
                            <input
                                type="url"
                                value={item.url}
                                readOnly
                                className={cn(INPUT_CLS, "flex-1 bg-[#f9fafb] text-[#475467]")}
                            />
                            <IconButton onClick={onOpenLink} title={`Open ${item.label}`}>
                                <Share04 className="w-5 h-5 text-[#475467]" />
                            </IconButton>
                            <CopyButton text={item.url} title={`Copy ${item.label} link`} />
                        </div>
                    </FormField>
                ))}
            </div>
        </>
    );
}

// ─── Shared primitives ─────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054] leading-5">{label}</label>
            {children}
        </div>
    );
}

const INPUT_CLS = "h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function IconButton({ onClick, title, children }: {
    onClick: () => void;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            aria-label={title}
            className="w-11 h-11 shrink-0 border-1 border-[#d0d5dd] bg-white rounded-[8px] flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors"
        >
            {children}
        </button>
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
                        ? "border-[#abefc6] bg-[#ecfdf3]"
                        : "border-[#d0d5dd] bg-white hover:bg-[#f9fafb]",
                )}
            >
                {copied
                    ? <Check className="w-5 h-5 text-[#067647]" />
                    : <Copy03 className="w-5 h-5 text-[#475467]" />
                }
            </button>
            {mounted && copied && tipPos && createPortal(
                <div
                    className="fixed z-[9999] -translate-x-1/2 -translate-y-full whitespace-nowrap bg-[#101828] text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] shadow-[0px_4px_8px_-2px_rgba(16,24,40,0.10),0px_2px_4px_-2px_rgba(16,24,40,0.06)] pointer-events-none"
                    style={{ left: tipPos.left, top: tipPos.top }}
                    role="status"
                    aria-live="polite"
                >
                    Copied!
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#101828]" />
                </div>,
                document.body,
            )}
        </>
    );
}

function Toggle({ on, onChange, ariaLabel, disabled = false }: {
    on: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onChange(!on)}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
                disabled && "cursor-not-allowed opacity-60",
            )}
        >
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}
