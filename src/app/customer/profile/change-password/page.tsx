"use client";

// Customer — Create / Change password (`/customer/profile/change-password`).
// Reuses the same password-creation design as sign-up. Shows "Create password"
// (no current field) for accounts with no password yet (social sign-up), else
// "Change password" (requires the current password).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useMainScrollable } from "@/lib/customer/use-scrollable";
import { getCustomerPassword, setCustomerPassword, useHasCustomerPassword } from "@/lib/customer/customer-password";
import { passwordValid } from "@/lib/customer/password-rules";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { PasswordInput } from "@/components/customer/auth/PasswordInput";
import { PasswordChecklist } from "@/components/customer/auth/PasswordChecklist";
import { Button } from "@/components/ui/button";

export default function ChangePasswordPage() {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const scrollable = useMainScrollable();
    const hasPassword = useHasCustomerPassword();

    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");

    const title = hasPassword ? "Change password" : "Create password";
    const canSave = (!hasPassword || current.length > 0) && passwordValid(next) && confirm === next;

    function save() {
        if (hasPassword && current !== getCustomerPassword()) {
            showToast("Incorrect password", "Your current password doesn't match.", "error");
            return;
        }
        if (!passwordValid(next)) {
            showToast("Weak password", "Meet all the password requirements.", "error");
            return;
        }
        if (next !== confirm) {
            showToast("Passwords don't match", "Re-enter your new password.", "error");
            return;
        }
        setCustomerPassword(next);
        showToast(hasPassword ? "Password changed" : "Password created", "Your password has been updated.", "success");
        router.back();
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">{title}</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-[80px]">
                {hasPassword && (
                    <PasswordInput label="Current password" value={current} onChange={setCurrent} placeholder="Enter current password" />
                )}
                <div className="flex flex-col gap-3">
                    <PasswordInput label={hasPassword ? "New password" : "Create password"} value={next} onChange={setNext} placeholder="Create a password" />
                    <PasswordChecklist password={next} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <PasswordInput
                        label="Confirm password"
                        value={confirm}
                        onChange={setConfirm}
                        placeholder="Confirm your password"
                        error={confirm.length > 0 && confirm !== next}
                    />
                    <p className="text-xs leading-[18px] text-[#667085]">Make sure it matches your password.</p>
                </div>
            </div>

            <div
                className={`sticky bottom-0 z-10 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))] ${
                    scrollable ? "bg-white" : ""
                }`}
            >
                <Button variant="primary" size="xl" disabled={!canSave} className="w-full rounded-full" onClick={save}>
                    Save changes
                </Button>
            </div>
        </div>
    );
}
