"use client";

// Customer — iOS-style toggle switch (brand green when on). No DS switch exists.

export function Switch({
    checked,
    onChange,
    "aria-label": ariaLabel,
}: {
    checked: boolean;
    onChange: (next: boolean) => void;
    "aria-label"?: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                checked ? "bg-[var(--brand-primary)]" : "bg-[#e4e7ec]"
            }`}
        >
            <span
                className={`inline-block size-5 rounded-full bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.1)] transition-transform ${
                    checked ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
            />
        </button>
    );
}
