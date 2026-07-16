"use client";

// Customer — Log in password · `/customer/auth/login-password`
// Existing account: enter password → OTP. Validated against the demo password.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { authDraft } from "@/lib/customer/auth-flow";
import { getCustomerPassword, DEMO_CUSTOMER_PASSWORD } from "@/lib/customer/customer-password";
import { AuthHeader, AUTH_CONTENT_OFFSET } from "@/components/customer/auth/AuthHeader";
import { PasswordInput } from "@/components/customer/auth/PasswordInput";
import { Button } from "@/components/ui/button";

export default function LoginPasswordPage() {
    const router = useRouter();
    const showToast = useAppStore((s) => s.showToast);
    const [pw, setPw] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authDraft.loginCustomerId) router.replace("/customer/auth");
    }, [router]);

    function onContinue() {
        const expected = getCustomerPassword() || DEMO_CUSTOMER_PASSWORD;
        if (pw !== expected) {
            setError("Incorrect password. Please try again.");
            return;
        }
        setError(null);
        router.push("/customer/auth/otp");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader onClose={() => router.back()} />

            <div className={`flex flex-1 flex-col gap-6 px-4 pb-8 ${AUTH_CONTENT_OFFSET}`}>
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Welcome back</h1>
                    <p className="text-base leading-6 text-[#667085]">Enter your password to log in as {authDraft.email}.</p>
                </div>

                <div className="flex w-full flex-col gap-3">
                    <PasswordInput
                        label="Password"
                        value={pw}
                        onChange={(v) => {
                            setPw(v);
                            if (error) setError(null);
                        }}
                        placeholder="Enter your password"
                        error={!!error}
                    />
                    {error && <span className="text-sm leading-5 text-[#d92d20]">{error}</span>}
                    <button
                        type="button"
                        onClick={() => showToast("Reset link sent", "Check your email to reset your password.", "success")}
                        className="self-start text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                    >
                        Forgot password?
                    </button>
                </div>
            </div>

            <div className="sticky bottom-0 z-10 bg-white px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
                <Button variant="primary" size="xl" disabled={pw.length === 0} className="w-full rounded-full" onClick={onContinue}>
                    Continue
                </Button>
            </div>
        </div>
    );
}
