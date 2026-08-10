import { cn } from "@/lib/utils";
import type { RoleType } from "@/lib/store";

// ─── Role-type badge palette (per Figma staff tab) ─────────────────────────
// Shared so the Staff, Payroll list and Payroll detail modules all render the
// SAME colored role pill (client 2026-07-28).
export const ROLE_TYPE_BADGE: Record<RoleType, string> = {
    owner:        "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    branch_admin: "bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]",
    operator:     "bg-[#eff4ff] border-1 border-[#c7d7fe] text-[#3538cd]",
    front_desk:   "bg-[#f4f3ff] border-1 border-[#d9d6fe] text-[#5925dc]",
    instructor:   "bg-[#fff4ed] border-1 border-[#f9dbaf] text-[#b93815]",
    attendees:    "bg-[#ecfeff] border-1 border-[#a5f0fc] text-[#0e7090]",
};

/** Colored role pill — the role NAME tinted by its type. */
export function RoleBadge({ label, type, className }: { label: string; type: RoleType; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                ROLE_TYPE_BADGE[type],
                className,
            )}
        >
            {label}
        </span>
    );
}
