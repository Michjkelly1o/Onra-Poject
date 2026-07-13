"use client";

// Customer — 4-box OTP input (Figma 3228-22800). Each box shows one digit;
// typing auto-advances, Backspace on an empty box steps back, and paste fills
// all four. The focused box shows the brand-green border. Controlled by the
// parent (`value` = the 4-char string so far).

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

const LEN = 4;

export function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const refs = useRef<Array<HTMLInputElement | null>>([]);
    const digits = value.split("").slice(0, LEN);

    function setAt(i: number, d: string) {
        const next = value.split("");
        next[i] = d;
        // Trim trailing gaps so `value.length` stays a clean prefix count.
        const joined = next.join("").slice(0, LEN);
        onChange(joined.replace(/\s/g, ""));
    }

    function handleChange(i: number, raw: string) {
        const d = raw.replace(/\D/g, "").slice(-1);
        if (!d) return;
        setAt(i, d);
        if (i < LEN - 1) refs.current[i + 1]?.focus();
    }

    function handleKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Backspace") {
            e.preventDefault();
            if (digits[i]) {
                setAt(i, "");
            } else if (i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, "");
            }
        } else if (e.key === "ArrowLeft" && i > 0) {
            refs.current[i - 1]?.focus();
        } else if (e.key === "ArrowRight" && i < LEN - 1) {
            refs.current[i + 1]?.focus();
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LEN);
        if (!pasted) return;
        onChange(pasted);
        refs.current[Math.min(pasted.length, LEN - 1)]?.focus();
    }

    return (
        <div className="flex w-full items-start gap-3">
            {Array.from({ length: LEN }).map((_, i) => {
                const filled = !!digits[i];
                return (
                    <input
                        key={i}
                        ref={(el) => {
                            refs.current[i] = el;
                        }}
                        value={digits[i] ?? ""}
                        onChange={(e) => handleChange(i, e.target.value)}
                        onKeyDown={(e) => handleKey(i, e)}
                        onPaste={handlePaste}
                        inputMode="numeric"
                        autoComplete={i === 0 ? "one-time-code" : "off"}
                        maxLength={1}
                        aria-label={`Digit ${i + 1}`}
                        className={`h-20 min-w-0 flex-1 rounded-xl border-2 bg-white text-center text-5xl font-medium leading-[60px] tracking-[-0.96px] text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none transition-colors ${
                            filled ? "border-[var(--brand-primary)]" : "border-[#d0d5dd] focus:border-[var(--brand-primary)]"
                        }`}
                    />
                );
            })}
        </div>
    );
}
