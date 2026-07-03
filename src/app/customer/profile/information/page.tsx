"use client";

// Customer — Profile information (`/customer/profile/information`) — full-page form.
// Edit name, photo (crop overlay), DOB (calendar sheet), gender (option sheet),
// email, phone. Save writes `customers` via the store + toasts.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Camera01, ChevronDown, ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { DobSheet } from "@/components/customer/profile/DobSheet";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { Button } from "@/components/ui/button";
import { splitPhone } from "@/components/customers/CustomerFormPage";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[#101828] outline-none transition-colors placeholder:text-[#667085] focus:border-[#658774]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";

function dobLabel(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function ProfileInformationPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const updateCustomer = useAppStore((s) => s.updateCustomer);
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();

    const initialPhone = splitPhone(member?.phone);
    const [firstName, setFirstName] = useState(member?.firstName ?? "");
    const [lastName, setLastName] = useState(member?.lastName ?? "");
    const [dob, setDob] = useState(member?.dateOfBirth ?? "");
    const [gender, setGender] = useState(member?.gender ?? "");
    const [email, setEmail] = useState(member?.email ?? "");
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
    const [phone, setPhone] = useState(initialPhone.number);
    const [avatar, setAvatar] = useState(member?.imageUrl ?? "");
    const [dirty, setDirty] = useState(false);

    const [dobOpen, setDobOpen] = useState(false);
    const [genderOpen, setGenderOpen] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);
    const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);

    function touch<T>(setter: (v: T) => void) {
        return (v: T) => {
            setter(v);
            setDirty(true);
        };
    }

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
                            <div className="flex size-24 items-center justify-center rounded-full bg-[#e0e0e0] text-2xl font-semibold text-[#475467] ring-4 ring-white">
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
                        <span className={`flex-1 ${dob ? "text-[#101828]" : "text-[#667085]"}`}>
                            {dob ? dobLabel(dob) : "Enter date of birth"}
                        </span>
                        <Calendar className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>

                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Gender</span>
                    <button type="button" onClick={() => setGenderOpen(true)} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 ${gender ? "text-[#101828]" : "text-[#667085]"}`}>
                            {gender || "Select gender"}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>

                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Email</span>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => touch(setEmail)(e.target.value)}
                        className={FIELD}
                    />
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
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button
                    variant="primary"
                    size="xl"
                    disabled={!dirty}
                    className="w-full rounded-full"
                    onClick={save}
                >
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
