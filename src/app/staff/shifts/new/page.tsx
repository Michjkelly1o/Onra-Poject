"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shifts → New (route)
// ─────────────────────────────────────────────────────────────────────────────
//
// Thin top-level route — renders full-screen (no admin sidebar/header
// chrome), same convention as /class-types/new and /services/new.
//
// `useSearchParams()` is wrapped in <Suspense> because Next.js 14
// requires a Suspense boundary around any client hook that reads search
// params; otherwise `next build` errors during static prerender.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShiftFormPage } from "@/components/staff/ShiftFormPage";

function NewShiftInner() {
    const sp = useSearchParams();
    const returnTo = sp.get("returnTo") ?? "/admin/staff";
    return <ShiftFormPage mode="create" returnTo={returnTo} />;
}

export default function NewShiftRoute() {
    return <Suspense fallback={null}><NewShiftInner /></Suspense>;
}
