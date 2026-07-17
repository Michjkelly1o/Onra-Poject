"use client";

// Customer — Profile information (`/customer/profile/information`) — full-page form.
// Grouped sections: Personal information · Password · Address details · Emergency
// contact, plus Change password + Delete account flows. Save writes `customers`
// via the store + toasts.

import { useEffect, useRef, useState } from "react";
import { useRequireCustomerAuth } from "@/lib/customer/use-require-auth";
import { useRouter } from "next/navigation";
import { Calendar, Camera01, ChevronDown, ChevronLeft, LogOut01, Trash01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { logoutCustomer } from "@/lib/customer/auth";
import { useHasCustomerPassword } from "@/lib/customer/customer-password";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { DobSheet } from "@/components/customer/profile/DobSheet";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { Button } from "@/components/ui/button";
import { splitPhone } from "@/components/customers/CustomerFormPage";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";
import { PickerSheet } from "@/components/customer/shell/PickerSheet";
import {
    COUNTRIES,
    countryByName,
    stateLabelForCountry,
    statesForCountry,
    hasCityForCountry,
    hasPostalCodeForCountry,
} from "@/lib/data/locales";

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] outline-none transition-colors placeholder:text-[#667085] focus:border-[var(--brand-primary)]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";
const SECTION = "text-base font-semibold leading-6 text-[var(--brand-text)]";
const RELATIONS = ["Siblings", "Parent", "Spouse", "Child", "Friend", "Other"];

function dobLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec]" />;
}

