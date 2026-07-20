"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer create / edit form (full-page screen)
// ─────────────────────────────────────────────────────────────────────────────
//
// One component drives BOTH flows (per Brief §3 — "edit customer has the same
// view as add new customer, with predefined input"):
//   • Create  — `/customers/new`            → CustomerFormPage()
//   • Edit    — `/customers/[id]/edit`      → CustomerFormPage({ editingId })
//
// The same screen is reused by the POS / schedule "add customer" flows via the
// `?returnTo=` query param, so the admin lands back where they started.

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { XClose, Check, ChevronDown, SearchMd } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { capitalizeName } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore, DEFAULT_BRANCH_ID } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";
// Unified 3-tier country / state / city data — shared with the Branch form
// and the POS Add-Customer modal so all 3 surfaces present identical
// dropdowns for the same context (client Jul 2026 — "same context = same
// input"). The legacy `country-states.ts` had state lists for only 4
// countries; every other country fell back to a free-text field. Migrated
// to `locales.ts` which has states + adaptive labels + city lists for 46
// countries.
import { COUNTRIES, statesForCountry, stateLabelForCountry, citiesForState, hasCityForCountry, hasPostalCodeForCountry } from "@/lib/data/locales";
import { AlertCircle, ArrowUpRight } from "@untitledui/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [{ n: 1, label: "Customer details" }];
const GENDER_OPTIONS = ["Male", "Female"];

