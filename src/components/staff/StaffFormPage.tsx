"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Staff form (Add new staff / Edit staff details)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by 2 routes (root-level full-page):
//   • /staff/members/new           → mode = "create"
//   • /staff/members/[id]/edit     → mode = "edit"
//
// Figma:
//   • 6236-395236 — Add new staff
//
// Single-step form with image upload, name pair, email, temp password,
// phone (country-code picker reused from CustomerFormPage), role dropdown
// (create only — edit mode hides it because the dedicated Change role modal
// owns role mutation), default pay rate dropdown.
// On create, status is forced to "pending" + inviteSentAt stamped.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    XClose, User01, Upload01, MarkerPin01, Lightbulb02,
    Mail01, Phone, UserSquare, CoinsHand, Calendar,
    Check, ChevronDown, SearchMd,
} from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import {
    useAppStore, BRANCHES,
    type Staff, type StaffStatus,
} from "@/lib/store";

// ─── Form value ────────────────────────────────────────────────────────────

interface FormValue {
    firstName: string;
    lastName: string;
    email: string;
    tempPassword: string;
    phone: string;                              // bare national number (digits only)
    phoneCountry: PhoneCountry;
    imageUrl?: string;
    roleId: string;
    payRateId: string;
}

function emptyForm(): FormValue {
    return {
        firstName: "", lastName: "", email: "", tempPassword: "",
        phone: "", phoneCountry: PHONE_COUNTRIES[0],
        imageUrl: undefined,
        roleId: "", payRateId: "",
    };
}

function formFromStaff(s: Staff): FormValue {
    const split = splitPhone(s.phone);
    return {
        firstName: s.firstName,
        lastName: s.lastName,
        email: s.email,
        tempPassword: s.tempPassword ?? "",
        phone: split.number,
        phoneCountry: split.country,
        imageUrl: s.imageUrl,
        roleId: s.roleId,
        payRateId: s.payRateId ?? "",
    };
}

// ─── Phone helpers (reused pattern from CustomerFormPage) ──────────────────

type PhoneCountry = { code: string; dial: string; name: string; flag: string };

const PHONE_COUNTRIES: PhoneCountry[] = [
    { code: "AE", dial: "+971", name: "United Arab Emirates", flag: "🇦🇪" },
    { code: "SA", dial: "+966", name: "Saudi Arabia",          flag: "🇸🇦" },
    { code: "QA", dial: "+974", name: "Qatar",                  flag: "🇶🇦" },
    { code: "KW", dial: "+965", name: "Kuwait",                 flag: "🇰🇼" },
    { code: "OM", dial: "+968", name: "Oman",                   flag: "🇴🇲" },
    { code: "BH", dial: "+973", name: "Bahrain",                flag: "🇧🇭" },
    { code: "EG", dial: "+20",  name: "Egypt",                  flag: "🇪🇬" },
    { code: "JO", dial: "+962", name: "Jordan",                 flag: "🇯🇴" },
    { code: "LB", dial: "+961", name: "Lebanon",                flag: "🇱🇧" },
    { code: "US", dial: "+1",   name: "United States",          flag: "🇺🇸" },
    { code: "CA", dial: "+1",   name: "Canada",                 flag: "🇨🇦" },
    { code: "GB", dial: "+44",  name: "United Kingdom",         flag: "🇬🇧" },
    { code: "DE", dial: "+49",  name: "Germany",                flag: "🇩🇪" },
    { code: "FR", dial: "+33",  name: "France",                 flag: "🇫🇷" },
    { code: "ES", dial: "+34",  name: "Spain",                  flag: "🇪🇸" },
    { code: "IT", dial: "+39",  name: "Italy",                  flag: "🇮🇹" },
    { code: "NL", dial: "+31",  name: "Netherlands",            flag: "🇳🇱" },
    { code: "AU", dial: "+61",  name: "Australia",              flag: "🇦🇺" },
    { code: "NZ", dial: "+64",  name: "New Zealand",            flag: "🇳🇿" },
    { code: "IN", dial: "+91",  name: "India",                  flag: "🇮🇳" },
    { code: "PK", dial: "+92",  name: "Pakistan",               flag: "🇵🇰" },
    { code: "BD", dial: "+880", name: "Bangladesh",             flag: "🇧🇩" },
    { code: "ID", dial: "+62",  name: "Indonesia",              flag: "🇮🇩" },
    { code: "MY", dial: "+60",  name: "Malaysia",               flag: "🇲🇾" },
    { code: "SG", dial: "+65",  name: "Singapore",              flag: "🇸🇬" },
    { code: "PH", dial: "+63",  name: "Philippines",            flag: "🇵🇭" },
    { code: "TH", dial: "+66",  name: "Thailand",               flag: "🇹🇭" },
    { code: "VN", dial: "+84",  name: "Vietnam",                flag: "🇻🇳" },
    { code: "JP", dial: "+81",  name: "Japan",                  flag: "🇯🇵" },
    { code: "KR", dial: "+82",  name: "South Korea",            flag: "🇰🇷" },
    { code: "CN", dial: "+86",  name: "China",                  flag: "🇨🇳" },
    { code: "HK", dial: "+852", name: "Hong Kong",              flag: "🇭🇰" },
    { code: "TW", dial: "+886", name: "Taiwan",                 flag: "🇹🇼" },
    { code: "ZA", dial: "+27",  name: "South Africa",           flag: "🇿🇦" },
    { code: "NG", dial: "+234", name: "Nigeria",                flag: "🇳🇬" },
    { code: "KE", dial: "+254", name: "Kenya",                  flag: "🇰🇪" },
    { code: "TR", dial: "+90",  name: "Turkey",                 flag: "🇹🇷" },
    { code: "MX", dial: "+52",  name: "Mexico",                 flag: "🇲🇽" },
    { code: "BR", dial: "+55",  name: "Brazil",                 flag: "🇧🇷" },
];

