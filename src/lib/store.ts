"use client";

import { create } from "zustand";
import type { UserRole, User } from "@/types";
import { adminUser } from "./mock-data";

// ─── Shared types ─────────────────────────────────────────────────────────────

export type TemplateStatus = "Active" | "Archived" | "Inactive";
export type ClassStatus    = "Upcoming" | "Ongoing" | "Completed" | "Cancelled";

export interface ClassTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    locationType: string;
    durationMin: number;
    capacity: number;
    status: TemplateStatus;
    coverImage?: string;
    coverColor: string;
    applicableMemberships: string[];
}

export interface ToastData {
    id: string;
    title: string;
    message: string;
    type: "success" | "error";
    icon?: "check" | "trash" | "archive" | "slash" | "refresh";
}

// ─── Schedule types ───────────────────────────────────────────────────────────

export interface ScheduleInstructor {
    id: string;
    name: string;
    initials: string;
    color: string;
    /** Optional profile photo for table cells / avatars. */
    imageUrl?: string;
}

export interface ClassInstance {
    id: string;
    templateId: string;
    name: string;
    description: string;
    category: string;
    instructorId: string;
    instructorName: string;
    instructorInitials: string;
    instructorColor: string;
    location: string;
    room: string;
    date: string;          // "Sat, 27 Feb 2025"
    dateISO: string;       // "2025-02-27"
    dayOfWeek: string;
    startTime: string;     // "09:00"
    endTime: string;       // "10:00"
    displayTime: string;   // "09:00 - 10:00 AM"
    booked: number;
    capacity: number;
    equipment: string;
    spotSelectionEnabled: boolean;
    waitlistEnabled: boolean;
    rating: number;
    ratingCount: number;
    status: ClassStatus;
    recurrenceGroupId?: string;
    cancelledAt?: string;
    cancelledBy?: string;
    coverColor: string;
    coverImage?: string;
}

export interface ClassBooking {
    id: string;
    classInstanceId: string;
    customerId: string;
    customerName: string;
    customerInitials: string;
    customerColor: string;
    planId: string;
    planName: string;
    bookingTime: string;
    status: "booked" | "waitlisted" | "cancelled";
    attendanceStatus: "pending" | "present" | "no_show" | "late_cancel";
    cancelledAt?: string;
    refundCreditIssued?: boolean;
    waitlistPosition?: number;
    cancellationReason?: string;
}

/** Customer record — shared across Add-customer modal, customer module, etc. */
export interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    initials: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;     // YYYY-MM-DD
    gender?: string;
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    streetAddress?: string;
    /** "membership" | "package" | null (no plan yet — newly-created customer). */
    planKind: "membership" | "package" | null;
    planName?: string;
    /** Optional profile photo for table cells / avatars. */
    imageUrl?: string;
    createdAt: string;
}

export interface ClassRating {
    id: string;
    classInstanceId: string;
    customerId: string;
    customerName: string;
    customerInitials: string;
    customerColor: string;
    score: number;
    comment: string;
    /** Optional "What stood out" pill tags (e.g. "Instructor", "Pacing", "Atmosphere", "Difficulty"). */
    tags?: string[];
    submittedAt: string;
    deletedAt?: string;
    deletedBy?: string;
}

// ─── Schedule mock data ───────────────────────────────────────────────────────

export const SCHEDULE_INSTRUCTORS: ScheduleInstructor[] = [
    { id: "i1", name: "Maya Johnson",   initials: "MJ", color: "#f79009", imageUrl: "/images/instructors/maya-johnson.webp" },
    { id: "i2", name: "Liam Chen",      initials: "LC", color: "#4b8c9a", imageUrl: "/images/instructors/liam-chen.webp" },
    { id: "i3", name: "Sara Al-Rashid", initials: "SA", color: "#7c5cbf", imageUrl: "/images/instructors/sarah al rashid.webp" },
    { id: "i4", name: "Lucy Hale",      initials: "LH", color: "#d92d20", imageUrl: "/images/instructors/lucy-hale.webp" },
];

export const ROOMS = [
    { id: "r1", name: "Reformer Studio", capacity: 12 },
    { id: "r2", name: "Mat Studio",      capacity: 20 },
    { id: "r3", name: "Barre Studio",    capacity: 15 },
    { id: "r4", name: "Studio A",        capacity: 20 },
    { id: "r5", name: "Studio B",        capacity: 15 },
];

