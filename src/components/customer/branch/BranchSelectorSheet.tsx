"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Branch selector (bottom sheet) — Figma / Home V1
// ─────────────────────────────────────────────────────────────────────────────
//
// Branch picker as bordered cards: the Forma logomark, name + address + "Open •
// hours", a branch time-zone pill, and a "Details" link that opens the branch in
// Google Maps. Selecting a branch applies it (member context → localStorage) AND
// re-defaults the display timezone — the customer's local zone when they're out
// of the branch's zone, otherwise the branch's zone.

import { useState } from "react";
import { ChevronRight, Globe04, Lightbulb02, SearchLg } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import { branchTimezone } from "@/lib/branch-time";
import { cityForZone, compactOffsetForCity } from "@/lib/customer/timezones";
import { branchHoursToday, openBranchInMaps } from "@/lib/customer/branch-location";
import type { Branch } from "@/data/mock/_types";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";

const LOGOMARK = "/customer/auth/forma-logomark.svg";

/** Selection card — "All branches" (simple) or a branch (logo · name · address ·
 *  Open • hours · timezone pill · Details). */
function BranchCard({
    name,
    subtitle,
    branch,
    operational,
    selected,
    onSelect,
}: {
    name: string;
    subtitle: string;
    branch?: Branch;
    operational?: { isOpen: boolean; hoursLabel: string };
    selected: boolean;
    onSelect: () => void;
}) {
    const branchCity = branch ? cityForZone(branchTimezone(branch)) ?? "Branch" : "";
    const address = branch ? [branch.address, branch.city, branch.country].filter(Boolean).join(", ") : "";
    return (
        <div
            className={`flex w-full flex-col gap-3 rounded-2xl p-4 transition-colors ${
                selected ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec]"
            }`}
        >
            <button type="button" onClick={onSelect} className="flex w-full flex-col gap-2 text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGOMARK} alt="" className="h-7 w-[23px]" />
                <div className="flex flex-col gap-0.5">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{name}</p>
                    <p className="truncate text-sm font-normal leading-5 text-[#667085]">{subtitle}</p>
                    {operational && (
                        <p className="flex items-center gap-1 text-sm leading-5">
                            <span className="font-medium text-[var(--brand-primary)]">{operational.isOpen ? "Open" : "Closed"}</span>
                            <span className="text-[#667085]">•</span>
                            <span className="text-[#667085]">{operational.hoursLabel}</span>
                        </p>
                    )}
                </div>
            </button>

            {branch && (
                <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 rounded-md border border-[#e4e7ec] bg-white px-2 py-0.5">
                        <Globe04 className="size-3 shrink-0 text-[#667085]" aria-hidden />
                        <span className="text-xs font-medium leading-[18px] text-[#344054]">
                            {branchCity} ({compactOffsetForCity(branchCity)})
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => openBranchInMaps(address)}
                        className="flex shrink-0 items-center gap-1 text-sm font-semibold leading-5 text-[var(--brand-text)]"
                    >
                        Details
                        <ChevronRight className="size-4" aria-hidden />
                    </button>
                </div>
            )}
        </div>
    );
}

export function BranchSelectorSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
    const { selectedBranchId, setSelectedBranch } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const showToast = useAppStore((s) => s.showToast);
    const [q, setQ] = useState("");

    const activeBranches = branches.filter((b) => b.status === "active");
    const query = q.trim().toLowerCase();
    const matches = (text: string) => text.toLowerCase().includes(query);
    const filtered = query
        ? activeBranches.filter((b) => matches(b.name) || matches([b.address, b.country].filter(Boolean).join(", ")))
        : activeBranches;
    const showAll = !query || matches("all branches");

    function pick(id: string) {
        setSelectedBranch(id);
        // The display timezone always follows the device (member context) — the
        // active branch never overrides it, so "Your time" keeps showing when the
        // member is outside the branch's zone.
        const label = id === ALL_BRANCHES ? "All branches" : activeBranches.find((b) => b.id === id)?.name ?? "branch";
        showToast("Branch updated", `${label} is now your active branch.`, "success");
        setQ("");
        onClose();
    }

    return (
        <CustomerSheet open={open} onClose={onClose} tall>
            {/* Search */}
            <div className="flex shrink-0 items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search branch..."
                    className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                />
            </div>

            {/* Options */}
            <div className="mt-5 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {showAll && (
                    <BranchCard
                        name="All branches"
                        subtitle="Use your membership at any branch."
                        selected={selectedBranchId === ALL_BRANCHES}
                        onSelect={() => pick(ALL_BRANCHES)}
                    />
                )}
                {filtered.map((b) => (
                    <BranchCard
                        key={b.id}
                        name={b.name}
                        subtitle={[b.address, b.country].filter(Boolean).join(", ")}
                        branch={b}
                        selected={selectedBranchId === b.id}
                        onSelect={() => pick(b.id)}
                        operational={branchHoursToday(b.id)}
                    />
                ))}
            </div>

            {/* Hint */}
            <div className="mt-3 flex shrink-0 items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                <Lightbulb02 className="size-5 shrink-0 text-[#475467]" aria-hidden />
                <p className="text-sm font-normal leading-5 text-[#475467]">Location will be set as your main branch.</p>
            </div>
        </CustomerSheet>
    );
}
