// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Animated three-dot typing indicator
// ─────────────────────────────────────────────────────────────────────────────
//
// Rendered inside an assistant message bubble while the model is streaming, and
// inside tool-invocation placeholders while a tool call is in-flight. Three
// staggered mint dots that bounce; keyframes are inline so the component is
// self-contained and no globals.css touch is required.

"use client";

export function TypingDots({ label = "Thinking" }: { label?: string }) {
    return (
        <div
            role="status"
            aria-label={label}
            className="inline-flex items-center gap-1 py-2"
        >
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="inline-block size-1.5 rounded-full bg-[#7ba08c]"
                    style={{
                        animation: "onra-typing-dot 1.2s ease-in-out infinite",
                        animationDelay: `${i * 0.15}s`,
                    }}
                />
            ))}
            <style>{`
                @keyframes onra-typing-dot {
                    0%, 60%, 100% { opacity: 0.35; transform: translateY(0); }
                    30%           { opacity: 1;    transform: translateY(-3px); }
                }
            `}</style>
        </div>
    );
}
