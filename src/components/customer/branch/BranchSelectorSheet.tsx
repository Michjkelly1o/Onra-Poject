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

/** Selection card — Figma 4529:43954. Compact: name → "Open • hours" → address
 *  (one truncated line) on the left, the Forma logomark top-right; branches add
 *  a second row with the time-zone badge + a "Details" link into Google Maps. */
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
            className={`flex w-full shrink-0 flex-col gap-3 rounded-2xl bg-white p-4 transition-colors ${
                selected ? "border-2 border-[var(--brand-primary)]" : "border border-[#e4e7ec]"
            }`}
        >
            <button type="button" onClick={onSelect} aria-pressed={selected} className="flex w-full items-start gap-3 text-left">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-sm font-semibold leading-5 text-[var(--brand-text)]">{name}</span>
                    {operational && (
                        <span className="flex items-center gap-1 text-sm leading-5">
                            <span className="font-medium text-[#067647]">{operational.isOpen ? "Open" : "Closed"}</span>
                            <span className="text-[#667085]">•</span>
                            <span className="truncate text-[#667085]">{operational.hoursLabel}</span>
                        </span>
                    )}
                    <span className="truncate text-sm font-normal leading-5 text-[#667085]">{subtitle}</span>
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={LOGOMARK} alt="" className="h-8 w-[26.667px] shrink-0" />
            </button>

            {branch && (
                <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1 rounded-md border border-[#d0d5dd] bg-white py-0.5 pl-2 pr-1.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Globe04 className="size-3 shrink-0 text-[#667085]" aria-hidden />
                        <span className="text-xs font-medium leading-[18px] text-[#344054]">
                            {branchCity} ({compactOffsetForCity(branchCity)})
                        </span>
                    </span>
                    <button
                        type="button"
                        onClick={() => openBranchInMaps(address)}
                        className="flex shrink-0 items-center gap-0.5 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
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
        <CustomerSheet open={open} onClose={onClose} heightClass="h-[56dvh]">
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
            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-color:#d0d5dd_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#d0d5dd] [&::-webkit-scrollbar]:w-1.5">
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
            <div className="mt-3 flex shrink-0 items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-3">
                <Lightbulb02 className="size-5 shrink-0 text-[#475467]" aria-hidden />
                <p className="text-sm font-normal leading-5 text-[#475467]">Location will be set as your main branch.</p>
            </div>
        </CustomerSheet>
    );
}
