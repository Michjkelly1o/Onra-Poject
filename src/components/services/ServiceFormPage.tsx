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
//   1. Service detail (Figma 7421:105899 / 7423:101931 / 7619:78933)
//      – Image banner upload
//      – Service name
//      – Class category (live `classCategories` slice — adds in Booking
//        Rules surface here on the same render)
//      – Duration (in minutes)
//      – "Booking conditions" section — role-conditional:
//        • Owner:    fully interactive (both toggles + capacity)
//        • Spa role: "Service is recovery" forced ON + disabled, open
//                    sessions toggle still interactive
//        • Club role: ENTIRE section hidden, isRecovery=false implicit
//        Toggles:
//          1. Service is recovery — when ON reveals card 2
//          2. Service is open sessions — when ON reveals Service capacity
//   2. Pricing (Figma 7421:107562)
//      – Single fixed-price AED input. Replaces the legacy
//        applicable-memberships accordion (services are currency-priced).
//   3. Location (Figma 7422:95427)
//      – Single-select branch dropdown filtered by branch.kind ↔ isRecovery
//        (recovery=ON → Spa branches only; recovery=OFF → Club branches
//        only). Owner sees the matching subset for whatever the toggle
//        says; Spa/Club admins see only their branch's kind.
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
    XClose, Check,
    Lightbulb02, Grid01, ClockFastForward, MarkerPin01,
    BankNote01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { useAppStore, type Service } from "@/lib/store";

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

// Image upload lives in `src/components/ui/ImageBannerUpload.tsx`.

// ─── Toggle (DS-standard sage on/off) ────────────────────────────────────────

function Toggle({ on, onChange, ariaLabel, disabled }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
    /** When true the toggle ignores clicks and paints muted — used for
     *  the Spa-persona-locked "Service is recovery" toggle. */
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
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
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
                <h3 className={cn("font-medium text-[18px] leading-[28px]", hasName ? "text-[#101828]" : "text-[#667085]")}>
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
                            <Grid01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.category || "Category"}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <ClockFastForward className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">
                                {data.durationMin ? `${data.durationMin} min` : "Duration"}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <BankNote01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{priceLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                            <span className="text-[14px] text-[#667085] truncate">{data.branchName || "Location"}</span>
                        </div>
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
    isRecovery: boolean;
    openSession: boolean;
    capacity: string;
    coverPreview: string | null;
    coverFile: File | null;
}

/** Persona derived from currentUser.branch_id × branch.kind:
 *    • "owner" — no branch assignment (full multi-branch access)
 *    • "club"  — assigned to a `branch.kind="club"` branch, can only
 *                author non-recovery services. Booking conditions hidden.
 *    • "spa"   — assigned to a `branch.kind="spa"` branch, can only
 *                author recovery services. Recovery toggle forced ON +
 *                disabled. */
export type ServiceFormPersona = "owner" | "club" | "spa";

