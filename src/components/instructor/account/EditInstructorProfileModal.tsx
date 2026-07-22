"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor profile · Edit modal (Figma 6378:546422)
// ─────────────────────────────────────────────────────────────────────────────
//
// The instructor-side equivalent of admin's `EditProfileModal`. Unlike admin
// (avatar + name only), the instructor edits everything that surfaces on
// their public-facing profile in one shot:
//   • avatar (Change image + Remove)
//   • First name + Last name (two-column)
//   • Email
//   • Phone (country code dropdown + number)
//   • Introduction (multi-line textarea, with helper text)
//
// All shell primitives + the form atoms come from the admin
// `AccountModals.tsx` so the visual language stays identical (no DS drift
// between admin and instructor account flows).

import { useRef, useState } from "react";
import { ImageUp } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import {
    ModalShell,
    ModalHeaderLeft,
    ModalFooter,
    LabeledInput,
} from "@/components/account/AccountModals";
import {
    PhoneCountryDropdown,
    splitPhone,
} from "@/components/customers/CustomerFormPage";
import { isValidEmail } from "@/lib/validation";

export interface InstructorProfileDraft {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    introduction: string;
    avatarUrl: string;
}

interface EditInstructorProfileModalProps {
    onClose: () => void;
    /** Initial values the modal opens with. Passed by the page. */
    initial: InstructorProfileDraft;
    onSubmit: (draft: InstructorProfileDraft) => void;
}

export function EditInstructorProfileModal({
    onClose,
    initial,
    onSubmit,
}: EditInstructorProfileModalProps) {
    const [firstName,    setFirstName]    = useState(initial.firstName);
    const [lastName,     setLastName]     = useState(initial.lastName);
    const [email,        setEmail]        = useState(initial.email);
    const [introduction, setIntroduction] = useState(initial.introduction);
    const [avatar,       setAvatar]       = useState(initial.avatarUrl);

    // Phone splits into a `{country, number}` pair the same way admin does it.
    const split = splitPhone(initial.phone);
    const [country, setCountry] = useState(split.country);
    const [number,  setNumber]  = useState(split.number);

    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") setAvatar(reader.result);
        };
        reader.readAsDataURL(file);
        // Clear so picking the same file twice still fires the change event.
        e.target.value = "";
    }

    // Save is enabled only when the required fields are populated AND the
    // email is syntactically valid. Phone is optional (the instructor may
    // temporarily clear it). The email check is the SAME `isValidEmail`
    // the admin Change Email modal uses — one rule across surfaces.
    const emailValid = isValidEmail(email);
    const emailDirty = email.trim().length > 0;
    const ready = firstName.trim().length > 0
        && lastName.trim().length > 0
        && emailValid;

    function handleSave() {
        const composedPhone = number.trim().length > 0
            ? `${country.dial} ${number.trim()}`
            : "";
        onSubmit({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: composedPhone,
            introduction: introduction.trim(),
            avatarUrl: avatar,
        });
    }

    return (
        <ModalShell onClose={onClose} width={520}>
            <ModalHeaderLeft title="Edit profile information" />

            {/* Scrollable body — capped so the modal stays short on tall
                screens. Header + footer remain pinned. */}
            <div className="overflow-y-auto" style={{ maxHeight: "min(60vh, 440px)" }}>
            <div className="flex flex-col gap-3.5 px-6 pt-3 pb-2 w-full">
                {/* Avatar uploader row — Change image + Remove */}
                <div className="flex items-center gap-3 w-full">
                    <div className="relative w-16 h-16 rounded-full overflow-hidden bg-[#e0e0e0] shrink-0">
                        {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#667085] text-[20px] font-semibold">
                                {(firstName[0] ?? "").toUpperCase()}{(lastName[0] ?? "").toUpperCase()}
                            </div>
                        )}
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImagePicked}
                    />
                    <Button
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<ImageUp className="w-5 h-5" />}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        Change image
                    </Button>
                    {avatar && (
                        <button
                            type="button"
                            onClick={() => setAvatar("")}
                            className="text-[14px] font-semibold text-[#b42318] hover:text-[#912018] px-1"
                        >
                            Remove
                        </button>
                    )}
                </div>

                {/* First / Last name row */}
                <div className="flex gap-4 w-full">
                    <LabeledInput label="First name" value={firstName} onChange={setFirstName} />
                    <LabeledInput label="Last name"  value={lastName}  onChange={setLastName} />
                </div>

                {/* Email — inline error when the typed value isn't a valid
                    address. We don't gate on dirty alone; the moment the
                    user clears the field below the threshold the helper
                    line guides them back into shape. */}
                <div className="flex flex-col gap-1.5 w-full">
                    <LabeledInput
                        label="Email"
                        value={email}
                        onChange={setEmail}
                        type="email"
                        placeholder="Enter email"
                    />
                    {emailDirty && !emailValid && (
                        <p className="text-[14px] text-[#b42318] leading-5">
                            Please enter a valid email address.
                        </p>
                    )}
                </div>

                {/* Phone — country code dropdown + numeric input.
                    Mirrors the composite the customer form uses. */}
                <div className="flex flex-col gap-1.5 w-full">
                    <p className="text-[14px] font-medium text-[#344054] leading-5">Phone number</p>
                    <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <PhoneCountryDropdown value={country} onChange={setCountry} />
                        <input
                            type="tel"
                            value={number}
                            onChange={e => setNumber(e.target.value.replace(/[^\d\s+]/g, ""))}
                            placeholder="Enter phone number"
                            className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent min-w-0 rounded-r-[8px]"
                        />
                    </div>
                </div>

                {/* Introduction textarea — customer-facing bio */}
                <div className="flex flex-col gap-1.5 w-full">
                    <p className="text-[14px] font-medium text-[#344054] leading-5">Introduction</p>
                    <textarea
                        value={introduction}
                        onChange={e => setIntroduction(e.target.value)}
                        rows={6}
                        placeholder="Tell customers about your experience and teaching style…"
                        className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-none"
                    />
                    <p className="text-[14px] text-[#667085] leading-5">
                        This introduction will be show in customer side
                    </p>
                </div>
            </div>
            </div>

            <ModalFooter
                onCancel={onClose}
                onPrimary={handleSave}
                primaryLabel="Save changes"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}
