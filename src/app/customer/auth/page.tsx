"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Log in or sign up (email entry) · `/customer/auth` · Figma 3228-22614
// ─────────────────────────────────────────────────────────────────────────────
//
// The single front door for authentication. Enter an email → Continue looks it
// up in the `customers` store: an EXISTING email → OTP (login) as that customer;
// a valid UNREGISTERED email → the sign-up form (email prefilled). Malformed →
// inline error. Social buttons are simulated (Google/Apple log in as the demo
// member; Facebook toasts "coming soon"). Full-screen (nav hidden).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { loginCustomer } from "@/lib/customer/auth";
import { authDraft, isValidEmail, resetAuthDraft } from "@/lib/customer/auth-flow";
import { DEMO_MEMBER_ID } from "@/lib/customer/context";
import { AuthHeader } from "@/components/customer/auth/AuthHeader";
import { SocialAuthButtons, type SocialProvider } from "@/components/customer/auth/SocialAuthButtons";
import { Button } from "@/components/ui/button";

export default function AuthEmailPage() {
    const router = useRouter();
    const customers = useAppStore((s) => s.customers);
    const showToast = useAppStore((s) => s.showToast);

    const [email, setEmail] = useState(authDraft.email);
    const [error, setError] = useState<string | null>(null);

    const valid = isValidEmail(email);

    function onContinue() {
        if (!valid) {
            setError("Enter a valid email address");
            return;
        }
        setError(null);
        resetAuthDraft();
        authDraft.email = email.trim();
        const match = customers.find(
            (c) => c.email?.trim().toLowerCase() === email.trim().toLowerCase(),
        );
        if (match) {
            // Returning member → OTP (login) carrying the matched id.
            authDraft.mode = "login";
            authDraft.loginCustomerId = match.id;
            router.push("/customer/auth/otp");
        } else {
            // Valid, unregistered → sign up (email prefilled). Not an error.
            authDraft.mode = "signup";
            router.push("/customer/auth/signup");
        }
    }

    function onSocial(p: SocialProvider) {
        if (p === "facebook") {
            showToast("Coming soon", "Facebook sign-in isn't available yet.", "success");
            return;
        }
        // Google / Apple — simulate a returning login as the demo member.
        loginCustomer(DEMO_MEMBER_ID);
        showToast("Welcome back!", "You're now signed in.", "success", "check");
        router.replace("/customer/auth/loading");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader onClose={() => router.back()} />

            <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-8 pt-[118px]">
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Log in or sign up</h1>
                    <p className="text-base leading-6 text-[#667085]">
                        Create an account or log in to book and manage your appointments.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-6">
                    <div className="flex w-full flex-col gap-4">
                        <label className="flex w-full flex-col gap-1.5">
                            <span className="text-sm font-medium leading-5 text-[#344054]">Email</span>
                            <input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    if (error) setError(null);
                                }}
                                onKeyDown={(e) => e.key === "Enter" && onContinue()}
                                placeholder="Enter email address"
                                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none transition-colors placeholder:text-[#667085] ${
                                    error ? "border-[#fda29b] focus:border-[#f04438]" : "border-[#d0d5dd] focus:border-[var(--brand-primary)]"
                                }`}
                            />
                            {error && <span className="text-sm leading-5 text-[#d92d20]">{error}</span>}
                        </label>

                        <Button
                            variant="primary"
                            size="xl"
                            className="w-full rounded-full"
                            disabled={!valid}
                            onClick={onContinue}
                        >
                            Continue
                        </Button>
                    </div>

                    <div className="flex w-full items-center gap-3">
                        <span className="h-px flex-1 bg-[#e4e7ec]" />
                        <span className="text-base leading-6 text-[#667085]">or</span>
                        <span className="h-px flex-1 bg-[#e4e7ec]" />
                    </div>

                    <SocialAuthButtons onProvider={onSocial} />
                </div>
            </div>
        </div>
    );
}
