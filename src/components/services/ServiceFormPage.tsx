"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Service create / edit form (Module 13, Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// 3-step wizard mirroring the class-template create flow's chrome verbatim:
// left sidebar = progress stepper, middle = scrollable form card, right =
// live preview. Reused so the two modules look identical to the eye.
//
// STEPS
//   1. Service detail (Figma 7460:16866 / 7460:16960)
//      – Image banner upload
//      – Service name
//      – Class category (live `classCategories` slice — adds in Booking
//        Rules surface here on the same render)
//      – Duration (in minutes)
//      – "Booking conditions" sub-section:
//        • Service is open sessions toggle. When ON the card shows a green
//          border + Service capacity field. When OFF the card is neutral
//          and no capacity is collected (Private services have no cap).
//   2. Applicable memberships (Figma 7421:107593)
//      – Same accordion + filter + select-all + grouped list as the class-
//        template form.
//   3. Location (Figma 7422:95427)
//      – Single-select branch dropdown (live `branches` slice, active
//        branches only).
//
// MODE
//   • create — empty defaults, route returns to /admin/services on success
//   • edit   — prefills from the picked service via store id lookup; calls
//              updateService (NOT addService) and shows a "Service updated"
//              toast instead.
//
// CROSS-MODULE SYNC
//   • Read: classCategories, branches, memberships, packages — all from the
//     live store. Edits in Booking Rules / Business & Locations / Products
//     reflect here on the same render.
//   • Write: addService / updateService persist into `services` and the
//     `onra-demo-state` localStorage payload so the list page and any
//     future appointment / schedule surface picks the change up across
//     tabs without a refresh.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, UploadCloud02, Check, ChevronDown, ChevronUp,
    Lightbulb02, FilterLines, Grid01, ClockFastForward, Users01, MarkerPin01, User01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { useAppStore, type Membership, type Package, type Service } from "@/lib/store";

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Service detail" },
    { n: 2, label: "Applicable memberships" },
    { n: 3, label: "Location" },
] as const;

