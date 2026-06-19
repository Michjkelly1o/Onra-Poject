"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — POS "Add new customer" side-panel modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Replaces the previous full-page navigation that POS triggered when the admin
// hit the "+" next to the cart's customer picker. Keeping the admin inside the
// POS surface preserves cart context (line items, promo, custom discount) and
// removes the round-trip back through the page transition.
//
// Chrome mirrors the customer module's filter side panel ([`FilterPanel` in
// admin/customers/page.tsx]) — same backdrop, dim color, slide-from-right,
// 480px width, ESC + backdrop dismiss. Form content mirrors `CustomerFormPage`
// 1-for-1 (Customer details + Address details + duplicate detection + dynamic
// country/state/UAE rules) so admins can train on either surface
// interchangeably.
//
// IMPORTANT: scope is **POS only** per the spec. The `/customers/new` route is
// still used by the schedule add-customer flow, so we left that path intact.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, AlertCircle, ArrowUpRight } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore, DEFAULT_BRANCH_ID } from "@/lib/store";
import { isValidEmail } from "@/lib/validation";
import {
    PhoneCountryDropdown,
    PHONE_COUNTRIES,
    type PhoneCountry,
} from "@/components/customers/CustomerFormPage";
import { COUNTRIES, getCountryInfo } from "@/components/customers/country-states";

const GENDER_OPTIONS = ["Male", "Female"];

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

