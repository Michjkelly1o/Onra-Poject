"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Branding → Customize portal preferences
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma:
//   • Step 1 — Portal link    (4468:24398)
//   • Step 2 — Embed website  (4468:24852)
//
// 2-step full-page form. Lives under `/settings/` so it escapes the admin
// layout chrome — same convention as the Design settings sub-page.
//
// Step 1 — Portal address + Menu bar
//   • Live portal URL (editable) + Share button (fires "customer portal not
//     built yet" info toast — same hand-off as the landing) + Copy button
//     (clipboard).
//   • Menu bar master toggle ("Show the menu bar on your website portal").
//   • Per-item toggle list with drag handle (drag re-ordering is visual-only
//     for the prototype — Phase 3 will wire persistence).
//
// Step 2 — Embed
//   • Embed URL (mirrors the live portal URL) + Remove button (clears it).
//   • Embed code (multi-line, read-only) + Copy button.
//   • "Links" section — one row per menu item with its deep link URL, a
//     Share button (toast) and a Copy button. The shown URLs come straight
//     from `menuItems[].url` so renaming or hiding an item in Step 1 stays
//     in sync.
//
// On Save (Step 2 Save changes):
//   (1) `updateBrandingSettings({ portalUrl, menuBarVisible, menuItems })` —
//       partial-merge into the store; landing card + Design settings preview
//       + (future) customer portal all reflect immediately.
//   (2) Success toast "Portal preferences updated".
//   (3) router.push back to `/admin/settings/branding`.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { XClose, Share04, Copy03, Trash01, DotsGrid, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type PortalMenuItem } from "@/lib/store";

const RETURN_ROUTE = "/admin/settings/branding";

// ─── Page ───────────────────────────────────────────────────────────────────

