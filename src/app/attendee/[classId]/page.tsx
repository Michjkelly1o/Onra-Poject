"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Module 13 — Attendee class details route (`/attendee/[classId]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// The class-details view is a wide right slide panel — <AttendeeDetailPanel>.
// The PRIMARY entry is the Attendee calendar's "View details", which opens that
// panel inline (no navigation). This route only handles a direct URL / deep
// link: it opens the same panel over a blank backdrop and, on close, returns to
// `returnTo` (defaults to /attendee).

import { Suspense, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AttendeeDetailPanel } from "@/components/attendee/AttendeeDetailPanel";

export default function AttendeeDetailRoute() {
    return <Suspense fallback={null}><AttendeeDetailRoutePanel /></Suspense>;
}

function AttendeeDetailRoutePanel() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const classId = String(params.classId);
    const returnTo = searchParams?.get("returnTo") || "/attendee";
    const [open, setOpen] = useState(true);
    return (
        <AttendeeDetailPanel
            open={open}
            classId={classId}
            onClose={() => { setOpen(false); window.setTimeout(() => router.push(returnTo), 260); }}
        />
    );
}
