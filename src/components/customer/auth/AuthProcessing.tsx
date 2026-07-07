"use client";

// Customer — auth processing loader. Same 3-dot bouncing indicator as the
// booking/checkout processing screens, with a single centred brand-green line.
// Presentational only — the caller does the session write, then routes on.

export function AuthProcessing({ label }: { label: string }) {
    return (
        <div className="flex min-h-full flex-col items-center justify-center gap-8 px-4">
            <div className="flex items-center gap-1.5" aria-label="Processing">
                {[0, 1, 2].map((i) => (
                    <span
                        key={i}
                        className="size-2 animate-bounce rounded-full bg-[#658774]"
                        style={{ animationDelay: `${i * 0.15}s` }}
                    />
                ))}
            </div>
            <p className="text-xl font-semibold leading-[30px] text-[#4f6e5d]">{label}</p>
        </div>
    );
}
