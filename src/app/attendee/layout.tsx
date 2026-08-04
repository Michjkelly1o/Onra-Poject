"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Attendee persona layout
// ─────────────────────────────────────────────────────────────────────────────
//
// The attendee view is a chrome-less, floor-facing check-in surface (its own
// AttendeeTopBar, no admin sidebar). This layout's ONLY job is the URL-driven
// persona flip: landing on any `/attendee/*` route pushes the Attendees demo
// persona (Robin Vega) into `currentUser`, so `updateAttendance` stamps the
// attendee's name on the attendance trail and the top-bar identity reads right.
// Mirrors the instructor layout's auto-flip; per CLAUDE.md the demo flow is
// URL-driven, and role/currentUser are per-tab (not persisted), so a fresh
// attendee tab boots here and flips cleanly.

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { attendee_profile } from "@/data/mock/attendee_profile";

export default function AttendeeLayout({ children }: { children: React.ReactNode }) {
    const currentUser = useAppStore((s) => s.currentUser);
    const setCurrentUser = useAppStore((s) => s.setCurrentUser);

    useEffect(() => {
        // Skip the write when the Attendees persona is already active so it
        // never causes a render loop.
        if (currentUser.role === "attendee" && currentUser.email === attendee_profile.email) return;
        setCurrentUser(attendee_profile);
    }, [setCurrentUser, currentUser.role, currentUser.email]);

    return <>{children}</>;
}
