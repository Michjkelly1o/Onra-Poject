"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Role form (Add new role / Edit role details / Edit permissions)
// ─────────────────────────────────────────────────────────────────────────────
//
// Used by 3 routes (root-level full-page, no admin layout):
//   • /staff/roles/new                     → mode = "create"        (step 1 → 2)
//   • /staff/roles/[id]/edit               → mode = "edit_details"  (step 1 only)
//   • /staff/roles/[id]/permissions/edit   → mode = "edit_permissions" (step 2 only)
//
// Figma:
//   • 6223-379708 — step 1 (role details)
//   • 6224-323441 — step 2 (define role type + grant limits + permissions)
//   • 6223-388450 — grant limits "Unlimited" view
//
// Layout matches PayRateFormPage chrome: header + left progress steps (when
// applicable) + center content card + right preview card + footer.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, User01, MarkerPin01, Lightbulb02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { Toast } from "@/components/ui/Toast";
import {
    useAppStore, DEFAULT_BRANCH_ID,
    DEFAULT_PERMISSIONS_BY_TYPE, DEFAULT_GRANT_LIMITS,
    permissionSectionsFor, type PermissionSectionSpec,
    type Role, type RoleType, type GrantLimits, type PermissionsMap, type PermissionCell, type Branch,
} from "@/lib/store";

// ─── Mode + form shape ─────────────────────────────────────────────────────

export type RoleFormMode = "create" | "edit_details" | "edit_permissions";

interface FormValue {
    name: string;
    description: string;
    branchId: string | null;
    type: RoleType;
    grantLimits: GrantLimits;
    permissions: PermissionsMap;
}

function emptyForm(): FormValue {
    // New roles default to Branch admin (most common admin role type — Owner
    // is locked and only auto-created at signup).
    return {
        name: "",
        description: "",
        branchId: DEFAULT_BRANCH_ID,
        type: "branch_admin",
        grantLimits: { ...DEFAULT_GRANT_LIMITS },
        permissions: DEFAULT_PERMISSIONS_BY_TYPE.branch_admin,
    };
}

function formFromRole(r: Role): FormValue {
    return {
        name: r.name,
        description: r.description,
        branchId: r.branchId,
        type: r.type,
        grantLimits: { ...r.grantLimits },
        permissions: r.permissions,
    };
}

// ─── Progress stepper ──────────────────────────────────────────────────────

function StepRow({ index, label, active, done, isLast }: {
    index: 1 | 2; label: string; active: boolean; done: boolean; isLast: boolean;
}) {
    return (
        <div className={cn(
            "flex items-center gap-4 h-[52px] p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#7ba08c]"
                        : done
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-[1.5px] border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {done && !active ? <Check className="w-3.5 h-3.5" /> : index}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            <p className={cn(
                "flex-1 text-[14px] leading-[20px]",
                active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]",
            )}>
                {label}
            </p>
        </div>
    );
}

// ─── Form atoms ────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
    return <p className="text-[14px] font-medium text-[#344054] leading-[20px]">{children}</p>;
}

