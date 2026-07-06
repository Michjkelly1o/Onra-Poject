"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Waitlist side panel (Figma 7631:394473 / 7714:17067)
// ─────────────────────────────────────────────────────────────────────────────
//
// Portal to document.body. 600 px wide slide-in from the right.
//
// Sections:
//   1. Waitlist
//        • Maximum waiting spots (numeric)
//        • Notify via (multi-select chips: WhatsApp / Email / SMS / Push)
//        • When a spot opens (2 radio cards)
//   2. Auto promotion cut off
//        • "Match the free cancellation window" toggle card. When ON,
//          Stop-auto-promoting is READ-ONLY and echoes the cancellation
//          policy's credit-window value; when OFF, admin picks a
//          custom value.
//   3. After cut off, a freed spot to (3 radio cards)
//   4. Tip banner (light-yellow) with the before/after cutoff summary.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XClose, Lightbulb02, ChevronDown, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { UnitSuffixSelect } from "@/components/patterns/UnitSuffixSelect";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings } from "@/lib/store";

type NotifyChannel = "whatsapp" | "email" | "sms" | "push";
const NOTIFY_LABEL: Record<NotifyChannel, string> = {
    whatsapp: "WhatsApp",
    email:    "Email",
    sms:      "SMS",
    push:     "Push",
};
const ALL_NOTIFY: NotifyChannel[] = ["whatsapp", "email", "sms", "push"];

const HOURS_UNIT_OPTIONS = [
    { value: "hours",   label: "hours"   },
    { value: "minutes", label: "minutes" },
];

interface RadioCardSpec<V extends string> {
    value:    V;
    title:    string;
    subtitle: string;
}

const SPOT_OPENS_OPTIONS: Array<RadioCardSpec<ClassesSettings["when_spot_opens_mode"]>> = [
    { value: "auto_add_next",    title: "Auto add the next person", subtitle: "#1 booked automatically & notified (Default)." },
    { value: "notify_to_accept", title: "Notify to accept",         subtitle: "#1 must claim it, else passes to #2" },
];

const AFTER_CUTOFF_OPTIONS: Array<RadioCardSpec<ClassesSettings["after_cutoff_mode"]>> = [
    { value: "reopens_first_come",  title: "Reopens first come",  subtitle: "Anyone can grab it (inc. walk ins)" },
    { value: "keep_auto_promoting", title: "Keep auto promoting", subtitle: "Continue waitlist order" },
    { value: "stays_empty",         title: "Stays empty",         subtitle: "No more fills" },
];

// ─── Small primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4">
            <p className="text-[16px] font-semibold text-[#101828]">{title}</p>
            {children}
        </div>
    );
}

function Field({ label, children, subtitle }: {
    label: string; children: React.ReactNode; subtitle?: string;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {subtitle && <p className="text-[13px] text-[#667085] leading-[18px]">{subtitle}</p>}
        </div>
    );
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

function RadioCard<V extends string>({
    selected, title, subtitle, onSelect,
}: {
    selected: boolean; title: string; subtitle: string; onSelect: () => void;
} & Record<"value", V>) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "text-left rounded-[12px] border-1 p-4 flex items-start gap-3 transition-colors bg-white",
                selected ? "border-[#7ba08c]" : "border-[#e4e7ec] hover:border-[#d0d5dd]",
            )}>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <div className={cn(
                "w-4 h-4 rounded-full border-1 flex items-center justify-center shrink-0 mt-0.5",
                selected ? "border-[#658774] bg-[#658774]" : "border-[#d0d5dd] bg-white",
            )}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

function NumberField({ value, onChange, ariaLabel, suffixSlot, readOnly }: {
    value: number;
    onChange: (next: number) => void;
    ariaLabel: string;
    suffixSlot?: React.ReactNode;
    readOnly?: boolean;
}) {
    return (
        <div className={cn(
            "flex items-stretch h-10 w-full border-1 rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden transition-all",
            readOnly
                ? "bg-[#f9fafb] border-[#e4e7ec]"
                : "bg-white border-[#d0d5dd] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]",
        )}>
            <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label={ariaLabel}
                readOnly={readOnly}
                value={value === 0 ? "" : value}
                placeholder="0"
                onChange={e => {
                    if (readOnly) return;
                    const raw = e.target.value;
                    if (raw === "") { onChange(0); return; }
                    const stripped = raw.replace(/^0+(?=\d)/, "");
                    const parsed = parseInt(stripped, 10);
                    if (!Number.isNaN(parsed)) onChange(parsed);
                }}
                className={cn(
                    "flex-1 min-w-0 px-[14px] text-[16px] placeholder:text-[#667085] focus:outline-none bg-transparent",
                    readOnly ? "text-[#667085]" : "text-[#101828]",
                )}
            />
            {suffixSlot}
        </div>
    );
}

// ─── Notify-via chip picker ────────────────────────────────────────────────

