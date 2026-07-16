"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Create account (sign-up form) · `/customer/auth/signup` · Figma 3228-22480
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached from the email step for a valid, unregistered email (prefilled +
// read-only here). Collects the new member's details, then → OTP (sign-up mode);
// the `customers` row is created on Verify. Reuses the profile bottom sheets
// (DobSheet / OptionSheet / PhoneCountrySheet). Create account is disabled until
// the required fields + the Privacy/Terms checkbox are satisfied. Full-screen.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { authDraft } from "@/lib/customer/auth-flow";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { AuthHeader, AUTH_CONTENT_OFFSET } from "@/components/customer/auth/AuthHeader";
import { Button } from "@/components/ui/button";
import { DobSheet } from "@/components/customer/profile/DobSheet";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";
import { splitPhone } from "@/components/customers/CustomerFormPage";

const FIELD =
    "w-full rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none transition-colors placeholder:text-[#667085] focus:border-[var(--brand-primary)]";
const LABEL = "text-sm font-medium leading-5 text-[#344054]";
const GENDERS = ["Male", "Female"];

function formatDob(iso: string): string {
    if (!iso) return "";
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function Checkbox({ checked, onToggle, children }: { checked: boolean; onToggle: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onToggle} className="flex w-full items-start gap-2 text-left">
            <span
                className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded transition-colors ${
                    checked ? "bg-[var(--brand-primary)]" : "border border-[#d0d5dd] bg-white"
                }`}
            >
                {checked && <Check className="size-3 text-white" aria-hidden />}
            </span>
            <span className="flex-1 text-sm leading-5 text-[#667085]">{children}</span>
        </button>
    );
}

export default function AuthSignupPage() {
    const router = useRouter();
    const scrollable = useMainScrollable();
    const customers = useAppStore((st) => st.customers);

    const [firstName, setFirstName] = useState(authDraft.signup?.firstName ?? "");
    const [lastName, setLastName] = useState(authDraft.signup?.lastName ?? "");
    const [dob, setDob] = useState(authDraft.signup?.dateOfBirth ?? "");
    const [gender, setGender] = useState(authDraft.signup?.gender ?? "");
    const initialPhone = splitPhone(authDraft.signup?.phone);
    const [phoneCountry, setPhoneCountry] = useState(initialPhone.country);
    const [phone, setPhone] = useState(initialPhone.number);
    const [referral, setReferral] = useState(authDraft.signup?.referralCode ?? "");
    const [agreed, setAgreed] = useState(false);
    const [marketingOptOut, setMarketingOptOut] = useState(false);

    const [dobOpen, setDobOpen] = useState(false);
    const [genderOpen, setGenderOpen] = useState(false);

    // No email in the flow (refresh / deep link) → back to the entry.
    useEffect(() => {
        if (!authDraft.email) router.replace("/customer/auth");
    }, [router]);

    // A referral code is optional; if entered we confirm it against the seed's
    // customer referral codes (e.g. Ava's "AVAWRI") — invalid never blocks sign-up.
    const referralTrimmed = referral.trim();
    const referralValid =
        referralTrimmed === ""
            ? null
            : customers.some((c) => c.referralCode?.toUpperCase() === referralTrimmed.toUpperCase());

    const canSubmit =
        firstName.trim() !== "" &&
        lastName.trim() !== "" &&
        dob !== "" &&
        gender !== "" &&
        phone.trim() !== "" &&
        agreed;

    function createAccount() {
        if (!canSubmit) return;
        authDraft.mode = "signup";
        authDraft.signup = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            dateOfBirth: dob,
            gender,
            phone: `${phoneCountry.dial} ${phone}`.trim(),
            referralCode: referral.trim() || undefined,
            marketingOptOut,
        };
        router.push("/customer/auth/otp");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader onClose={() => router.back()} />

            <div className={`flex flex-1 flex-col items-center gap-6 px-4 pb-4 ${AUTH_CONTENT_OFFSET}`}>
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Create an account</h1>
                    <p className="text-base leading-6 text-[#667085]">
                        Fill in your details to complete your account setup.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>First name</span>
                        <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter first name" className={FIELD} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>Last name</span>
                        <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter last name" className={FIELD} />
                    </label>

                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>Date of birth</span>
                        <button type="button" onClick={() => setDobOpen(true)} className={`${FIELD} flex items-center text-left`}>
                            <span className={`flex-1 ${dob ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                                {formatDob(dob) || "Enter date of birth"}
                            </span>
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

                    <div className="flex flex-col gap-1.5">
                        <span className={LABEL}>Email</span>
                        <div className="w-full rounded-lg border border-[#d0d5dd] bg-[#f9fafb] px-3.5 py-2.5 text-base leading-6 text-[#667085]">
                            {authDraft.email}
                        </div>
                    </div>

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

                    <label className="flex flex-col gap-1.5">
                        <span className={LABEL}>Referral code (optional)</span>
                        <input
                            value={referral}
                            onChange={(e) => setReferral(e.target.value)}
                            placeholder="Enter referral code"
                            autoCapitalize="characters"
                            className={FIELD}
                        />
                        {referralValid === true && (
                            <span className="text-sm leading-5 text-[var(--brand-primary)]">Referral code applied.</span>
                        )}
                        {referralValid === false && (
                            <span className="text-sm leading-5 text-[#667085]">
                                We couldn&rsquo;t find that code — you can still continue.
                            </span>
                        )}
                    </label>

                    <div className="mt-1 flex flex-col gap-4">
                        <Checkbox checked={agreed} onToggle={() => setAgreed((v) => !v)}>
                            I agree to the{" "}
                            <span className="font-semibold text-[var(--brand-primary)]">Privacy Policy</span> and{" "}
                            <span className="font-semibold text-[var(--brand-primary)]">Terms and Conditions</span>
                        </Checkbox>
                        <Checkbox checked={marketingOptOut} onToggle={() => setMarketingOptOut((v) => !v)}>
                            I do not wish to receive marketing notifications with offers and news
                        </Checkbox>
                    </div>
                </div>
            </div>

            <div className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${scrollable ? "bg-white" : ""}`}>
                <Button variant="primary" size="xl" disabled={!canSubmit} className="w-full rounded-full" onClick={createAccount}>
                    Create account
                </Button>
            </div>

            <DobSheet open={dobOpen} onClose={() => setDobOpen(false)} value={dob} onSelect={setDob} />
            <OptionSheet
                open={genderOpen}
                onClose={() => setGenderOpen(false)}
                title="Gender"
                options={GENDERS}
                value={gender}
                flat
                onConfirm={setGender}
            />
        </div>
    );
}
