"use client";

// Customer — auth flow draft (module-level, per-session, NOT persisted).
// Carries the entered email + branch decision between the email → OTP → sign-up
// → emergency screens (same pattern as `bookingDraft`). Cleared on completion or
// a fresh entry to `/customer/auth`; a mid-flow refresh resets it (by design).

export interface SignupDraft {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    phone: string; // "+971 55 200 2001"
    referralCode?: string;
    marketingOptOut: boolean;
}

interface AuthDraft {
    email: string;
    mode: "login" | "signup";
    /** Matched customer id when `mode === "login"`. */
    loginCustomerId: string | null;
    /** Collected sign-up fields (before OTP), when `mode === "signup"`. */
    signup: SignupDraft | null;
    /** The freshly-created customer id after sign-up OTP (drives Emergency step). */
    newCustomerId: string | null;
}

export const authDraft: AuthDraft = {
    email: "",
    mode: "login",
    loginCustomerId: null,
    signup: null,
    newCustomerId: null,
};

export function resetAuthDraft() {
    authDraft.email = "";
    authDraft.mode = "login";
    authDraft.loginCustomerId = null;
    authDraft.signup = null;
    authDraft.newCustomerId = null;
}

/** Basic RFC-ish email format check (prototype — good enough to gate Continue). */
export function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
