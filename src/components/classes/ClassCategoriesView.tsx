"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Class categories view (shared)
// ─────────────────────────────────────────────────────────────────────────────
//
// Client 2026-08-07 — Class templates + Class categories merged into one
// "Class" menu under Products, tabbed like Memberships & Packages. This file
// splits the categories module into a controller hook + toolbar + panel +
// pagination so the merged /admin/class-types page can render the toolbar
// ABOVE the shared view-card and the table INSIDE it, while the legacy
// standalone /admin/categories route renders the self-contained
// `ClassCategoriesView`.
//
// Data layer is UNCHANGED from the old /admin/categories page — same
// `classCategories` slice + the same `addClassCategory` /
// `updateClassCategory` / `deleteClassCategory` mutators + the same
// `canDeleteClassCategory` cross-module guard. Every downstream consumer
// (class template form, schedule form, schedule filter, staff form) reads via
// `useAppStore(s => s.classCategories)` so they see this page's edits in the
// same render cycle.

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Plus, Trash04, XClose, Image01,
    Edit02, Trash01, Check, Trash02, LayoutAlt01, Tag01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { useAppStore, type ClassCategory } from "@/lib/store";
import { useBulkSelectionSignal } from "@/lib/hooks/useBulkSelectionSignal";
import { CategoryModal } from "@/components/settings/booking-rules/CategoryModal";
import { Pagination } from "@/components/ui/Pagination";
import { RowActions } from "@/components/patterns/RowActions";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { ToolbarTotal } from "@/components/patterns/ToolbarTotal";
import { ToolbarImportButton } from "@/components/patterns/ToolbarImportButton";

const TH = "px-4 py-3 text-left text-[12px] font-medium text-[var(--colors-text-quaternary)] sticky top-0 z-[5] bg-[var(--colors-bg-primary)] shadow-[inset_0_-1px_0_0_var(--colors-border-secondary)]";
const TD = "px-4 py-4 text-[14px] text-[var(--colors-text-secondary)] border-b border-[var(--colors-bg-tertiary)]";
const STATUS_BADGE: Record<ClassCategory["status"], string> = {
    active:   "bg-[#eff6f3] border-1 border-[#94aeaf] text-[#164e52]",
    inactive: "bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] text-[var(--colors-text-secondary)]",
};
const STATUS_LABEL: Record<ClassCategory["status"], string> = {
    active: "Active", inactive: "Inactive",
};
const STATUS_ORDER: Record<ClassCategory["status"], number> = {
    active: 0, inactive: 1,
};

// ─── Controller — all state + handlers + derived rows ────────────────────────

export function useClassCategoriesController() {
    const categories               = useAppStore(s => s.classCategories);
    const addCategory              = useAppStore(s => s.addClassCategory);
    const updateCategory           = useAppStore(s => s.updateClassCategory);
    const deleteCategory           = useAppStore(s => s.deleteClassCategory);
    const canDeleteClassCategoryFn = useAppStore(s => s.canDeleteClassCategory);
    const showToast                = useAppStore(s => s.showToast);

    const [categoryModal, setCategoryModal] = useState<"new" | ClassCategory | null>(null);
    const [pendingDelete, setPendingDelete] = useState<
        | { kind: "row"; row: ClassCategory }
        | { kind: "bulk"; rows: ClassCategory[] }
        | null
    >(null);

    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    useBulkSelectionSignal(selectedIds.size > 0);
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

    const isTrulyEmpty    = categories.length === 0;
    const isFilteredEmpty = !isTrulyEmpty && sortedRows.length === 0;

    return {
        categories, search, setSearch,
        sortKey, sortDir, toggleSort, sortedRows, pageRows,
        selectedIds, allChecked, someChecked, selectedRows,
        toggleAllOnPage, toggleOne, clearSelection,
        clampedPage, pageSize, setPage, setPageSize,
        handleAddCategory, handleEditCategory, requestDeleteCategory, requestBulkDelete,
        categoryModal, setCategoryModal, pendingDelete, setPendingDelete,
        handleCategorySubmit, confirmDelete,
        isTrulyEmpty, isFilteredEmpty,
    };
}

type CategoriesController = ReturnType<typeof useClassCategoriesController>;

// ─── Add dropdown — "Class template" / "Category" ────────────────────────────
//
// Client 2026-08-07 — the merged "Class" page's Add button is a dropdown so
// the admin can create either a class template or a category from either tab,
// mirroring the Shift module's Add menu. Flat menu (no separators) per the
// project's dropdown convention.

