"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Waiver Agreement (`/customer/classes/[id]/book/waiver`) — Figma 3686-63930
// ─────────────────────────────────────────────────────────────────────────────
//
// Phase 4 gate — shown only to members with an unsigned booking waiver (first-
// timers). A green hint, the full waiver (Assumption of Risk · Health & Medical ·
// Release of Liability · Cancellation Policy), and an acknowledgment checkbox.
// The page scrolls; the "Agree & continue" button sits in-flow at the very end,
// so it's only reached after reading to the bottom. Enabled once the box is
// ticked → signs the waiver and forwards (mode/spot params) to Processing.

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Lightbulb02 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useMainScrolled } from "@/lib/customer/use-scrollable";
import { CheckBox } from "@/components/customer/shell/SelectIndicators";
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
        heading: "CANCELLATION POLICY",
        body: "I understand and agree to the studio's cancellation policy:",
        bullets: [
            "Cancellations made 24+ hours before class: Full class refund",
            "Late cancellations (less than 24 hours): Class forfeited",
            "No-show: Class forfeited",
        ],
    },
];

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
    const scrolled = useMainScrolled();

    const [checked, setChecked] = useState(false);

    function agree() {
        if (!checked || !member) return;
        signWaiver(member.id);
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
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[#101828]">
                    Waiver &amp; Liability Agreement
                </p>
                <div className="size-10 shrink-0" aria-hidden />
            </header>

            {/* Content scrolls; the action sits in-flow at the very bottom. */}
            <div className="flex flex-1 flex-col gap-4 px-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-6">
                {/* Hint */}
                <div className="flex w-full items-center gap-3 rounded-xl border border-[#7ba08c] bg-[#e9fff3] p-4">
                    <Lightbulb02 className="size-5 shrink-0 text-[#4f6e5d]" aria-hidden />
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        Before you book this class, please read and agree to our waiver and liability terms.
                    </p>
                </div>

                {/* Waiver content */}
                <div className="flex w-full flex-col gap-3.5 rounded-xl border border-[#e4e7ec] bg-white p-4">
                    <p className="text-sm font-semibold leading-5 text-[#101828]">Waiver</p>
                    {WAIVER_SECTIONS.map((s) => (
                        <div key={s.heading} className="flex flex-col gap-3.5">
                            <p className="text-sm font-medium leading-5 text-[#101828]">{s.heading}</p>
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
                    <span className="text-sm font-medium leading-5 text-[#344054]">I have read and agree to the terms</span>
                </button>

                {/* Action — in-flow (not sticky); reached after reading to the end. */}
                <Button
                    variant="primary"
                    size="xl"
                    className="mt-2 w-full rounded-full"
                    disabled={!checked}
                    onClick={agree}
                >
                    Agree &amp; continue
                </Button>
            </div>
        </div>
    );
}
