"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Request Integration modal
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Empty state                — 7603:113819
//   • Filled (Submit enabled)    — 7603:114467
//   • Success toast              — 7603:115419 (toast fires from the caller
//                                   on submit — see AppsTab.handleRequestSubmitted)
//
// Captures a tool the admin wants to request. The form is local-only:
// fields validate inline, Submit auto-enables once all required fields
// have content, and on submit the caller fires a success toast + closes
// the modal. No persistence — the brief explicitly scopes this to a UI
// flow (no API, no backend).

import { useEffect, useRef, useState } from "react";
import { XClose, ChevronDown, Lightbulb05, Check } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { INTEGRATION_CATEGORIES, type IntegrationCategory } from "./categories";

interface RequestIntegrationModalProps {
    onClose: () => void;
    /** Fires when the admin clicks "Submit request" with a valid form.
     *  The parent typically closes the modal + shows the success toast. */
    onSubmitted: () => void;
}

export function RequestIntegrationModal({ onClose, onSubmitted }: RequestIntegrationModalProps) {
    const [name, setName]       = useState("");
    const [website, setWebsite] = useState("");
    const [category, setCategory] = useState<IntegrationCategory | null>(null);
    const [useCase, setUseCase] = useState("");
    const [categoryOpen, setCategoryOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on Escape — matches every other modal in the app.
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    // Close category dropdown on outside click.
    useEffect(() => {
        function h(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setCategoryOpen(false);
            }
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const canSubmit =
        name.trim() !== "" &&
        website.trim() !== "" &&
        category !== null &&
        useCase.trim() !== "";

    function handleSubmit() {
        if (!canSubmit) return;
        onSubmitted();
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div
                className="relative bg-white rounded-[16px] w-[560px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="pt-6 px-6 pb-5 relative">
                    <div className="flex flex-col gap-1 pr-10">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Request integration</h3>
                        <p className="text-[14px] text-[#475467] leading-5">
                            Tell us which tool you&apos;d like to connect with.
                        </p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="absolute right-[12px] top-[12px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>

                {/* Body — form */}
                <div className="px-6 pb-5 flex flex-col gap-4">
                    {/* Integration name */}
                    <FormField label="Integration name">
                        <input
                            type="text" value={name} onChange={e => setName(e.target.value)}
                            placeholder="e.g. HubSpot, Zapier etc."
                            className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                        />
                    </FormField>

                    {/* Integration website — split input with http:// prefix */}
                    <FormField label="Integration website">
                        <div className="flex w-full h-10 border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden">
                            <span className="inline-flex items-center justify-center px-[14px] text-[14px] font-medium text-[#475467] bg-[#f9fafb] border-r border-[#d0d5dd] shrink-0">
                                http://
                            </span>
                            <input
                                type="text" value={website} onChange={e => setWebsite(e.target.value)}
                                placeholder="example.com"
                                className="flex-1 px-[14px] text-[14px] text-[#101828] placeholder:text-[#667085] bg-transparent focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:ring-inset transition-all"
                            />
                        </div>
                    </FormField>

                    {/* Category dropdown */}
                    <FormField label="Category">
                        <div ref={dropdownRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setCategoryOpen(p => !p)}
                                className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] flex items-center justify-between text-left hover:border-[#7ba08c] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                            >
                                <span className={cn(category ? "text-[#101828] font-medium" : "text-[#667085]")}>
                                    {category
                                        ? INTEGRATION_CATEGORIES.find(c => c.key === category)?.label
                                        : "Select category"}
                                </span>
                                <ChevronDown className="w-4 h-4 text-[#667085]" />
                            </button>
                            {categoryOpen && (
                                <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1">
                                    {INTEGRATION_CATEGORIES.map(cat => {
                                        const selected = category === cat.key;
                                        return (
                                            <button
                                                key={cat.key}
                                                type="button"
                                                onClick={() => { setCategory(cat.key); setCategoryOpen(false); }}
                                                className={cn(
                                                    "flex items-center justify-between w-full px-4 py-[10px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors",
                                                    selected ? "text-[#101828] font-semibold" : "text-[#344054]",
                                                )}
                                            >
                                                <span>{cat.label}</span>
                                                {selected && <Check className="w-4 h-4 text-[#658774]" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </FormField>

                    {/* Use case textarea */}
                    <FormField label="How would you use this integration?">
                        <textarea
                            value={useCase} onChange={e => setUseCase(e.target.value)}
                            placeholder="Describe your use case and how this integration would help your studio..."
                            rows={4}
                            className="w-full px-[14px] py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-y"
                        />
                    </FormField>

                    {/* "What happens next?" callout */}
                    <div className="bg-[#fefdf2] border-1 border-[#fef0c7] rounded-[10px] p-3 flex items-start gap-2">
                        <Lightbulb05 className="w-5 h-5 text-[#dc6803] shrink-0 mt-px" />
                        <div className="flex flex-col gap-0.5">
                            <p className="text-[14px] font-semibold text-[#344054] leading-5">What happens next?</p>
                            <p className="text-[14px] text-[#475467] leading-5">
                                Our team will review request and reach out within 2-3 business days. Popular requests are prioritized first.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer — Cancel + Submit request */}
                <div className="border-t border-[#e4e7ec] px-6 py-4 flex gap-3 items-center">
                    <Button variant="secondary-gray" size="md" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        className="flex-1"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                    >
                        Submit request
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Form field wrapper ─────────────────────────────────────────────────────

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
        </div>
    );
}
