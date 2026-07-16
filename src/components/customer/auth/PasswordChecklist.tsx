"use client";

import { Check } from "@untitledui/icons";
import { checkPassword, PASSWORD_RULES } from "@/lib/customer/password-rules";

export function PasswordChecklist({ password }: { password: string }) {
    const checks = checkPassword(password);
    return (
        <div className="flex flex-col gap-2">
            {PASSWORD_RULES.map((r) => {
                const ok = checks[r.key];
                return (
                    <div key={r.key} className="flex items-center gap-2 text-sm leading-5">
                        <Check className={`size-4 shrink-0 ${ok ? "text-[var(--brand-primary)]" : "text-[#98a2b3]"}`} aria-hidden />
                        <span className={ok ? "text-[#344054]" : "text-[#667085]"}>{r.label}</span>
                    </div>
                );
            })}
        </div>
    );
}