export function ClassAddMenu({ onAddTemplate, onAddCategory }: {
    onAddTemplate: () => void;
    onAddCategory: () => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);

    const items = [
        { label: "Class template", icon: <LayoutAlt01 className="w-4 h-4 text-[#667085]" />, onClick: onAddTemplate },
        { label: "Category",       icon: <Tag01 className="w-4 h-4 text-[#667085]" />,       onClick: onAddCategory },
    ];

    return (
        <div ref={ref} className="relative">
            <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={() => setOpen(p => !p)}>
                Add
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[200px]">
                    {items.map(it => (
                        <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
                            className="flex items-center gap-2.5 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            {it.icon}{it.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Toolbar (renders above the shared view-card) ────────────────────────────

export function ClassCategoriesToolbar({ ctrl, onAddTemplate }: {
    ctrl: CategoriesController;
    /** When set (merged "Class" page), the Add button becomes the
     *  template/category dropdown. Omitted on the standalone route, which
     *  keeps a plain category-only Add. */
    onAddTemplate?: () => void;
}) {
    return (
        <div className="flex items-center gap-3 w-full">
            <ToolbarTotal count={ctrl.categories.length} entitySingular="category" entityPlural="categories" />
            <ToolbarSearch value={ctrl.search} onChange={ctrl.setSearch} placeholder="Search category..." />
            <ToolbarImportButton visible={ctrl.categories.length === 0 && !ctrl.search.trim()} />
            {onAddTemplate ? (
                <ClassAddMenu onAddTemplate={onAddTemplate} onAddCategory={ctrl.handleAddCategory} />
            ) : (
                <Button variant="primary" leftIcon={<Plus className="w-5 h-5" />} onClick={ctrl.handleAddCategory}>
                    Add
                </Button>
            )}
        </div>
    );
}

// ─── Panel (table + overlays — renders inside the view-card) ─────────────────

export function ClassCategoriesPanel({ ctrl }: { ctrl: CategoriesController }) {
    return (
        <>
            {ctrl.isTrulyEmpty || ctrl.isFilteredEmpty ? (
                <EmptyState
                    absolute={false} className="min-h-[400px]"
                    title={ctrl.isFilteredEmpty ? "No matches found" : "No categories yet"}
                    subtitle={ctrl.isFilteredEmpty
                        ? "Try a different search term."
                        : "You haven’t created any category yet. Click Add to get started."}
                />
            ) : (
                <div className="px-6">
                    <div>
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className={cn(TH, "w-[44px]")}>
                                        <CheckboxCell
                                            checked={ctrl.allChecked}
                                            indeterminate={ctrl.someChecked}
                                            onChange={ctrl.toggleAllOnPage}
                                            ariaLabel="Select all categories on this page"
                                        />
                                    </th>
                                    <th className={TH}>
                                        <SortableHeader sortKey="name"   currentSort={ctrl.sortKey} dir={ctrl.sortDir} onSort={ctrl.toggleSort}>Name</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[160px]")}>
                                        <SortableHeader sortKey="status" currentSort={ctrl.sortKey} dir={ctrl.sortDir} onSort={ctrl.toggleSort}>Status</SortableHeader>
                                    </th>
                                    <th className={cn(TH, "w-[52px]")} />
                                </tr>
                            </thead>
                            <tbody>
                                {ctrl.pageRows.map(c => {
                                    const isSelected = ctrl.selectedIds.has(c.id);
                                    return (
                                        <tr key={c.id}
                                            className={cn("transition-colors", isSelected ? "bg-[var(--colors-bg-secondary)]" : "hover:bg-[var(--colors-bg-secondary)]")}>
                                            <td className={TD}>
                                                <CheckboxCell
                                                    checked={isSelected}
                                                    onChange={() => ctrl.toggleOne(c.id)}
                                                    ariaLabel={`Select ${c.name}`}
                                                />
                                            </td>
                                            <td className={TD}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <CategoryAvatar src={c.image_url} />
                                                    <span className="text-[14px] font-medium text-[var(--colors-text-primary)] truncate">{c.name}</span>
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
                                                        { label: "Edit", icon: Edit02, onClick: () => ctrl.handleEditCategory(c) },
                                                        { label: "Delete", icon: Trash01, onClick: () => ctrl.requestDeleteCategory(c), danger: true },
                                                    ]}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Floating bulk-delete pill */}
            {ctrl.selectedRows.length > 0 && (
                <div className="fixed inset-x-0 bottom-0 flex justify-center pointer-events-none pb-8 pt-6 px-6 z-50">
                    <div className="pointer-events-auto bg-[var(--colors-bg-secondary)] border-1 border-[var(--colors-border-secondary)] rounded-[12px] shadow-[0px_12px_16px_rgba(16,24,40,0.04)] p-3 flex items-center justify-between gap-3 w-fit max-w-full">
                        <button type="button" onClick={ctrl.clearSelection}
                            className="flex items-center gap-2 px-3 py-2 bg-white border-1 border-[var(--colors-border-primary)] rounded-[8px] text-[14px] font-medium text-[var(--colors-text-primary)] hover:bg-[var(--colors-bg-secondary)] transition-colors whitespace-nowrap shrink-0">
                            {ctrl.selectedRows.length} selected
                            <XClose className="w-5 h-5 text-[var(--colors-text-quaternary)]" />
                        </button>
                        <Button variant="secondary-gray"
                            className="text-[#b42318] hover:text-[#b42318] hover:bg-[#fef3f2]"
                            leftIcon={<Trash02 className="w-5 h-5 text-[#b42318]" />}
                            onClick={() => ctrl.requestBulkDelete(ctrl.selectedRows)}>
                            Delete
                        </Button>
                    </div>
                </div>
            )}

            {ctrl.categoryModal && (
                <CategoryModal
                    existing={ctrl.categoryModal === "new" ? undefined : ctrl.categoryModal}
                    onClose={() => ctrl.setCategoryModal(null)}
                    onSubmit={ctrl.handleCategorySubmit}
                />
            )}

            {ctrl.pendingDelete && (
                <DeleteConfirmModal
                    name={ctrl.pendingDelete.kind === "row"
                        ? `"${ctrl.pendingDelete.row.name}"`
                        : `${ctrl.pendingDelete.rows.length} ${ctrl.pendingDelete.rows.length === 1 ? "category" : "categories"}`}
                    description={ctrl.pendingDelete.kind === "row"
                        ? "This category will be permanently removed. This can’t be undone."
                        : "These categories will be permanently removed. This can’t be undone."}
                    onCancel={() => ctrl.setPendingDelete(null)}
                    onConfirm={ctrl.confirmDelete}
                />
            )}
        </>
    );
}

// ─── Pagination footer (pinned at the bottom of the view-card) ───────────────

export function ClassCategoriesPagination({ ctrl }: { ctrl: CategoriesController }) {
    return (
        <Pagination
            page={ctrl.clampedPage}
            total={ctrl.sortedRows.length}
            pageSize={ctrl.pageSize}
            onPage={ctrl.setPage}
            onPageSize={n => { ctrl.setPageSize(n); ctrl.setPage(1); }}
        />
    );
}

// ─── Standalone view (legacy deep-link route) ────────────────────────────────

export function ClassCategoriesView() {
    const ctrl = useClassCategoriesController();
    return (
        <div className="flex-1 min-h-0 flex flex-col gap-6">
            <ClassCategoriesToolbar ctrl={ctrl} />
            <div className="min-h-0 bg-white border-1 border-[var(--colors-border-secondary)] rounded-[20px] flex flex-col overflow-hidden">
                <div className="flex-auto min-h-0 overflow-y-auto scrollbar-hide relative py-4">
                    <ClassCategoriesPanel ctrl={ctrl} />
                </div>
                <div className="px-6 shrink-0">
                    <ClassCategoriesPagination ctrl={ctrl} />
                </div>
            </div>
        </div>
    );
}

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
                    ? "bg-[var(--colors-secondary-600)] border-[var(--colors-secondary-600)] text-white"
                    : "bg-white border-[var(--colors-border-primary)] hover:border-[var(--colors-secondary-500)]",
            )}>
            {indeterminate ? <span className="block w-2 h-[1.5px] bg-white" />
                : checked ? <Check className="w-3 h-3" /> : null}
        </button>
    );
}

// ─── Category row avatar ──────────────────────────────────────────────────

function CategoryAvatar({ src }: { src?: string }) {
    return (
        <div className="relative w-10 h-10 rounded-full bg-[var(--colors-bg-tertiary)] shrink-0 overflow-hidden flex items-center justify-center shadow-[0px_1.235px_2.469px_-1.111px_rgba(16,24,40,0.1),0px_0.617px_1.235px_-1.111px_rgba(16,24,40,0.06)]">
            {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" className="w-full h-full object-cover rounded-full" />
                : <Image01 className="w-5 h-5 text-[var(--colors-text-tertiary)]" />
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
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[var(--colors-bg-secondary)] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[var(--colors-fg-quaternary)]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        "bg-[#fee4e2]",
                    )}>
                        <Trash04 className="w-6 h-6 text-[#d92d20]" />
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[var(--colors-text-primary)] leading-7 w-full">
                            Delete {name}?
                        </p>
                        <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5 w-full">
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
