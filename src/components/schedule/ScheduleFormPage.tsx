"use client";

import { Fragment, useState, useRef, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose, ChevronLeft, ChevronDown, ChevronUp, ChevronRight, Check, SearchMd,
    Calendar, MarkerPin01, ClockFastForward, Users01,
    UploadCloud01, AlertCircle, Plus, Trash01,
    Settings03, Building01, Star01, Grid01, ArrowRight,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, SCHEDULE_INSTRUCTORS, type ClassInstance } from "@/lib/store";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { NumericInput } from "@/components/ui/NumericInput";

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_TYPES   = ["Group", "Private", "Semi-private"] as const;
const CATEGORIES    = ["Pilates", "Yoga", "Barre", "Strength", "Recovery", "Cardio", "HIIT", "Dance"];
const GENDER_OPTIONS = ["All genders", "Female only", "Male only"];
const STEPS = [
    { n: 1, label: "Class details" },
    { n: 2, label: "Location & instructor" },
    { n: 3, label: "Date & time" },
];
const EDIT_STEPS = [
    { n: 1, label: "Class details" },
    { n: 2, label: "Location & instructor" },
];

const BRANCH_ROOMS = [
    {
        branch: "Forma Studio (South)",
        rooms: [
            { id: "r1", name: "Reformer Studio", capacity: 6,  usedByOther: false },
            { id: "r2", name: "Mat Studio",       capacity: 20, usedByOther: false },
            { id: "r3", name: "Barre Studio",     capacity: 10, usedByOther: false },
            { id: "r4", name: "Private Suite",    capacity: 15, usedByOther: false },
        ],
    },
    {
        branch: "Forma Studio (East)",
        rooms: [
            { id: "r5", name: "Yoga Studio",  capacity: 10, usedByOther: true  },
            { id: "r6", name: "HIIT Studio",  capacity: 8,  usedByOther: true  },
            { id: "r7", name: "Power Studio", capacity: 15, usedByOther: false },
        ],
    },
];

const REPEAT_OPTIONS = ["Does not repeat", "Repeat weekly"] as const;
const REPEAT_END     = ["No end date", "End on date", "End after"] as const;
const WEEK_DAYS      = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

// ─── Category colors (same as schedule page) ─────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
    Pilates: "#e9fff3", Yoga: "#fff8e9", Barre: "#e0f9f4",
    HIIT: "#fff3f2", Recovery: "#f0f4f8",
};
function coverColor(cat: string) { return CATEGORY_COLORS[cat] ?? "#f0ecff"; }

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepItem({ step, current, total }: { step: typeof STEPS[0]; current: number; total: number }) {
    const active   = step.n === current;
    const complete = step.n < current;
    const isLast   = step.n === total;
    return (
        <div className={cn("flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full", active && "bg-[#f5fffa]")}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active   ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                    : complete ? "bg-[#658774] text-white"
                    : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]")}>
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

const inputCls  = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";
const labelCls  = "text-[14px] font-medium text-[#344054]";
const hintCls   = "text-[14px] text-[#475467]";

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
    return (
        <div className="flex flex-col gap-[2px]">
            <span className={labelCls}>{label}</span>
            {hint && <span className={hintCls}>{hint}</span>}
        </div>
    );
}

