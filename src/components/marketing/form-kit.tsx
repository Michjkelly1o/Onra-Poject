"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing form kit (shared primitives)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single source of truth for the building blocks shared by every marketing
// create/edit form — Campaigns, Announcements, and (Phase 2) Events. Each
// module keeps its OWN thin form component (so the modules can diverge), but
// they compose these primitives instead of re-inlining them (component
// centralization rule).
//
// Extracted verbatim from the original MarketingFormPage so the campaign flow
// behaves identically. Type-specific bits (the type dropdown, the per-type
// action list gating, the step labels) live in each module's own form file.

import { useState, useRef } from "react";
import {
    Check, ChevronDown, ChevronUp, SearchLg,
    CheckCircleBroken, Ticket01, Link01, SlashCircle01, FilterLines,
    MarkerPin01, CursorBox,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import type { Branch } from "@/lib/store";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type MarketingType = "campaign" | "announcement";
export type MarketingAction = "book_event" | "buy_ticket" | "external_link" | "no_action";

/** Which CTA options each marketing type offers (Figma 7046:* variants). */
export const ACTIONS_BY_TYPE: Record<MarketingType, MarketingAction[]> = {
    campaign: ["book_event", "external_link", "no_action"],
    announcement: ["external_link", "no_action"],
};

export const ACTION_META: Record<MarketingAction, { label: string; Icon: React.ElementType }> = {
    book_event:    { label: "Book an event", Icon: CheckCircleBroken },
    buy_ticket:    { label: "Buy a ticket",  Icon: Ticket01 },
    external_link: { label: "External link", Icon: Link01 },
    no_action:     { label: "No action",     Icon: SlashCircle01 },
};

/** The working shape every marketing form drives (a superset — a given module
 *  simply leaves the fields its type never uses untouched). */
export interface MarketingFormData {
    bannerPreview: string;
    name: string;
    type: MarketingType | "";
    description: string;
    action: MarketingAction | "";
    ticketPrice: string;
    /** book_event → the class the CTA opens (a class_schedule id, single). */
    ctaClassId: string;
    externalUrl: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    countdown: boolean;
    multiLocation: boolean;
    branchIds: string[];
    singleBranchId: string | null;
    productIds: string[];
    customerTargeting: "all" | "new_users" | "";
}

/** Current local time as "HH:MM" — used to bar past start-time slots today. */
export function nowHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

export interface FormStep { n: number; label: string }

export function StepItem({ step, current, total }: { step: FormStep; current: number; total: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === total;
    return (
        <div className={cn("flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full", active && "bg-[#f5fffa]")}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#457175]"
                        : complete ? "bg-[var(--colors-secondary-600)] text-white"
                            : "bg-[var(--colors-bg-tertiary)] border border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[var(--colors-bg-quaternary)] rounded-[2px]" />}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#10373a]"
                    : complete ? "font-medium text-[var(--colors-text-secondary)]" : "font-medium text-[var(--colors-text-quaternary)]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Shell primitives ─────────────────────────────────────────────────────────

export function FormCard({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-8">{children}</div>
            <div className="shrink-0 px-6 pb-6 pt-6 flex items-center">{footer}</div>
        </div>
    );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-5 w-full">
            <h3 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">{title}</h3>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">{hint}</p>}
        </div>
    );
}

export const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT_CLS} />;
}

export function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 96 }}
            className="w-full px-[14px] py-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y leading-6" />
    );
}

export function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
            className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", on ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]")}>
            <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                "shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]",
                on ? "left-[18px]" : "left-0.5",
            )} />
        </button>
    );
}

/** Bordered card with a lead toggle + optional revealed body. */
export function ToggleCard({ title, subtitle, on, onChange, children }: {
    title: string; subtitle: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "bg-white rounded-[12px] p-4 flex flex-col gap-3 transition-colors w-full",
            on ? "border-2 border-[var(--colors-secondary-500)]" : "border-1 border-[var(--colors-border-secondary)]",
        )}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">{title}</p>
                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-5">{subtitle}</p>
                </div>
                <Toggle on={on} onChange={onChange} />
            </div>
            {on && children}
        </div>
    );
}

export function FilledCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-secondary-600)]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

export function FilledRadio({ selected }: { selected: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors border",
            selected ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)]" : "bg-white border-[var(--colors-border-primary)]",
        )}>
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
    );
}

// ─── Link-or-action card ──────────────────────────────────────────────────────