function StepItem({ step, current }: { step: typeof STEPS[number]; current: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === STEPS.length;
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
                        : complete
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form input helpers (verbatim from class-template form) ─────────────────

const inputCls = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[#475467]">{hint}</p>}
        </div>
    );
}

// ─── Image upload ────────────────────────────────────────────────────────────

function ImageUploadArea({ preview, onChange }: {
    preview: string | null;
    onChange: (url: string | null, file: File | null) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        const url = URL.createObjectURL(file);
        onChange(url, file);
    }
    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) handleFile(file);
    }

    return (
        <div
            onClick={() => ref.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            className={cn(
                "h-[200px] w-full border-1 border-[#e4e7ec] rounded-[12px] flex flex-col items-center justify-center cursor-pointer transition-colors",
                preview ? "p-0 overflow-hidden" : "bg-white hover:bg-[#f9fafb]",
            )}
        >
            {preview ? (
                <img src={preview} alt="Banner" className="w-full h-full object-cover" />
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#f1f2ed] border-1 border-[#e4e7ec] flex items-center justify-center">
                        <UploadCloud02 className="w-6 h-6 text-[#475467]" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[14px] font-semibold text-[#4f6e5d]">Upload image</span>
                        <span className="text-[12px] text-[#475467]">PNG or JPG (max. 800×400px)</span>
                    </div>
                </div>
            )}
            <input
                ref={ref}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
        </div>
    );
}

// ─── Toggle (DS-standard sage on/off) ────────────────────────────────────────

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

// ─── Live preview card (right rail) ─────────────────────────────────────────
//
// Reuses the class-template preview shape so the two surfaces feel familiar.
// Drives a "Capacity" line only when openSession is ON — Private services
// have no capacity field, so showing one would be misleading.

interface PreviewData {
    name: string;
    category: string;
    durationMin: string;
    capacity: string;
    openSession: boolean;
    coverPreview: string | null;
}

function ServicePreviewCard({ data }: { data: PreviewData }) {
    const hasName = !!data.name.trim();
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden w-full">
            <div className="relative h-[156px] w-full overflow-hidden shrink-0 bg-gradient-to-br from-[#dbdbdb] to-[#dbdbdb]/20">
                {data.coverPreview && (
                    <img src={data.coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]">
                        Active
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                <div className="flex flex-col gap-1">
                    <h3 className={cn("font-medium text-[18px] leading-[28px]", hasName ? "text-[#101828]" : "text-[#667085]")}>
                        {hasName ? data.name : "Service name"}
                    </h3>
                    <p className="text-[14px] text-[#667085] leading-[20px]">
                        {data.openSession ? "Open session — no instructor required." : "Private — 1-on-1 with an instructor."}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Grid01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.category || "Category"}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <User01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.openSession ? "Open session" : "Private"}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085]">
                                {data.durationMin ? `${data.durationMin} min` : "Duration"}
                            </span>
                        </div>
                        {data.openSession && (
                            <div className="flex items-center gap-1 flex-1 min-w-0">
                                <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="text-[14px] text-[#667085]">
                                    {data.capacity ? `${data.capacity} max` : "Capacity"}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1 — Service detail ────────────────────────────────────────────────

interface Step1Data {
    name: string;
    category: string;
    durationMin: string;
    openSession: boolean;
    capacity: string;
    coverPreview: string | null;
    coverFile: File | null;
}

function ServiceDetailStep({
    data, onChange, onContinue, categoryOptions,
}: {
    data: Step1Data;
    onChange: (d: Partial<Step1Data>) => void;
    onContinue: () => void;
    categoryOptions: string[];
}) {
    // Required fields differ by openSession:
    //   • open  → name + category + duration + capacity
    //   • close → name + category + duration
    const canContinue =
        data.name.trim() &&
        data.category &&
        data.durationMin &&
        (!data.openSession || data.capacity);

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Service detail</h2>

                <FormField label="Image banner">
                    <ImageUploadArea
                        preview={data.coverPreview}
                        onChange={(url, file) => onChange({ coverPreview: url, coverFile: file })}
                    />
                </FormField>

                <FormField label="Service name">
                    <input
                        type="text"
                        value={data.name}
                        onChange={e => onChange({ name: e.target.value })}
                        placeholder="Enter service name"
                        className={inputCls}
                    />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                    <FormField label="Class category">
                        <SelectInput
                            placeholder="Select class category"
                            value={data.category}
                            onChange={v => onChange({ category: v })}
                            options={categoryOptions.map(o => ({ value: o, label: o }))}
                            width="w-full"
                        />
                    </FormField>
                    <FormField label="Duration" hint="in minutes">
                        <NumericStringInput value={data.durationMin} onChange={v => onChange({ durationMin: v })} min={0} suffix="min" />
                    </FormField>
                </div>

                {/* Booking conditions */}
                <div className="flex flex-col gap-3">
                    <h3 className="font-semibold text-[16px] leading-[24px] text-[#101828]">Booking conditions</h3>

                    <div className={cn(
                        "rounded-[12px] p-4 flex flex-col gap-4 transition-colors",
                        data.openSession
                            ? "border-1 border-[#7ba08c] bg-[#f5fffa]"
                            : "border-1 border-[#e4e7ec] bg-white",
                    )}>
                        <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#101828]">Service is open sessions</p>
                                <p className="text-[14px] text-[#667085]">The service is open to multiple participants and does not require instructor.</p>
                            </div>
                            <Toggle
                                on={data.openSession}
                                onChange={() => {
                                    // Toggling off wipes capacity so the persisted
                                    // row never carries a stale leftover.
                                    onChange({ openSession: !data.openSession, ...(data.openSession ? { capacity: "" } : {}) });
                                }}
                                ariaLabel="Toggle open sessions"
                            />
                        </div>
                        {data.openSession && (
                            <FormField label="Service capacity">
                                <NumericStringInput value={data.capacity} onChange={v => onChange({ capacity: v })} min={0} />
                            </FormField>
                        )}
                    </div>
                </div>
            </div>

            <div className="shrink-0 px-6 pb-6 flex justify-end">
                <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>
                    Continue
                </Button>
            </div>
        </div>
    );
}

// ─── Step 2 — Applicable memberships ────────────────────────────────────────

type MembershipItem = { id: string; label: string; group: "Membership" | "Class package" };
const GROUPS = ["Membership", "Class package"] as const;

function buildMembershipItems(memberships: Membership[], packages: Package[]): MembershipItem[] {
    return [
        ...memberships.map(m => ({ id: m.id, label: m.name, group: "Membership"    as const })),
        ...packages   .map(p => ({ id: p.id, label: p.name, group: "Class package" as const })),
    ];
}

type MembershipFilterValue = "enabled" | "disabled" | null;

function MembershipFilterDropdown({ active, onChange }: {
    active: MembershipFilterValue;
    onChange: (f: MembershipFilterValue) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const OPTIONS: { value: MembershipFilterValue; label: string }[] = [
        { value: null,       label: "All" },
        { value: "enabled",  label: "Only enabled" },
        { value: "disabled", label: "Only disabled" },
    ];
    return (
        <div ref={ref} className="relative">
            <button type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== null && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 overflow-hidden">
                    {OPTIONS.map(opt => (
                        <button key={String(opt.value)} type="button"
                            onClick={() => { onChange(opt.value); setOpen(false); }}
                            className={cn(
                                "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                                active === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                            )}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border-1",
                checked
                    ? "bg-[#658774] border-[#658774]"
                    : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

function ApplicableMembershipsStep({
    items, selected, onChange, onBack, onContinue,
}: {
    items: MembershipItem[];
    selected: string[];
    onChange: (next: string[]) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [filter, setFilter] = useState<MembershipFilterValue>(null);

    const visibleItems = items.filter(m => {
        if (filter === null) return true;
        if (filter === "enabled") return selected.includes(m.id);
        return !selected.includes(m.id);
    });
    const visibleIds = visibleItems.map(m => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAll() {
        if (allSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Applicable memberships</h2>

                <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828]">Packages</p>
                            <p className="text-[14px] text-[#667085]">The service can be used with multiple memberships or packages</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                            {selected.length} selected
                        </span>
                        <button type="button" onClick={() => setExpanded(p => !p)}
                            className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0">
                            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>

                    {expanded && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Checkbox checked={allSelected} onChange={toggleAll} />
                                <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                                <MembershipFilterDropdown active={filter} onChange={setFilter} />
                            </div>
                            <div className="h-px bg-[#e4e7ec]" />
                            {GROUPS.map(group => {
                                const groupItems = visibleItems.filter(m => m.group === group);
                                if (groupItems.length === 0) return null;
                                return (
                                    <div key={group} className="flex flex-col gap-3">
                                        <p className="text-[12px] text-[#667085]">{group}</p>
                                        {groupItems.map(item => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selected.includes(item.id)}
                                                    onChange={() => toggleOne(item.id)}
                                                />
                                                <span className="text-[14px] font-medium text-[#101828] flex-1">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        Each appointment booked against this service will deduct 1 credit from the member's active package.
                    </p>
                </div>
            </div>

            <div className="shrink-0 px-6 pb-6 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                <Button variant="primary" size="md" onClick={onContinue}>Continue</Button>
            </div>
        </div>
    );
}

// ─── Step 3 — Location (single-select branch) ───────────────────────────────

function LocationStep({
    branchId, onChange, branchOptions, onBack, onSubmit, mode,
}: {
    branchId: string;
    onChange: (v: string) => void;
    branchOptions: { value: string; label: string }[];
    onBack: () => void;
    onSubmit: () => void;
    mode: "create" | "edit";
}) {
    const canSubmit = !!branchId;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Location</h2>

                <FormField label="Branch location">
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder="Select location"
                        value={branchId}
                        onChange={onChange}
                        options={branchOptions}
                        width="w-full"
                    />
                </FormField>

                <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        This service will be offered at the selected branch only. You can re-assign it later by editing the service.
                    </p>
                </div>
            </div>

            <div className="shrink-0 px-6 pb-6 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                <Button variant="primary" size="md" disabled={!canSubmit} onClick={onSubmit}>
                    {mode === "create" ? "Create service" : "Save changes"}
                </Button>
            </div>
        </div>
    );
}

// ─── Shared page (used by /admin/services/new + /[id]/edit) ─────────────────

export interface ServiceFormPageProps {
    mode: "create" | "edit";
    /** Service id — required in edit mode, ignored in create mode. */
    serviceId?: string;
}

export function ServiceFormPage({ mode, serviceId }: ServiceFormPageProps) {
    const router = useRouter();

    // Live store reads — every dropdown updates when the underlying module
    // (Booking Rules / Business & Locations / Products) mutates.
    const services         = useAppStore(s => s.services);
    const branches         = useAppStore(s => s.branches);
    const classCategories  = useAppStore(s => s.classCategories);
    const allMemberships   = useAppStore(s => s.memberships);
    const allPackages      = useAppStore(s => s.packages);
    const addService       = useAppStore(s => s.addService);
    const updateService    = useAppStore(s => s.updateService);
    const showToast        = useAppStore(s => s.showToast);

    const existing: Service | undefined = mode === "edit" && serviceId
        ? services.find(s => s.id === serviceId)
        : undefined;

    // ─── Step state ────────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [step1, setStep1] = useState<Step1Data>(() => ({
        name:         existing?.name ?? "",
        category:     existing?.category ?? "",
        durationMin:  existing ? String(existing.durationMin) : "",
        openSession:  existing?.openSession ?? false,
        capacity:     existing && existing.capacity > 0 ? String(existing.capacity) : "",
        coverPreview: existing?.coverImage ?? null,
        coverFile:    null,
    }));

    const [selectedMemberships, setSelectedMemberships] = useState<string[]>(
        () => existing ? [...existing.applicableMembershipIds, ...existing.applicablePackageIds] : [],
    );
    const [branchId, setBranchId] = useState<string>(existing?.branchId ?? "");

    // If the edit-mode service id appears asynchronously (rare but possible
    // on resume-from-persist), refresh the local state once it lands.
    useEffect(() => {
        if (mode !== "edit" || !existing) return;
        setStep1({
            name:         existing.name,
            category:     existing.category,
            durationMin:  String(existing.durationMin),
            openSession:  existing.openSession,
            capacity:     existing.capacity > 0 ? String(existing.capacity) : "",
            coverPreview: existing.coverImage ?? null,
            coverFile:    null,
        });
        setSelectedMemberships([...existing.applicableMembershipIds, ...existing.applicablePackageIds]);
        setBranchId(existing.branchId);
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Derived dropdown sources ──────────────────────────────────────────
    const categoryOptions = useMemo(() => classCategories.map(c => c.name), [classCategories]);
    const branchOptions   = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );
    const membershipItems = useMemo(
        () => buildMembershipItems(allMemberships, allPackages),
        [allMemberships, allPackages],
    );

    // ─── Submit ────────────────────────────────────────────────────────────
    function handleSubmit() {
        const cat = classCategories.find(c => c.name === step1.category);
        const memberOnlyIds  = selectedMemberships.filter(id => allMemberships.some(m => m.id === id));
        const packageOnlyIds = selectedMemberships.filter(id => allPackages.some(p => p.id === id));
        const branch         = branches.find(b => b.id === branchId);

        const payload = {
            name:        step1.name.trim(),
            description: existing?.description ?? "",
            categoryId:  cat?.id ?? "",
            category:    step1.category,
            openSession: step1.openSession,
            durationMin: Number(step1.durationMin),
            capacity:    step1.openSession ? Number(step1.capacity) : 0,
            branchId:    branchId,
            branchName:  branch?.name ?? "",
            status:      (existing?.status ?? "Active") as Service["status"],
            coverImage:  step1.coverPreview ?? undefined,
            coverColor:  cat?.color_hex ?? "#e9fff3",
            applicableMembershipIds: memberOnlyIds,
            applicablePackageIds:    packageOnlyIds,
        };

        if (mode === "edit" && existing) {
            updateService(existing.id, payload);
            showToast(
                "Service updated successfully",
                `${payload.name} has been saved.`,
                "success", "check",
            );
        } else {
            addService(payload);
            showToast(
                "Service created successfully",
                "You can now offer this service when booking new appointments.",
                "success", "check",
            );
        }
        router.push("/admin/services");
    }

    // Edit-mode safety — if the id is missing, surface a friendly hand-off.
    if (mode === "edit" && !existing) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center gap-3">
                <p className="font-semibold text-[18px] text-[#101828]">Service not found</p>
                <p className="text-[14px] text-[#667085]">The service you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={() => router.push("/admin/services")}>
                    Back to services
                </Button>
            </div>
        );
    }

    const previewData: PreviewData = {
        name:         step1.name,
        category:     step1.category,
        durationMin:  step1.durationMin,
        capacity:     step1.capacity,
        openSession:  step1.openSession,
        coverPreview: step1.coverPreview,
    };

    const pageTitle = mode === "edit"
        ? `Edit ${existing?.name ?? "service"}`
        : "Create new service";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button"
                        onClick={() => router.push("/admin/services")}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{pageTitle}</h1>
                </div>

                {/* 3-column body */}
                <div className="flex-1 overflow-hidden">
                    <div className="flex gap-8 px-6 py-6 h-full items-start">
                        {/* Left: stepper */}
                        <div className="w-[260px] shrink-0 flex flex-col pt-2">
                            {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                        </div>

                        {/* Middle: form */}
                        {step === 1 && (
                            <ServiceDetailStep
                                data={step1}
                                onChange={d => setStep1(prev => ({ ...prev, ...d }))}
                                onContinue={() => setStep(2)}
                                categoryOptions={categoryOptions}
                            />
                        )}
                        {step === 2 && (
                            <ApplicableMembershipsStep
                                items={membershipItems}
                                selected={selectedMemberships}
                                onChange={setSelectedMemberships}
                                onBack={() => setStep(1)}
                                onContinue={() => setStep(3)}
                            />
                        )}
                        {step === 3 && (
                            <LocationStep
                                branchId={branchId}
                                onChange={setBranchId}
                                branchOptions={branchOptions}
                                onBack={() => setStep(2)}
                                onSubmit={handleSubmit}
                                mode={mode}
                            />
                        )}

                        {/* Right: live preview */}
                        <div className="w-[340px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden self-start">
                            <div className="p-6 pb-4">
                                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Service preview</p>
                                <p className="text-[14px] text-[#6e776f] mt-1">This is how your service will look like.</p>
                            </div>
                            <div className="bg-[#f6f6f3] px-6 py-10">
                                <ServicePreviewCard data={previewData} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
