"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Categories module (/admin/categories)
// ─────────────────────────────────────────────────────────────────────────────
//
// Table-based module view (Figma 7487:99949). Lives under the Classes
// sidebar group, just below Services.
//
// Layout:
//   • Toolbar (no card): Total + count on the left, Search + Add new on
//     the right.
//   • Table card: Checkbox · Name (avatar + label) · Status · Actions ⋮.
//     Row dropdown → Edit · Delete.
//   • Bulk select scoped to the current page (matches every other admin
//     table — Staff & shift, Pay rate, Customers, etc.).
//   • Floating bulk-delete pill bar when ≥1 row is selected.
//   • Pagination row inside the card chrome.
//
// Data layer is UNCHANGED — same `classCategories` slice + the same
// `addClassCategory` / `updateClassCategory` / `deleteClassCategory`
// mutators + the same `canDeleteClassCategory` cross-module guard.
// Every downstream consumer (class template form, schedule form, schedule
// filter, staff form) reads via `useAppStore(s => s.classCategories)` so
// they see this page's edits in the same render cycle.

import { useEffect, useMemo, useState } from "react";
import {
    Plus, Trash04, XClose, Image01, SearchMd,
    Edit02, Trash01, Check, ChevronDown, Trash02,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { useAppStore } from "@/lib/store";
import type { ClassCategory } from "@/lib/store";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]";
const TD = "px-4 py-4 text-[14px] text-[#344054] border-b border-[#f2f4f7]";
const STATUS_BADGE: Record<ClassCategory["status"], string> = {
    active:   "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
    inactive: "bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054]",
};
const STATUS_LABEL: Record<ClassCategory["status"], string> = {
    active: "Active", inactive: "Inactive",
};
const STATUS_ORDER: Record<ClassCategory["status"], number> = {
    active: 0, inactive: 1,
};

