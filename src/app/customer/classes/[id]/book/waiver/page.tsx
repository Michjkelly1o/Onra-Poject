"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Waiver Agreement (`/customer/classes/[id]/book/waiver`) — Figma 3686-63930
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4 gate — shown only to members with an unsigned booking waiver (first-
// timers). A green hint, the full waiver (Assumption of Risk · Health & Medical ·
// Release of Liability · Guardian Consent · Cancellation Policy), a "Sign here"
// signature pad, and an acknowledgment checkbox. When the customer is under 18
// (from their date of birth) a guardian-consent block appears automatically
// (guardian name + relationship) and the pad captures the PARENT / GUARDIAN
// signature; adults never see it. The page scrolls; the "Agree &
// continue" button sits in-flow at the very end, so it's only reached after
// reading to the bottom. Enabled once the waiver is signed + the box is ticked
// (+ guardian details, for a minor) → signs the waiver and forwards (mode/spot
// params) to Processing.

import { Suspense, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronLeft, Lightbulb02 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { REAL_TODAY_ISO } from "@/lib/customer/dates";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
import { SignaturePad } from "@/components/customer/shell/SignaturePad";
import { OptionSheet } from "@/components/customer/profile/OptionSheet";
import { Button } from "@/components/ui/button";

const WAIVER_SECTIONS: { heading: string; body: string; bullets?: string[] }[] = [
    {
        heading: "ASSUMPTION OF RISK & LIABILITY WAIVER",
        body: "I understand that participating in fitness classes, including but not limited to Pilates, Barre, and Reformer sessions, involves inherent risks including minor injuries such as scratches, bruises, and sprains, and major injuries including joint or back injuries, heart attacks, and strokes.",
    },
    {
        heading: "HEALTH & MEDICAL CONDITION",
        body: "I certify that I am in good physical condition and do not suffer from any disability, impairment, disease, or condition that would prevent my participation or make it unsafe for me to participate in fitness activities.",
    },
    {
        heading: "RELEASE OF LIABILITY",
        body: "I hereby release, waive, and discharge Onra Studio, its owners, employees, instructors, and agents from any and all liability, claims, demands, or causes of action arising out of or related to any loss, damage, or injury, including death, that may be sustained by me while participating in activities or while on the premises.",
    },
    {
        heading: "PARENT / GUARDIAN CONSENT (UNDER 18)",
        body: "If the participant is under 18 years of age, a parent or legal guardian must provide consent and sign on their behalf. By signing as guardian, I confirm I have the legal authority to consent to this waiver for the minor and I accept all terms above on their behalf.",
    },
    {
        heading: "CANCELLATION POLICY",
        body: "I understand and agree to the studio's cancellation policy:",
        bullets: [
            "Cancellations made 24+ hours before class: Full class refund",
            "Late cancellations (less than 24 hours): Class forfeited",
            "No-show: Class forfeited",
        ],
    },
];

const RELATIONSHIPS = ["Mother", "Father", "Legal guardian", "Grandparent", "Other"];

const INPUT_CLS =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[#667085] focus:border-[var(--brand-primary)] focus:outline-none";

/** Whole-year age from an ISO DOB, measured against the demo "today". */
function ageFrom(dob: string | undefined, todayISO: string): number | null {
    if (!dob) return null;
    const d = new Date(dob.length <= 10 ? `${dob}T00:00:00` : dob);
    if (Number.isNaN(d.getTime())) return null;
    const t = new Date(`${todayISO}T00:00:00`);
    let age = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) age--;
    return age;
}

export default function WaiverPage() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <Waiver />
        </Suspense>
    );
}

