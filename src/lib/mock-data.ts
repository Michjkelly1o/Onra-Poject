// ───────────────────────────────────────────────────
// SyncFit — Comprehensive Mock Data
// Realistic data for demo purposes
// ───────────────────────────────────────────────────

import type {
    Studio,
    User,
    Room,
    ClassType,
    ClassInstance,
    Booking,
    Package,
    UserPackage,
    Membership,
    UserMembership,
    Payment,
    WalletTransaction,
    Notification,
    Product,
    RetailSale,
    PromoCode,
    Campaign,
    GiftCard,
    InstructorPayRule,
    ServiceAddOn,
} from "@/types";

// ── Studio ──
export const studio: Studio = {
    id: "s1",
    name: "Forma Studio",
    slug: "forma-studio",
    address: "123 Wellness Drive, Dubai Marina",
    phone: "+971 4 555 0123",
    email: "hello@formastudio.ae",
    timezone: "Asia/Dubai",
    cancellation_window_hours: 12,
    booking_window_days: 7,
    logo_url: "", // Default empty
    created_at: "2024-01-01T00:00:00Z",
};

// ── Rooms ──
export const rooms: Room[] = [
    { id: "r1", studio_id: "s1", name: "Reformer Room", capacity: 8, is_active: true },
    { id: "r2", studio_id: "s1", name: "Mat Studio", capacity: 15, is_active: true },
    { id: "r3", studio_id: "s1", name: "Barre Studio", capacity: 12, is_active: true },
    { id: "r4", studio_id: "s1", name: "Private Suite", capacity: 3, is_active: true },
];

// ── Instructors ──
export const instructors: User[] = [
    {
        id: "u-inst-1", studio_id: "s1", role: "instructor",
        first_name: "Sara", last_name: "Al-Rashid",
        email: "sara@formastudio.ae", phone: "+971 50 100 0001",
        waiver_signed: true, is_active: true, created_at: "2024-01-05T00:00:00Z",
        avatar_url: "",
    },
    {
        id: "u-inst-2", studio_id: "s1", role: "instructor",
        first_name: "Liam", last_name: "Chen",
        email: "liam@formastudio.ae", phone: "+971 50 100 0002",
        waiver_signed: true, is_active: true, created_at: "2024-01-05T00:00:00Z",
        avatar_url: "",
    },
    {
        id: "u-inst-3", studio_id: "s1", role: "instructor",
        first_name: "Maya", last_name: "Johnson",
        email: "maya@formastudio.ae", phone: "+971 50 100 0003",
        waiver_signed: true, is_active: true, created_at: "2024-02-10T00:00:00Z",
        avatar_url: "",
    },
];

// ── Members ──
export const members: User[] = [
    {
        id: "u-mem-1", studio_id: "s1", role: "member",
        first_name: "Aisha", last_name: "Khan",
        email: "aisha.k@gmail.com", phone: "+971 55 200 0001",
        emergency_contact_name: "Tariq Khan", emergency_contact_phone: "+971 55 200 0099",
        waiver_signed: true, waiver_signed_at: "2024-02-01T10:00:00Z",
        is_active: true, churn_risk_score: 12, created_at: "2024-02-01T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-2", studio_id: "s1", role: "member",
        first_name: "Emma", last_name: "Williams",
        email: "emma.w@outlook.com", phone: "+971 55 200 0002",
        emergency_contact_name: "John Williams", emergency_contact_phone: "+971 55 200 0098",
        waiver_signed: true, waiver_signed_at: "2024-02-05T10:00:00Z",
        is_active: true, churn_risk_score: 8, created_at: "2024-02-05T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-3", studio_id: "s1", role: "member",
        first_name: "Olivia", last_name: "Martinez",
        email: "olivia.m@gmail.com", phone: "+971 55 200 0003",
        emergency_contact_name: "Carlos Martinez", emergency_contact_phone: "+971 55 200 0097",
        waiver_signed: true, waiver_signed_at: "2024-02-10T10:00:00Z",
        is_active: true, churn_risk_score: 45, created_at: "2024-02-10T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-4", studio_id: "s1", role: "member",
        first_name: "Noah", last_name: "Park",
        email: "noah.p@gmail.com", phone: "+971 55 200 0004",
        waiver_signed: true, waiver_signed_at: "2024-03-01T10:00:00Z",
        is_active: true, churn_risk_score: 22, created_at: "2024-03-01T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-5", studio_id: "s1", role: "member",
        first_name: "Sophia", last_name: "Lee",
        email: "sophia.l@gmail.com", phone: "+971 55 200 0005",
        waiver_signed: true, waiver_signed_at: "2024-03-05T10:00:00Z",
        is_active: true, churn_risk_score: 5, created_at: "2024-03-05T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-6", studio_id: "s1", role: "member",
        first_name: "James", last_name: "Taylor",
        email: "james.t@outlook.com", phone: "+971 55 200 0006",
        waiver_signed: true, waiver_signed_at: "2024-03-12T10:00:00Z",
        is_active: true, churn_risk_score: 62, created_at: "2024-03-12T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-7", studio_id: "s1", role: "member",
        first_name: "Fatima", last_name: "Al-Sayed",
        email: "fatima.as@gmail.com", phone: "+971 55 200 0007",
        waiver_signed: false,
        is_active: true, churn_risk_score: 78, created_at: "2024-04-01T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-8", studio_id: "s1", role: "member",
        first_name: "Lucas", last_name: "Brown",
        email: "lucas.b@gmail.com", phone: "+971 55 200 0008",
        waiver_signed: true, waiver_signed_at: "2024-04-05T10:00:00Z",
        is_active: false, churn_risk_score: 92, created_at: "2024-04-05T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-9", studio_id: "s1", role: "member",
        first_name: "Mia", last_name: "Anderson",
        email: "mia.a@gmail.com", phone: "+971 55 200 0009",
        waiver_signed: true, waiver_signed_at: "2024-04-10T10:00:00Z",
        is_active: true, churn_risk_score: 35, created_at: "2024-04-10T00:00:00Z", avatar_url: "",
    },
    {
        id: "u-mem-10", studio_id: "s1", role: "member",
        first_name: "Ethan", last_name: "Davis",
        email: "ethan.d@outlook.com", phone: "+971 55 200 0010",
        waiver_signed: true, waiver_signed_at: "2024-05-01T10:00:00Z",
        is_active: true, churn_risk_score: 18, created_at: "2024-05-01T00:00:00Z", avatar_url: "",
    },
];