const INITIAL_CLASS_INSTANCES: ClassInstance[] = [
    {
        id: "c1",  templateId: "5",  name: "Mat Pilates",
        description: "Classical Pilates exercises on the mat. Strengthens the core and improves overall body alignment.",
        category: "Pilates",
        instructorId: "i2", instructorName: "Liam Chen",      instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Sat, 01 Mar 2025", dateISO: "2025-03-01", dayOfWeek: "Sat",
        startTime: "13:00", endTime: "14:00", displayTime: "01:00 - 02:00 PM",
        booked: 0, capacity: 8, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Upcoming", coverColor: "#e9fff3",
    },
    {
        id: "c2",  templateId: "5",  name: "Mat Pilates",
        description: "Classical Pilates exercises on the mat. Strengthens the core and improves overall body alignment.",
        category: "Pilates",
        instructorId: "i2", instructorName: "Liam Chen",      instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Fri, 28 Feb 2025", dateISO: "2025-02-28", dayOfWeek: "Fri",
        startTime: "15:30", endTime: "16:30", displayTime: "03:30 - 04:30 PM",
        booked: 0, capacity: 8, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Upcoming", coverColor: "#e9fff3",
    },
    {
        id: "c3",  templateId: "1",  name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        category: "Pilates",
        instructorId: "i3", instructorName: "Sara Al-Rashid", instructorInitials: "SA", instructorColor: "#7c5cbf",
        location: "FitLab South", room: "Reformer Studio",
        date: "Fri, 28 Feb 2025", dateISO: "2025-02-28", dayOfWeek: "Fri",
        startTime: "13:30", endTime: "14:30", displayTime: "01:30 - 02:30 PM",
        booked: 0, capacity: 8, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Upcoming", coverColor: "#e9fff3",
    },
    {
        id: "c4",  templateId: "3",  name: "Barre",
        description: "Ballet-inspired low-impact workout that sculpts and tones using small isometric movements.",
        category: "Barre",
        instructorId: "i1", instructorName: "Maya Johnson",   instructorInitials: "MJ", instructorColor: "#f79009",
        location: "FitLab South", room: "Barre Studio",
        date: "Fri, 28 Feb 2025", dateISO: "2025-02-28", dayOfWeek: "Fri",
        startTime: "10:30", endTime: "11:30", displayTime: "10:30 - 11:30 AM",
        booked: 12, capacity: 12, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Upcoming", coverColor: "#e0f9f4",
    },
    {
        id: "c5",  templateId: "5",  name: "Mat Pilates",
        description: "Classical Pilates exercises on the mat. Strengthens the core and improves overall body alignment.",
        category: "Pilates",
        instructorId: "i2", instructorName: "Liam Chen",      instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Fri, 28 Feb 2025", dateISO: "2025-02-28", dayOfWeek: "Fri",
        startTime: "09:30", endTime: "10:30", displayTime: "09:30 - 10:30 AM",
        booked: 8, capacity: 8, equipment: "Resistance bands, Yoga blocks", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Ongoing", coverColor: "#e9fff3",
    },
    {
        id: "c6",  templateId: "1",  name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        category: "Pilates",
        instructorId: "i3", instructorName: "Sara Al-Rashid", instructorInitials: "SA", instructorColor: "#7c5cbf",
        location: "FitLab South", room: "Reformer Studio",
        date: "Thu, 27 Feb 2025", dateISO: "2025-02-27", dayOfWeek: "Thu",
        startTime: "14:30", endTime: "15:30", displayTime: "02:30 - 03:30 PM",
        booked: 8, capacity: 10, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 4.0, ratingCount: 5, status: "Completed", coverColor: "#e9fff3",
    },
    {
        id: "c7",  templateId: "4",  name: "Roller Release",
        description: "A foam roller–based recovery class to release muscle tension and improve mobility.",
        category: "Recovery",
        instructorId: "i2", instructorName: "Liam Chen",      instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Wed, 26 Feb 2025", dateISO: "2025-02-26", dayOfWeek: "Wed",
        startTime: "13:00", endTime: "14:00", displayTime: "01:00 - 02:00 PM",
        booked: 0, capacity: 8, equipment: "Foam rollers", spotSelectionEnabled: false, waitlistEnabled: false,
        rating: 0, ratingCount: 0, status: "Cancelled", cancelledAt: "2025-02-25T10:00:00Z", cancelledBy: "Alex Owen",
        coverColor: "#f0f4f8",
    },
    {
        id: "c8",  templateId: "6",  name: "Hot Yoga",
        description: "Traditional Hatha yoga sequence practised in a heated room to increase flexibility and detoxify.",
        category: "Yoga",
        instructorId: "i1", instructorName: "Maya Johnson",   instructorInitials: "MJ", instructorColor: "#f79009",
        location: "FitLab South", room: "Studio A",
        date: "Tue, 25 Feb 2025", dateISO: "2025-02-25", dayOfWeek: "Tue",
        startTime: "07:00", endTime: "08:15", displayTime: "07:00 - 08:15 AM",
        booked: 12, capacity: 16, equipment: "Yoga mats, Blocks, Straps", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 4.5, ratingCount: 8, status: "Completed", coverColor: "#fff8e9",
    },
    {
        id: "c9",  templateId: "3",  name: "Barre",
        description: "Ballet-inspired low-impact workout that sculpts and tones using small isometric movements.",
        category: "Barre",
        instructorId: "i1", instructorName: "Maya Johnson",   instructorInitials: "MJ", instructorColor: "#f79009",
        location: "FitLab South", room: "Barre Studio",
        date: "Mon, 24 Feb 2025", dateISO: "2025-02-24", dayOfWeek: "Mon",
        startTime: "11:00", endTime: "12:00", displayTime: "11:00 AM - 12:00 PM",
        booked: 10, capacity: 15, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 4.8, ratingCount: 6, status: "Completed", coverColor: "#e0f9f4",
    },
    {
        id: "c10", templateId: "1",  name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        category: "Pilates",
        instructorId: "i3", instructorName: "Sara Al-Rashid", instructorInitials: "SA", instructorColor: "#7c5cbf",
        location: "FitLab South", room: "Reformer Studio",
        date: "Sat, 01 Mar 2025", dateISO: "2025-03-01", dayOfWeek: "Sat",
        startTime: "10:00", endTime: "11:00", displayTime: "10:00 - 11:00 AM",
        booked: 5, capacity: 12, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Upcoming", coverColor: "#e9fff3",
    },
    // Completed class preview — 15 booked, 12 present + 3 no-show, 5 ratings live + 2 deleted.
    {
        id: "c12", templateId: "5",  name: "Mat Pilates",
        description: "Classic mat-based Pilates focusing on core strength and controlled movements.",
        category: "Pilates",
        instructorId: "i2", instructorName: "Liam Chen", instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Fri, 28 Feb 2025", dateISO: "2025-02-28", dayOfWeek: "Fri",
        startTime: "09:00", endTime: "10:00", displayTime: "09:00 - 10:00 AM",
        booked: 15, capacity: 15, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 4.0, ratingCount: 5, status: "Completed",
        coverColor: "#e9fff3",
    },
    // Cancelled class preview — 8 bookings, all cancelled with full refund (>24h before class).
    {
        id: "c11", templateId: "5",  name: "Mat Pilates",
        description: "Classic mat-based Pilates focusing on core strength and controlled movements.",
        category: "Pilates",
        instructorId: "i2", instructorName: "Liam Chen", instructorInitials: "LC", instructorColor: "#4b8c9a",
        location: "FitLab South", room: "Mat Studio",
        date: "Fri, 27 Feb 2026", dateISO: "2026-02-27", dayOfWeek: "Fri",
        startTime: "09:00", endTime: "10:00", displayTime: "09:00 - 10:00 AM",
        booked: 0, capacity: 8, equipment: "", spotSelectionEnabled: false, waitlistEnabled: true,
        rating: 0, ratingCount: 0, status: "Cancelled",
        cancelledAt: "2026-02-25T11:00:00Z", cancelledBy: "Alex Owen",
        coverColor: "#e9fff3",
    },
];