export default function CustomizePortalPreferencesPage() {
    const router = useRouter();
    const stored = useAppStore(s => s.brandingSettings);
    const updateBrandingSettings = useAppStore(s => s.updateBrandingSettings);
    const showToast = useAppStore(s => s.showToast);

    // Two-step local working copy; commit happens on Save changes.
    const [step, setStep] = useState<1 | 2>(1);
    const [portalUrl, setPortalUrl] = useState(stored.portalUrl);
    const [menuBarVisible, setMenuBarVisible] = useState(stored.menuBarVisible);
    const [menuItems, setMenuItems] = useState<PortalMenuItem[]>(
        stored.menuItems.map(i => ({ ...i }))
    );

    function handleClose() {
        router.push(RETURN_ROUTE);
    }

    function toggleMenuItem(id: string, next: boolean) {
        setMenuItems(prev => prev.map(i => i.id === id ? { ...i, enabled: next } : i));
    }

    // ── Drag-to-reorder (HTML5 native DnD) ───────────────────────────────
    //
    // Tracks the dragged item by `id` (not index) so the reorder logic stays
    // stable as the array re-shuffles during live drag. Live re-ordering: as
    // the cursor crosses each row, the dragged item slides into that slot,
    // so the user sees the final order continuously instead of after-drop.
    const [draggedId, setDraggedId] = useState<string | null>(null);

    function handleDragStartItem(id: string) {
        setDraggedId(id);
    }

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

    function handleDragEnd() {
        setDraggedId(null);
    }

    // Copy is handled directly by the `CopyButton` primitive (which fires
    // its own inline "Copied!" tooltip). No store-level toast — that one
    // looked out of place on these full-page sub-pages.

    function openLivePortal() {
        // Customer portal isn't built — surface the same hand-off toast the
        // landing uses.
        showToast(
            "Customer portal not built yet",
            "We'll wire the live portal preview when the customer-facing app ships.",
            "success",
            "check",
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
                    Customize portal preferences
                </h1>
            </div>

            {/* ── Body ────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">

                    {/* Left: step indicator */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        <StepItem n={1} label="Portal link" current={step} total={2} />
                        <StepItem n={2} label="Embed website" current={step} total={2} />
                    </div>

                    {/* Middle: form card */}
                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        {/* `min-h-0` on the card itself is the key to making the inner
                            scroll container actually scroll — flex items default to
                            `min-height: auto` which makes them grow to fit content. Without
                            this, Step 2 (Embed + 4 links) overflows the body height and the
                            inner `overflow-y-auto` never engages, so the bottom rows + the
                            Save button get visually cut. */}
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            {/* `overflow-y-auto` is a scroll container which clips children on
                                BOTH axes — the 2-px focus ring on inputs would get visually
                                cut at the left/right edges. The small `px-1` interior padding
                                (with matching negative margin so the visible width is
                                unchanged) keeps the ring inside the scrollable area. */}
                            <div className="flex-1 overflow-y-auto flex flex-col gap-8 px-1 -mx-1 min-h-0">
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
                            {/* Footer — Continue (step 1) or Back / Save (step 2) */}
                            <div className="shrink-0 flex items-center justify-between w-full">
                                {step === 2 ? (
                                    <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                ) : <span />}
                                {step === 1 ? (
                                    <Button variant="primary" size="md" onClick={() => setStep(2)}>
                                        Continue
                                    </Button>
                                ) : (
                                    <Button variant="primary" size="md" onClick={handleSave}>
                                        Save changes
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1 — Portal address + Menu bar ─────────────────────────────────────

function Step1({
    portalUrl,
    setPortalUrl,
    menuBarVisible,
    setMenuBarVisible,
    menuItems,
    toggleMenuItem,
    onOpenLivePortal,
    draggedId,
    onDragStartItem,
    onDragOverItem,
    onDragEnd,
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
            {/* ── Portal address ──────────────────────────────────────── */}
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

            {/* ── Menu bar ────────────────────────────────────────────── */}
            <div className="flex items-center gap-16 w-full">
                <div className="flex-1 flex flex-col gap-1">
                    <p className="text-[18px] font-semibold text-[#101828] leading-7">Menu bar</p>
                    <p className="text-[14px] text-[#6e776f] leading-5">
                        Show the menu bar on your website portal
                    </p>
                </div>
                <Toggle on={menuBarVisible} onChange={setMenuBarVisible} ariaLabel="Toggle menu bar visibility" />
            </div>

            {/* Per-item draggable + toggleable list */}
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
    item,
    onToggle,
    disabled,
    isDragging,
    onDragStart,
    onDragOver,
    onDragEnd,
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
            // Native HTML5 drag-and-drop. The row itself is draggable so the
            // browser captures the whole pill as the drag image; the
            // `cursor-grab` lives on the handle icon so the affordance still
            // reads as "grab the dots." Clicking the toggle still works
            // because browsers only initiate drag when the cursor moves
            // beyond a threshold after mousedown.
            draggable
            onDragStart={(e) => {
                onDragStart();
                e.dataTransfer.effectAllowed = "move";
                // Firefox requires SOME data on the dataTransfer or drag won't fire.
                e.dataTransfer.setData("text/plain", item.id);
            }}
            onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                onDragOver();
            }}
            onDrop={(e) => {
                e.preventDefault();
                onDragEnd();
            }}
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
    portalUrl,
    setPortalUrl,
    embedCode,
    menuItems,
    onOpenLink,
}: {
    portalUrl: string;
    setPortalUrl: (v: string) => void;
    embedCode: string;
    menuItems: PortalMenuItem[];
    onOpenLink: () => void;
}) {
    return (
        <>
            {/* ── Embed ───────────────────────────────────────────────── */}
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

            {/* ── Links ───────────────────────────────────────────────── */}
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

function StepItem({ n, label, current, total }: {
    n: number;
    label: string;
    current: number;
    total: number;
}) {
    const active   = n === current;
    const complete = n < current;
    const isLast   = n === total;
    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active   ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                    : complete ? "bg-[#658774] text-white"
                    : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
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

function SectionHeader({ title }: { title: string }) {
    return <p className="text-[18px] font-semibold text-[#101828] leading-7">{title}</p>;
}

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

/** IconButton + clipboard write + inline "Copied!" tooltip.
 *
 *  The tooltip is rendered via `createPortal` straight into `document.body`
 *  with fixed positioning so it ESCAPES every `overflow-hidden` /
 *  `overflow-y-auto` ancestor — those would otherwise clip the chip when
 *  the copy button sits inside the form card's scrollable area. Position
 *  is measured from the button's `getBoundingClientRect` at click time so
 *  the chip lines up regardless of scroll offset.
 *
 *  While the tooltip is up:
 *    • Button bg flips to mint (#ecfdf3) + border to #abefc6
 *    • Icon swaps Copy03 → Check (green)
 *  The state self-dismisses after 1.5 s. */
function CopyButton({ text, title }: { text: string; title: string }) {
    const buttonRef = useRef<HTMLButtonElement>(null);
    const [copied, setCopied] = useState(false);
    const [tipPos, setTipPos] = useState<{ left: number; top: number } | null>(null);
    // SSR-safe portal mount flag — `document.body` only exists client-side.
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
            // Fallback for browsers without the async Clipboard API — use
            // a hidden textarea + execCommand. Still trips the tooltip so
            // the user gets feedback either way.
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.opacity = "0";
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand("copy"); } catch { /* ignore */ }
            document.body.removeChild(ta);
        }
        // Measure button so the portalled tooltip aligns above it. Use
        // viewport-relative coords because the portal renders with
        // `position: fixed`.
        const rect = buttonRef.current?.getBoundingClientRect();
        if (rect) {
            setTipPos({
                left: rect.left + rect.width / 2,
                top:  rect.top - 8, // 8-px gap above the button
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
