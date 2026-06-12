"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Account settings · Modal chain (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// All seven Figma modal screens for the four account flows live here, plus
// the shared primitives they reuse:
//
//   • ModalShell        — fixed overlay + centered white card + close X.
//                         Two shell variants by `align` prop:
//                           "left"   — Edit profile (title flush left, divider).
//                           "center" — verification flows (featured icon +
//                                       centered title + supporting text).
//   • FeaturedIcon      — 48×48 mint-pill (#d7ffe9) with an inline icon —
//                         matches the verification-flow Figma frames.
//   • LabeledInput      — standard text input with label.
//   • PasswordInput     — text input with eye/eye-off show/hide toggle
//                         (brief explicitly requires the eye icon to work).
//   • OtpInput          — 4-cell mega code input with focus auto-advance +
//                         backspace-to-prev + paste-spread. Matches the
//                         80×80 cells from Figma 4346:278002.
//
// Modals (one component per Figma frame):
//   1. EditProfileModal            (4346:271454)
//   2. ChangeEmailVerifyModal      (4344:266656)
//   3. ChangeEmailOtpModal         (4346:266742)
//   4. ChangeEmailNewModal         (4346:267459)
//   5. ChangePhoneNewModal         (4346:272487)
//   6. ChangePhoneOtpModal         (4346:278002)
//   7. ChangePasswordModal         (4346:282772 + 4346:283485 — same modal,
//                                    different fill states, live validation
//                                    flips the requirement checks green)
//
// FlowState wiring lives in the page (../app/admin/settings/account/page.tsx).

import { useEffect, useRef, useState } from "react";
import { XClose, Mail01, Phone, Lock02, Eye, EyeOff, ImageUp, Check } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    PHONE_COUNTRIES,
    PhoneCountryDropdown,
    splitPhone,
    type PhoneCountry,
} from "@/components/customers/CustomerFormPage";
import { isValidEmail } from "@/lib/validation";

// ─── Shell primitives ───────────────────────────────────────────────────────

/** Shared modal overlay + card. The two shell variants in the Figma differ
 *  only in their header shape — left-aligned title (Edit profile) vs centered
 *  featured-icon + title + supporting text (verification flows). */
export function ModalShell({
    onClose,
    children,
    width = 400,
}: {
    onClose: () => void;
    children: React.ReactNode;
    width?: number;
}) {
    // Esc key closes the modal — same convention as the Payments + Integrations modals.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div
                className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col"
                style={{ width }}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                    aria-label="Close"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                {children}
            </div>
        </div>
    );
}

/** Left-aligned modal header — used by Edit profile only.
 *  Title at top, then a 20px gap and a 1px divider line. */
export function ModalHeaderLeft({ title }: { title: string }) {
    return (
        <div className="flex flex-col w-full">
            <div className="pt-6 px-6 pb-0">
                <p className="text-[18px] font-semibold text-[#101828] leading-7">{title}</p>
            </div>
            <div className="h-5 w-full" />
            <div className="h-px w-full bg-[#e4e7ec]" />
        </div>
    );
}

/** Centered modal header — used by every verification-flow modal.
 *  Mint-pill featured icon + centered title + supporting text. */
function ModalHeaderCenter({
    icon,
    title,
    supporting,
}: {
    icon: React.ReactNode;
    title: string;
    supporting: React.ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4 items-center pt-6 px-6 pb-5 w-full">
            <FeaturedIcon>{icon}</FeaturedIcon>
            <div className="flex flex-col gap-1 items-center text-center w-full">
                <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">{title}</p>
                <p className="text-[14px] text-[#475467] leading-5 w-full">{supporting}</p>
            </div>
        </div>
    );
}

