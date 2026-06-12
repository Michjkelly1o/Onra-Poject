"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Booking Rules landing (/admin/settings/booking-rules)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4580:29847 (empty) + 4580:34127 (populated policies container) —
// three stacked white cards:
//   1. Classes  — read-only summary (Bookings open / Bookings close /
//      Auto-submit attendance / Waitlist enabled / Max waiting spots).
//      Top-right "Customize" navigates to /settings/booking-rules/customize.
//   2. Cancellation & no-show policies — Add new button + list of saved
//      policies with edit + delete row actions. Empty state when none.
//   3. Service categories — list w/ "Add new" CTA. Phase 3 wires the
//      add/edit modal; Phase 2 still renders the empty state only.
//
// The Phase 2 delete confirm modal matches the canonical pattern (RED
// destructive icon + variant) — clicking the trash icon opens the modal
// instead of mutating directly.

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Edit02, Plus, ShieldTick, Grid01, Pencil01, Trash04, XClose, Image01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore } from "@/lib/store";
import type { ClassesSettings, CancellationPolicy, ClassCategory } from "@/lib/store";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";

export default function BookingRulesPage() {
    const router          = useRouter();
    const classesSettings = useAppStore(s => s.classesSettings);
    const policies        = useAppStore(s => s.cancellationPolicies);
    const categories      = useAppStore(s => s.classCategories);
    const deletePolicy             = useAppStore(s => s.deleteCancellationPolicy);
    const addCategory              = useAppStore(s => s.addClassCategory);
    const updateCategory           = useAppStore(s => s.updateClassCategory);
    const deleteCategory           = useAppStore(s => s.deleteClassCategory);
    const canDeleteClassCategoryFn = useAppStore(s => s.canDeleteClassCategory);
    const showToast                = useAppStore(s => s.showToast);

    // Delete-confirm state — `kind` discriminates so one modal serves
    // both policy and category rows without two parallel state slots.
    const [pendingDelete, setPendingDelete] = useState<
        | { kind: "policy";   policy:   CancellationPolicy }
        | { kind: "category"; category: ClassCategory }
        | null
    >(null);

    // Category modal — null = closed, "new" = create, ClassCategory = edit.
    const [categoryModal, setCategoryModal] = useState<"new" | ClassCategory | null>(null);

    function handleCustomize()             { router.push("/settings/booking-rules/customize"); }
    function handleAddPolicy()             { router.push("/settings/booking-rules/policies/new"); }
    function handleEditPolicy(id: string)  { router.push(`/settings/booking-rules/policies/${id}/edit`); }

    function handleAddCategory()           { setCategoryModal("new"); }
    function handleEditCategory(c: ClassCategory) { setCategoryModal(c); }

    /** Category-delete request — refuses with a friendly toast when the
     *  category is still referenced by any class template (Phase 4 cross-
     *  module guard via `canDeleteClassCategory`). Otherwise opens the
     *  canonical destructive confirm modal. */
    function requestDeleteCategory(c: ClassCategory) {
        if (!canDeleteClassCategoryFn(c.id)) {
            showToast(
                "Can’t delete this category",
                `"${c.name}" is in use by one or more class templates. Reassign them before deleting.`,
                "error", "slash",
            );
            return;
        }
        setPendingDelete({ kind: "category", category: c });
    }

    function handleCategorySubmit({ name, image_url }: { name: string; image_url: string }) {
        if (categoryModal === "new") {
            const newCategory: ClassCategory = {
                id: `cat_new_${Date.now()}`,
                name,
                color_hex: "#f9fafb",
                status: "active",
                image_url: image_url || undefined,
            };
            addCategory(newCategory);
            showToast(
                "Service category created",
                `"${name}" has been added to your service categories.`,
                "success", "check",
            );
        } else if (categoryModal) {
            // After the "new" check above, TS narrows to ClassCategory.
            updateCategory(categoryModal.id, {
                name,
                image_url: image_url || undefined,
            });
            showToast(
                "Service category updated",
                `"${name}" has been saved.`,
                "success", "check",
            );
        }
        setCategoryModal(null);
    }

    function confirmDelete() {
        if (!pendingDelete) return;
        if (pendingDelete.kind === "policy") {
            const name = pendingDelete.policy.name;
            deletePolicy(pendingDelete.policy.id);
            showToast("Policy deleted", `"${name}" has been removed.`, "success", "trash");
        } else {
            const name = pendingDelete.category.name;
            deleteCategory(pendingDelete.category.id);
            showToast("Service category deleted", `"${name}" has been removed.`, "success", "trash");
        }
        setPendingDelete(null);
    }

    const pendingDeleteName = pendingDelete
        ? (pendingDelete.kind === "policy" ? pendingDelete.policy.name : pendingDelete.category.name)
        : "";
    const pendingDeleteCopy = pendingDelete?.kind === "policy"
        ? "This policy will be removed from your booking rules. Existing bookings that referenced it keep their record. This can’t be undone."
        : "This service category will be removed from your booking rules. Class templates and schedules that referenced it will need to be reassigned. This can’t be undone.";

    return (
        <div className="flex flex-col gap-5 w-full">
            <ClassesCard settings={classesSettings} onCustomize={handleCustomize} />

            <PoliciesCard
                policies={policies}
                onAdd={handleAddPolicy}
                onEdit={handleEditPolicy}
                onDelete={p => setPendingDelete({ kind: "policy", policy: p })}
            />

            <CategoriesCard
                categories={categories}
                onAdd={handleAddCategory}
                onEdit={handleEditCategory}
                onDelete={requestDeleteCategory}
            />

            {categoryModal && (
                <CategoryModal
                    existing={categoryModal === "new" ? undefined : categoryModal}
                    onClose={() => setCategoryModal(null)}
                    onSubmit={handleCategorySubmit}
                />
            )}

            {pendingDelete && (
                <DeleteConfirmModal
                    name={pendingDeleteName}
                    description={pendingDeleteCopy}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}

// ─── Card 1 — Classes summary ───────────────────────────────────────────────

function ClassesCard({ settings, onCustomize }: {
    settings: ClassesSettings;
    onCustomize: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">
                        Classes
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        Booking windows, waitlist, auto-attendance, and guest settings.
                    </p>
                </div>
                <Button
                    variant="secondary-gray"
                    size="md"
                    leftIcon={<Edit02 className="w-5 h-5" />}
                    onClick={onCustomize}
                >
                    Customize
                </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full">
                <SummaryTile
                    label="Bookings open"
                    value={`${settings.booking_open_value} ${settings.booking_open_unit} (before the class starts)`}
                />
                <SummaryTile
                    label="Bookings close"
                    value={`${settings.booking_close_value} ${settings.booking_close_unit} (before the class starts)`}
                />
                <SummaryTile
                    label="Auto-submit attendance"
                    value={`${settings.auto_submit_attendance_value} ${settings.auto_submit_attendance_unit}`}
                />
                <SummaryTileWithBadge
                    label="Waitlist"
                    enabled={settings.waitlist_enabled}
                />
                <SummaryTile
                    label="Max waiting spots"
                    value={`${settings.max_waiting_spots} spots`}
                />
                <div />
            </div>
        </div>
    );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5 truncate">{label}</p>
            <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">
                {value}
            </p>
        </div>
    );
}

function SummaryTileWithBadge({ label, enabled }: { label: string; enabled: boolean }) {
    return (
        <div className="flex flex-col gap-1 min-w-0">
            <p className="text-[14px] text-[#667085] leading-5 truncate">{label}</p>
            <div className="flex items-start">
                <span
                    className={
                        enabled
                            ? "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]"
                            : "inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]"
                    }
                >
                    {enabled ? "Enabled" : "Disabled"}
                </span>
            </div>
        </div>
    );
}

// ─── Card 2 — Cancellation & no-show policies (Phase 2 wired) ──────────────

function PoliciesCard({ policies, onAdd, onEdit, onDelete }: {
    policies: CancellationPolicy[];
    onAdd: () => void;
    onEdit: (id: string) => void;
    onDelete: (policy: CancellationPolicy) => void;
}) {
    const isEmpty = policies.length === 0;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">
                        Cancellation &amp; no-show policies
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        Manage the rules for cancellations and no-shows.
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-5 h-5" />}
                    onClick={onAdd}
                >
                    Add new
                </Button>
            </div>

            {isEmpty ? (
                <div className="relative flex-1" style={{ minHeight: 160 }}>
                    <EmptyState
                        title="No policy found"
                        subtitle="You haven’t created any policies yet."
                        icon={ShieldTick}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-4 w-full">
                    {policies.map(p => (
                        <PolicyRow
                            key={p.id}
                            policy={p}
                            onEdit={() => onEdit(p.id)}
                            onDelete={() => onDelete(p)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function PolicyRow({ policy, onEdit, onDelete }: {
    policy: CancellationPolicy;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-center gap-3 w-full">
            <div className="w-8 h-8 rounded-[6px] bg-white border-1 border-[#e4e7ec] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex items-center justify-center shrink-0">
                <ShieldTick className="w-4 h-4 text-[#475467]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#344054] leading-5 truncate">
                    {policy.name}
                </p>
            </div>
            <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${policy.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors text-[#667085]"
            >
                <Pencil01 className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${policy.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#fef3f2] transition-colors text-[#d92d20]"
            >
                <Trash04 className="w-5 h-5" />
            </button>
        </div>
    );
}

// ─── Card 3 — Service categories (Phase 3 wired) ────────────────────────────

function CategoriesCard({ categories, onAdd, onEdit, onDelete }: {
    categories: ClassCategory[];
    onAdd: () => void;
    onEdit: (c: ClassCategory) => void;
    onDelete: (c: ClassCategory) => void;
}) {
    const isEmpty = categories.length === 0;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
            <div className="flex items-center gap-6 w-full">
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <p className="text-[16px] font-semibold text-[#101828] leading-6">
                        Service categories
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5">
                        Manage how your services are categorized.
                    </p>
                </div>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-5 h-5" />}
                    onClick={onAdd}
                >
                    Add new
                </Button>
            </div>

            {isEmpty ? (
                <div className="relative flex-1" style={{ minHeight: 160 }}>
                    <EmptyState
                        title="No categories found"
                        subtitle="You haven’t created any category yet."
                        icon={Grid01}
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-4 w-full">
                    {categories.map(c => (
                        <CategoryRow
                            key={c.id}
                            category={c}
                            onEdit={() => onEdit(c)}
                            onDelete={() => onDelete(c)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function CategoryRow({ category, onEdit, onDelete }: {
    category: ClassCategory;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 h-[72px] flex items-center gap-3 w-full">
            <CategoryRowAvatar src={category.image_url} />
            <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium text-[#344054] leading-5 truncate">
                    {category.name}
                </p>
            </div>
            <button
                type="button"
                onClick={onEdit}
                aria-label={`Edit ${category.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors text-[#667085]"
            >
                <Pencil01 className="w-5 h-5" />
            </button>
            <button
                type="button"
                onClick={onDelete}
                aria-label={`Delete ${category.name}`}
                className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#fef3f2] transition-colors text-[#d92d20]"
            >
                <Trash04 className="w-5 h-5" />
            </button>
        </div>
    );
}

/** 40×40 row avatar — uploaded image OR gray Image01 placeholder. */
function CategoryRowAvatar({ src }: { src?: string }) {
    return (
        <div className="relative w-10 h-10 rounded-full bg-[#f2f4f7] shrink-0 overflow-hidden flex items-center justify-center shadow-[0px_1.235px_2.469px_-1.111px_rgba(16,24,40,0.1),0px_0.617px_1.235px_-1.111px_rgba(16,24,40,0.06)]">
            {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" className="w-full h-full object-cover rounded-full" />
                : <Image01 className="w-5 h-5 text-[#475467]" />
            }
            <div className="absolute inset-0 rounded-full border-1 border-[rgba(0,0,0,0.08)] pointer-events-none" />
        </div>
    );
}

// ─── Delete confirm modal (canonical destructive pattern) ───────────────────

/** Generic delete-confirm — `description` is the only thing that changes
 *  between policy and category callers, so one component serves both. */
function DeleteConfirmModal({ name, description, onCancel, onConfirm }: {
    name: string;
    description: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[400px] flex flex-col">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        "bg-[#fee4e2]",
                    )}>
                        <Trash04 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">
                            Delete &ldquo;{name}&rdquo;?
                        </p>
                        <p className="text-[14px] text-[#475467] leading-5 w-full">
                            {description}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 items-start p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        size="lg"
                        className="flex-1"
                        onClick={onConfirm}
                    >
                        Delete
                    </Button>
                </div>
            </div>
        </div>
    );
}
