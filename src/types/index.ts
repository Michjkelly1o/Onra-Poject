// ───────────────────────────────────────────────────
// SyncFit — TypeScript Interfaces
// Mirrors the PRD database entities
// ───────────────────────────────────────────────────

export type UserRole = "admin" | "instructor" | "member";

export type BookingStatus =
    | "confirmed"
    | "cancelled"
    | "no_show"
    | "attended"
    | "late_cancelled"
    | "waitlist"; // Added waitlist

export type ClassStatus = "scheduled" | "cancelled" | "completed";

export type PaymentType =
    | "package_purchase"
    | "membership"
    | "direct_class"
    | "retail"
    | "refund";

export type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

export type PackageStatus = "active" | "frozen" | "expired" | "fully_used"; // Added frozen

export type MembershipStatus = "active" | "cancelled" | "expired";

export type WalletTransactionType =
    | "credit_purchase"
    | "credit_use"
    | "credit_refund"
    | "gift_card_redeem"
    | "referral_bonus"
    | "adjustment";

export type NotificationType =
    | "booking_confirmation"
    | "reminder_24h"
    | "cancellation"
    | "payment"
    | "waitlist_promotion" // Added
    | "system_alert"; // Added

export type DifficultyLevel = "beginner" | "intermediate" | "advanced" | "all_levels"; // Added

// ── Core Entities ──

export interface Studio {
    id: string;
    name: string;
    slug: string;
    address: string;
    phone: string;
    email: string;
    timezone: string;
    cancellation_window_hours: number;
    booking_window_days: number;
    logo_url?: string;
    created_at: string;
}

export interface User {
    id: string;
    studio_id: string;
    role: UserRole;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    emergency_contact_name?: string;
    emergency_contact_phone?: string;
    waiver_signed: boolean;
    waiver_signed_at?: string;
    avatar_url?: string;
    is_active: boolean;
    churn_risk_score?: number; // Added for AI
    permissions?: string[]; // Added for RBAC
    created_at: string;
}

export interface Room {
    id: string;
    studio_id: string;
    name: string;
    capacity: number;
    is_active: boolean;
}

export interface ClassType {
    id: string;
    studio_id: string;
    name: string;
    description: string;
    difficulty_level: DifficultyLevel; // Added
    default_duration_min: number;
    default_capacity: number;
    default_room_id?: string;
    equipment_notes?: string;
    color: string;
    is_active: boolean;
    created_at: string;
    level_required?: number; // minimum member level to book
}

export interface ClassInstance {
    id: string;
    studio_id: string;
    class_type_id: string;
    instructor_id: string;
    room_id: string;
    start_time: string;
    end_time: string;
    capacity: number;
    booked_count: number;
    waitlist_count: number; // Added
    status: ClassStatus;
    notes?: string;
    created_at: string;
    // Joined fields (for display)
    class_type?: ClassType;
    instructor?: User;
    room?: Room;
}

export interface Booking {
    id: string;
    studio_id: string;
    class_instance_id: string;
    user_id: string;
    status: BookingStatus;
    waitlist_position?: number; // Added
    booked_at: string;
    cancelled_at?: string;
    credits_used: number;
    payment_method: "credits" | "membership" | "direct_pay";
    user_package_id?: string;
    user_membership_id?: string;
    add_on_ids?: string[]; // Added for Service Add-ons
    created_at: string;
    // Joined fields
    user?: User;
    class_instance?: ClassInstance;
}

export interface Package {
    id: string;
    studio_id: string;
    name: string;
    description: string;
    price: number;
    credit_count: number;
    validity_days: number;
    class_type_ids: string[];
    is_active: boolean;
    created_at: string;
}

export interface UserPackage {
    id: string;
    user_id: string;
    package_id: string;
    studio_id: string;
    credits_total: number;
    credits_used: number;
    credits_remaining: number;
    purchased_at: string;
    expires_at: string;
    purchase_location: "online" | "in_studio";
    status: PackageStatus;
    frozen_until?: string; // Added
    payment_id: string;
    created_at: string;
    // Joined
    package?: Package;
    user?: User;
}

