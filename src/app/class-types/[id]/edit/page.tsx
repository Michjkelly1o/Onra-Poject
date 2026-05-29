"use client";

// Edit class template — same layout as /class-types/new but pre-filled with
// existing template data. On save: updateClassTemplate + toast + back to detail.

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAppStore, CLASS_CATEGORIES, type Membership, type Package } from "@/lib/store";
import { Toast } from "@/components/ui/Toast";
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

type LocationType = "Group" | "Private";

const CLASS_TYPES: LocationType[] = ["Group", "Private"];
// Sourced from the live `class_categories` seed so the dropdown always
// matches real categories (and resolves to a valid `categoryId` on save).
const CATEGORIES = CLASS_CATEGORIES.map(c => c.name);

// Built from the centralized `memberships` + `packages` seeds — the
// "Applicable memberships" picker stays in sync with whatever products the
// studio actually offers.
// Built live from store state at use-site so the picker reflects current
// Memberships & Packages module mutations.
type MembershipItem = { id: string; label: string; group: "Membership" | "Class package" };
function buildMembershipItems(memberships: Membership[], packages: Package[]): MembershipItem[] {
    return [
        ...memberships.map(m => ({ id: m.id, label: m.name, group: "Membership"    as const })),
        ...packages   .map(p => ({ id: p.id, label: p.name, group: "Class package" as const })),
    ];
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
        <div className={cn("flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full", active && "bg-[#f5fffa]")}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active  ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                            : complete ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />}
            </div>
            <span className={cn("text-[14px]", active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]")}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form helpers ─────────────────────────────────────────────────────────────

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

// ─── Image upload ─────────────────────────────────────────────────────────────

function ImageUploadArea({ preview, onChange }: {
    preview: string | null;
    onChange: (url: string | null, file: File | null) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    function handleFile(file: File) { onChange(URL.createObjectURL(file), file); }
    return (
        <div onClick={() => ref.current?.click()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.type.startsWith("image/")) handleFile(f); }}
            onDragOver={e => e.preventDefault()}
            className={cn("h-[200px] w-full border border-[#e4e7ec] rounded-[12px] flex flex-col items-center justify-center cursor-pointer transition-colors",
                preview ? "p-0 overflow-hidden" : "bg-white hover:bg-[#f9fafb]")}>
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
            <input ref={ref} type="file" accept="image/png,image/jpeg" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
    );
}

// ─── Template preview ─────────────────────────────────────────────────────────

interface PreviewData {
    name: string; description: string; category: string;
    classType: string; durationMin: string; capacity: string;
    coverPreview: string | null;
}

