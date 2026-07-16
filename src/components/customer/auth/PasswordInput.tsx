"use client";

import { useState } from "react";
import { Eye, EyeOff } from "@untitledui/icons";

export function PasswordInput({
    label,
    value,
    onChange,
    placeholder,
    error,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    error?: boolean;
}) {
    const [show, setShow] = useState(false);
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium leading-5 text-[#344054]">{label}</span>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={`w-full rounded-lg border bg-white px-3.5 py-2.5 pr-11 text-base leading-6 text-[var(--brand-text)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] outline-none transition-colors placeholder:text-[#667085] ${
                        error ? "border-[#fda29b] focus:border-[#f04438]" : "border-[#d0d5dd] focus:border-[var(--brand-primary)]"
                    }`}
                />
                <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#667085]"
                >
                    {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
                </button>
            </div>
        </label>
    );
}
