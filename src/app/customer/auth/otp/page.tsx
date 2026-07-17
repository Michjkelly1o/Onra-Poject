"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — OTP verification · `/customer/auth/otp` · Figma 3228-22791
// ─────────────────────────────────────────────────────────────────────────────
//
// Reused by BOTH login and sign-up (via `authDraft.mode`). 4-box OTP input;
// Verify is disabled until 4 digits. SIMULATED — any 4 digits pass:
//   • login  → set the session authenticated as the matched customer → Loading → Home.
//   • signup → create the new `customers` row → log in → Emergency contact step.
// Guards against a direct visit with no flow context (bounce to `/customer/auth`).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { loginCustomer } from "@/lib/customer/auth";
import { setCustomerPassword } from "@/lib/customer/customer-password";
import { authDraft } from "@/lib/customer/auth-flow";
import { AuthHeader, AUTH_CONTENT_OFFSET } from "@/components/customer/auth/AuthHeader";
import { OtpInput } from "@/components/customer/auth/OtpInput";
import { Button } from "@/components/ui/button";

export default function AuthOtpPage() {
    const router = useRouter();
    const addCustomer = useAppStore((s) => s.addCustomer);
    const showToast = useAppStore((s) => s.showToast);

    const [code, setCode] = useState("");
    const [cooldown, setCooldown] = useState(0);

    // No flow context (refresh / deep link) → back to the email entry.
    useEffect(() => {
        if (authDraft.mode === "login" && !authDraft.loginCustomerId) router.replace("/customer/auth");
        if (authDraft.mode === "signup" && !authDraft.signup) router.replace("/customer/auth");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    function verify() {
        if (code.length < 4) return;
        if (authDraft.mode === "login") {
            if (!authDraft.loginCustomerId) return;
            loginCustomer(authDraft.loginCustomerId);
            showToast("Welcome back!", "You're now signed in.", "success", "check");
            router.replace("/customer/auth/loading");
            return;
        }
        // Sign-up — create the real customers row, then log in and collect the
        // emergency contact. Marketing prefs default ON unless opt-out was ticked.
        const s = authDraft.signup;
        if (!s) return;
        const optIn = !s.marketingOptOut;
        const id = addCustomer({
            firstName: s.firstName,
            lastName: s.lastName,
            email: authDraft.email,
            phone: s.phone,
            planKind: null,
            dateOfBirth: s.dateOfBirth || undefined,
            gender: s.gender || undefined,
            referralCode: s.referralCode || undefined,
            marketingChannelEmail: optIn,
            marketingChannelWhatsapp: optIn,
            marketingChannelSms: optIn,
            marketingChannelPush: optIn,
            marketingTopicStudioAnnouncements: optIn,
            marketingTopicNewClassLaunch: optIn,
            marketingTopicSpecialOffers: optIn,
            marketingTopicPromoCodeOffers: optIn,
        });
        authDraft.newCustomerId = id;
        setCustomerPassword(id, authDraft.password);
        loginCustomer(id);
        router.replace("/customer/auth/loading");
    }

    function resend() {
        if (cooldown > 0) return;
        setCooldown(30);
        showToast("Code resent", "We've sent you a new code.", "success");
    }

    return (
        <div className="relative flex min-h-full flex-col">
            <AuthHeader />

            <div className={`flex flex-1 flex-col items-center gap-6 px-4 pb-8 ${AUTH_CONTENT_OFFSET}`}>
                <div className="flex w-full flex-col gap-2">
                    <h1 className="text-2xl font-semibold leading-8 text-[var(--brand-text)]">Enter OTP</h1>
                    <p className="text-base leading-6 text-[#667085]">
                        Enter the 4 digit OTP code we just sent to start using Onra.
                    </p>
                </div>

                <div className="flex w-full flex-col gap-6">
                    <OtpInput value={code} onChange={setCode} />

                    <Button
                        variant="primary"
                        size="xl"
                        className="w-full rounded-full"
                        disabled={code.length < 4}
                        onClick={verify}
                    >
                        Verify
                    </Button>

                    <div className="flex items-center justify-center gap-1">
                        <span className="text-sm leading-5 text-[#475467]">Didn&rsquo;t receive the code?</span>
                        <button
                            type="button"
                            onClick={resend}
                            disabled={cooldown > 0}
                            className="text-sm font-semibold leading-5 text-[var(--brand-primary)] disabled:text-[#98a2b3]"
                        >
                            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
