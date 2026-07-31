"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DEV PREVIEW · Class-creation wizard widgets (Phase 1 exit criterion)
// ─────────────────────────────────────────────────────────────────────────────
//
// A storybook-style page that renders every AiQuestionPrompt widget kind and
// every rich-option state against mock data — no agent, no store writes. This
// is the Phase 1 deliverable from
// `new-prd/class-creation-in-agent-implementation-plan.md`: prove the input
// components match the Figma frames before any wiring exists.
//
// Route: /admin/dev/class-wizard-widgets

import { useState } from "react";
import {
    AiQuestionPrompt,
    type AiQuestionSpec,
    type AiQuestionAnswer,
} from "@/ai-agent/components/AiQuestionPrompt";

interface Demo {
    id: string;
    /** What flow step this maps to. */
    caption: string;
    /** Figma frame reference. */
    frame: string;
    spec: AiQuestionSpec;
}

// ── Step 1 · Class template picker (rich cards) — frames 1, 2 ────────────────
const TEMPLATE_PICKER: AiQuestionSpec = {
    title: "Which class template do you want to schedule?",
    kind: "radio",
    otherPlaceholder: "Or create one from scratch…",
    options: [
        {
            id: "reformer",
            label: "Reformer Pilates",
            subtitle: "Low-impact strength on the reformer.",
            thumbnailUrl: "/images/class-template/reformer-pilates.webp",
            attributes: ["50 min", "6 spots", "Pilates"],
        },
        {
            id: "barre",
            label: "Barre Sculpt",
            subtitle: "Ballet-inspired conditioning.",
            thumbnailUrl: "/images/class-template/berre.webp",
            attributes: ["45 min", "12 spots", "Barre"],
        },
        {
            id: "hot-yoga",
            label: "Hot Yoga",
            subtitle: "Vinyasa flow in a heated studio.",
            thumbnailUrl: "/images/class-template/hot-yoga.webp",
            attributes: ["60 min", "20 spots", "Yoga"],
        },
    ],
};

// ── Step 1 · Gender access — frame 3 ─────────────────────────────────────────
const GENDER_ACCESS: AiQuestionSpec = {
    title: "Who can book this class?",
    kind: "radio",
    allowOther: false,
    options: [
        { id: "all", label: "All genders" },
        { id: "women", label: "Women only" },
        { id: "men", label: "Men only" },
    ],
};

// ── Step 2 · Room picker (searchable + hard-block) — frame 5 ──────────────────
const ROOM_PICKER: AiQuestionSpec = {
    title: "Which room should it run in?",
    kind: "searchable",
    searchPlaceholder: "Search rooms…",
    otherPlaceholder: "+ Add a new room",
    options: [
        { id: "mat", label: "Mat Studio", subtitle: "South branch · cap 20" },
        { id: "reformer-room", label: "Reformer Room", subtitle: "South branch · cap 8" },
        {
            id: "spin",
            label: "Spin Studio",
            subtitle: "South branch · cap 24",
            disabled: true,
            disabledReason: "Used by another class at this time",
            badge: { label: "In use", tone: "warning" },
        },
        { id: "recovery", label: "Recovery Suite", subtitle: "North branch · cap 6" },
    ],
};

// ── Step 2 · Equipment (checkbox multi + "Something else") — frame 6 ──────────
const EQUIPMENT: AiQuestionSpec = {
    title: "What equipment will be used?",
    kind: "checkbox",
    minSelected: 0,
    allowOther: true,
    otherPlaceholder: "Something else (comma-separated)…",
    options: [
        { id: "mat", label: "Mat" },
        { id: "resistance", label: "Resistance bands" },
        { id: "ring", label: "Pilates ring" },
        { id: "dumbbells", label: "Light dumbbells" },
    ],
};

// ── Step 2 · Instructor picker (searchable, avatar + rating) — frame 8 ────────
const INSTRUCTOR_PICKER: AiQuestionSpec = {
    title: "Who's teaching this class?",
    kind: "searchable",
    searchPlaceholder: "Search instructors…",
    allowOther: false,
    options: [
        {
            id: "liam",
            label: "Liam Chen",
            subtitle: "Pilates · Barre",
            avatarUrl: "/images/instructors/liam-chen.webp",
            rating: 4.8,
        },
        {
            id: "maya",
            label: "Maya Johnson",
            subtitle: "Yoga · Recovery",
            avatarUrl: "/images/instructors/maya-johnson.webp",
            rating: 4.9,
        },
        {
            id: "lucy",
            label: "Lucy Hale",
            subtitle: "Barre",
            avatarUrl: "/images/instructors/lucy-hale.webp",
            rating: 4.6,
        },
        {
            id: "sarah",
            label: "Sarah Al Rashid",
            subtitle: "Yoga",
            avatarInitials: "SA",
            rating: 4.7,
        },
    ],
};

// ── Step 2 · Pay rate — frame 9 ──────────────────────────────────────────────
const PAY_RATE: AiQuestionSpec = {
    title: "Which pay rate should apply to this instructor for this class?",
    kind: "radio",
    allowOther: false,
    options: [
        { id: "standard", label: "Standard", subtitle: "AED 120 per class" },
        { id: "tiers", label: "Class Tiers", subtitle: "Scaled by attendance" },
        { id: "split", label: "Split Rate", subtitle: "Base + per-attendee" },
        { id: "senior", label: "Senior Rate", subtitle: "AED 180 per class" },
        { id: "monthly", label: "Monthly Rate", subtitle: "Fixed monthly salary" },
    ],
};

