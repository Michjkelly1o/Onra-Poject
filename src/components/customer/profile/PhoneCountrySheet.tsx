"use client";

// Customer — phone country-code picker. A field-height trigger that opens the
// shared CustomerSheet with a search field + country calling-code list.

import { useMemo, useState } from "react";
import { ChevronDown, SearchLg } from "@untitledui/icons";
import { PHONE_COUNTRIES, type PhoneCountry } from "@/components/customers/CustomerFormPage";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";

export function PhoneCountrySheet({ value, onChange }: { value: PhoneCountry; onChange: (c: PhoneCountry) => void }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const rows = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return PHONE_COUNTRIES;
        return PHONE_COUNTRIES.filter(
            (c) => c.name.toLowerCase().includes(s) || c.dial.includes(s) || c.code.toLowerCase().includes(s),
        );
    }, [q]);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="flex h-[46px] shrink-0 items-center gap-1.5 rounded-lg border border-[#d0d5dd] bg-white px-3"
            >
                <span className="text-base leading-none">{value.flag}</span>
                <span className="text-base leading-6 text-[var(--brand-text)]">{value.dial}</span>
                <ChevronDown className="size-4 text-[#667085]" aria-hidden />
            </button>

            <CustomerSheet
                open={open}
                onClose={() => {
                    setOpen(false);
                    setQ("");
                }}
            >
                <SheetToolbar
                    title="Country code"
                    onClose={() => {
                        setOpen(false);
                        setQ("");
                    }}
                />
                <div className="mb-1 flex items-center gap-2 rounded-lg border border-[#d0d5dd] bg-white px-3.5 py-2.5">
                    <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search country"
                        className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                    />
                </div>
                <div className="flex max-h-[50vh] flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {rows.map((c) => (
                        <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                                onChange(c);
                                setOpen(false);
                                setQ("");
                            }}
                            className="flex items-center gap-3 py-3.5 text-left"
                        >
                            <span className="text-lg leading-none">{c.flag}</span>
                            <span className="min-w-0 flex-1 truncate text-base leading-6 text-[var(--brand-text)]">{c.name}</span>
                            <span className="shrink-0 text-sm leading-5 text-[#475467]">{c.dial}</span>
                            <RadioDot checked={c.code === value.code} />
                        </button>
                    ))}
                </div>
            </CustomerSheet>
        </>
    );
}