export function ActionCard({ action, selected, onSelect }: {
    action: MarketingAction; selected: boolean; onSelect: () => void;
}) {
    const { label, Icon } = ACTION_META[action];
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "w-full min-w-0 flex items-center gap-3 p-4 rounded-[12px] transition-colors text-left",
                selected ? "bg-white border-2 border-[var(--colors-secondary-500)]" : "bg-white border-1 border-[var(--colors-border-secondary)] hover:bg-[#fafafa]",
            )}>
            <div className="w-8 h-8 rounded-[6px] bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] flex items-center justify-center shrink-0 text-[var(--colors-text-tertiary)]">
                <Icon className="w-5 h-5" />
            </div>
            <span className="flex-1 text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</span>
            <FilledRadio selected={selected} />
        </button>
    );
}

// ─── Time dropdown — half-hourly slots ────────────────────────────────────────

const TIME_OPTIONS: { value: string; label: string }[] = (() => {
    const out: { value: string; label: string }[] = [];
    for (let m = 0; m < 24 * 60; m += 30) {
        const h = Math.floor(m / 60), mm = m % 60;
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        out.push({
            value: `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
            label: `${h12}:${String(mm).padStart(2, "0")} ${ampm}`,
        });
    }
    return out;
})();

export function TimeSelect({ value, onChange, disabledOption }: {
    value: string; onChange: (v: string) => void;
    /** Returns true for slots that should be barred (past times, etc.). */
    disabledOption?: (slot: string) => boolean;
}) {
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);
    const selected = TIME_OPTIONS.find(o => o.value === value);
    function toggle() {
        if (btnRef.current) setWidth(btnRef.current.offsetWidth);
        setOpen(p => !p);
    }
    return (
        <>
            <button ref={btnRef} type="button" onClick={toggle}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[16px] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {selected?.label ?? "Select time"}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            {/* Fixed-positioned so the menu escapes the scrollable form card. */}
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={width || 220}>
                <div className="max-h-[240px] overflow-y-auto">
                    {TIME_OPTIONS.map(o => {
                        const disabled = disabledOption?.(o.value) ?? false;
                        return (
                            <button key={o.value} type="button" disabled={disabled}
                                onClick={() => { if (!disabled) { onChange(o.value); setOpen(false); } }}
                                className={cn(
                                    "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                    disabled ? "text-[var(--colors-border-primary)] cursor-not-allowed"
                                        : value === o.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                                )}>
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            </FixedDropdown>
        </>
    );
}

// ─── Class / event single-select (the "Book an event" CTA target) ─────────────

export interface ClassCtaOption { value: string; label: string; sub: string }

/** Single-select dropdown for the class/event the "Book an event" CTA opens.
 *  Fixed-positioned so the menu escapes the scrollable form card. */
export function ClassCtaSelect({ value, onChange, options, placeholder }: {
    value: string;
    onChange: (v: string) => void;
    options: ClassCtaOption[];
    placeholder: string;
}) {
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState(0);
    const [query, setQuery] = useState("");
    const btnRef = useRef<HTMLButtonElement>(null);
    const selected = options.find(o => o.value === value);
    function toggle() {
        if (btnRef.current) setWidth(btnRef.current.offsetWidth);
        setOpen(p => !p);
    }
    function close() {
        setOpen(false);
        setQuery("");
    }
    // Filter on class name + the sub-line (date · time · instructor) so a
    // search matches by class, day, or instructor.
    const q = query.trim().toLowerCase();
    const filtered = q
        ? options.filter(o => `${o.label} ${o.sub}`.toLowerCase().includes(q))
        : options;
    return (
        <>
            <button ref={btnRef} type="button" onClick={toggle}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[16px] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {selected?.label ?? placeholder}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={close} minWidth={width || 240}>
                {/* Sticky search — keeps the picker usable when there are many
                    classes. Filters by class name, date, or instructor. */}
                <div className="p-2 border-b-1 border-[var(--colors-bg-tertiary)] sticky top-0 bg-white">
                    <div className="flex items-center gap-2 h-9 px-2.5 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)]">
                        <SearchLg className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search class"
                            className="flex-1 min-w-0 text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] bg-transparent focus:outline-none"
                        />
                    </div>
                </div>
                <div className="max-h-[240px] overflow-y-auto">
                    {options.length === 0 ? (
                        <p className="px-3 py-3 text-[14px] text-[var(--colors-text-quaternary)]">No upcoming classes available.</p>
                    ) : filtered.length === 0 ? (
                        <p className="px-3 py-3 text-[14px] text-[var(--colors-text-quaternary)]">No classes match "{query.trim()}".</p>
                    ) : filtered.map(o => (
                        <button key={o.value} type="button"
                            onClick={() => { onChange(o.value); close(); }}
                            className={cn(
                                "flex flex-col w-full px-3 py-2 text-left transition-colors",
                                value === o.value ? "bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]",
                            )}>
                            <span className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">{o.label}</span>
                            <span className="text-[13px] text-[var(--colors-text-quaternary)] truncate">{o.sub}</span>
                        </button>
                    ))}
                </div>
            </FixedDropdown>
        </>
    );
}

// ─── Multi-select card (branches / packages / classes) ────────────────────────

export interface MultiOption { id: string; label: string; sublabel?: string; group?: string }

type RowFilter = "all" | "enabled" | "disabled";

/** Filter dropdown — All / Only enabled / Only disabled. */
function RowFilterDropdown({ active, onChange }: {
    active: RowFilter; onChange: (f: RowFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const OPTIONS: { value: RowFilter; label: string }[] = [
        { value: "all",      label: "All" },
        { value: "enabled",  label: "Only enabled" },
        { value: "disabled", label: "Only disabled" },
    ];
    return (
        <div className="shrink-0">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] font-semibold text-[var(--colors-text-secondary)] bg-white hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#164e52] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                {OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                        className={cn(
                            "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            active === opt.value ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                        )}>
                        {opt.label}
                    </button>
                ))}
            </FixedDropdown>
        </div>
    );
}

export function MultiSelectCard({ title, subtitle, options, selected, onChange }: {
    title: string; subtitle: string;
    options: MultiOption[];
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [filter, setFilter] = useState<RowFilter>("all");

    // "enabled" = checked rows, "disabled" = unchecked rows.
    const visibleOptions = options.filter(o => {
        if (filter === "enabled")  return selected.includes(o.id);
        if (filter === "disabled") return !selected.includes(o.id);
        return true;
    });
    const visibleIds = visibleOptions.map(o => o.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAll() {
        if (allVisibleSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    const groups = Array.from(new Set(visibleOptions.map(o => o.group ?? "")));

    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5 truncate">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)] shrink-0">
                    {selected.length} selected
                </span>
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="w-5 h-5 flex items-center justify-center text-[var(--colors-text-quaternary)] shrink-0">
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {expanded && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <FilledCheckbox checked={allVisibleSelected} onChange={toggleAll} />
                        <span className="flex-1 text-[14px] font-medium text-[var(--colors-text-primary)]">Select all</span>
                        <RowFilterDropdown active={filter} onChange={setFilter} />
                    </div>
                    <div className="h-px bg-[var(--colors-bg-quaternary)]" />
                    {groups.map(g => (
                        <div key={g || "_"} className="flex flex-col gap-3">
                            {g && <p className="text-[12px] text-[var(--colors-text-quaternary)] leading-[18px]">{g}</p>}
                            {visibleOptions.filter(o => (o.group ?? "") === g).map(o => (
                                <div key={o.id} className="flex items-center gap-2">
                                    <FilledCheckbox checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)} />
                                    <span className="text-[14px] font-medium text-[var(--colors-text-primary)] flex-1 truncate">{o.label}</span>
                                    {o.sublabel && <span className="text-[14px] text-[var(--colors-text-quaternary)] shrink-0">{o.sublabel}</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                    {visibleOptions.length === 0 && (
                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">
                            {options.length === 0 ? "Nothing available yet."
                                : filter === "enabled" ? "No options selected yet."
                                    : "All options are selected."}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Branch single-select dropdown (multi-location OFF) ───────────────────────

export function BranchSingleSelect({ value, onChange, branches }: {
    value: string | null; onChange: (id: string) => void;
    branches: Branch[];
}) {
    const [open, setOpen] = useState(false);
    const [width, setWidth] = useState(0);
    const btnRef = useRef<HTMLButtonElement>(null);
    const selected = branches.find(b => b.id === value);
    function toggle() {
        if (btnRef.current) setWidth(btnRef.current.offsetWidth);
        setOpen(p => !p);
    }
    return (
        <>
            <button ref={btnRef} type="button" onClick={toggle}
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[var(--colors-border-primary)] rounded-[8px] bg-white text-[16px] hover:bg-[var(--colors-bg-secondary)] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <MarkerPin01 className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
                <span className={cn("flex-1 text-left truncate", selected ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {selected ? selected.name : "Select location"}
                </span>
                <ChevronDown className="w-5 h-5 text-[var(--colors-text-quaternary)] shrink-0" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={width || 220}>
                {branches.map(b => (
                    <button key={b.id} type="button"
                        onClick={() => { onChange(b.id); setOpen(false); }}
                        className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            value === b.id ? "bg-[var(--colors-bg-secondary)] text-[var(--colors-text-primary)]" : "text-[var(--colors-text-secondary)] hover:bg-[var(--colors-bg-secondary)]",
                        )}>
                        <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)]" />
                        {b.name}
                    </button>
                ))}
            </FixedDropdown>
        </>
    );
}

// ─── Live preview panel (Figma 5885:202840) ───────────────────────────────────

const PREVIEW_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** "YYYY-MM-DD" + "HH:MM" → "20 March 2026, 12:00 AM". */
function formatPreviewDate(date: string, time: string): string {
    if (!date) return "date & time";
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return "date & time";
    let label = `${d} ${PREVIEW_MONTHS[m - 1]} ${y}`;
    if (time) {
        const [hRaw, mRaw] = time.split(":").map(Number);
        const ampm = hRaw >= 12 ? "PM" : "AM";
        const h12 = hRaw % 12 || 12;
        label += `, ${h12}:${String(mRaw).padStart(2, "0")} ${ampm}`;
    }
    return label;
}

function PreviewAttr({ icon, label, muted }: {
    icon: React.ReactNode; label: string; muted: boolean;
}) {
    return (
        <div className="flex items-center gap-1 min-w-0">
            <span className="w-4 h-4 shrink-0 text-[var(--colors-text-quaternary)]">{icon}</span>
            <span className={cn("text-[14px] truncate", muted ? "text-[var(--colors-fg-quaternary)]" : "text-[var(--colors-text-quaternary)]")}>
                {label}
            </span>
        </div>
    );
}

/** Right-hand live preview card. `noun` tailors the placeholder copy per module
 *  ("campaign" / "announcement"). `hideAction` drops the action attribute for
 *  announcements (information-only — no CTA), mirroring the customer banner. */
export function MarketingPreviewPanel({ form, branches, noun = "campaign", hideAction = false }: {
    form: MarketingFormData; branches: Branch[]; noun?: string; hideAction?: boolean;
}) {
    const name = form.name.trim();
    const description = form.description.trim();
    const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

    const branchLabel: string | null = (() => {
        if (form.multiLocation) {
            const n = form.branchIds.length;
            if (n === 0) return null;
            if (n >= branches.length) return "All branches";
            return `${n} ${n === 1 ? "branch" : "branches"}`;
        }
        return branches.find(b => b.id === form.singleBranchId)?.name ?? null;
    })();

    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            {/* Header */}
            <div className="pt-6 px-6 pb-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Marketing preview</p>
                <p className="text-[14px] text-[#667085] leading-5">This is how your marketing card will look like.</p>
            </div>
            {/* Stage */}
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] overflow-hidden flex flex-col w-[352px] mx-auto">
                    {/* Banner — image-only; the artwork carries all copy */}
                    <div className="relative h-[144px] shrink-0 overflow-hidden bg-gradient-to-br from-[#1d2939] via-[var(--colors-text-secondary)] to-[var(--colors-text-tertiary)]">
                        {form.bannerPreview && (
                            <img src={form.bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        {/* Status badge — top right (system status, not campaign copy) */}
                        <div className="absolute top-3 right-3 z-10">
                            <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]">
                                Active
                            </span>
                        </div>
                    </div>
                    {/* Content */}
                    <div className="flex flex-col gap-4 px-4 py-5">
                        <div className="flex flex-col gap-1">
                            <p className={cn("text-[18px] font-medium leading-7 truncate", name ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-fg-quaternary)]")}>
                                {name || `${Noun} title`}
                            </p>
                            <p className={cn("text-[14px] leading-5 line-clamp-2", description ? "text-[var(--colors-text-quaternary)]" : "text-[var(--colors-fg-quaternary)]")}>
                                {description || `Your ${noun} description will appear here.`}
                            </p>
                        </div>
                        {/* Attribute row — (action ·) branches. Announcements
                            hide the action attribute (information-only). */}
                        <div className={cn("grid gap-x-3", hideAction ? "grid-cols-1" : "grid-cols-2")}>
                            {!hideAction && (
                                <PreviewAttr icon={<CursorBox className="w-4 h-4" />}
                                    label={form.action && form.action !== "no_action" ? ACTION_META[form.action].label : "Link or action"}
                                    muted={!form.action || form.action === "no_action"} />
                            )}
                            <PreviewAttr icon={<MarkerPin01 className="w-4 h-4" />}
                                label={branchLabel ?? "Applicable branch"}
                                muted={!branchLabel} />
                        </div>
                        {/* Dashed divider */}
                        <div className="border-t border-dashed border-[var(--colors-border-secondary)]" />
                        {/* Valid until */}
                        <div className="flex items-center gap-1 text-[14px]">
                            <span className="text-[var(--colors-text-quaternary)]">Valid until</span>
                            <span className={cn("font-medium", form.endDate ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-fg-quaternary)]")}>
                                {formatPreviewDate(form.endDate, form.endTime)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
