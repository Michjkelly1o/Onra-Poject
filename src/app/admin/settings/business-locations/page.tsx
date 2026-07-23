"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations (Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma:
//   • Landing layout            — 4098:163482
//   • "Add location" dropdown   — 5630:101278
//
// Phase 1 scope (per `Brief-for-business-and-locations-module.md`):
//   ✓ Studio details container (avatar + name + Country / Currency / Time
//     zone tiles) with top-right Edit button.
//   ✓ Location & rooms container with header (title + supporting text) +
//     Search input + Filter dropdown (Active / Inactive / Archived,
//     multi-select) + "Add location" green primary dropdown (Branch / Room).
//   ✓ Table with expandable branch rows. Each branch row shows the
//     "M T W T F S S" working-days strip (closed days muted grey) + working
//     hour string + address + status badge + row-actions menu (View
//     details / Edit / Add room / Reactivate / Archive / Deactivate).
//     Enable toggle lives inside the dropdown as Reactivate + Deactivate
//     items per client review Jul 2026 — matches the memberships &
//     packages module.
//   ✓ Indented room rows under their parent branch (when expanded), each
//     with a LayoutGrid avatar + "X max" capacity subtitle + status badge
//     + row-actions menu (View details / Edit / Reactivate / Archive /
//     Deactivate).
//   ✓ Empty state when search + filter combo yields no results.
//   ✓ Every action (Edit studio, Add branch, Add room, row-Edit, row-View,
//     row-Add-room, row-Archive, toggle flip) fires a success toast as
//     a placeholder. Phase 2 wires the create/edit pages; Phase 3 wires
//     the branch detail / room modal; Phase 4 wires the proper store
//     actions + cross-module sync.
//
// Data sources:
//   • Branches      — `useAppStore(s => s.branches)`        (seed-loaded)
//   • Rooms         — `useAppStore(s => s.rooms)`           (seed-loaded)
//   • BusinessHours — `useAppStore(s => s.businessHours)`   (seed-loaded)
//   • Studio info   — `useAppStore(s => s.businessProfile)` (seed-loaded)
//
// NB — this REPLACES the legacy /admin/settings/page.tsx (the original
// prototype's Studio + Rooms + Admins form). The legacy mutations
// (updateStudio, addRoom, deleteRoom, toggleRoom, addAdmin, removeAdmin)
// are now decoupled from this surface — Phase 2 + Phase 4 will reconnect
// the new sub-pages to proper store actions.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    Edit02, Plus, ChevronDown, ChevronRight,
    DotsVertical, Building01, LayoutGrid01, Image01, Eye, Archive,
    Pencil01, Trash04, Check, XClose, SlashCircle01, RefreshCcw01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sliders } from "@/components/icons/Sliders";
import { useAppStore } from "@/lib/store";
import type { Branch, Room, BusinessHours } from "@/data/mock/_types";
import { RoomDetailModal } from "@/components/settings/rooms/RoomDetailModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { IconTooltip } from "@/components/patterns/IconTooltip";
import { ToolbarSearch } from "@/components/patterns/ToolbarSearch";
import { timezoneLabel, resolveBranchTimezone } from "@/lib/data/locales";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

// ─── Constants ──────────────────────────────────────────────────────────────

type StatusFilter = "active" | "inactive" | "archive";
const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
    { value: "active",   label: "Active"   },
    { value: "inactive", label: "Inactive" },
    { value: "archive",  label: "Archive"  },
];

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"] as const;
// JS Date.getUTCDay() — 0=Sun..6=Sat. The Figma displays Mon-first so the
// indexes line up like this:
const DOW_FOR_COL = [1, 2, 3, 4, 5, 6, 0] as const;

// ─── Page ───────────────────────────────────────────────────────────────────