export default function CategoriesPage() {
    const categories               = useAppStore(s => s.classCategories);
    const addCategory              = useAppStore(s => s.addClassCategory);
    const updateCategory           = useAppStore(s => s.updateClassCategory);
    const deleteCategory           = useAppStore(s => s.deleteClassCategory);
    const canDeleteClassCategoryFn = useAppStore(s => s.canDeleteClassCategory);
    const showToast                = useAppStore(s => s.showToast);

    // ── Modal + delete state ──────────────────────────────────────────────
    const [categoryModal, setCategoryModal] = useState<"new" | ClassCategory | null>(null);
    const [pendingDelete, setPendingDelete] = useState<
        | { kind: "row"; row: ClassCategory }
        | { kind: "bulk"; rows: ClassCategory[] }
        | null
    >(null);

    // ── Toolbar state ──────────────────────────────────────────────────────
    const [search, setSearch] = useState("");

    // ── Selection + pagination state ──────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    useEffect(() => { setPage(1); }, [search]);

    function handleAddCategory()                  { setCategoryModal("new"); }
    function handleEditCategory(c: ClassCategory) { setCategoryModal(c); }

    /** Category-delete request — refuses with a friendly toast when the
     *  category is still referenced by any class template. */
    function requestDeleteCategory(c: ClassCategory) {
        if (!canDeleteClassCategoryFn(c.id)) {
            showToast(
                "Can’t delete this category",
                `"${c.name}" is in use by one or more class templates. Reassign them before deleting.`,
                "error", "slash",
            );
            return;
        }
        setPendingDelete({ kind: "row", row: c });
    }

    /** Bulk-delete request — gates per-row through the same usage check.
     *  Drops any rows that fail the gate and surfaces a single
     *  consolidated toast at delete time so the admin understands why
     *  the count is smaller than the selection. */
    function requestBulkDelete(rows: ClassCategory[]) {
        const deletable = rows.filter(r => canDeleteClassCategoryFn(r.id));
        const blocked = rows.filter(r => !deletable.includes(r));
        if (deletable.length === 0) {
            showToast(
                "Can’t delete these categories",
                "Every selected category is in use by one or more class templates.",
                "error", "slash",
            );
            return;
        }
        setPendingDelete({ kind: "bulk", rows: deletable });
        if (blocked.length > 0) {
            showToast(
                `${blocked.length} skipped`,
                `${blocked.length} ${blocked.length === 1 ? "category was" : "categories were"} in use and excluded from the delete.`,
                "success", "check",
            );
        }
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
                "Category created",
                `"${name}" has been added to your categories.`,
                "success", "check",
            );
        } else if (categoryModal) {
            updateCategory(categoryModal.id, {
                name,
                image_url: image_url || undefined,
            });
            showToast(
                "Category updated",
                `"${name}" has been saved.`,
                "success", "check",
            );
        }
        setCategoryModal(null);
    }

    function confirmDelete() {
        if (!pendingDelete) return;
        const rows = pendingDelete.kind === "row"
            ? [pendingDelete.row]
            : pendingDelete.rows;
        for (const c of rows) deleteCategory(c.id);
        showToast(
            rows.length === 1 ? "Category deleted" : `${rows.length} categories deleted`,
            rows.length === 1 ? `"${rows[0].name}" has been removed.` : "The selected categories have been removed.",
            "success", "trash",
        );
        // Drop any deleted ids out of the selection set so the bulk bar
        // updates immediately.
        const removedIds = rows.map(c => c.id);
        setSelectedIds(prev => {
            const next = new Set(prev);
            removedIds.forEach(id => next.delete(id));
            return next;
        });
        setPendingDelete(null);
    }

    // ── Filter + sort + paginate ──────────────────────────────────────────
    const filteredCategories = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q
            ? categories.filter(c => c.name.toLowerCase().includes(q))
            : categories;
    }, [categories, search]);

    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<ClassCategory>(filteredCategories, {
        name:   (a, b) => a.name.localeCompare(b.name),
        status: (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    });

    const totalPages   = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage  = Math.min(Math.max(1, page), totalPages);
    const pageRows     = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    // ── Bulk selection (scoped to current page) ───────────────────────────
    const pageIds = pageRows.map(r => r.id);
    const allChecked  = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
    const someChecked = !allChecked && pageIds.some(id => selectedIds.has(id));
    const selectedRows = useMemo(
        () => sortedRows.filter(r => selectedIds.has(r.id)),
        [sortedRows, selectedIds],
    );
    function toggleAllOnPage() {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allChecked) pageIds.forEach(id => next.delete(id));
            else            pageIds.forEach(id => next.add(id));
            return next;
        });
    }
    function toggleOne(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else              next.add(id);
            return next;
        });
    }
    function clearSelection() { setSelectedIds(new Set()); }

    const isTrulyEmpty   = categories.length === 0;
    const isFilteredEmpty = !isTrulyEmpty && sortedRows.length === 0;

    return (
        <div className="flex flex-col gap-5 w-full">
            {/* Toolbar — Total + count on the left, search + Add new on the
                right. Same pattern as the rest of the Classes group
                pages. */}
            <div className="flex items-end gap-3 w-full">
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <p className="text-[14px] text-[#667085] leading-5">Total</p>
                    <p className="text-[16px] font-medium text-[#101828] leading-6">
                        {categories.length} {categories.length === 1 ? "category" : "categories"}
                    </p>
                </div>
                <div className="relative w-[240px]">
                    <SearchMd className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085] pointer-events-none" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search category..."
                        className="h-10 w-full pl-9 pr-3 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
                <Button
                    variant="primary"
                    size="md"
                    leftIcon={<Plus className="w-5 h-5" />}
                    onClick={handleAddCategory}
                >
                    Add new
                </Button>
            </div>

            {/* Table — flush, no bordered card per Figma. Internal row
                dividers stay (the `border-b` on each <td>). Pagination
                keeps its top border so it reads as a footer separator. */}
            <div className="flex flex-col">
                {isTrulyEmpty || isFilteredEmpty ? (
                    <div className="relative" style={{ minHeight: 360 }}>
                        <EmptyState
                            title={isFilteredEmpty ? "No matches found" : "No categories yet"}
                            subtitle={isFilteredEmpty
                                ? "Try a different search term."
                                : "You haven’t created any category yet. Click Add new to get started."}
                        />
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr>
                                        <th className={cn(TH, "w-[44px]")}>
                                            <CheckboxCell
                                                checked={allChecked}
                                                indeterminate={someChecked}
                                                onChange={toggleAllOnPage}
                                                ariaLabel="Select all categories on this page"
                                            />
                                        </th>
                                        <th className={TH}>
                                            <SortableHeader sortKey="name"   currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[160px]")}>
                                            <SortableHeader sortKey="status" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                                        </th>
                                        <th className={cn(TH, "w-[52px]")} />
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map(c => {
                                        const isSelected = selectedIds.has(c.id);
                                        return (
                                            <tr key={c.id}
                                                className={cn("transition-colors", isSelected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]")}>
                                                <td className={TD}>
                                                    <CheckboxCell
                                                        checked={isSelected}
                                                        onChange={() => toggleOne(c.id)}
                                                        ariaLabel={`Select ${c.name}`}
                                                    />
                                                </td>
                                                <td className={TD}>
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <CategoryAvatar src={c.image_url} />
                                                        <span className="text-[14px] font-medium text-[#101828] truncate">{c.name}</span>
                                                    </div>
                                                </td>
                                                <td className={TD}>
                                                    <span className={cn(
                                                        "inline-flex items-center px-[10px] py-[2px] rounded-full text-[13px] font-medium whitespace-nowrap",
                                                        STATUS_BADGE[c.status],
                                                    )}>
                                                        {STATUS_LABEL[c.status]}
                                                    </span>
                                                </td>
                                                <td className={TD}>
                                                    <RowActions
                                                        minWidth={180}
                                                        items={[
                                                            { label: "Edit", icon: Edit02, onClick: () => handleEditCategory(c) },
                                                            { label: "Delete", icon: Trash01, onClick: () => requestDeleteCategory(c), danger: true },
                                                        ]}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <Pagination
                            page={clampedPage}
                            total={sortedRows.length}
                            pageSize={pageSize}
                            onPage={setPage}
                            onPageSize={n => { setPageSize(n); setPage(1); }}
                        />
                    </>
                )}
            </div>

            {/* Floating bulk-delete bar */}
            {selectedRows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                    <div className="pointer-events-auto bg-[#f9fafb] border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-[600px] max-w-full">
                        <button type="button" onClick={clearSelection}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#101828] hover:bg-[#f9fafb] transition-colors whitespace-nowrap shrink-0">
                            {selectedRows.length} selected
                            <XClose className="w-5 h-5 text-[#667085]" />
                        </button>
                        <Button variant="secondary-gray" size="sm"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => requestBulkDelete(selectedRows)}>
                            Delete
                        </Button>
                    </div>
                </div>
            )}

            {categoryModal && (
                <CategoryModal
                    existing={categoryModal === "new" ? undefined : categoryModal}
                    onClose={() => setCategoryModal(null)}
                    onSubmit={handleCategorySubmit}
                />
            )}

            {pendingDelete && (
                <DeleteConfirmModal
                    name={pendingDelete.kind === "row"
                        ? `"${pendingDelete.row.name}"`
                        : `${pendingDelete.rows.length} ${pendingDelete.rows.length === 1 ? "category" : "categories"}`}
                    description={pendingDelete.kind === "row"
                        ? "This category will be permanently removed. This can’t be undone."
                        : "These categories will be permanently removed. This can’t be undone."}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </div>
    );
}

// ─── Row action menu ──────────────────────────────────────────────────────

// Local RowActions removed — uses canonical `@/components/patterns/RowActions`.

// ─── Checkbox cell — matches every other admin table ───────────────────────

function CheckboxCell({ checked, onChange, indeterminate = false, ariaLabel }: {
    checked: boolean; onChange: () => void; indeterminate?: boolean; ariaLabel: string;
}) {
    return (
        <button type="button" role="checkbox" aria-label={ariaLabel} aria-checked={indeterminate ? "mixed" : checked}
            onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] border-1 flex items-center justify-center transition-colors shrink-0",
                (checked || indeterminate)
                    ? "bg-[#658774] border-[#658774] text-white"
                    : "bg-white border-[#d0d5dd] hover:border-[#7ba08c]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// Local Pagination removed — uses canonical `@/components/ui/Pagination`.

// ─── Category row avatar ──────────────────────────────────────────────────

function CategoryAvatar({ src }: { src?: string }) {
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

// ─── Destructive confirm modal — matches every other admin destroy flow ───

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
                            Delete {name}?
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
