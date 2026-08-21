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
    /** Progress fill, 0–100. Omit to hide the progress bar entirely. */
    progress?: number;
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
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                ) : (
                    <div className="size-10 shrink-0" aria-hidden />
                )}
                <p className="min-w-0 flex-1 truncate text-center text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">
                    {title}
                </p>
                {onClose ? (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                ) : (
                    <div className="size-10 shrink-0" aria-hidden />
                )}
            </div>
            {progress !== undefined && (
                <div className="h-1 w-full bg-[var(--colors-bg-quaternary)]">
                    <div
                        className="h-full rounded-r-full bg-[var(--colors-secondary-400)] transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </header>
    );
}
