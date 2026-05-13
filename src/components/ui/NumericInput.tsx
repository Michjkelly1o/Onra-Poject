"use client";

import { forwardRef, type ChangeEvent, type ReactNode } from "react";
import { ChevronSelectorVertical } from "@untitledui/icons";
import { cn } from "@/lib/utils";

interface SharedProps {
    className?: string;
    inputClassName?: string;
    suffix?: ReactNode;
    disabled?: boolean;
    max?: number;
    min?: number;
    step?: number;
    required?: boolean;
    "aria-label"?: string;
}

function StepperHandle({ onUp, onDown, disabled, canUp = true, canDown = true }: {
    onUp: () => void; onDown: () => void;
    disabled?: boolean; canUp?: boolean; canDown?: boolean;
}) {
    return (
        <div className="relative w-4 h-4 shrink-0 select-none">
            <ChevronSelectorVertical className={cn("absolute inset-0 w-4 h-4 pointer-events-none", disabled ? "text-[#d0d5dd]" : "text-[#667085]")} />
            <button type="button" tabIndex={-1} aria-label="Increase" disabled={disabled || !canUp}
                onMouseDown={e => e.preventDefault()} onClick={onUp}
                className="absolute inset-x-0 top-0 h-1/2 cursor-pointer disabled:cursor-not-allowed" />
            <button type="button" tabIndex={-1} aria-label="Decrease" disabled={disabled || !canDown}
                onMouseDown={e => e.preventDefault()} onClick={onDown}
                className="absolute inset-x-0 bottom-0 h-1/2 cursor-pointer disabled:cursor-not-allowed" />
        </div>
    );
}

const DEFAULT_INPUT = "h-10 w-full px-[14px] border border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

/** Numeric input bound to a number-typed state. Placeholder "0", strips leading zeros, native stepper hidden + Untitled UI chevron-selector handle on the right. */
export const NumericInput = forwardRef<HTMLInputElement, SharedProps & {
    value: number;
    onChange: (n: number) => void;
}>(function NumericInput(
    { value, onChange, className, inputClassName, suffix, disabled, max, min, step, required, ...rest },
    ref
) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/^0+(?=\d)/, "");
        if (raw === "") { onChange(0); return; }
        const num = Number(raw);
        if (Number.isNaN(num)) return;
        if (max !== undefined && num > max) return;
        onChange(num);
    };
    const stepBy = (delta: number) => {
        const next = (value || 0) + delta;
        if (min !== undefined && next < min) return;
        if (max !== undefined && next > max) return;
        onChange(next);
    };
    return (
        <div className={cn("flex items-stretch border border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all", disabled && "bg-[#f9fafb]", className)}>
            <div className="flex flex-1 items-center gap-2 pl-[14px] pr-[10px]">
                <input
                    ref={ref}
                    type="number"
                    value={value === 0 ? "" : String(value)}
                    placeholder="0"
                    onChange={handleChange}
                    disabled={disabled}
                    required={required}
                    step={step}
                    aria-label={rest["aria-label"]}
                    className={cn(
                        "flex-1 min-w-0 h-10 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        disabled && "text-[#667085] cursor-not-allowed",
                        inputClassName
                    )}
                />
                <StepperHandle
                    onUp={() => stepBy(1)} onDown={() => stepBy(-1)}
                    disabled={disabled}
                    canUp={max === undefined || value < max}
                    canDown={min === undefined ? value > 0 : value > min}
                />
            </div>
            {suffix !== undefined && (
                <div className="flex items-center px-[14px] border-l border-[#d0d5dd] text-[16px] text-[#344054] shrink-0">
                    {suffix}
                </div>
            )}
        </div>
    );
});

/** String-state variant for form objects that hold every field as a string until submit. Same visual contract as NumericInput. */
export const NumericStringInput = forwardRef<HTMLInputElement, SharedProps & {
    value: string;
    onChange: (s: string) => void;
}>(function NumericStringInput(
    { value, onChange, className, inputClassName, suffix, disabled, max, min, step, required, ...rest },
    ref
) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/^0+(?=\d)/, "");
        onChange(raw);
    };
    const stepBy = (delta: number) => {
        const current = value === "" ? 0 : Number(value);
        if (Number.isNaN(current)) return;
        const next = current + delta;
        if (min !== undefined && next < min) return;
        if (max !== undefined && next > max) return;
        onChange(next === 0 ? "" : String(next));
    };
    return (
        <div className={cn("flex items-stretch border border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden focus-within:ring-2 focus-within:ring-[#aad4bd] focus-within:border-[#7ba08c] transition-all", disabled && "bg-[#f9fafb]", className)}>
            <div className="flex flex-1 items-center gap-2 pl-[14px] pr-[10px]">
                <input
                    ref={ref}
                    type="number"
                    value={value === "0" ? "" : value}
                    placeholder="0"
                    onChange={handleChange}
                    disabled={disabled}
                    required={required}
                    step={step}
                    aria-label={rest["aria-label"]}
                    className={cn(
                        "flex-1 min-w-0 h-10 text-[16px] text-[#101828] placeholder:text-[#667085] bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                        disabled && "text-[#667085] cursor-not-allowed",
                        inputClassName
                    )}
                />
                <StepperHandle
                    onUp={() => stepBy(1)} onDown={() => stepBy(-1)}
                    disabled={disabled}
                />
            </div>
            {suffix !== undefined && (
                <div className="flex items-center px-[14px] border-l border-[#d0d5dd] text-[16px] text-[#344054] shrink-0">
                    {suffix}
                </div>
            )}
        </div>
    );
});

export { DEFAULT_INPUT as NUMERIC_INPUT_BASE_CLASS };