function TemplatePreviewCard({ data }: { data: PreviewData }) {
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[16px] overflow-hidden w-full">
            <div className="relative h-[156px] w-full overflow-hidden shrink-0 bg-gradient-to-br from-[#dbdbdb] to-[#dbdbdb]/20">
                {data.coverPreview && <img src={data.coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#ecfdf3] border border-[#abefc6] text-[#067647]">Active</span>
                </div>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                <div className="flex flex-col gap-1">
                    <h3 className={cn("font-medium text-[18px] leading-[28px]", data.name.trim() ? "text-[#101828]" : "text-[#667085]")}>
                        {data.name.trim() || "Class template name"}
                    </h3>
                    <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-2">
                        {data.description.trim() || "This is the default description of the class template."}
                    </p>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0"><Grid01 className="w-4 h-4 text-[#667085] shrink-0" /><span className="text-[14px] text-[#667085] truncate">{data.category || "Category"}</span></div>
                        <div className="flex items-center gap-1 flex-1 min-w-0"><User01 className="w-4 h-4 text-[#667085] shrink-0" /><span className="text-[14px] text-[#667085] truncate">{data.classType || "Class type"}</span></div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0"><ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" /><span className="text-[14px] text-[#667085]">{data.durationMin ? `${data.durationMin} min` : "Duration"}</span></div>
                        <div className="flex items-center gap-1 flex-1 min-w-0"><Users01 className="w-4 h-4 text-[#667085] shrink-0" /><span className="text-[14px] text-[#667085]">{data.capacity ? `${data.capacity} max` : "Capacity"}</span></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn("w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#658774]")}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

// ─── Step 1 ───────────────────────────────────────────────────────────────────

interface Step1Data {
    name: string; description: string; classType: string; category: string;
    durationMin: string; capacity: string; coverPreview: string | null; coverFile: File | null;
}

function BasicInformationStep({ data, onChange, onContinue }: {
    data: Step1Data; onChange: (d: Partial<Step1Data>) => void; onContinue: () => void;
}) {
    const canContinue = data.name.trim() && data.description.trim() && data.classType && data.category && data.durationMin && data.capacity;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Class template detail</h2>
                <div className="flex flex-col gap-4">
                    <FormField label="Image banner">
                        <ImageUploadArea preview={data.coverPreview} onChange={(url, file) => onChange({ coverPreview: url, coverFile: file })} />
                    </FormField>
                    <FormField label="Class name">
                        <input type="text" value={data.name} onChange={e => onChange({ name: e.target.value })} placeholder="Enter class name" className={inputCls} />
                    </FormField>
                    <FormField label="Class description">
                        <textarea rows={3} value={data.description} onChange={e => onChange({ description: e.target.value })} placeholder="Enter class description..."
                            className="w-full px-[14px] py-[10px] border border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-none" />
                    </FormField>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Class type">
                            <SelectInput placeholder="Select class type" value={data.classType} onChange={v => onChange({ classType: v })}
                                options={CLASS_TYPES.map(o => ({ value: o, label: o }))} width="w-full" />
                        </FormField>
                        <FormField label="Class category">
                            <SelectInput placeholder="Select class category" value={data.category} onChange={v => onChange({ category: v })}
                                options={CATEGORIES.map(o => ({ value: o, label: o }))} width="w-full" />
                        </FormField>
                    </div>
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
            <div className="shrink-0 px-6 pb-6 flex justify-end">
                <button type="button" disabled={!canContinue} onClick={onContinue}
                    className={cn("px-4 py-[10px] rounded-[8px] text-[16px] font-semibold transition-all",
                        canContinue
                            ? "bg-[#c4edd6] text-[#0c2d34] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed")}>
                    Continue
                </button>
            </div>
        </div>
    );
}

// ─── Step 2 ───────────────────────────────────────────────────────────────────

const GROUPS = ["Membership", "Class package"] as const;

function ApplicableMembershipsStep({ items, selected, onToggle, onSelectAll, onBack, onSave }: {
    items: MembershipItem[];
    selected: string[]; onToggle: (id: string) => void;
    onSelectAll: () => void; onBack: () => void; onSave: () => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const allSelected = items.every(m => selected.includes(m.id));
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-4">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Applicable memberships</h2>
                <div className="border border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <div className="flex items-center gap-4">
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-medium text-[#101828]">Packages</p>
                            <p className="text-[14px] text-[#667085]">The class template can be use on multiple packages</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border border-[#e4e7ec] text-[#344054] shrink-0">{selected.length} selected</span>
                        <button type="button" onClick={() => setExpanded(p => !p)} className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0">
                            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </div>
                    {expanded && (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Checkbox checked={allSelected} onChange={onSelectAll} />
                                <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                                <button type="button" className="flex items-center gap-1.5 h-9 px-3 border border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <FilterLines className="w-4 h-4" />Filter
                                </button>
                            </div>
                            <div className="h-px bg-[#e4e7ec]" />
                            {GROUPS.map(group => (
                                <div key={group} className="flex flex-col gap-3">
                                    <p className="text-[12px] text-[#667085]">{group}</p>
                                    {items.filter(m => m.group === group).map(item => (
                                        <div key={item.id} className="flex items-center gap-2">
                                            <Checkbox checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
                                            <span className="text-[14px] font-medium text-[#101828] flex-1">{item.label}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border border-[#e4e7ec] rounded-[12px]">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">Each class session created from this template will deduct 1 credit from a member's active package upon booking.</p>
                </div>
            </div>
            <div className="shrink-0 px-6 pb-6 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                <Button variant="primary" size="md" onClick={onSave}>Save changes</Button>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditClassTemplatePage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const { classTemplates, updateClassTemplate, showToast } = useAppStore();
    // Live store memberships/packages — picker reflects current catalog mutations.
    const allMemberships = useAppStore(s => s.memberships);
    const allPackages = useAppStore(s => s.packages);
    const membershipItems = buildMembershipItems(allMemberships, allPackages);

    const template = classTemplates.find(t => t.id === id);

    const [step, setStep] = useState<1 | 2>(1);

    const [step1, setStep1] = useState<Step1Data>({
        name:         template?.name         ?? "",
        description:  template?.description  ?? "",
        classType:    template?.locationType ?? "",
        category:     template?.category     ?? "",
        durationMin:  template ? String(template.durationMin) : "",
        capacity:     template ? String(template.capacity)    : "",
        coverPreview: template?.coverImage   ?? null,
        coverFile:    null,
    });

    const [selectedMemberships, setSelectedMemberships] = useState<string[]>(
        template
            ? [...template.applicableMembershipIds, ...template.applicablePackageIds]
            : membershipItems.map(m => m.id),
    );

    function handleToggle(itemId: string) {
        setSelectedMemberships(prev => prev.includes(itemId) ? prev.filter(x => x !== itemId) : [...prev, itemId]);
    }
    function handleSelectAll() {
        const all = membershipItems.map(m => m.id);
        setSelectedMemberships(all.every(x => selectedMemberships.includes(x)) ? [] : all);
    }

    function handleSave() {
        if (!template) return;
        const membershipIds = selectedMemberships.filter(x => allMemberships.some(m => m.id === x));
        const packageIds    = selectedMemberships.filter(x => allPackages.some(p => p.id === x));
        // Re-resolve the category FK + banner color whenever the category
        // changes — writing only the display name would leave a stale
        // `categoryId` / `coverColor`.
        const cat = CLASS_CATEGORIES.find(c => c.name === step1.category);
        updateClassTemplate(id, {
            name:                   step1.name,
            description:            step1.description,
            locationType:           step1.classType,
            categoryId:             cat?.id ?? template.categoryId,
            category:               step1.category,
            coverColor:             cat?.color_hex ?? template.coverColor,
            durationMin:            Number(step1.durationMin),
            capacity:               Number(step1.capacity),
            coverImage:             step1.coverPreview ?? undefined,
            applicableMembershipIds: membershipIds,
            applicablePackageIds:    packageIds,
            applicableMemberships:   selectedMemberships,
        });
        showToast("Class template updated successfully", "Your changes have been saved.", "success", "check");
        router.push(`/class-types/${id}`);
    }

    if (!template) {
        return (
            <div className="h-screen flex items-center justify-center">
                <p className="text-[16px] text-[#667085]">Template not found.</p>
            </div>
        );
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
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(`/class-types/${id}`)}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Edit class template</h1>
            </div>

            {/* 3-column content */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 py-6 h-full items-start">
                    {/* Steps */}
                    <div className="w-[260px] shrink-0 flex flex-col pt-2">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                    </div>

                    {/* Form */}
                    {step === 1 ? (
                        <BasicInformationStep data={step1} onChange={d => setStep1(prev => ({ ...prev, ...d }))} onContinue={() => setStep(2)} />
                    ) : (
                        <ApplicableMembershipsStep items={membershipItems} selected={selectedMemberships} onToggle={handleToggle}
                            onSelectAll={handleSelectAll} onBack={() => setStep(1)} onSave={handleSave} />
                    )}

                    {/* Preview */}
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
            <Toast />
        </div>
    );
}
