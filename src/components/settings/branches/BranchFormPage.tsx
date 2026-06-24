"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Add / Edit branch
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4098:201851 — full-page modal shell with single "Branch details"
// step, center form, and right-side "Branch preview" card.
//
// One component drives both create and edit — `mode` switches the page
// title, the primary CTA copy, the success-toast message, and (for edit)
// prefills every field from the seed branch.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, MarkerPin01, Clock, UploadCloud02, Building01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore } from "@/lib/store";
import type { BusinessHours } from "@/data/mock/_types";
import {
    PhoneCountryDropdown, splitPhone,
    type PhoneCountry,
} from "@/components/customers/CustomerFormPage";
import {
    FormHeader, StepSidebar, SectionHeader, Field, TextInput, Textarea,
    LogoPreview,
} from "@/components/settings/business/StudioProfileFormPage";
import { COUNTRIES, CITIES_BY_COUNTRY } from "@/lib/data/locales";

const RETURN_ROUTE = "/admin/settings";

const DAYS = [
    { dow: 1 as const, key: "mon", label: "Monday" },
    { dow: 2 as const, key: "tue", label: "Tuesday" },
    { dow: 3 as const, key: "wed", label: "Wednesday" },
    { dow: 4 as const, key: "thu", label: "Thursday" },
    { dow: 5 as const, key: "fri", label: "Friday" },
    { dow: 6 as const, key: "sat", label: "Saturday" },
    { dow: 0 as const, key: "sun", label: "Sunday" },
];

interface WorkingHourState {
    dow: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    open: string;
    close: string;
    closed: boolean;
}

function dowKey(dow: number): string {
    return ["sun","mon","tue","wed","thu","fri","sat"][dow] ?? "sun";
}

function defaultWorkingHours(): WorkingHourState[] {
    return DAYS.map(d => ({
        dow: d.dow,
        open: "07:00",
        close: "22:00",
        closed: d.dow === 0,  // Sunday closed by default
    }));
}

function workingHoursFromLive(branchId: string, live: BusinessHours[]): WorkingHourState[] {
    const rows = live.filter(r => r.branch_id === branchId);
    if (rows.length === 0) return defaultWorkingHours();
    return DAYS.map(d => {
        const row = rows.find(r => r.day_of_week === d.dow);
        return {
            dow: d.dow,
            open:   row?.open_time  ?? "07:00",
            close:  row?.close_time ?? "22:00",
            closed: row?.is_closed  ?? false,
        };
    });
}