function NotifyViaPicker({ selected, onChange }: {
    selected: NotifyChannel[];
    onChange: (next: NotifyChannel[]) => void;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    function toggle(v: NotifyChannel) {
        onChange(selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]);
    }
    // Fixed single-row layout — chips render inline with horizontal
    // overflow hidden. When more chips are added than fit, the visible
    // chips truncate and a "+N" counter chip surfaces the hidden count.
    // The dropdown is still the source of truth — admins add/remove
    // channels there when the row is full.
    const MAX_INLINE_CHIPS = 3;
    const visibleChips = selected.slice(0, MAX_INLINE_CHIPS);
    const hiddenCount  = Math.max(0, selected.length - visibleChips.length);
    return (
        <>
            <button ref={btnRef} type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white flex items-center gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all">
                <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">
                    {selected.length === 0 && (
                        <span className="text-[14px] text-[#667085]">Select channels</span>
                    )}
                    {visibleChips.map(v => (
                        <span key={v}
                            className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-[6px] border-1 border-[#7ba08c] bg-[#f5fffa] text-[13px] text-[#3b5446] leading-[18px] shrink-0">
                            {NOTIFY_LABEL[v]}
                            <button type="button"
                                onClick={e => { e.stopPropagation(); toggle(v); }}
                                className="w-4 h-4 flex items-center justify-center text-[#3b5446] hover:text-[#101828]">
                                <XClose className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    {hiddenCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[6px] border-1 border-[#d0d5dd] bg-[#f9fafb] text-[13px] font-medium text-[#475467] leading-[18px] shrink-0">
                            +{hiddenCount}
                        </span>
                    )}
                </div>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>
            <FixedDropdown
                triggerRef={btnRef}
                open={open}
                onClose={() => setOpen(false)}
                minWidth={220}
            >
                {ALL_NOTIFY.map(v => {
                    const isSelected = selected.includes(v);
                    return (
                        <button
                            key={v}
                            type="button"
                            onClick={() => toggle(v)}
                            className={cn(
                                "w-full text-left px-3 py-2 text-[14px] flex items-center gap-2 transition-colors",
                                isSelected ? "text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}
                        >
                            <div className={cn(
                                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center shrink-0 transition-colors",
                                isSelected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
                            )}>
                                {isSelected && <Check className="w-[10px] h-[10px] text-white" />}
                            </div>
                            <span className="flex-1">{NOTIFY_LABEL[v]}</span>
                        </button>
                    );
                })}
            </FixedDropdown>
        </>
    );
}

// ─── Panel ─────────────────────────────────────────────────────────────────

export function WaitlistPanel({ open, onClose }: {
    open: boolean; onClose: () => void;
}) {
    const settings              = useAppStore(s => s.classesSettings);
    const updateClassesSettings = useAppStore(s => s.updateClassesSettings);
    const cancellationPolicy    = useAppStore(s => s.cancellationPolicy);
    const showToast             = useAppStore(s => s.showToast);

    const [shown, setShown] = useState(false);

    // Local edit buffer.
    const [maxSpots,   setMaxSpots]   = useState<number>(settings.max_waiting_spots);
    const [notifyVia,  setNotifyVia]  = useState<NotifyChannel[]>(settings.notify_via);
    const [spotMode,   setSpotMode]   = useState<ClassesSettings["when_spot_opens_mode"]>(settings.when_spot_opens_mode);
    const [matchCancel, setMatchCancel] = useState<boolean>(settings.match_free_cancellation_window);
    const [stopValue,  setStopValue]  = useState<number>(settings.stop_auto_promoting_value);
    const [stopUnit,   setStopUnit]   = useState<ClassesSettings["stop_auto_promoting_unit"]>(settings.stop_auto_promoting_unit);
    const [afterMode,  setAfterMode]  = useState<ClassesSettings["after_cutoff_mode"]>(settings.after_cutoff_mode);

    useEffect(() => {
        if (open) {
            setMaxSpots(settings.max_waiting_spots);
            setNotifyVia(settings.notify_via);
            setSpotMode(settings.when_spot_opens_mode);
            setMatchCancel(settings.match_free_cancellation_window);
            setStopValue(settings.stop_auto_promoting_value);
            setStopUnit(settings.stop_auto_promoting_unit);
            setAfterMode(settings.after_cutoff_mode);
            setShown(false);
            const r = requestAnimationFrame(() => setShown(true));
            return () => cancelAnimationFrame(r);
        }
        setShown(false);
    }, [open, settings]);

    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // When "Match free cancellation window" is ON, the Stop-auto-promoting
    // field is READ-ONLY and mirrors the cancellation policy value. The
    // subtitle below the input shows the same info in prose.
    const cancelHours = cancellationPolicy.credit_before_window_unit === "hours"
        ? cancellationPolicy.credit_before_window_value
        : Math.max(1, Math.round(cancellationPolicy.credit_before_window_value / 60));
    const displayStopValue = matchCancel ? cancelHours : stopValue;
    const displayStopUnit  = matchCancel ? "hours"     : stopUnit;

    function handleSave() {
        updateClassesSettings({
            max_waiting_spots: maxSpots,
            notify_via: notifyVia,
            when_spot_opens_mode: spotMode,
            match_free_cancellation_window: matchCancel,
            // Persist the admin-chosen custom value even when the toggle
            // is currently ON — so switching OFF later restores it.
            stop_auto_promoting_value: matchCancel ? settings.stop_auto_promoting_value : stopValue,
            stop_auto_promoting_unit:  matchCancel ? settings.stop_auto_promoting_unit  : stopUnit,
            after_cutoff_mode: afterMode,
        });
        showToast("Waitlist updated", "The new waitlist rules are now live.", "success", "check");
        onClose();
    }

    if (!open) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 z-[200] select-none">
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            <div
                style={{ right: shown ? 0 : -600 }}
                className={cn(
                    "fixed top-0 w-[600px] max-w-[100vw] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                )}
            >
                {/* Header */}
                <div className="flex items-start gap-4 px-6 border-b border-[#e4e7ec] shrink-0 py-4 select-none">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="font-semibold text-[18px] text-[#101828]">Waitlist</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">
                            When a booked member cancels, the spot is offered to the waitlist in order.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-6 py-5 flex flex-col gap-8 select-text">
                    {/* ── Waitlist ─────────────────────────────────── */}
                    <Section title="Waitlist">
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Maximum waiting spots">
                                <NumberField
                                    value={maxSpots}
                                    onChange={setMaxSpots}
                                    ariaLabel="Maximum waiting spots"
                                />
                            </Field>
                            <Field label="Notify via">
                                <NotifyViaPicker selected={notifyVia} onChange={setNotifyVia} />
                            </Field>
                        </div>

                        <Field label="When a spot opens">
                            <div className="grid grid-cols-2 gap-3">
                                {SPOT_OPENS_OPTIONS.map(opt => (
                                    <RadioCard
                                        key={opt.value}
                                        value={opt.value}
                                        selected={spotMode === opt.value}
                                        title={opt.title}
                                        subtitle={opt.subtitle}
                                        onSelect={() => setSpotMode(opt.value)}
                                    />
                                ))}
                            </div>
                        </Field>
                    </Section>

                    {/* ── Auto promotion cut off ──────────────────── */}
                    <Section title="Auto promotion cut off">
                        <div className={cn(
                            "rounded-[12px] border-1 px-4 py-3 flex items-start gap-4 bg-white transition-colors",
                            matchCancel ? "border-[#7ba08c]" : "border-[#e4e7ec]",
                        )}>
                            <div className="flex-1 flex flex-col gap-1 min-w-0">
                                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">
                                    Match the free cancellation window
                                </p>
                                <p className="text-[14px] text-[#667085] leading-[20px]">
                                    Recommended only auto add people while they can still cancel free, so no one is auto booked straight into a charge.
                                </p>
                            </div>
                            <Toggle
                                on={matchCancel}
                                onChange={setMatchCancel}
                                ariaLabel="Match the free cancellation window"
                            />
                        </div>

                        <Field
                            label="Stop auto promoting"
                            subtitle={matchCancel ? `Free cancellation window (${cancelHours} hours)` : undefined}
                        >
                            <NumberField
                                value={displayStopValue}
                                onChange={setStopValue}
                                ariaLabel="Stop auto promoting value"
                                readOnly={matchCancel}
                                suffixSlot={
                                    <UnitSuffixSelect
                                        value={displayStopUnit}
                                        onChange={v => setStopUnit(v as ClassesSettings["stop_auto_promoting_unit"])}
                                        options={HOURS_UNIT_OPTIONS}
                                        disabled={matchCancel}
                                    />
                                }
                            />
                        </Field>

                        <Field label="After cut off, a freed spot to">
                            <div className="grid grid-cols-2 gap-3">
                                {AFTER_CUTOFF_OPTIONS.map(opt => (
                                    <RadioCard
                                        key={opt.value}
                                        value={opt.value}
                                        selected={afterMode === opt.value}
                                        title={opt.title}
                                        subtitle={opt.subtitle}
                                        onSelect={() => setAfterMode(opt.value)}
                                    />
                                ))}
                            </div>
                        </Field>
                    </Section>

                    {/* Info tip banner */}
                    <div className="bg-[#fffaeb] border-1 border-[#fedf89] rounded-[12px] p-4 flex items-start gap-3">
                        <Lightbulb02 className="w-5 h-5 text-[#b54708] shrink-0 mt-0.5" />
                        <p className="text-[14px] text-[#93370d] leading-[20px]">
                            <span className="font-semibold">Before cutoff:</span> Spot opens #1 auto booked &amp; notified, in order, until free cancel window ({cancelHours}h). <span className="font-semibold">After:</span> reopens first come to anyone until bookings close.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between gap-3 px-6 py-4 border-t border-[#e4e7ec] shrink-0 select-none">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" onClick={handleSave}>Save changes</Button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