function splitPhone(stored?: string): { country: PhoneCountry; number: string } {
    if (!stored) return { country: PHONE_COUNTRIES[0], number: "" };
    const byLongestDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const match = byLongestDial.find(c => stored.startsWith(c.dial));
    if (!match) return { country: PHONE_COUNTRIES[0], number: stored.replace(/\D/g, "") };
    return { country: match, number: stored.slice(match.dial.length).replace(/\D/g, "") };
}

function PhoneCountryDropdown({ value, onChange }: { value: PhoneCountry; onChange: (c: PhoneCountry) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const filtered = !search ? PHONE_COUNTRIES : PHONE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
        || c.dial.includes(search)
        || c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <button type="button" onClick={() => setOpen(p => !p)}
                className="h-10 flex items-center gap-1.5 px-[14px] border-r border-[#d0d5dd] text-[16px] text-[#101828] hover:bg-[#f9fafb] transition-colors">
                <span className="text-[16px]">{value.flag}</span>
                {value.dial}
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute top-[calc(100%+4px)] left-0 z-50 w-[280px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] overflow-hidden flex flex-col max-h-[320px]">
                    <div className="p-2 border-b border-[#e4e7ec]">
                        <div className="relative">
                            <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Search country or code"
                                className="w-full h-9 pl-9 pr-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd]" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto py-1">
                        {filtered.map(c => (
                            <button key={c.code} type="button"
                                onClick={() => { onChange(c); setOpen(false); setSearch(""); }}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#f9fafb] text-left">
                                <span className="text-[16px]">{c.flag}</span>
                                <span className="flex-1 text-[14px] text-[#344054] truncate">{c.name}</span>
                                <span className="text-[13px] text-[#667085]">{c.dial}</span>
                                {c.code === value.code && <Check className="w-4 h-4 text-[#658774]" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Initials helper ───────────────────────────────────────────────────────

function initialsOf(first: string, last: string): string {
    const a = first.trim().charAt(0).toUpperCase();
    const b = last.trim().charAt(0).toUpperCase();
    return (a + b) || "?";
}

// All staff avatars render with the same neutral chrome — matching the role
// avatar (gray-100 bg + dark initials). Tied to the same `#f2f4f7` token
// consumers store in the `color` field so list rendering stays consistent.
const NEUTRAL_AVATAR_BG = "#f2f4f7";

// ─── Form atoms ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] font-medium text-[#344054] leading-[20px]">{children}</p>;
}

function TextInput({ value, onChange, placeholder, type = "text" }: {
    value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
    return (
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
        />
    );
}

// ─── Image upload ──────────────────────────────────────────────────────────

function ImageUpload({ value, initials, onChange }: {
    value?: string; initials: string; onChange: (url?: string) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);
    function pick() { ref.current?.click(); }
    function onFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const url = URL.createObjectURL(file);
        onChange(url);
    }
    return (
        <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden flex items-center justify-center shrink-0 border-1 border-[#e4e7ec]"
                style={{ backgroundColor: NEUTRAL_AVATAR_BG }}>
                {value
                    ? <img src={value} alt="" className="w-full h-full object-cover" />
                    : initials === "?"
                        ? <User01 className="w-10 h-10 text-[#475467]" />
                        : <span className="font-semibold text-[24px] text-[#475467]">{initials}</span>
                }
            </div>
            <Button variant="secondary-gray" size="md"
                leftIcon={<Upload01 className="w-4 h-4" />}
                onClick={pick}>
                Upload image
            </Button>
            <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
        </div>
    );
}

// ─── Preview card (right rail) — Figma 6236-395270 ─────────────────────────
//
// Avatar top-left (NOT centered), name + email below, then a left-aligned
// list of metadata rows with icons. Phone-bullets render the temp password
// as masked dots — never the plain text.

function StaffPreview({ form, roleName, payRateName, branchLabel, joinedLabel }: {
    form: FormValue; roleName: string; payRateName: string; branchLabel: string; joinedLabel: string;
}) {
    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
    const initials = initialsOf(form.firstName, form.lastName);
    const passwordMask = form.tempPassword ? "•".repeat(Math.min(12, form.tempPassword.length)) : "";
    const phoneDisplay = form.phone.trim() ? `${form.phoneCountry.dial} ${form.phone.trim()}` : "Phone number";
    return (
        <div className="w-[400px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shrink-0">
            <div className="p-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">User preview</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">This is how user overview will look like.</p>
            </div>
            <div className="bg-[#f6f6f3] flex flex-col gap-5 p-6 w-full">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4">
                    {/* Avatar top-left — same chrome as the role preview. */}
                    <div className="w-[80px] h-[80px] rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0 overflow-hidden">
                        {form.imageUrl
                            ? <img src={form.imageUrl} alt="" className="w-full h-full object-cover" />
                            : initials === "?"
                                ? <User01 className="w-9 h-9 text-[#475467]" />
                                : <span className="font-semibold text-[28px] text-[#475467]">{initials}</span>
                        }
                    </div>

                    <div className="flex flex-col gap-1">
                        <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                            {fullName || "User name"}
                        </p>
                        <p className="text-[14px] text-[#667085]">{form.email.trim() || "User email"}</p>
                    </div>

                    <div className="flex flex-col gap-2.5 text-[14px] text-[#667085]">
                        <div className="flex items-center gap-2"><Calendar className="w-4 h-4 shrink-0" />{joinedLabel || "Joined date"}</div>
                        <div className="flex items-center gap-2"><Mail01 className="w-4 h-4 shrink-0" />{form.email.trim() || "Email"}</div>
                        <div className="flex items-center gap-2">
                            <span className="w-4 h-4 shrink-0 inline-flex items-center justify-center text-[#667085]">
                                {/* Use a key icon to indicate the temp password row. */}
                                <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4"><path d="M10.5 6.5a2.5 2.5 0 1 0-3.999 2.001L3 12v1h1v1h1v1h2v-1.5L9.499 11.5A2.5 2.5 0 0 0 10.5 6.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                            </span>
                            <span className="font-mono tracking-wider">{passwordMask || "Temporary password"}</span>
                        </div>
                        <div className="flex items-center gap-2"><Phone className="w-4 h-4 shrink-0" />{phoneDisplay}</div>
                        <div className="flex items-center gap-2"><MarkerPin01 className="w-4 h-4 shrink-0" />{branchLabel}</div>
                        <div className="flex items-center gap-2"><UserSquare className="w-4 h-4 shrink-0" />{roleName || "User role"}</div>
                        <div className="flex items-center gap-2"><CoinsHand className="w-4 h-4 shrink-0" />{payRateName || "Default pay rate"}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Validation ────────────────────────────────────────────────────────────

function isFormValid(form: FormValue): boolean {
    return !!form.firstName.trim()
        && !!form.lastName.trim()
        && !!form.email.trim()
        && /^\S+@\S+\.\S+$/.test(form.email.trim())
        && !!form.tempPassword.trim()
        && !!form.phone.trim()
        && !!form.roleId;
    // payRateId is required only when role.type === "instructor" — handled
    // dynamically at submit time below.
}

// ─── Top-level component ───────────────────────────────────────────────────

export interface StaffFormPageProps {
    mode: "create" | "edit";
    staffId?: string;
    returnTo?: string;
}

export default function StaffFormPage({ mode, staffId, returnTo = "/admin/staff" }: StaffFormPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const prefilledRoleId = searchParams.get("roleId") ?? "";

    const allRoles    = useAppStore(s => s.roles);
    const allStaff    = useAppStore(s => s.staff);
    const allPayRates = useAppStore(s => s.payRates);
    const addStaff    = useAppStore(s => s.addStaff);
    const updateStaff = useAppStore(s => s.updateStaff);
    const showToast   = useAppStore(s => s.showToast);

    const existing = mode === "edit" && staffId ? allStaff.find(s => s.id === staffId) : undefined;

    const [form, setForm] = useState<FormValue>(() => {
        if (existing) return formFromStaff(existing);
        const empty = emptyForm();
        if (prefilledRoleId) empty.roleId = prefilledRoleId;
        return empty;
    });
    const [hydrated, setHydrated] = useState(!!existing);

    useEffect(() => {
        if (mode === "edit" && existing && !hydrated) {
            setForm(formFromStaff(existing));
            setHydrated(true);
        }
    }, [mode, existing, hydrated]);

    useEffect(() => {
        if (mode === "edit" && staffId && allStaff.length > 0 && !existing) {
            showToast("Staff not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [mode, staffId, allStaff, existing, router, returnTo, showToast]);

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }

    // Options: only active roles for assignment.
    const roleOptions = useMemo(
        () => allRoles
            .filter(r => r.status === "active")
            .map(r => ({ value: r.id, label: r.name })),
        [allRoles],
    );
    const payRateOptions = useMemo(
        () => allPayRates
            .filter(p => p.status === "active")
            .map(p => ({ value: p.id, label: p.name })),
        [allPayRates],
    );

    // Resolve selected role + pay rate for the preview + the instructor branch.
    const selectedRole    = allRoles.find(r => r.id === form.roleId);
    const selectedPayRate = allPayRates.find(p => p.id === form.payRateId);
    const isInstructor    = selectedRole?.type === "instructor";

    const branchLabel = selectedRole?.branchId === null
        ? "All locations"
        : selectedRole
            ? BRANCHES.find(b => b.id === selectedRole.branchId)?.name ?? "—"
            : "Branch location";

    function handleSave() {
        if (!isFormValid(form)) return;
        if (isInstructor && !form.payRateId) {
            showToast("Pay rate required", "Instructors must be assigned a default pay rate.", "error");
            return;
        }
        if (!selectedRole) return;

        const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
        const initials = initialsOf(form.firstName, form.lastName);
        const phoneStored = `${form.phoneCountry.dial} ${form.phone.trim()}`;

        if (mode === "create") {
            // Format "Mar 14, 2026" — match existing seed convention.
            const now = new Date();
            const joinedDate = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
            addStaff({
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                fullName,
                email: form.email.trim().toLowerCase(),
                phone: phoneStored,
                imageUrl: form.imageUrl,
                initials,
                color: NEUTRAL_AVATAR_BG,
                roleId: form.roleId,
                branchId: selectedRole.branchId,
                status: "pending" as StaffStatus,
                tempPassword: form.tempPassword,
                payRateId: form.payRateId || undefined,
                joinedDate,
            });
            showToast("Invitation sent", `Invite sent to ${form.email.trim().toLowerCase()}.`, "success", "check");
            router.push(returnTo);
            return;
        }
        if (!staffId || !existing) return;
        // Edit mode does NOT mutate role — the dedicated Change role modal
        // owns that path. We also don't overwrite the existing color so we
        // don't blast historical seeds even though all new rows use the
        // neutral token.
        updateStaff(staffId, {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            fullName,
            email: form.email.trim().toLowerCase(),
            phone: phoneStored,
            imageUrl: form.imageUrl,
            initials,
            payRateId: form.payRateId || undefined,
        });
        showToast("Staff updated", `${fullName} details saved.`, "success", "check");
        router.push(returnTo);
    }

    const formValid = isFormValid(form) && (!isInstructor || !!form.payRateId);

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    {mode === "create" ? "Add new staff" : "Edit staff"}
                </h1>
            </div>

            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-8 items-start overflow-hidden">
                {/* Left progress (single step) */}
                <div className="w-[260px] shrink-0">
                    <div className="flex items-center gap-4 h-[52px] p-4 rounded-[12px] bg-[#f5fffa]">
                        <div className="w-6 h-6 rounded-full bg-[#658774] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#7ba08c] flex items-center justify-center text-[14px] font-medium">1</div>
                        <p className="flex-1 text-[14px] font-semibold text-[#3b5446] leading-[20px]">Staff details</p>
                    </div>
                </div>

                {/* Center card */}
                <div className="flex-1 min-w-0 max-w-[680px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
                        <div className="flex flex-col gap-5 w-full">
                            <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Staff details</p>

                            <ImageUpload
                                value={form.imageUrl}
                                initials={initialsOf(form.firstName, form.lastName)}
                                onChange={url => set({ imageUrl: url })}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel>First name</FieldLabel>
                                    <TextInput value={form.firstName} onChange={v => set({ firstName: v })} placeholder="Enter first name" />
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel>Last name</FieldLabel>
                                    <TextInput value={form.lastName} onChange={v => set({ lastName: v })} placeholder="Enter last name" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel>Email</FieldLabel>
                                    <TextInput value={form.email} onChange={v => set({ email: v })} placeholder="Enter email" type="email" />
                                </div>
                                <div className="flex flex-col gap-[6px]">
                                    <FieldLabel>Temporary password</FieldLabel>
                                    <TextInput value={form.tempPassword} onChange={v => set({ tempPassword: v })} placeholder="Enter temporary password" />
                                </div>
                            </div>

                            <div className="flex flex-col gap-[6px]">
                                <FieldLabel>Phone number</FieldLabel>
                                <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <PhoneCountryDropdown
                                        value={form.phoneCountry}
                                        onChange={c => set({ phoneCountry: c })}
                                    />
                                    <input
                                        type="tel"
                                        inputMode="numeric"
                                        value={form.phone}
                                        onChange={e => set({ phone: e.target.value.replace(/\D/g, "") })}
                                        placeholder="Phone number..."
                                        className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent rounded-r-[8px]"
                                    />
                                </div>
                            </div>

                            {/* Role selection — CREATE mode only. Edit mode hides
                                this field because the dedicated "Change role"
                                modal owns role mutation (Figma 6247-223715). */}
                            {mode === "create" && (
                                <>
                                    <div className="flex flex-col gap-[6px]">
                                        <FieldLabel>Select role</FieldLabel>
                                        <SelectInput
                                            placeholder="Select role"
                                            options={roleOptions}
                                            value={form.roleId}
                                            onChange={v => set({ roleId: v })}
                                            width="w-full"
                                        />
                                    </div>

                                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                                        <p className="text-[14px] text-[#475467] leading-[20px]">
                                            This staff will inherit all permissions from the selected role and locations.
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* Default pay rate — always visible per Figma 6236-395249.
                                For non-instructor roles it stays optional (the
                                field can be left empty); instructors get a
                                validation gate at submit time. */}
                            <div className="flex flex-col gap-[6px]">
                                <FieldLabel>Default pay rate</FieldLabel>
                                <SelectInput
                                    placeholder="Select default pay rate"
                                    options={payRateOptions}
                                    value={form.payRateId}
                                    onChange={v => set({ payRateId: v })}
                                    width="w-full"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 px-6 py-4 flex items-center justify-end gap-3">
                        <Button variant="primary" size="md" disabled={!formValid} onClick={handleSave}>
                            {mode === "create" ? "Add staff" : "Save changes"}
                        </Button>
                    </div>
                </div>

                {/* Right preview */}
                <StaffPreview
                    form={form}
                    roleName={selectedRole?.name ?? ""}
                    payRateName={selectedPayRate?.name ?? ""}
                    branchLabel={branchLabel}
                    joinedLabel={existing?.joinedDate ?? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                />
            </div>

            <Toast />
        </div>
    );
}