// ── Admin User ──
export const adminUser: User = {
    id: "u-admin-1", studio_id: "s1", role: "admin",
    first_name: "Dana", last_name: "Rashid",
    email: "dana@formastudio.ae", phone: "+971 50 300 0001",
    waiver_signed: true, is_active: true, created_at: "2024-01-01T00:00:00Z",
    avatar_url: "",
    permissions: ["all"], // Full access
};

// ── Class Types ──
export const classTypes: ClassType[] = [
    {
        id: "ct1", studio_id: "s1", name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        difficulty_level: "all_levels",
        default_duration_min: 50, default_capacity: 8, default_room_id: "r1",
        equipment_notes: "Reformer machine", color: "#6c47ff",
        is_active: true, created_at: "2024-01-10T00:00:00Z",
    },
    {
        id: "ct2", studio_id: "s1", name: "Mat Pilates",
        description: "Classic mat-based Pilates focusing on core strength and controlled movements.",
        difficulty_level: "beginner",
        default_duration_min: 55, default_capacity: 15, default_room_id: "r2",
        equipment_notes: "Mat, resistance bands", color: "#059669",
        is_active: true, created_at: "2024-01-10T00:00:00Z",
    },
    {
        id: "ct3", studio_id: "s1", name: "Barre",
        description: "Ballet-inspired low-impact workout that sculpts and tones using small isometric movements.",
        difficulty_level: "intermediate",
        default_duration_min: 50, default_capacity: 12, default_room_id: "r3",
        equipment_notes: "Barre, light weights", color: "#e11d48",
        is_active: true, created_at: "2024-01-10T00:00:00Z",
    },
    {
        id: "ct4", studio_id: "s1", name: "Reformer Pilates",
        description: "Full-body workout on the Pilates reformer. Builds core strength, improves posture and flexibility.",
        difficulty_level: "all_levels",
        default_duration_min: 50, default_capacity: 8, default_room_id: "r1",
        equipment_notes: "Reformer machine", color: "#6c47ff",
        is_active: true, created_at: "2024-02-01T00:00:00Z",
    },
    {
        id: "ct5", studio_id: "s1", name: "Private Reformer",
        description: "One-on-one or small group reformer session with personalized instruction.",
        difficulty_level: "advanced",
        default_duration_min: 50, default_capacity: 3, default_room_id: "r4",
        equipment_notes: "Reformer machine", color: "#d97706",
        is_active: true, created_at: "2024-02-01T00:00:00Z",
    },
];

// ── Helper: generate dates relative to "today" ──
function getWeekDates(): string[] {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d.toISOString().split("T")[0];
    });
}

function makeTime(dateStr: string, hour: number, min: number = 0): string {
    return `${dateStr}T${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}:00Z`;
}

function addMinutes(iso: string, minutes: number): string {
    const d = new Date(iso);
    d.setMinutes(d.getMinutes() + minutes);
    return d.toISOString();
}

// ── Class Instances (this week's schedule) ──
const weekDates = getWeekDates();

