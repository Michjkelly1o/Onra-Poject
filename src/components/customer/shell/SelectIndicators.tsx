"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — selection indicators (radio + checkbox) — Figma 4206-87032 / 4206-87177
// ─────────────────────────────────────────────────────────────────────────────
//
// 16px indicators for flat selectable list rows (Timezone = radio, Instructor =
// checkbox). Unselected: 1px #d0d5dd border. Selected: brand-green (var(--brand-primary)) fill
// — a white centre dot (radio) or a white check (checkbox).

import { Check } from "@untitledui/icons";

export function RadioDot({ checked }: { checked: boolean }) {
    return checked ? (
        <span className="relative size-4 shrink-0 overflow-hidden rounded-full bg-[var(--brand-primary)]" aria-hidden>
            <span className="absolute inset-[31.25%] rounded-full bg-white" />
        </span>
    ) : (
        <span className="block size-4 shrink-0 rounded-full border border-[#d0d5dd]" aria-hidden />
    );
}

export function CheckBox({ checked }: { checked: boolean }) {
    return checked ? (
        <span className="flex size-4 shrink-0 items-center justify-center rounded bg-[var(--brand-primary)]" aria-hidden>
            <Check className="size-3 text-white" strokeWidth={3} />
        </span>
    ) : (
        <span className="block size-4 shrink-0 rounded border border-[#d0d5dd]" aria-hidden />
    );
}
