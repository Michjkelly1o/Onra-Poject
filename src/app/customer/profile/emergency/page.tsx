"use client";

// Customer — Emergency contact (`/customer/profile/emergency`) — full-page form.
// Edit first/last name, phone, relation. Writes `customers` via the store + toasts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Button } from "@/components/ui/button";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { splitPhone } from "@/components/customers/CustomerFormPage";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[#101828] outline-none transition-colors placeholder:text-[#667085] focus:border-[#658774]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";
const RELATIONS = ["Siblings", "Parent", "Spouse", "Child", "Friend", "Other"];

export default function EmergencyContactPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const updateCustomer = useAppStore((s) => s.updateCustomer);
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();

    const nameParts = (member?.emergencyContactName ?? "").trim().split(/\s+/);
    const initialPhone = splitPhone(member?.emergencyContactPhone);
    const [firstName, setFirstName] = useState(nameParts[0] ?? "");
    const [lastName, setLastName] = useState(nameParts.slice(1).join(" "));
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
    const [phone, setPhone] = useState(initialPhone.number);
    const [relation, setRelation] = useState(member?.emergencyContactRelation ?? "");
    const [relationOpen, setRelationOpen] = useState(false);
    const [dirty, setDirty] = useState(false);

    function touch<T>(setter: (v: T) => void) {
        return (v: T) => {
            setter(v);
            setDirty(true);
        };
    }

    function save() {
        if (!member) return;
        updateCustomer(member.id, {
            emergencyContactName: `${firstName} ${lastName}`.trim(),
            emergencyContactPhone: `${phoneCountry.dial} ${phone}`.trim(),
            emergencyContactRelation: relation || undefined,
        });
        showToast("Emergency contact updated", "All changes has been saved.", "success");
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
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">
                    Emergency contact
                </h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-[80px]">
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>First name</span>
                    <input value={firstName} onChange={(e) => touch(setFirstName)(e.target.value)} placeholder="Enter first name" className={FIELD} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className={LABEL}>Last name</span>
                    <input value={lastName} onChange={(e) => touch(setLastName)(e.target.value)} placeholder="Enter last name" className={FIELD} />
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
                <div className="flex flex-col gap-1.5">
                    <span className={LABEL}>Relation</span>
                    <button type="button" onClick={() => setRelationOpen(true)} className={`${FIELD} flex items-center text-left`}>
                        <span className={`flex-1 ${relation ? "text-[#101828]" : "text-[#667085]"}`}>
                            {relation || "Select relation"}
                        </span>
                        <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    </button>
                </div>
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

            <OptionSheet
                open={relationOpen}
                onClose={() => setRelationOpen(false)}
                title="Relation"
                options={RELATIONS}
                value={relation}
                flat
                onConfirm={touch(setRelation)}
            />
        </div>
    );
}
