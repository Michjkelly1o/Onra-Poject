"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Create / Edit promo
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page modal flow at /products/promo-codes/new — same shell as the
// membership / gift-card create flows (lives OUTSIDE the admin sidebar).
//
// Two-step flow (Figma 7041:101711 / 102299 / 102588):
//   1. Promo details      — banner / name / description / action, duration,
//                           promo configuration (discount + code), usage limit
//   2. Visibility settings — applicable branches, applies-to products/classes,
//                           customer targeting
//
// Create writes a `promo_codes` row via `addPromoCode`; edit patches it via
// `updatePromoCode`. Both route to the promo detail page afterwards so the
// merchant lands on the freshly-saved record.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, ChevronDown, ChevronUp,
    CheckCircleBroken, Package as PackageIcon, FilterLines, MarkerPin01,
    CursorBox, Sale03, Ticket01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NumericStringInput } from "@/components/ui/NumericInput";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { ImageBannerUpload } from "@/components/ui/ImageBannerUpload";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { useAppStore, type PromoCode, type Branch } from "@/lib/store";

/** Current local time as "HH:MM" — used to bar past start-time slots today. */
function nowHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS = [
    { n: 1, label: "Promotion details" },
    { n: 2, label: "Visibility settings" },
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
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />}
            </div>
            <span className={cn(
                "text-[14px]",
                active ? "font-semibold text-[#3b5446]"
                    : complete ? "font-medium text-[#344054]" : "font-medium text-[#667085]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Shell primitives ────────────────────────────────────────────────────────

function FormCard({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-8">{children}</div>
            <div className="shrink-0 px-6 pb-6 pt-6 flex items-center">{footer}</div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-5 w-full">
            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
            {hint && <p className="text-[14px] text-[#475467] leading-5">{hint}</p>}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT_CLS} />;
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ minHeight: 96 }}
            className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y leading-6" />
    );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
            className={cn("relative w-9 h-5 rounded-full transition-colors shrink-0", on ? "bg-[#658774]" : "bg-[#f2f4f7]")}>
            <span className={cn(
                "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                "shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]",
                on ? "left-[18px]" : "left-0.5",
            )} />
        </button>
    );
}

/** Bordered card with a lead toggle + optional revealed body. */
function ToggleCard({ title, subtitle, on, onChange, children }: {
    title: string; subtitle: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode;
}) {
    return (
        <div className={cn(
            "bg-white rounded-[12px] p-4 flex flex-col gap-3 transition-colors w-full",
            on ? "border-2 border-[#7ba08c]" : "border-1 border-[#e4e7ec]",
        )}>
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <Toggle on={on} onChange={onChange} />
            </div>
            {on && children}
        </div>
    );
}

function FilledCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

function FilledRadio({ selected }: { selected: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors border",
            selected ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd]",
        )}>
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
    );
}

// ─── Step 1 — action picker cards ────────────────────────────────────────────

function ActionCard({ icon, label, selected, onSelect }: {
    icon: React.ReactNode; label: string; selected: boolean; onSelect: () => void;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "flex-1 min-w-0 flex items-center gap-3 p-4 rounded-[12px] transition-colors text-left",
                selected ? "bg-white border-2 border-[#7ba08c]" : "bg-white border-1 border-[#e4e7ec] hover:bg-[#fafafa]",
            )}>
            <div className="w-8 h-8 rounded-[6px] bg-[#f9fafb] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0 text-[#475467]">
                {icon}
            </div>
            <span className="flex-1 text-[14px] font-medium text-[#344054]">{label}</span>
            <FilledRadio selected={selected} />
        </button>
    );
}

// ─── Time dropdown — half-hourly slots ───────────────────────────────────────

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

