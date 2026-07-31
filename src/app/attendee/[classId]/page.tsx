"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Module 13 — Attendee class details route (`/attendee/[classId]`)
// ─────────────────────────────────────────────────────────────────────────────
//
// A STANDALONE full-page view of the attendance details — opened in its own
// browser tab (e.g. from the Schedule → Class Details "Attendee" tab). It reuses
// the exact same <AttendeeDetailContent> as the Attendee module, rendered in the
// "page" variant (no close button). The Attendee module's calendar renders the
// same content inline as a right slide panel instead.

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AttendeeDetailContent } from "@/components/attendee/AttendeeDetailPanel";

export default function AttendeeDetailRoute() {
    return <Suspense fallback={null}><AttendeeDetailRoutePage /></Suspense>;
}

function AttendeeDetailRoutePage() {
    const params = useParams();
    const classId = String(params.classId);
    return (
        <div className="h-screen bg-white overflow-hidden">
            <AttendeeDetailContent classId={classId} variant="page" />
        </div>
    );
}
