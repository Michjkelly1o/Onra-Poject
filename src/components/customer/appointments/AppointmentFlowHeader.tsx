"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — AppointmentFlowHeader — multi-step booking header + progress bar
// ─────────────────────────────────────────────────────────────────────────────
//
// Frosted sticky header for the appointment booking steps (Select staff → Select
// date & time → Review and book): back + centered title + close, with a brand
// progress bar underneath. Figma 4189-86847 / 4212-39347.

import { ChevronLeft, XClose } from "@untitledui/icons";
import { useMainScrolled } from "@/lib/customer/use-scrollable";

export interface AppointmentFlowHeaderProps {
    title: string;
    /** Progress fill, 0–100. */
    progress: number;
    /** Omit to hide the back button (e.g. the first step, which only needs close). */
    onBack?: () => void;
    /** Omit to hide the close button (e.g. a step that only needs back). */
    onClose?: () => void;
}

export function AppointmentFlowHeader({ title, progress, onBack, onClose }: AppointmentFlowHeaderProps) {
    const scrolled = useMainScrolled();
    return (
        <header
            className={`sticky top-0 z-20 flex w-full flex-col transition-colors ${
                scrolled ? "bg-white/80 backdrop-blur-md" : ""
            }`}
        >
            <div className="flex w-full items-center gap-3 px-4 py-3">
                {onBack ? (
                    <button
                        type="button"
                        onClick={onBack}
                        aria-label="Back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                ) : (
                    <div className="size-10 shrink-0" aria-hidden />
                )}
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)]">
                    {title}
                </p>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                ) : (
                    <div className="size-10 shrink-0" aria-hidden />
                )}
            </div>
            <div className="h-1 w-full bg-[#e4e7ec]">
                <div
                    className="h-full rounded-r-full bg-[var(--brand-primary)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                />
            </div>
        </header>
    );
}
