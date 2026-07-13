"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Branch selector (bottom sheet) — Figma 4416-153624
// ─────────────────────────────────────────────────────────────────────────────
//
// Bottom-sheet branch picker (the full-page `/customer/select-branch` screen +
// its <BranchOptionCard> are kept as a backup). Reuses the shared <CustomerSheet>.
// Rows (NOT bordered cards): a featured building icon that turns green when
// selected, the branch name + address + "Open • hours", and a radio on the right.
// A search field filters; tapping a row applies it immediately (member context →
// localStorage) and closes.

import { useState } from "react";
import { Building01, Lightbulb02, SearchLg } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import { DEMO_TODAY_ISO } from "@/lib/customer/home-data";
import { business_hours } from "@/data/mock";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { branchTzLabel } from "@/lib/branch-time";

const TODAY_DOW = new Date(`${DEMO_TODAY_ISO}T00:00:00Z`).getUTCDay();

function to12h(time: string): string {
    const [hStr, mStr] = time.split(":");
    const h = Number(hStr);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${mStr} ${period}`;
}
function branchHoursToday(branchId: string): { isOpen: boolean; hoursLabel: string } {
    const row = business_hours.find((bh) => bh.branch_id === branchId && bh.day_of_week === TODAY_DOW);
    if (!row || row.is_closed) return { isOpen: false, hoursLabel: "Closed today" };
    return { isOpen: true, hoursLabel: `${to12h(row.open_time)} - ${to12h(row.close_time)}` };
}

/** One selectable branch row (Figma 4416-153624 "Checkbox group item"). */
function BranchRow({
    name,
    subtitle,
    tzLabel,
    operational,
    selected,
    onClick,
}: {
    name: string;
    subtitle: string;
    /** Optional branch timezone label — rendered on its own line under the
     *  address so a member picking between multi-city branches never has to
     *  guess which zone a class time is in. */
    tzLabel?: string;
    operational?: { isOpen: boolean; hoursLabel: string };
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} aria-pressed={selected} className="flex w-full items-center gap-3 py-4 text-left">
            {/* Featured building icon — green tile when selected. */}
            <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-md ${
                    selected
                        ? "bg-gradient-to-br from-[var(--brand-tertiary)] to-[var(--brand-tertiary)]"
                        : "border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                }`}
            >
                <Building01 className="size-4 text-[#344054]" aria-hidden />
            </span>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-sm font-medium leading-5 text-[#344054]">{name}</p>
                <p className={`text-sm font-normal leading-5 text-[#667085] ${operational ? "truncate" : ""}`}>{subtitle}</p>
                {tzLabel && (
                    <p className="text-xs font-normal leading-4 text-[#98a2b3]">{tzLabel}</p>
                )}
                {operational && (
                    <p className="flex items-center gap-1 text-sm leading-5">
                        <span className="font-medium text-[var(--brand-primary)]">{operational.isOpen ? "Open" : "Closed"}</span>
                        <span className="text-[#667085]">•</span>
                        <span className="text-[#667085]">{operational.hoursLabel}</span>
                    </p>
                )}
            </div>

            {/* Radio */}
            <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-[var(--brand-primary)]" : "border border-[#d0d5dd] bg-white"
                }`}
            >
                {selected && <span className="size-1.5 rounded-full bg-white" />}
            </span>
        </button>
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
        const label = id === ALL_BRANCHES ? "All branches" : activeBranches.find((b) => b.id === id)?.name ?? "branch";
        showToast("Branch updated", `${label} is now your active branch.`, "success");
        setQ("");
        onClose();
    }

    return (
        <CustomerSheet open={open} onClose={onClose}>
            {/* Search */}
            <div className="flex items-center gap-2 rounded-full border border-[#d0d5dd] bg-white px-3.5 py-2.5 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <SearchLg className="size-5 shrink-0 text-[#667085]" aria-hidden />
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search branch..."
                    className="min-w-0 flex-1 bg-transparent text-base leading-6 text-[var(--brand-text)] outline-none placeholder:text-[#667085]"
                />
            </div>

            {/* Options */}
            <div className="mt-2 flex max-h-[52vh] flex-col overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {showAll && (
                    <BranchRow
                        name="All branches"
                        subtitle="Use your membership at any branch."
                        selected={selectedBranchId === ALL_BRANCHES}
                        onClick={() => pick(ALL_BRANCHES)}
                    />
                )}
                {filtered.map((b) => (
                    <BranchRow
                        key={b.id}
                        name={b.name}
                        subtitle={[b.address, b.country].filter(Boolean).join(", ")}
                        // Branch TZ on its own line under the address so a
                        // member picking between branches in different cities
                        // sees the zone clearly, not squeezed inline (client
                        // Jul 2026).
                        tzLabel={branchTzLabel(b)}
                        selected={selectedBranchId === b.id}
                        onClick={() => pick(b.id)}
                        operational={branchHoursToday(b.id)}
                    />
                ))}
            </div>

            {/* Hint */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                <Lightbulb02 className="size-5 shrink-0 text-[#475467]" aria-hidden />
                <p className="text-sm font-normal leading-5 text-[#475467]">Location will be set as your main branch.</p>
            </div>
        </CustomerSheet>
    );
}