function TimeSelect({ value, onChange, disabledOption }: {
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
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <span className={cn("flex-1 text-left truncate", selected ? "text-[#101828]" : "text-[#667085]")}>
                    {selected?.label ?? "Select time"}
                </span>
                <ChevronDown className="w-5 h-5 text-[#667085] shrink-0" />
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
                                    disabled ? "text-[#d0d5dd] cursor-not-allowed"
                                        : value === o.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
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

// ─── Multi-select card (branches / packages / classes) ───────────────────────
//
// Each card carries a row filter — "All / Only enabled / Only disabled" —
// where "enabled" means the row is currently checked (selected) and
// "disabled" means it is not. Purely a viewing aid; it never mutates the
// selection, it just narrows which rows are listed.

interface MultiOption { id: string; label: string; sublabel?: string; group?: string }

type RowFilter = "all" | "enabled" | "disabled";

/** Filter dropdown — All / Only enabled / Only disabled. */
function RowFilterDropdown({ active, onChange }: {
    active: RowFilter; onChange: (f: RowFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const OPTIONS: { value: RowFilter; label: string }[] = [
        { value: "all",      label: "All" },
        { value: "enabled",  label: "Only enabled" },
        { value: "disabled", label: "Only disabled" },
    ];
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="shrink-0">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
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
                            active === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                        )}>
                        {opt.label}
                    </button>
                ))}
            </FixedDropdown>
        </div>
    );
}

