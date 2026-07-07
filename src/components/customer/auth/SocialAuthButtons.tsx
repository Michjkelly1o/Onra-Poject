"use client";

// Customer — social sign-in buttons (Figma 3228-22630). Google / Facebook /
// Apple, each a full-width pill with the brand glyph. SIMULATED for the
// prototype: `onProvider` decides what a tap does (log in as the demo member,
// or toast "coming soon"). No real OAuth.

const PROVIDERS = [
    { id: "google", label: "Continue with Google", icon: "/customer/auth/google.svg" },
    { id: "facebook", label: "Continue with Facebook", icon: "/customer/auth/facebook.svg" },
    { id: "apple", label: "Continue with Apple", icon: "/customer/auth/apple.svg" },
] as const;

export type SocialProvider = (typeof PROVIDERS)[number]["id"];

export function SocialAuthButtons({ onProvider }: { onProvider: (p: SocialProvider) => void }) {
    return (
        <div className="flex w-full flex-col gap-4">
            {PROVIDERS.map((p) => (
                <button
                    key={p.id}
                    type="button"
                    onClick={() => onProvider(p.id)}
                    className="relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-full border border-[#d0d5dd] bg-white px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors active:bg-gray-50"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.icon} alt="" className="size-6" aria-hidden />
                    <span className="text-base font-semibold leading-6 text-[#344054]">{p.label}</span>
                    <span className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]" />
                </button>
            ))}
        </div>
    );
}