export default function BusinessLocationsPage() {
    const router = useRouter();
    const pathname = usePathname();
    // Phase 3 — reads from live store-state slices so archive / delete /
    // status-toggle actions propagate immediately. (BUSINESS_HOURS stays
    // static — hours editing isn't in scope until Phase 4.)
    const branches      = useAppStore(s => s.branches);
    const rooms         = useAppStore(s => s.rooms);
    const businessHours = useAppStore(s => s.businessHours);
    const updateBranch  = useAppStore(s => s.updateBranch);
    const updateRoom    = useAppStore(s => s.updateRoom);
    const deleteBranch  = useAppStore(s => s.deleteBranch);
    const deleteRoom    = useAppStore(s => s.deleteRoom);
    const showToast     = useAppStore(s => s.showToast);

    // Studio info — single source of truth is the businessProfile slice.
    // StudioProfileFormPage writes here, so logo / name / country / currency
    // / timezone changes propagate to this landing card on the same render.
    const businessProfile = useAppStore(s => s.businessProfile);

    const [searchQuery, setSearchQuery]   = useState("");
    // Single-select status filter — same UX as the Gift Cards module. `null`
    // means "no filter applied" (show every status). Clicking the same
    // option twice clears the filter.
    const [statusFilter, setStatusFilter] = useState<StatusFilter | null>(null);
    const [expandedBranches, setExpandedBranches] = useState<Set<string>>(
        new Set(branches.filter(b => b.is_main).map(b => b.id)),
    );
    const [filterOpen, setFilterOpen]       = useState(false);
    const [addMenuOpen, setAddMenuOpen]     = useState(false);
    const [actionMenuId, setActionMenuId]   = useState<string | null>(null);

    // Confirmation modal state — drives both the toggle confirm and any
    // "Archive" / "Delete" prompts kicked off from the row action menu.
    /** Generic confirmation modal — used for archive + delete + (existing)
     *  deactivate / reactivate flows. */
    const [pendingConfirm, setPendingConfirm] = useState<{
        id: string;
        kind: "branch" | "room";
        action: "archive" | "delete" | "recover";
        label: string;
    } | null>(null);

    /** Toggle-confirmation state. The Enable toggle on each row routes
     *  through a modal first — "Are you sure you want to deactivate / reactivate
     *  [name]?" — so the admin can't accidentally flip a branch off
     *  mid-scroll. Confirm → applies the status; Cancel → no-op. */
    const [pendingToggle, setPendingToggle] = useState<{
        id: string;
        label: string;
        kind: "branch" | "room";
        currentStatus: "active" | "inactive";
    } | null>(null);

    /** Phase 3 — Room detail modal. The branch detail page lives at its
     *  own route (`/settings/branches/[id]`); rooms are smaller, so they
     *  surface as an in-page modal instead of a separate route. */
    const [roomDetailId, setRoomDetailId] = useState<string | null>(null);

    // Derived: branches that match the search + filter combo.
    const visibleBranches = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return branches.filter(b => {
            if (statusFilter && b.status !== statusFilter) return false;
            if (q && !`${b.name} ${b.address ?? ""}`.toLowerCase().includes(q)) {
                return false;
            }
            return true;
        });
    }, [branches, searchQuery, statusFilter]);

    // ── Action handlers (toast placeholders) ─────────────────────────────

    // Phase 2 — Edit / Add navigate to the dedicated full-page forms under
    // /settings/*. View details + archive remain toast placeholders for now
    // (Phase 3 wires the branch detail page + room detail modal + archive
    // confirmation flow).
    function editStudio() {
        router.push("/settings/business/edit");
    }
    function addBranch() {
        setAddMenuOpen(false);
        router.push("/settings/branches/new");
    }
    function addRoom(branchId?: string) {
        setAddMenuOpen(false);
        setActionMenuId(null);
        const target = branchId
            ? `/settings/rooms/new?branchId=${branchId}`
            : "/settings/rooms/new";
        router.push(target);
    }
    function viewBranch(b: Branch) {
        setActionMenuId(null);
        router.push(`/settings/branches/${b.id}?returnTo=${encodeURIComponent(pathname)}`);
    }
    function editBranch(b: Branch) {
        setActionMenuId(null);
        router.push(`/settings/branches/${b.id}/edit`);
    }
    function archiveBranch(b: Branch) {
        setActionMenuId(null);
        setPendingConfirm({ id: b.id, kind: "branch", action: "archive", label: b.name });
    }
    function recoverBranch(b: Branch) {
        setActionMenuId(null);
        setPendingConfirm({ id: b.id, kind: "branch", action: "recover", label: b.name });
    }
    function deleteBranchRow(b: Branch) {
        setActionMenuId(null);
        setPendingConfirm({ id: b.id, kind: "branch", action: "delete", label: b.name });
    }
    function viewRoom(r: Room) {
        setActionMenuId(null);
        setRoomDetailId(r.id);
    }
    function editRoom(r: Room) {
        setActionMenuId(null);
        router.push(`/settings/rooms/${r.id}/edit`);
    }
    function archiveRoom(r: Room) {
        setActionMenuId(null);
        setPendingConfirm({ id: r.id, kind: "room", action: "archive", label: r.name });
    }
    function recoverRoom(r: Room) {
        setActionMenuId(null);
        setPendingConfirm({ id: r.id, kind: "room", action: "recover", label: r.name });
    }
    function deleteRoomRow(r: Room) {
        setActionMenuId(null);
        setPendingConfirm({ id: r.id, kind: "room", action: "delete", label: r.name });
    }

    function applyPendingConfirm() {
        if (!pendingConfirm) return;
        const { id, kind, action, label } = pendingConfirm;
        if (kind === "branch") {
            if      (action === "archive") updateBranch(id, { status: "archive" });
            else if (action === "recover") updateBranch(id, { status: "active"  });
            else if (action === "delete")  deleteBranch(id);
        } else {
            if      (action === "archive") updateRoom(id, { status: "archive" });
            else if (action === "recover") updateRoom(id, { status: "active"  });
            else if (action === "delete")  deleteRoom(id);
        }
        const verb = action === "archive" ? "Archived" : action === "recover" ? "Recovered" : "Deleted";
        showToast(verb, `${label} has been ${verb.toLowerCase()}.`, "success",
            action === "delete" ? "trash" : action === "archive" ? "archive" : "refresh");
        setPendingConfirm(null);
    }

    /** Toggle click → open the confirmation modal. The actual mutation
     *  happens on confirm in `applyPendingToggle`. */
    function requestToggle(
        id: string,
        currentStatus: "active" | "inactive",
        label: string,
        kind: "branch" | "room",
    ) {
        setPendingToggle({ id, label, kind, currentStatus });
    }

    function applyPendingToggle() {
        if (!pendingToggle) return;
        const { id, kind, currentStatus, label } = pendingToggle;
        const next = currentStatus === "active" ? "inactive" : "active";
        if (kind === "branch") updateBranch(id, { status: next });
        else                   updateRoom(id,   { status: next });
        showToast(
            next === "active" ? "Reactivated" : "Deactivated",
            `${label} is now ${next === "active" ? "active" : "inactive"}.`,
            "success", "check",
        );
        setPendingToggle(null);
    }

    function toggleExpand(branchId: string) {
        setExpandedBranches(prev => {
            const next = new Set(prev);
            if (next.has(branchId)) next.delete(branchId);
            else next.add(branchId);
            return next;
        });
    }

    function pickStatusFilter(s: StatusFilter) {
        // Toggle behaviour — click the same option twice to clear, matching
        // the Gift Cards module convention.
        setStatusFilter(prev => prev === s ? null : s);
        setFilterOpen(false);
    }

    const isEmpty = visibleBranches.length === 0;

    return (
        <div className="flex flex-col gap-5 w-full">
            {/* ── Studio details ──────────────────────────────────────── */}
            <StudioCard
                name={businessProfile.name || "Forma Studio"}
                logoUrl={businessProfile.logoUrl}
                legalBusinessName={businessProfile.legalBusinessName}
                tradeLicenseNumber={businessProfile.tradeLicenseNumber}
                country={businessProfile.country}
                currency={businessProfile.currency}
                onEdit={editStudio}
            />

            {/* ── Location & rooms ────────────────────────────────────── */}
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-6 w-full">
                <div className="flex items-center justify-between gap-6 w-full">
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828] leading-6">
                            Location &amp; rooms
                        </p>
                        <p className="text-[14px] text-[#475467] leading-5">
                            Manage your studio locations and rooms for scheduling classes and sessions.
                        </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <ToolbarSearch
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Search location..."
                        />
                        <FilterDropdown
                            open={filterOpen}
                            onToggle={() => setFilterOpen(o => !o)}
                            onClose={() => setFilterOpen(false)}
                            value={statusFilter}
                            onPick={pickStatusFilter}
                        />
                        <AddLocationDropdown
                            open={addMenuOpen}
                            onToggle={() => setAddMenuOpen(o => !o)}
                            onClose={() => setAddMenuOpen(false)}
                            onAddBranch={addBranch}
                            onAddRoom={() => addRoom()}
                        />
                    </div>
                </div>

                {/* Table — flush, no outer border. Row separation is handled by
                    a 1-px bottom border on each row (drops on the last). */}
                <div className="flex flex-col w-full">
                    <TableHeader />
                    {isEmpty ? (
                        <div className="relative flex-1" style={{ minHeight: 400 }}>
                            <EmptyState
                                title={searchQuery ? "No locations found" : "No branches yet"}
                                subtitle={searchQuery
                                    ? `Nothing matches "${searchQuery}". Try a different search or clear the status filter.`
                                    : "Add your first branch to start scheduling classes and managing rooms."}
                                icon={Building01}
                            />
                        </div>
                    ) : (
                        visibleBranches.map(branch => {
                            const branchStatus = branch.status;
                            const branchRooms = rooms.filter(r => r.branch_id === branch.id);
                            const branchHours = businessHours.filter(h => h.branch_id === branch.id);
                            const expanded = expandedBranches.has(branch.id);
                            return (
                                <div key={branch.id}>
                                    <BranchRow
                                        branch={branch}
                                        status={branchStatus}
                                        hours={branchHours}
                                        roomCount={branchRooms.length}
                                        expanded={expanded}
                                        onToggleExpand={() => toggleExpand(branch.id)}
                                        onToggleEnable={() => requestToggle(branch.id, branchStatus === "active" ? "active" : "inactive", branch.name, "branch")}
                                        actionMenuOpen={actionMenuId === `branch:${branch.id}`}
                                        onOpenActionMenu={() => setActionMenuId(`branch:${branch.id}`)}
                                        onCloseActionMenu={() => setActionMenuId(null)}
                                        onView={() => viewBranch(branch)}
                                        onEdit={() => editBranch(branch)}
                                        onAddRoom={() => addRoom(branch.id)}
                                        onArchive={() => archiveBranch(branch)}
                                        onRecover={() => recoverBranch(branch)}
                                        onDelete={() => deleteBranchRow(branch)}
                                    />
                                    {expanded && branchRooms.map(room => {
                                        const roomStatus = room.status;
                                        return (
                                            <RoomRow
                                                key={room.id}
                                                room={room}
                                                status={roomStatus}
                                                onToggleEnable={() => requestToggle(room.id, roomStatus === "active" ? "active" : "inactive", room.name, "room")}
                                                actionMenuOpen={actionMenuId === `room:${room.id}`}
                                                onOpenActionMenu={() => setActionMenuId(`room:${room.id}`)}
                                                onCloseActionMenu={() => setActionMenuId(null)}
                                                onView={() => viewRoom(room)}
                                                onEdit={() => editRoom(room)}
                                                onArchive={() => archiveRoom(room)}
                                                onRecover={() => recoverRoom(room)}
                                                onDelete={() => deleteRoomRow(room)}
                                            />
                                        );
                                    })}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* ── Room detail modal ───────────────────────────────────── */}
            {roomDetailId && (() => {
                const room = rooms.find(r => r.id === roomDetailId);
                return room ? <RoomDetailModal room={room} onClose={() => setRoomDetailId(null)} /> : null;
            })()}

            {/* ── Toggle-confirmation modal ───────────────────────────── */}
            {pendingToggle && (() => {
                const isDeactivate = pendingToggle.currentStatus === "active";
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingToggle(null)}
                        icon={isDeactivate ? SlashCircle01 : Check}
                        tone={isDeactivate ? "danger" : "success"}
                        title={isDeactivate
                            ? `Deactivate ${pendingToggle.label}?`
                            : `Reactivate ${pendingToggle.label}?`}
                        description={isDeactivate
                            ? `Deactivating this ${pendingToggle.kind} prevents new scheduling and bookings. Existing data is preserved and you can reactivate any time.`
                            : `Reactivating this ${pendingToggle.kind} re-enables scheduling, bookings and visibility across the app.`}
                        confirmLabel={isDeactivate ? "Deactivate" : "Reactivate"}
                        onConfirm={applyPendingToggle}
                        maxWidth={400}
                    />
                );
            })()}

            {/* ── Archive / Recover / Delete confirmation modal ───────── */}
            {pendingConfirm && (() => {
                const action = pendingConfirm.action;
                const title = action === "archive" ? `Archive ${pendingConfirm.label}?`
                    : action === "recover" ? `Recover ${pendingConfirm.label}?`
                    : `Delete ${pendingConfirm.label}?`;
                const supporting = action === "archive"
                    ? `Archiving hides this ${pendingConfirm.kind} from active views. All data is preserved and you can recover it later.`
                    : action === "recover"
                    ? `Recovering brings this ${pendingConfirm.kind} back into the active list.`
                    : `Deleting this ${pendingConfirm.kind} permanently removes it from the prototype. This can't be undone.`;
                const confirmLabel = action === "archive" ? "Archive"
                    : action === "recover" ? "Recover"
                    : "Delete";
                const destructive = action === "delete";
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingConfirm(null)}
                        icon={destructive ? Trash04 : Archive}
                        tone={destructive ? "danger" : "success"}
                        title={title}
                        description={supporting}
                        confirmLabel={confirmLabel}
                        onConfirm={applyPendingConfirm}
                        maxWidth={400}
                    />
                );
            })()}
        </div>
    );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function StudioCard({ name, logoUrl, legalBusinessName, tradeLicenseNumber, country, currency, onEdit }: {
    name: string;
    logoUrl?: string;
    legalBusinessName: string;
    tradeLicenseNumber: string;
    country: string;
    currency: string;
    onEdit: () => void;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex items-center gap-6 w-full">
            <StudioAvatar logoUrl={logoUrl} />
            <div className="flex-1 min-w-0 flex flex-col gap-3">
                <p className="text-[20px] font-semibold text-[#101828] leading-[30px]">
                    {name}
                </p>
                {/* Studio-wide "Time zone" tile removed per client Jul 2026 —
                    each branch now owns its own timezone (auto-derived from
                    address). Legal business name + Trade license line up
                    under Country + Currency in the same 2-col grid. */}
                <div className="grid grid-cols-2 gap-x-3 gap-y-3 w-full">
                    <InfoTile label="Country"   value={country || "—"} />
                    <InfoTile label="Currency"  value={currency || "—"} />
                    <InfoTile label="Legal business name"  value={legalBusinessName || "—"} />
                    <InfoTile label="Trade license number" value={tradeLicenseNumber || "—"} />
                </div>
            </div>
            <Button
                variant="secondary-gray"
                size="md"
                leftIcon={<Edit02 className="w-5 h-5" />}
                onClick={onEdit}
            >
                Edit
            </Button>
        </div>
    );
}

