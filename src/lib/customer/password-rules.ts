// Customer — password strength rules (Create / Change password).

export type PasswordCheckKey = "length" | "case" | "number" | "special";

export function checkPassword(pw: string): Record<PasswordCheckKey, boolean> {
    return {
        length: pw.length >= 8,
        case: /[a-z]/.test(pw) && /[A-Z]/.test(pw),
        number: /\d/.test(pw),
        special: /[^A-Za-z0-9]/.test(pw),
    };
}
export function passwordValid(pw: string): boolean {
    const c = checkPassword(pw);
    return c.length && c.case && c.number && c.special;
}
export const PASSWORD_RULES: { key: PasswordCheckKey; label: string }[] = [
    { key: "length", label: "A minimum of 8 characters" },
    { key: "case", label: "Lower and uppercase letters" },
    { key: "number", label: "At least 1 number" },
    { key: "special", label: "At least 1 special character" },
];
