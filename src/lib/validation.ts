// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared input validators
// ─────────────────────────────────────────────────────────────────────────────
//
// Centralized so every form (admin Account → Change email, Customer create,
// Staff create, Instructor Edit profile, etc.) gates the Save button against
// the same rule. Adding a stricter regex or a domain block-list later means
// editing this file once instead of hunting every form individually.

/** Strict email shape — disallows whitespace AND multiple `@` signs.
 *
 *  Examples:
 *    "liam@email.com"      → true
 *    "liamemail.com"       → false  (no `@`)
 *    "liam@@email.com"     → false  (double `@`)
 *    "liam @email.com"     → false  (whitespace)
 *    "@email.com"          → false  (no local part)
 *    "liam@.com"           → false  (no domain label)
 *
 *  Same pattern the admin Change Email modal already uses; lifted here so
 *  the customer/staff/instructor forms share it without copy-pasting. */
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** True when the trimmed input is a syntactically valid email address. */
export function isValidEmail(input: string | undefined | null): boolean {
    if (!input) return false;
    return EMAIL_REGEX.test(input.trim());
}
