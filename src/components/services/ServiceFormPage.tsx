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
//   1. Service detail
//      – Image banner upload
//      – Service name
//      – Class category (live `classCategories` slice — adds in Booking
//        Rules surface here on the same render)
//      – Duration (in minutes)
//      – "Session type" selector — Private session vs Recovery.
//        Choosing Recovery reveals the "open sessions" toggle (multi-
//        participant, no instructor) + capacity. Private is always 1:1.
//   2. Pricing
//      – Single fixed-price AED input. Replaces the legacy
//        applicable-memberships accordion (services are currency-priced).
//   3. Location
//      – Single-select branch dropdown (any active branch) + an OPTIONAL
//        room selector (rooms of the picked branch, or "No room"). A
//        session may or may not use a room.
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
    XClose, Check, Plus,
    Lightbulb02, Grid01, ClockFastForward, MarkerPin01,
    BankNote01, UserCheck01, Feather,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";
import { useAppStore, type Service, type ServiceType, type ClassCategory } from "@/lib/store";

// ─── Stepper ─────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Service detail" },
    { n: 2, label: "Pricing" },
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
                        ? "bg-[var(--colors-secondary-600)] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#457175]"
                        : complete
                            ? "bg-[var(--colors-secondary-600)] text-white"
                            : "bg-[var(--colors-bg-tertiary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-fg-quaternary)]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[var(--colors-bg-quaternary)] rounded-[2px]" />
                )}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#10373a]" : "font-medium text-[var(--colors-text-quaternary)]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form input helpers (verbatim from class-template form) ─────────────────

const inputCls = "h-10 w-full px-[14px] border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[var(--colors-text-tertiary)]">{hint}</p>}
        </div>
    );
}

// Image upload lives in `src/components/ui/ImageBannerUpload.tsx`.

// ─── Toggle (DS-standard sage on/off) ────────────────────────────────────────

function Toggle({ on, onChange, ariaLabel, disabled }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
    /** When true the toggle ignores clicks and paints muted. */
    disabled?: boolean;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={disabled ? undefined : onChange}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]",
                disabled && "opacity-50 cursor-not-allowed",
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
    /** Fixed AED price string (from Step 2). Empty → "Fixed price" placeholder. */
    price: string;
    /** Selected branch display name (from Step 3 dropdown). Empty → "Location"
     *  placeholder. Pulled fresh on every render so flipping the Step 1
     *  recovery toggle (which re-filters Step 3 options) reflects here too. */
    branchName: string;
    coverPreview: string | null;
}

