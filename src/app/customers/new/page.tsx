"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XClose, Check, ChevronDown, SearchMd } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { DatePicker } from "@/components/ui/DatePicker";
import { useAppStore } from "@/lib/store";
import { SelectInput } from "@/components/ui/select-input";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [{ n: 1, label: "Customer details" }];
const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say"];
const COUNTRY_OPTIONS = ["United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Oman", "Bahrain"];
const STATE_OPTIONS = ["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];
const CITY_OPTIONS = ["Dubai", "Abu Dhabi", "Sharjah", "Al Ain", "Ajman", "Ras Al Khaimah"];

// Common international dialing codes, ordered for the dropdown.
const PHONE_COUNTRIES: { code: string; dial: string; name: string; flag: string }[] = [
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

function PhoneCountryDropdown({ value, onChange }: { value: typeof PHONE_COUNTRIES[number]; onChange: (c: typeof PHONE_COUNTRIES[number]) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const filtered = !search ? PHONE_COUNTRIES : PHONE_COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) || c.dial.includes(search) || c.code.toLowerCase().includes(search.toLowerCase())
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

export default function NewCustomerPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const { addCustomer, showToast } = useAppStore();

    // Customer details
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");

    const [phoneCountry, setPhoneCountry] = useState(PHONE_COUNTRIES[0]); // UAE default

    // Address details
    const [country, setCountry] = useState("");
    const [stateRegion, setStateRegion] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [streetAddress, setStreetAddress] = useState("");

    const canContinue = !!firstName.trim() && !!lastName.trim() && !!email.trim();

    function handleSave() {
        if (!canContinue) return;
        const id = addCustomer({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: phone ? `${phoneCountry.dial} ${phone}` : undefined,
            dateOfBirth: dob || undefined,
            gender: gender || undefined,
            country: country || undefined,
            state: stateRegion || undefined,
            city: city || undefined,
            postalCode: postalCode || undefined,
            streetAddress: streetAddress || undefined,
            planKind: null,
        });
        showToast(
            "Customer created successfully",
            `${firstName} ${lastName} has been added to the customer list.`,
            "success", "check"
        );
        // Send the admin back where they came from. If the caller wants the
        // Add-customer modal to re-open on arrival, it has appended `&openAddCustomer=1`.
        if (returnTo) router.push(returnTo);
        else router.back();
        // The new customer (id) is now in the store and will appear in the Add Customer modal list.
        void id;
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white">
            {/* Header */}
            <div className="shrink-0 h-[72px] flex items-center px-6 gap-3">
                <button type="button" onClick={() => router.back()}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <p className="text-[20px] font-semibold text-[#101828]">Add customer</p>
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
                            <p className="text-[18px] font-semibold text-[#101828]">Customer details</p>

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
                                    <DatePicker value={dob} onChange={setDob} placeholder="DD/MM/YYYY" />
                                </Field>
                                <Field label="Gender">
                                    <SelectInput value={gender} onChange={setGender} placeholder="Select gender"
                                        options={GENDER_OPTIONS.map(o => ({ value: o, label: o }))} width="w-full" />
                                </Field>
                            </div>

                            <Field label="Email">
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                                    placeholder="Email..." className={inputCls} />
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
                            <p className="text-[18px] font-semibold text-[#101828]">Address details</p>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="Country">
                                    <SelectInput value={country} onChange={setCountry} placeholder="Select country"
                                        options={COUNTRY_OPTIONS.map(o => ({ value: o, label: o }))} width="w-full" />
                                </Field>
                                <Field label="State">
                                    <SelectInput value={stateRegion} onChange={setStateRegion} placeholder="Select state"
                                        options={STATE_OPTIONS.map(o => ({ value: o, label: o }))} width="w-full" />
                                </Field>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Field label="City">
                                    <SelectInput value={city} onChange={setCity} placeholder="Select city"
                                        options={CITY_OPTIONS.map(o => ({ value: o, label: o }))} width="w-full" />
                                </Field>
                                <Field label="Postal code">
                                    <input type="text" value={postalCode}
                                        onChange={e => setPostalCode(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Enter postal code..." className={inputCls} />
                                </Field>
                            </div>

                            <Field label="Street address">
                                <textarea value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                                    rows={3} placeholder="Enter street address..."
                                    className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-none" />
                            </Field>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                        <Button variant="primary" size="md" disabled={!canContinue} onClick={handleSave}>
                            Continue
                        </Button>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
