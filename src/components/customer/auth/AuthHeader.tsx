"use client";

// Customer — auth screens header (Forma logomark + wordmark, top-left).
// Figma 3228-22636/22812/22512: a frosted top bar pinned over the auth flow.
// Reused by Log in / Sign up, OTP, Create account, and the sign-up Emergency step.
// An optional close (X, top-right) turns the entry screen into a dismissible
// full-page modal — tapping it returns to wherever the user came from.

import { XClose } from "@untitledui/icons";

export function AuthHeader({ onClose }: { onClose?: () => void }) {
    return (
        <header className="absolute inset-x-0 top-0 z-20 flex h-16 items-center justify-between px-4 backdrop-blur-[12px]">
            <div className="flex items-center gap-0.5">
                <span className="relative flex size-8 items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/customer/auth/forma-logomark.svg"
                        alt=""
                        className="h-8 w-[26.67px]"
                        aria-hidden
                    />
                </span>
                <span className="text-lg font-semibold leading-7 text-[#101828]">Forma</span>
            </div>

            {onClose && (
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <XClose className="size-5 text-[#344054]" aria-hidden />
                </button>
            )}
        </header>
    );
}