function Waiver() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const search = useSearchParams();
    const { member } = useCurrentCustomerContext();
    const signWaiver = useAppStore((s) => s.signWaiver);
    const showToast = useAppStore((s) => s.showToast);
    const scrolled = useMainScrolled();

    // Guardian consent is driven ENTIRELY by the customer's age (from their date
    // of birth): under 18 → guardian block required; 18+ → never shown. No manual
    // toggle. Unknown DOB is treated as an adult.
    const detectedAge = useMemo(() => ageFrom(member?.dateOfBirth, REAL_TODAY_ISO), [member?.dateOfBirth]);
    const isMinor = detectedAge !== null && detectedAge < 18;
    const [guardianName, setGuardianName] = useState("");
    const [relationship, setRelationship] = useState("");
    const [relOpen, setRelOpen] = useState(false);

    const [signed, setSigned] = useState(false);
    const [checked, setChecked] = useState(false);

    const guardianReady = !isMinor || (guardianName.trim().length > 0 && relationship.trim().length > 0);
    const canContinue = checked && signed && guardianReady && !!member;

    function agree() {
        if (!canContinue || !member) return;
        signWaiver(member.id, isMinor);
        showToast(
            "Waiver signed",
            isMinor
                ? `Guardian consent recorded for ${guardianName.trim()}.`
                : "Thanks — your waiver is on file.",
            "success",
            "check",
        );
        const params = search.toString();
        router.replace(`/customer/classes/${id}/book/processing${params ? `?${params}` : ""}`);
    }

    return (
        <div className="flex min-h-full flex-col">
            {/* Header — back + title; frosts on scroll, transparent at the top. */}
            <header
                className={`sticky top-0 z-20 flex w-full items-center gap-3 px-4 py-3 transition-colors ${
                    scrolled ? "bg-white/80 backdrop-blur-md" : ""
                }`}
            >
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    Waiver &amp; Liability Agreement
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            {/* Content scrolls; the action sits in-flow at the very bottom. */}
            <div className="flex flex-1 flex-col gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
                {/* Hint */}
                <div className="flex w-full items-center gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                    <Lightbulb02 className="size-5 shrink-0 text-[var(--brand-primary)]" aria-hidden />
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        Before you book this class, please read and agree to our waiver and liability terms.
                    </p>
                </div>

                {/* Waiver content */}
                <div className="flex w-full flex-col gap-3.5 rounded-xl border border-[#e4e7ec] bg-white p-4">
                    <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">Waiver</p>
                    {WAIVER_SECTIONS.map((s) => (
                        <div key={s.heading} className="flex flex-col gap-3.5">
                            <p className="text-sm font-medium leading-5 text-[var(--brand-text)]">{s.heading}</p>
                            <p className="text-sm font-normal leading-5 text-[#475467]">{s.body}</p>
                            {s.bullets && (
                                <ul className="list-disc pl-5">
                                    {s.bullets.map((b) => (
                                        <li key={b} className="text-sm font-normal leading-5 text-[#475467]">
                                            {b}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))}
                </div>

                {/* Parent / guardian consent — shown automatically only when the
                    customer is under 18 (based on their date of birth). */}
                {isMinor && (
                    <div className="flex w-full flex-col gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4">
                        <div className="flex flex-col gap-0.5">
                            <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">Parent / guardian consent</p>
                            <p className="text-xs font-normal leading-[18px] text-[#667085]">
                                The attendee is under 18 — a parent or legal guardian must consent and sign below.
                            </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="guardian-name" className="text-sm font-medium leading-5 text-[#344054]">
                                Parent / guardian full name
                            </label>
                            <input
                                id="guardian-name"
                                type="text"
                                value={guardianName}
                                onChange={(e) => setGuardianName(e.target.value)}
                                placeholder="e.g. Sara Al-Rashid"
                                className={INPUT_CLS}
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="guardian-relation" className="text-sm font-medium leading-5 text-[#344054]">
                                Relationship to minor
                            </label>
                            <button
                                type="button"
                                id="guardian-relation"
                                onClick={() => setRelOpen(true)}
                                className={`${INPUT_CLS} flex items-center text-left`}
                            >
                                <span className={`flex-1 ${relationship ? "text-[var(--brand-text)]" : "text-[#667085]"}`}>
                                    {relationship || "Select relationship"}
                                </span>
                                <ChevronDown className="size-5 shrink-0 text-[#667085]" aria-hidden />
                            </button>
                        </div>
                    </div>
                )}

                {/* Sign here — the signature pad (customer or, for a minor, guardian). */}
                <div className="flex w-full flex-col gap-2">
                    <p className="text-sm font-semibold leading-5 text-[var(--brand-text)]">
                        {isMinor ? "Parent / guardian signature" : "Sign here"}
                    </p>
                    <SignaturePad
                        key={isMinor ? "guardian" : "self"}
                        onChange={setSigned}
                        ariaLabel={isMinor ? "Parent or guardian signature" : "Your signature"}
                    />
                </div>

                {/* Acknowledgment */}
                <button
                    type="button"
                    onClick={() => setChecked((v) => !v)}
                    className="flex w-full items-start gap-2 text-left"
                    aria-pressed={checked}
                >
                    <span className="pt-0.5">
                        <CheckBox checked={checked} />
                    </span>
                    <span className="text-sm font-medium leading-5 text-[#344054]">
                        {isMinor
                            ? "I am the parent / legal guardian and I consent to the terms on behalf of the minor"
                            : "I have read and agree to the terms"}
                    </span>
                </button>

                {/* Action — in-flow (not sticky); reached after reading to the end. */}
                <Button
                    variant="primary"
                    size="xl"
                    className="mt-2 w-full rounded-full"
                    disabled={!canContinue}
                    onClick={agree}
                >
                    Agree &amp; continue
                </Button>
            </div>

            <OptionSheet
                open={relOpen}
                onClose={() => setRelOpen(false)}
                title="Relationship to minor"
                options={RELATIONSHIPS}
                value={relationship}
                flat
                onConfirm={setRelationship}
            />
        </div>
    );
}