// ─── Mock bookings ────────────────────────────────────────────────────────────

const INITIAL_CLASS_BOOKINGS: ClassBooking[] = [
    // c5 — Mat Pilates, Fri 28 Feb, Ongoing, 8/8 (all booked, pending attendance)
    { id: "b1",  classInstanceId: "c5", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-21T09:15:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b2",  classInstanceId: "c5", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-21T10:30:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b3",  classInstanceId: "c5", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-22T07:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b4",  classInstanceId: "c5", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-22T11:45:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b5",  classInstanceId: "c5", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-23T08:20:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b6",  classInstanceId: "c5", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-23T14:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b7",  classInstanceId: "c5", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-24T09:10:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b8",  classInstanceId: "c5", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-25T16:30:00Z", status: "booked",    attendanceStatus: "pending" },

    // c4 — Barre, Fri 28 Feb, Upcoming, 12/12 full + 3 waitlisted
    { id: "b9",  classInstanceId: "c4", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-19T08:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b10", classInstanceId: "c4", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-19T09:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b11", classInstanceId: "c4", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-19T10:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b12", classInstanceId: "c4", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-20T07:30:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b13", classInstanceId: "c4", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T08:15:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b14", classInstanceId: "c4", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-20T09:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b15", classInstanceId: "c4", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-21T07:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b16", classInstanceId: "c4", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T08:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b17", classInstanceId: "c4", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-22T07:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b18", classInstanceId: "c4", customerId: "cu10", customerName: "Mia Anderson", customerInitials: "MA", customerColor: "#175cd3", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-22T09:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b19", classInstanceId: "c4", customerId: "cu11", customerName: "Ethan Davis", customerInitials: "ED", customerColor: "#7c5cbf", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-23T07:00:00Z", status: "booked",    attendanceStatus: "pending" },
    { id: "b20", classInstanceId: "c4", customerId: "cu12", customerName: "Rania Saleh", customerInitials: "RS", customerColor: "#658774", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-23T08:30:00Z", status: "booked",    attendanceStatus: "pending" },
    // 3 waitlisted
    { id: "b21", classInstanceId: "c4", customerId: "cu13", customerName: "Lily Nguyen", customerInitials: "LN", customerColor: "#dc6803", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-24T07:00:00Z", status: "waitlisted", attendanceStatus: "pending", waitlistPosition: 1 },
    { id: "b22", classInstanceId: "c4", customerId: "cu14", customerName: "Hassan Al-Mansoori", customerInitials: "HA", customerColor: "#4b8c9a", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-24T09:00:00Z", status: "waitlisted", attendanceStatus: "pending", waitlistPosition: 2 },
    { id: "b23", classInstanceId: "c4", customerId: "cu15", customerName: "Chloe Kim", customerInitials: "CK", customerColor: "#f79009", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-25T08:00:00Z", status: "waitlisted", attendanceStatus: "pending", waitlistPosition: 3 },
    // 2 cancelled
    { id: "b24", classInstanceId: "c4", customerId: "cu16", customerName: "Tariq Mahmoud", customerInitials: "TM", customerColor: "#344054", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-18T09:00:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2025-02-20T11:00:00Z", cancellationReason: "Personal conflict", refundCreditIssued: true },
    { id: "b25", classInstanceId: "c4", customerId: "cu17", customerName: "Dana Al-Rashid", customerInitials: "DR", customerColor: "#0a6b3c", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-19T07:00:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2025-02-22T08:00:00Z", cancellationReason: "Sick", refundCreditIssued: true },

    // c6 — Reformer Pilates, Thu 27 Feb, Completed, 8/10
    { id: "b26", classInstanceId: "c6", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b27", classInstanceId: "c6", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-20T10:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b28", classInstanceId: "c6", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-21T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b29", classInstanceId: "c6", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-21T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b30", classInstanceId: "c6", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-22T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b31", classInstanceId: "c6", customerId: "cu10", customerName: "Mia Anderson", customerInitials: "MA", customerColor: "#175cd3", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-22T10:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b32", classInstanceId: "c6", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-23T08:00:00Z", status: "booked", attendanceStatus: "no_show" },
    { id: "b33", classInstanceId: "c6", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-23T09:00:00Z", status: "booked", attendanceStatus: "no_show" },

    // c8 — Hot Yoga, Tue 25 Feb, Completed, 12/16
    { id: "b34", classInstanceId: "c8", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-18T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b35", classInstanceId: "c8", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-18T10:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b36", classInstanceId: "c8", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-19T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b37", classInstanceId: "c8", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-19T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b38", classInstanceId: "c8", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b39", classInstanceId: "c8", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-20T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b40", classInstanceId: "c8", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-21T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b41", classInstanceId: "c8", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b42", classInstanceId: "c8", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-22T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b43", classInstanceId: "c8", customerId: "cu10", customerName: "Mia Anderson", customerInitials: "MA", customerColor: "#175cd3", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-22T09:00:00Z", status: "booked", attendanceStatus: "no_show" },
    { id: "b44", classInstanceId: "c8", customerId: "cu11", customerName: "Ethan Davis", customerInitials: "ED", customerColor: "#7c5cbf", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-23T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b45", classInstanceId: "c8", customerId: "cu12", customerName: "Rania Saleh", customerInitials: "RS", customerColor: "#658774", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-23T08:00:00Z", status: "booked", attendanceStatus: "no_show" },

    // c9 — Barre, Mon 24 Feb, Completed, 10/15
    { id: "b46", classInstanceId: "c9", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-17T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b47", classInstanceId: "c9", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-17T10:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b48", classInstanceId: "c9", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-18T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b49", classInstanceId: "c9", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-18T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b50", classInstanceId: "c9", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-19T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b51", classInstanceId: "c9", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-19T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b52", classInstanceId: "c9", customerId: "cu11", customerName: "Ethan Davis", customerInitials: "ED", customerColor: "#7c5cbf", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-20T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b53", classInstanceId: "c9", customerId: "cu12", customerName: "Rania Saleh", customerInitials: "RS", customerColor: "#658774", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T09:00:00Z", status: "booked", attendanceStatus: "no_show" },
    { id: "b54", classInstanceId: "c9", customerId: "cu13", customerName: "Lily Nguyen", customerInitials: "LN", customerColor: "#dc6803", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b55", classInstanceId: "c9", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T08:00:00Z", status: "booked", attendanceStatus: "no_show" },

    // c11 — Cancelled class, 8 bookings all cancelled by the class cancellation (refund issued, >24h before class).
    { id: "b56", classInstanceId: "c11", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2026-02-18T08:00:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b57", classInstanceId: "c11", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2026-02-18T09:30:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b58", classInstanceId: "c11", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2026-02-19T07:15:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b59", classInstanceId: "c11", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2026-02-19T12:00:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b60", classInstanceId: "c11", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2026-02-20T08:45:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b61", classInstanceId: "c11", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2026-02-21T10:00:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b62", classInstanceId: "c11", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2026-02-22T07:30:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },
    { id: "b63", classInstanceId: "c11", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", planId: "p1", planName: "10-Class Pack",     bookingTime: "2026-02-23T14:15:00Z", status: "cancelled", attendanceStatus: "pending", cancelledAt: "2026-02-25T11:00:00Z", cancellationReason: "Class cancelled", refundCreditIssued: true },

    // c12 — Completed class, 15 bookings, 12 present + 3 no-show.
    { id: "b64", classInstanceId: "c12", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b65", classInstanceId: "c12", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-20T10:30:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b66", classInstanceId: "c12", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T07:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b67", classInstanceId: "c12", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-21T11:45:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b68", classInstanceId: "c12", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-22T08:20:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b69", classInstanceId: "c12", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-22T14:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b70", classInstanceId: "c12", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", planId: "m2", planName: "Monthly Unlimited", bookingTime: "2025-02-23T09:10:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b71", classInstanceId: "c12", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-24T16:30:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b72", classInstanceId: "c12", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-24T08:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b73", classInstanceId: "c12", customerId: "cu10", customerName: "Mia Anderson", customerInitials: "MA", customerColor: "#175cd3", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-25T09:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b74", classInstanceId: "c12", customerId: "cu11", customerName: "Ethan Davis", customerInitials: "ED", customerColor: "#7c5cbf", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-25T11:00:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b75", classInstanceId: "c12", customerId: "cu12", customerName: "Rania Saleh", customerInitials: "RS", customerColor: "#658774", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-26T08:30:00Z", status: "booked", attendanceStatus: "present" },
    { id: "b76", classInstanceId: "c12", customerId: "cu13", customerName: "Lily Nguyen", customerInitials: "LN", customerColor: "#dc6803", planId: "p1", planName: "10-Class Pack",     bookingTime: "2025-02-26T10:00:00Z", status: "booked", attendanceStatus: "no_show" },
    { id: "b77", classInstanceId: "c12", customerId: "cu14", customerName: "Hassan Al-Mansoori", customerInitials: "HA", customerColor: "#4b8c9a", planId: "m1", planName: "Monthly Unlimited", bookingTime: "2025-02-27T07:30:00Z", status: "booked", attendanceStatus: "no_show" },
    { id: "b78", classInstanceId: "c12", customerId: "cu15", customerName: "Chloe Kim", customerInitials: "CK", customerColor: "#f79009", planId: "p2", planName: "5-Class Pack",      bookingTime: "2025-02-27T09:30:00Z", status: "booked", attendanceStatus: "no_show" },
];

// ─── Mock ratings ─────────────────────────────────────────────────────────────

const INITIAL_CLASS_RATINGS: ClassRating[] = [
    // c6 — Reformer Pilates, 5 ratings avg 4.0
    { id: "r1", classInstanceId: "c6", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", score: 5, comment: "Amazing class! Sara really pushed us to our limits. Will definitely come back.", submittedAt: "2025-02-27T16:00:00Z" },
    { id: "r2", classInstanceId: "c6", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", score: 4, comment: "Great instructor, very detailed cues. The reformer felt a bit tight for my height though.", submittedAt: "2025-02-27T17:30:00Z" },
    { id: "r3", classInstanceId: "c6", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", score: 4, comment: "Loved the class. Good pace and challenging movements.", submittedAt: "2025-02-27T18:00:00Z" },
    { id: "r4", classInstanceId: "c6", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", score: 3, comment: "Class was okay. I expected more intensity for an intermediate level.", submittedAt: "2025-02-27T19:00:00Z" },
    { id: "r5", classInstanceId: "c6", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", score: 4, comment: "Really enjoyed it! Sara explains each movement clearly.", submittedAt: "2025-02-28T09:00:00Z" },

    // c8 — Hot Yoga, 8 ratings avg 4.5
    { id: "r6",  classInstanceId: "c8", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#d92d20", score: 5, comment: "Best yoga class I've ever taken. The heat really helps with flexibility.", submittedAt: "2025-02-25T10:00:00Z" },
    { id: "r7",  classInstanceId: "c8", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", score: 5, comment: "Maya is such an inspiring instructor. Felt completely energised after.", submittedAt: "2025-02-25T11:00:00Z" },
    { id: "r8",  classInstanceId: "c8", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", score: 4, comment: "Great class! Could use a bit more cooling-down time at the end.", submittedAt: "2025-02-25T12:00:00Z" },
    { id: "r9",  classInstanceId: "c8", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#4b8c9a", score: 5, comment: "Challenging but rewarding. The studio temperature was perfect.", submittedAt: "2025-02-25T13:00:00Z" },
    { id: "r10", classInstanceId: "c8", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", score: 4, comment: "Very good class. Maya kept the energy high throughout.", submittedAt: "2025-02-25T14:00:00Z" },
    { id: "r11", classInstanceId: "c8", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", score: 4, comment: "Solid hot yoga session. Will book again next week.", submittedAt: "2025-02-25T15:00:00Z" },
    { id: "r12", classInstanceId: "c8", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", score: 5, comment: "Perfect class for detox. Highly recommended!", submittedAt: "2025-02-26T09:00:00Z" },
    { id: "r13", classInstanceId: "c8", customerId: "cu8", customerName: "Fatima Al-Sayed", customerInitials: "FA", customerColor: "#667085", score: 4, comment: "Good class, instructor was motivating. Room was a bit crowded.", submittedAt: "2025-02-26T10:00:00Z" },

    // c9 — Barre, 6 ratings avg 4.8
    { id: "r14", classInstanceId: "c9", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#7c5cbf", score: 5, comment: "Maya is incredible. Every class feels fresh and challenging.", submittedAt: "2025-02-24T13:00:00Z" },
    { id: "r15", classInstanceId: "c9", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#658774", score: 5, comment: "Best barre class in Dubai. The isometric holds are intense but effective.", submittedAt: "2025-02-24T14:00:00Z" },
    { id: "r16", classInstanceId: "c9", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#f79009", score: 5, comment: "I left with burning thighs — exactly what I needed!", submittedAt: "2025-02-24T15:00:00Z" },
    { id: "r17", classInstanceId: "c9", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#0a6b3c", score: 4, comment: "Great class. Modifications were offered for all fitness levels.", submittedAt: "2025-02-24T16:00:00Z" },
    { id: "r18", classInstanceId: "c9", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", score: 5, comment: "Amazing energy. This is my favourite class of the week!", submittedAt: "2025-02-24T17:00:00Z" },
    { id: "r19", classInstanceId: "c9", customerId: "cu9", customerName: "Lucas Brown", customerInitials: "LB", customerColor: "#b42318", score: 5, comment: "Loved every minute. Can't wait for the next one.", submittedAt: "2025-02-25T08:00:00Z" },

    // c12 — Completed Mat Pilates, 5 visible ratings + 2 deleted.
    { id: "r20", classInstanceId: "c12", customerId: "cu1", customerName: "Ahmed Zayn", customerInitials: "AZ", customerColor: "#7c5cbf", score: 4, comment: "Great class! Clear guidance from Liam, nice pace, and a calm atmosphere. Felt strong and refreshed after. Would come again.", tags: ["Instructor", "Pacing"], submittedAt: "2025-02-28T22:00:00Z" },
    { id: "r21", classInstanceId: "c12", customerId: "cu2", customerName: "Ava Wright", customerInitials: "AW", customerColor: "#d92d20", score: 4, comment: "Loved the class! Easy to follow, well-paced, and the instructor was super encouraging. Left feeling great.", tags: ["Instructor", "Difficulty"], submittedAt: "2025-02-28T22:00:00Z" },
    { id: "r22", classInstanceId: "c12", customerId: "cu3", customerName: "Bosa Ahmed", customerInitials: "BA", customerColor: "#667085", score: 4, comment: "Nice session overall — good balance of challenge and relaxation. The atmosphere was really comfortable.", tags: ["Atmosphere", "Difficulty"], submittedAt: "2025-02-28T22:00:00Z" },
    { id: "r23", classInstanceId: "c12", customerId: "cu4", customerName: "Rosale Martin", customerInitials: "RM", customerColor: "#667085", score: 5, comment: "Such a nice session overall. The class had a good balance between strength and relaxation, and the transitions between movements felt smooth. The atmosphere was calm and welcoming, which made it easy to stay focused throughout.", tags: ["Atmosphere", "Pacing"], submittedAt: "2025-02-28T22:00:00Z" },
    { id: "r24", classInstanceId: "c12", customerId: "cu5", customerName: "Zahra Mahen", customerInitials: "ZM", customerColor: "#d92d20", score: 4, comment: "Really enjoyed this class. The instructor explained each movement clearly and gave helpful cues to improve form. I left feeling more stretched and energized.", tags: ["Instructor", "Pacing"], submittedAt: "2025-02-28T22:00:00Z" },
    // Deleted (already moderated)
    { id: "r25", classInstanceId: "c12", customerId: "cu6", customerName: "Sophia Lee", customerInitials: "SL", customerColor: "#344054", score: 1, comment: "I don't like the class and the instructor, not recommend it!", tags: ["Instructor", "Pacing"], submittedAt: "2025-02-28T22:00:00Z", deletedAt: "2025-03-01T09:00:00Z", deletedBy: "Alex Owen" },
    { id: "r26", classInstanceId: "c12", customerId: "cu7", customerName: "James Taylor", customerInitials: "JT", customerColor: "#dc6803", score: 1, comment: "Dont book this class everyone it's a scam", tags: ["Instructor", "Difficulty"], submittedAt: "2025-02-28T22:00:00Z", deletedAt: "2025-03-01T09:30:00Z", deletedBy: "Alex Owen" },
];

// ─── Initial customers ────────────────────────────────────────────────────────

const INITIAL_CUSTOMERS: Customer[] = [
    // First six use the available customer portraits from /public/images/customers.
    { id: "cu1",  firstName: "Ahmed",     lastName: "Zayn",        initials: "AZ", email: "ahmed.zayn@email.com",      planKind: "membership", planName: "Monthly Unlimited", imageUrl: "/images/customers/ahmed-zayn.webp",   createdAt: "2025-01-08T09:00:00Z" },
    { id: "cu2",  firstName: "Ava",       lastName: "Wright",      initials: "AW", email: "ava.wright@email.com",      planKind: "membership", planName: "Monthly Unlimited", imageUrl: "/images/customers/ava-wright.webp",   createdAt: "2025-01-09T09:00:00Z" },
    { id: "cu3",  firstName: "Bosa",      lastName: "Ahmed",       initials: "BA", email: "bosa.ahmed@email.com",      planKind: "package",    planName: "10-Class Pack",     imageUrl: "/images/customers/bosa-ahmed.webp",   createdAt: "2025-01-10T09:00:00Z" },
    { id: "cu4",  firstName: "Rosale",    lastName: "Martin",      initials: "RM", email: "rosale.martin@email.com",   planKind: "package",    planName: "10-Class Pack",     imageUrl: "/images/customers/rosale-martin.webp", createdAt: "2025-01-11T09:00:00Z" },
    { id: "cu5",  firstName: "Zahra",     lastName: "Mahen",       initials: "ZM", email: "zahra.mahen@email.com",     planKind: "membership", planName: "Monthly Unlimited", imageUrl: "/images/customers/zahra-mahen.webp",  createdAt: "2025-01-12T09:00:00Z" },
    // The rest fall back to neutral gray-initial avatars.
    { id: "cu6",  firstName: "Sophia",    lastName: "Lee",         initials: "SL", email: "sophia.lee@email.com",      planKind: "membership", planName: "Monthly Unlimited", createdAt: "2025-01-13T09:00:00Z" },
    { id: "cu7",  firstName: "James",     lastName: "Taylor",      initials: "JT", email: "james.taylor@email.com",    planKind: "package",    planName: "5-Class Pack",      createdAt: "2025-01-14T09:00:00Z" },
    { id: "cu8",  firstName: "Fatima",    lastName: "Al-Sayed",    initials: "FA", email: "fatima.al-sayed@email.com", planKind: "membership", planName: "Monthly Unlimited", createdAt: "2025-01-15T09:00:00Z" },
    { id: "cu9",  firstName: "Lucas",     lastName: "Brown",       initials: "LB", email: "lucas.brown@email.com",     planKind: "package",    planName: "10-Class Pack",     createdAt: "2025-01-16T09:00:00Z" },
    { id: "cu10", firstName: "Mia",       lastName: "Anderson",    initials: "MA", email: "mia.anderson@email.com",    planKind: "package",    planName: "5-Class Pack",      createdAt: "2025-01-17T09:00:00Z" },
    { id: "cu11", firstName: "Ethan",     lastName: "Davis",       initials: "ED", email: "ethan.davis@email.com",     planKind: "membership", planName: "Monthly Unlimited", createdAt: "2025-01-18T09:00:00Z" },
    { id: "cu12", firstName: "Rania",     lastName: "Saleh",       initials: "RS", email: "rania.saleh@email.com",     planKind: "package",    planName: "10-Class Pack",     createdAt: "2025-01-19T09:00:00Z" },
    { id: "cu13", firstName: "Lily",      lastName: "Nguyen",      initials: "LN", email: "lily.nguyen@email.com",     planKind: "package",    planName: "10-Class Pack",     createdAt: "2025-01-20T09:00:00Z" },
    { id: "cu14", firstName: "Hassan",    lastName: "Al-Mansoori",  initials: "HA", email: "hassan.al-mansoori@email.com", planKind: "membership", planName: "Monthly Unlimited", createdAt: "2025-01-21T09:00:00Z" },
    { id: "cu15", firstName: "Chloe",     lastName: "Kim",         initials: "CK", email: "chloe.kim@email.com",       planKind: "package",    planName: "5-Class Pack",      createdAt: "2025-01-22T09:00:00Z" },
    { id: "cu16", firstName: "Tariq",     lastName: "Mahmoud",     initials: "TM", email: "tariq.mahmoud@email.com",   planKind: "membership", planName: "Monthly Unlimited", createdAt: "2025-01-23T09:00:00Z" },
    { id: "cu17", firstName: "Dana",      lastName: "Al-Rashid",   initials: "DR", email: "dana.al-rashid@email.com",  planKind: "package",    planName: "10-Class Pack",     createdAt: "2025-01-24T09:00:00Z" },
];

// ─── Initial template data ────────────────────────────────────────────────────

const INITIAL_TEMPLATES: ClassTemplate[] = [
    {
        id: "1",
        name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        category: "Pilates",
        locationType: "Group",
        durationMin: 60,
        capacity: 15,
        status: "Active",
        coverImage: "/images/class-template/reformer-pilates.webp",
        coverColor: "#e9fff3",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
    {
        id: "2",
        name: "Private Reformer",
        description: "One-on-one or small group reformer session with personalized instruction.",
        category: "Pilates",
        locationType: "Private",
        durationMin: 60,
        capacity: 3,
        status: "Archived",
        coverImage: "/images/class-template/private-reformer.webp",
        coverColor: "#f7f3f7",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
    {
        id: "3",
        name: "Barre",
        description: "Ballet-inspired low-impact workout that sculpts and tones using small isometric movements.",
        category: "Barre",
        locationType: "Group",
        durationMin: 60,
        capacity: 8,
        status: "Archived",
        coverImage: "/images/class-template/berre.webp",
        coverColor: "#fdf3f7",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
    {
        id: "4",
        name: "Roller Release",
        description: "A foam roller–based recovery class to release muscle tension, improve mobility, and boost circulation.",
        category: "Recovery",
        locationType: "Group",
        durationMin: 60,
        capacity: 10,
        status: "Inactive",
        coverImage: "/images/class-template/roller-release.webp",
        coverColor: "#f1f2ed",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
    {
        id: "5",
        name: "Mat Pilates",
        description: "Classical Pilates exercises on the mat. Strengthens the core and improves overall body alignment.",
        category: "Pilates",
        locationType: "Group",
        durationMin: 45,
        capacity: 20,
        status: "Active",
        coverImage: "/images/class-template/reformer-pilates.webp",
        coverColor: "#e9fff3",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
    {
        id: "6",
        name: "Hot Yoga",
        description: "Traditional Hatha yoga sequence practised in a heated room to increase flexibility and detoxify.",
        category: "Yoga",
        locationType: "Group",
        durationMin: 75,
        capacity: 16,
        status: "Active",
        coverImage: "/images/class-template/hot-yoga.webp",
        coverColor: "#fdf3e9",
        applicableMemberships: ["m1", "m2", "m3", "p1", "p2", "p3"],
    },
];

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppState {
    currentRole: UserRole;
    currentUser: User;
    sidebarCollapsed: boolean;
    classTemplates: ClassTemplate[];
    classInstances: ClassInstance[];
    classBookings: ClassBooking[];
    classRatings: ClassRating[];
    customers: Customer[];
    toast: ToastData | null;
    setRole: (role: UserRole) => void;
    setCurrentUser: (user: User) => void;
    toggleSidebar: () => void;
    setSidebarCollapsed: (collapsed: boolean) => void;
    addClassTemplate: (template: Omit<ClassTemplate, "id">) => void;
    updateClassTemplate: (id: string, updates: Partial<Omit<ClassTemplate, "id">>) => void;
    deleteClassTemplate: (id: string) => void;
    addClassInstance: (instance: Omit<ClassInstance, "id">) => string;
    addClassInstances: (instances: Omit<ClassInstance, "id">[]) => void;
    updateClassInstance: (id: string, updates: Partial<Omit<ClassInstance, "id">>) => void;
    cancelClassInstance: (id: string, refundCredits: boolean) => void;
    cancelClassBooking: (id: string, reason: string, refund: boolean) => void;
    removeClassBooking: (id: string) => void;
    removeClassBookings: (ids: string[]) => void;
    cancelClassBookings: (ids: string[], reason: string, refund: boolean) => void;
    updateAttendance: (bookingId: string, status: ClassBooking["attendanceStatus"]) => void;
    deleteClassRating: (id: string, deletedBy: string) => void;
    addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "initials"> & { initials?: string }) => string;
    showToast: (title: string, message: string, type?: "success" | "error", icon?: ToastData["icon"]) => void;
    clearToast: () => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentRole: "admin",
    currentUser: adminUser,
    sidebarCollapsed: false,
    classTemplates: INITIAL_TEMPLATES,
    classInstances: INITIAL_CLASS_INSTANCES,
    classBookings: INITIAL_CLASS_BOOKINGS,
    classRatings: INITIAL_CLASS_RATINGS,
    customers: INITIAL_CUSTOMERS,
    toast: null,

    setRole: (role) => set({ currentRole: role }),
    setCurrentUser: (user) => set({ currentUser: user, currentRole: user.role }),
    toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

    addClassTemplate: (template) =>
        set((state) => ({
            classTemplates: [
                { ...template, id: `t-${Date.now()}` },
                ...state.classTemplates,
            ],
        })),
    updateClassTemplate: (id, updates) =>
        set((state) => ({
            classTemplates: state.classTemplates.map(t =>
                t.id === id ? { ...t, ...updates } : t
            ),
        })),
    deleteClassTemplate: (id) =>
        set((state) => ({
            classTemplates: state.classTemplates.filter(t => t.id !== id),
        })),

    addClassInstance: (instance) => {
        const id = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({ classInstances: [...state.classInstances, { ...instance, id }] }));
        return id;
    },
    addClassInstances: (instances) =>
        set((state) => ({
            classInstances: [
                ...state.classInstances,
                ...instances.map((inst, i) => ({ ...inst, id: `ci-${Date.now()}-${i}` })),
            ],
        })),
    updateClassInstance: (id, updates) =>
        set((state) => ({
            classInstances: state.classInstances.map(c =>
                c.id === id ? { ...c, ...updates } : c
            ),
        })),
    cancelClassInstance: (id, refundCredits) =>
        set((state) => {
            const now = new Date().toISOString();
            return {
                classInstances: state.classInstances.map(c =>
                    c.id === id ? { ...c, status: "Cancelled" as ClassStatus, cancelledAt: now, cancelledBy: "Alex Owen" } : c
                ),
                classBookings: state.classBookings.map(b =>
                    b.classInstanceId === id && b.status === "booked"
                        ? { ...b, status: "cancelled" as const, cancelledAt: now, cancellationReason: "Class cancelled", refundCreditIssued: refundCredits, waitlistPosition: undefined }
                        : b
                ),
            };
        }),
    cancelClassBooking: (id, reason, refund) =>
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === id ? { ...b, status: "cancelled" as const, cancelledAt: new Date().toISOString(), cancellationReason: reason, refundCreditIssued: refund } : b
            ),
            classInstances: state.classInstances.map(c => {
                const booking = state.classBookings.find(b => b.id === id);
                if (booking && booking.status === "booked" && c.id === booking.classInstanceId && c.booked > 0) {
                    return { ...c, booked: c.booked - 1 };
                }
                return c;
            }),
        })),
    cancelClassBookings: (ids, reason, refund) =>
        set((state) => {
            const idSet = new Set(ids);
            const now = new Date().toISOString();
            const targets = state.classBookings.filter(b => idSet.has(b.id));
            const decrementByClass = new Map<string, number>();
            for (const t of targets) {
                if (t.status === "booked") {
                    decrementByClass.set(t.classInstanceId, (decrementByClass.get(t.classInstanceId) ?? 0) + 1);
                }
            }
            return {
                classBookings: state.classBookings.map(b =>
                    idSet.has(b.id)
                        ? { ...b, status: "cancelled" as const, cancelledAt: now, cancellationReason: reason, refundCreditIssued: refund }
                        : b
                ),
                classInstances: state.classInstances.map(c => {
                    const dec = decrementByClass.get(c.id);
                    return dec ? { ...c, booked: Math.max(0, c.booked - dec) } : c;
                }),
            };
        }),
    removeClassBooking: (id) =>
        set((state) => {
            const target = state.classBookings.find(b => b.id === id);
            return {
                classBookings: state.classBookings.filter(b => b.id !== id),
                classInstances: target && target.status === "booked"
                    ? state.classInstances.map(c =>
                        c.id === target.classInstanceId && c.booked > 0 ? { ...c, booked: c.booked - 1 } : c
                    )
                    : state.classInstances,
            };
        }),
    removeClassBookings: (ids) =>
        set((state) => {
            const idSet = new Set(ids);
            const decrementByClass = new Map<string, number>();
            for (const b of state.classBookings) {
                if (idSet.has(b.id) && b.status === "booked") {
                    decrementByClass.set(b.classInstanceId, (decrementByClass.get(b.classInstanceId) ?? 0) + 1);
                }
            }
            return {
                classBookings: state.classBookings.filter(b => !idSet.has(b.id)),
                classInstances: state.classInstances.map(c => {
                    const dec = decrementByClass.get(c.id);
                    return dec ? { ...c, booked: Math.max(0, c.booked - dec) } : c;
                }),
            };
        }),
    updateAttendance: (bookingId, status) =>
        set((state) => ({
            classBookings: state.classBookings.map(b =>
                b.id === bookingId ? { ...b, attendanceStatus: status } : b
            ),
        })),
    deleteClassRating: (id, deletedBy) =>
        set((state) => ({
            classRatings: state.classRatings.map(r =>
                r.id === id ? { ...r, deletedAt: new Date().toISOString(), deletedBy } : r
            ),
        })),
    addCustomer: (input) => {
        const id = `cu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const initials = input.initials ?? `${input.firstName.charAt(0)}${input.lastName.charAt(0)}`.toUpperCase();
        const customer: Customer = {
            ...input,
            id,
            initials,
            createdAt: new Date().toISOString(),
        };
        set((state) => ({ customers: [customer, ...state.customers] }));
        return id;
    },

    showToast: (title, message, type = "success", icon) =>
        set({ toast: { id: Date.now().toString(), title, message, type, icon } }),
    clearToast: () => set({ toast: null }),
}));
