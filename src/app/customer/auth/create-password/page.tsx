"use client";

// Customer — Create password (sign-up step) · `/customer/auth/create-password` · Figma 4510-146346
// After the email step, before personal info. Sets the account password.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authDraft } from "@/lib/customer/auth-flow";
import { passwordValid } from "@/lib/customer/password-rules";
import { AuthHeader, AUTH_CONTENT_OFFSET } from "@/components/customer/auth/AuthHeader";
import { PasswordInput } from "@/components/customer/auth/PasswordInput";
import { PasswordChecklist } from "@/components/customer/auth/PasswordChecklist";
import { Button } from "@/components/ui/button";

export default function CreatePasswordPage() {
    const router = useRouter();
    const [pw, setPw] = useState(authDraft.password);
    const [confirm, setConfirm] = useState(authDraft.password);

    useEffect(() => {
        if (!authDraft.email) router.replace("/customer/auth");
    }, [router]);

    const canContinue = passwordValid(pw) && confirm === pw;

    function onContinue() {
        if (!canContinue) return;
        authDraft.password = pw;
        router.push("/customer/auth/signup");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader onClose={() => router.back()} />

            <div className={`flex flex-1 flex-col gap-6 px-4 pb-8 ${AUTH_CONTENT_OFFSET}`}>
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Create password</h1>
                    <p className="text-base leading-6 text-[#667085]">Set a password to get started.</p>
                </div>

                <div className="flex w-full flex-col gap-5">
                    <div className="flex flex-col gap-3">
                        <PasswordInput label="Create password" value={pw} onChange={setPw} placeholder="Create a password" />
                        <PasswordChecklist password={pw} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <PasswordInput
                            label="Confirm password"
                            value={confirm}
                            onChange={setConfirm}
                            placeholder="Confirm your password"
                            error={confirm.length > 0 && confirm !== pw}
                        />
                        <p className="text-xs leading-[18px] text-[#667085]">Make sure it matches your password.</p>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-white px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                <Button variant="primary" size="xl" disabled={!canContinue} className="w-full rounded-full" onClick={onContinue}>
                    Confirm
                </Button>
            </div>
        </div>
    );
}
