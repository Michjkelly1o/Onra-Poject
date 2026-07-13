"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Emergency contact (sign-up step) · `/customer/auth/emergency`
// ─────────────────────────────────────────────────────────────────────────────
//
// Final sign-up step (reached only from the sign-up OTP, once the new member is
// created + logged in). Reuses the same form body as the profile Emergency
// contact page (First/Last name, Phone via PhoneCountrySheet, Relation via
// OptionSheet), differing only in chrome (AuthHeader) + CTA ("Confirm" →
// Loading → Home). Confirm is disabled until first name + phone + relation.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { AuthHeader } from "@/components/customer/auth/AuthHeader";
import { Button } from "@/components/ui/button";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";
import { splitPhone } from "@/components/customers/CustomerFormPage";

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none transition-colors placeholder:text-[#667085] focus:border-[var(--brand-primary)]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";
const RELATIONS = ["Siblings", "Parent", "Spouse", "Child", "Friend", "Other"];

export default function AuthEmergencyPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const updateCustomer = useAppStore((s) => s.updateCustomer);
    const showToast = useAppStore((s) => s.showToast);
    const brandDisplayName = useAppStore((s) => s.brandingSettings.displayName) || "Forma";
    const scrollable = useMainScrollable();

    const initialPhone = splitPhone(undefined);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
    const [phone, setPhone] = useState("");
    const [relation, setRelation] = useState("");
    const [relationOpen, setRelationOpen] = useState(false);

    // Reachable only mid-sign-up (member just created + logged in). Otherwise home.
    useEffect(() => {
        if (!member) router.replace("/customer");
    }, [member, router]);

    const canConfirm = firstName.trim() !== "" && phone.trim() !== "" && relation !== "";

    function confirm() {
        if (!member || !canConfirm) return;
        updateCustomer(member.id, {
            emergencyContactName: `${firstName} ${lastName}`.trim(),
            emergencyContactPhone: `${phoneCountry.dial} ${phone}`.trim(),
            emergencyContactRelation: relation || undefined,
        });
        showToast("Account created", `Welcome to ${brandDisplayName}!`, "success", "check");
        router.replace("/customer/auth/loading");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader />

            <div className="flex flex-1 flex-col gap-6 px-4 pb-4 pt-[118px]">
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Emergency contact</h1>
                    <p className="text-base leading-6 text-[#667085]">
                        Provide a contact person we can reach in case of an emergency.
                    </p>
                </div>

                <div className="flex flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>First name</span>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter first name" className={FIELD} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>Last name</span>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter last name" className={FIELD} />
                    </label>
                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>Phone number</span>
                        <div className="flex items-stretch gap-2">
                            <PhoneCountrySheet value={phoneCountry} onChange={setPhoneCountry} />
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                                placeholder="Phone number"
                                className={`${FIELD} flex-1`}
                            />
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>Relation</span>
                        <button type="button" onClick={() => setRelationOpen(true)} className={`${FIELD} flex items-center text-left`}>
                            <span className={`flex-1 ${relation ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                                {relation || "Select relation"}
                            </span>
                            <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                        </button>
                    </div>
                </div>
            </div>

            <div className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${scrollable ? "bg-white" : ""}`}>
                <Button variant="primary" size="xl" disabled={!canConfirm} className="w-full rounded-full" onClick={confirm}>
                    Confirm
                </Button>
            </div>

            <OptionSheet
                open={relationOpen}
                onClose={() => setRelationOpen(false)}
                title="Relation"
                options={RELATIONS}
                value={relation}
                flat
                onConfirm={setRelation}
            />
        </div>
    );
}