// Common international dialing codes, ordered for the dropdown.
//
// Exported so other forms (e.g. Account settings → Change phone modal)
// can reuse the exact same country list + dropdown without duplicating it.
export type PhoneCountry = { code: string; dial: string; name: string; flag: string };
export const PHONE_COUNTRIES: PhoneCountry[] = [
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

/** Split a stored "+971 50 123 4567" phone string back into the dial-code
 *  country + the bare national number, so the Edit form re-opens with the
 *  phone picker correctly populated. Longest dial prefix wins (so "+971" is
 *  matched before "+9"). */
export function splitPhone(stored?: string): { country: PhoneCountry; number: string } {
    if (!stored) return { country: PHONE_COUNTRIES[0], number: "" };
    const byLongestDial = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const match = byLongestDial.find(c => stored.startsWith(c.dial));
    if (!match) return { country: PHONE_COUNTRIES[0], number: stored.replace(/\D/g, "") };
    return { country: match, number: stored.slice(match.dial.length).replace(/\D/g, "") };
}

export function PhoneCountryDropdown({ value, onChange }: { value: PhoneCountry; onChange: (c: PhoneCountry) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    // The menu is PORTALED to `document.body` with `position: fixed` so
    // it can never be clipped by a scrollable parent (Account settings
    // change-phone modal, instructor Edit profile modal, etc). Anchor
    // coords are computed off the trigger button's bounding rect.
    const [anchor, setAnchor] = useState<{ top: number; left: number; placement: "down" | "up" } | null>(null);
    const ref = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const MENU_WIDTH = 280;
    const MENU_HEIGHT = 320;

    // Click-outside — checks both the dropdown wrapper AND the portaled
    // menu since they're disjoint in the DOM tree.
    useEffect(() => {
        function h(e: MouseEvent) {
            const target = e.target as Node;
            const insideWrapper = ref.current?.contains(target);
            const insideMenu    = menuRef.current?.contains(target);
            if (!insideWrapper && !insideMenu) setOpen(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    // Compute portal anchor each time the menu opens. Auto-flip up when
    // there isn't enough room below, so the menu always lands inside
    // the viewport regardless of where the button sits.
    useEffect(() => {
        if (!open || !buttonRef.current) {
            setAnchor(null);
            return;
        }
        const rect = buttonRef.current.getBoundingClientRect();
        const roomBelow = window.innerHeight - rect.bottom;
        const roomAbove = rect.top;
        const placement = roomBelow < MENU_HEIGHT + 8 && roomAbove > roomBelow ? "up" : "down";
        const top = placement === "down"
            ? rect.bottom + 4
            : rect.top - MENU_HEIGHT - 4;
        // Clamp left so a button near the viewport's right edge doesn't push
        // the menu off-screen.
        const maxLeft = window.innerWidth - MENU_WIDTH - 8;
        const left = Math.min(rect.left, Math.max(8, maxLeft));
        setAnchor({ top, left, placement });
    }, [open]);

    const filtered = !search ? PHONE_COUNTRIES : PHONE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search) || c.code.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div ref={ref} className="relative">
            <button ref={buttonRef} type="button" onClick={() => setOpen(p => !p)}
                className="h-10 flex items-center gap-1.5 px-[14px] border-r border-[#d0d5dd] text-[16px] text-[#101828] hover:bg-[#f9fafb] transition-colors">
                <span className="text-[16px]">{value.flag}</span>
                {value.dial}
                <ChevronDown className="w-4 h-4 text-[#667085]" />
            </button>
            {open && anchor && typeof document !== "undefined" && createPortal(
                <div
                    ref={menuRef}
                    style={{
                        position: "fixed",
                        top: anchor.top,
                        left: anchor.left,
                        width: MENU_WIDTH,
                        maxHeight: MENU_HEIGHT,
                    }}
                    className="z-[1000] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] overflow-hidden flex flex-col"
                >
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
                </div>,
                document.body,
            )}
        </div>
    );
}

// ─── Step indicator (same shape as /schedule/new) ─────────────────────────────

function StepItem({ step, current, total }: { step: { n: number; label: string }; current: number; total: number }) {
    const active = step.n === current;
    const complete = step.n < current;
    const isLast = step.n === total;
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

// ─── Input field helpers ──────────────────────────────────────────────────────

const inputCls = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";
const labelCls = "text-[14px] font-medium text-[#344054]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className={labelCls}>{label}</label>
            {children}
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Customer create / edit form.
 * @param editingId — when set, the form loads that customer, pre-fills every
 *                    field, and saves through `updateCustomer`. When omitted,
 *                    it's a fresh create that saves through `addCustomer`.
 */
export function CustomerFormPage({ editingId }: { editingId?: string } = {}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    // Optional ?branchId= context — POS / schedule flows can pre-select the
    // branch the admin was working in when they jumped to "Add customer".
    const branchIdParam = searchParams.get("branchId");
    const customers     = useAppStore(s => s.customers);
    const branches      = useAppStore(s => s.branches);
    const addCustomer    = useAppStore(s => s.addCustomer);
    const updateCustomer = useAppStore(s => s.updateCustomer);
    const showToast      = useAppStore(s => s.showToast);

    const isEditing = !!editingId;
    const editing = editingId ? customers.find(c => c.id === editingId) : undefined;
    const initialPhone = splitPhone(editing?.phone);

    // Active branches drive the picker. Memoized so the option array is stable
    // across re-renders while branch additions/archives in Settings propagate.
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // Default branch — edit mode reuses the customer's branch; create mode
    // honours ?branchId= when valid, then falls back to the global default
    // (main active branch → first active branch → first branch).
    function pickInitialBranch(): string {
        if (editing?.branchId) return editing.branchId;
        if (branchIdParam && branchOptions.some(o => o.value === branchIdParam)) return branchIdParam;
        if (branchOptions.some(o => o.value === DEFAULT_BRANCH_ID)) return DEFAULT_BRANCH_ID;
        return branchOptions[0]?.value ?? DEFAULT_BRANCH_ID;
    }

    // Customer details — pre-filled from the edited customer, empty for create.
    const [firstName, setFirstName] = useState(editing?.firstName ?? "");
    const [lastName, setLastName] = useState(editing?.lastName ?? "");
    const [branchId, setBranchId] = useState<string>(pickInitialBranch);
    const [dob, setDob] = useState(editing?.dateOfBirth ?? "");
    const [gender, setGender] = useState(editing?.gender ?? "");
    const [email, setEmail] = useState(editing?.email ?? "");
    const [phone, setPhone] = useState(initialPhone.number);
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);

    // Address details
    const [country, setCountry] = useState(editing?.country ?? "");
    const [stateRegion, setStateRegion] = useState(editing?.state ?? "");
    const [city, setCity] = useState(editing?.city ?? "");
    const [postalCode, setPostalCode] = useState(editing?.postalCode ?? "");
    const [streetAddress, setStreetAddress] = useState(editing?.streetAddress ?? "");

    // Email must be syntactically valid — same `isValidEmail` rule the
    // admin Change-email modal + instructor Edit profile use, so the
    // forms reject identical typos.
    const emailValid = isValidEmail(email);
    const emailDirty = email.trim().length > 0;
    // Note: `duplicate` is computed below and gated into `canSave` once
    // available — so the Save button stays disabled while an existing
    // record matches the typed email or phone. Without this, an admin
    // could silently push a duplicate through and only realize after the
    // fact when the customer list shows two rows for the same person.
    const canSaveBase = !!firstName.trim() && !!lastName.trim() && emailValid && !!branchId;

    // ─── Duplicate detection ───────────────────────────────────────────────
    //
    // Flag email + phone collisions against the live customers slice. Open-
    // existing shortcut routes the admin to the matched record so they can
    // edit it instead of accidentally creating a duplicate.
    //
    // The current customer (in edit mode) is excluded from the search so
    // re-saving the same email/phone on the same record doesn't self-flag.
    const normalizedPhone = phone ? `${phoneCountry.dial} ${phone}`.replace(/\s+/g, "") : "";
    const duplicateByEmail = email.trim() && emailValid
        ? customers.find(c => c.id !== editing?.id && c.email && c.email.trim().toLowerCase() === email.trim().toLowerCase())
        : undefined;
    const duplicateByPhone = normalizedPhone
        ? customers.find(c => c.id !== editing?.id && c.phone && c.phone.replace(/\s+/g, "") === normalizedPhone)
        : undefined;
    const duplicate = duplicateByEmail ?? duplicateByPhone;
    // Final gate — block Save while a duplicate is detected. The footer
    // alert below tells the admin what's wrong + offers a shortcut to
    // open the existing record.
    const canSave = canSaveBase && !duplicate;

    // ─── Country-dependent address fields ──────────────────────────────────
    //
    // 3-tier cascade Country → State → City, identical to the Branch form
    // (client Jul 2026 — "same context = same input"). State label auto-
    // adjusts per country ("Emirate" for UAE, "Province" for Indonesia,
    // "State" for US, etc.). Middle field hides entirely for city-states
    // like Singapore. Country change clears state + city. State change
    // clears city if it doesn't belong.
    const stateLabel  = useMemo(() => stateLabelForCountry(country), [country]);
    const stateOptions = useMemo(() => statesForCountry(country), [country]);
    const cityOptions = useMemo(
        () => citiesForState(country, stateRegion || undefined),
        [country, stateRegion],
    );
    // Per-country address structure (client Jul 2026):
    //   UAE  → hasCity: false  (Emirate IS the address, no city concept)
    //   UAE, KW, BH, QA, OM → hasPostalCode: false (PO Box, no postal system)
    //   Everyone else → both true.
    // Field hides entirely + gets skipped on save when its flag is false.
    const showCity = useMemo(() => hasCityForCountry(country), [country]);
    const showPostal = useMemo(() => hasPostalCodeForCountry(country), [country]);

    useEffect(() => {
        // If the picked state doesn't belong to the current country's list,
        // clear it — prevents saving "Dubai" while Country is "Canada".
        if (!stateRegion) return;
        if (stateOptions.length === 0) return;
        if (!stateOptions.some(s => s.name === stateRegion)) setStateRegion("");
    }, [country, stateOptions, stateRegion]);

    useEffect(() => {
        // If the city no longer belongs to the current (country, state)
        // list, clear it — prevents stale "Surabaya" while country is UAE.
        if (!city) return;
        if (cityOptions.length === 0) return;
        if (!cityOptions.includes(city)) setCity("");
    }, [country, stateRegion, city, cityOptions]);

    useEffect(() => {
        // Clear stored values when their fields are hidden for the
        // current country — otherwise a country change to UAE would
        // leave a stale "Surabaya" city or postal code on the record.
        if (!showCity && city) setCity("");
        if (!showPostal && postalCode) setPostalCode("");
    }, [showCity, showPostal, city, postalCode]);

    // Edit mode opened for an id that no longer exists (deleted in another
    // tab / stale link) — bail with a clear message instead of a blank form.
    if (isEditing && !editing) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
                <p className="text-[16px] text-[#667085]">This customer could not be found.</p>
                <Button variant="secondary-gray" size="md" onClick={() => router.push("/admin/customers")}>
                    Back to customers
                </Button>
            </div>
        );
    }

    function handleSave() {
        if (!canSave) return;
        const phoneValue = phone ? `${phoneCountry.dial} ${phone}` : undefined;
        const fields = {
            // Title-case the input so a name entered as "sophia lee"
            // persists as "Sophia Lee" — every downstream consumer
            // (notification bodies, customer list, dashboard activity
            // feed, etc.) then reads the properly-capitalised form.
            firstName: capitalizeName(firstName),
            lastName: capitalizeName(lastName),
            email: email.trim(),
            phone: phoneValue,
            branchId,
            dateOfBirth: dob || undefined,
            gender: gender || undefined,
            country: country || undefined,
            state: stateRegion || undefined,
            city: city || undefined,
            postalCode: postalCode || undefined,
            streetAddress: streetAddress || undefined,
        };

        if (isEditing && editing) {
            updateCustomer(editing.id, {
                ...fields,
                // Keep the initials avatar in sync when the name is changed.
                initials: `${firstName.trim().charAt(0)}${lastName.trim().charAt(0)}`.toUpperCase(),
            });
            showToast(
                "Customer updated successfully",
                `${fields.firstName} ${fields.lastName}'s details have been saved.`,
                "success", "check",
            );
        } else {
            addCustomer({ ...fields, planKind: null });
            showToast(
                "Customer created successfully",
                `${fields.firstName} ${fields.lastName} has been added to the customer list.`,
                "success", "check",
            );
        }

        // Return the admin where they came from (POS / schedule add-customer
        // flows pass ?returnTo=). Otherwise fall back to the previous screen.
        if (returnTo) router.push(returnTo);
        else router.back();
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white">
            {/* Header */}
            <div className="shrink-0 h-[72px] flex items-center px-6 gap-3">
                <button type="button" onClick={() => router.back()}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <p className="text-[20px] font-semibold text-[#101828]">
                        {isEditing ? "Edit customer" : "Add customer"}
                    </p>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden gap-8 px-6 py-6">
                {/* Steps sidebar */}
                <div className="w-[300px] shrink-0 flex flex-col gap-0 pt-2">
                    {STEPS.map(s => <StepItem key={s.n} step={s} current={1} total={STEPS.length} />)}
                </div>

                {/* Form card */}
                <div className="flex-1 max-w-[628px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-8">
                        {/* ─── Customer details ─── */}
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="First name">
                                    <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                                        placeholder="First name..." className={inputCls} />
                                </Field>
                                <Field label="Last name">
                                    <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                                        placeholder="Last name..." className={inputCls} />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Date of birth">
                                    {/* DOB is always in the past — cap at today so future dates aren't selectable. */}
                                    <DatePicker value={dob} onChange={setDob} placeholder="DD/MM/YYYY" maxDate={todayISO()} />
                                </Field>
                                <Field label="Gender">
                                    <SelectInput value={gender} onChange={setGender} placeholder="Select gender"
                                        options={GENDER_OPTIONS.map(o => ({ value: o, label: o }))} width="w-full" />
                                </Field>
                            </div>

                            <Field label="Email">
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="Email..." className={inputCls} />
                                {emailDirty && !emailValid && (
                                    <p className="text-[14px] text-[#b42318] leading-5 mt-1.5">
                                        Please enter a valid email address.
                                    </p>
                                )}
                            </Field>

                            <Field label="Phone number">
                                <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                    <PhoneCountryDropdown value={phoneCountry} onChange={setPhoneCountry} />
                                    <input type="tel" value={phone}
                                        onChange={e => setPhone(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Phone number..."
                                        className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent rounded-r-[8px]" />
                                </div>
                            </Field>

                        </div>

                        {/* ─── Address details ─── */}
                        <div className="flex flex-col gap-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Country">
                                    {/* Flag icon per option (matches the phone
                                        country-code picker). The trigger icon
                                        is set dynamically so the selected
                                        country's flag also shows on the
                                        collapsed input. */}
                                    <SelectInput value={country} onChange={(next) => { setCountry(next); setStateRegion(""); setCity(""); }} placeholder="Select country"
                                        options={COUNTRIES.map(c => ({
                                            value: c.name, label: c.name,
                                            icon: <span className="text-[16px] leading-none">{c.flag}</span>,
                                        }))}
                                        triggerIcon={country ? (
                                            <span className="text-[16px] leading-none">{COUNTRIES.find(c => c.name === country)?.flag}</span>
                                        ) : undefined}
                                        width="w-full" />
                                </Field>
                                {/* State/Emirate/Province/Region dropdown — same
                                    3-tier cascade as the Branch form. Hidden for
                                    city-states (Singapore) where the country has
                                    no meaningful subdivision. */}
                                {stateLabel && (
                                    <Field label={stateLabel}>
                                        <SelectInput
                                            value={stateRegion}
                                            onChange={(next) => { setStateRegion(next); setCity(""); }}
                                            placeholder={stateOptions.length === 0 ? "Pick a country first" : `Select ${stateLabel.toLowerCase()}`}
                                            options={stateOptions.map(s => ({ value: s.name, label: s.name }))}
                                            width="w-full"
                                        />
                                    </Field>
                                )}
                            </div>

                            {/* City + Postal — each field respects its own
                                per-country flag. UAE hides both. Kuwait /
                                Bahrain / Qatar / Oman hide postal only. The
                                whole row also hides when nothing to show. */}
                            {(showCity || showPostal) && (
                                <div className={cn("grid gap-4", showCity && showPostal ? "grid-cols-2" : "grid-cols-1")}>
                                    {showCity && (
                                        <Field label="City">
                                            {cityOptions.length > 0 ? (
                                                <SelectInput
                                                    value={cityOptions.includes(city) ? city : ""}
                                                    onChange={setCity}
                                                    placeholder={stateRegion || !stateLabel ? "Select city" : `Pick a ${stateLabel.toLowerCase()} first`}
                                                    options={cityOptions.map(c => ({ value: c, label: c }))}
                                                    width="w-full"
                                                />
                                            ) : (
                                                <input type="text" value={city}
                                                    onChange={e => setCity(e.target.value)}
                                                    placeholder="Enter city..." className={inputCls} />
                                            )}
                                        </Field>
                                    )}
                                    {showPostal && (
                                        <Field label="Postal code">
                                            <input type="text" value={postalCode}
                                                onChange={e => setPostalCode(e.target.value.replace(/\D/g, ""))}
                                                placeholder="Enter postal code..." className={inputCls} />
                                        </Field>
                                    )}
                                </div>
                            )}

                            <Field label="Street address">
                                <textarea value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                                    rows={3} placeholder="Enter street address..."
                                    className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-none" />
                            </Field>
                        </div>

                        {/* Duplicate-customer warning — anchored at the
                            BOTTOM of the form (per Figma 7355-31018) so it
                            sits right above the Continue / Save CTA. The
                            CTA itself is gated via `canSave`, so
                            submission is blocked while this alert is
                            visible. Title → body → "View existing
                            customer" link with arrow, spaced apart. */}
                        {duplicate && (
                            <div className="flex items-start gap-3 p-4 rounded-[12px] bg-[#fffaeb] border-1 border-[#fedf89]">
                                <div className="shrink-0 w-10 h-10 rounded-full bg-[#fef0c7] border-1 border-[#fedf89] flex items-center justify-center">
                                    <AlertCircle className="w-5 h-5 text-[#dc6803]" />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col gap-1">
                                    <p className="text-[16px] font-semibold text-[#7a2e0e] leading-6">
                                        Looks like {duplicate.firstName} {duplicate.lastName} already exists
                                    </p>
                                    <p className="text-[14px] text-[#7a2e0e] leading-5">
                                        We found an existing customer matching {duplicate.firstName} {duplicate.lastName}&apos;s details.
                                    </p>
                                    <button type="button"
                                        onClick={() => router.push(`/customers/${duplicate.id}`)}
                                        className="mt-3 inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-[#7a2e0e] hover:text-[#542708] transition-colors">
                                        View existing customer
                                        <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                        <Button variant="primary" size="md" disabled={!canSave} onClick={handleSave}>
                            {isEditing ? "Save changes" : "Continue"}
                        </Button>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