/** 48×48 mint-pill (#d7ffe9 — brand secondary) carrying a 24px icon centered. */
function FeaturedIcon({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-12 h-12 rounded-full bg-[#d7ffe9] flex items-center justify-center shrink-0">
            {children}
        </div>
    );
}

/** Two-button footer: Cancel (secondary-gray) + a primary/disabled action.
 *  Both buttons split the width 50/50. The primary action's label and
 *  disabled state are passed in by the caller. */
export function ModalFooter({
    onCancel,
    onPrimary,
    primaryLabel,
    primaryDisabled = false,
}: {
    onCancel: () => void;
    onPrimary: () => void;
    primaryLabel: string;
    primaryDisabled?: boolean;
}) {
    return (
        <div className="flex flex-col items-start pt-6 w-full">
            <div className="flex gap-3 items-start pb-6 px-6 w-full">
                <Button
                    variant="secondary-gray"
                    size="lg"
                    className="flex-1"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    size="lg"
                    className="flex-1"
                    disabled={primaryDisabled}
                    onClick={onPrimary}
                >
                    {primaryLabel}
                </Button>
            </div>
        </div>
    );
}

// ─── Field primitives ───────────────────────────────────────────────────────

const INPUT_CLS =
    "h-10 w-full px-[14px] py-[10px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[14px] font-medium text-[#344054] leading-5">
            {children}
        </p>
    );
}

export function LabeledInput({
    label,
    value,
    onChange,
    placeholder,
    type = "text",
    autoFocus = false,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "email" | "tel";
    autoFocus?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <FieldLabel>{label}</FieldLabel>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                autoFocus={autoFocus}
                className={INPUT_CLS}
            />
        </div>
    );
}

