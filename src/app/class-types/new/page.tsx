"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore, type Membership, type Package } from "@/lib/store";
import {
    XClose, UploadCloud02, Grid01, User01,
    ClockFastForward, Users01,
    ChevronDown, ChevronUp, Check, Lightbulb02, FilterLines,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateStatus = "Active" | "Archived" | "Inactive";
type LocationType   = "Group" | "Private";

const CLASS_TYPES: LocationType[] = ["Group", "Private"];
// Categories are read from the LIVE `classCategories` store slice inside
// the component (Phase 4) so add / edit / delete in Booking Rules
// surfaces here on the same render.

// Membership items for step 2 — built from LIVE store state so the picker
// reflects products the admin has just added / deactivated / archived in
// the Memberships & Packages module.
type MembershipItem = { id: string; label: string; group: "Membership" | "Class package" };
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
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== null && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border border-white" />
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

// ─── Progress stepper ─────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Basic information" },
    { n: 2, label: "Applicable memberships" },
];

function StepItem({ step, current }: { step: typeof STEPS[0]; current: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === STEPS.length;

    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            {/* Circle + connector */}
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            {/* Label */}
            <span className={cn(
                "text-[14px]",
                active   ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form input helpers ───────────────────────────────────────────────────────

const inputCls = "h-10 w-full px-[14px] border border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[#475467]">{hint}</p>}
        </div>
    );
}

// ─── Image upload area ────────────────────────────────────────────────────────

function ImageUploadArea({
    preview, onChange,
}: {
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
                "h-[200px] w-full border border-[#e4e7ec] rounded-[12px] flex flex-col items-center justify-center cursor-pointer transition-colors",
                preview ? "p-0 overflow-hidden" : "bg-white hover:bg-[#f9fafb]",
            )}
        >
            {preview ? (
                <img src={preview} alt="Banner" className="w-full h-full object-cover" />
            ) : (
                <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#f1f2ed] border border-[#e4e7ec] flex items-center justify-center">
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

// ─── Template preview card ────────────────────────────────────────────────────

interface PreviewData {
    name: string;
    description: string;
    category: string;
    classType: string;
    durationMin: string;
    capacity: string;
    coverPreview: string | null;
}

function TemplatePreviewCard({ data }: { data: PreviewData }) {
    const hasName = !!data.name.trim();
    const hasDesc = !!data.description.trim();

    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[16px] overflow-hidden w-full">
            {/* Banner */}
            <div className="relative h-[156px] w-full overflow-hidden shrink-0 bg-gradient-to-br from-[#dbdbdb] to-[#dbdbdb]/20">
                {data.coverPreview && (
                    <img src={data.coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                {/* Status badge — always Active for new templates */}
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#ecfdf3] border border-[#abefc6] text-[#067647]">
                        Active
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                <div className="flex flex-col gap-1">
                    <h3 className={cn("font-medium text-[18px] leading-[28px]", hasName ? "text-[#101828]" : "text-[#667085]")}>
                        {hasName ? data.name : "Class template name"}
                    </h3>
                    <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-2">
                        {hasDesc ? data.description : "This is the default description of the class template."}
                    </p>
                </div>

                {/* Attributes */}
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Grid01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.category || "Category"}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <User01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.classType || "Class type"}</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085]">
                                {data.durationMin ? `${data.durationMin} min` : "Duration"}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085]">
                                {data.capacity ? `${data.capacity} max` : "Capacity"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked
                    ? "bg-[#658774] border-[#658774]"
                    : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}
        >
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

// ─── Step 1 — Basic information ───────────────────────────────────────────────

interface Step1Data {
    name: string;
    description: string;
    classType: string;
    category: string;
    durationMin: string;
    capacity: string;
    coverPreview: string | null;
    coverFile: File | null;
}

function BasicInformationStep({
    data,
    onChange,
    onContinue,
    categoryOptions,
}: {
    data: Step1Data;
    onChange: (d: Partial<Step1Data>) => void;
    onContinue: () => void;
    /** Live category list — passed in so this step doesn't re-subscribe to
     *  the store. Phase 4 wiring (Booking Rules → class template). */
    categoryOptions: string[];
}) {
    const canContinue =
        data.name.trim() &&
        data.description.trim() &&
        data.classType &&
        data.category &&
        data.durationMin &&
        data.capacity;

    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            {/* Scrollable form area */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Class template detail</h2>

                <div className="flex flex-col gap-4">
                    {/* Image banner */}
                    <FormField label="Image banner">
                        <ImageUploadArea
                            preview={data.coverPreview}
                            onChange={(url, file) => onChange({ coverPreview: url, coverFile: file })}
                        />
                    </FormField>

                    {/* Class name */}
                    <FormField label="Class name">
                        <input
                            type="text"
                            value={data.name}
                            onChange={e => onChange({ name: e.target.value })}
                            placeholder="Enter class name"
                            className={inputCls}
                        />
                    </FormField>

                    {/* Class description */}
                    <FormField label="Class description">
                        <textarea
                            rows={3}
                            value={data.description}
                            onChange={e => onChange({ description: e.target.value })}
                            placeholder="Enter class description..."
                            className="w-full px-[14px] py-[10px] border border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-none"
                        />
                    </FormField>

                    {/* Class type + Category */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Class type">
                            <SelectInput
                                placeholder="Select class type"
                                value={data.classType}
                                onChange={v => onChange({ classType: v })}
                                options={CLASS_TYPES.map(o => ({ value: o, label: o }))}
                                width="w-full"
                            />
                        </FormField>
                        <FormField label="Class category">
                            <SelectInput
                                placeholder="Select class category"
                                value={data.category}
                                onChange={v => onChange({ category: v })}
                                options={categoryOptions.map(o => ({ value: o, label: o }))}
                                width="w-full"
                            />
                        </FormField>
                    </div>

                    {/* Duration + Capacity */}
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Duration" hint="in minutes">
                            <NumericStringInput value={data.durationMin} onChange={v => onChange({ durationMin: v })} min={0} suffix="min" />
                        </FormField>
                        <FormField label="Class capacity">
                            <NumericStringInput value={data.capacity} onChange={v => onChange({ capacity: v })} min={0} />
                        </FormField>
                    </div>
                </div>
            </div>

            {/* Fixed footer */}
            <div className="shrink-0 px-6 pb-6 flex justify-end">
                <button
                    type="button"
                    disabled={!canContinue}
                    onClick={onContinue}
                    className={cn(
                        "px-4 py-[10px] rounded-[8px] text-[16px] font-semibold transition-all",
                        canContinue
                            ? "bg-[#c4edd6] text-[#0c2d34] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed",
                    )}
                >
                    Continue
                </button>
            </div>
        </div>
    );
}

// ─── Step 2 — Applicable memberships ─────────────────────────────────────────

const GROUPS = ["Membership", "Class package"] as const;

function ApplicableMembershipsStep({
    items,
    selected,
    onChange,
    onBack,
    onCreate,
}: {
    items: MembershipItem[];
    selected: string[];
    onChange: (next: string[]) => void;
    onBack: () => void;
    onCreate: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [membershipFilter, setMembershipFilter] = useState<MembershipFilterValue>(null);

    // Filter by selection state — matches the Agreements module's
    // Applicable services pattern (MultiSelectCard in AgreementFormPage):
    //   • "Only enabled"  → rows the admin has CHECKED
    //   • "Only disabled" → rows the admin has NOT CHECKED
    const visibleItems = items.filter(m => {
        if (membershipFilter === null) return true;
        if (membershipFilter === "enabled") return selected.includes(m.id);
        return !selected.includes(m.id);
    });
    const visibleIds = visibleItems.map(m => m.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function onToggle(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function onSelectAll() {
        if (allSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Applicable memberships</h2>

                {/* Packages accordion */}
                <div className="border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    {/* Accordion header */}
                    <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828]">Packages</p>
                            <p className="text-[14px] text-[#667085]">The class template can be use on multiple packages</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border border-[#e4e7ec] text-[#344054] shrink-0">
                            {selected.length} selected
                        </span>
                        <button
                            type="button"
                            onClick={() => setExpanded(p => !p)}
                            className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0"
                        >
                            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>

                    {expanded && (
                        <div className="flex flex-col gap-3">
                            {/* Select all + filter row */}
                            <div className="flex items-center gap-2">
                                <Checkbox checked={allSelected} onChange={onSelectAll} />
                                <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                                <MembershipFilterDropdown active={membershipFilter} onChange={setMembershipFilter} />
                            </div>

                            {/* Divider */}
                            <div className="h-px bg-[#e4e7ec]" />

                            {/* List grouped by type */}
                            {GROUPS.map(group => {
                                const items = visibleItems.filter(m => m.group === group);
                                if (items.length === 0) return null;
                                return (
                                    <div key={group} className="flex flex-col gap-3">
                                        <p className="text-[12px] text-[#667085]">{group}</p>
                                        {items.map(item => (
                                            <div key={item.id} className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={selected.includes(item.id)}
                                                    onChange={() => onToggle(item.id)}
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

                {/* Info alert */}
                <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        Each class session created from this template will deduct 1 credit from a member's active package upon booking.
                    </p>
                </div>
            </div>

            {/* Fixed footer */}
            <div className="shrink-0 px-6 pb-6 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                <Button variant="primary" size="md" onClick={onCreate}>Create template</Button>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewClassTemplatePage() {
    const router = useRouter();
    const [step, setStep] = useState<1 | 2>(1);

    const [step1, setStep1] = useState<Step1Data>({
        name: "",
        description: "",
        classType: "",
        category: "",
        durationMin: "",
        capacity: "",
        coverPreview: null,
        coverFile: null,
    });

    const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);
    // Live store-derived items so newly-created memberships/packages in the
    // Memberships & Packages module appear in the picker without a refresh.
    const allMemberships = useAppStore(s => s.memberships);
    const allPackages    = useAppStore(s => s.packages);
    const classCategories = useAppStore(s => s.classCategories);
    const categoryOptions = classCategories.map(c => c.name);
    const membershipItems = buildMembershipItems(allMemberships, allPackages);


    const { addClassTemplate, showToast } = useAppStore();

    function handleCreate() {
        const cat = classCategories.find(c => c.name === step1.category);
        const membershipIds = selectedMemberships.filter(x => allMemberships.some(m => m.id === x));
        const packageIds    = selectedMemberships.filter(x => allPackages.some(p => p.id === x));
        addClassTemplate({
            name: step1.name,
            description: step1.description,
            categoryId: cat?.id ?? "",
            category: step1.category,
            locationType: step1.classType,
            durationMin: Number(step1.durationMin),
            capacity: Number(step1.capacity),
            status: "Active",
            coverImage: step1.coverPreview ?? undefined,
            coverColor: cat?.color_hex ?? "#e9fff3",
            applicableMembershipIds: membershipIds,
            applicablePackageIds: packageIds,
            applicableMemberships: selectedMemberships,
        });
        showToast(
            "Class template created successfully",
            "You can now assign this class template when creating or editing classes.",
        );
        router.push("/admin/class-types");
    }

    const previewData: PreviewData = {
        name:         step1.name,
        description:  step1.description,
        category:     step1.category,
        classType:    step1.classType,
        durationMin:  step1.durationMin,
        capacity:     step1.capacity,
        coverPreview: step1.coverPreview,
    };

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">

                {/* Header */}
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button
                        type="button"
                        onClick={() => router.push("/admin/class-types")}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Create new template</h1>
                </div>

                {/* 3-column content — fills remaining height, no page scroll */}
                <div className="flex-1 overflow-hidden">
                    <div className="flex gap-8 px-6 py-6 h-full items-start">

                        {/* Left: progress steps */}
                        <div className="w-[260px] shrink-0 flex flex-col pt-2">
                            {STEPS.map(s => (
                                <StepItem key={s.n} step={s} current={step} />
                            ))}
                        </div>

                        {/* Middle: form — fills height, internal scroll handled per step */}
                        {step === 1 ? (
                            <BasicInformationStep
                                data={step1}
                                onChange={d => setStep1(prev => ({ ...prev, ...d }))}
                                onContinue={() => setStep(2)}
                                categoryOptions={categoryOptions}
                            />
                        ) : (
                            <ApplicableMembershipsStep
                                items={membershipItems}
                                selected={selectedMemberships}
                                onChange={setSelectedMemberships}
                                onBack={() => setStep(1)}
                                onCreate={handleCreate}
                            />
                        )}

                        {/* Right: live preview — hugs content, no fill */}
                        <div className="w-[340px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] overflow-hidden self-start">
                            <div className="p-6 pb-4">
                                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Template preview</p>
                                <p className="text-[14px] text-[#6e776f] mt-1">This is how your class template will look like.</p>
                            </div>
                            <div className="bg-[#f6f6f3] px-6 py-10">
                                <TemplatePreviewCard data={previewData} />
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
