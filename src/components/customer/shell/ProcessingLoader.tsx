"use client";

// Customer — shared processing loader. ONE 3-dot bouncing indicator + a single
// brand-green line, used consistently across every transient loading screen
// (auth "Taking you to homepage", add-payment-method scan, etc.) so they all
// look identical. `fill` gives it a white full-screen backdrop when it replaces
// another surface (e.g. the card scanner).

export function ProcessingLoader({ label, fill = false }: { label: string; fill?: boolean }) {
    return (
        <div
            className={`flex min-h-full flex-col items-center justify-center gap-8 px-4 ${fill ? "bg-white" : ""}`}
        >
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[var(--brand-primary)]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
            <p className="text-xl font-semibold leading-[30px] text-[var(--brand-primary)]">{label}</p>
        </div>
    );
}