function ServiceDetailStep({
    data, onChange, onContinue, categoryOptions, persona,
}: {
    data: Step1Data;
    onChange: (d: Partial<Step1Data>) => void;
    onContinue: () => void;
    categoryOptions: string[];
    persona: ServiceFormPersona;
}) {
    // Booking conditions visibility — Club admins skip the section entirely
    // (their services are always non-recovery). Owner + Spa see it.
    const showBookingConditions = persona !== "club";
    // Spa admins can't turn recovery OFF — the toggle reflects state but
    // is locked. Owner can flip freely.
    const recoveryToggleDisabled = persona === "spa";

    // Required fields:
    //   • Always:           name + category + duration
    //   • If openSession:   + capacity
    //   • Recovery toggle:  no impact on required fields (just routes to
    //                       Spa branches downstream)
    const canContinue =
        data.name.trim() &&
        data.category &&
        data.durationMin &&
        (!data.openSession || data.capacity);

    function handleRecoveryToggle() {
        if (recoveryToggleDisabled) return;
        const next = !data.isRecovery;
        // Turning recovery OFF forces openSession OFF and wipes capacity —
        // non-recovery services are always Private with an instructor.
        onChange(next
            ? { isRecovery: true }
            : { isRecovery: false, openSession: false, capacity: "" });
    }

    function handleOpenSessionToggle() {
        const next = !data.openSession;
        onChange(next
            ? { openSession: true }
            : { openSession: false, capacity: "" });
    }

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Service detail</h2>

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
                        />
                    </FormField>
                    <FormField label="Duration" hint="in minutes">
                        <NumericStringInput value={data.durationMin} onChange={v => onChange({ durationMin: v })} min={0} suffix="min" />
                    </FormField>
                </div>

                {/* Booking conditions — hidden entirely for Club-branch admins
                    so they can't accidentally route a service to the Spa
                    branch (their persona ALWAYS creates non-recovery
                    services). Owner + Spa-branch admins see it. */}
                {showBookingConditions && (
                    <div className="flex flex-col gap-3">
                        <h3 className="font-semibold text-[16px] leading-[24px] text-[#101828]">Booking conditions</h3>

                        {/* Card 1 — Service is recovery */}
                        <div className={cn(
                            "rounded-[12px] p-4 flex flex-col gap-4 transition-colors",
                            data.isRecovery
                                ? "border-1 border-[#7ba08c] bg-[#f5fffa]"
                                : "border-1 border-[#e4e7ec] bg-white",
                            recoveryToggleDisabled && "opacity-90",
                        )}>
                            <div className="flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <p className="text-[14px] font-medium text-[#101828]">Service is recovery</p>
                                    <p className="text-[14px] text-[#667085]">Available at Spa locations only.</p>
                                </div>
                                <Toggle
                                    on={data.isRecovery}
                                    onChange={handleRecoveryToggle}
                                    disabled={recoveryToggleDisabled}
                                    ariaLabel="Toggle service is recovery"
                                />
                            </div>
                        </div>

                        {/* Card 2 — Service is open sessions (only meaningful
                            when recovery=ON; non-recovery services are
                            always Private). */}
                        {data.isRecovery && (
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
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Pricing</h2>

                <FormField label="Fixed price">
                    <div className="flex items-stretch w-full rounded-[8px] border-1 border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c]">
                        <div className="px-3 flex items-center text-[14px] text-[#475467] border-r-1 border-[#d0d5dd] bg-[#fbfdfc] rounded-l-[8px]">
                            AED
                        </div>
                        <input
                            type="number"
                            min={0}
                            value={price}
                            onChange={e => onChange(e.target.value.replace(/^0+(?=\d)/, ""))}
                            placeholder="Enter amount"
                            className="flex-1 px-3 py-2 text-[14px] text-[#101828] placeholder:text-[#667085] bg-transparent rounded-r-[8px] focus:outline-none"
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

// ─── Step 3 — Location (single-select branch, filtered by branch.kind) ──────

function LocationStep({
    branchId, onChange, branchOptions, onBack, onSubmit, mode, isRecovery,
}: {
    branchId: string;
    onChange: (v: string) => void;
    branchOptions: { value: string; label: string }[];
    onBack: () => void;
    onSubmit: () => void;
    mode: "create" | "edit";
    /** Drives the contextual hint banner — recovery services list only
     *  Spa branches, non-recovery list only Club branches. */
    isRecovery: boolean;
}) {
    const canSubmit = !!branchId;
    const hint = isRecovery
        ? "Recovery services are offered at Spa locations only — the dropdown lists Spa branches."
        : "Non-recovery services are offered at Club locations only — the dropdown lists Club branches.";
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-5">
                <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Location</h2>

                <FormField label="Branch location">
                    <SelectInput
                        triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                        placeholder={branchOptions.length === 0
                            ? (isRecovery ? "No active Spa branches" : "No active Club branches")
                            : "Select location"}
                        value={branchId}
                        onChange={onChange}
                        options={branchOptions}
                        width="w-full"
                    />
                </FormField>

                <div className="flex items-start gap-4 px-4 py-4 bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                    <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                    <p className="text-[14px] text-[#475467] leading-[20px]">{hint}</p>
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
    returnTo?: string;
}

export function ServiceFormPage({ mode, serviceId, returnTo = "/admin/services" }: ServiceFormPageProps) {
    const router = useRouter();

    // Live store reads — every dropdown updates when the underlying module
    // (Booking Rules / Business & Locations) mutates.
    const services         = useAppStore(s => s.services);
    const branches         = useAppStore(s => s.branches);
    const classCategories  = useAppStore(s => s.classCategories);
    const currentUser      = useAppStore(s => s.currentUser);
    const addService       = useAppStore(s => s.addService);
    const updateService    = useAppStore(s => s.updateService);
    const showToast        = useAppStore(s => s.showToast);

    const existing: Service | undefined = mode === "edit" && serviceId
        ? services.find(s => s.id === serviceId)
        : undefined;

    // Persona derivation — drives Step 1 Booking-conditions visibility and
    // Step 3 location dropdown filter. Owner = no branch assignment, sees
    // everything. Club/Spa admins are scoped to their branch's kind.
    const persona: ServiceFormPersona = useMemo(() => {
        const branchIdOnUser = currentUser.branch_id;
        if (!branchIdOnUser) return "owner";
        const b = branches.find(x => x.id === branchIdOnUser);
        return b?.kind === "spa" ? "spa" : "club";
    }, [currentUser.branch_id, branches]);

    // ─── Step state ────────────────────────────────────────────────────────
    const [step, setStep] = useState<1 | 2 | 3>(1);

    const [step1, setStep1] = useState<Step1Data>(() => ({
        name:         existing?.name ?? "",
        category:     existing?.category ?? "",
        durationMin:  existing ? String(existing.durationMin) : "",
        // Spa-persona always creates recovery services; club-persona never
        // does. Owner defaults OFF (most services are non-recovery).
        isRecovery:   existing?.isRecovery ?? (persona === "spa"),
        openSession:  existing?.openSession ?? false,
        capacity:     existing && existing.capacity > 0 ? String(existing.capacity) : "",
        coverPreview: existing?.coverImage ?? null,
        coverFile:    null,
    }));

    const [price, setPrice] = useState<string>(
        () => existing && existing.price > 0 ? String(existing.price) : "",
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
            isRecovery:   existing.isRecovery,
            openSession:  existing.openSession,
            capacity:     existing.capacity > 0 ? String(existing.capacity) : "",
            coverPreview: existing.coverImage ?? null,
            coverFile:    null,
        });
        setPrice(existing.price > 0 ? String(existing.price) : "");
        setBranchId(existing.branchId);
    }, [mode, existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Derived dropdown sources ──────────────────────────────────────────
    const categoryOptions = useMemo(() => classCategories.map(c => c.name), [classCategories]);
    // Location dropdown filtered by `branch.kind` matching the form's
    // current isRecovery flag — recovery services live at Spa branches,
    // non-recovery at Club branches. Spa/Club personas only see their kind
    // (their isRecovery is locked, so the filter naturally restricts).
    const branchOptions = useMemo(() => {
        const targetKind: "club" | "spa" = step1.isRecovery ? "spa" : "club";
        return branches
            .filter(b => b.status === "active" && b.kind === targetKind)
            .map(b => ({ value: b.id, label: b.name }));
    }, [branches, step1.isRecovery]);

    // If isRecovery flips, clear branchId when it no longer matches the
    // new filtered set so the user can't submit a stale Club branch on a
    // Recovery service or vice versa.
    useEffect(() => {
        if (!branchId) return;
        const stillValid = branchOptions.some(o => o.value === branchId);
        if (!stillValid) setBranchId("");
    }, [branchOptions, branchId]);

    // ─── Submit ────────────────────────────────────────────────────────────
    function handleSubmit() {
        const cat    = classCategories.find(c => c.name === step1.category);
        const branch = branches.find(b => b.id === branchId);

        const payload = {
            name:        step1.name.trim(),
            description: existing?.description ?? "",
            categoryId:  cat?.id ?? "",
            category:    step1.category,
            isRecovery:  step1.isRecovery,
            // Non-recovery services are always Private with an instructor —
            // force open_session=false even if the local toggle drifted.
            openSession: step1.isRecovery ? step1.openSession : false,
            durationMin: Number(step1.durationMin),
            capacity:    step1.isRecovery && step1.openSession ? Number(step1.capacity) : 0,
            price:       Number(price),
            branchId:    branchId,
            branchName:  branch?.name ?? "",
            branchKind:  (branch?.kind ?? "club") as "club" | "spa",
            status:      (existing?.status ?? "Active") as Service["status"],
            coverImage:  step1.coverPreview ?? undefined,
            coverColor:  cat?.color_hex ?? "#e9fff3",
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
                <p className="font-semibold text-[18px] text-[#101828]">Service not found</p>
                <p className="text-[14px] text-[#667085]">The service you're trying to edit no longer exists.</p>
                <Button variant="primary" size="md" onClick={() => router.push(returnTo)}>
                    Back to services
                </Button>
            </div>
        );
    }

    // Resolve the selected branch's display name from the current options
    // list. Using `branchOptions` (already filtered by `isRecovery` ↔
    // `branch.kind`) means the preview stays in sync if Step 1 flips
    // recovery — branchId is cleared by the useEffect above when the new
    // options set no longer contains it, and Location falls back to the
    // placeholder until the admin picks again.
    const previewBranchName = branchOptions.find(o => o.value === branchId)?.label ?? "";

    const previewData: PreviewData = {
        name:         step1.name,
        category:     step1.category,
        durationMin:  step1.durationMin,
        price:        price,
        branchName:   previewBranchName,
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
                        onClick={() => router.push(returnTo)}
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
                                persona={persona}
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
                                onBack={() => setStep(2)}
                                onSubmit={handleSubmit}
                                mode={mode}
                                isRecovery={step1.isRecovery}
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
