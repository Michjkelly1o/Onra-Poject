"use client";

// Customer — reusable filter chip/pill (the Categories filter style). Selected =
// brand border + mint fill + primary text; idle = neutral border + white.
// Shared by the Classes filter (Time-of-day + Categories) so every pill matches.

export function FilterPill({
    label,
    selected,
    onClick,
}: {
    label: string;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-lg border px-4 py-2 text-sm font-medium leading-5 transition-colors ${
                selected
                    ? "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-text)]"
                    : "border-[#e4e7ec] bg-white text-[#344054]"
            }`}
        >
            {label}
        </button>
    );
}