export default function ProfileInformationPage() {
    useRequireCustomerAuth();
    const router = useRouter();
    const member = useCurrentCustomer();
    const updateCustomer = useAppStore((s) => s.updateCustomer);
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    const hasPassword = useHasCustomerPassword(member?.id ?? "");

    const initialPhone = splitPhone(member?.phone);
    const [firstName, setFirstName] = useState(member?.firstName ?? "");
    const [lastName, setLastName] = useState(member?.lastName ?? "");
    const [dob, setDob] = useState(member?.dateOfBirth ?? "");
    const [gender, setGender] = useState(member?.gender ?? "");
    const [email, setEmail] = useState(member?.email ?? "");
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
    const [phone, setPhone] = useState(initialPhone.number);
    const [country, setCountry] = useState(member?.country ?? "");
    const [stateRegion, setStateRegion] = useState(member?.state ?? "");
    const [city, setCity] = useState(member?.city ?? "");
    const [postalCode, setPostalCode] = useState(member?.postalCode ?? "");
    const [streetAddress, setStreetAddress] = useState(member?.streetAddress ?? "");
    const [avatar, setAvatar] = useState(member?.imageUrl ?? "");

    // Emergency contact (merged in from the retired standalone page).
    const ecNameParts = (member?.emergencyContactName ?? "").trim().split(/\s+/);
    const ecInitialPhone = splitPhone(member?.emergencyContactPhone);
    const [ecFirstName, setEcFirstName] = useState(ecNameParts[0] ?? "");
    const [ecLastName, setEcLastName] = useState(ecNameParts.slice(1).join(" "));
    const [ecRelation, setEcRelation] = useState(member?.emergencyContactRelation ?? "");
    const [ecPhoneCountry, setEcPhoneCountry] = useState(ecInitialPhone.country);
    const [ecPhone, setEcPhone] = useState(ecInitialPhone.number);

    const [dirty, setDirty] = useState(false);
    const [dobOpen, setDobOpen] = useState(false);
    const [genderOpen, setGenderOpen] = useState(false);
    const [relationOpen, setRelationOpen] = useState(false);
    const [picker, setPicker] = useState<null | "country" | "state">(null);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

    function touch<T>(setter: (v: T) => void) {
        return (v: T) => {
            setter(v);
            setDirty(true);
        };
    }

    const stateLabel = stateLabelForCountry(country);
    const stateOptions = country ? statesForCountry(country).map((s) => s.name) : undefined;
    const showCityPostal = country ? hasCityForCountry(country) && hasPostalCodeForCountry(country) : true;

    useEffect(() => {
        if (stateRegion && stateOptions && !stateOptions.includes(stateRegion)) setStateRegion("");
    }, [stateOptions, stateRegion]);
    useEffect(() => {
        if (!showCityPostal) {
            if (city) setCity("");
            if (postalCode) setPostalCode("");
        }
    }, [showCityPostal, city, postalCode]);

    function save() {
        if (!member) return;
        updateCustomer(member.id, {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: `${phoneCountry.dial} ${phone}`.trim(),
            dateOfBirth: dob || undefined,
            gender: gender || undefined,
            imageUrl: avatar || undefined,
            country: country || undefined,
            state: stateRegion || undefined,
            city: city || undefined,
            postalCode: postalCode || undefined,
            streetAddress: streetAddress || undefined,
            emergencyContactName: `${ecFirstName} ${ecLastName}`.trim() || undefined,
            emergencyContactPhone: ecPhone ? `${ecPhoneCountry.dial} ${ecPhone}`.trim() : undefined,
            emergencyContactRelation: ecRelation || undefined,
        });
        showToast("Your profile is updated", "All changes has been saved.", "success");
        setDirty(false);
        router.back();
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <span aria-hidden className="flex-1" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-[80px]">
                {/* Avatar + change photo */}
                <div className="flex justify-center pt-2">
                    <div className="relative">
                        {avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={avatar} alt="" className="size-24 rounded-full object-cover ring-4 ring-white" />
                        ) : (
                            <div className="flex size-24 items-center justify-center rounded-full bg-[#f2f4f7] text-2xl font-semibold text-[#475467] ring-4 ring-white">
                                {member?.initials}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => fileRef.current?.click()}
                            aria-label="Change photo"
                            className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-2 border-white bg-white shadow-[0px_1px_3px_rgba(16,24,40,0.18)]"
                        >
                            <Camera01 className="size-4 text-[#344054]" aria-hidden />
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f) setPendingPhoto(URL.createObjectURL(f));
                                e.target.value = "";
                            }}
                        />
                    </div>
                </div>

                {/* Personal information */}
                <p className={SECTION}>Personal information</p>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>First name</span>
                    <input value={firstName} onChange={(e) => touch(setFirstName)(e.target.value)} className={FIELD} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Last name</span>
                    <input value={lastName} onChange={(e) => touch(setLastName)(e.target.value)} className={FIELD} />
                </label>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Date of birth</span>
                    <button type="button" onClick={() => setDobOpen(true)} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 ${dob ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {dob ? dobLabel(dob) : "Enter date of birth"}
                        </span>
                        <Calendar className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Gender</span>
                    <button type="button" onClick={() => setGenderOpen(true)} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 ${gender ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {gender || "Select gender"}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Email</span>
                    <input type="email" value={email} onChange={(e) => touch(setEmail)(e.target.value)} className={FIELD} />
                </label>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Phone number</span>
                    <div className="flex items-stretch gap-2">
                        <PhoneCountrySheet value={phoneCountry} onChange={touch(setPhoneCountry)} />
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => touch(setPhone)(e.target.value.replace(/\D/g, ""))}
                            placeholder="Phone number"
                            className={`${FIELD} flex-1`}
                        />
                    </div>
                </div>

                <Divider />

                {/* Password */}
                <p className={SECTION}>Password</p>
                <Button
                    variant="secondary"
                    size="lg"
                    className="w-full rounded-full"
                    onClick={() => router.push("/customer/profile/change-password")}
                >
                    {hasPassword ? "Change password" : "Create password"}
                </Button>

                <Divider />

                {/* Address details */}
                <p className={SECTION}>Address details</p>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Country</span>
                    <button type="button" onClick={() => setPicker("country")} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 truncate ${country ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {country ? `${countryByName(country)?.flag ?? ""} ${country}` : "Select country"}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>{stateLabel}</span>
                    {stateOptions ? (
                        <button type="button" onClick={() => setPicker("state")} className={`${FIELD} flex items-center text-left`}>
                            <span className={`flex-1 truncate ${stateRegion ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                                {stateRegion || `Select ${stateLabel.toLowerCase()}`}
                            </span>
                            <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                        </button>
                    ) : (
                        <input
                            value={stateRegion}
                            onChange={(e) => touch(setStateRegion)(e.target.value)}
                            placeholder={`Enter ${stateLabel.toLowerCase()}...`}
                            className={FIELD}
                        />
                    )}
                </div>
                {showCityPostal && (
                    <>
                        <label className="flex flex-col gap-1.5">
                            <span className={LABEL}>City</span>
                            <input value={city} onChange={(e) => touch(setCity)(e.target.value)} placeholder="Enter city..." className={FIELD} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className={LABEL}>Postal code</span>
                            <input
                                value={postalCode}
                                onChange={(e) => touch(setPostalCode)(e.target.value.replace(/\D/g, ""))}
                                placeholder="Enter postal code"
                                inputMode="numeric"
                                className={FIELD}
                            />
                        </label>
                    </>
                )}
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Street address</span>
                    <textarea
                        value={streetAddress}
                        onChange={(e) => touch(setStreetAddress)(e.target.value)}
                        rows={3}
                        placeholder="Enter street address..."
                        className={`${FIELD} resize-none`}
                    />
                </label>

                <Divider />

                {/* Emergency contact */}
                <p className={SECTION}>Emergency contact</p>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>First name</span>
                    <input value={ecFirstName} onChange={(e) => touch(setEcFirstName)(e.target.value)} placeholder="Enter first name" className={FIELD} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Last name</span>
                    <input value={ecLastName} onChange={(e) => touch(setEcLastName)(e.target.value)} placeholder="Enter last name" className={FIELD} />
                </label>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Relation</span>
                    <button type="button" onClick={() => setRelationOpen(true)} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 ${ecRelation ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                            {ecRelation || "Select relation"}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Phone number</span>
                    <div className="flex items-stretch gap-2">
                        <PhoneCountrySheet value={ecPhoneCountry} onChange={touch(setEcPhoneCountry)} />
                        <input
                            type="tel"
                            value={ecPhone}
                            onChange={(e) => touch(setEcPhone)(e.target.value.replace(/\D/g, ""))}
                            placeholder="Enter phone number"
                            className={`${FIELD} flex-1`}
                        />
                    </div>
                </div>

                <Divider />

                {/* Delete account */}
                <Button
                    variant="destructive-secondary"
                    size="lg"
                    leftIcon={<Trash01 className="size-5" aria-hidden />}
                    className="w-full rounded-full"
                    onClick={() => setDeleteOpen(true)}
                >
                    Delete account
                </Button>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button variant="primary" size="xl" disabled={!dirty} className="w-full rounded-full" onClick={save}>
                    Save changes
                </Button>
            </div>

            <DobSheet open={dobOpen} onClose={() => setDobOpen(false)} value={dob} onSelect={touch(setDob)} />
            <OptionSheet
                open={genderOpen}
                onClose={() => setGenderOpen(false)}
                title="Gender"
                options={["Male", "Female"]}
                value={gender}
                flat
                onConfirm={touch(setGender)}
            />
            <OptionSheet
                open={relationOpen}
                onClose={() => setRelationOpen(false)}
                title="Relation"
                options={RELATIONS}
                value={ecRelation}
                flat
                onConfirm={touch(setEcRelation)}
            />
            <PickerSheet
                open={picker === "country"}
                onClose={() => setPicker(null)}
                title="Country"
                searchPlaceholder="Search country..."
                options={COUNTRIES.map((c) => ({ value: c.name, label: c.name, flag: c.flag }))}
                value={country || undefined}
                onConfirm={(v) => touch(setCountry)(v)}
            />
            <PickerSheet
                open={picker === "state"}
                onClose={() => setPicker(null)}
                title={stateLabel}
                searchPlaceholder={`Search ${stateLabel.toLowerCase()}...`}
                options={(stateOptions ?? []).map((st) => ({ value: st, label: st }))}
                value={stateRegion || undefined}
                onConfirm={(v) => touch(setStateRegion)(v)}
            />

            {/* Delete account confirm */}
            <CustomerSheet open={deleteOpen} onClose={() => setDeleteOpen(false)}>
                <SheetToolbar title="" onClose={() => setDeleteOpen(false)} />
                <div className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#fee4e2]">
                        <Trash01 className="size-6 text-[#d92d20]" aria-hidden />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-7 text-[var(--brand-text)]">Delete your account?</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">
                            This permanently removes your profile, plans, and bookings. This can&apos;t be undone.
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        size="xl"
                        leftIcon={<LogOut01 className="size-5" aria-hidden />}
                        className="mt-1 w-full rounded-full"
                        onClick={() => {
                            setDeleteOpen(false);
                            logoutCustomer();
                            showToast("Account deleted", "Your account has been removed.", "success");
                            router.push("/customer");
                        }}
                    >
                        Delete account
                    </Button>
                </div>
            </CustomerSheet>

            {/* Photo crop overlay */}
            {pendingPhoto && (
                <div className="fixed inset-0 z-[80] mx-auto flex max-w-[500px] flex-col bg-[#4a4a4a]">
                    <div className="flex flex-1 items-center justify-center px-4">
                        <div className="aspect-square w-full overflow-hidden rounded-full ring-[3px] ring-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={pendingPhoto} alt="" className="size-full object-cover" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between px-6 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                        <button type="button" onClick={() => setPendingPhoto(null)} className="text-base font-medium text-white">
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setAvatar(pendingPhoto);
                                setPendingPhoto(null);
                                setDirty(true);
                            }}
                            className="text-base font-semibold text-white"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