function StudioAvatar({ logoUrl }: { logoUrl?: string }) {
    return (
        <div
            className="relative w-[96px] h-[96px] rounded-full bg-[#f2f4f7] border-4 border-white shrink-0 overflow-hidden flex items-center justify-center"
            style={{
                boxShadow:
                    "0px 12px 16px -4px rgba(16,24,40,0.08), 0px 4px 6px -2px rgba(16,24,40,0.03)",
            }}
        >
            {logoUrl
                ? <img src={logoUrl} alt="" className="w-full h-full object-cover rounded-full" />
                : <Image01 className="w-12 h-12 text-[#98a2b3]" />
            }
            <div className="absolute inset-0 rounded-full border border-[rgba(0,0,0,0.08)] pointer-events-none" />
        </div>
    );
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">
                {value}
            </p>
        </div>
    );
}

// ─── Header controls ────────────────────────────────────────────────────────

function FilterDropdown({ open, onToggle, onClose, value, onPick }: {
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    value: StatusFilter | null;
    onPick: (s: StatusFilter) => void;
}) {
    const ref = useClickOutside<HTMLDivElement>(onClose, open);
    return (
        <div ref={ref} className="relative">
            {/* Icon-only filter trigger (client 2026-07-21) — matches the
                shared ToolbarFilter chrome but keeps its own popup below
                since it's a self-contained dropdown-embedded button. */}
            <IconTooltip label="Filter" disabled={open}>
                <Button
                    variant="secondary-gray"
                    size="icon"
                    aria-label="Filter"
                    onClick={onToggle}
                >
                    <span className="relative inline-flex">
                        <Sliders className="w-5 h-5" />
                        {value !== null && (
                            <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" aria-hidden />
                        )}
                    </span>
                </Button>
            </IconTooltip>
            {open && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[160px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-2">
                    <p className="px-5 pt-1 pb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-[#98a2b3] leading-4">Status</p>
                    {STATUS_OPTIONS.map(o => {
                        const active = value === o.value;
                        return (
                            <button
                                key={o.value}
                                type="button"
                                onClick={() => onPick(o.value)}
                                className={cn(
                                    "w-full flex items-center justify-between text-left px-5 py-3 text-[15px] font-medium transition-colors",
                                    active
                                        ? "bg-[#f9fafb] text-[#101828]"
                                        : "text-[#344054] hover:bg-[#f9fafb]",
                                )}
                            >
                                {o.label}
                                {active && <Check className="w-4 h-4 text-[#658774]" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function AddLocationDropdown({ open, onToggle, onClose, onAddBranch, onAddRoom }: {
    open: boolean;
    onToggle: () => void;
    onClose: () => void;
    onAddBranch: () => void;
    onAddRoom: () => void;
}) {
    const ref = useClickOutside<HTMLDivElement>(onClose, open);
    return (
        <div ref={ref} className="relative">
            <Button
                variant="primary"
                size="md"
                leftIcon={<Plus className="w-5 h-5" />}
                onClick={onToggle}
            >
                Add location
            </Button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col py-1">
                    <MenuItem icon={<Building01 className="w-4 h-4 text-[#667085]" />} label="Branch" onClick={onAddBranch} />
                    <MenuItem icon={<LayoutGrid01 className="w-4 h-4 text-[#667085]" />} label="Room" onClick={onAddRoom} />
                </div>
            )}
        </div>
    );
}

function MenuItem({ icon, label, onClick, danger = false }: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    danger?: boolean;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-3 px-3 py-2 mx-1 rounded-[6px] hover:bg-[#f9fafb] text-left"
        >
            {icon}
            <span className={cn(
                "text-[14px] font-medium",
                danger ? "text-[#d92d20]" : "text-[#344054]",
            )}>
                {label}
            </span>
        </button>
    );
}

// ─── Table chrome ───────────────────────────────────────────────────────────

function TableHeader() {
    // Enable-toggle column was removed Jul 2026 per client review — the
    // action moved into the row-actions dropdown (Deactivate / Reactivate
    // items) so this module matches the memberships & packages module.
    // Same requestToggle → applyPendingToggle flow, just wired into the
    // menu instead of a dedicated column.
    return (
        <div className="grid grid-cols-[280px_minmax(160px,1fr)_minmax(140px,1fr)_minmax(180px,1.4fr)_120px_56px] items-center h-[44px] border-b border-[#e4e7ec] bg-white">
            <TableHeaderCell className="pl-8 pr-6">Location name</TableHeaderCell>
            <TableHeaderCell className="px-6">Working days</TableHeaderCell>
            <TableHeaderCell className="px-6">Working hour</TableHeaderCell>
            <TableHeaderCell className="px-6">Address</TableHeaderCell>
            <TableHeaderCell className="px-6">Status</TableHeaderCell>
            <TableHeaderCell className="px-2" />
        </div>
    );
}

function TableHeaderCell({ children, className }: { children?: React.ReactNode; className?: string }) {
    return (
        <p className={cn("text-[12px] font-medium text-[#475467] leading-[18px] truncate", className)}>
            {children}
        </p>
    );
}

// ─── Rows ──────────────────────────────────────────────────────────────────

function BranchRow({
    branch, status, hours, roomCount, expanded, onToggleExpand, onToggleEnable,
    actionMenuOpen, onOpenActionMenu, onCloseActionMenu,
    onView, onEdit, onAddRoom, onArchive, onRecover, onDelete,
}: {
    branch: Branch;
    status: "active" | "inactive" | "archive";
    hours: BusinessHours[];
    roomCount: number;
    expanded: boolean;
    onToggleExpand: () => void;
    onToggleEnable: () => void;
    actionMenuOpen: boolean;
    onOpenActionMenu: () => void;
    onCloseActionMenu: () => void;
    onView: () => void;
    onEdit: () => void;
    onAddRoom: () => void;
    onArchive: () => void;
    onRecover: () => void;
    onDelete: () => void;
}) {
    const ref = useClickOutside<HTMLDivElement>(onCloseActionMenu, actionMenuOpen);
    return (
        <div
            onClick={onView}
            className="grid grid-cols-[280px_minmax(160px,1fr)_minmax(140px,1fr)_minmax(180px,1.4fr)_120px_56px] items-center h-[72px] border-b border-[#e4e7ec] hover:bg-[#f9fafb] transition-colors cursor-pointer">
            {/* Col 1 — Location name (with expand chevron) */}
            <div className="flex items-center gap-2 pl-3 pr-6 h-full">
                <button
                    type="button"
                    onClick={e => { e.stopPropagation(); onToggleExpand(); }}
                    className="w-6 h-6 flex items-center justify-center text-[#475467] hover:bg-[#f9fafb] rounded-[6px] shrink-0"
                    aria-label={expanded ? "Collapse rooms" : "Expand rooms"}
                >
                    {expanded
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />
                    }
                </button>
                <div className="w-10 h-10 rounded-full bg-[#f2f4f7] border-1 border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0 overflow-hidden">
                    {branch.image_url
                        ? <img src={branch.image_url} alt="" className="w-full h-full object-cover" />
                        : <Building01 className="w-5 h-5 text-[#475467]" />
                    }
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5 truncate">
                        {branch.name}
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5 truncate">
                        {emailFromBranchName(branch.name)}
                    </p>
                </div>
            </div>
            {/* Col 2 — Working days */}
            <div className="px-6">
                <WorkingDaysStrip hours={hours} />
            </div>
            {/* Col 3 — Working hour */}
            <div className="px-6">
                <p className="text-[14px] text-[#101828] leading-5 truncate">
                    {primaryHoursDisplay(hours)}
                </p>
            </div>
            {/* Col 4 — Address + timezone. Branch owns its own IANA zone
                (auto-derived from country + city) — surfaced here so
                multi-timezone studios can see "Riyadh vs Dubai" at a
                glance without opening each branch's detail page. */}
            <div className="px-6 flex flex-col gap-0.5">
                <p className="text-[14px] text-[#101828] leading-5 line-clamp-2">
                    {branch.address ?? "—"}
                </p>
                <p className="text-[12px] text-[#667085] leading-4 truncate">
                    {timezoneLabel(branch.timezone ?? resolveBranchTimezone(branch.country, branch.state, branch.city))}
                </p>
            </div>
            {/* Col 5 — Status */}
            <div className="px-6">
                <StatusBadge type="branch" status={status} size="sm" />
            </div>
            {/* Col 6 — Actions (Enable moved into the dropdown Jul 2026) */}
            <div ref={ref} onClick={e => e.stopPropagation()} className="relative px-2 flex justify-end">
                <button
                    type="button"
                    onClick={actionMenuOpen ? onCloseActionMenu : onOpenActionMenu}
                    className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors"
                    aria-label="Open actions"
                >
                    <DotsVertical className="w-4 h-4 text-[#667085]" />
                </button>
                {actionMenuOpen && (
                    <BranchActionMenu
                        status={status}
                        canDelete={roomCount === 0}
                        onView={onView}
                        onEdit={onEdit}
                        onAddRoom={onAddRoom}
                        onToggleEnable={onToggleEnable}
                        onArchive={onArchive}
                        onRecover={onRecover}
                        onDelete={onDelete}
                    />
                )}
            </div>
        </div>
    );
}

function RoomRow({
    room, status, onToggleEnable, actionMenuOpen, onOpenActionMenu, onCloseActionMenu,
    onView, onEdit, onArchive, onRecover, onDelete,
}: {
    room: Room;
    status: "active" | "inactive" | "archive";
    onToggleEnable: () => void;
    actionMenuOpen: boolean;
    onOpenActionMenu: () => void;
    onCloseActionMenu: () => void;
    onView: () => void;
    onEdit: () => void;
    onArchive: () => void;
    onRecover: () => void;
    onDelete: () => void;
}) {
    const ref = useClickOutside<HTMLDivElement>(onCloseActionMenu, actionMenuOpen);
    return (
        <div
            onClick={onView}
            className="grid grid-cols-[280px_minmax(160px,1fr)_minmax(140px,1fr)_minmax(180px,1.4fr)_120px_56px] items-center h-[72px] border-b border-[#e4e7ec] bg-white hover:bg-[#f9fafb] transition-colors cursor-pointer">
            {/* Col 1 — Room name (indented under branch) */}
            <div className="flex items-center gap-3 pl-[60px] pr-6 h-full">
                <div className="w-10 h-10 rounded-full bg-[#f2f4f7] border border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0">
                    <LayoutGrid01 className="w-5 h-5 text-[#475467]" />
                </div>
                <div className="flex flex-col min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5 truncate">
                        {room.name}
                    </p>
                    <p className="text-[14px] text-[#475467] leading-5 truncate">
                        {room.capacity} max
                    </p>
                </div>
            </div>
            {/* Col 2-4 empty for rooms */}
            <div className="px-6" />
            <div className="px-6" />
            <div className="px-6" />
            {/* Col 5 — Status */}
            <div className="px-6">
                <StatusBadge type="branch" status={status} size="sm" />
            </div>
            {/* Col 6 — Actions (Enable moved into the dropdown Jul 2026) */}
            <div ref={ref} onClick={e => e.stopPropagation()} className="relative px-2 flex justify-end">
                <button
                    type="button"
                    onClick={actionMenuOpen ? onCloseActionMenu : onOpenActionMenu}
                    className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors"
                    aria-label="Open actions"
                >
                    <DotsVertical className="w-4 h-4 text-[#667085]" />
                </button>
                {actionMenuOpen && (
                    <RoomActionMenu
                        status={status}
                        onView={onView}
                        onEdit={onEdit}
                        onToggleEnable={onToggleEnable}
                        onArchive={onArchive}
                        onRecover={onRecover}
                        onDelete={onDelete}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Row action menus ──────────────────────────────────────────────────────

function BranchActionMenu({
    status, canDelete, onView, onEdit, onAddRoom, onToggleEnable, onArchive, onRecover, onDelete,
}: {
    status: "active" | "inactive" | "archive";
    /** True when the branch has zero rooms — delete is only offered then. */
    canDelete: boolean;
    onView: () => void;
    onEdit: () => void;
    onAddRoom: () => void;
    /** Enable toggle moved into this menu Jul 2026 (was a dedicated
     *  column). Reactivate/Deactivate items surface conditionally
     *  based on `status`; the parent still routes through
     *  `requestToggle → applyPendingToggle` for the confirmation
     *  modal, so all existing state-change logic is unchanged. */
    onToggleEnable: () => void;
    onArchive: () => void;
    onRecover: () => void;
    onDelete: () => void;
}) {
    const archived = status === "archive";
    return (
        <div className="absolute right-2 top-[calc(100%+4px)] z-30 w-[200px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col py-1">
            <MenuItem icon={<Eye className="w-4 h-4 text-[#667085]" />}        label="View details" onClick={onView} />
            {!archived && (
                <>
                    <MenuItem icon={<Pencil01 className="w-4 h-4 text-[#667085]" />} label="Edit branch" onClick={onEdit} />
                    <MenuItem icon={<Plus className="w-4 h-4 text-[#667085]" />}     label="Add room"    onClick={onAddRoom} />

                    {status === "inactive" && (
                        <MenuItem icon={<Check className="w-4 h-4 text-[#067647]" />}  label="Reactivate"  onClick={onToggleEnable} />
                    )}
                    <MenuItem icon={<Archive className="w-4 h-4 text-[#667085]" />}  label="Archive"     onClick={onArchive} />
                    {status === "active" && (
                        <MenuItem icon={<SlashCircle01 className="w-4 h-4 text-[#d92d20]" />} label="Deactivate" onClick={onToggleEnable} danger />
                    )}
                </>
            )}
            {archived && (
                <MenuItem icon={<RefreshCcw01 className="w-4 h-4 text-[#667085]" />} label="Recover" onClick={onRecover} />
            )}
            {canDelete && (
                <MenuItem icon={<Trash04 className="w-4 h-4 text-[#d92d20]" />} label="Delete" onClick={onDelete} danger />
            )}
        </div>
    );
}

function RoomActionMenu({
    status, onView, onEdit, onToggleEnable, onArchive, onRecover, onDelete,
}: {
    status: "active" | "inactive" | "archive";
    onView: () => void;
    onEdit: () => void;
    /** Enable toggle moved into this menu Jul 2026 (was a dedicated
     *  column). Same requestToggle → applyPendingToggle flow, so all
     *  existing state-change logic is unchanged. */
    onToggleEnable: () => void;
    onArchive: () => void;
    onRecover: () => void;
    onDelete: () => void;
}) {
    const archived = status === "archive";
    return (
        <div className="absolute right-2 top-[calc(100%+4px)] z-30 w-[180px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] flex flex-col py-1">
            <MenuItem icon={<Eye className="w-4 h-4 text-[#667085]" />}      label="View details" onClick={onView} />
            {!archived && (
                <>
                    <MenuItem icon={<Pencil01 className="w-4 h-4 text-[#667085]" />} label="Edit room" onClick={onEdit} />
                    {status === "inactive" && (
                        <MenuItem icon={<Check className="w-4 h-4 text-[#067647]" />}  label="Reactivate" onClick={onToggleEnable} />
                    )}
                    <MenuItem icon={<Archive className="w-4 h-4 text-[#667085]" />}  label="Archive"   onClick={onArchive} />
                    {status === "active" && (
                        <MenuItem icon={<SlashCircle01 className="w-4 h-4 text-[#d92d20]" />} label="Deactivate" onClick={onToggleEnable} danger />
                    )}
                </>
            )}
            {archived && (
                <>
                    <MenuItem icon={<RefreshCcw01 className="w-4 h-4 text-[#667085]" />} label="Recover" onClick={onRecover} />
                    <MenuItem icon={<Trash04 className="w-4 h-4 text-[#d92d20]" />}      label="Delete"  onClick={onDelete} danger />
                </>
            )}
        </div>
    );
}

// ─── Display primitives ────────────────────────────────────────────────────

/** Renders the "M T W T F S S" working-days strip. Closed days render as
 *  muted grey (#98a2b3) — reads as "off" without the alarm-red the client
 *  flagged in Jul 2026. Falls back to muted-grey letters if no
 *  business_hours exist for the branch yet. */
function WorkingDaysStrip({ hours }: { hours: BusinessHours[] }) {
    const byDow = new Map(hours.map(h => [h.day_of_week, h]));
    return (
        <div className="flex items-center gap-2">
            {DAY_LETTERS.map((letter, i) => {
                const dow = DOW_FOR_COL[i];
                const h = byDow.get(dow);
                const closed = !h || h.is_closed;
                return (
                    <span
                        key={i}
                        className={cn(
                            "text-[14px] font-semibold leading-5",
                            closed ? "text-[#98a2b3]" : "text-[#101828]",
                        )}
                    >
                        {letter}
                    </span>
                );
            })}
        </div>
    );
}

/** First-open-day hours string (e.g. "07:00 AM - 08:00 PM"). Falls back to
 *  "—" if every day is closed. Branches typically have a uniform weekday
 *  window so this single string is a good summary for the table. */
function primaryHoursDisplay(hours: BusinessHours[]): string {
    const open = hours.find(h => !h.is_closed);
    if (!open) return "—";
    return `${to12h(open.open_time)} - ${to12h(open.close_time)}`;
}

function to12h(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hr = ((h + 11) % 12) + 1;
    return `${String(hr).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}

/** Cosmetic — derives a synthetic branch email from the branch name so the
 *  Figma's `forma.south@untitled.ui` subtitle has a sensible placeholder
 *  until Phase 4 adds `email` to the seed proper. */
function emailFromBranchName(name: string): string {
    const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, ".")
        .slice(0, 24);
    return `${slug}@formastudio.ae`;
}

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean;
    onChange: () => void;
    ariaLabel: string;
}) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            onClick={onChange}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}
        >
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Hooks ─────────────────────────────────────────────────────────────────

/** Closes the floating menu when the user clicks outside the referenced
 *  container. `enabled` short-circuits the listener while the menu is
 *  closed so we don't run mousedown handlers for no reason. */
function useClickOutside<T extends HTMLElement>(close: () => void, enabled: boolean) {
    const ref = useRef<T | null>(null);
    useEffect(() => {
        if (!enabled) return;
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) close();
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [close, enabled]);
    return ref;
}