/** Password input with show/hide eye toggle — required by the brief. */
function PasswordInput({
    label,
    value,
    onChange,
    placeholder = "Enter password",
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <FieldLabel>{label}</FieldLabel>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(INPUT_CLS, "pr-[48px]")}
                />
                <button
                    type="button"
                    onClick={() => setShow(s => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-[6px] hover:bg-[#f2f4f7] text-[#475467] hover:text-[#101828] transition-colors"
                    aria-label={show ? "Hide password" : "Show password"}
                    title={show ? "Hide password" : "Show password"}
                >
                    {show ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}

/** 4-cell mega OTP input — single contiguous state with per-cell focus.
 *
 *  • Each cell holds one digit, 80×80 with 48px display text (matches Figma).
 *  • Typing a digit auto-advances to the next cell.
 *  • Backspace on an empty cell jumps to the previous cell and clears it.
 *  • Pasting a string spreads the digits across cells starting from focus. */
function OtpInput({
    length,
    value,
    onChange,
    autoFocus = false,
}: {
    length: number;
    value: string;
    onChange: (v: string) => void;
    autoFocus?: boolean;
}) {
    const refs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus) refs.current[0]?.focus();
    }, [autoFocus]);

    function setCell(i: number, ch: string) {
        const digits = (value + "").padEnd(length, " ").split("");
        digits[i] = ch;
        const next = digits.join("").trimEnd();
        onChange(next.slice(0, length));
    }

    function handleChange(i: number, raw: string) {
        const digit = raw.replace(/\D/g, "").slice(-1);
        if (!digit) return;
        setCell(i, digit);
        if (i < length - 1) refs.current[i + 1]?.focus();
    }

    function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace") {
            const current = value[i] ?? "";
            if (current) {
                setCell(i, " ");
            } else if (i > 0) {
                refs.current[i - 1]?.focus();
                setCell(i - 1, " ");
            }
            e.preventDefault();
        }
        if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
        if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
    }

    function handlePaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
        const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length - i);
        if (!digits) return;
        e.preventDefault();
        const padded = (value + "").padEnd(length, " ").split("");
        for (let j = 0; j < digits.length; j++) padded[i + j] = digits[j];
        const next = padded.join("").trimEnd().slice(0, length);
        onChange(next);
        refs.current[Math.min(i + digits.length, length - 1)]?.focus();
    }

    return (
        <div className="flex gap-3 items-start justify-center">
            {Array.from({ length }).map((_, i) => {
                const ch = value[i] ?? "";
                const filled = !!ch && ch !== " ";
                return (
                    <input
                        key={i}
                        ref={el => { refs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={filled ? ch : ""}
                        onChange={e => handleChange(i, e.target.value)}
                        onKeyDown={e => handleKeyDown(i, e)}
                        onPaste={e => handlePaste(i, e)}
                        onFocus={e => e.target.select()}
                        className={cn(
                            "w-[64px] h-[64px] sm:w-[72px] sm:h-[72px] rounded-[12px] border-1 text-center font-medium text-[40px] sm:text-[48px] leading-[60px] tracking-[-0.96px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-colors",
                            filled
                                ? "text-[#101828] border-[#7ba08c]"
                                : "text-[#d0d5dd] border-[#d0d5dd]"
                        )}
                    />
                );
            })}
        </div>
    );
}

/** "Didn't get a code? Resend." caption used under both OTP inputs. */
function ResendCaption({ onResend }: { onResend: () => void }) {
    return (
        <p className="text-[14px] text-[#475467] leading-5 text-center w-full">
            Didn&apos;t get a code?{" "}
            <button
                type="button"
                onClick={onResend}
                className="underline font-medium text-[#475467] hover:text-[#344054]"
            >
                Resend
            </button>
            .
        </p>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1 — Edit profile (Figma 4346:271454)
// ─────────────────────────────────────────────────────────────────────────────

export function EditProfileModal({
    initialFirstName,
    initialLastName,
    initialAvatar,
    onClose,
    onSubmit,
}: {
    initialFirstName: string;
    initialLastName: string;
    initialAvatar: string;
    onClose: () => void;
    onSubmit: (next: { firstName: string; lastName: string; avatarUrl: string }) => void;
}) {
    const [firstName, setFirstName] = useState(initialFirstName);
    const [lastName, setLastName] = useState(initialLastName);
    const [avatar, setAvatar] = useState(initialAvatar);
    const fileInputRef = useRef<HTMLInputElement>(null);

    function handleImagePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        // Read as data URL so the preview + persisted avatar work without a
        // real upload backend. Phase 3 swaps this for a centralized seed.
        const reader = new FileReader();
        reader.onload = () => setAvatar(String(reader.result || ""));
        reader.readAsDataURL(file);
    }

    const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0;

    return (
        <ModalShell onClose={onClose} width={544}>
            <ModalHeaderLeft title="Edit profile" />

            <div className="flex flex-col gap-4 px-6 py-5 w-full">
                {/* Avatar + Change / Remove */}
                <div className="flex items-center gap-4 w-full">
                    <div className="relative w-24 h-24 rounded-full overflow-hidden bg-[#e0e0e0] shrink-0">
                        {avatar
                            // eslint-disable-next-line @next/next/no-img-element
                            ? <img src={avatar} alt="" className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center text-[#667085] text-[24px] font-semibold">
                                {(firstName[0] ?? "").toUpperCase()}{(lastName[0] ?? "").toUpperCase()}
                            </div>
                        }
                        <div className="absolute inset-0 rounded-full border-1 border-[rgba(0,0,0,0.08)] pointer-events-none" />
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

                {/* First name + Last name */}
                <div className="flex gap-4 items-start w-full">
                    <LabeledInput
                        label="First name"
                        value={firstName}
                        onChange={setFirstName}
                        placeholder="Enter first name"
                    />
                    <LabeledInput
                        label="Last name"
                        value={lastName}
                        onChange={setLastName}
                        placeholder="Enter last name"
                    />
                </div>
            </div>

            <ModalFooter
                onCancel={onClose}
                onPrimary={() =>
                    onSubmit({
                        firstName: firstName.trim(),
                        lastName: lastName.trim(),
                        avatarUrl: avatar,
                    })
                }
                primaryLabel="Update"
                primaryDisabled={!canSubmit}
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 — Change email · Step 1: Verify current email (Figma 4344:266656)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangeEmailVerifyModal({
    currentEmail,
    onClose,
    onSendCode,
}: {
    currentEmail: string;
    onClose: () => void;
    onSendCode: () => void;
}) {
    return (
        <ModalShell onClose={onClose}>
            <ModalHeaderCenter
                icon={<Mail01 className="w-6 h-6 text-[#079455]" />}
                title="Verify email address"
                supporting={
                    <>
                        We&apos;ll need to verify your old email address,{" "}
                        <span className="font-semibold text-[#475467]">{currentEmail}</span>{" "}
                        in order to change it.
                    </>
                }
            />
            <ModalFooter
                onCancel={onClose}
                onPrimary={onSendCode}
                primaryLabel="Send code"
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3 — Change email · Step 2: Enter code (Figma 4346:266742)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangeEmailOtpModal({
    onClose,
    onVerify,
    onResend,
}: {
    onClose: () => void;
    onVerify: () => void;
    onResend: () => void;
}) {
    const [code, setCode] = useState("");
    const ready = code.replace(/\s/g, "").length >= 4;
    return (
        <ModalShell onClose={onClose}>
            <ModalHeaderCenter
                icon={<Mail01 className="w-6 h-6 text-[#079455]" />}
                title="Enter code"
                supporting="To change your email address, please enter the verification code we've sent to your current email."
            />
            <div className="flex flex-col gap-2 px-6 w-full">
                <FieldLabel>Verification code</FieldLabel>
                <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter verification code"
                    autoFocus
                    className={INPUT_CLS}
                />
                <ResendCaption onResend={onResend} />
            </div>
            <ModalFooter
                onCancel={onClose}
                onPrimary={onVerify}
                primaryLabel="Verify"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4 — Change email · Step 3: New email + current password (Figma 4346:267459)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangeEmailNewModal({
    onClose,
    onDone,
}: {
    onClose: () => void;
    onDone: (newEmail: string) => void;
}) {
    const [newEmail, setNewEmail] = useState("");
    const [password, setPassword] = useState("");
    // Use the shared validator so every form (Account → Change email,
    // Customer create, Staff create, Instructor Edit profile) gates on
    // the SAME rule.
    const validEmail = isValidEmail(newEmail);
    const emailDirty = newEmail.trim().length > 0;
    const ready = validEmail && password.length > 0;
    return (
        <ModalShell onClose={onClose}>
            <ModalHeaderCenter
                icon={<Mail01 className="w-6 h-6 text-[#079455]" />}
                title="Enter a new email address"
                supporting="Enter the new email address to update your account."
            />
            <div className="flex flex-col gap-4 px-6 py-5 w-full">
                <div className="flex flex-col gap-1.5 w-full">
                    <LabeledInput
                        label="Email address"
                        value={newEmail}
                        onChange={setNewEmail}
                        placeholder="Enter email address"
                        type="email"
                        autoFocus
                    />
                    {emailDirty && !validEmail && (
                        <p className="text-[14px] text-[#b42318] leading-5">
                            Please enter a valid email address.
                        </p>
                    )}
                </div>
                <PasswordInput
                    label="Current password"
                    value={password}
                    onChange={setPassword}
                />
            </div>
            <ModalFooter
                onCancel={onClose}
                onPrimary={() => onDone(newEmail.trim())}
                primaryLabel="Done"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 — Change phone · Step 1: Enter a phone number (Figma 4346:272487)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangePhoneNewModal({
    currentPhone,
    onClose,
    onSend,
}: {
    currentPhone: string;
    onClose: () => void;
    onSend: (country: PhoneCountry, number: string) => void;
}) {
    const initial = splitPhone(currentPhone);
    const [country, setCountry] = useState(initial.country);
    const [number, setNumber] = useState("");
    const ready = number.replace(/\D/g, "").length >= 6;
    return (
        <ModalShell onClose={onClose}>
            <ModalHeaderCenter
                icon={<Phone className="w-6 h-6 text-[#079455]" />}
                title="Enter a phone number"
                supporting="Enter your phone number to receive an OTP for verification."
            />
            <div className="flex flex-col gap-2 px-6 py-5 w-full">
                <FieldLabel>Phone number</FieldLabel>
                {/* Combined dial-code + national-number input — exact same
                    chrome as the customer-create form. NB: do NOT add
                    `overflow-hidden` to the wrapper — it would clip the
                    country dropdown menu when it opens below the field. */}
                <div className="flex items-stretch border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <PhoneCountryDropdown value={country} onChange={setCountry} />
                    <input
                        type="tel"
                        value={number}
                        onChange={e => setNumber(e.target.value.replace(/[^\d\s]/g, ""))}
                        placeholder="Enter phone number"
                        className="flex-1 h-10 px-[14px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none bg-transparent min-w-0 rounded-r-[8px]"
                    />
                </div>
            </div>
            <ModalFooter
                onCancel={onClose}
                onPrimary={() => onSend(country, number.trim())}
                primaryLabel="Send"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6 — Change phone · Step 2: Verify your number (Figma 4346:278002)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangePhoneOtpModal({
    onClose,
    onVerify,
    onResend,
}: {
    onClose: () => void;
    onVerify: () => void;
    onResend: () => void;
}) {
    const [code, setCode] = useState("");
    const ready = code.replace(/\s/g, "").length === 4;
    return (
        <ModalShell onClose={onClose} width={460}>
            <ModalHeaderCenter
                icon={<Phone className="w-6 h-6 text-[#079455]" />}
                title="Verify your number"
                supporting="Enter the 4 digit code we sent to your phone number."
            />
            <div className="flex flex-col gap-4 items-center px-6 w-full">
                <OtpInput length={4} value={code} onChange={setCode} autoFocus />
                <ResendCaption onResend={onResend} />
            </div>
            <ModalFooter
                onCancel={onClose}
                onPrimary={onVerify}
                primaryLabel="Verify"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7 — Change password (Figma 4346:282772 + 4346:283485 — same modal)
// ─────────────────────────────────────────────────────────────────────────────

export function ChangePasswordModal({
    onClose,
    onDone,
}: {
    onClose: () => void;
    /** Receives the new password so the store can persist it — which the
     *  Account page's Password row then reveals via its eye-toggle. */
    onDone: (newPassword: string) => void;
}) {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");

    // Two live validation checks shown under the form. Both flip green when
    // satisfied — matches Figma 4346:283485 (the "filled state" of the same
    // modal).
    const longEnough = next.length >= 8;
    const hasSpecial = /[^A-Za-z0-9]/.test(next);
    const confirmsMatch = next.length > 0 && next === confirm;
    const ready = current.length > 0 && longEnough && hasSpecial && confirmsMatch;

    return (
        <ModalShell onClose={onClose}>
            <ModalHeaderCenter
                icon={<Lock02 className="w-6 h-6 text-[#079455]" />}
                title="Update your password"
                supporting="Enter your current password and new password."
            />
            <div className="flex flex-col gap-4 px-6 py-5 w-full">
                <PasswordInput
                    label="Current password"
                    value={current}
                    onChange={setCurrent}
                />
                <PasswordInput
                    label="New password"
                    value={next}
                    onChange={setNext}
                    placeholder="Enter new password"
                />
                <PasswordInput
                    label="Confirm new password"
                    value={confirm}
                    onChange={setConfirm}
                    placeholder="Enter new password"
                />
                <div className="flex flex-col gap-3 w-full">
                    <RequirementRow met={longEnough}>
                        Must be at least 8 characters
                    </RequirementRow>
                    <RequirementRow met={hasSpecial}>
                        Must contain one special character
                    </RequirementRow>
                </div>
            </div>
            <ModalFooter
                onCancel={onClose}
                onPrimary={() => onDone(next)}
                primaryLabel="Done"
                primaryDisabled={!ready}
            />
        </ModalShell>
    );
}

/** Single requirement row — grey circle when unmet, green check when met.
 *  Matches Figma 5613:43340 / 5613:43320 (the two requirement-row states). */
function RequirementRow({ met, children }: { met: boolean; children: React.ReactNode }) {
    return (
        <div className="flex gap-2 items-center w-full">
            <div
                className={cn(
                    "w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0",
                    met ? "bg-[#dcfae6]" : "bg-[#d0d5dd]"
                )}
            >
                <Check className={cn("w-3 h-3", met ? "text-[#079455]" : "text-white")} />
            </div>
            <p className="flex-1 text-[14px] text-[#667085] leading-5">{children}</p>
        </div>
    );
}
