"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Select branch screen (`/customer/select-branch`) — PRD 13 §6.1
// ─────────────────────────────────────────────────────────────────────────────
//
// Reached ONLY from the Home header branch selector. Lists "All branches" + the
// active studio branches (reused from the admin `branches` store — read-only),
// each with today's operational status derived from the `business_hours` seed.
// Tapping a card stages it (brand-green highlight); Confirm persists the choice
// via the member context (localStorage) so it survives navigation + refresh, then
// returns Home — where the header label and all branch-scoped content re-scope.
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 3306-65579.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Lightbulb02 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { ALL_BRANCHES, useCurrentCustomerContext } from "@/lib/customer/context";
import { DEMO_TODAY_ISO } from "@/lib/customer/home-data";
import { business_hours } from "@/data/mock";
import { CustomerHeader, CUSTOMER_HEADER_CONTENT_OFFSET } from "@/components/customer/shell/CustomerHeader";
import { BranchOptionCard } from "@/components/customer/branch/BranchOptionCard";
import { Button } from "@/components/ui/button";

// Operational status reflects the demo's anchored "today" (2026-05-15, a Friday),
// matching the rest of the customer Home — deterministic, not the wall clock.
const TODAY_DOW = new Date(`${DEMO_TODAY_ISO}T00:00:00Z`).getUTCDay();

/** "07:00" → "07:00 AM", "22:00" → "10:00 PM". */
function to12h(time: string): string {
    const [hStr, mStr] = time.split(":");
    const h = Number(hStr);
    const period = h < 12 ? "AM" : "PM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, "0")}:${mStr} ${period}`;
}

/** Today's open/closed + hours for a branch, from the `business_hours` seed. */
function branchHoursToday(branchId: string): { isOpen: boolean; hoursLabel: string } {
    const row = business_hours.find((bh) => bh.branch_id === branchId && bh.day_of_week === TODAY_DOW);
    if (!row || row.is_closed) return { isOpen: false, hoursLabel: "Closed today" };
    return { isOpen: true, hoursLabel: `${to12h(row.open_time)} - ${to12h(row.close_time)}` };
}

export default function SelectBranchPage() {
    const router = useRouter();
    const { selectedBranchId, setSelectedBranch } = useCurrentCustomerContext();
    const branches = useAppStore((s) => s.branches);
    const showToast = useAppStore((s) => s.showToast);

    // Only active branches are bookable (PRD 13 §6.1) — inactive/archived are hidden.
    const activeBranches = branches.filter((b) => b.status === "active");

    // Staged selection — the highlight follows this; Confirm commits it.
    const [choice, setChoice] = useState(selectedBranchId);

    function confirm() {
        setSelectedBranch(choice);
        const label =
            choice === ALL_BRANCHES
                ? "All branches"
                : activeBranches.find((b) => b.id === choice)?.name ?? "branch";
        showToast("Branch updated", `${label} is now your active branch.`, "success");
        // Return to the screen the picker was opened from (Home, Search, …); the
        // selected branch is global (member context), so the filter applies everywhere.
        router.back();
    }

    return (
        <div className="flex min-h-full flex-col">
            {/* Shared customer header (same shell as Home) — back + centred title. */}
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">
                    Select branch
                </h1>
                {/* Spacer balances the back button so the title stays centred. */}
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            {/* Branch list — top padding clears the overlaid header. */}
            <div className={`flex flex-1 flex-col gap-4 px-4 ${CUSTOMER_HEADER_CONTENT_OFFSET}`}>
                <BranchOptionCard
                    name="All branches"
                    subtitle="Use your membership at any branch."
                    selected={choice === ALL_BRANCHES}
                    onClick={() => setChoice(ALL_BRANCHES)}
                />
                {activeBranches.map((b) => (
                    <BranchOptionCard
                        key={b.id}
                        name={b.name}
                        subtitle={[b.address, b.country].filter(Boolean).join(", ")}
                        selected={choice === b.id}
                        onClick={() => setChoice(b.id)}
                        operational={branchHoursToday(b.id)}
                    />
                ))}
            </div>

            {/* Sticky footer — hint + Confirm. */}
            <div className="sticky bottom-0 z-10 flex flex-col gap-4 bg-gradient-to-b from-white/0 via-white to-white px-5 pb-6 pt-4">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                    <Lightbulb02 className="size-5 shrink-0 text-[#475467]" aria-hidden />
                    <p className="text-sm font-normal leading-5 text-[#475467]">
                        This location will be set as your main branch.
                    </p>
                </div>
                <Button variant="primary" size="md" className="w-full rounded-full" onClick={confirm}>
                    Confirm
                </Button>
            </div>
        </div>
    );
}
