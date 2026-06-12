"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Default-all-selected branch filter hook
// ─────────────────────────────────────────────────────────────────────────────
//
// Every report's "Select location" dropdown should default to *all*
// non-archived branches checked. Two reasons:
//   1. The table renders rows from every branch on first paint — so the
//      dropdown showing "0" while the table shows 9 rows feels broken.
//   2. The interaction model matches what an admin expects: untick a
//      branch to drop it from the table, retick to bring it back.
//
// Filtering rule on the host page becomes a positive match:
//   `if (!branchFilter.has(r.branchId)) return false;`
// — emptying the set therefore yields an empty table, which is the
// natural "I've turned everything off" state.

import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function useDefaultBranchFilter() {
    const branches = useAppStore(s => s.branches);
    return useState<Set<string>>(
        () => new Set(branches.filter(b => b.status !== "archive").map(b => b.id)),
    );
}