// ── Scratch path · Applicable plans (grouped checkbox) — insert step ──────────
const APPLICABLE_PLANS: AiQuestionSpec = {
    title: "Which plans can book this class?",
    kind: "checkbox",
    minSelected: 0,
    allowOther: false,
    options: [
        { id: "m-unlimited", label: "Unlimited Monthly", groupLabel: "Memberships", badge: { label: "Membership", tone: "success" } },
        { id: "m-basic", label: "Basic Monthly", groupLabel: "Memberships", badge: { label: "Membership", tone: "success" } },
        { id: "p-10", label: "10-Class Pack", groupLabel: "Packages", badge: { label: "Package", tone: "neutral" } },
        { id: "p-20", label: "20-Class Pack", groupLabel: "Packages", badge: { label: "Package", tone: "neutral" } },
    ],
};

// ── Grouped single-select (templates by category) — grouped-kind proof ───────
const GROUPED_TEMPLATES: AiQuestionSpec = {
    title: "Pick a template",
    kind: "grouped",
    allowOther: false,
    options: [
        { id: "g-reformer", label: "Reformer Pilates", groupLabel: "Pilates" },
        { id: "g-mat", label: "Mat Pilates", groupLabel: "Pilates" },
        { id: "g-hot", label: "Hot Yoga", groupLabel: "Yoga" },
        { id: "g-vin", label: "Vinyasa Flow", groupLabel: "Yoga" },
        { id: "g-barre", label: "Barre Sculpt", groupLabel: "Barre" },
    ],
};

const DEMOS: Demo[] = [
    { id: "template", caption: "Step 1 · Template picker (rich cards)", frame: "364-189373 / 365-139753", spec: TEMPLATE_PICKER },
    { id: "gender", caption: "Step 1 · Gender access", frame: "368-130883", spec: GENDER_ACCESS },
    { id: "room", caption: "Step 2 · Room picker (searchable + hard-block)", frame: "369-119753", spec: ROOM_PICKER },
    { id: "equipment", caption: "Step 2 · Equipment (checkbox + something else)", frame: "369-125854", spec: EQUIPMENT },
    { id: "instructor", caption: "Step 2 · Instructor picker (avatar + rating)", frame: "380-125323", spec: INSTRUCTOR_PICKER },
    { id: "payrate", caption: "Step 2 · Pay rate (5 of 5)", frame: "382-124222", spec: PAY_RATE },
    { id: "plans", caption: "Scratch · Applicable plans (grouped checkbox)", frame: "scratch insert", spec: APPLICABLE_PLANS },
    { id: "grouped", caption: "Grouped single-select proof", frame: "grouped kind", spec: GROUPED_TEMPLATES },
];

// Multi-step proof — exercises the pager + Q/A accumulation across kinds.
const MULTI_STEP: AiQuestionSpec[] = [TEMPLATE_PICKER, GENDER_ACCESS, EQUIPMENT];

export default function ClassWizardWidgetsDevPage() {
    const [log, setLog] = useState<Record<string, string>>({});

    const record = (id: string, answers: AiQuestionAnswer[]) => {
        setLog((prev) => ({ ...prev, [id]: JSON.stringify(answers) }));
    };

    return (
        <div className="min-h-screen bg-[#f9fafb] py-10">
            <div className="mx-auto w-full max-w-[720px] px-6">
                <header className="mb-8">
                    <p className="text-[12px] font-semibold uppercase tracking-wide text-[#667085]">Dev preview</p>
                    <h1 className="text-[24px] font-semibold text-[#101828] leading-8">Class-creation wizard widgets</h1>
                    <p className="mt-1 text-[14px] text-[#475467]">
                        Phase 1 · every <code className="text-[#3f8f68]">AiQuestionPrompt</code> kind + rich-option state,
                        mock data only. No agent, no store writes.
                    </p>
                </header>

                <div className="flex flex-col gap-10">
                    {DEMOS.map((d) => (
                        <section key={d.id}>
                            <div className="mb-2 flex items-baseline justify-between gap-3">
                                <h2 className="text-[15px] font-semibold text-[#101828]">{d.caption}</h2>
                                <span className="text-[12px] text-[#98a2b3] tabular-nums shrink-0">{d.frame}</span>
                            </div>
                            <AiQuestionPrompt
                                questions={[d.spec]}
                                onComplete={(a) => record(d.id, a)}
                            />
                            {log[d.id] && (
                                <p className="mt-2 text-[12px] text-[#475467] font-mono break-all">→ {log[d.id]}</p>
                            )}
                        </section>
                    ))}

                    <section>
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                            <h2 className="text-[15px] font-semibold text-[#101828]">
                                Multi-step (pager · 1 of 3, mixed kinds)
                            </h2>
                            <span className="text-[12px] text-[#98a2b3] shrink-0">pager</span>
                        </div>
                        <AiQuestionPrompt questions={MULTI_STEP} onComplete={(a) => record("multi", a)} />
                        {log["multi"] && (
                            <p className="mt-2 text-[12px] text-[#475467] font-mono break-all">→ {log["multi"]}</p>
                        )}
                    </section>

                    <section>
                        <div className="mb-2 flex items-baseline justify-between gap-3">
                            <h2 className="text-[15px] font-semibold text-[#101828]">Compact panel (checkbox — Confirm required)</h2>
                            <span className="text-[12px] text-[#98a2b3] shrink-0">compact</span>
                        </div>
                        <AiQuestionPrompt compact questions={[EQUIPMENT]} onComplete={(a) => record("compact-multi", a)} />
                        {log["compact-multi"] && (
                            <p className="mt-2 text-[12px] text-[#475467] font-mono break-all">→ {log["compact-multi"]}</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
