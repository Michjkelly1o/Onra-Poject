"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Privacy policy (`/customer/profile/privacy-policy`)
// ─────────────────────────────────────────────────────────────────────────────
//
// A level-2 profile page (back → About). Static, readable policy content styled
// with the shared header chrome — reached from About → "Privacy policy".

import { ChevronLeft } from "@untitledui/icons";
import { useCustomerBack } from "@/lib/customer/use-customer-back";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";

const STUDIO = "Onra Studio";
const LAST_UPDATED = "July 2026";

const SECTIONS: { heading: string; body: string }[] = [
    {
        heading: "Introduction",
        body: `This policy explains how ${STUDIO} collects, uses, and protects your information when you use the app to book classes and appointments, manage your membership, and make payments.`,
    },
    {
        heading: "Information we collect",
        body: "Your name, email, phone number, and profile details; your bookings, attendance, and class history; and payment records for purchases you make. We also collect basic device information to keep the app running smoothly.",
    },
    {
        heading: "How we use your information",
        body: "To confirm and manage your bookings, process payments, apply memberships and credits, send you booking and account notifications, and improve the app experience.",
    },
    {
        heading: "Sharing",
        body: `We share your information only with the studio branches you book with and the payment providers needed to complete a purchase. We never sell your personal data.`,
    },
    {
        heading: "Your choices",
        body: "You can update your profile at any time, manage your marketing preferences in Profile settings, and request that your account and data be deleted.",
    },
    {
        heading: "Contact",
        body: `Questions about your privacy? Reach out to the ${STUDIO} team through your studio branch or the support channel in the app.`,
    },
];

export default function PrivacyPolicyPage() {
    const goBack = useCustomerBack("/customer/profile/about");

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={goBack}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">Privacy policy</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col gap-6 px-4 pb-10 pt-[96px]">
                <p className="text-xs font-normal leading-[18px] text-[#98a2b3]">Last updated {LAST_UPDATED}</p>
                {SECTIONS.map((s) => (
                    <section key={s.heading} className="flex flex-col gap-2">
                        <h2 className="text-base font-semibold leading-6 text-[var(--brand-text)]">{s.heading}</h2>
                        <p className="text-sm font-normal leading-[22px] text-[#475467]">{s.body}</p>
                    </section>
                ))}
            </div>
        </div>
    );
}
