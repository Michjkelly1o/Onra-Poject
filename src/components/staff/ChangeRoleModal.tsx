"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Change role modal (Figma 6247-223715)
// ─────────────────────────────────────────────────────────────────────────────
//
// Centered modal that swaps a staff member's role. Radio-card list — each
// active assignable role renders as a clickable card (avatar + name +
// description + radio dot). Selected card carries the sage accent.

import { useEffect, useMemo, useState } from "react";
import { XClose, Lightbulb02, User01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAppStore, type Role, type Staff } from "@/lib/store";

// ─── Radio card row ────────────────────────────────────────────────────────

function RoleRadioCard({ role, selected, onSelect }: {
    role: Role; selected: boolean; onSelect: () => void;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-[12px] border-1 text-left transition-colors",
                selected
                    ? "bg-[#f5fffa] border-[#7ba08c]"
                    : "bg-white border-[#e4e7ec] hover:bg-[#f9fafb]",
            )}
        >
            <div className="w-9 h-9 rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
                <User01 className="w-5 h-5 text-[#475467]" />
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px] truncate">{role.name}</p>
                <p className="text-[13px] text-[#667085] leading-[18px] line-clamp-1">
                    {role.description || "—"}
                </p>
            </div>
            <span
                aria-hidden
                className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                    selected ? "border-[#658774] bg-white" : "border-[#d0d5dd] bg-white",
                )}
            >
                {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#658774]" />}
            </span>
        </button>
    );
}

// ─── Modal ────────────────────────────────────────────────────────────────

export default function ChangeRoleModal({ staff, onCancel, onConfirmed }: {
    staff: Staff;
    onCancel: () => void;
    /** Called after the role has been written to the store. The parent fires
     *  the success toast — it has the new role name in hand for the copy. */
    onConfirmed: (newRoleName: string) => void;
}) {
    const roles       = useAppStore(s => s.roles);
    const updateStaff = useAppStore(s => s.updateStaff);

    const [roleId, setRoleId] = useState<string>(staff.roleId);

    // Assignable list = every active role + the staff's current role (even
    // if it's locked, inactive, or archived) so the admin always sees what
    // role they're starting from. Filtering on status alone would hide the
    // currently-assigned role for any staff whose seed points at a non-
    // Active role — which is exactly how the Change role card list ended
    // up empty for Operator/Front desk staff before this fix.
    const assignableRoles = useMemo(() => {
        const byId = new Map(roles.map(r => [r.id, r] as const));
        const out: Role[] = [];
        const current = byId.get(staff.roleId);
        if (current) out.push(current);
        for (const r of roles) {
            if (r.id === staff.roleId) continue;
            if (r.status !== "active") continue;
            if (r.locked) continue;
            out.push(r);
        }
        return out;
    }, [roles, staff.roleId]);

    // Esc-to-close.
    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === "Escape") onCancel(); }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const newRole = roles.find(r => r.id === roleId);
    const dirty = roleId !== staff.roleId;
    const canSave = dirty && !!newRole;

    function handleConfirm() {
        if (!canSave || !newRole) return;
        // Changing role also re-anchors the staff's branch scope to the
        // role's branch so the inheritance contract holds end-to-end.
        updateStaff(staff.id, { roleId: newRole.id, branchId: newRole.branchId });
        onConfirmed(newRole.name);
    }

    const firstName = staff.firstName.trim() || staff.fullName.split(" ")[0];

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] w-[640px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start gap-4 px-6 pt-6 pb-5">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                            Change role for &ldquo;{staff.fullName}&rdquo;
                        </h3>
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            Select a new role to update {firstName}&rsquo;s access and permissions.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mr-2 -mt-1"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Role cards */}
                <div
                    role="radiogroup"
                    aria-label="Select role"
                    className="px-6 flex-1 min-h-0 overflow-y-auto scrollbar-hide flex flex-col gap-2"
                >
                    {assignableRoles.map(r => (
                        <RoleRadioCard
                            key={r.id}
                            role={r}
                            selected={r.id === roleId}
                            onSelect={() => setRoleId(r.id)}
                        />
                    ))}
                </div>

                {/* Inheritance disclaimer */}
                <div className="px-6 pt-5">
                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            This staff will inherit all permissions from the selected role and locations.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pt-5 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>Cancel</Button>
                    <Button variant="primary" size="lg" className="flex-1" disabled={!canSave} onClick={handleConfirm}>
                        Update role
                    </Button>
                </div>
            </div>
        </div>
    );
}