export function BranchFormPage({ mode, branchId }: {
    mode: "create" | "edit";
    branchId?: string;
}) {
    const router = useRouter();
    const showToast = useAppStore(s => s.showToast);
    const branches = useAppStore(s => s.branches);
    const liveHours = useAppStore(s => s.businessHours);
    const addBranchStore = useAppStore(s => s.addBranch);
    const updateBranchStore = useAppStore(s => s.updateBranch);
    const setBranchHoursStore = useAppStore(s => s.setBranchHours);

    const existing = mode === "edit" && branchId
        ? branches.find(b => b.id === branchId)
        : undefined;
    const initialPhone = splitPhone(existing?.phone);

    const [logoDataUrl, setLogoDataUrl] = useState<string>(existing?.image_url ?? "");
    const [name,        setName]        = useState<string>(existing?.name ?? "");
    const [email,       setEmail]       = useState<string>(existing?.email ?? "");
    const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(initialPhone.country);
    const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone.number);
    const [address,     setAddress]     = useState<string>(existing?.address ?? "");
    const [country,     setCountry]     = useState<string>(existing?.country ?? "United Arab Emirates");
    const [city,        setCity]        = useState<string>(existing?.city ?? "");
    // Cities cascade from the chosen country. When country changes and the
    // current city isn't in the new country's list, we clear it.
    const cityOptions = useMemo(() => {
        const code = COUNTRIES.find(c => c.name === country)?.code;
        return code ? (CITIES_BY_COUNTRY[code] ?? []) : [];
    }, [country]);
    const [workingHours, setWorkingHours] = useState<WorkingHourState[]>(
        existing ? workingHoursFromLive(existing.id, liveHours) : defaultWorkingHours(),
    );

    const fileRef = useRef<HTMLInputElement>(null);

    const canSubmit = name.trim().length > 0 && address.trim().length > 0;

    function handleClose() { router.push(RETURN_ROUTE); }
    function handleUploadClick() { fileRef.current?.click(); }
    function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setLogoDataUrl(String(reader.result || ""));
        reader.readAsDataURL(file);
    }
    function handleSubmit() {
        if (!canSubmit) return;
        const fullPhone = phoneNumber.trim()
            ? `${phoneCountry.dial} ${phoneNumber.trim()}`
            : "";
        const patch = {
            name: name.trim(),
            email: email.trim(),
            phone: fullPhone,
            address: address.trim(),
            city: city.trim() || undefined,
            country,
            image_url: logoDataUrl,
        };
        const newBranchId = mode === "create"
            ? `branch_new_${Date.now()}`
            : existing!.id;
        if (mode === "create") {
            addBranchStore({
                id: newBranchId,
                status: "active",
                is_main: false,
                ...patch,
            });
        } else if (existing) {
            updateBranchStore(existing.id, patch);
        }
        // Persist working hours alongside the branch — `setBranchHours`
        // replaces all 7 rows for this branch in one shot so the landing
        // page strip, the branch detail page metadata, and the schedule
        // module's time-axis all see the new values on the next render.
        const hoursPayload: BusinessHours[] = workingHours.map(h => ({
            id: `bh_${newBranchId.replace(/^branch_/, "")}_${dowKey(h.dow)}`,
            branch_id: newBranchId,
            day_of_week: h.dow,
            open_time: h.open,
            close_time: h.close,
            is_closed: h.closed,
        }));
        setBranchHoursStore(newBranchId, hoursPayload);
        showToast(
            mode === "create" ? "Branch added"   : "Branch updated",
            mode === "create"
                ? `${name.trim()} has been added to your locations.`
                : `${name.trim()} has been saved.`,
            "success", "check",
        );
        router.push(RETURN_ROUTE);
    }

    function updateHour(dow: number, patch: Partial<WorkingHourState>) {
        setWorkingHours(prev => prev.map(h => h.dow === dow ? { ...h, ...patch } : h));
    }

    const pageTitle = mode === "create" ? "Add new branch" : `Edit ${existing?.name ?? "branch"}`;
    const submitLabel = mode === "create" ? "Add branch" : "Save changes";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <FormHeader title={pageTitle} onClose={handleClose} />

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">
                    <StepSidebar steps={[{ n: 1, label: "Branch details" }]} current={1} />

                    {/* Center form card */}
                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-1 -mx-1 min-h-0">
                                <SectionHeader title="Branch details" />

                                <div className="flex items-center gap-4 w-full">
                                    <LogoPreview src={logoDataUrl} size={96} />
                                    <input ref={fileRef} type="file" accept="image/*" onChange={handleFilePicked} className="hidden" />
                                    <Button variant="secondary-gray" size="md" leftIcon={<UploadCloud02 className="w-5 h-5" />} onClick={handleUploadClick}>
                                        Upload image
                                    </Button>
                                </div>

                                <Field label="Branch name">
                                    <TextInput value={name} onChange={setName} placeholder="Enter branch name" />
                                </Field>

                                <Field label="Email">
                                    <TextInput value={email} onChange={setEmail} placeholder="Enter email" type="email" />
                                </Field>

                                <Field label="Phone number">
                                    <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <PhoneCountryDropdown value={phoneCountry} onChange={setPhoneCountry} />
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                                            placeholder="Enter phone number"
                                            className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent min-w-0 rounded-r-[8px]"
                                        />
                                    </div>
                                </Field>

                                <SectionHeader title="Location details" small />

                                <Field label="Address">
                                    <Textarea value={address} onChange={setAddress} placeholder="Enter branch address..." rows={3} />
                                </Field>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Country">
                                        <SelectInput
                                            value={country}
                                            onChange={(next) => {
                                                setCountry(next);
                                                // Clear city if it's no longer valid for the new country.
                                                const code = COUNTRIES.find(c => c.name === next)?.code;
                                                const nextCities = code ? (CITIES_BY_COUNTRY[code] ?? []) : [];
                                                if (!nextCities.includes(city)) setCity("");
                                            }}
                                            placeholder="Select country"
                                            options={COUNTRIES.map(c => ({
                                                value: c.name,
                                                label: `${c.flag}  ${c.name}`,
                                            }))}
                                            width="w-full"
                                        />
                                    </Field>
                                    <Field label="City">
                                        <SelectInput
                                            value={cityOptions.includes(city) ? city : ""}
                                            onChange={setCity}
                                            placeholder={cityOptions.length === 0 ? "Pick a country first" : "Select city"}
                                            options={cityOptions.map(c => ({ value: c, label: c }))}
                                            width="w-full"
                                        />
                                    </Field>
                                </div>

                                <SectionHeader title="Working hours" small />

                                {/* Per-day rows. Single row: Day name | open toggle | open time | close time.
                                    The break-time / "lunch block" concept was removed — branches now have
                                    a single open/close window per day. Staff-level blocked-time entries
                                    (sick, training, off-day) are managed in the Blocked time module instead. */}
                                <div className="flex flex-col gap-3">
                                    {DAYS.map(d => {
                                        const h = workingHours.find(w => w.dow === d.dow)!;
                                        return (
                                            <div key={d.key} className="grid grid-cols-[120px_60px_1fr_1fr] gap-3 items-center w-full">
                                                <span className="text-[14px] font-medium text-[#344054]">{d.label}</span>
                                                <Toggle
                                                    on={!h.closed}
                                                    onChange={() => updateHour(d.dow, { closed: !h.closed })}
                                                    ariaLabel={`Open ${d.label}`}
                                                />
                                                <TimeInput
                                                    value={h.open}
                                                    onChange={(v) => updateHour(d.dow, { open: v })}
                                                    disabled={h.closed}
                                                />
                                                <TimeInput
                                                    value={h.close}
                                                    onChange={(v) => updateHour(d.dow, { close: v })}
                                                    disabled={h.closed}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="shrink-0 flex items-center justify-end w-full">
                                <Button variant="primary" size="md" disabled={!canSubmit} onClick={handleSubmit}>
                                    {submitLabel}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right preview — Figma 4098:222079. Fixed viewport
                        height (matches the form card) so the page never
                        re-flows as the admin types — only the inner
                        preview area scrolls when working-hours fill up. */}
                    <div className="w-[360px] shrink-0 flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex-1 flex flex-col overflow-hidden min-h-0">
                            <div className="flex flex-col gap-1 px-6 pt-6 pb-5 shrink-0">
                                <p className="text-[18px] font-semibold text-[#101828] leading-7">Branch preview</p>
                                <p className="text-[14px] text-[#6e776f] leading-5">This is how branch overview will look like.</p>
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                            <div className="bg-[#f6f6f3] p-6 flex-1 min-h-0 overflow-y-auto flex items-start justify-center">
                                <div className="w-full bg-white border-1 border-[#e4e7ec] rounded-[20px] p-5 flex flex-col gap-4">
                                    {/* Avatar — uploaded image OR Building icon fallback */}
                                    {logoDataUrl ? (
                                        <LogoPreview src={logoDataUrl} size={96} />
                                    ) : (
                                        <div
                                            className="relative w-24 h-24 rounded-full bg-[#f2f4f7] border-4 border-white shrink-0 flex items-center justify-center"
                                            style={{ boxShadow: "0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)" }}
                                        >
                                            <Building01 className="w-10 h-10 text-[#475467]" />
                                            <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none" />
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <p className="text-[20px] font-semibold text-[#101828] leading-[30px]">
                                            {name || "Branch name"}
                                        </p>
                                        <p className="text-[14px] text-[#667085] leading-5">{email || "Email address"}</p>
                                    </div>
                                    <div className="flex flex-col gap-3">
                                        <PreviewLine icon={<Phone className="w-4 h-4 text-[#667085]" />}       text={phoneNumber ? `${phoneCountry.dial} ${phoneNumber}` : "Phone number"} />
                                        <PreviewLine icon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />} text={fullAddress(address, city, country) || "Address"} />
                                        <WorkingHoursPreview hours={workingHours} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function PreviewLine({ icon, text }: { icon: React.ReactNode; text: string }) {
    return (
        <div className="flex items-center gap-2">
            {icon}
            <p className="text-[14px] text-[#475467] leading-5 truncate">{text}</p>
        </div>
    );
}

function fullAddress(street: string, city: string, country: string): string {
    return [street, city, country].filter(s => s.trim().length > 0).join(", ");
}

const DAY_LABELS_SHORT: Record<number, string> = {
    1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun",
};
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

/** Working-hours list (Figma 4098:222079) — clock icon header, then a
 *  per-day list of "Mon (07:00 AM – 08:00 PM)" rows for every open day.
 *  Closed days are simply not rendered. */
function WorkingHoursPreview({ hours }: { hours: WorkingHourState[] }) {
    const openDays = DAY_ORDER.filter(dow => {
        const h = hours.find(w => w.dow === dow);
        return h && !h.closed;
    });
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-[#667085]" />
                <p className="text-[14px] text-[#667085] leading-5">Working hours</p>
            </div>
            <div className="flex flex-col gap-1 pl-5">
                {openDays.length === 0 ? (
                    <p className="text-[14px] text-[#667085] leading-5">—</p>
                ) : openDays.map(dow => {
                    const h = hours.find(w => w.dow === dow)!;
                    return (
                        <div key={dow} className="flex items-center gap-3">
                            <p className="text-[14px] font-medium text-[#667085] w-[40px]">{DAY_LABELS_SHORT[dow]}</p>
                            <p className="text-[14px] text-[#667085] leading-5">
                                ({to12hLabel(h.open)} – {to12hLabel(h.close)})
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function to12hLabel(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hr = ((h + 11) % 12) + 1;
    return `${String(hr).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

function TimeInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
    return (
        <input
            type="time"
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
                "h-10 w-full px-[12px] border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white",
                disabled && "bg-[#f9fafb] text-[#98a2b3] cursor-not-allowed",
            )}
        />
    );
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
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