export const classInstances: ClassInstance[] = [
    // Monday
    { id: "ci1", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(weekDates[0], 7, 0), end_time: makeTime(weekDates[0], 7, 50), capacity: 8, booked_count: 7, waitlist_count: 0, status: "scheduled", created_at: weekDates[0], class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "ci2", studio_id: "s1", class_type_id: "ct2", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(weekDates[0], 9, 0), end_time: makeTime(weekDates[0], 9, 55), capacity: 15, booked_count: 11, waitlist_count: 0, status: "scheduled", created_at: weekDates[0], class_type: classTypes[1], instructor: instructors[1], room: rooms[1] },
    { id: "ci3", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(weekDates[0], 17, 30), end_time: makeTime(weekDates[0], 18, 20), capacity: 12, booked_count: 10, waitlist_count: 0, status: "scheduled", created_at: weekDates[0], class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
    // Tuesday
    { id: "ci4", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(weekDates[1], 7, 0), end_time: makeTime(weekDates[1], 7, 50), capacity: 8, booked_count: 8, waitlist_count: 0, status: "scheduled", created_at: weekDates[1], class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "ci5", studio_id: "s1", class_type_id: "ct4", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(weekDates[1], 10, 0), end_time: makeTime(weekDates[1], 10, 45), capacity: 10, booked_count: 6, waitlist_count: 0, status: "scheduled", created_at: weekDates[1], class_type: classTypes[3], instructor: instructors[1], room: rooms[1] },
    { id: "ci6", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(weekDates[1], 18, 0), end_time: makeTime(weekDates[1], 18, 50), capacity: 12, booked_count: 9, waitlist_count: 0, status: "scheduled", created_at: weekDates[1], class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
    // Wednesday
    { id: "ci7", studio_id: "s1", class_type_id: "ct2", instructor_id: "u-inst-1", room_id: "r2", start_time: makeTime(weekDates[2], 8, 0), end_time: makeTime(weekDates[2], 8, 55), capacity: 15, booked_count: 13, waitlist_count: 0, status: "scheduled", created_at: weekDates[2], class_type: classTypes[1], instructor: instructors[0], room: rooms[1] },
    { id: "ci8", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-2", room_id: "r1", start_time: makeTime(weekDates[2], 12, 0), end_time: makeTime(weekDates[2], 12, 50), capacity: 8, booked_count: 5, waitlist_count: 0, status: "scheduled", created_at: weekDates[2], class_type: classTypes[0], instructor: instructors[1], room: rooms[0] },
    { id: "ci9", studio_id: "s1", class_type_id: "ct5", instructor_id: "u-inst-3", room_id: "r4", start_time: makeTime(weekDates[2], 15, 0), end_time: makeTime(weekDates[2], 15, 50), capacity: 3, booked_count: 2, waitlist_count: 0, status: "scheduled", created_at: weekDates[2], class_type: classTypes[4], instructor: instructors[2], room: rooms[3] },
    // Thursday
    { id: "ci10", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(weekDates[3], 7, 0), end_time: makeTime(weekDates[3], 7, 50), capacity: 8, booked_count: 6, waitlist_count: 0, status: "scheduled", created_at: weekDates[3], class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "ci11", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(weekDates[3], 9, 30), end_time: makeTime(weekDates[3], 10, 20), capacity: 12, booked_count: 8, waitlist_count: 0, status: "scheduled", created_at: weekDates[3], class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
    { id: "ci12", studio_id: "s1", class_type_id: "ct2", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(weekDates[3], 18, 0), end_time: makeTime(weekDates[3], 18, 55), capacity: 15, booked_count: 12, waitlist_count: 0, status: "scheduled", created_at: weekDates[3], class_type: classTypes[1], instructor: instructors[1], room: rooms[1] },
    // Friday
    { id: "ci13", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(weekDates[4], 7, 0), end_time: makeTime(weekDates[4], 7, 50), capacity: 8, booked_count: 4, waitlist_count: 0, status: "scheduled", created_at: weekDates[4], class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "ci14", studio_id: "s1", class_type_id: "ct4", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(weekDates[4], 10, 0), end_time: makeTime(weekDates[4], 10, 45), capacity: 10, booked_count: 7, waitlist_count: 0, status: "scheduled", created_at: weekDates[4], class_type: classTypes[3], instructor: instructors[1], room: rooms[1] },
    // Saturday
    { id: "ci15", studio_id: "s1", class_type_id: "ct2", instructor_id: "u-inst-3", room_id: "r2", start_time: makeTime(weekDates[5], 9, 0), end_time: makeTime(weekDates[5], 9, 55), capacity: 15, booked_count: 14, waitlist_count: 0, status: "scheduled", created_at: weekDates[5], class_type: classTypes[1], instructor: instructors[2], room: rooms[1] },
    { id: "ci16", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(weekDates[5], 10, 0), end_time: makeTime(weekDates[5], 10, 50), capacity: 8, booked_count: 8, waitlist_count: 0, status: "scheduled", created_at: weekDates[5], class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "ci17", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(weekDates[5], 11, 0), end_time: makeTime(weekDates[5], 11, 50), capacity: 12, booked_count: 11, waitlist_count: 0, status: "scheduled", created_at: weekDates[5], class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
];

// ── Past Class Instances (previous weeks — for past bookings) ──
function getPastDate(daysAgo: number): string {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
}

export const pastClassInstances: ClassInstance[] = [
    { id: "pci1", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(getPastDate(3), 7, 0), end_time: makeTime(getPastDate(3), 7, 50), capacity: 8, booked_count: 7, waitlist_count: 0, status: "completed", created_at: getPastDate(3), class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "pci2", studio_id: "s1", class_type_id: "ct2", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(getPastDate(5), 9, 0), end_time: makeTime(getPastDate(5), 9, 55), capacity: 15, booked_count: 12, waitlist_count: 0, status: "completed", created_at: getPastDate(5), class_type: classTypes[1], instructor: instructors[1], room: rooms[1] },
    { id: "pci3", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(getPastDate(7), 17, 30), end_time: makeTime(getPastDate(7), 18, 20), capacity: 12, booked_count: 10, waitlist_count: 0, status: "completed", created_at: getPastDate(7), class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
    { id: "pci4", studio_id: "s1", class_type_id: "ct4", instructor_id: "u-inst-2", room_id: "r2", start_time: makeTime(getPastDate(10), 10, 0), end_time: makeTime(getPastDate(10), 10, 45), capacity: 10, booked_count: 8, waitlist_count: 0, status: "completed", created_at: getPastDate(10), class_type: classTypes[3], instructor: instructors[1], room: rooms[1] },
    { id: "pci5", studio_id: "s1", class_type_id: "ct1", instructor_id: "u-inst-1", room_id: "r1", start_time: makeTime(getPastDate(14), 7, 0), end_time: makeTime(getPastDate(14), 7, 50), capacity: 8, booked_count: 6, waitlist_count: 0, status: "completed", created_at: getPastDate(14), class_type: classTypes[0], instructor: instructors[0], room: rooms[0] },
    { id: "pci6", studio_id: "s1", class_type_id: "ct3", instructor_id: "u-inst-3", room_id: "r3", start_time: makeTime(getPastDate(17), 18, 0), end_time: makeTime(getPastDate(17), 18, 50), capacity: 12, booked_count: 11, waitlist_count: 0, status: "completed", created_at: getPastDate(17), class_type: classTypes[2], instructor: instructors[2], room: rooms[2] },
];

// ── Packages ──
export const packages: Package[] = [
    { id: "pkg1", studio_id: "s1", name: "10-Class Pack", description: "10 credits valid for any class type", price: 950, credit_count: 10, validity_days: 90, class_type_ids: [], is_active: true, created_at: "2024-01-15T00:00:00Z" },
    { id: "pkg2", studio_id: "s1", name: "5-Class Reformer Pack", description: "5 credits for Reformer Pilates only", price: 600, credit_count: 5, validity_days: 60, class_type_ids: ["ct1"], is_active: true, created_at: "2024-01-15T00:00:00Z" },
    { id: "pkg3", studio_id: "s1", name: "20-Class Pack", description: "20 credits valid for any class type — best value", price: 1700, credit_count: 20, validity_days: 180, class_type_ids: [], is_active: true, created_at: "2024-02-01T00:00:00Z" },
    { id: "pkg4", studio_id: "s1", name: "Intro Offer (3 Classes)", description: "New member intro pack — try 3 classes", price: 150, credit_count: 3, validity_days: 30, class_type_ids: [], is_active: true, created_at: "2024-03-01T00:00:00Z" },
];

// ── Memberships ──
export const memberships: Membership[] = [
    { id: "mem1", studio_id: "s1", name: "Unlimited Monthly", description: "Unlimited classes per month", price: 1200, billing_period: "monthly", class_type_ids: [], max_bookings_per_period: undefined, is_active: true, created_at: "2024-01-15T00:00:00Z" },
    { id: "mem2", studio_id: "s1", name: "8x Monthly", description: "8 classes per month", price: 800, billing_period: "monthly", class_type_ids: [], max_bookings_per_period: 8, is_active: true, created_at: "2024-01-15T00:00:00Z" },
];

// ── User Packages (purchased) ──
export const userPackages: UserPackage[] = [
    { id: "up1", user_id: "u-mem-1", package_id: "pkg1", studio_id: "s1", credits_total: 10, credits_used: 4, credits_remaining: 6, purchased_at: "2024-11-01T10:00:00Z", expires_at: "2025-01-30T10:00:00Z", purchase_location: "online", status: "active", payment_id: "pay1", created_at: "2024-11-01T10:00:00Z" },
    { id: "up2", user_id: "u-mem-2", package_id: "pkg3", studio_id: "s1", credits_total: 20, credits_used: 12, credits_remaining: 8, purchased_at: "2024-10-15T10:00:00Z", expires_at: "2025-04-13T10:00:00Z", purchase_location: "in_studio", status: "active", payment_id: "pay2", created_at: "2024-10-15T10:00:00Z" },
    { id: "up3", user_id: "u-mem-3", package_id: "pkg4", studio_id: "s1", credits_total: 3, credits_used: 3, credits_remaining: 0, purchased_at: "2024-12-01T10:00:00Z", expires_at: "2024-12-31T10:00:00Z", purchase_location: "online", status: "fully_used", payment_id: "pay3", created_at: "2024-12-01T10:00:00Z" },
    { id: "up4", user_id: "u-mem-4", package_id: "pkg2", studio_id: "s1", credits_total: 5, credits_used: 2, credits_remaining: 3, purchased_at: "2024-12-20T10:00:00Z", expires_at: "2025-02-18T10:00:00Z", purchase_location: "online", status: "active", payment_id: "pay4", created_at: "2024-12-20T10:00:00Z" },
    { id: "up5", user_id: "u-mem-3", package_id: "pkg1", studio_id: "s1", credits_total: 10, credits_used: 4, credits_remaining: 6, purchased_at: "2025-01-15T10:00:00Z", expires_at: "2025-04-15T10:00:00Z", purchase_location: "online", status: "active", payment_id: "pay8", created_at: "2025-01-15T10:00:00Z" },
];

// ── User Memberships ──
export const userMemberships: UserMembership[] = [
    { id: "um1", user_id: "u-mem-5", membership_id: "mem1", studio_id: "s1", start_date: "2024-10-01", auto_renew: true, status: "active", created_at: "2024-10-01T00:00:00Z" },
    { id: "um2", user_id: "u-mem-6", membership_id: "mem2", studio_id: "s1", start_date: "2024-11-01", auto_renew: true, status: "active", created_at: "2024-11-01T00:00:00Z" },
    { id: "um3", user_id: "u-mem-3", membership_id: "mem2", studio_id: "s1", start_date: "2025-01-01", auto_renew: true, status: "active", created_at: "2025-01-01T00:00:00Z" },
];

// ── Bookings ──
export const bookings: Booking[] = [
    { id: "b1", studio_id: "s1", class_instance_id: "ci1", user_id: "u-mem-1", status: "confirmed", booked_at: "2025-01-15T08:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up1", created_at: "2025-01-15T08:00:00Z", user: members[0], class_instance: classInstances[0] },
    { id: "b2", studio_id: "s1", class_instance_id: "ci1", user_id: "u-mem-2", status: "confirmed", booked_at: "2025-01-15T09:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up2", created_at: "2025-01-15T09:00:00Z", user: members[1], class_instance: classInstances[0] },
    { id: "b3", studio_id: "s1", class_instance_id: "ci2", user_id: "u-mem-3", status: "confirmed", booked_at: "2025-01-15T07:30:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um3", created_at: "2025-01-15T07:30:00Z", user: members[2], class_instance: classInstances[1] },
    { id: "b4", studio_id: "s1", class_instance_id: "ci3", user_id: "u-mem-4", status: "cancelled", booked_at: "2025-01-14T10:00:00Z", cancelled_at: "2025-01-15T06:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up4", created_at: "2025-01-14T10:00:00Z", user: members[3], class_instance: classInstances[2] },
    { id: "b5", studio_id: "s1", class_instance_id: "ci4", user_id: "u-mem-5", status: "attended", booked_at: "2025-01-14T12:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um1", created_at: "2025-01-14T12:00:00Z", user: members[4], class_instance: classInstances[3] },
    { id: "b6", studio_id: "s1", class_instance_id: "ci4", user_id: "u-mem-1", status: "no_show", booked_at: "2025-01-14T11:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up1", created_at: "2025-01-14T11:00:00Z", user: members[0], class_instance: classInstances[3] },
    { id: "b7", studio_id: "s1", class_instance_id: "ci7", user_id: "u-mem-6", status: "confirmed", booked_at: "2025-01-16T08:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um2", created_at: "2025-01-16T08:00:00Z", user: members[5], class_instance: classInstances[6] },
    { id: "b8", studio_id: "s1", class_instance_id: "ci7", user_id: "u-mem-7", status: "late_cancelled", booked_at: "2025-01-15T14:00:00Z", cancelled_at: "2025-01-16T07:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up1", created_at: "2025-01-15T14:00:00Z", user: members[6], class_instance: classInstances[6] },
    { id: "b9", studio_id: "s1", class_instance_id: "ci10", user_id: "u-mem-9", status: "confirmed", booked_at: "2025-01-17T06:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up2", created_at: "2025-01-17T06:00:00Z", user: members[8], class_instance: classInstances[9] },
    { id: "b10", studio_id: "s1", class_instance_id: "ci15", user_id: "u-mem-2", status: "confirmed", booked_at: "2025-01-17T10:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up2", created_at: "2025-01-17T10:00:00Z", user: members[1], class_instance: classInstances[14] },
    // Olivia Martinez (u-mem-3) — upcoming bookings
    { id: "b11", studio_id: "s1", class_instance_id: "ci7", user_id: "u-mem-3", status: "confirmed", booked_at: "2025-02-08T10:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up5", created_at: "2025-02-08T10:00:00Z", user: members[2], class_instance: classInstances[6] },
    { id: "b12", studio_id: "s1", class_instance_id: "ci13", user_id: "u-mem-3", status: "confirmed", booked_at: "2025-02-09T08:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up5", created_at: "2025-02-09T08:00:00Z", user: members[2], class_instance: classInstances[12] },
    { id: "b13", studio_id: "s1", class_instance_id: "ci17", user_id: "u-mem-3", status: "waitlist", booked_at: "2025-02-09T09:00:00Z", credits_used: 0, payment_method: "credits", user_package_id: "up5", created_at: "2025-02-09T09:00:00Z", user: members[2], class_instance: classInstances[16] },
    // Olivia Martinez (u-mem-3) — past bookings (attended, no_show, cancelled)
    { id: "b14", studio_id: "s1", class_instance_id: "pci1", user_id: "u-mem-3", status: "attended", booked_at: "2025-02-05T06:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up5", created_at: "2025-02-05T06:00:00Z", user: members[2], class_instance: pastClassInstances[0] },
    { id: "b15", studio_id: "s1", class_instance_id: "pci2", user_id: "u-mem-3", status: "attended", booked_at: "2025-02-03T08:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um3", created_at: "2025-02-03T08:00:00Z", user: members[2], class_instance: pastClassInstances[1] },
    { id: "b16", studio_id: "s1", class_instance_id: "pci3", user_id: "u-mem-3", status: "attended", booked_at: "2025-01-31T10:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um3", created_at: "2025-01-31T10:00:00Z", user: members[2], class_instance: pastClassInstances[2] },
    { id: "b17", studio_id: "s1", class_instance_id: "pci4", user_id: "u-mem-3", status: "no_show", booked_at: "2025-01-28T08:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up5", created_at: "2025-01-28T08:00:00Z", user: members[2], class_instance: pastClassInstances[3] },
    { id: "b18", studio_id: "s1", class_instance_id: "pci5", user_id: "u-mem-3", status: "attended", booked_at: "2025-01-25T06:30:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up5", created_at: "2025-01-25T06:30:00Z", user: members[2], class_instance: pastClassInstances[4] },
    { id: "b19", studio_id: "s1", class_instance_id: "pci6", user_id: "u-mem-3", status: "cancelled", booked_at: "2025-01-22T10:00:00Z", cancelled_at: "2025-01-22T14:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um3", created_at: "2025-01-22T10:00:00Z", user: members[2], class_instance: pastClassInstances[5] },
    // More bookings for other members (past)
    { id: "b20", studio_id: "s1", class_instance_id: "pci1", user_id: "u-mem-1", status: "attended", booked_at: "2025-02-05T06:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up1", created_at: "2025-02-05T06:00:00Z", user: members[0], class_instance: pastClassInstances[0] },
    { id: "b21", studio_id: "s1", class_instance_id: "pci2", user_id: "u-mem-4", status: "attended", booked_at: "2025-02-03T08:00:00Z", credits_used: 1, payment_method: "credits", user_package_id: "up4", created_at: "2025-02-03T08:00:00Z", user: members[3], class_instance: pastClassInstances[1] },
    { id: "b22", studio_id: "s1", class_instance_id: "pci3", user_id: "u-mem-5", status: "attended", booked_at: "2025-01-31T10:00:00Z", credits_used: 0, payment_method: "membership", user_membership_id: "um1", created_at: "2025-01-31T10:00:00Z", user: members[4], class_instance: pastClassInstances[2] },
];

// ── Payments ──
export const payments: Payment[] = [
    { id: "pay1", studio_id: "s1", user_id: "u-mem-1", amount: 950, currency: "AED", type: "package_purchase", status: "completed", created_at: "2024-11-01T10:00:00Z", user: members[0] },
    { id: "pay2", studio_id: "s1", user_id: "u-mem-2", amount: 1700, currency: "AED", type: "package_purchase", status: "completed", created_at: "2024-10-15T10:00:00Z", user: members[1] },
    { id: "pay3", studio_id: "s1", user_id: "u-mem-3", amount: 150, currency: "AED", type: "package_purchase", status: "completed", created_at: "2024-12-01T10:00:00Z", user: members[2] },
    { id: "pay4", studio_id: "s1", user_id: "u-mem-4", amount: 600, currency: "AED", type: "package_purchase", status: "completed", created_at: "2024-12-20T10:00:00Z", user: members[3] },
    { id: "pay5", studio_id: "s1", user_id: "u-mem-5", amount: 1200, currency: "AED", type: "membership", status: "completed", created_at: "2025-01-01T10:00:00Z", user: members[4] },
    { id: "pay6", studio_id: "s1", user_id: "u-mem-6", amount: 800, currency: "AED", type: "membership", status: "completed", created_at: "2025-01-01T10:00:00Z", user: members[5] },
    { id: "pay7", studio_id: "s1", user_id: "u-mem-9", amount: 950, currency: "AED", type: "package_purchase", status: "completed", created_at: "2025-01-10T10:00:00Z", user: members[8] },
    { id: "pay8", studio_id: "s1", user_id: "u-mem-3", amount: 950, currency: "AED", type: "package_purchase", status: "completed", created_at: "2025-01-15T10:00:00Z", user: members[2] },
    { id: "pay9", studio_id: "s1", user_id: "u-mem-3", amount: 800, currency: "AED", type: "membership", status: "completed", created_at: "2025-01-01T10:00:00Z", user: members[2] },
    { id: "pay10", studio_id: "s1", user_id: "u-mem-3", amount: 85, currency: "AED", type: "retail", status: "completed", created_at: "2025-02-02T14:00:00Z", user: members[2] },
];

// ── Wallet Transactions ──
export const walletTransactions: WalletTransaction[] = [
    { id: "wt1", user_id: "u-mem-1", studio_id: "s1", type: "credit_purchase", amount: 10, balance_after: 10, description: "Purchased 10-Class Pack", created_at: "2024-11-01T10:00:00Z" },
    { id: "wt2", user_id: "u-mem-1", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 9, reference_id: "b1", description: "Booked Reformer Pilates", created_at: "2025-01-15T08:00:00Z" },
    { id: "wt3", user_id: "u-mem-1", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 8, reference_id: "b6", description: "No-show: Reformer Pilates", created_at: "2025-01-16T08:00:00Z" },
    { id: "wt4", user_id: "u-mem-2", studio_id: "s1", type: "credit_purchase", amount: 20, balance_after: 20, description: "Purchased 20-Class Pack", created_at: "2024-10-15T10:00:00Z" },
    { id: "wt5", user_id: "u-mem-2", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 19, reference_id: "b2", description: "Booked Reformer Pilates", created_at: "2025-01-15T09:00:00Z" },
    // Olivia Martinez (u-mem-3)
    { id: "wt6", user_id: "u-mem-3", studio_id: "s1", type: "credit_purchase", amount: 3, balance_after: 3, description: "Purchased Intro Offer (3 Classes)", created_at: "2024-12-01T10:00:00Z" },
    { id: "wt7", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 2, description: "Booked Reformer Pilates", created_at: "2024-12-05T08:00:00Z" },
    { id: "wt8", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 1, description: "Booked Mat Pilates", created_at: "2024-12-10T09:00:00Z" },
    { id: "wt9", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 0, description: "Booked Barre", created_at: "2024-12-15T17:30:00Z" },
    { id: "wt10", user_id: "u-mem-3", studio_id: "s1", type: "credit_purchase", amount: 10, balance_after: 10, description: "Purchased 10-Class Pack", created_at: "2025-01-15T10:00:00Z" },
    { id: "wt11", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 9, reference_id: "b14", description: "Booked Reformer Pilates", created_at: "2025-02-05T06:00:00Z" },
    { id: "wt12", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 8, reference_id: "b17", description: "No-show: Reformer Pilates", created_at: "2025-01-28T08:00:00Z" },
    { id: "wt13", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 7, reference_id: "b18", description: "Booked Reformer Pilates", created_at: "2025-01-25T06:30:00Z" },
    { id: "wt14", user_id: "u-mem-3", studio_id: "s1", type: "credit_use", amount: -1, balance_after: 6, reference_id: "b11", description: "Booked Mat Pilates", created_at: "2025-02-08T10:00:00Z" },
    { id: "wt15", user_id: "u-mem-3", studio_id: "s1", type: "referral_bonus", amount: 2, balance_after: 8, description: "Referral bonus: Mia Anderson signed up", created_at: "2025-01-20T12:00:00Z" },
];

// ── Report Data (Pre-aggregated for charts) ──

export const revenueByMonth = [
    { month: "Aug", sales: 4200, recognized: 2800, deferred: 1400 },
    { month: "Sep", sales: 5100, recognized: 3400, deferred: 1700 },
    { month: "Oct", sales: 6800, recognized: 4200, deferred: 2600 },
    { month: "Nov", sales: 7200, recognized: 5100, deferred: 2100 },
    { month: "Dec", sales: 5500, recognized: 4800, deferred: 700 },
    { month: "Jan", sales: 8400, recognized: 5600, deferred: 2800 },
];

export const attendanceByDay = [
    { day: "Mon", attended: 28, no_show: 2, late_cancel: 1 },
    { day: "Tue", attended: 23, no_show: 1, late_cancel: 2 },
    { day: "Wed", attended: 20, no_show: 3, late_cancel: 0 },
    { day: "Thu", attended: 26, no_show: 1, late_cancel: 1 },
    { day: "Fri", attended: 11, no_show: 0, late_cancel: 1 },
    { day: "Sat", attended: 33, no_show: 2, late_cancel: 0 },
    { day: "Sun", attended: 0, no_show: 0, late_cancel: 0 },
];

export const classByPopularity = [
    { name: "Reformer Pilates", bookings: 142, occupancy: 89 },
    { name: "Mat Pilates", bookings: 98, occupancy: 78 },
    { name: "Barre", bookings: 87, occupancy: 72 },
    { name: "Reformer Pilates", bookings: 45, occupancy: 65 },
    { name: "Private Reformer", bookings: 22, occupancy: 91 },
];

export const memberGrowth = [
    { month: "Aug", total: 42, new: 8 },
    { month: "Sep", total: 51, new: 12 },
    { month: "Oct", total: 59, new: 10 },
    { month: "Nov", total: 68, new: 14 },
    { month: "Dec", total: 72, new: 6 },
    { month: "Jan", total: 84, new: 15 },
];
// Retail
export const products: Product[] = [
    {
        id: "p1", studio_id: "s1", name: "SyncFit Grippy Socks",
        description: "High-performance non-slip socks for Pilates and Yoga.",
        price: 85, cost_price: 35, stock_quantity: 42, low_stock_threshold: 15,
        category: "apparel", is_active: true
    },
    {
        id: "p2", studio_id: "s1", name: "Glass Water Bottle",
        description: "Eco-friendly 750ml glass bottle with silicone sleeve.",
        price: 120, cost_price: 60, stock_quantity: 8, low_stock_threshold: 10,
        category: "equipment", is_active: true
    },
    {
        id: "p3", studio_id: "s1", name: "Protein Bar (Choco)",
        description: "20g protein, no added sugar.",
        price: 18, cost_price: 8, stock_quantity: 150, low_stock_threshold: 50,
        category: "food_drink", is_active: true
    }
];

export const retailSales: RetailSale[] = [
    {
        id: "rs1", studio_id: "s1", user_id: "u-mem-1", total_amount: 85,
        payment_method: "card_on_file",
        items: [{ product_id: "p1", quantity: 1, price_at_sale: 85 }],
        created_at: "2024-03-10T14:30:00Z"
    },
    {
        id: "rs2", studio_id: "s1", user_id: "u-mem-3", total_amount: 85,
        payment_method: "card_on_file",
        items: [{ product_id: "p1", quantity: 1, price_at_sale: 85 }],
        created_at: "2025-02-02T14:00:00Z"
    },
    {
        id: "rs3", studio_id: "s1", user_id: "u-mem-2", total_amount: 138,
        payment_method: "card_on_file",
        items: [{ product_id: "p2", quantity: 1, price_at_sale: 120 }, { product_id: "p3", quantity: 1, price_at_sale: 18 }],
        created_at: "2025-01-28T11:00:00Z"
    },
    {
        id: "rs4", studio_id: "s1", user_id: "u-mem-5", total_amount: 36,
        payment_method: "card_on_file",
        items: [{ product_id: "p3", quantity: 2, price_at_sale: 18 }],
        created_at: "2025-02-05T09:30:00Z"
    },
    {
        id: "rs5", studio_id: "s1", user_id: "u-mem-3", total_amount: 18,
        payment_method: "card_on_file",
        items: [{ product_id: "p3", quantity: 1, price_at_sale: 18 }],
        created_at: "2025-02-08T10:15:00Z"
    },
    {
        id: "rs6", studio_id: "s1", user_id: "u-mem-4", total_amount: 120,
        payment_method: "card_on_file",
        items: [{ product_id: "p2", quantity: 1, price_at_sale: 120 }],
        created_at: "2025-02-01T15:00:00Z"
    }
];

// ── Marketing (Promo Codes) ──
export const promoCodes: PromoCode[] = [
    {
        id: "pc1", studio_id: "s1", code: "WELCOME20", type: "percentage", value: 20,
        applies_to: "all", usage_count: 145, valid_from: "2024-01-01", is_active: true
    },
    {
        id: "pc2", studio_id: "s1", code: "SUMMER50", type: "fixed_amount", value: 50,
        applies_to: "packages", min_spend: 500, usage_count: 32, valid_from: "2024-06-01", valid_until: "2024-08-31", is_active: true
    },
    {
        id: "pc3", studio_id: "s1", code: "FLASH10", type: "percentage", value: 10,
        applies_to: "retail", usage_limit: 100, usage_count: 8, valid_from: "2025-02-10", is_active: false
    }
];

// ── Marketing (Campaigns) ──
export const campaigns: Campaign[] = [
    {
        id: "cmp1", studio_id: "s1", name: "New Year Challenge", type: "email", status: "sent",
        audience: "all_members", subject: "Join the 30-Day Reset Challenge!",
        content: "Start your year strong with our unlimited class challenge...",
        sent_at: "2025-01-02T09:00:00Z",
        stats: { sent: 850, opened: 420, clicked: 180 },
        created_at: "2024-12-28T10:00:00Z"
    },
    {
        id: "cmp2", studio_id: "s1", name: "We Miss You", type: "sms", status: "sent",
        audience: "inactive_members",
        content: "Hey {name}, it's been a while! Come back for a free class on us.",
        sent_at: "2025-02-01T10:00:00Z",
        stats: { sent: 45, opened: 38, clicked: 12 },
        created_at: "2025-01-30T10:00:00Z"
    },
    {
        id: "cmp3", studio_id: "s1", name: "March Madness", type: "email", status: "draft",
        audience: "active_members", subject: "March Madness is coming...",
        content: "Get ready for our biggest event of the year.",
        stats: { sent: 0, opened: 0, clicked: 0 },
        created_at: "2025-02-10T15:00:00Z"
    }
];

// ── AI & Smart Features (Simulated Data) ──

export const revenueProjection = [
    { month: "Feb", actual: 8800, projected: 8800 },
    { month: "Mar", actual: null, projected: 9200 },
    { month: "Apr", actual: null, projected: 9600 },
    { month: "May", actual: null, projected: 10100 },
    { month: "Jun", actual: null, projected: 10800 },
    { month: "Jul", actual: null, projected: 11500 },
];

export const churnRiskSummary = {
    totalAtRisk: 3,
    highRisk: 2,
    mediumRisk: 1,
    projectedChurnRate: 8.5,
    trend: -1.2,  // improvement vs last month
};

export const aiInsights = [
    { id: "ai1", type: "churn" as const, title: "Fatima Al-Sayed may churn", description: "No bookings in 28 days. Last attended Barre on Jan 4. Risk score: 78%.", severity: "high" as const, actionLabel: "Send Win-Back", memberId: "u-mem-7" },
    { id: "ai2", type: "churn" as const, title: "Lucas Brown inactive", description: "Account deactivated. No activity in 60+ days. Risk score: 92%.", severity: "critical" as const, actionLabel: "Review Account", memberId: "u-mem-8" },
    { id: "ai3", type: "revenue" as const, title: "Revenue trending up +12%", description: "Projected monthly revenue of AED 10,100 by May based on current growth trajectory.", severity: "positive" as const, actionLabel: "View Forecast" },
    { id: "ai4", type: "engagement" as const, title: "Saturday classes at 95% capacity", description: "Consider adding an extra Saturday morning slot. Waitlist demand is high.", severity: "info" as const, actionLabel: "View Schedule" },
    { id: "ai5", type: "engagement" as const, title: "Reformer Pilates is top performer", description: "89% avg occupancy with growing waitlist. Highest retention among attendees.", severity: "positive" as const, actionLabel: "View Analytics" },
];

export const classRecommendations = [
    { classTypeId: "ct1", reason: "Based on your booking history", matchScore: 95 },
    { classTypeId: "ct3", reason: "Popular with similar members", matchScore: 82 },
    { classTypeId: "ct4", reason: "Complements your routine", matchScore: 74 },
    { classTypeId: "ct2", reason: "Great for beginners", matchScore: 68 },
];

// ── Notifications ──
export const notifications: Notification[] = [
    { id: "n1", studio_id: "s1", user_id: "u-mem-3", type: "booking_confirmation", channel: "email", status: "sent", subject: "Booking Confirmed", body: "Your Reformer Pilates class on Feb 12 at 6:30 AM is confirmed.", sent_at: "2025-02-10T06:30:00Z", created_at: "2025-02-10T06:30:00Z" },
    { id: "n2", studio_id: "s1", user_id: "u-mem-3", type: "reminder_24h", channel: "whatsapp", status: "sent", subject: "Class Tomorrow", body: "Reminder: Mat Pilates tomorrow at 10:00 AM. Don't forget your towel!", sent_at: "2025-02-09T10:00:00Z", created_at: "2025-02-09T10:00:00Z" },
    { id: "n3", studio_id: "s1", user_id: "u-mem-3", type: "payment", channel: "email", status: "sent", subject: "Payment Received", body: "AED 750 payment for 10-Class Pack received. Thank you!", sent_at: "2025-01-15T10:05:00Z", created_at: "2025-01-15T10:05:00Z" },
    { id: "n4", studio_id: "s1", user_id: "u-mem-3", type: "waitlist_promotion", channel: "email", status: "sent", subject: "You're In!", body: "Great news! A spot opened up in Barre Burn on Feb 14 at 5:30 PM. You've been automatically booked.", sent_at: "2025-02-08T14:00:00Z", created_at: "2025-02-08T14:00:00Z" },
    { id: "n5", studio_id: "s1", user_id: "u-mem-3", type: "cancellation", channel: "email", status: "sent", subject: "Booking Cancelled", body: "Your Reformer Pilates class on Jan 30 has been cancelled. Credit refunded.", sent_at: "2025-01-29T09:00:00Z", created_at: "2025-01-29T09:00:00Z" },
    { id: "n6", studio_id: "s1", user_id: "u-mem-3", type: "system_alert", channel: "push", status: "sent", subject: "Referral Bonus!", body: "You earned 2 bonus credits because Mia Anderson signed up with your referral code.", sent_at: "2025-01-20T12:05:00Z", created_at: "2025-01-20T12:05:00Z" },
    { id: "n7", studio_id: "s1", user_id: "u-mem-1", type: "booking_confirmation", channel: "email", status: "sent", subject: "Booking Confirmed", body: "Your Reformer Pilates class is confirmed.", sent_at: "2025-02-08T08:00:00Z", created_at: "2025-02-08T08:00:00Z" },
    { id: "n8", studio_id: "s1", user_id: "u-mem-3", type: "reminder_24h", channel: "push", status: "pending", subject: "Class Tomorrow", body: "Reformer Pilates at 6:30 AM tomorrow. See you there!", created_at: "2025-02-11T06:30:00Z" },
    { id: "n9", studio_id: "s1", user_id: "u-inst-1", type: "system_alert", channel: "email", status: "sent", subject: "Schedule Update", body: "You have been assigned to cover Mat Pilates on Feb 15.", sent_at: "2025-02-10T09:00:00Z", created_at: "2025-02-10T09:00:00Z" },
    { id: "n10", studio_id: "s1", user_id: "admin-1", type: "system_alert", channel: "email", status: "sent", subject: "Low Stock Alert", body: "Glass Water Bottle is below the low stock threshold (8 remaining).", sent_at: "2025-02-10T08:00:00Z", created_at: "2025-02-10T08:00:00Z" },
];

// ── Gift Cards ──
export const giftCards: GiftCard[] = [
    { id: "gc1", studio_id: "s1", code: "GIFT-ABCD-1234", original_value: 500, balance: 200, purchaser_id: "u-mem-1", recipient_id: "u-mem-3", expires_at: "2025-06-01T00:00:00Z", status: "active", created_at: "2025-01-10T10:00:00Z" },
    { id: "gc2", studio_id: "s1", code: "GIFT-EFGH-5678", original_value: 300, balance: 0, purchaser_id: "u-mem-2", recipient_id: "u-mem-3", expires_at: "2025-03-01T00:00:00Z", status: "redeemed", created_at: "2024-12-15T10:00:00Z" },
    { id: "gc3", studio_id: "s1", code: "GIFT-IJKL-9012", original_value: 200, balance: 200, purchaser_id: "u-mem-4", recipient_id: "u-mem-5", expires_at: "2025-08-01T00:00:00Z", status: "active", created_at: "2025-02-01T10:00:00Z" },
];

// ── Instructor Pay Rules ──
export const instructorPayRules: InstructorPayRule[] = [
    { id: "ipr1", studio_id: "s1", instructor_id: "u-inst-1", class_type_id: "ct1", pay_type: "fixed", rate: 250 },
    { id: "ipr2", studio_id: "s1", instructor_id: "u-inst-1", class_type_id: "ct2", pay_type: "fixed", rate: 200 },
    { id: "ipr3", studio_id: "s1", instructor_id: "u-inst-1", class_type_id: "ct3", pay_type: "per_attendee", rate: 35 },
    { id: "ipr4", studio_id: "s1", instructor_id: "u-inst-2", class_type_id: "ct1", pay_type: "fixed", rate: 280 },
    { id: "ipr5", studio_id: "s1", instructor_id: "u-inst-2", class_type_id: "ct4", pay_type: "per_attendee", rate: 40 },
    { id: "ipr6", studio_id: "s1", instructor_id: "u-inst-3", class_type_id: "ct2", pay_type: "fixed", rate: 220 },
    { id: "ipr7", studio_id: "s1", instructor_id: "u-inst-3", class_type_id: "ct5", pay_type: "fixed", rate: 350 },
];

// ── Service Add-Ons ──
export const serviceAddOns: ServiceAddOn[] = [
    { id: "sa1", studio_id: "s1", name: "Roller Rental", price: 20, class_type_ids: ["ct1", "ct2", "ct4"], is_active: true },
    { id: "sa2", studio_id: "s1", name: "Grip Socks", price: 30, class_type_ids: ["ct1", "ct3"], is_active: true },
    { id: "sa3", studio_id: "s1", name: "Yoga Mat Premium", price: 15, class_type_ids: ["ct2", "ct4"], is_active: true },
    { id: "sa4", studio_id: "s1", name: "Resistance Band Set", price: 25, class_type_ids: ["ct3", "ct4"], is_active: true },
];