export interface Membership {
    id: string;
    studio_id: string;
    name: string;
    description: string;
    price: number;
    billing_period: "monthly" | "quarterly" | "annual";
    class_type_ids: string[];
    max_bookings_per_period?: number;
    is_active: boolean;
    created_at: string;
}

export interface UserMembership {
    id: string;
    user_id: string;
    membership_id: string;
    studio_id: string;
    start_date: string;
    end_date?: string;
    auto_renew: boolean;
    status: MembershipStatus;
    created_at: string;
    // Joined
    membership?: Membership;
    user?: User;
}

export interface Payment {
    id: string;
    studio_id: string;
    user_id: string;
    amount: number;
    currency: string;
    type: PaymentType;
    status: PaymentStatus;
    metadata?: Record<string, unknown>;
    created_at: string;
    // Joined
    user?: User;
}

export interface WalletTransaction {
    id: string;
    user_id: string;
    studio_id: string;
    type: WalletTransactionType;
    amount: number;
    balance_after: number;
    reference_id?: string;
    description: string;
    created_at: string;
}

export interface Notification {
    id: string;
    studio_id: string;
    user_id: string;
    type: NotificationType;
    channel: "email" | "whatsapp" | "push"; // Added push
    status: "pending" | "sent" | "failed";
    subject: string;
    body: string;
    sent_at?: string;
    created_at: string;
}

export interface AuditLog {
    id: string;
    studio_id: string;
    user_id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    changes?: Record<string, unknown>;
    created_at: string;
}

// ── Inventory / Retail Entities (New P2) ──

export interface Product {
    id: string;
    studio_id: string;
    name: string;
    description?: string;
    price: number;
    cost_price?: number;
    stock_quantity: number;
    low_stock_threshold: number;
    category: "apparel" | "equipment" | "food_drink" | "other";
    image_url?: string;
    is_active: boolean;
}

export interface RetailSale {
    id: string;
    studio_id: string;
    user_id: string;
    total_amount: number;
    payment_method: "card_on_file" | "terminal" | "cash";
    items: {
        product_id: string;
        quantity: number;
        price_at_sale: number;
    }[];
    created_at: string;
    // Joined
    user?: User;
}

// ── UI / Report Helpers ──

export interface KpiCard {
    title: string;
    value: string | number;
    change?: number; // percentage change
    changeLabel?: string;
    icon: string;
    color: string;
    subtext?: string; // Added
}

export interface ReportFilter {
    dateRange: { from: string; to: string };
    preset?: "ytd" | "mtd" | "yoy" | "custom";
    instructorId?: string;
    classTypeId?: string;
    serviceId?: string;
}

// ── Marketing Entities (New P2) ──

export interface PromoCode {
    id: string;
    studio_id: string;
    code: string;
    type: "percentage" | "fixed_amount";
    value: number;
    applies_to: "all" | "packages" | "memberships" | "retail" | "classes";
    min_spend?: number;
    usage_limit?: number;
    usage_count: number;
    valid_from: string;
    valid_until?: string;
    is_active: boolean;
}

export interface Campaign {
    id: string;
    studio_id: string;
    name: string;
    type: "email" | "sms" | "push";
    status: "draft" | "scheduled" | "sent";
    audience: "all_members" | "active_members" | "inactive_members" | "leads";
    subject?: string;
    content: string;
    sent_at?: string;
    stats: {
        sent: number;
        opened: number;
        clicked: number;
    };
    created_at: string;
}

// ── Gift Cards ──

export interface GiftCard {
    id: string;
    studio_id: string;
    code: string;
    original_value: number;
    balance: number;
    purchaser_id: string;
    recipient_id: string;
    expires_at: string;
    status: "active" | "redeemed" | "expired";
    created_at: string;
}

// ── Instructor Compensation ──

export interface InstructorPayRule {
    id: string;
    studio_id: string;
    instructor_id: string;
    class_type_id: string;
    pay_type: "fixed" | "per_attendee" | "per_class" | "per_head" | "hourly" | "fixed_monthly";
    rate: number;
}

// ── Service Add-Ons ──

export interface ServiceAddOn {
    id: string;
    studio_id: string;
    name: string;
    price: number;
    class_type_ids: string[];
    is_active: boolean;
}
