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
    /** Password chosen at the Create-password step (sign-up). */
    password: string;
    mode: "login" | "signup";
    /** Matched customer id when `mode === "login"`. */
    loginCustomerId: string | null;
    /** Collected sign-up fields (before OTP), when `mode === "signup"`. */
    signup: SignupDraft | null;
    /** The freshly-created customer id after sign-up OTP (drives Emergency step). */
    newCustomerId: string | null;
    /** Where to land after a successful login / sign-up (the page the guest was on
     *  before tapping Log in). Null → default to Home. */
    returnTo: string | null;
}

export const authDraft: AuthDraft = {
    email: "",
    password: "",
    mode: "login",
    loginCustomerId: null,
    signup: null,
    newCustomerId: null,
    returnTo: null,
};

export function resetAuthDraft() {
    authDraft.email = "";
    authDraft.password = "";
    authDraft.mode = "login";
    authDraft.loginCustomerId = null;
    authDraft.signup = null;
    authDraft.newCustomerId = null;
    authDraft.returnTo = null;
}

/** Basic RFC-ish email format check (prototype — good enough to gate Continue). */
export function isValidEmail(v: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/** Only allow internal customer routes as a post-login destination (never loop
 *  back into the auth flow itself) — guards against open-redirect + auth loops. */
export function safeReturnTo(v: string | null | undefined): string | null {
    if (!v) return null;
    return v.startsWith("/customer") && !v.startsWith("/customer/auth") ? v : null;
}

/** Build the login front-door URL, carrying the page to return to after login. */
export function loginHref(returnTo?: string | null): string {
    const safe = safeReturnTo(returnTo);
    return safe ? `/customer/auth?returnTo=${encodeURIComponent(safe)}` : "/customer/auth";
}