function MultiSelectCard({ title, subtitle, options, selected, onChange }: {
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
    // "Select all" reflects + acts on the rows currently visible under the filter.
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

    // Group rows under their `group` label (ungrouped rows render first).
    const groups = Array.from(new Set(visibleOptions.map(o => o.group ?? "")));

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#6e776f] leading-5 truncate">{subtitle}</p>
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
                        <FilledCheckbox checked={allVisibleSelected} onChange={toggleAll} />
                        <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                        <RowFilterDropdown active={filter} onChange={setFilter} />
                    </div>
                    <div className="h-px bg-[#e4e7ec]" />
                    {groups.map(g => (
                        <div key={g || "_"} className="flex flex-col gap-3">
                            {g && <p className="text-[12px] text-[#667085] leading-[18px]">{g}</p>}
                            {visibleOptions.filter(o => (o.group ?? "") === g).map(o => (
                                <div key={o.id} className="flex items-center gap-2">
                                    <FilledCheckbox checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)} />
                                    <span className="text-[14px] font-medium text-[#101828] flex-1 truncate">{o.label}</span>
                                    {o.sublabel && <span className="text-[14px] text-[#667085] shrink-0">{o.sublabel}</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                    {visibleOptions.length === 0 && (
                        <p className="text-[14px] text-[#667085]">
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

// ─── Branch single-select dropdown (multi-location OFF) ──────────────────────

function BranchSingleSelect({ value, onChange, branches }: {
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
                className="w-full h-10 px-[14px] flex items-center gap-2 border-1 border-[#d0d5dd] rounded-[8px] bg-white text-[16px] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <MarkerPin01 className="w-5 h-5 text-[#667085] shrink-0" />
                <span className={cn("flex-1 text-left truncate", selected ? "text-[#101828]" : "text-[#667085]")}>
                    {selected ? selected.name : "Select location"}
                </span>
                <ChevronDown className="w-5 h-5 text-[#667085] shrink-0" />
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={width || 220}>
                {branches.map(b => (
                    <button key={b.id} type="button"
                        onClick={() => { onChange(b.id); setOpen(false); }}
                        className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            value === b.id ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                        )}>
                        <MarkerPin01 className="w-4 h-4 text-[#667085]" />
                        {b.name}
                    </button>
                ))}
            </FixedDropdown>
        </>
    );
}

// ─── Form data shapes ────────────────────────────────────────────────────────

type PromoAction = "book_class" | "buy_package";
type BookOffer = "free_class" | "free_trial";
type PackageOffer = "percentage" | "fixed_amount";

interface PromoFormData {
    bannerPreview: string;
    name: string;
    description: string;
    /** "" until the merchant picks Book a class / Buy a package — the rest of
     *  step 1 stays hidden while this is empty. */
    action: PromoAction | "";
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    countdown: boolean;
    bookOffer: BookOffer;
    packageOffer: PackageOffer;
    discountValue: string;
    code: string;
    firstTimeOnly: boolean;
    totalLimit: string;
    hasUsageLimit: boolean;
    perCustomerLimit: string;
    /** OFF → single branch dropdown; ON → multi-select branch card. */
    multiLocation: boolean;
    /** Selected branch ids when multi-location is ON. */
    branchIds: string[];
    /** Selected branch id when multi-location is OFF (single-select). */
    singleBranchId: string | null;
    productIds: string[];
    classIds: string[];
    /** "" until the merchant picks a targeting option. */
    customerTargeting: "all" | "new_users" | "";
}

// Banner upload lives in `src/components/ui/ImageBannerUpload.tsx`.

// ─── Shared page component ───────────────────────────────────────────────────

export interface PromoFormPageProps {
    mode: "create" | "edit";
    promoId?: string;
    initial?: Partial<PromoFormData>;
    /** Where the close / list-bound nav should return to. */
    returnTo?: string;
}

export function PromoFormPage({ mode, promoId, initial, returnTo = "/admin/products/promo-codes" }: PromoFormPageProps) {
    const router = useRouter();
    const isEdit = mode === "edit";

    const addPromoCode    = useAppStore(s => s.addPromoCode);
    const updatePromoCode = useAppStore(s => s.updatePromoCode);
    const showToast       = useAppStore(s => s.showToast);
    const memberships     = useAppStore(s => s.memberships);
    const packages        = useAppStore(s => s.packages);
    const classTemplates  = useAppStore(s => s.classTemplates);
    const branches        = useAppStore(s => s.branches);

    const [step, setStep] = useState(1);
    const [form, setForm] = useState<PromoFormData>({
        bannerPreview: initial?.bannerPreview ?? "",
        name: initial?.name ?? "",
        description: initial?.description ?? "",
        action: initial?.action ?? "",
        startDate: initial?.startDate ?? "",
        startTime: initial?.startTime ?? "",
        endDate: initial?.endDate ?? "",
        endTime: initial?.endTime ?? "",
        countdown: initial?.countdown ?? false,
        bookOffer: initial?.bookOffer ?? "free_class",
        packageOffer: initial?.packageOffer ?? "percentage",
        discountValue: initial?.discountValue ?? "",
        code: initial?.code ?? "",
        firstTimeOnly: initial?.firstTimeOnly ?? false,
        totalLimit: initial?.totalLimit ?? "",
        hasUsageLimit: initial?.hasUsageLimit ?? false,
        perCustomerLimit: initial?.perCustomerLimit ?? "",
        multiLocation: initial?.multiLocation ?? false,
        branchIds: initial?.branchIds ?? [],
        singleBranchId: initial?.singleBranchId ?? null,
        productIds: initial?.productIds ?? [],
        classIds: initial?.classIds ?? [],
        customerTargeting: initial?.customerTargeting ?? "",
    });
    const patch = (p: Partial<PromoFormData>) => setForm(prev => ({ ...prev, ...p }));

    function handleClose() {
        router.push(returnTo);
    }

    // Step-1 gate — an action must be picked, then the essentials filled.
    const canContinue =
        form.action !== "" &&
        form.name.trim().length > 0 &&
        form.code.trim().length > 0 &&
        form.discountValue.trim().length > 0 &&
        form.startDate.length > 0 && form.startTime.length > 0 &&
        form.endDate.length > 0 && form.endTime.length > 0;

    // Step-2 gate — a branch and a customer-targeting option must be chosen.
    const branchOk = form.multiLocation
        ? form.branchIds.length > 0
        : !!form.singleBranchId;
    const canCreate = branchOk && form.customerTargeting !== "";

    // ─── Product / class option lists ──────────────────────────────────────
    const productOptions: MultiOption[] = useMemo(() => [
        ...memberships.filter(m => m.status === "active")
            .map(m => ({ id: m.id, label: m.name, group: "Membership" })),
        ...packages.filter(p => p.status === "active")
            .map(p => ({ id: p.id, label: p.name, group: "Class package" })),
    ], [memberships, packages]);

    const classOptions: MultiOption[] = useMemo(() =>
        classTemplates.filter(t => t.status === "Active")
            .map(t => ({ id: t.id, label: t.name, sublabel: t.category })),
        [classTemplates]);

    function handleSubmit() {
        // Collapse date + time into ISO strings for valid_from / valid_until.
        const toIso = (date: string, time: string) =>
            date ? `${date}T${time || "00:00"}:00Z` : undefined;
        const offerType = form.action === "book_class" ? form.bookOffer : form.packageOffer;
        const discountValueNum = Number(form.discountValue) || 0;
        // OFF → the single dropdown choice; ON → the multi-select set.
        const branchIds = form.multiLocation
            ? form.branchIds
            : form.singleBranchId ? [form.singleBranchId] : [];

        // Editable fields — shared by create + edit. `usage_count` / `status`
        // are deliberately excluded so editing never resets a redeemed promo's
        // counter or flips an archived/inactive promo back to Active.
        const fields: Omit<PromoCode, "id" | "usage_count" | "status"> = {
            code: form.code.trim().toUpperCase(),
            // POS-validation fields — percentage/fixed mirrors the offer type.
            discount_type: offerType === "fixed_amount" ? "fixed" : "percentage",
            discount_value: discountValueNum,
            applies_to: [],
            usage_limit: form.firstTimeOnly && form.totalLimit ? Number(form.totalLimit) : undefined,
            valid_until: toIso(form.endDate, form.endTime),
            // Promo-module display + config fields.
            name: form.name.trim(),
            description: form.description.trim() || undefined,
            banner_image_url: form.bannerPreview || undefined,
            action: form.action || undefined,
            offer_type: offerType,
            branch_ids: branchIds,
            multi_location: form.multiLocation,
            valid_from: toIso(form.startDate, form.startTime),
            countdown: form.countdown,
            first_time_only: form.firstTimeOnly,
            per_customer_limit: form.hasUsageLimit && form.perCustomerLimit ? Number(form.perCustomerLimit) : undefined,
            applies_to_product_ids: form.productIds,
            applies_to_class_ids: form.classIds,
            customer_targeting: form.customerTargeting || undefined,
        };

        if (isEdit && promoId) {
            updatePromoCode(promoId, fields);
            showToast("Promotion was updated", `${fields.name} has been saved.`, "success", "check");
            router.push(`/products/promo-codes/${promoId}`);
        } else {
            const newId = addPromoCode({ ...fields, usage_count: 0, status: "active" });
            showToast("New promotion was created", "Your promotion is ready to publish.", "success", "check");
            router.push(`/products/promo-codes/${newId}`);
        }
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                        {isEdit ? "Edit promotion" : "Create new promotion"}
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* 3-column shell — stepper + form + live preview */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map(s => <StepItem key={s.n} step={s} current={step} />)}
                    </div>

                    {step === 1 ? (
                        <FormCard footer={
                            <div className="flex items-center justify-between w-full">
                                <Button variant="secondary-gray" size="md" onClick={handleClose}>Cancel</Button>
                                <Button variant="primary" size="md" disabled={!canContinue} onClick={() => setStep(2)}>
                                    Continue
                                </Button>
                            </div>
                        }>
                            {/* ── Promotion details ── */}
                            <Section title="Promotion details">
                                <ImageBannerUpload
                                    preview={form.bannerPreview || null}
                                    onChange={url => patch({ bannerPreview: url ?? "" })}
                                />
                                <FormField label="Display name">
                                    <TextInput value={form.name} onChange={v => patch({ name: v })}
                                        placeholder="e.g. Weekend Workout Pass" />
                                </FormField>
                                <FormField label="Short description">
                                    <Textarea value={form.description} onChange={v => patch({ description: v })}
                                        placeholder="Describe this promotion..." />
                                </FormField>
                                <FormField label="Link or action">
                                    <div className="flex gap-3">
                                        <ActionCard
                                            icon={<CheckCircleBroken className="w-5 h-5" />}
                                            label="Book a class"
                                            selected={form.action === "book_class"}
                                            onSelect={() => patch({ action: "book_class" })}
                                        />
                                        <ActionCard
                                            icon={<PackageIcon className="w-5 h-5" />}
                                            label="Buy a package"
                                            selected={form.action === "buy_package"}
                                            onSelect={() => patch({ action: "buy_package" })}
                                        />
                                    </div>
                                </FormField>
                            </Section>

                            {/* Duration / configuration / usage limit only
                                surface once an action is picked. */}
                            {form.action !== "" && (<>
                            {/* ── Duration ── */}
                            <Section title="Duration">
                                <div className="flex gap-4 items-start w-full">
                                    <div className="flex-1 min-w-0">
                                        <FormField label="Start date">
                                            <DatePicker value={form.startDate} placeholder="Select date" minDate={todayISO()}
                                                onChange={iso => {
                                                    // End must stay ≥ start — drop a now-invalid end date + time.
                                                    const keepEnd = !(form.endDate && iso && form.endDate < iso);
                                                    // If start moves to today, drop a now-past start time.
                                                    const startTimePast = iso === todayISO()
                                                        && form.startTime !== "" && form.startTime < nowHHMM();
                                                    patch({
                                                        startDate: iso,
                                                        startTime: startTimePast ? "" : form.startTime,
                                                        endDate: keepEnd ? form.endDate : "",
                                                        endTime: keepEnd ? form.endTime : "",
                                                    });
                                                }} />
                                        </FormField>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <FormField label="Start time">
                                            {/* When the start date is today, past slots are barred. */}
                                            <TimeSelect value={form.startTime}
                                                disabledOption={form.startDate === todayISO()
                                                    ? (slot => slot < nowHHMM()) : undefined}
                                                onChange={v => patch({
                                                    startTime: v,
                                                    // Clear a same-day end time that's now in the past.
                                                    endTime: form.startDate !== "" && form.startDate === form.endDate
                                                        && form.endTime !== "" && form.endTime <= v ? "" : form.endTime,
                                                })} />
                                        </FormField>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start w-full">
                                    <div className="flex-1 min-w-0">
                                        <FormField label="End date">
                                            <DatePicker value={form.endDate} placeholder="Select date"
                                                minDate={form.startDate || todayISO()}
                                                onChange={iso => patch({
                                                    endDate: iso,
                                                    // Same-day end can't be at/before the start time.
                                                    endTime: iso === form.startDate && form.startTime !== ""
                                                        && form.endTime !== "" && form.endTime <= form.startTime ? "" : form.endTime,
                                                })} />
                                        </FormField>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <FormField label="End time">
                                            {/* Same-day end time must be strictly after the start time. */}
                                            <TimeSelect value={form.endTime} onChange={v => patch({ endTime: v })}
                                                disabledOption={form.startDate !== "" && form.startDate === form.endDate && form.startTime !== ""
                                                    ? (slot => slot <= form.startTime) : undefined} />
                                        </FormField>
                                    </div>
                                </div>
                                <ToggleCard
                                    title="Countdown"
                                    subtitle="Show the timer to highlight limited-time offers"
                                    on={form.countdown}
                                    onChange={v => patch({ countdown: v })}
                                />
                            </Section>

                            {/* ── Promotion configuration ── */}
                            <Section title="Promotion configuration">
                                {form.action === "buy_package" && (
                                    <div className="bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[10px] p-1 flex gap-1">
                                        {([["percentage", "Percentage off (%)"], ["fixed_amount", "Fixed amount off (AED)"]] as const).map(([v, label]) => (
                                            <button key={v} type="button" onClick={() => patch({ packageOffer: v })}
                                                className={cn(
                                                    "flex-1 h-9 rounded-[6px] text-[14px] font-semibold transition-colors",
                                                    form.packageOffer === v
                                                        ? "bg-white text-[#344054] shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1)]"
                                                        : "text-[#667085]",
                                                )}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                <FormField label="Discount value">
                                    {form.action === "buy_package" ? (
                                        <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] h-10">
                                            {form.packageOffer === "fixed_amount" && (
                                                <div className="flex items-center pl-[14px] text-[16px] font-medium text-[#667085]">AED</div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <NumericStringInput value={form.discountValue} onChange={v => patch({ discountValue: v })}
                                                    min={0} className="!border-0 !shadow-none !rounded-none !ring-0 focus-within:!ring-0 focus-within:!border-0" />
                                            </div>
                                            {form.packageOffer === "percentage" && (
                                                <div className="flex items-center pr-[14px] text-[16px] font-medium text-[#667085]">%</div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] h-10">
                                            <div className="flex-1 min-w-0">
                                                <NumericStringInput value={form.discountValue} onChange={v => patch({ discountValue: v })}
                                                    min={0} className="!border-0 !shadow-none !rounded-none !ring-0 focus-within:!ring-0 focus-within:!border-0" />
                                            </div>
                                            <BookOfferDropdown value={form.bookOffer} onChange={v => patch({ bookOffer: v })} />
                                        </div>
                                    )}
                                </FormField>
                                <FormField label="Promotion"
                                    hint="This is the promotion that the customer will use in the checkout.">
                                    <TextInput value={form.code} onChange={v => patch({ code: v.toUpperCase() })}
                                        placeholder="e.g. WORKOUT10" />
                                </FormField>
                            </Section>

                            {/* ── Usage limit ── */}
                            <Section title="Usage limit">
                                <ToggleCard
                                    title="First-time users only"
                                    subtitle="Only customers who have never purchased before"
                                    on={form.firstTimeOnly}
                                    onChange={v => patch({ firstTimeOnly: v })}
                                >
                                    <FormField label="Number of users">
                                        <NumericStringInput value={form.totalLimit} onChange={v => patch({ totalLimit: v })} min={0} />
                                    </FormField>
                                </ToggleCard>
                                <ToggleCard
                                    title="This promo has usage limit"
                                    subtitle="Turn this on if the promo has a per-customer cap"
                                    on={form.hasUsageLimit}
                                    onChange={v => patch({ hasUsageLimit: v })}
                                >
                                    <FormField label="Usage limit per customer">
                                        <NumericStringInput value={form.perCustomerLimit} onChange={v => patch({ perCustomerLimit: v })} min={0} />
                                    </FormField>
                                </ToggleCard>
                            </Section>
                            </>)}
                        </FormCard>
                    ) : (
                        <FormCard footer={
                            <div className="flex items-center justify-between w-full">
                                <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                                <Button variant="primary" size="md" disabled={!canCreate} onClick={handleSubmit}>
                                    {isEdit ? "Save changes" : "Create promotion"}
                                </Button>
                            </div>
                        }>
                            {/* ── Applicable branch ── */}
                            <Section title="Applicable branch">
                                <ToggleCard
                                    title="Multi-location access"
                                    subtitle="The promo can be use on multiple branches"
                                    on={form.multiLocation}
                                    onChange={v => patch({ multiLocation: v })}
                                />
                                {/* Toggle OFF → single branch dropdown;
                                    ON → multi-select branch card. */}
                                {form.multiLocation ? (
                                    <MultiSelectCard
                                        title="Branches"
                                        subtitle="The promo can be used on these branches"
                                        options={branches.map(b => ({ id: b.id, label: b.name }))}
                                        selected={form.branchIds}
                                        onChange={ids => patch({ branchIds: ids })}
                                    />
                                ) : (
                                    <FormField label="Branch location">
                                        <BranchSingleSelect
                                            value={form.singleBranchId}
                                            onChange={id => patch({ singleBranchId: id })}
                                            branches={branches}
                                        />
                                    </FormField>
                                )}
                            </Section>

                            {/* ── Applies to ── */}
                            <Section title="Applies to">
                                <MultiSelectCard
                                    title="Packages"
                                    subtitle="The promo can be used on these products"
                                    options={productOptions}
                                    selected={form.productIds}
                                    onChange={ids => patch({ productIds: ids })}
                                />
                                <MultiSelectCard
                                    title="Classes"
                                    subtitle="The promo can be used on these classes"
                                    options={classOptions}
                                    selected={form.classIds}
                                    onChange={ids => patch({ classIds: ids })}
                                />
                            </Section>

                            {/* ── Customer ── */}
                            <Section title="Customer">
                                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <p className="text-[14px] text-[#667085]">The promo can be configured to target specific eligible users.</p>
                                    {([["all", "Everyone"], ["new_users", "New user only"]] as const).map(([v, label]) => (
                                        <button key={v} type="button" onClick={() => patch({ customerTargeting: v })}
                                            className="flex items-center gap-2 w-full text-left">
                                            <FilledRadio selected={form.customerTargeting === v} />
                                            <span className="text-[14px] font-medium text-[#344054]">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </Section>
                        </FormCard>
                    )}

                    {/* Right: live promo preview */}
                    <PromoPreviewPanel form={form} branches={branches} />
                </div>
            </div>
        </div>
    );
}

// ─── Promo preview panel (Figma 5881:22420) ──────────────────────────────────
//
// Live right-rail preview — mirrors the promo card on the list page so the
// merchant sees exactly what the saved promo will look like as they fill the
// form. Unfilled fields fall back to muted placeholder copy.

const PREVIEW_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

const PREVIEW_ACTION_LABEL: Record<PromoAction, string> = {
    book_class: "Book a class",
    buy_package: "Buy a package",
};

const PREVIEW_OFFER_LABEL: Record<BookOffer | PackageOffer, string> = {
    free_class: "Free class",
    free_trial: "Free trial",
    percentage: "Percentage off",
    fixed_amount: "Fixed amount",
};

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
            <span className="w-4 h-4 shrink-0 text-[#667085]">{icon}</span>
            <span className={cn("text-[14px] truncate", muted ? "text-[#98a2b3]" : "text-[#667085]")}>
                {label}
            </span>
        </div>
    );
}

function PromoPreviewPanel({ form, branches }: { form: PromoFormData; branches: Branch[] }) {
    const name = form.name.trim();
    const description = form.description.trim();
    const code = form.code.trim();

    const offerType: BookOffer | PackageOffer | null =
        form.action === "book_class" ? form.bookOffer
            : form.action === "buy_package" ? form.packageOffer : null;

    // Branch summary — single branch name, "All branches", or "N branches".
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
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden w-[400px] shrink-0 self-start">
            {/* Header */}
            <div className="pt-6 px-6 pb-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Promotion preview</p>
                <p className="text-[14px] text-[#6e776f] leading-5">This is how your promotion card will look like.</p>
            </div>
            {/* Stage */}
            <div className="bg-[#f6f6f3] px-6 py-10">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col w-[352px] mx-auto">
                    {/* Banner */}
                    <div className="relative h-[144px] flex flex-col justify-between pt-10 pb-3 px-3 shrink-0 bg-gradient-to-br from-[#1d2939] via-[#344054] to-[#475467]">
                        {form.bannerPreview && (
                            <img src={form.bannerPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(12,17,29,0.1)_0%,rgba(12,17,29,0.72)_100%)]" />
                        <div className="absolute top-3 right-3 z-10">
                            <span className="inline-flex items-center px-[10px] py-[2px] rounded-full text-[14px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]">
                                Active
                            </span>
                        </div>
                        <div className="relative z-10 flex flex-col">
                            <p className="text-[20px] font-semibold text-white leading-[30px] break-words">
                                {name || "Promotion name"}
                            </p>
                        </div>
                        <p className="relative z-10 text-[12px] text-[#d0d5dd] leading-[18px]">*T&amp;Cs Apply</p>
                    </div>
                    {/* Content */}
                    <div className="flex flex-col gap-4 px-4 py-5">
                        <div className="flex flex-col gap-1">
                            <p className={cn("text-[18px] font-medium leading-7 truncate", name ? "text-[#101828]" : "text-[#98a2b3]")}>
                                {name || "Promotion name"}
                            </p>
                            <p className={cn("text-[14px] leading-5 line-clamp-2", description ? "text-[#667085]" : "text-[#98a2b3]")}>
                                {description || "Your promotion description will appear here."}
                            </p>
                        </div>
                        {/* Attribute grid — action · offer type · code · branches */}
                        <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                            <PreviewAttr icon={<CursorBox className="w-4 h-4" />}
                                label={form.action ? PREVIEW_ACTION_LABEL[form.action] : "Book a class"}
                                muted={!form.action} />
                            <PreviewAttr icon={<Sale03 className="w-4 h-4" />}
                                label={offerType ? PREVIEW_OFFER_LABEL[offerType] : "Discount type"}
                                muted={!offerType} />
                            <PreviewAttr icon={<Ticket01 className="w-4 h-4" />}
                                label={code || "Promotion"}
                                muted={!code} />
                            <PreviewAttr icon={<MarkerPin01 className="w-4 h-4" />}
                                label={branchLabel ?? "Applicable branch"}
                                muted={!branchLabel} />
                        </div>
                        {/* Dashed divider */}
                        <div className="border-t border-dashed border-[#e4e7ec]" />
                        {/* Valid until */}
                        <div className="flex items-center gap-1 text-[14px]">
                            <span className="text-[#667085]">Valid until</span>
                            <span className={cn("font-medium", form.endDate ? "text-[#101828]" : "text-[#98a2b3]")}>
                                {formatPreviewDate(form.endDate, form.endTime)}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Book-a-class offer dropdown (free class / free trial) ───────────────────

function BookOfferDropdown({ value, onChange }: { value: BookOffer; onChange: (v: BookOffer) => void }) {
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);
    const OPTIONS: { value: BookOffer; label: string }[] = [
        { value: "free_class", label: "free class" },
        { value: "free_trial", label: "free trial" },
    ];
    const selected = OPTIONS.find(o => o.value === value);
    return (
        <div className="shrink-0 border-l-1 border-[#d0d5dd]">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="h-full px-[14px] flex items-center text-[16px] text-[#344054]">
                {selected?.label ?? "free class"}
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={140}>
                {OPTIONS.map(o => (
                    <button key={o.value} type="button"
                        onClick={() => { onChange(o.value); setOpen(false); }}
                        className={cn(
                            "flex w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            value === o.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                        )}>
                        {o.label}
                    </button>
                ))}
            </FixedDropdown>
        </div>
    );
}
