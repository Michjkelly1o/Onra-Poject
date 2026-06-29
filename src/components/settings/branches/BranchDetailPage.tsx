"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Branch detail
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • 4098-210481 — Sidebar (avatar/initial · status badge · key fields · actions)
//   • 6655-193693 — Main content card (Branch details + Rooms table)
//
// Chrome mirrors the canonical StaffDetailPage layout 1:1:
//   • Header — h-[72px], × close + "Branch details"
//   • Body  — px-6 py-6 outer, h-[832px] flex row
//       LEFT — w-[320px] sidebar card
//                · 88×88 avatar (image or building initial)
//                · status badge overlapped top-right of avatar
//                · branch name + email subtitle
//                · stacked metadata (Email / Phone / Working days / Working hours / Address)
//                · footer "Branch actions" — status-aware buttons
//       MAIN — flex-1 content card with single underline tab "Details"
//                · Branch details section (2-col grid + working hours stack)
//                · Rooms table (Room name · Status · enable toggle · actions menu)
//
// Status-aware sidebar actions (mirrors `/admin/settings` row menu rules):
//   • active   → Edit · Add room · Archive · Deactivate · Delete (only if 0 rooms)
//   • inactive → Edit · Add room · Reactivate · Archive · Delete (only if 0 rooms)
//   • archive  → Recover · Delete (only if 0 rooms)
//
// Confirm modal colors match the Products page (canonical reference):
//   • archive / recover / reactivate → green tone (bg-[#e9fff3], primary button)
//   • deactivate / delete           → red tone (bg-[#fee4e2], destructive button)

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, Edit02, Archive, Trash01, SlashCircle01, RefreshCcw01, Plus,
    Check, Building01, LayoutGrid01, Eye, Pencil01, DotsVertical,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { DetailPageTabs } from "@/components/patterns/DetailPageTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore } from "@/lib/store";
import type { Branch, Room, BusinessHours } from "@/data/mock/_types";
import { RoomDetailModal } from "@/components/settings/rooms/RoomDetailModal";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ─── Day labels (Mon → Sun display order) ────────────────────────────────────

const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_SHORT  = ["M", "T", "W", "T", "F", "S", "S"] as const;
const DOW_ORDER  = [1, 2, 3, 4, 5, 6, 0] as const;

// ─── Confirm modal ────────────────────────────────────────────────────────────

type ConfirmKind = "archive" | "recover" | "deactivate" | "reactivate" | "delete";

const CONFIRM_CFG: Record<ConfirmKind, {
    title: (subject: string) => string;
    description: () => string;
    confirmLabel: string;
    destructive: boolean;
    Icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
}> = {
    archive: {
        title: s => `Archive ${s}?`,
        description: () => "Archived branches are hidden from the default lists but kept for audit. You can recover later.",
        confirmLabel: "Archive",
        destructive: false,
        Icon: Archive,
        iconBg: "bg-[#e9fff3]",
        iconColor: "text-[#658774]",
    },
    recover: {
        title: s => `Recover ${s}?`,
        description: () => "The branch returns to Active and rooms become available for scheduling again.",
        confirmLabel: "Recover",
        destructive: false,
        Icon: RefreshCcw01,
        iconBg: "bg-[#e9fff3]",
        iconColor: "text-[#658774]",
    },
    deactivate: {
        title: s => `Deactivate ${s}?`,
        description: () => "Scheduling is paused on this branch. All historical data is kept and you can reactivate later.",
        confirmLabel: "Deactivate",
        destructive: true,
        Icon: SlashCircle01,
        iconBg: "bg-[#fee4e2]",
        iconColor: "text-[#d92d20]",
    },
    reactivate: {
        title: s => `Reactivate ${s}?`,
        description: () => "Scheduling resumes on this branch and the row returns to Active.",
        confirmLabel: "Reactivate",
        destructive: false,
        Icon: Check,
        iconBg: "bg-[#e9fff3]",
        iconColor: "text-[#658774]",
    },
    delete: {
        title: s => `Delete ${s}?`,
        description: () => "This permanently removes the branch from the prototype. Only allowed when no rooms remain.",
        confirmLabel: "Delete",
        destructive: true,
        Icon: Trash01,
        iconBg: "bg-[#fee4e2]",
        iconColor: "text-[#d92d20]",
    },
};