function SimpleSelect({ label, value, options, onChange, disabled = false }: {
    label: string; value: string; options: string[]; onChange: (v: string) => void; disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    return (
        <div ref={ref} className="relative">
            <button type="button" disabled={disabled} onClick={() => !disabled && setOpen(p => !p)}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] bg-white",
                    disabled ? "cursor-not-allowed text-[#98a2b3] bg-[#f9fafb]" : "text-[#101828] hover:border-[#7ba08c]",
                    open && "ring-2 ring-[#aad4bd] border-[#7ba08c]")}>
                <span className="flex-1 text-left">{value || label}</span>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 py-1 max-h-[200px] overflow-y-auto">
                    {options.map(o => (
                        <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                            className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium transition-colors text-left",
                                value === o ? "text-[#101828] bg-[#f9fafb] font-semibold" : "text-[#344054] hover:bg-[#f9fafb]")}>
                            {o}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Template dropdown ────────────────────────────────────────────────────────

function TemplateDropdown({ templates, value, onChange, disabled = false }: {
    templates: { id: string; name: string; category: string; description: string; locationType: string; durationMin: number; capacity: number; coverColor: string; coverImage?: string }[];
    value: string;
    onChange: (id: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selected = templates.find(t => t.id === value);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => !disabled && setOpen(p => !p)} disabled={disabled}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 rounded-[8px] text-[16px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                    disabled
                        ? "bg-[#f9fafb] border-[#d0d5dd] cursor-not-allowed text-[#667085]"
                        : cn("bg-white border-[#d0d5dd]", selected ? "text-[#101828]" : "text-[#667085]", open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]"))}>
                <span className="flex-1 text-left truncate">{selected?.name ?? "Select template"}</span>
                <ChevronDown className={cn("w-4 h-4 shrink-0", disabled ? "text-[#98a2b3]" : "text-[#667085]")} />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] z-50 p-[8px] max-h-[420px] overflow-y-auto">
                    {templates.map(t => (
                        <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); }}
                            className={cn("flex items-center gap-[16px] w-full pl-[8px] pr-[10px] py-[10px] text-left rounded-[12px] transition-colors",
                                value === t.id ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                            {/* Thumbnail */}
                            <div className="w-[82px] h-[82px] shrink-0 rounded-[10px] border-1 border-[#e4e7ec] overflow-hidden flex items-center justify-center"
                                style={{ backgroundColor: t.coverColor }}>
                                {t.coverImage
                                    ? <img src={t.coverImage} alt={t.name} className="w-full h-full object-cover" />
                                    : <span className="text-[18px] font-bold text-[#344054]">{t.name.split(" ").map(w => w[0]).join("").slice(0, 2)}</span>
                                }
                            </div>
                            {/* Info */}
                            <div className="flex-1 min-w-0 flex flex-col gap-[8px]">
                                <div className="flex flex-col gap-[2px]">
                                    <p className="text-[14px] font-medium text-[#344054] truncate">{t.name}</p>
                                    <p className="text-[12px] text-[#475467] line-clamp-2 leading-[18px]">{t.description}</p>
                                </div>
                                <div className="flex items-center gap-[12px]">
                                    <span className="flex items-center gap-[4px] text-[12px] text-[#667085]">
                                        <Grid01 className="w-4 h-4 shrink-0" />{t.category}
                                    </span>
                                    <span className="flex items-center gap-[4px] text-[12px] text-[#667085]">
                                        <MarkerPin01 className="w-4 h-4 shrink-0" />{t.locationType}
                                    </span>
                                    <span className="flex items-center gap-[4px] text-[12px] text-[#667085]">
                                        <ClockFastForward className="w-4 h-4 shrink-0" />{t.durationMin} min
                                    </span>
                                    <span className="flex items-center gap-[4px] text-[12px] text-[#667085]">
                                        <Users01 className="w-4 h-4 shrink-0" />{t.capacity} max
                                    </span>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Location dropdown (grouped, with capacity + status) ──────────────────────

function LocationDropdown({ classCapacity, value, onChange }: {
    classCapacity: number;
    value: string;
    onChange: (id: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const selectedRoom = BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.id === value);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                    selectedRoom ? "text-[#101828]" : "text-[#667085]",
                    open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]")}>
                <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                <span className="flex-1 text-left text-[16px]">
                    {selectedRoom ? (
                        <span className="flex items-center gap-2">
                            {selectedRoom.name}
                            <span className="text-[13px] text-[#667085]">({selectedRoom.capacity} max)</span>
                            {selectedRoom.capacity < classCapacity && (
                                <span className="text-[12px] font-medium text-[#dc6803] bg-[#fffaeb] border-1 border-[#fedf89] rounded-full px-3 py-[2px]">Over capacity</span>
                            )}
                        </span>
                    ) : "Select location"}
                </span>
                <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 overflow-hidden max-h-[360px] overflow-y-auto">
                    {BRANCH_ROOMS.map((group, gi) => (
                        <div key={group.branch} className={gi > 0 ? "border-t border-[#e4e7ec]" : ""}>
                            {/* Branch header — no bg, dark add room */}
                            <div className="flex items-center justify-between px-4 py-3">
                                <div className="flex items-center gap-2">
                                    <Building01 className="w-4 h-4 text-[#667085]" />
                                    <span className="text-[14px] font-semibold text-[#101828]">{group.branch}</span>
                                </div>
                                <button type="button" className="flex items-center gap-1 text-[13px] font-semibold text-[#344054] hover:text-[#101828] transition-colors">
                                    <Plus className="w-3.5 h-3.5" />Add room
                                </button>
                            </div>
                            {/* Rooms */}
                            {group.rooms.map(room => {
                                const isOverCap = room.capacity < classCapacity;
                                const isUsed    = room.usedByOther;
                                return (
                                    <button key={room.id} type="button"
                                        onClick={() => { if (!isUsed) { onChange(room.id); setOpen(false); } }}
                                        className={cn("flex items-center justify-between w-full pl-10 pr-4 py-3 text-[14px] transition-colors",
                                            isUsed ? "cursor-not-allowed" : "hover:bg-[#f9fafb]",
                                            value === room.id && "bg-[#f0fff8]")}>
                                        <span className={cn("font-semibold", isUsed ? "text-[#98a2b3]" : "text-[#101828]")}>
                                            {room.name}
                                            <span className={cn("ml-1.5 font-normal", isUsed ? "text-[#c8cdd5]" : "text-[#98a2b3]")}>({room.capacity} max)</span>
                                        </span>
                                        {isUsed && (
                                            <span className="text-[12px] font-medium text-[#667085] bg-[#f2f4f7] rounded-full px-3 py-[2px]">Used by other class</span>
                                        )}
                                        {!isUsed && isOverCap && (
                                            <span className="text-[12px] font-medium text-[#dc6803] bg-[#fffaeb] border-1 border-[#fedf89] rounded-full px-3 py-[2px]">Over capacity</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Instructor card ──────────────────────────────────────────────────────────

const INSTRUCTOR_RATINGS: Record<string, { score: number; reviews: string }> = {
    i1: { score: 4.8, reviews: "2K reviews" },
    i2: { score: 4.8, reviews: "3K reviews" },
    i3: { score: 5.0, reviews: "6K reviews" },
    i4: { score: 4.7, reviews: "1K reviews" },
};

function InstructorCard({ instructor, selected, onClick }: {
    instructor: typeof SCHEDULE_INSTRUCTORS[0]; selected: boolean; onClick: () => void;
}) {
    const rating = INSTRUCTOR_RATINGS[instructor.id] ?? { score: 4.5, reviews: "1K reviews" };
    return (
        <button type="button" onClick={onClick}
            className={cn("flex flex-col items-center w-[150px] shrink-0 rounded-[12px] border overflow-hidden transition-all",
                selected ? "border-[#658774]" : "border-[#e4e7ec] hover:border-[#aad4bd]")}>
            {/* Avatar area */}
            <div className="relative w-full flex justify-center pt-5 px-4">
                <div className="w-[80px] h-[80px] rounded-full flex items-center justify-center text-white text-[28px] font-semibold"
                    style={{ backgroundColor: instructor.color }}>
                    {instructor.initials}
                </div>
                {/* Radio */}
                <div className={cn("absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                    selected ? "border-[#658774] bg-[#658774]" : "border-[#d0d5dd] bg-white")}>
                    {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
            </div>
            {/* Info */}
            <div className="w-full p-4 pt-3 flex flex-col gap-1">
                <p className="text-[14px] font-medium text-[#101828] truncate">{instructor.name}</p>
                <div className="flex items-center gap-1">
                    <Star01 className="w-3.5 h-3.5 text-[#f79009]" />
                    <span className="text-[12px] text-[#667085]">{rating.score} ({rating.reviews})</span>
                </div>
            </div>
        </button>
    );
}

// ─── Time slot row (step 3 repeat) ───────────────────────────────────────────

const DAY_FULL: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

interface TimeSlot { start: string; end: string; }

function TimeSlotRow({ day, slots, unavailable, onChange, onAddSlot, onDeleteSlot }: {
    day: string;
    slots: TimeSlot[];
    unavailable?: string[];
    onChange: (i: number, field: "start" | "end", v: string) => void;
    onAddSlot: () => void;
    onDeleteSlot: (i: number) => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3">
            <div className="flex flex-col">
                <p className="text-[14px] font-medium text-[#101828]">{DAY_FULL[day] ?? day}</p>
                <p className="text-[14px] text-[#667085]">Set schedule for this day.</p>
            </div>
            <div className="flex flex-col gap-3">
                {slots.map((slot, i) => (
                    <div key={i} className="flex items-end gap-4">
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-[14px] font-medium text-[#344054]">Start time</label>
                            <TimeDropdown value={slot.start} onChange={v => onChange(i, "start", v)} unavailable={unavailable} placeholder="Select time" />
                        </div>
                        <div className="flex flex-col gap-1.5 flex-1">
                            <label className="text-[14px] font-medium text-[#344054]">End time</label>
                            <div className="flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                <ClockFastForward className="w-5 h-5 text-[#98a2b3] shrink-0" />
                                <span className="flex-1 text-[16px] text-[#667085]">{slot.end ? fmtTime(slot.end) : "Select time"}</span>
                            </div>
                        </div>
                        <button type="button" onClick={() => onDeleteSlot(i)} disabled={i === 0}
                            className={cn(
                                "w-11 h-11 flex items-center justify-center rounded-[8px] border-1 bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] shrink-0 transition-colors",
                                i === 0
                                    ? "border-[#e4e7ec] text-[#fecdca] cursor-not-allowed"
                                    : "border-[#e4e7ec] text-[#d92d20] hover:bg-[#fef3f2] hover:border-[#fda29b]"
                            )}>
                            <Trash01 className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={onAddSlot}
                className="self-start flex items-center gap-1 px-3 py-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054] hover:bg-[#f9fafb] transition-colors">
                <Plus className="w-5 h-5" />
                <span className="px-0.5">Add time slot</span>
            </button>
        </div>
    );
}

// ─── Preview card ─────────────────────────────────────────────────────────────

function PreviewCard({ form, instructor, location, templateCapacity, roomCapacity, original }: {
    form: { name: string; description: string; category: string; classType: string; gender: string; durationMin: number; capacity: number; coverColor: string; coverImage?: string; };
    instructor?: typeof SCHEDULE_INSTRUCTORS[0];
    location?: { name: string } | null;
    templateCapacity?: number;
    roomCapacity?: number;
    /** Original values for fields that can change while editing. When a field's current value
     *  differs from the original, the preview card renders an `original → current` indicator. */
    original?: { location?: string; capacity?: number; instructorName?: string; instructorColor?: string };
}) {
    const hasTemplate = !!form.name;
    const displayName = form.name || "Class template name";
    const displayDesc = form.description || "This is the default description of the class template.";

    const locationChanged = !!original?.location && !!location && original.location !== location.name;
    const capacityChanged = original?.capacity !== undefined && original.capacity !== form.capacity;
    const instructorChanged = !!original?.instructorName && !!instructor && original.instructorName !== instructor.name;

    return (
        <div className="w-[352px] shrink-0 bg-white border-1 border-[#e4e7ec] rounded-[20px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
                <p className="text-[18px] font-semibold text-[#101828]">Class preview</p>
                <p className="text-[14px] text-[#6e776f] mt-1">This is how your class schedule will look like.</p>
            </div>
            {/* Preview content */}
            <div className="bg-[#f6f6f3] flex-1 p-6">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-5">
                    {/* Cover image */}
                    <div className="w-[100px] h-[100px] rounded-[14px] overflow-hidden mb-4 flex items-center justify-center"
                        style={{ backgroundColor: form.coverColor || "#f2f4f7" }}>
                        {form.coverImage ? (
                            <img src={form.coverImage} alt={displayName} className="w-full h-full object-cover" />
                        ) : hasTemplate ? (
                            <span className="text-[28px] font-bold text-[#344054]">
                                {displayName.split(" ").map(w => w[0]).join("").slice(0, 2)}
                            </span>
                        ) : null}
                    </div>

                    {/* Class name + description */}
                    <p className="text-[18px] font-medium text-[#101828] mb-1">{displayName}</p>
                    <p className="text-[14px] text-[#667085] mb-4 line-clamp-2">{displayDesc}</p>

                    {/* Info rows */}
                    <div className="flex flex-col gap-3">
                        <PreviewRow icon={<Calendar className="w-4 h-4 text-[#667085]" />} label="Date & time" empty={!form.name} />

                        {/* Location — with change indicator when editing */}
                        {locationChanged && location ? (
                            <div className="flex items-center gap-2">
                                <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="text-[14px] text-[#667085] line-through">{original!.location}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-[#658774] shrink-0" />
                                <span className="text-[14px] font-semibold text-[#3b5446]">{location.name}</span>
                            </div>
                        ) : (
                            <PreviewRow icon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />} label={location?.name ?? "Location"} empty={!location} />
                        )}

                        <PreviewRow icon={<ClockFastForward className="w-4 h-4 text-[#667085]" />}
                            label={form.durationMin ? `${form.durationMin} min` : "Duration"} empty={!form.durationMin} />

                        {/* Capacity — over-capacity warning OR edit change indicator OR plain row */}
                        {templateCapacity !== undefined && roomCapacity !== undefined && roomCapacity < templateCapacity ? (
                            <div className="flex items-center gap-2">
                                <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="text-[14px] text-[#667085]">{templateCapacity}/{templateCapacity}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-[#dc6803] shrink-0" />
                                <span className="text-[14px] font-semibold text-[#dc6803]">{roomCapacity}/{roomCapacity}</span>
                            </div>
                        ) : capacityChanged && form.capacity ? (
                            <div className="flex items-center gap-2">
                                <Users01 className="w-4 h-4 text-[#667085] shrink-0" />
                                <span className="text-[14px] text-[#667085] line-through">{original!.capacity}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-[#658774] shrink-0" />
                                <span className="text-[14px] font-semibold text-[#3b5446]">{form.capacity}</span>
                            </div>
                        ) : (
                            <PreviewRow icon={<Users01 className="w-4 h-4 text-[#667085]" />}
                                label={form.capacity ? `${form.capacity}` : "Capacity"} empty={!form.capacity} />
                        )}

                        <PreviewRow icon={<span className="w-4 h-4 text-[#667085] text-[13px]">⚧</span>}
                            label={form.gender || "Gender access"} empty={!form.gender} />

                        {/* Instructor — with change indicator when editing */}
                        {instructorChanged && instructor ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="w-4 h-4 rounded-full bg-[#e0e0e0] shrink-0" />
                                <span className="text-[14px] text-[#667085] line-through">{original!.instructorName}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-[#658774] shrink-0" />
                                <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: instructor.color }} />
                                <span className="text-[14px] font-semibold text-[#3b5446]">{instructor.name}</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                {instructor ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: instructor.color }} />
                                        <span className="text-[14px] text-[#667085]">{instructor.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-4 h-4 rounded-full bg-[#e0e0e0] shrink-0" />
                                        <span className="text-[14px] text-[#98a2b3]">Instructor</span>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreviewRow({ icon, label, empty }: { icon: React.ReactNode; label: string; empty: boolean }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <span className={cn("text-[14px]", empty ? "text-[#98a2b3]" : "text-[#667085]")}>{label}</span>
        </div>
    );
}

// ─── Time dropdown (15-min slots) ─────────────────────────────────────────────

const TIME_SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
        if (h === 22 && m > 0) break;
        TIME_SLOTS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
    }
}

function fmtTime(t: string): string {
    const [h,m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const h12 = h === 0 ? 12 : h > 12 ? h-12 : h;
    return `${String(h12).padStart(2,"0")}:${String(m).padStart(2,"0")} ${ap}`;
}

/** "09:00 - 10:00 AM" when start and end share AM/PM; falls back to full "09:00 AM - 12:30 PM" across periods. */
function fmtSlotRange(start: string, end: string): string {
    if (!start || !end) return "";
    const sh = Number(start.split(":")[0]);
    const eh = Number(end.split(":")[0]);
    const sap = sh >= 12 ? "PM" : "AM";
    const eap = eh >= 12 ? "PM" : "AM";
    if (sap === eap) {
        const startNoSuffix = fmtTime(start).replace(/ (AM|PM)$/, "");
        return `${startNoSuffix} - ${fmtTime(end)}`;
    }
    return `${fmtTime(start)} - ${fmtTime(end)}`;
}

function calcEndTime(start: string, durationMins: number): string {
    if (!start) return "";
    const [h,m] = start.split(":").map(Number);
    const total = h*60 + m + durationMins;
    const eh = Math.floor(total/60) % 24;
    const em = total % 60;
    return `${String(eh).padStart(2,"0")}:${String(em).padStart(2,"0")}`;
}

function calcMinutes(start: string, end: string): number {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return (eh * 60 + em) - (sh * 60 + sm);
}

function TimeDropdown({ value, onChange, unavailable = [], placeholder = "Select time", minAfter }: {
    value: string; onChange: (t: string) => void;
    unavailable?: string[]; placeholder?: string;
    minAfter?: string; // disables slots <= this value (use for end time)
}) {
    const [open, setOpen] = useState(false);
    const ref  = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    useEffect(() => {
        if (open && value && listRef.current) {
            const el = listRef.current.querySelector('[data-sel="true"]');
            if (el) el.scrollIntoView({ block: "center" });
        }
    }, [open, value]);

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className={cn("flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_0px_rgba(16,24,40,0.18),inset_0px_-1px_0px_0px_rgba(16,24,40,0.05)] transition-all",
                    value ? "text-[#101828]" : "text-[#667085]",
                    open ? "ring-2 ring-[#aad4bd] border-[#7ba08c]" : "hover:border-[#7ba08c]")}>
                <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                <span className="flex-1 text-left">{value ? fmtTime(value) : placeholder}</span>
                {open ? <ChevronUp className="w-4 h-4 text-[#667085] shrink-0" /> : <ChevronDown className="w-4 h-4 text-[#667085] shrink-0" />}
            </button>
            {open && (
                <div ref={listRef} className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] z-50 max-h-[220px] overflow-y-auto py-1">
                    {TIME_SLOTS.map(slot => {
                        const isUnavail = unavailable.includes(slot) || (minAfter !== undefined && minAfter !== "" && slot <= minAfter);
                        const isSel = value === slot;
                        return (
                            <button key={slot} type="button" data-sel={isSel}
                                disabled={isUnavail}
                                onClick={() => { if (!isUnavail) { onChange(slot); setOpen(false); } }}
                                className={cn("flex items-center justify-between w-full px-4 py-3 text-left transition-colors",
                                    isUnavail ? "cursor-not-allowed" : "hover:bg-[#f9fafb]",
                                    isSel && "bg-[#f0fff8]")}>
                                <span className={cn("text-[16px]", isUnavail ? "text-[#98a2b3]" : isSel ? "font-semibold text-[#101828]" : "text-[#344054]")}>
                                    {fmtTime(slot)}
                                </span>
                                {isUnavail && (
                                    <span className="text-[12px] font-medium text-[#667085] bg-[#f2f4f7] rounded-full px-3 py-[2px]">Unavailable</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Customize spot helpers (inline overlay) ──────────────────────────────────

function csRowLabel(i: number): string { return String.fromCharCode(65+i); }

function CsSpotCircle({ id, blocked, active, customized, onClick, onMouseEnter, onMouseLeave, tooltip }: {
    id: string; blocked: boolean; active: boolean; customized: boolean;
    onClick: () => void; onMouseEnter: () => void; onMouseLeave: () => void; tooltip: boolean;
}) {
    return (
        <div className="flex flex-col items-center gap-2 relative">
            {tooltip && customized && !active && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap bg-[#101828] text-white text-[12px] font-medium px-3 py-1.5 rounded-[6px] shadow-lg pointer-events-none">
                    {blocked ? "Select spot to unblock" : "Select spot to block"}
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] border-l-[5px] border-r-[5px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#101828]" />
                </div>
            )}
            <button type="button" disabled={!customized} onClick={onClick} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}
                className={cn("w-16 h-16 rounded-full transition-all",
                    !customized && "cursor-default",
                    blocked ? "bg-[#fecdca] border-2 border-[#f04438]"
                    : active ? "bg-[#c4edd6] border-2 border-[#658774] scale-105"
                    : customized ? "bg-[#c4edd6] hover:brightness-95 hover:scale-105 cursor-pointer border-2 border-transparent"
                    : "bg-[#c4edd6] border-2 border-transparent")} />
            <span className="text-[16px] font-semibold text-[#475467]">{id}</span>
        </div>
    );
}

function CsNumberStepper({ label, value, onChange, min=1, max=12, disabled=false }: {
    label: string; value: number; onChange: (v: number) => void;
    min?: number; max?: number; disabled?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            <div className={cn("flex items-center border-1 border-[#d0d5dd] rounded-[8px] overflow-hidden",
                disabled ? "bg-[#f9fafb]" : "bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]")}>
                <input type="number" value={value} min={min} max={max} disabled={disabled}
                    onChange={e => { const v = Number(e.target.value); if (v >= min && v <= max) onChange(v); }}
                    className={cn("flex-1 px-[14px] py-[10px] text-[16px] border-0 focus:outline-none",
                        disabled ? "bg-[#f9fafb] text-[#667085] cursor-not-allowed" : "text-[#101828]")} />
                <div className="flex flex-col border-l border-[#e4e7ec]">
                    <button type="button" disabled={disabled || value >= max} onClick={() => value < max && onChange(value+1)}
                        className="flex items-center justify-center h-[20px] w-8 hover:bg-[#f9fafb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronUp className="w-3 h-3 text-[#667085]" />
                    </button>
                    <button type="button" disabled={disabled || value <= min} onClick={() => value > min && onChange(value-1)}
                        className="flex items-center justify-center h-[20px] w-8 border-t border-[#e4e7ec] hover:bg-[#f9fafb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        <ChevronDown className="w-3 h-3 text-[#667085]" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function CsBlockBar({ spotId, blocked, onBlock, onUnblock, onDismiss }: {
    spotId: string; blocked: boolean; onBlock: () => void; onUnblock: () => void; onDismiss: () => void;
}) {
    return (
        <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-8 z-20">
            <div className="pointer-events-auto bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_8px_16px_-4px_rgba(16,24,40,0.12)] px-5 py-3 flex items-center gap-4">
                <span className="text-[14px] font-medium text-[#344054]">
                    {blocked ? `Unblock spot ${spotId}?` : `Block spot ${spotId}?`}
                </span>
                <button type="button" onClick={onDismiss}
                    className="text-[14px] font-semibold text-[#667085] hover:text-[#344054] transition-colors">Dismiss</button>
                {blocked ? (
                    <button type="button" onClick={onUnblock}
                        className="px-4 py-2 rounded-[8px] bg-[#658774] text-white text-[14px] font-semibold hover:bg-[#3b5446] transition-colors">Unblock</button>
                ) : (
                    <button type="button" onClick={onBlock}
                        className="px-4 py-2 rounded-[8px] bg-[#d92d20] text-white text-[14px] font-semibold hover:bg-[#b42318] transition-colors">Block</button>
                )}
            </div>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ScheduleFormPage({ editingId }: { editingId?: string } = {}) {
    const router  = useRouter();
    const searchParams = useSearchParams();
    const { classTemplates, classInstances, addClassInstances, updateClassInstance, showToast } = useAppStore();

    const isEditing = !!editingId;
    const editing = editingId ? classInstances.find(c => c.id === editingId) : undefined;
    // When ?duplicateFrom={id} is set, we pre-fill the new-class form from that source class.
    const duplicateFromId = !isEditing ? searchParams.get("duplicateFrom") : null;
    const duplicateSource = duplicateFromId ? classInstances.find(c => c.id === duplicateFromId) : undefined;
    const isDuplicating = !!duplicateSource;
    // Treat editing AND duplicating as "we have a source class" for pre-fill purposes; only `isEditing` gates the 2-step / disabled-template behaviour.
    const sourceClass: ClassInstance | undefined = editing ?? duplicateSource;
    // When editing, derive the original room id from the room name stored on the instance.
    const editingRoomId = sourceClass ? BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.name === sourceClass.room)?.id ?? "" : "";

    // Form state — pre-filled when editing OR duplicating.
    const [step, setStep] = useState(1);
    const [templateId, setTemplateId]   = useState(sourceClass?.templateId ?? "");
    const [name,       setName]         = useState(sourceClass?.name ?? "");
    const [desc,       setDesc]         = useState(sourceClass?.description ?? "");
    const [classType,  setClassType]    = useState("Group");
    const [category,   setCategory]     = useState(sourceClass?.category ?? "");
    const [gender,     setGender]       = useState("All genders");
    const [duration,   setDuration]     = useState(sourceClass ? Math.max(0, calcMinutes(sourceClass.startTime, sourceClass.endTime)) : 60);
    const [capacity,   setCapacity]     = useState(sourceClass?.capacity ?? 15);
    // templateCapacity tracks the original capacity from the selected template — never changes on room selection
    const [templateCapacity, setTemplateCapacity] = useState(sourceClass?.capacity ?? 15);
    const [coverImage, setCoverImage]   = useState(sourceClass?.coverImage ?? "");
    const [coverCol,   setCoverCol]     = useState(sourceClass?.coverColor ?? "#f2f4f7");

    // Step 2
    const [locationId,    setLocationId]    = useState(editingRoomId);
    const [equipment,     setEquipment]     = useState(sourceClass?.equipment ?? "");
    const [spotEnabled,   setSpotEnabled]   = useState(sourceClass?.spotSelectionEnabled ?? false);
    const [instructorId,  setInstructorId]  = useState(sourceClass?.instructorId ?? "");
    const [instrSearch,   setInstrSearch]   = useState("");

    // Step 3
    const [repeat,    setRepeat]    = useState<typeof REPEAT_OPTIONS[number]>("Does not repeat");
    const [repeatEvery, setRepeatEvery] = useState(1);
    const [repeatEnd, setRepeatEnd] = useState<typeof REPEAT_END[number]>("No end date");
    const [endDate,   setEndDate]   = useState("");
    const [endAfter,  setEndAfter]  = useState(8);
    const [selectedDate, setSelectedDate] = useState("");
    const [startTime, setStartTime] = useState("");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [daySlots, setDaySlots]   = useState<Record<string, TimeSlot[]>>({});

    // Customize spot (inline overlay)
    const [showCustomizeSpot, setShowCustomizeSpot] = useState(false);
    const [csCustomized,  setCsCustomized]  = useState(false);
    const [csCols,        setCsCols]        = useState(4);
    const [csRows,        setCsRows]        = useState(2);
    const [csPendingCols, setCsPendingCols] = useState(4);
    const [csPendingRows, setCsPendingRows] = useState(2);
    const [csBlocked,     setCsBlocked]     = useState<Set<string>>(new Set());
    const [csHovered,     setCsHovered]     = useState<string | null>(null);
    const [csSelected,    setCsSelected]    = useState<string | null>(null);

    const activeTemplates = classTemplates.filter(t => t.status === "Active");

    // Unavailable time slots for selected instructor on selected date
    const unavailableTimes = useMemo((): string[] => {
        if (!instructorId || !selectedDate) return [];
        const blocked: string[] = [];
        classInstances.forEach(inst => {
            if (inst.instructorId !== instructorId || inst.dateISO !== selectedDate) return;
            const [sh, sm] = inst.startTime.split(":").map(Number);
            const [eh, em] = inst.endTime.split(":").map(Number);
            for (let mins = sh*60+sm; mins < eh*60+em; mins += 15) {
                blocked.push(`${String(Math.floor(mins/60)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}`);
            }
        });
        return blocked;
    }, [instructorId, selectedDate, classInstances]);

    // When template is selected — populate fields
    function handleSelectTemplate(id: string) {
        setTemplateId(id);
        const t = classTemplates.find(x => x.id === id);
        if (!t) return;
        setName(t.name);
        setDesc(t.description);
        setClassType(t.locationType ?? "Group");
        setCategory(t.category);
        setDuration(t.durationMin);
        setCapacity(t.capacity);
        setTemplateCapacity(t.capacity);
        setCoverImage(t.coverImage ?? "");
        setCoverCol(t.coverColor);
    }

    const selectedRoom = BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.id === locationId);

    function handleSelectRoom(roomId: string) {
        setLocationId(roomId);
        const room = BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.id === roomId);
        if (!room) return;
        const cap = room.capacity;
        const dc = (() => { for (const c of [4,3,5,2,6]) { if (cap%c===0 && cap/c<=8) return c; } return Math.min(cap,4); })();
        const dr = Math.ceil(cap/dc);
        setCsCols(dc); setCsRows(dr); setCsPendingCols(dc); setCsPendingRows(dr);
        setCsBlocked(new Set()); setCsCustomized(false); setCsSelected(null);
    }
    const selectedInstructor = SCHEDULE_INSTRUCTORS.find(i => i.id === instructorId);
    const filteredInstructors = instrSearch
        ? SCHEDULE_INSTRUCTORS.filter(i => i.name.toLowerCase().includes(instrSearch.toLowerCase()))
        : SCHEDULE_INSTRUCTORS;

    // Derived end time from start + duration
    const endTime = calcEndTime(startTime, duration);

    // When the user picks a start date in Repeat weekly mode, auto-select that
    // weekday in "Select days" so the recurring series always includes the
    // anchor date (e.g. picking Fri 15 May 2026 ticks "Fri" if it isn't already).
    useEffect(() => {
        if (repeat !== "Repeat weekly" || !selectedDate) return;
        const dow = new Date(selectedDate).getDay();
        const dayMap = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const dayLabel = dayMap[dow];
        setSelectedDays(prev => {
            if (prev.includes(dayLabel)) return prev;
            const start = "09:00";
            setDaySlots(ds => ({ ...ds, [dayLabel]: ds[dayLabel] ?? [{ start, end: calcEndTime(start, duration) }] }));
            return [...prev, dayLabel];
        });
    }, [selectedDate, repeat, duration]);

    // "No end date" pins the recurrence to a single week, so "Repeat every" is
    // meaningless — force it to 1 so downstream logic (preview, handleCreate) is consistent.
    useEffect(() => {
        if (repeatEnd === "No end date" && repeatEvery !== 1) setRepeatEvery(1);
    }, [repeatEnd, repeatEvery]);

    // Day slot helpers — end time is always derived from start + duration
    function toggleDay(day: string) {
        setSelectedDays(prev => {
            const next = prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day];
            if (!prev.includes(day)) {
                const start = "09:00";
                setDaySlots(ds => ({ ...ds, [day]: ds[day] ?? [{ start, end: calcEndTime(start, duration) }] }));
            }
            return next;
        });
    }
    function updateSlot(day: string, i: number, field: "start" | "end", val: string) {
        setDaySlots(ds => ({
            ...ds,
            [day]: ds[day].map((s, idx) => {
                if (idx !== i) return s;
                if (field === "start") return { start: val, end: calcEndTime(val, duration) };
                return { ...s, [field]: val };
            }),
        }));
    }
    function addSlot(day: string) {
        const start = "09:00";
        setDaySlots(ds => ({ ...ds, [day]: [...(ds[day] ?? []), { start, end: calcEndTime(start, duration) }] }));
    }
    function deleteSlot(day: string, i: number) {
        setDaySlots(ds => ({ ...ds, [day]: ds[day].filter((_, idx) => idx !== i) }));
    }

    // Generate preview of recurring classes
    type PreviewItem = { date: Date; startTime: string; endTime: string };
    function generatePreview(): PreviewItem[] {
        if (repeat === "Does not repeat" || !selectedDays.length) return [];
        const out: PreviewItem[] = [];
        const hardCap = repeatEnd === "End after" ? Math.max(1, endAfter) : 365;
        // Anchor on the selected start date if provided; otherwise tomorrow
        const base = selectedDate ? new Date(selectedDate) : (() => { const t = new Date(); t.setDate(t.getDate()+1); return t; })();
        base.setHours(0,0,0,0);
        const dayMap: Record<string, number> = { Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:0 };
        let count = 0;
        // Effective date cap:
        //  - "End on date"  → user-picked end
        //  - "No end date"  → end of the calendar week containing `base` (Sun, end-of-day)
        //  - "End after"    → no date cap; the count cap (hardCap) does the work
        let limit: Date | null = null;
        if (repeatEnd === "End on date" && endDate) {
            limit = new Date(endDate);
        } else if (repeatEnd === "No end date") {
            limit = new Date(base);
            const daysUntilSunday = (7 - base.getDay()) % 7;
            limit.setDate(base.getDate() + daysUntilSunday);
        }
        if (limit) limit.setHours(23,59,59,999);
        const step = Math.max(1, repeatEvery);
        for (let week = 0; week < 260 && count < hardCap; week += step) {
            for (const day of WEEK_DAYS) {
                if (!selectedDays.includes(day)) continue;
                const d = new Date(base);
                const diff = ((dayMap[day] - base.getDay() + 7) % 7) + week * 7;
                d.setDate(base.getDate() + diff);
                if (limit && d > limit) continue;
                if (d < base) continue;
                const slots = daySlots[day] ?? [{ start: "09:00", end: calcEndTime("09:00", duration) }];
                for (const s of slots) {
                    if (count >= hardCap) break;
                    out.push({ date: new Date(d), startTime: s.start, endTime: s.end });
                    count++;
                }
            }
            if (limit) {
                const nextBase = new Date(base);
                nextBase.setDate(base.getDate() + (week + step) * 7);
                if (nextBase > limit) break;
            }
        }
        return out;
    }

    // Memoised preview + grouped-by-month structure for the calendar card
    const previewItems = useMemo(generatePreview, [repeat, repeatEvery, repeatEnd, endDate, endAfter, selectedDate, selectedDays, daySlots, duration]);
    const previewGrouped = useMemo(() => {
        const MONTHS_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];
        const months = new Map<string, { label: string; days: Map<number, string[]> }>();
        for (const item of previewItems) {
            const key = `${item.date.getFullYear()}-${item.date.getMonth()}`;
            if (!months.has(key)) {
                months.set(key, { label: `${MONTHS_LONG[item.date.getMonth()]} ${item.date.getFullYear()}`, days: new Map() });
            }
            const m = months.get(key)!;
            const day = item.date.getDate();
            if (!m.days.has(day)) m.days.set(day, []);
            m.days.get(day)!.push(fmtSlotRange(item.startTime, item.endTime));
        }
        return Array.from(months.values()).map(m => ({
            label: m.label,
            days: Array.from(m.days.entries()).map(([day, times]) => ({ day, times })).sort((a, b) => a.day - b.day),
        }));
    }, [previewItems]);

    const [previewOpen, setPreviewOpen] = useState(true);

    // Create class instances
    function handleCreate() {
        const instances: Omit<ClassInstance, "id">[] = [];
        const instName     = SCHEDULE_INSTRUCTORS.find(i => i.id === instructorId);
        const room         = BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.id === locationId);
        const now          = new Date().toISOString();

        if (repeat === "Does not repeat" && selectedDate) {
            const d = new Date(selectedDate);
            const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            instances.push({
                templateId, name, description: desc, category,
                instructorId, instructorName: instName?.name ?? "",
                instructorInitials: instName?.initials ?? "", instructorColor: instName?.color ?? "#667085",
                location: "FitLab South", room: room?.name ?? "",
                date: `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`,
                dateISO: selectedDate, dayOfWeek: days[d.getDay()],
                startTime, endTime,
                displayTime: `${startTime} – ${endTime}`,
                booked: 0, capacity,
                equipment, spotSelectionEnabled: spotEnabled, waitlistEnabled: true,
                rating: 0, ratingCount: 0, status: "Upcoming",
                coverColor: coverCol, coverImage: coverImage || undefined,
            });
        } else {
            const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
            const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            for (const p of previewItems) {
                const d = p.date;
                const dayStr = dayNames[d.getDay()];
                const dateLabel = `${dayStr}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                instances.push({
                    templateId, name, description: desc, category,
                    instructorId, instructorName: instName?.name ?? "",
                    instructorInitials: instName?.initials ?? "", instructorColor: instName?.color ?? "#667085",
                    location: "FitLab South", room: room?.name ?? "",
                    date: dateLabel, dateISO,
                    dayOfWeek: dayStr,
                    startTime: p.startTime, endTime: p.endTime,
                    displayTime: `${p.startTime} – ${p.endTime}`,
                    booked: 0, capacity,
                    equipment, spotSelectionEnabled: spotEnabled, waitlistEnabled: true,
                    rating: 0, ratingCount: 0, status: "Upcoming",
                    coverColor: coverCol, coverImage: coverImage || undefined,
                });
            }
        }

        addClassInstances(instances);
        if (isDuplicating) {
            showToast(
                instances.length === 1 ? "Class duplicated successfully" : `${instances.length} classes duplicated successfully`,
                instances.length === 1
                    ? `A copy of ${duplicateSource?.name ?? "the class"} has been added to your schedule.`
                    : "All recurring classes from the duplicate have been added.",
                "success", "check"
            );
        } else {
            showToast(
                instances.length === 1 ? "Class created successfully" : `${instances.length} classes created successfully`,
                instances.length === 1 ? "The class has been added to your schedule." : "All recurring classes have been added.",
                "success", "check"
            );
        }
        router.push("/admin/schedule");
    }

    function handleSaveEdit() {
        if (!editingId || !editing) return;
        const instName = SCHEDULE_INSTRUCTORS.find(i => i.id === instructorId);
        const room = BRANCH_ROOMS.flatMap(b => b.rooms).find(r => r.id === locationId);
        updateClassInstance(editingId, {
            templateId, name, description: desc, category,
            instructorId,
            instructorName: instName?.name ?? editing.instructorName,
            instructorInitials: instName?.initials ?? editing.instructorInitials,
            instructorColor: instName?.color ?? editing.instructorColor,
            room: room?.name ?? editing.room,
            capacity,
            equipment, spotSelectionEnabled: spotEnabled,
            coverColor: coverCol,
            coverImage: coverImage || undefined,
        });
        showToast("Class updated", `${name} has been updated.`, "success", "check");
        router.push(`/schedule/${editingId}`);
    }

    const canProceedStep1 = !!templateId;
    const canProceedStep2 = !!locationId && !!instructorId;
    const canCreate = (() => {
        if (repeat === "Does not repeat") return !!selectedDate && !!startTime;
        if (!selectedDate || !selectedDays.length) return false;
        if (repeatEnd === "End on date" && !endDate) return false;
        if (repeatEnd === "End after" && (!endAfter || endAfter < 1)) return false;
        // Every selected day must have at least one slot with a start time
        for (const d of selectedDays) {
            const slots = daySlots[d] ?? [];
            if (!slots.length || slots.some(s => !s.start)) return false;
        }
        return true;
    })();

    const formContent = {
        name, description: desc, category, classType, gender,
        durationMin: duration, capacity, coverColor: coverCol, coverImage,
    };

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white relative">
            {/* Header */}
            <div className="shrink-0 h-[72px] flex items-center px-6">
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => router.push("/admin/schedule")}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <p className="text-[20px] font-semibold text-[#101828]">{isEditing ? "Edit class" : isDuplicating ? "Duplicate class" : "Add schedule"}</p>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden gap-8 px-6 py-6">
                {/* Steps sidebar */}
                <div className="w-[260px] shrink-0 flex flex-col gap-0 pt-2">
                    {(() => {
                        const items = isEditing ? EDIT_STEPS : STEPS;
                        return items.map(s => <StepItem key={s.n} step={s} current={step} total={items.length} />);
                    })()}
                </div>

                {/* Form card */}
                <div className="flex-1 bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">

                        {/* ── Step 1: Class details ── */}
                        {step === 1 && (
                            <>
                                {/* Edit-only: Date & time read-only summary above the template selector */}
                                {isEditing && editing && (
                                    <div className="flex flex-col gap-4">
                                        <p className="text-[18px] font-semibold text-[#101828]">Date &amp; time</p>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Date</label>
                                                <div className="flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                                    <Calendar className="w-5 h-5 text-[#98a2b3] shrink-0" />
                                                    <span className="flex-1 text-[16px] text-[#667085]">{editing.date}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Time</label>
                                                <div className="flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                                    <ClockFastForward className="w-5 h-5 text-[#98a2b3] shrink-0" />
                                                    <span className="flex-1 text-[16px] text-[#667085]">
                                                        {editing.displayTime} ({calcMinutes(editing.startTime, editing.endTime)} min)
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Template selector */}
                                <div className="flex flex-col gap-4">
                                    <p className="text-[18px] font-semibold text-[#101828]">Class template</p>
                                    <div className="flex flex-col gap-1.5">
                                        <label className={labelCls}>Class template</label>
                                        <TemplateDropdown
                                            templates={activeTemplates.map(t => ({
                                                id: t.id, name: t.name, category: t.category,
                                                description: t.description, locationType: t.locationType,
                                                durationMin: t.durationMin, capacity: t.capacity,
                                                coverColor: t.coverColor, coverImage: t.coverImage,
                                            }))}
                                            value={templateId}
                                            onChange={handleSelectTemplate}
                                            disabled={isEditing}
                                        />
                                    </div>
                                </div>

                                {/* Template detail (visible after template selected) */}
                                {templateId && (
                                    <div className="flex flex-col gap-5">
                                        <p className="text-[18px] font-semibold text-[#101828]">Class template detail</p>

                                        {/* Image banner */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className={labelCls}>Image banner</label>
                                            <div className="relative w-full h-[200px] rounded-[12px] overflow-hidden flex items-center justify-center cursor-pointer group border-1 border-[#e4e7ec]"
                                                style={{ backgroundColor: coverCol }}>
                                                {coverImage && <img src={coverImage} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                                        <UploadCloud01 className="w-5 h-5 text-white" />
                                                    </div>
                                                    <p className="text-white text-[14px] font-semibold">Change image</p>
                                                    <p className="text-white/80 text-[12px]">PNG or JPG (max. 800×400px)</p>
                                                </div>
                                                {!coverImage && (
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className="w-10 h-10 rounded-full bg-white/60 flex items-center justify-center">
                                                            <UploadCloud01 className="w-5 h-5 text-[#667085]" />
                                                        </div>
                                                        <p className="text-[#344054] text-[14px] font-semibold">Change image</p>
                                                        <p className="text-[#667085] text-[12px]">PNG or JPG (max. 800×400px)</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Class name + Class type */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Class name</label>
                                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                                    className={inputCls} placeholder="Enter class name" />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Class type</label>
                                                <SimpleSelect label="Select type" value={classType} options={CLASS_TYPES as unknown as string[]} onChange={setClassType} />
                                            </div>
                                        </div>

                                        {/* Description */}
                                        <div className="flex flex-col gap-1.5">
                                            <label className={labelCls}>Class description</label>
                                            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
                                                className={cn(inputCls, "h-auto py-3 resize-none")} placeholder="Describe this class..." />
                                        </div>

                                        {/* Category + Gender */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Class type</label>
                                                <SimpleSelect label="Select category" value={category} options={CATEGORIES} onChange={setCategory} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Gender</label>
                                                <SimpleSelect label="Select gender" value={gender} options={GENDER_OPTIONS} onChange={setGender} />
                                            </div>
                                        </div>

                                        {/* Duration + Capacity */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Duration</label>
                                                <NumericInput value={duration} onChange={setDuration} min={0} suffix="min" />
                                                <span className={hintCls}>In minutes</span>
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Class capacity</label>
                                                <NumericInput value={capacity} onChange={setCapacity} min={0} />
                                                <span className={hintCls}>Automatically adjusts by room selection.</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* ── Step 2: Location & instructor ── */}
                        {step === 2 && (
                            <>
                                {/* Class location */}
                                <div className="flex flex-col gap-4">
                                    <p className="text-[18px] font-semibold text-[#101828]">Class location</p>
                                    <div className="flex flex-col gap-1.5">
                                        <label className={labelCls}>Location</label>
                                        <LocationDropdown classCapacity={capacity} value={locationId} onChange={handleSelectRoom} />
                                    </div>

                                    {/* Over capacity alert */}
                                    {selectedRoom && selectedRoom.capacity < capacity && (
                                        <div className="flex items-start gap-3 p-4 rounded-[12px] bg-[#fffaeb] border-1 border-[#fedf89]">
                                            <AlertCircle className="w-5 h-5 text-[#dc6803] shrink-0 mt-0.5" />
                                            <p className="text-[14px] text-[#7a2e0e]">
                                                The selected room capacity is lower than the class capacity. The class capacity will be adjusted accordingly.
                                            </p>
                                        </div>
                                    )}

                                    {/* Equipment */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className={labelCls}>Equipment</label>
                                        <input type="text" value={equipment} onChange={e => setEquipment(e.target.value)}
                                            className={inputCls} placeholder="Enter equipment list" />
                                        <span className={hintCls}>Use commas (,) to separate items</span>
                                    </div>
                                </div>

                                <div className="h-px bg-[#e4e7ec]" />

                                {/* Spot selection */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-start justify-between gap-6">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[18px] font-semibold text-[#101828]">Spot selection</p>
                                            <p className="text-[14px] text-[#6e776f]">Turn on spot selection to let your customers choose a spot in the room when booking this class.</p>
                                        </div>
                                        {/* Toggle — disabled until room selected */}
                                        <button type="button"
                                            disabled={!locationId}
                                            onClick={() => locationId && setSpotEnabled(p => !p)}
                                            className={cn("relative w-[36px] h-[20px] rounded-full transition-colors shrink-0 mt-1",
                                                !locationId ? "bg-[#e4e7ec] cursor-not-allowed"
                                                : spotEnabled ? "bg-[#658774]" : "bg-[#f2f4f7]")}>
                                            <div className={cn("absolute top-[2px] w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_rgba(16,24,40,0.1),0px_1px_2px_rgba(16,24,40,0.06)] transition-transform",
                                                spotEnabled ? "translate-x-[18px]" : "translate-x-[2px]")} />
                                        </button>
                                    </div>
                                    {spotEnabled && locationId && (
                                        <div className="w-[162px]">
                                            <Button variant="secondary-gray" size="md"
                                                leftIcon={<Settings03 className="w-4 h-4" />}
                                                className="w-full"
                                                onClick={() => setShowCustomizeSpot(true)}>
                                                Customize spot
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="h-px bg-[#e4e7ec]" />

                                {/* Instructor */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <p className="text-[18px] font-semibold text-[#101828]">Instructor</p>
                                        <div className="relative w-[220px]">
                                            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                                            <input type="text" value={instrSearch} onChange={e => setInstrSearch(e.target.value)}
                                                placeholder="Search instructor..."
                                                className="w-full h-9 pl-9 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        {/* pt-2 pb-2 gives room for the focus ring not to be clipped */}
                                        <div className="flex gap-4 overflow-x-auto pt-2 pb-3 scrollbar-hide">
                                            {filteredInstructors.map(instr => (
                                                <InstructorCard key={instr.id} instructor={instr}
                                                    selected={instructorId === instr.id}
                                                    onClick={() => setInstructorId(instr.id)} />
                                            ))}
                                        </div>
                                        {/* Fade overlay — sibling of scrollable div so it stays fixed */}
                                        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent pointer-events-none" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Step 3: Date & time ── */}
                        {step === 3 && (
                            <>
                                <div className="flex flex-col gap-8">
                                    {/* Date & time section */}
                                    <div className="flex flex-col gap-4">
                                        <p className="text-[18px] font-semibold text-[#101828]">Date & time</p>

                                        {/* Row 1: Repeat + Date (always side-by-side) */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Repeat</label>
                                                <SimpleSelect label="Select repeat" value={repeat} options={REPEAT_OPTIONS as unknown as string[]} onChange={v => setRepeat(v as typeof repeat)} />
                                            </div>
                                            <div className="flex flex-col gap-1.5">
                                                <label className={labelCls}>Date</label>
                                                <DatePicker value={selectedDate} onChange={setSelectedDate} />
                                            </div>
                                        </div>

                                        {/* Row 2: Start time + End time (only for "Does not repeat") */}
                                        {repeat === "Does not repeat" && (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={labelCls}>Start time</label>
                                                    <TimeDropdown value={startTime} onChange={setStartTime} unavailable={unavailableTimes} />
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={labelCls}>End time</label>
                                                    <div className="flex items-center gap-2 w-full h-10 px-[14px] border-1 border-[#d0d5dd] rounded-[8px] bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                                        <ClockFastForward className="w-4 h-4 text-[#98a2b3] shrink-0" />
                                                        <span className="flex-1 text-[16px] text-[#667085]">
                                                            {startTime ? fmtTime(endTime) : "—"}
                                                        </span>
                                                    </div>
                                                    {startTime && duration > 0 && (
                                                        <span className="text-[13px] text-[#98a2b3]">Auto-calculated from {duration} min duration</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                    </div>

                                    {/* Recurring ends section */}
                                    {repeat === "Repeat weekly" && (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-[18px] font-semibold text-[#101828]">Recurring ends</p>
                                            {/* "No end date" pins the schedule to a single week → drop Date + Repeat every entirely.
                                                "End on date" / "End after" → keep both inputs in their 2-column row. */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className={labelCls}>End condition</label>
                                                    <SimpleSelect label="Select end" value={repeatEnd} options={REPEAT_END as unknown as string[]} onChange={v => setRepeatEnd(v as typeof repeatEnd)} />
                                                </div>
                                                {repeatEnd === "End after" && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className={labelCls}>Number of classes</label>
                                                        <NumericInput value={endAfter} onChange={setEndAfter} min={1} max={365} />
                                                    </div>
                                                )}
                                                {repeatEnd === "End on date" && (
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className={labelCls}>Date</label>
                                                        <DatePicker value={endDate} onChange={setEndDate} />
                                                    </div>
                                                )}
                                            </div>
                                            {repeatEnd !== "No end date" && (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className={labelCls}>Repeat every</label>
                                                        <NumericInput
                                                            value={repeatEvery}
                                                            onChange={setRepeatEvery}
                                                            min={1} max={52} suffix="week"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Select days */}
                                    {repeat === "Repeat weekly" && (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-[18px] font-semibold text-[#101828]">Select days</p>
                                            <div className="flex gap-3">
                                                {WEEK_DAYS.map(d => {
                                                    const isSel = selectedDays.includes(d);
                                                    return (
                                                        <button key={d} type="button" onClick={() => toggleDay(d)}
                                                            className={cn(
                                                                "flex-1 h-11 flex items-center justify-center rounded-[8px] text-[16px] font-medium transition-all",
                                                                isSel
                                                                    ? "bg-[#e9fff3] border-2 border-[#7ba08c] text-[#344054]"
                                                                    : "bg-white border-1 border-[#e4e7ec] text-[#344054] hover:border-[#aad4bd]"
                                                            )}>
                                                            {d}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* General schedule */}
                                    {repeat === "Repeat weekly" && selectedDays.length > 0 && (
                                        <div className="flex flex-col gap-4">
                                            <p className="text-[18px] font-semibold text-[#101828]">General schedule</p>
                                            <div className="flex flex-col gap-4">
                                                {WEEK_DAYS.filter(d => selectedDays.includes(d)).map(day => (
                                                    <TimeSlotRow key={day} day={day}
                                                        slots={daySlots[day] ?? [{ start: "09:00", end: calcEndTime("09:00", duration) }]}
                                                        unavailable={unavailableTimes}
                                                        onChange={(i, field, val) => updateSlot(day, i, field, val)}
                                                        onAddSlot={() => addSlot(day)}
                                                        onDeleteSlot={(i) => deleteSlot(day, i)} />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview of scheduled classes */}
                                    {repeat === "Repeat weekly" && selectedDays.length > 0 && (
                                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] p-4 flex flex-col gap-4">
                                            {/* Header */}
                                            <div className="flex items-center gap-4">
                                                <div className="flex-1 min-w-0 flex flex-col">
                                                    <p className="text-[14px] font-medium text-[#101828]">Preview of scheduled classes</p>
                                                    <p className="text-[14px] text-[#667085] truncate">Review all upcoming scheduled dates and time slots.</p>
                                                </div>
                                                <div className="shrink-0 bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-full px-2 py-0.5">
                                                    <p className="text-[12px] font-medium text-[#344054]">
                                                        {previewItems.length} {previewItems.length === 1 ? "class" : "classes"}
                                                    </p>
                                                </div>
                                                <button type="button" onClick={() => setPreviewOpen(o => !o)}
                                                    className="shrink-0 w-5 h-5 flex items-center justify-center text-[#667085] hover:text-[#344054] transition-colors">
                                                    <ChevronUp className={cn("w-5 h-5 transition-transform", !previewOpen && "rotate-180")} />
                                                </button>
                                            </div>

                                            {/* Body */}
                                            {previewOpen && (
                                                <div className="flex flex-col gap-3">
                                                    {previewGrouped.length === 0 && (
                                                        <p className="text-center text-[14px] text-[#98a2b3] py-6">Configure your schedule to see the preview.</p>
                                                    )}
                                                    {previewGrouped.map((month, mi) => (
                                                        <Fragment key={month.label}>
                                                            {mi > 0 && <div className="h-px w-full bg-[#e4e7ec]" />}
                                                            <div className="flex flex-col gap-2">
                                                                <p className="text-[12px] text-[#667085]">{month.label}</p>
                                                                <div className="grid grid-cols-4 gap-y-1">
                                                                    {month.days.map(d => (
                                                                        <div key={d.day} className="flex flex-col items-stretch self-start">
                                                                            <div className="w-full flex justify-center px-3 py-1">
                                                                                <div className="w-6 h-6 rounded-full bg-[#658774] flex items-center justify-center">
                                                                                    <span className="text-[14px] font-semibold leading-5 text-white">{d.day}</span>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1 px-2 pt-1">
                                                                                {d.times.map((t, ti) => (
                                                                                    <div key={ti} className="relative bg-[#e9fff3] rounded-[4px] h-6 px-2 flex items-center overflow-hidden">
                                                                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-[90px] bg-[#92baa4] rounded-tl-[24px] rounded-bl-[8px]" />
                                                                                        <p className="text-[12px] leading-[18px] text-[#667085] truncate">{t}</p>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </Fragment>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-between">
                        {step > 1 ? (
                            <Button variant="secondary-gray" size="md" onClick={() => setStep(s => s - 1)}>Back</Button>
                        ) : <div />}

                        {isEditing ? (
                            step < 2 ? (
                                <Button variant="primary" size="md" disabled={!canProceedStep1}
                                    onClick={() => setStep(s => s + 1)}>
                                    Continue
                                </Button>
                            ) : (
                                <Button variant="primary" size="md" disabled={!canProceedStep2} onClick={handleSaveEdit}>
                                    Save changes
                                </Button>
                            )
                        ) : (step < 3 ? (
                            <Button variant="primary" size="md" disabled={step === 1 ? !canProceedStep1 : !canProceedStep2}
                                onClick={() => setStep(s => s + 1)}>
                                Continue
                            </Button>
                        ) : (
                            <Button variant="primary" size="md" disabled={!canCreate} onClick={handleCreate}>
                                {repeat === "Does not repeat" ? "Create class" : "Publish classes"}
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Preview card */}
                <PreviewCard form={formContent} instructor={selectedInstructor} location={selectedRoom ? { name: selectedRoom.name } : null}
                    templateCapacity={capacity} roomCapacity={selectedRoom?.capacity}
                    original={isEditing && editing ? {
                        location: editing.room,
                        capacity: editing.capacity,
                        instructorName: editing.instructorName,
                        instructorColor: editing.instructorColor,
                    } : undefined}
                />
            </div>

            <Toast />

            {/* ── Customize spot inline overlay ── */}
            {showCustomizeSpot && (() => {
                const roomCap = selectedRoom?.capacity ?? capacity;
                const csLayoutExceeds = csPendingCols * csPendingRows > roomCap;
                const csTotalVisible  = Math.min(csCols * csRows, roomCap);
                const csSpots: string[][] = [];
                let csCount = 0;
                for (let r = 0; r < csRows && csCount < csTotalVisible; r++) {
                    const row: string[] = [];
                    for (let c = 0; c < csCols && csCount < csTotalVisible; c++) {
                        row.push(`${csRowLabel(r)}${c+1}`); csCount++;
                    }
                    if (row.length) csSpots.push(row);
                }
                const csSelectedSpot = csSelected ? { id: csSelected, isBlocked: csBlocked.has(csSelected) } : null;
                return (
                    <div className="absolute inset-0 z-50 bg-white flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="shrink-0 h-[72px] flex items-center px-6">
                            <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setShowCustomizeSpot(false)}
                                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                    <ChevronLeft className="w-5 h-5 text-[#667085]" />
                                </button>
                                <p className="text-[20px] font-semibold text-[#101828]">Customize spot</p>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 flex justify-center">
                            <div className="w-full max-w-[812px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col gap-6 p-6 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] h-fit">

                                {/* Customize area */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex items-end justify-between">
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[18px] font-semibold text-[#101828]">Customize area</p>
                                            <p className="text-[14px] text-[#6e776f]">Select spot to block or unblock.</p>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#c4edd6]" />
                                                <span className="text-[14px] text-[#667085]">Available spot</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-[#f04438]" />
                                                <span className="text-[14px] text-[#475467]">Blocked spot</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-[#f8f8f6] rounded-[16px] px-10 py-10 flex flex-col items-center gap-8 min-h-[280px]">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-[140px] h-[48px] rounded-[10px] bg-[#717bbc]" />
                                            <span className="text-[16px] font-semibold text-[#475467]">Instructor</span>
                                        </div>
                                        <div className="flex flex-col gap-8">
                                            {csSpots.map((row, ri) => (
                                                <div key={ri} className="flex gap-12 justify-center">
                                                    {row.map(sid => (
                                                        <CsSpotCircle key={sid} id={sid}
                                                            blocked={csBlocked.has(sid)}
                                                            active={csSelected === sid}
                                                            customized={csCustomized}
                                                            tooltip={csHovered === sid}
                                                            onClick={() => { if (!csCustomized) return; setCsSelected(p => p === sid ? null : sid); }}
                                                            onMouseEnter={() => csCustomized && setCsHovered(sid)}
                                                            onMouseLeave={() => setCsHovered(null)} />
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Spot layout */}
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[18px] font-semibold text-[#101828]">Spot layout</p>
                                        <p className="text-[14px] text-[#6e776f]">
                                            Define the number of rows and columns to arrange the {roomCap} spots in this room.
                                        </p>
                                    </div>
                                    <div className="flex gap-4">
                                        <CsNumberStepper label="Column number" value={csCustomized ? csPendingCols : csCols}
                                            onChange={v => setCsPendingCols(v)} min={1} max={roomCap} disabled={!csCustomized} />
                                        <CsNumberStepper label="Row number" value={csCustomized ? csPendingRows : csRows}
                                            onChange={v => setCsPendingRows(v)} min={1} max={roomCap} disabled={!csCustomized} />
                                    </div>
                                    {csCustomized && csLayoutExceeds && (
                                        <div className="flex items-start gap-3 p-4 rounded-[12px] bg-[#fef3f2] border-1 border-[#fecdca]">
                                            <AlertCircle className="w-4 h-4 text-[#d92d20] shrink-0 mt-0.5" />
                                            <p className="text-[14px] text-[#7a271a]">
                                                Layout exceeds room capacity ({roomCap} spots). Reduce columns or rows.
                                            </p>
                                        </div>
                                    )}
                                    {csCustomized && !csLayoutExceeds && csPendingCols * csPendingRows < roomCap && (
                                        <p className="text-[13px] text-[#667085]">
                                            {csPendingCols * csPendingRows} of {roomCap} spots will be visible in this layout.
                                        </p>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2">
                                    <Button variant="secondary-gray" size="md" onClick={() => setShowCustomizeSpot(false)}>Cancel</Button>
                                    {csCustomized ? (
                                        <Button variant="primary" size="md" disabled={csLayoutExceeds}
                                            onClick={() => {
                                                setCsCols(csPendingCols); setCsRows(csPendingRows);
                                                setCsBlocked(prev => {
                                                    const next = new Set<string>();
                                                    prev.forEach(id => {
                                                        const ri = id[0].charCodeAt(0)-65;
                                                        const ci = parseInt(id.slice(1));
                                                        if (ri < csPendingRows && ci <= csPendingCols) next.add(id);
                                                    });
                                                    return next;
                                                });
                                                setCsSelected(null);
                                                setShowCustomizeSpot(false);
                                            }}>
                                            Update spot
                                        </Button>
                                    ) : (
                                        <Button variant="primary" size="md" leftIcon={<Settings03 className="w-4 h-4" />}
                                            onClick={() => setCsCustomized(true)}>
                                            Customize spot
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Block/Unblock floating bar */}
                        {csSelectedSpot && (
                            <CsBlockBar spotId={csSelectedSpot.id} blocked={csSelectedSpot.isBlocked}
                                onBlock={() => { setCsBlocked(p => { const n = new Set(p); n.add(csSelected!); return n; }); setCsSelected(null); }}
                                onUnblock={() => { setCsBlocked(p => { const n = new Set(p); n.delete(csSelected!); return n; }); setCsSelected(null); }}
                                onDismiss={() => setCsSelected(null)} />
                        )}
                    </div>
                );
            })()}
        </div>
    );
}