function ServicePreviewCard({ data }: { data: PreviewData }) {
    const hasName = !!data.name.trim();
    // Format the fixed price as "AED 95" once a numeric value is entered;
    // fall back to the placeholder label until then. Mirrors the Service
    // detail side panel's "Fixed price" row.
    const priceLabel = data.price && Number(data.price) > 0
        ? `AED ${Number(data.price).toLocaleString()}`
        : "Fixed price";
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[16px] overflow-hidden w-full">
            <div className="relative h-[156px] w-full overflow-hidden shrink-0 bg-gradient-to-br from-[#dbdbdb] to-[#dbdbdb]/20">
                {data.coverPreview && (
                    <img src={data.coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                )}
                <div className="absolute top-3 right-3">
                    <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]">
                        Active
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
                <h3 className={cn("font-medium text-[18px] leading-[28px]", hasName ? "text-[var(--colors-text-primary)]" : "text-[var(--colors-text-quaternary)]")}>
                    {hasName ? data.name : "Service name"}
                </h3>
                {/* 2×2 stat grid per Figma 7423:108412 (Service preview card):
                    Category | Duration / Fixed price | Location. Each cell
                    falls back to its placeholder label while the user is
                    still filling the form, then swaps to the live value
                    once entered — Step 2 wires `price`, Step 3 wires
                    `branchName`. */}
                <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <Grid01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{data.category || "Category"}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ClockFastForward className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">
                                {data.durationMin ? `${data.durationMin} min` : "Duration"}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <BankNote01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{priceLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <MarkerPin01 className="w-4 h-4 text-[var(--colors-text-quaternary)] shrink-0" />
                            <span className="text-[14px] text-[var(--colors-text-quaternary)] truncate">{data.branchName || "Location"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1 — Service detail ────────────────────────────────────────────────

// Session-type card metadata — shared by the interactive picker (bare create)
// and the read-only card (menu-scoped create / edit). The type is fixed by the
// menu you came from — "Private sessions" creates Private, "Recovery"
// creates Recovery — so the two are never mixed up.
const TYPE_OPTIONS = [
    { value: "private" as const,  title: "Private session",     subtitle: "1:1 training with an instructor.", Icon: UserCheck01 },
    { value: "recovery" as const, title: "Recovery", subtitle: "Spa / wellness — massage, sauna, breathwork, etc.", Icon: Feather },
];

interface Step1Data {
    name: string;
    category: string;
    durationMin: string;
    /** Session type — "private" (1:1) or "recovery" (spa/wellness). */
    type: ServiceType;
    openSession: boolean;
    capacity: string;
    coverPreview: string | null;
    coverFile: File | null;
}

function ServiceDetailStep({
    data, onChange, onContinue, categoryOptions, lockType, onCreateCategory,
}: {
    data: Step1Data;
    onChange: (d: Partial<Step1Data>) => void;
    onContinue: () => void;
    categoryOptions: string[];
    /** When true the type is fixed (create scoped to a menu, or edit) — the
     *  Private/Recovery picker is hidden entirely (the menu already decided). */
    lockType: boolean;
    /** Opens the parent's inline "Create class category" modal — a "+ Create
     *  class category" button in the dropdown menuHeader triggers this. */
    onCreateCategory: () => void;
}) {
    // Required fields: name + category + duration always; capacity when the
    // recovery service is an open session.
    const canContinue =
        data.name.trim() &&
        data.category &&
        data.durationMin &&
        (!data.openSession || data.capacity);

    function handleTypeChange(next: ServiceType) {
        // Switching to Private clears the open-session state — private
        // services are always 1:1 with an instructor.
        onChange(next === "recovery"
            ? { type: "recovery" }
            : { type: "private", openSession: false, capacity: "" });
    }

    function handleOpenSessionToggle() {
        const next = !data.openSession;
        onChange(next
            ? { openSession: true }
            : { openSession: false, capacity: "" });
    }

    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Service detail</h2>

                <ImageBannerUpload
                    preview={data.coverPreview}
                    onChange={(url, file) => onChange({ coverPreview: url, coverFile: file })}
                />

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
                            menuHeader={({ close }) => (
                                <button
                                    type="button"
                                    onClick={() => { close(); onCreateCategory(); }}
                                    className="w-full flex items-center gap-2 px-3 py-2.5 text-[14px] font-medium text-[var(--colors-secondary-600)] hover:bg-[var(--colors-bg-secondary)] transition-colors rounded-t-[8px]"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create class category
                                </button>
                            )}
                        />
                    </FormField>
                    <FormField label="Duration" hint="in minutes">
                        <NumericStringInput value={data.durationMin} onChange={v => onChange({ durationMin: v })} min={0} suffix="min" />
                    </FormField>
                </div>

                {/* Session type — the type is fixed by the menu you came from
                    ("Private sessions" / "Recovery"), so the picker
                    is hidden when locked. Only a bare/direct create shows it.
                    Recovery keeps the Open-sessions option regardless. */}
                {(!lockType || data.type === "recovery") && (
                    <div className="flex flex-col gap-3">
                        {!lockType && (
                            <>
                                <h3 className="font-semibold text-[16px] leading-[24px] text-[var(--colors-text-primary)]">Session type</h3>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    {TYPE_OPTIONS.map(opt => {
                                        const selected = data.type === opt.value;
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => handleTypeChange(opt.value)}
                                                className={cn(
                                                    "flex items-start gap-3 rounded-[12px] p-4 text-left transition-colors w-full",
                                                    selected
                                                        ? "border-1 border-[var(--colors-secondary-500)] bg-[#f5fffa]"
                                                        : "border-1 border-[var(--colors-border-secondary)] bg-white hover:border-[var(--colors-border-primary)]",
                                                )}
                                                aria-pressed={selected}
                                            >
                                                <div className={cn(
                                                    "w-9 h-9 rounded-[8px] flex items-center justify-center shrink-0 border-1",
                                                    selected
                                                        ? "bg-[#e7f7ec] border-[#94aeaf] text-[#164e52]"
                                                        : "bg-[var(--colors-bg-secondary)] border-[var(--colors-border-secondary)] text-[var(--colors-text-tertiary)]",
                                                )}>
                                                    <opt.Icon className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[14px] font-medium text-[var(--colors-text-primary)] leading-5">{opt.title}</p>
                                                    <p className="text-[14px] text-[var(--colors-text-quaternary)] leading-[20px] mt-0.5">{opt.subtitle}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {/* Open sessions — only meaningful for recovery services
                            (private services are always 1:1). */}
                        {data.type === "recovery" && (
                            <div className={cn(
                                "rounded-[12px] p-4 flex flex-col gap-4 transition-colors",
                                data.openSession
                                    ? "border-1 border-[var(--colors-secondary-500)] bg-[#f5fffa]"
                                    : "border-1 border-[var(--colors-border-secondary)] bg-white",
                            )}>
                                <div className="flex items-start gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[14px] font-medium text-[var(--colors-text-primary)]">Service is open sessions</p>
                                        <p className="text-[14px] text-[var(--colors-text-quaternary)]">The service is open to multiple participants and does not require instructor.</p>
                                    </div>
                                    <Toggle
                                        on={data.openSession}
                                        onChange={handleOpenSessionToggle}
                                        ariaLabel="Toggle open sessions"
                                    />
                                </div>
                                {data.openSession && (
                                    <FormField label="Service capacity">
                                        <NumericStringInput value={data.capacity} onChange={v => onChange({ capacity: v })} min={0} />
                                    </FormField>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="shrink-0 px-6 pb-6 flex justify-end">
                <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>
                    Continue
                </Button>
            </div>
        </div>
    );
}

// ─── Step 2 — Pricing (single fixed AED price) ──────────────────────────────
// Replaces the legacy "Applicable memberships" step — services are now
// currency-priced and the customer pays the fixed amount on the appointment
// checkout. AED-prefix layout mirrors Figma 7421:107562.

function PricingStep({
    price, onChange, onBack, onContinue,
}: {
    price: string;
    onChange: (v: string) => void;
    onBack: () => void;
    onContinue: () => void;
}) {
    const canContinue = price.trim() !== "" && Number(price) > 0;
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Pricing</h2>

                <FormField label="Fixed price">
                    <div className="flex items-stretch w-full rounded-[8px] border-1 border-[var(--colors-border-primary)] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[var(--colors-secondary-300)] focus-within:border-[var(--colors-secondary-500)]">
                        <div className="px-3 flex items-center text-[14px] text-[var(--colors-text-tertiary)] border-r-1 border-[var(--colors-border-primary)] bg-[#fbfdfc] rounded-l-[8px]">
                            AED
                        </div>
                        <input
                            type="number"
                            min={0}
                            value={price}
                            onChange={e => onChange(e.target.value.replace(/^0+(?=\d)/, ""))}
                            placeholder="Enter amount"
                            className="flex-1 px-3 py-2 text-[14px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-quaternary)] bg-transparent rounded-r-[8px] focus:outline-none"
                        />
                    </div>
                </FormField>
            </div>

            <div className="shrink-0 px-6 pb-6 flex items-center justify-between">
                <Button variant="secondary-gray" size="md" onClick={onBack}>Back</Button>
                <Button variant="primary" size="md" disabled={!canContinue} onClick={onContinue}>Continue</Button>
            </div>
        </div>
    );
}

// ─── Step 3 — Location (branch + optional room) ─────────────────────────────

/** Sentinel for the "No room" option — a session may run without a room. */
const NO_ROOM = "__no_room__";

function LocationStep({
    branchId, onChange, branchOptions, roomId, onRoomChange, roomOptions, onBack, onSubmit, mode,
}: {
    branchId: string;
    onChange: (v: string) => void;
    branchOptions: { value: string; label: string }[];
    /** Selected room id, or "" for no room. */
    roomId: string;
    onRoomChange: (v: string) => void;
    /** Rooms of the selected branch (empty until a branch is picked). */
    roomOptions: { value: string; label: string }[];
    onBack: () => void;
    onSubmit: () => void;
    mode: "create" | "edit";
}) {
    const canSubmit = !!branchId;
    return (
        <div className="bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Location</h2>

                <FormField label="Branch location">
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder={branchOptions.length === 0 ? "No active branches" : "Select location"}
                        value={branchId}
                        onChange={onChange}
                        options={branchOptions}
                        width="w-full"
                    />
                </FormField>

                {/* Room — optional. Mirrors the class-schedule form's room
                    picker; a session may or may not use a room. Defaults to
                    "No room". Disabled until a branch is picked. */}
                <FormField label="Room" hint="Optional — leave as “No room” if this session isn’t room-scoped.">
                    <SelectInput
                        triggerIcon={<Grid01 className="w-4 h-4" />}
                        placeholder={!branchId ? "Select a branch first" : "No room"}
                        value={roomId === "" ? NO_ROOM : roomId}
                        onChange={(v) => onRoomChange(v === NO_ROOM ? "" : v)}
                        options={[{ value: NO_ROOM, label: "No room" }, ...roomOptions]}
                        width="w-full"
                    />
                </FormField>
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
    returnTo?: string;
    /** Create scoped to a menu ("Private sessions" / "Recovery") —
     *  locks the type so you can't create the other kind from this menu. */
    presetType?: ServiceType;
}

export function ServiceFormPage({ mode, serviceId, returnTo = "/admin/services", presetType }: ServiceFormPageProps) {
    const router = useRouter();

    // Live store reads — every dropdown updates when the underlying module
    // (Booking Rules / Business & Locations) mutates.
    const services         = useAppStore(s => s.services);
    const branches         = useAppStore(s => s.branches);
    const rooms            = useAppStore(s => s.rooms);
    const classCategories  = useAppStore(s => s.classCategories);
    const addService       = useAppStore(s => s.addService);
    const updateService    = useAppStore(s => s.updateService);
    const addClassCategory = useAppStore(s => s.addClassCategory);
    const showToast        = useAppStore(s => s.showToast);

    // Client 2026-07-31 — "+ Create class category" inline modal, reachable
    // from the Class-category dropdown header on Step 1. Admin never has
    // to leave the service creation flow to add a missing category.
    const [creatingCategory, setCreatingCategory] = useState(false);

    const existing: Service | undefined = mode === "edit" && serviceId
        ? services.find(s => s.id === serviceId)
        : undefined;

    // ─── Step state ────────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [step1, setStep1] = useState<Step1Data>(() => ({
        name:         existing?.name ?? "",
        category:     existing?.category ?? "",
        durationMin:  existing ? String(existing.durationMin) : "",
        // Type comes from the edited service, else the menu that opened the
        // create form ("Private sessions" / "Recovery"), else
        // defaults to Private for a bare/direct create.
        type:         existing?.type ?? presetType ?? "private",
        openSession:  existing?.openSession ?? false,
        capacity:     existing && existing.capacity > 0 ? String(existing.capacity) : "",
        coverPreview: existing?.coverImage ?? null,
        coverFile:    null,
    }));

    const [price, setPrice] = useState<string>(
        () => existing && existing.price > 0 ? String(existing.price) : "",
    );
    const [branchId, setBranchId] = useState<string>(existing?.branchId ?? "");
    // Optional room — "" means no room.
    const [roomId, setRoomId] = useState<string>(existing?.roomId ?? "");

    // If the edit-mode service id appears asynchronously (rare but possible
    // on resume-from-persist), refresh the local state once it lands.
    useEffect(() => {
        if (mode !== "edit" || !existing) return;
        setStep1({
            name:         existing.name,
            category:     existing.category,
            durationMin:  String(existing.durationMin),
            type:         existing.type,
            openSession:  existing.openSession,
            capacity:     existing.capacity > 0 ? String(existing.capacity) : "",
            coverPreview: existing.coverImage ?? null,
            coverFile:    null,
        });
        setPrice(existing.price > 0 ? String(existing.price) : "");
        setBranchId(existing.branchId);
        setRoomId(existing.roomId ?? "");
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Derived dropdown sources ──────────────────────────────────────────
    const categoryOptions = useMemo(() => classCategories.map(c => c.name), [classCategories]);
    // Location dropdown — every active branch. Any branch hosts any type.
    const branchOptions = useMemo(
        () => branches
            .filter(b => b.status === "active")
            .map(b => ({ value: b.id, label: b.name })),
        [branches],
    );
    // Room dropdown — active rooms of the selected branch (optional; a "No
    // room" option is prepended by LocationStep).
    const roomOptions = useMemo(
        () => rooms
            .filter(r => r.branch_id === branchId && r.status === "active")
            .map(r => ({ value: r.id, label: r.name })),
        [rooms, branchId],
    );

    // Clear the room when the selected branch changes and the room no longer
    // belongs to it, so a service can't submit a room from another branch.
    useEffect(() => {
        if (!roomId) return;
        const stillValid = roomOptions.some(o => o.value === roomId);
        if (!stillValid) setRoomId("");
    }, [roomOptions, roomId]);

    // ─── Submit ────────────────────────────────────────────────────────────
    function handleSubmit() {
        const cat    = classCategories.find(c => c.name === step1.category);
        const branch = branches.find(b => b.id === branchId);

        const payload = {
            name:        step1.name.trim(),
            description: existing?.description ?? "",
            categoryId:  cat?.id ?? "",
            category:    step1.category,
            type:        step1.type,
            // Only recovery services can be open sessions — private is 1:1.
            openSession: step1.type === "recovery" ? step1.openSession : false,
            durationMin: Number(step1.durationMin),
            capacity:    step1.type === "recovery" && step1.openSession ? Number(step1.capacity) : 0,
            price:       Number(price),
            branchId:    branchId,
            branchName:  branch?.name ?? "",
            // Optional room ("" = no room).
            roomId:      roomId,
            status:      (existing?.status ?? "Active") as Service["status"],
            coverImage:  step1.coverPreview ?? undefined,
            coverColor:  cat?.color_hex ?? "#eff6f3",
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
        router.push(returnTo);
    }

    // Edit-mode safety — if the id is missing, surface a friendly hand-off.
    if (mode === "edit" && !existing) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center gap-3">
                <p className="font-semibold text-[18px] text-[var(--colors-text-primary)]">Service not found</p>
                <p className="text-[14px] text-[var(--colors-text-quaternary)]">The service you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={() => router.push(returnTo)}>
                    Back to services
                </Button>
            </div>
        );
    }

    // Resolve the selected branch's display name from the current options.
    const previewBranchName = branchOptions.find(o => o.value === branchId)?.label ?? "";

    const previewData: PreviewData = {
        name:         step1.name,
        category:     step1.category,
        durationMin:  step1.durationMin,
        price:        price,
        branchName:   previewBranchName,
        coverPreview: step1.coverPreview,
    };

    // Type is fixed for an edit (the service already has one) and for a
    // menu-scoped create (presetType) — only a bare create lets you pick.
    const typeLocked = mode === "edit" || presetType != null;

    const pageTitle = mode === "edit"
        ? `Edit ${existing?.name ?? "service"}`
        : presetType === "private"  ? "Create private session"
        : presetType === "recovery" ? "Create recovery session"
        : "Create new service";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button type="button"
                        onClick={() => router.push(returnTo)}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors shrink-0">
                        <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                    </button>
                    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <h1 className="font-semibold text-[20px] leading-[30px] text-[var(--colors-text-primary)]">{pageTitle}</h1>
                        <Breadcrumbs className="p-0 text-[12px]" />
                    </div>
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
                                lockType={typeLocked}
                                onCreateCategory={() => setCreatingCategory(true)}
                            />
                        )}
                        {step === 2 && (
                            <PricingStep
                                price={price}
                                onChange={setPrice}
                                onBack={() => setStep(1)}
                                onContinue={() => setStep(3)}
                            />
                        )}
                        {step === 3 && (
                            <LocationStep
                                branchId={branchId}
                                onChange={setBranchId}
                                branchOptions={branchOptions}
                                roomId={roomId}
                                onRoomChange={setRoomId}
                                roomOptions={roomOptions}
                                onBack={() => setStep(2)}
                                onSubmit={handleSubmit}
                                mode={mode}
                            />
                        )}

                        {/* Right: live preview */}
                        <div className="w-[340px] shrink-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] overflow-hidden self-start">
                            <div className="p-6 pb-4">
                                <p className="font-semibold text-[18px] leading-[28px] text-[var(--colors-text-primary)]">Service preview</p>
                                <p className="text-[14px] text-[#667085] mt-1">This is how your service will look like.</p>
                            </div>
                            <div className="bg-[#f6f6f3] px-6 py-10">
                                <ServicePreviewCard data={previewData} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Client 2026-07-31 — reuse the SAME CategoryModal the admin
                uses on /admin/categories so the flow stays 1:1 (chrome,
                validation, image upload). Submit calls the same
                addClassCategory action → every consumer that subscribes
                to the classCategories slice (schedule form, service
                form, class-types form, staff form, AI-agent dataset)
                sees the new row in the same render cycle. Live duplicate
                check via `takenNames` shows the "already exists" error
                inline in the modal — no submit-then-fail toast round
                trip. On success we auto-select the fresh category by
                name on this service so the form is ready to continue. */}
            {creatingCategory && (
                <CategoryModal
                    onClose={() => setCreatingCategory(false)}
                    takenNames={classCategories.map(c => c.name)}
                    onSubmit={({ name, image_url }) => {
                        const cleanName = name.trim();
                        if (!cleanName) return;
                        const next: ClassCategory = {
                            id: `cat_new_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                            name: cleanName,
                            color_hex: "#f9fafb",
                            status: "active",
                            image_url: image_url || undefined,
                        };
                        addClassCategory(next);
                        setStep1(prev => ({ ...prev, category: cleanName }));
                        setCreatingCategory(false);
                        showToast(
                            "Category created",
                            `"${cleanName}" has been added to your categories.`,
                            "success", "check",
                        );
                    }}
                />
            )}
        </div>
    );
}