function TextInput({ value, onChange, placeholder, disabled }: {
    value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
    return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            disabled={disabled}
            className={cn(
                "h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                disabled && "opacity-60 cursor-not-allowed bg-[#f9fafb]",
            )}
        />
    );
}

function TextArea({ value, onChange, placeholder, disabled }: {
    value: string; onChange: (v: string) => void; placeholder?: string; disabled?: boolean;
}) {
    return (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            rows={3}
            disabled={disabled}
            className={cn(
                "w-full px-[14px] py-[10px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] resize-none",
                disabled && "opacity-60 cursor-not-allowed bg-[#f9fafb]",
            )}
        />
    );
}

function NumberInput({ value, onChange, placeholder = "0", disabled }: {
    value: number | ""; onChange: (v: number | "") => void; placeholder?: string; disabled?: boolean;
}) {
    const display = value === "" || value === 0 ? "" : String(value);
    return (
        <input type="text" inputMode="numeric" value={display}
            disabled={disabled}
            onChange={e => {
                const raw = e.target.value.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
                onChange(raw === "" ? "" : Number(raw));
            }}
            placeholder={placeholder}
            className={cn(
                "h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                disabled && "opacity-50 cursor-not-allowed bg-[#f9fafb]",
            )}
        />
    );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={value}
            onClick={() => onChange(!value)}
            className={cn(
                "w-9 h-5 rounded-full p-[2px] flex items-center transition-colors shrink-0",
                value ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
            )}>
            <span className="block w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

function Checkbox({ checked, onChange, disabled, ariaLabel }: {
    checked: boolean; onChange?: (next: boolean) => void; disabled?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={checked}
            disabled={disabled}
            onClick={() => !disabled && onChange?.(!checked)}
            className={cn(
                "w-5 h-5 rounded-[6px] border flex items-center justify-center transition-colors shrink-0",
                checked
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
                disabled && "opacity-50 cursor-not-allowed hover:border-[#d0d5dd]",
            )}>
            {checked && <Check className="w-3.5 h-3.5" />}
        </button>
    );
}

function SectionHeader({ title }: { title: string }) {
    return <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</p>;
}

// ─── Right-rail preview ────────────────────────────────────────────────────

function RolePreview({ form, branches }: { form: FormValue; branches: Branch[] }) {
    // Mirrors Figma 6223-387561 — avatar top-left, left-aligned text. The
    // bg-#f6f6f3 outer band frames a white inner card (no max-height — the
    // card grows with description length).
    const branch = form.branchId ? branches.find(b => b.id === form.branchId) : null;
    const branchLabel = form.branchId === null ? "All locations" : branch?.name ?? "Branch location";
    return (
        <div className="w-[400px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shrink-0">
            <div className="p-6 flex flex-col gap-1">
                <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Role preview</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">This is how role overview will look like.</p>
            </div>
            <div className="bg-[#f6f6f3] flex flex-col gap-5 p-6 w-full">
                <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4">
                    {/* Avatar top-left — same chrome as the staff preview. */}
                    <div className="w-[80px] h-[80px] rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
                        <User01 className="w-9 h-9 text-[#475467]" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                            {form.name.trim() || "Role name"}
                        </p>
                        <p className="text-[14px] text-[#667085] leading-[20px] line-clamp-3">
                            {form.description.trim() || "Role description"}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 text-[14px] text-[#667085]">
                        <MarkerPin01 className="w-4 h-4 text-[#667085] shrink-0" />
                        <span>{branchLabel}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Step 1 — Role details ─────────────────────────────────────────────────

function Step1Details({ form, set, branches, locked }: {
    form: FormValue;
    set: (patch: Partial<FormValue>) => void;
    branches: Branch[];
    locked: boolean;
}) {
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({
            value: b.id, label: b.name,
            icon: <MarkerPin01 className="w-4 h-4 text-[#667085]" />,
        })),
        [branches],
    );
    return (
        <div className="flex flex-col gap-5 w-full">
            <SectionHeader title="Role details" />
            {locked && (
                <div className="flex gap-3 items-start bg-[#fff8e6] border-1 border-[#fde6a4] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <Lightbulb02 className="w-5 h-5 text-[#b54708] shrink-0 mt-[2px]" />
                    <p className="text-[14px] text-[#b54708] leading-[20px]">
                        The Owner role is system-managed and read-only. Name, description and branch scope can&apos;t be changed.
                    </p>
                </div>
            )}
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel>Role name</FieldLabel>
                <TextInput value={form.name} onChange={v => set({ name: v })} placeholder="Enter role name" disabled={locked} />
            </div>
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel>Role description</FieldLabel>
                <TextArea value={form.description} onChange={v => set({ description: v })} placeholder="Enter role description..." disabled={locked} />
            </div>
            <div className="flex flex-col gap-[6px] w-full">
                <FieldLabel>Branch location</FieldLabel>
                <SelectInput
                    triggerIcon={<MarkerPin01 className="w-4 h-4 text-[#667085]" />}
                    placeholder="Select location"
                    options={[
                        { value: "__all__", label: "All locations" },
                        ...branchOptions,
                    ]}
                    value={form.branchId === null ? "__all__" : form.branchId}
                    onChange={v => set({ branchId: v === "__all__" ? null : v })}
                    width="w-full"
                    disabled={locked}
                />
            </div>
        </div>
    );
}

// ─── Step 2 — Define role type + grant limits + permissions matrix ────────

const ROLE_TYPE_OPTIONS: { value: RoleType; label: string }[] = [
    // Owner is excluded — it's auto-created at signup and locked.
    { value: "branch_admin", label: "Branch admin" },
    { value: "operator",     label: "Operator" },
    { value: "instructor",   label: "Instructor" },
    { value: "front_desk",   label: "Front desk" },
];

function PermissionCellInput({ value, onChange, disabled, ariaLabel }: {
    value: PermissionCell;
    onChange?: (next: boolean) => void;
    disabled?: boolean;
    ariaLabel: string;
}) {
    // "na" cells render as a dash — non-interactive, never checkable. The
    // permission matrix bakes in N/A for module-action pairs that don't make
    // sense (e.g. "View" on a write-only action surface).
    if (value === "na") {
        return <span className="text-[14px] text-[#98a2b3]" aria-label={`${ariaLabel}: not applicable`}>—</span>;
    }
    return (
        <Checkbox checked={value} onChange={onChange} disabled={disabled} ariaLabel={ariaLabel} />
    );
}

function PermissionMatrixTable({ form, locked, onCellChange }: {
    form: FormValue;
    locked: boolean;
    onCellChange: (sectionKey: string, modKey: string, action: keyof PermissionRowShape, next: boolean) => void;
}) {
    const sections = permissionSectionsFor(form.type);

    return (
        <div className="w-full border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
            <table className="w-full border-collapse">
                <thead className="bg-[#f9fafb]">
                    <tr>
                        <th className="text-left px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec]">Module / Action</th>
                        <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Create</th>
                        <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Edit</th>
                        <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">Delete</th>
                        <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] border-b border-[#e4e7ec] w-[80px]">View</th>
                    </tr>
                </thead>
                <tbody>
                    {sections.map((section: PermissionSectionSpec) => (
                        <>
                            <tr key={`${section.key}__hdr`} className="bg-white">
                                <td colSpan={5} className="px-4 py-3 text-[14px] font-semibold text-[#101828] border-b border-[#f2f4f7]">
                                    {section.label}
                                </td>
                            </tr>
                            {section.modules.map(mod => {
                                const cellRow = form.permissions[section.key]?.[mod.key] ?? { create: "na", edit: "na", delete: "na", view: "na" };
                                return (
                                    <tr key={`${section.key}__${mod.key}`} className="hover:bg-[#f9fafb] transition-colors">
                                        <td className="px-4 py-3 text-[14px] text-[#344054] border-b border-[#f2f4f7] pl-8">{mod.label}</td>
                                        {(["create", "edit", "delete", "view"] as const).map(action => (
                                            <td key={action} className="px-4 py-3 border-b border-[#f2f4f7] text-center">
                                                <div className="flex items-center justify-center">
                                                    <PermissionCellInput
                                                        value={cellRow[action]}
                                                        onChange={(next) => onCellChange(section.key, mod.key, action, next)}
                                                        disabled={locked}
                                                        ariaLabel={`${section.label} / ${mod.label} / ${action}`}
                                                    />
                                                </div>
                                            </td>
                                        ))}
                                    </tr>
                                );
                            })}
                        </>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Type alias for the keyof check on PermissionRow — keeps the matrix table
// signature self-contained without importing PermissionRow from the store
// just for a type literal.
type PermissionRowShape = { create: PermissionCell; edit: PermissionCell; delete: PermissionCell; view: PermissionCell };

function GrantLimitsSection({ form, set }: { form: FormValue; set: (patch: Partial<FormValue>) => void }) {
    const gl = form.grantLimits;
    // Per-row Enabled flags default to `true` when the section is on.
    const perMonthEnabled    = gl.grants_per_month_enabled ?? gl.enabled;
    const maxValueEnabled    = gl.max_grant_value_enabled  ?? gl.enabled;
    function update(patch: Partial<GrantLimits>) {
        set({ grantLimits: { ...gl, ...patch } });
    }
    function valueLabel(): { perMonth: string; maxValue: string } {
        if (!gl.enabled) return { perMonth: "Disabled", maxValue: "Disabled" };
        if (gl.unlimited) return { perMonth: "Unlimited", maxValue: "Unlimited" };
        return { perMonth: String(gl.grants_per_month ?? 0), maxValue: `AED ${(gl.max_grant_value_aed ?? 0).toLocaleString("en-US")}` };
    }
    const labels = valueLabel();

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Grant limits</p>
                    <p className="text-[14px] text-[#667085] leading-[20px]">Control how this role can grant complimentary credits.</p>
                </div>
                <Toggle value={gl.enabled} onChange={v => update({ enabled: v })} />
            </div>

            {gl.enabled && (
                <>
                    <div className="grid grid-cols-3 gap-3 w-full">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Grants / month</p>
                            <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{labels.perMonth}</p>
                        </div>
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Max value per grant</p>
                            <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{labels.maxValue}</p>
                        </div>
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-1">
                            <p className="text-[14px] text-[#667085]">Remove unused grants</p>
                            <p className="font-semibold text-[20px] leading-[30px] text-[#101828]">{gl.allow_remove_unused ? "Yes" : "No"}</p>
                        </div>
                    </div>

                    <div className="border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                        <table className="w-full border-collapse">
                            <thead className="bg-[#f9fafb]">
                                <tr>
                                    <th className="text-left px-4 py-3 text-[12px] font-medium text-[#475467]">Limit type</th>
                                    <th className="text-left px-4 py-3 text-[12px] font-medium text-[#475467] w-[200px]">Value</th>
                                    <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] w-[100px]">Unlimited</th>
                                    <th className="text-center px-4 py-3 text-[12px] font-medium text-[#475467] w-[100px]">Enabled</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-t border-[#f2f4f7]">
                                    <td className="px-4 py-3 text-[14px] text-[#344054]">Grants per month</td>
                                    <td className="px-4 py-3">
                                        {gl.unlimited ? (
                                            <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647] text-[13px] font-medium">Unlimited</span>
                                        ) : (
                                            <NumberInput
                                                value={gl.grants_per_month ?? 0}
                                                onChange={v => update({ grants_per_month: v === "" ? 0 : v })}
                                                disabled={!perMonthEnabled}
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            <Checkbox checked={gl.unlimited} onChange={v => update({ unlimited: v })} ariaLabel="Unlimited grants per month" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            <Checkbox
                                                checked={perMonthEnabled}
                                                onChange={v => update({ grants_per_month_enabled: v })}
                                                ariaLabel="Grants per month enabled"
                                            />
                                        </div>
                                    </td>
                                </tr>
                                <tr className="border-t border-[#f2f4f7]">
                                    <td className="px-4 py-3 text-[14px] text-[#344054]">Max grant value (AED)</td>
                                    <td className="px-4 py-3">
                                        {gl.unlimited ? (
                                            <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647] text-[13px] font-medium">Unlimited</span>
                                        ) : (
                                            <NumberInput
                                                value={gl.max_grant_value_aed ?? 0}
                                                onChange={v => update({ max_grant_value_aed: v === "" ? 0 : v })}
                                                disabled={!maxValueEnabled}
                                            />
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            <Checkbox checked={gl.unlimited} onChange={v => update({ unlimited: v })} ariaLabel="Unlimited max grant value" />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            <Checkbox
                                                checked={maxValueEnabled}
                                                onChange={v => update({ max_grant_value_enabled: v })}
                                                ariaLabel="Max grant value enabled"
                                            />
                                        </div>
                                    </td>
                                </tr>
                                <tr className="border-t border-[#f2f4f7]">
                                    <td className="px-4 py-3 text-[14px] text-[#344054]">Remove unused grants</td>
                                    <td className="px-4 py-3">
                                        {gl.allow_remove_unused ? (
                                            <span className="inline-flex items-center px-2 py-[2px] rounded-full bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647] text-[13px] font-medium">Enabled</span>
                                        ) : (
                                            <span className="text-[14px] text-[#98a2b3]">—</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center"><span className="text-[14px] text-[#98a2b3]">—</span></td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center">
                                            <Checkbox checked={gl.allow_remove_unused} onChange={v => update({ allow_remove_unused: v })} ariaLabel="Allow remove unused grants" />
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

function Step2Permissions({ form, set, mode, locked }: {
    form: FormValue;
    set: (patch: Partial<FormValue>) => void;
    mode: RoleFormMode;
    /** Role is locked (Owner) — matrix renders read-only, type dropdown
     *  disabled, Reset button hidden. */
    locked: boolean;
}) {
    function handleTypeChange(next: RoleType) {
        // Switching the role type acts as a "load this template" — the
        // permission matrix and grant limits both copy the type's defaults.
        // Any per-cell edits in flight are overwritten on purpose: the admin
        // explicitly chose a new starting point.
        set({
            type: next,
            permissions: DEFAULT_PERMISSIONS_BY_TYPE[next],
        });
    }
    function handleCellChange(sectionKey: string, modKey: string, action: keyof PermissionRowShape, next: boolean) {
        // Spread-immutable update so React + Zustand both see the change.
        const sectionMap   = form.permissions[sectionKey] ?? {};
        const modRow       = sectionMap[modKey] ?? { create: "na", edit: "na", delete: "na", view: "na" };
        set({
            permissions: {
                ...form.permissions,
                [sectionKey]: {
                    ...sectionMap,
                    [modKey]: { ...modRow, [action]: next },
                },
            },
        });
    }
    function handleResetToDefaults() {
        set({
            permissions: DEFAULT_PERMISSIONS_BY_TYPE[form.type],
            grantLimits: { ...DEFAULT_GRANT_LIMITS },
        });
    }

    // The dropdown intent shifts between Create vs Edit modes — the wording
    // matters because in Create we're explicitly picking a starting template,
    // whereas in Edit we're changing the underlying role type (and accepting
    // that the matrix resets to that type's defaults).
    const typeFieldLabel  = mode === "create" ? "Start from template" : "Role type";
    const typeFieldHelper = mode === "create"
        ? "Pick a base role to pre-fill the permission matrix below. You can then customise individual cells."
        : "Changing the role type resets the matrix and grant limits to that type's defaults.";

    return (
        <div className="flex flex-col gap-8 w-full">
            <div className="flex flex-col gap-4 w-full">
                <SectionHeader title="Define role type" />
                <div className="flex flex-col gap-[6px] w-full">
                    <FieldLabel>{typeFieldLabel}</FieldLabel>
                    <SelectInput
                        placeholder="Select role type"
                        options={ROLE_TYPE_OPTIONS}
                        value={form.type}
                        onChange={v => handleTypeChange(v as RoleType)}
                        width="w-full"
                        disabled={locked}
                    />
                    <p className="text-[13px] text-[#667085] leading-[18px]">{typeFieldHelper}</p>
                </div>
            </div>

            <GrantLimitsSection form={form} set={set} />

            <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center justify-between gap-3">
                    <SectionHeader title="Permissions" />
                    {!locked && (
                        <Button variant="secondary-gray" size="sm" onClick={handleResetToDefaults}>
                            Reset to default permissions
                        </Button>
                    )}
                </div>

                {/* Locked notice — Owner only. Surfaces WHY the matrix is
                    greyed out so the admin doesn't think the form is
                    broken. */}
                {locked && (
                    <div className="flex gap-3 items-start bg-[#fff8e6] border-1 border-[#fde6a4] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Lightbulb02 className="w-5 h-5 text-[#b54708] shrink-0 mt-[2px]" />
                        <p className="text-[14px] text-[#b54708] leading-[20px]">
                            The Owner role has full system access and cannot be edited. This guarantees an account with administrative recovery is always available.
                        </p>
                    </div>
                )}
                {!locked && (
                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                        <p className="text-[14px] text-[#475467] leading-[20px]">
                            Check or uncheck cells to customise this role. Cells marked with a dash (&mdash;) don&apos;t apply to that module-action pair.
                        </p>
                    </div>
                )}

                <PermissionMatrixTable
                    form={form}
                    locked={locked}
                    onCellChange={handleCellChange}
                />
            </div>
        </div>
    );
}

// ─── Validation ────────────────────────────────────────────────────────────

function isStep1Valid(form: FormValue): boolean {
    return !!form.name.trim();
}

function isStep2Valid(form: FormValue): boolean {
    return !!form.type;
}

// ─── Top-level component ───────────────────────────────────────────────────

export interface RoleFormPageProps {
    mode: RoleFormMode;
    /** Required when mode !== "create". */
    roleId?: string;
    returnTo?: string;
}

export default function RoleFormPage({ mode, roleId, returnTo = "/admin/staff" }: RoleFormPageProps) {
    const router = useRouter();
    const roles       = useAppStore(s => s.roles);
    const branches    = useAppStore(s => s.branches);
    const addRole     = useAppStore(s => s.addRole);
    const updateRole  = useAppStore(s => s.updateRole);
    const showToast   = useAppStore(s => s.showToast);

    const existing = mode !== "create" && roleId ? roles.find(r => r.id === roleId) : undefined;
    const [form, setForm] = useState<FormValue>(() => existing ? formFromRole(existing) : emptyForm());
    const [step, setStep] = useState<1 | 2>(mode === "edit_permissions" ? 2 : 1);
    const [hydrated, setHydrated] = useState(!!existing);
    // Owner is the only seeded role with `locked: true`. When editing a
    // locked role the form renders read-only: permissions can't be toggled,
    // role type can't be changed, name/description/branch are read-only.
    // This guarantees the Owner persona retains full system access at all
    // times — the demo's recovery escape hatch.
    const locked = existing?.locked === true;

    useEffect(() => {
        if (mode !== "create" && existing && !hydrated) {
            setForm(formFromRole(existing));
            setHydrated(true);
        }
    }, [mode, existing, hydrated]);

    function set(patch: Partial<FormValue>) { setForm(prev => ({ ...prev, ...patch })); }
    const step1Valid = isStep1Valid(form);
    const step2Valid = isStep2Valid(form);

    // Edit-mode guard.
    useEffect(() => {
        if (mode !== "create" && roleId && roles.length > 0 && !existing) {
            showToast("Role not found", "Returned to the staff list.", "error");
            router.push(returnTo);
        }
    }, [mode, roleId, roles, existing, router, returnTo, showToast]);

    function handleSave() {
        if (mode === "create") {
            if (!step1Valid || !step2Valid) return;
            addRole({
                name: form.name.trim(),
                description: form.description.trim(),
                branchId: form.branchId,
                type: form.type,
                status: "active",
                grantLimits: form.grantLimits,
                permissions: form.permissions,
                locked: false,
            });
            showToast("Role added", `"${form.name.trim()}" is now active.`, "success", "check");
            router.push(returnTo);
            return;
        }
        if (!roleId || !existing) return;
        if (mode === "edit_details") {
            updateRole(roleId, {
                name: form.name.trim(),
                description: form.description.trim(),
                branchId: form.branchId,
            });
            showToast("Role updated", `Role details saved.`, "success", "check");
            router.push(returnTo);
            return;
        }
        if (mode === "edit_permissions") {
            updateRole(roleId, {
                type: form.type,
                grantLimits: form.grantLimits,
                permissions: form.permissions,
            });
            showToast("Permissions updated", `Role permissions saved.`, "success", "check");
            router.push(returnTo);
        }
    }

    const headerTitle = mode === "create"          ? "Add new role"
                      : mode === "edit_details"    ? "Edit role details"
                      :                              "Edit permissions";
    const finalLabel  = mode === "create"          ? "Add role"
                      : mode === "edit_details"    ? "Save changes"
                      :                              "Save permissions";

    // Which steps render in the side rail?
    const showStep1 = mode !== "edit_permissions";
    const showStep2 = mode !== "edit_details";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{headerTitle}</h1>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-8 items-start overflow-hidden">
                {/* Left progress steps. In Create both rows render so the
                    admin sees overall progress. In Edit modes only the
                    relevant step renders — edit_details shows row 1 only,
                    edit_permissions shows row 2 only. */}
                <div className="w-[260px] shrink-0 flex flex-col gap-4">
                    {mode !== "edit_permissions" && (
                        <StepRow
                            index={1}
                            label="Role details"
                            active={mode === "edit_details" || step === 1}
                            done={mode === "create" && step === 2}
                            isLast={mode === "edit_details"}
                        />
                    )}
                    {mode !== "edit_details" && (
                        <StepRow
                            index={2}
                            label="Permissions"
                            active={mode === "edit_permissions" || step === 2}
                            done={false}
                            isLast={true}
                        />
                    )}
                </div>

                {/* Center content card */}
                <div className="flex-1 min-w-0 max-w-[760px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide p-6">
                        {step === 1
                            ? <Step1Details form={form} set={set} branches={branches} locked={locked} />
                            : <Step2Permissions form={form} set={set} mode={mode} locked={locked} />
                        }
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-3">
                        {(step === 2 && showStep1) ? (
                            <Button variant="secondary-gray" size="md" onClick={() => setStep(1)}>Back</Button>
                        ) : <span />}
                        {(step === 1 && showStep2 && showStep1) ? (
                            <Button variant="primary" size="md" disabled={!step1Valid} onClick={() => setStep(2)}>Continue</Button>
                        ) : (
                            <Button variant="primary" size="md" disabled={locked || !step1Valid || !step2Valid} onClick={handleSave}>
                                {finalLabel}
                            </Button>
                        )}
                    </div>
                </div>

                {/* Right preview — visible on all modes including edit
                    permissions so the admin still sees the role identity
                    they're editing. */}
                <RolePreview form={form} branches={branches} />
            </div>

            <Toast />
        </div>
    );
}