// Local ConfirmModal removed — call sites use the canonical
// `<ConfirmModal>` from `@/components/modals/ConfirmModal`, driven by
// the CONFIRM_CFG lookup above.

// ─── Sidebar action button (mirrors StaffDetailPage ActionBtn) ───────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    onClick?: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors text-left",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}
        >
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Sidebar (320px card, mirrors StaffDetailPage) ───────────────────────────

function Sidebar({
    branch, hours, canDelete, onAction, onEdit, onAddRoom,
}: {
    branch: Branch;
    hours: BusinessHours[];
    canDelete: boolean;
    onAction: (kind: ConfirmKind) => void;
    onEdit: () => void;
    onAddRoom: () => void;
}) {
    const isActive   = branch.status === "active";
    const isInactive = branch.status === "inactive";
    const isArchive  = branch.status === "archive";

    return (
        <aside className="w-[320px] shrink-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-6 flex-1">
                    {/* Avatar + status badge overlap */}
                    <div className="relative">
                        <div className="w-[88px] h-[88px] rounded-full bg-[#f2f4f7] border-1 border-[#e4e7ec] flex items-center justify-center overflow-hidden">
                            {branch.image_url
                                ? <img src={branch.image_url} alt={branch.name} className="w-full h-full object-cover" />
                                : <Building01 className="w-10 h-10 text-[#475467]" />
                            }
                        </div>
                        <div className="absolute top-0 right-0">
                            <StatusBadge type="branch" status={branch.status} />
                        </div>
                    </div>

                    {/* Name + email */}
                    <div className="flex flex-col gap-1">
                        <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{branch.name}</h2>
                        <p className="text-[14px] text-[#667085] truncate">{branch.email ?? emailFromName(branch.name)}</p>
                    </div>

                    {/* Metadata stack — mirrors Figma 4098-210481 +
                        6655:193700 (Location scope row addition). */}
                    <div className="flex flex-col gap-4">
                        <Metadata label="Location scope" value={branch.kind === "spa" ? "Spa" : "Club"} />
                        <Metadata label="Email"          value={branch.email ?? emailFromName(branch.name)} />
                        <Metadata label="Phone number"   value={branch.phone ?? "—"} />
                        <Metadata label="Working days"   value={<WorkingDays hours={hours} />} />
                        <Metadata label="Working hours"  value={primaryHoursDisplay(hours)} />
                        <Metadata label="Address"        value={branch.address ?? "—"} />
                    </div>
                </div>

                {/* Actions footer */}
                <div className="px-6 pb-6 pt-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Branch actions</p>
                    <div className="flex flex-col gap-4">
                        {isActive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />}        label="Edit branch"       onClick={onEdit} />
                                {/* Spa branches are room-less by design — recovery
                                    sessions aren't room-scoped. Hide the affordance
                                    so admins don't try to create rooms that the
                                    rest of the app expects to be absent. */}
                                {branch.kind !== "spa" && (
                                    <ActionBtn icon={<Plus className="w-5 h-5" />}      label="Add room"           onClick={onAddRoom} />
                                )}
                                <ActionBtn icon={<Archive className="w-5 h-5" />}       label="Archive branch"     onClick={() => onAction("archive")} />
                                <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label="Deactivate branch" danger onClick={() => onAction("deactivate")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete branch" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                        {isInactive && (
                            <>
                                <ActionBtn icon={<Edit02 className="w-5 h-5" />}  label="Edit branch"       onClick={onEdit} />
                                <ActionBtn icon={<Plus className="w-5 h-5" />}    label="Add room"           onClick={onAddRoom} />
                                <ActionBtn icon={<Check className="w-5 h-5" />}   label="Reactivate branch"  onClick={() => onAction("reactivate")} />
                                <ActionBtn icon={<Archive className="w-5 h-5" />} label="Archive branch"     onClick={() => onAction("archive")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete branch" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                        {isArchive && (
                            <>
                                <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover branch" onClick={() => onAction("recover")} />
                                {canDelete && (
                                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label="Delete branch" danger onClick={() => onAction("delete")} />
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
}

function Metadata({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] break-words">{value}</div>
        </div>
    );
}

/** "M  T  W  T  F  S  S" — closed days are red. Mirrors Figma 6655-193718. */
function WorkingDays({ hours }: { hours: BusinessHours[] }) {
    return (
        <p className="font-semibold text-[16px] leading-[24px] text-[#101828]">
            {DOW_ORDER.map((dow, i) => {
                const h = hours.find(r => r.day_of_week === dow);
                const closed = !h || h.is_closed;
                return (
                    <span
                        key={dow}
                        className={cn(
                            "mr-[10px] last:mr-0",
                            closed ? "text-[#b42318]" : "text-[#101828]",
                        )}
                    >
                        {DAY_SHORT[i]}
                    </span>
                );
            })}
        </p>
    );
}

// Local TabBtn removed — uses canonical `<DetailPageTabs>` from
// `@/components/patterns/DetailPageTabs`.

// ─── Detail field (2-col grid cell — Figma 6655-193702) ──────────────────────

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] leading-6 break-words">{value}</div>
        </div>
    );
}

// ─── Details tab — mirrors Figma 6655-193693 main content ────────────────────

function DetailsTab({
    branch, hours, rooms, roomActionsId, onToggleRoomActions, onCloseRoomActions,
    onRoomView, onRoomEdit, onRoomAction, onRoomToggle,
}: {
    branch: Branch;
    hours: BusinessHours[];
    rooms: Room[];
    roomActionsId: string | null;
    onToggleRoomActions: (id: string) => void;
    onCloseRoomActions: () => void;
    onRoomView: (r: Room) => void;
    onRoomEdit: (r: Room) => void;
    onRoomAction: (r: Room, a: ConfirmKind) => void;
    onRoomToggle: (r: Room) => void;
}) {
    return (
        <div className="px-6 pb-6 flex flex-col gap-8">
            {/* Branch details */}
            <section className="flex flex-col gap-3">
                <p className="text-[16px] font-medium text-[#667085] leading-6">Branch details</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                    <DetailField label="Branch name"    value={branch.name} />
                    <DetailField label="Location scope" value={branch.kind === "spa" ? "Spa" : "Club"} />
                    <DetailField label="Email"        value={branch.email ?? emailFromName(branch.name)} />
                    <DetailField label="Phone number" value={branch.phone ?? "—"} />
                    <DetailField label="Working days" value={<WorkingDays hours={hours} />} />
                    <div className="col-span-1">
                        <DetailField
                            label="Working hours"
                            value={
                                <div className="flex flex-col gap-0.5 mt-0.5">
                                    {DOW_ORDER.map((dow, i) => {
                                        const h = hours.find(r => r.day_of_week === dow);
                                        const closed = !h || h.is_closed;
                                        return (
                                            <div key={dow} className="flex items-center gap-3">
                                                <p className="font-medium text-[16px] text-[#101828] leading-6 w-[100px]">{DAY_LABELS[i]}</p>
                                                <p className={cn(
                                                    "text-[14px] leading-5",
                                                    closed ? "text-[#b42318]" : "text-[#667085]",
                                                )}>
                                                    {closed ? "(Closed)" : `(${to12h(h!.open_time)} - ${to12h(h!.close_time)})`}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            }
                        />
                    </div>
                    <DetailField label="Address" value={branch.address ?? "—"} />
                </div>
            </section>

            {/* Rooms table — Figma 6655-193745. Per the Figma it's a flush
                list (no outer border, no header fill) — the only chrome is
                the `divide-y` between rows.
                Hidden entirely for Spa-kind branches: Spa locations are
                room-less by design (recovery services aren't room-scoped)
                so the section + "Add room" affordance both disappear from
                the detail page. */}
            {branch.kind !== "spa" && (
            <section className="flex flex-col gap-3">
                <p className="text-[16px] font-medium text-[#667085] leading-6">Rooms</p>
                <div className="w-full">
                    <div className="grid grid-cols-[1fr_140px_88px_64px] border-b border-[#e4e7ec]">
                        <div className="px-0 py-3 text-[12px] font-medium text-[#475467]">Room name</div>
                        <div className="px-6 py-3 text-[12px] font-medium text-[#475467]">Status</div>
                        <div className="px-6 py-3" />
                        <div className="px-0 py-3" />
                    </div>
                    {rooms.length === 0 ? (
                        <div className="py-12 text-center">
                            <p className="text-[14px] text-[#475467]">No rooms in this branch yet.</p>
                        </div>
                    ) : rooms.map((room, idx) => {
                        const isLast = idx === rooms.length - 1;
                        return (
                            <div
                                key={room.id}
                                onClick={() => onRoomView(room)}
                                className={cn(
                                    "grid grid-cols-[1fr_140px_88px_64px] items-center bg-white hover:bg-[#f9fafb] transition-colors cursor-pointer",
                                    !isLast && "border-b border-[#e4e7ec]",
                                )}
                            >
                                {/* Col 1 — room name + capacity */}
                                <div className="flex items-center gap-3 pl-0 pr-6 py-4 min-w-0">
                                    <div className="w-10 h-10 rounded-full bg-[#f2f4f7] border-1 border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0">
                                        <LayoutGrid01 className="w-5 h-5 text-[#475467]" />
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <p className="text-[14px] font-medium text-[#101828] leading-5 truncate">{room.name}</p>
                                        <p className="text-[14px] text-[#475467] leading-5">{room.capacity} max</p>
                                    </div>
                                </div>
                                {/* Col 2 — status */}
                                <div className="px-6 py-4">
                                    <StatusBadge type="branch" status={room.status} size="sm" />
                                </div>
                                {/* Col 3 — enable toggle (only when not archived) */}
                                <div onClick={e => e.stopPropagation()} className="px-6 py-4">
                                    {room.status !== "archive" ? (
                                        <Toggle
                                            on={room.status === "active"}
                                            onChange={() => onRoomToggle(room)}
                                            ariaLabel={`Toggle ${room.name}`}
                                        />
                                    ) : null}
                                </div>
                                {/* Col 4 — actions */}
                                <div onClick={e => e.stopPropagation()} className="relative px-0 py-4 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => onToggleRoomActions(room.id)}
                                        onBlur={() => setTimeout(onCloseRoomActions, 100)}
                                        className="w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#f2f4f7] transition-colors"
                                        aria-label="Open actions"
                                    >
                                        <DotsVertical className="w-4 h-4 text-[#667085]" />
                                    </button>
                                    {roomActionsId === room.id && (
                                        <div className="absolute right-2 top-[calc(100%-4px)] z-30 w-[200px] bg-white border-1 border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1">
                                            <RoomMenuItem icon={<Eye className="w-4 h-4 text-[#667085]" />}      label="View details" onClick={() => onRoomView(room)} />
                                            <RoomMenuItem icon={<Pencil01 className="w-4 h-4 text-[#667085]" />} label="Edit room"     onClick={() => onRoomEdit(room)} />
                                            {room.status !== "archive"
                                                ? <RoomMenuItem icon={<Archive className="w-4 h-4 text-[#667085]" />}     label="Archive"  onClick={() => onRoomAction(room, "archive")} />
                                                : <RoomMenuItem icon={<RefreshCcw01 className="w-4 h-4 text-[#667085]" />} label="Recover"  onClick={() => onRoomAction(room, "recover")} />
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
            )}
        </div>
    );
}

function RoomMenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onMouseDown={onClick}
            className="w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-[6px] hover:bg-[#f9fafb] text-left"
        >
            {icon}
            <span className="text-[14px] font-medium text-[#344054]">{label}</span>
        </button>
    );
}

// ─── Toggle (local — same shape as the rooms table toggle in /admin/settings) ─

function Toggle({ on, onChange, ariaLabel }: { on: boolean; onChange: () => void; ariaLabel: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            aria-label={ariaLabel}
            onClick={onChange}
            className={cn(
                "relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5 shrink-0",
                on ? "bg-[#658774] justify-end" : "bg-[#f2f4f7] justify-start",
            )}
        >
            <span className="w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_rgba(16,24,40,0.1),0px_1px_2px_rgba(16,24,40,0.06)]" />
        </button>
    );
}

// ─── Top-level page ──────────────────────────────────────────────────────────

export interface BranchDetailPageProps {
    branchId: string;
    returnTo?: string;
}

export function BranchDetailPage({ branchId, returnTo = "/admin/settings/business-locations" }: BranchDetailPageProps) {
    const router = useRouter();
    const pathname = usePathname();
    const branches       = useAppStore(s => s.branches);
    const rooms          = useAppStore(s => s.rooms);
    const businessHours  = useAppStore(s => s.businessHours);
    const updateBranch   = useAppStore(s => s.updateBranch);
    const deleteBranchFn = useAppStore(s => s.deleteBranch);
    const updateRoom     = useAppStore(s => s.updateRoom);
    const deleteRoomFn   = useAppStore(s => s.deleteRoom);
    const showToast      = useAppStore(s => s.showToast);

    const branch = branches.find(b => b.id === branchId);
    const branchRooms = rooms.filter(r => r.branch_id === branchId);
    const hours = businessHours.filter(h => h.branch_id === branchId);

    // Delete is only allowed when the branch has no rooms at all.
    const canDeleteBranch = branchRooms.length === 0;

    const [tab, setTab] = useState<"details">("details");
    const [pendingBranchConfirm, setPendingBranchConfirm] = useState<ConfirmKind | null>(null);
    const [pendingRoomConfirm, setPendingRoomConfirm]     = useState<{ room: Room; kind: ConfirmKind } | null>(null);
    const [roomActionsId, setRoomActionsId] = useState<string | null>(null);
    const [roomDetailId, setRoomDetailId]   = useState<string | null>(null);

    // If the branch we're viewing was deleted (or never existed), bounce back.
    useEffect(() => {
        if (!branch && branches.length > 0) {
            showToast("Branch not found", "Returned to the settings list.", "error");
            router.push(returnTo);
        }
    }, [branch, branches.length, router, showToast]);

    function handleClose() { router.push(returnTo); }
    function handleEdit()  { if (branch) router.push(`/settings/branches/${branch.id}/edit?returnTo=${encodeURIComponent(pathname)}`); }
    function handleAddRoom() { if (branch) router.push(`/settings/rooms/new?branchId=${branch.id}&returnTo=${encodeURIComponent(pathname)}`); }

    function performBranchConfirm(kind: ConfirmKind) {
        if (!branch) return;
        const subject = `"${branch.name}"`;
        if (kind === "archive") {
            updateBranch(branch.id, { status: "archive" });
            showToast("Branch archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            updateBranch(branch.id, { status: "active" });
            showToast("Branch recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            updateBranch(branch.id, { status: "inactive" });
            showToast("Branch deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            updateBranch(branch.id, { status: "active" });
            showToast("Branch reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            deleteBranchFn(branch.id);
            showToast("Branch deleted", `${subject} permanently removed.`, "success", "trash");
            setPendingBranchConfirm(null);
            router.push(returnTo);
            return;
        }
        setPendingBranchConfirm(null);
    }

    function performRoomConfirm(room: Room, kind: ConfirmKind) {
        const subject = `"${room.name}"`;
        if (kind === "archive") {
            updateRoom(room.id, { status: "archive" });
            showToast("Room archived", `${subject} moved to archive.`, "success", "archive");
        } else if (kind === "recover") {
            updateRoom(room.id, { status: "active" });
            showToast("Room recovered", `${subject} restored to Active.`, "success", "refresh");
        } else if (kind === "deactivate") {
            updateRoom(room.id, { status: "inactive" });
            showToast("Room deactivated", `${subject} disabled.`, "error", "slash");
        } else if (kind === "reactivate") {
            updateRoom(room.id, { status: "active" });
            showToast("Room reactivated", `${subject} restored to Active.`, "success", "check");
        } else if (kind === "delete") {
            deleteRoomFn(room.id);
            showToast("Room deleted", `${subject} permanently removed.`, "success", "trash");
        }
        setPendingRoomConfirm(null);
    }

    /** Toggle click → open the confirmation modal (matches the landing
     *  page convention). The actual mutation runs through
     *  `performRoomConfirm` so the same color rules + toast wiring apply. */
    function requestRoomToggle(room: Room) {
        if (room.status === "active") {
            setPendingRoomConfirm({ room, kind: "deactivate" });
        } else if (room.status === "inactive") {
            setPendingRoomConfirm({ room, kind: "reactivate" });
        }
    }

    if (!branch) {
        return (
            <div className="h-screen bg-white flex flex-col">
                <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
                        aria-label="Close"
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                    >
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Branch details</h1>
                </div>
                <div className="flex-1 flex items-center justify-center px-6">
                    <div className="relative w-full max-w-[480px]" style={{ minHeight: 320 }}>
                        <EmptyState title="Loading…" subtitle="Fetching branch details." />
                    </div>
                </div>
                <Toast />
            </div>
        );
    }

    const detailRoom = roomDetailId ? branchRooms.find(r => r.id === roomDetailId) ?? null : null;

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — h-[72px], same as StaffDetailPage */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Branch details</h1>
            </div>

            {/* Body — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={
                    <Sidebar
                        branch={branch}
                        hours={hours}
                        canDelete={canDeleteBranch}
                        onAction={(kind) => setPendingBranchConfirm(kind)}
                        onEdit={handleEdit}
                        onAddRoom={handleAddRoom}
                    />
                }
                main={
                    <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-1 border-[#e4e7ec] rounded-[20px]">
                        <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                            <DetailPageTabs
                                tabs={[{ key: "details", label: "Details" }]}
                                activeKey={tab}
                                onChange={(k) => setTab(k as typeof tab)}
                            />
                        </div>
                        <div className="flex-1 overflow-y-auto scrollbar-hide pt-6">
                            <DetailsTab
                                branch={branch}
                                hours={hours}
                                rooms={branchRooms}
                                roomActionsId={roomActionsId}
                                onToggleRoomActions={(id) => setRoomActionsId(prev => prev === id ? null : id)}
                                onCloseRoomActions={() => setRoomActionsId(null)}
                                onRoomView={(r) => { setRoomActionsId(null); setRoomDetailId(r.id); }}
                                onRoomEdit={(r) => { setRoomActionsId(null); router.push(`/settings/rooms/${r.id}/edit?returnTo=${encodeURIComponent(pathname)}`); }}
                                onRoomAction={(r, a) => { setRoomActionsId(null); setPendingRoomConfirm({ room: r, kind: a }); }}
                                onRoomToggle={requestRoomToggle}
                            />
                        </div>
                    </div>
                }
            />

            {detailRoom && (
                <RoomDetailModal room={detailRoom} onClose={() => setRoomDetailId(null)} />
            )}

            {pendingBranchConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingBranchConfirm];
                const subject = `"${branch.name}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingBranchConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description()}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performBranchConfirm(pendingBranchConfirm)}
                    />
                );
            })()}

            {pendingRoomConfirm && (() => {
                const cfg = CONFIRM_CFG[pendingRoomConfirm.kind];
                const subject = `"${pendingRoomConfirm.room.name}"`;
                return (
                    <ConfirmModal
                        open
                        onClose={() => setPendingRoomConfirm(null)}
                        icon={cfg.Icon}
                        tone={cfg.destructive ? "danger" : "success"}
                        title={cfg.title(subject)}
                        description={cfg.description()}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={() => performRoomConfirm(pendingRoomConfirm.room, pendingRoomConfirm.kind)}
                    />
                );
            })()}

            <Toast />
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function emailFromName(name: string): string {
    const slug = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, ".").slice(0, 24);
    return `${slug}@formastudio.ae`;
}