export function PosNewCustomerModal({
    open,
    onClose,
    defaultBranchId,
    onCustomerCreated,
}: {
    open: boolean;
    onClose: () => void;
    /** Branch the POS surface is currently scoped to — pre-selects the
     *  branch picker so the admin doesn't have to choose it manually. */
    defaultBranchId?: string;
    /** Fires after the new customer lands in the store; the parent
     *  uses this to drop the customer into the cart picker. */
    onCustomerCreated: (customerId: string) => void;
}) {
    const router = useRouter();
    const customers = useAppStore(s => s.customers);
    const branches = useAppStore(s => s.branches);
    const addCustomer = useAppStore(s => s.addCustomer);
    const showToast = useAppStore(s => s.showToast);

    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ value: b.id, label: b.name })),
        [branches],
    );

    // Field state.
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [branchId, setBranchId] = useState<string>(defaultBranchId ?? DEFAULT_BRANCH_ID);
    const [dob, setDob] = useState("");
    const [gender, setGender] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [phoneCountry, setPhoneCountry] = useState<PhoneCountry>(PHONE_COUNTRIES[0]);

    // Address state.
    const [country, setCountry] = useState("");
    const [stateRegion, setStateRegion] = useState("");
    const [city, setCity] = useState("");
    const [postalCode, setPostalCode] = useState("");
    const [streetAddress, setStreetAddress] = useState("");

    // Reset every field whenever the modal closes — the next opening should
    // present a clean form (the admin almost never wants to resume a
    // half-typed customer after dismissing the panel).
    useEffect(() => {
        if (open) return;
        setFirstName(""); setLastName("");
        setBranchId(defaultBranchId ?? DEFAULT_BRANCH_ID);
        setDob(""); setGender("");
        setEmail(""); setPhone("");
        setPhoneCountry(PHONE_COUNTRIES[0]);
        setCountry(""); setStateRegion("");
        setCity(""); setPostalCode("");
        setStreetAddress("");
    }, [open, defaultBranchId]);

    // ESC closes the modal.
    useEffect(() => {
        if (!open) return;
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, onClose]);

    // Slide-in + slide-out animation. Two-state machine + two effects so
    // both transitions actually play:
    //   • `mounted` — controls whether the modal is in the DOM. Flips true
    //                 the moment `open` becomes true; flips false ~280ms
    //                 AFTER `open` becomes false (so the exit animation has
    //                 time to play).
    //   • `shown`   — drives the `translate-x` class. Critically, it stays
    //                 false on the first render after mount so the panel
    //                 commits to the DOM at `translate-x-full`. A small
    //                 setTimeout (20ms — not rAF, which React can batch
    //                 into the same commit) then flips it to true, and the
    //                 CSS transition pulls the panel to `translate-x-0`.
    //                 On close, `shown` flips false first, the slide-out
    //                 plays, then the mount timer unmounts.
    const [mounted, setMounted] = useState(false);
    const [shown, setShown] = useState(false);
    useEffect(() => {
        if (open) {
            setMounted(true);
            return;
        }
        setShown(false);
        const t = setTimeout(() => setMounted(false), 280);
        return () => clearTimeout(t);
    }, [open]);
    useEffect(() => {
        if (!mounted) return;
        const t = setTimeout(() => setShown(true), 20);
        return () => clearTimeout(t);
    }, [mounted]);

    const emailValid = isValidEmail(email);
    const emailDirty = email.trim().length > 0;
    const canSaveBase = !!firstName.trim() && !!lastName.trim() && emailValid && !!branchId;

    // Duplicate detection — identical rule to `CustomerFormPage`.
    const normalizedPhone = phone ? `${phoneCountry.dial} ${phone}`.replace(/\s+/g, "") : "";
    const duplicateByEmail = email.trim() && emailValid
        ? customers.find(c => c.email && c.email.trim().toLowerCase() === email.trim().toLowerCase())
        : undefined;
    const duplicateByPhone = normalizedPhone
        ? customers.find(c => c.phone && c.phone.replace(/\s+/g, "") === normalizedPhone)
        : undefined;
    const duplicate = duplicateByEmail ?? duplicateByPhone;
    // Block submission while a duplicate is detected. The bottom alert
    // surfaces the existing customer and offers "Use this customer" /
    // "Open profile" recovery actions.
    const canSave = canSaveBase && !duplicate;

    // Country-dependent rules.
    const countryInfo = useMemo(() => country ? getCountryInfo(country) : null, [country]);
    const stateLabel = countryInfo?.stateLabel ?? "Region";
    const stateOptions = countryInfo?.states;
    const showCityPostal = countryInfo ? countryInfo.showCityPostal !== false : true;

    useEffect(() => {
        if (!stateRegion) return;
        if (stateOptions && !stateOptions.includes(stateRegion)) setStateRegion("");
    }, [country, stateOptions, stateRegion]);

    useEffect(() => {
        if (!showCityPostal) {
            if (city) setCity("");
            if (postalCode) setPostalCode("");
        }
    }, [showCityPostal, city, postalCode]);

    function handleSave() {
        if (!canSave) return;
        const phoneValue = phone ? `${phoneCountry.dial} ${phone}` : undefined;
        const id = addCustomer({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
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
            planKind: null,
        });
        showToast(
            "Customer created successfully",
            `${firstName.trim()} ${lastName.trim()} has been added to the customer list.`,
            "success", "check",
        );
        onCustomerCreated(id);
        onClose();
    }

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-[200]">
            {/* Backdrop fades in/out alongside the panel slide. */}
            <div
                onClick={onClose}
                className={cn(
                    "absolute inset-0 bg-[#0c111d]/40 transition-opacity duration-300 ease-out",
                    shown ? "opacity-100" : "opacity-0",
                )}
            />
            {/* Panel slides in from the right edge by animating `right` from
                -480px → 0 (instead of `transform: translateX`). We have to
                avoid any `transform` on this element because a transformed
                ancestor breaks `position: fixed` for descendants — and
                `SelectInput`'s dropdown menu relies on `position: fixed`
                anchored to the viewport. Without this trick, the Country
                picker (and any other Select inside the form) would render
                in the wrong place or be invisible. */}
            <div
                style={{ right: shown ? 0 : -480 }}
                className={cn(
                    "fixed top-0 w-[480px] h-full bg-white border-l border-[#e4e7ec] shadow-[-12px_0px_24px_-4px_rgba(16,24,40,0.08)] flex flex-col",
                    "transition-[right] duration-300 ease-out",
                )}
            >
                {/* Header — matches the customer-module filter panel chrome */}
                <div className="flex items-center px-6 border-b border-[#e4e7ec] shrink-0 h-[64px]">
                    <p className="flex-1 font-semibold text-[18px] text-[#101828]">Add new customer</p>
                    <button type="button" onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Body — scrollable form */}
                <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-5 flex flex-col gap-8">
                    {/* ─── Customer details ─── */}
                    <div className="flex flex-col gap-4">
                        <p className="text-[16px] font-semibold text-[#101828]">Customer details</p>

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

                        <Field label="Home branch">
                            <SelectInput value={branchId} onChange={setBranchId}
                                placeholder="Select branch" options={branchOptions} width="w-full" />
                        </Field>

                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Date of birth">
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
                        <p className="text-[16px] font-semibold text-[#101828]">Address details</p>

                        <Field label="Country">
                            <SelectInput value={country} onChange={setCountry} placeholder="Select country"
                                options={COUNTRIES.map(c => ({
                                    value: c.name, label: c.name,
                                    icon: <span className="text-[16px] leading-none">{c.flag}</span>,
                                }))}
                                triggerIcon={countryInfo ? (
                                    <span className="text-[16px] leading-none">{countryInfo.flag}</span>
                                ) : undefined}
                                width="w-full" />
                        </Field>

                        <Field label={stateLabel}>
                            {stateOptions ? (
                                <SelectInput value={stateRegion} onChange={setStateRegion}
                                    placeholder={`Select ${stateLabel.toLowerCase()}`}
                                    options={stateOptions.map(o => ({ value: o, label: o }))}
                                    width="w-full" />
                            ) : (
                                <input type="text" value={stateRegion}
                                    onChange={e => setStateRegion(e.target.value)}
                                    placeholder={`Enter ${stateLabel.toLowerCase()}...`}
                                    className={inputCls} />
                            )}
                        </Field>

                        {showCityPostal && (
                            <div className="grid grid-cols-2 gap-4">
                                <Field label="City">
                                    <input type="text" value={city}
                                        onChange={e => setCity(e.target.value)}
                                        placeholder="Enter city..." className={inputCls} />
                                </Field>
                                <Field label="Postal code">
                                    <input type="text" value={postalCode}
                                        onChange={e => setPostalCode(e.target.value.replace(/\D/g, ""))}
                                        placeholder="Enter postal code..." className={inputCls} />
                                </Field>
                            </div>
                        )}

                        <Field label="Street address">
                            <textarea value={streetAddress} onChange={e => setStreetAddress(e.target.value)}
                                rows={3} placeholder="Enter street address..."
                                className={cn(
                                    "w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-none",
                                )} />
                        </Field>
                    </div>

                    {/* Duplicate-customer warning — anchored at the BOTTOM
                        of the form (per Figma 7355-31018), sitting just
                        above the Cancel / Add customer footer. The Add
                        button is gated via `canSave`, so submission is
                        blocked while this alert is visible. Title → body
                        → "View existing customer" link with arrow, spaced
                        apart. */}
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
                                    onClick={() => { onClose(); router.push(`/customers/${duplicate.id}`); }}
                                    className="mt-3 inline-flex items-center gap-1.5 self-start text-[14px] font-semibold text-[#7a2e0e] hover:text-[#542708] transition-colors">
                                    View existing customer
                                    <ArrowUpRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer — Cancel (left) + Add customer (right), matches
                    the filter-panel pattern: `justify-between` so the
                    actions split to opposite edges instead of clustering. */}
                <div className="shrink-0 border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" size="md" disabled={!canSave} onClick={handleSave}>
                        Add customer
                    </Button>
                </div>
            </div>
        </div>
    );
}
