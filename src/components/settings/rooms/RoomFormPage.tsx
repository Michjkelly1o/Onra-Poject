"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Business & Locations → Add / Edit room
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 4098:211358 — full-page modal shell with single "Room details"
// step, center form (Parent location, Room name, Room capacity, Spot
// layout column/row counts), and a right-side "Room preview" card with a
// generated seating chart.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore } from "@/lib/store";
import {
    FormHeader, StepSidebar, SectionHeader, Field, TextInput, NumberInput,
} from "@/components/settings/business/StudioProfileFormPage";
import { SeatingChartView } from "@/components/settings/rooms/SeatingChartView";

const DEFAULT_RETURN_ROUTE = "/admin/settings/business-locations";

export function RoomFormPage({ mode, roomId, defaultBranchId, returnTo }: {
    mode: "create" | "edit";
    roomId?: string;
    /** When the create form is opened from a branch's "Add room" row
     *  action, the parent branch is pre-selected. */
    defaultBranchId?: string;
    /** Optional path to navigate to on Close / Save. When omitted, falls
     *  back to the Business & Locations landing (the default for the
     *  "+ Add room" affordance there). Schedule form pushes this so the
     *  admin lands back on their in-progress schedule, not the Settings
     *  page. */
    returnTo?: string;
}) {
    const router = useRouter();
    const RETURN_ROUTE = returnTo || DEFAULT_RETURN_ROUTE;
    const showToast = useAppStore(s => s.showToast);
    const branches = useAppStore(s => s.branches);
    const rooms = useAppStore(s => s.rooms);
    const addRoomStore = useAppStore(s => s.addRoom);
    const updateRoomStore = useAppStore(s => s.updateRoom);

    const existing = mode === "edit" && roomId
        ? rooms.find(r => r.id === roomId)
        : undefined;

    const [branchId,    setBranchId]    = useState<string>(
        existing?.branch_id
        ?? defaultBranchId
        ?? branches.find(b => b.is_main)?.id
        ?? branches[0]?.id
        ?? "",
    );
    const [name,        setName]        = useState<string>(existing?.name ?? "");
    const [capacity,    setCapacity]    = useState<string>(existing ? String(existing.capacity) : "");
    // Create mode → columns / rows start empty (placeholder "0"). Edit mode
    // → pre-fill from the existing room. The "0" placeholder mirrors every
    // other numeric input across the app and stops the admin assuming the
    // form is pre-loaded with a 5×3 layout.
    const [columns,     setColumns]     = useState<string>(existing?.columns ? String(existing.columns) : "");
    const [rows,        setRows]        = useState<string>(existing?.rows    ? String(existing.rows)    : "");

    const capacityNum = Number(capacity) || 0;
    const colsRaw     = Number(columns) || 0;
    const rowsRaw     = Number(rows)    || 0;
    // The seating chart still renders at least a 1×1 grid so the preview
    // never collapses to nothing — but the input itself shows "0" / empty
    // until the admin enters real values.
    const colsNum     = Math.max(1, Math.min(50, colsRaw || 1));
    const rowsNum     = Math.max(1, Math.min(50, rowsRaw || 1));

    // Capacity is the hard ceiling — rows × columns can never exceed it.
    // We surface the violation as an inline error and disable submit; the
    // preview still renders so the admin can see what they're trying to do.
    const layoutSpots    = colsRaw * rowsRaw;
    const exceedsCap     = capacityNum > 0 && layoutSpots > capacityNum;
    const layoutEntered  = colsRaw > 0 && rowsRaw > 0;
    const layoutTooLarge = exceedsCap;

    const canSubmit =
        name.trim().length > 0
        && capacityNum > 0
        && branchId.length > 0
        && layoutEntered
        && !layoutTooLarge;

    function handleClose() { router.push(RETURN_ROUTE); }
    function handleSubmit() {
        if (!canSubmit) return;
        const patch = {
            branch_id: branchId,
            name: name.trim(),
            capacity: capacityNum,
            columns: colsNum,
            rows: rowsNum,
        };
        if (mode === "create") {
            addRoomStore({
                id: `room_new_${Date.now()}`,
                status: "active",
                ...patch,
            });
        } else if (existing) {
            updateRoomStore(existing.id, patch);
        }
        showToast(
            mode === "create" ? "Room added"  : "Room updated",
            mode === "create"
                ? `${name.trim()} has been added to ${branchName(branchId)}.`
                : `${name.trim()} has been saved.`,
            "success", "check",
        );
        router.push(RETURN_ROUTE);
    }

    const pageTitle = mode === "create" ? "Add room" : `Edit ${existing?.name ?? "room"}`;
    const submitLabel = mode === "create" ? "Add room" : "Save changes";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            <FormHeader title={pageTitle} onClose={handleClose} />

            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-8 h-full items-stretch">
                    <StepSidebar steps={[{ n: 1, label: "Room details" }]} current={1} />

                    {/* Center form card */}
                    <div className="flex-1 min-w-0 max-w-[628px] flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] p-6 flex-1 flex flex-col gap-6 shadow-[0px_1px_1px_rgba(16,24,40,0.05)] min-h-0">
                            <div className="flex-1 overflow-y-auto flex flex-col gap-4 px-1 -mx-1 min-h-0">
                                <SectionHeader title="Room details" />

                                <Field label="Parent location">
                                    <SelectInput
                                        value={branchId}
                                        onChange={setBranchId}
                                        placeholder="Select location"
                                        // Spa branches are room-less by design
                                        // (recovery sessions aren't room-scoped),
                                        // so the room-create dropdown only offers
                                        // Club branches. Matches the same filter
                                        // applied in BranchActionMenu + branch
                                        // detail page.
                                        options={branches
                                            .filter(b => b.status === "active" && b.kind !== "spa")
                                            .map(b => ({ value: b.id, label: b.name }))
                                        }
                                        width="w-full"
                                    />
                                </Field>

                                <Field label="Room name">
                                    <TextInput value={name} onChange={setName} placeholder="e.g. Private Suite" />
                                </Field>

                                <Field label="Room capacity">
                                    <NumberInput value={capacity} onChange={setCapacity} placeholder="0" />
                                </Field>

                                <div className="flex flex-col gap-1">
                                    <SectionHeader title="Spot layout" small />
                                    <p className="text-[14px] text-[#6e776f] leading-5">
                                        Define the rows and columns to generate the room&apos;s spot layout.
                                        {capacityNum > 0
                                            ? ` Rows × columns can’t exceed the room capacity (${capacityNum} spots).`
                                            : " Set the room capacity first so we can validate the layout."
                                        }
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="Column number">
                                        <NumberInput value={columns} onChange={setColumns} placeholder="0" />
                                    </Field>
                                    <Field label="Row number">
                                        <NumberInput value={rows} onChange={setRows} placeholder="0" />
                                    </Field>
                                </div>

                                {layoutEntered && capacityNum > 0 && (
                                    <div className={cn(
                                        "rounded-[8px] px-3 py-2 text-[13px] font-medium leading-5",
                                        layoutTooLarge
                                            ? "bg-[#fef3f2] border-1 border-[#fda29b] text-[#b42318]"
                                            : "bg-[#ecfdf3] border-1 border-[#abefc6] text-[#067647]",
                                    )}>
                                        {layoutTooLarge
                                            ? `${layoutSpots} of ${capacityNum} spots — exceeds capacity. Reduce rows or columns, or increase capacity.`
                                            : `${layoutSpots} of ${capacityNum} spots used.`
                                        }
                                    </div>
                                )}
                            </div>

                            <div className="shrink-0 flex items-center justify-end w-full">
                                <Button variant="primary" size="md" disabled={!canSubmit} onClick={handleSubmit}>
                                    {submitLabel}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Right preview — FIXED viewport-aligned height so the
                        inner SeatingChartView is the only thing that scrolls
                        (admins can set 20 rows × 30 cols without the side
                        panel running off-page). */}
                    <div className="w-[360px] shrink-0 flex flex-col min-h-0">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex-1 flex flex-col overflow-hidden min-h-0">
                            <div className="flex flex-col gap-1 px-6 pt-6 pb-5 shrink-0">
                                <p className="text-[18px] font-semibold text-[#101828] leading-7">Room preview</p>
                                <p className="text-[14px] text-[#6e776f] leading-5">This is how room overview will look like.</p>
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec] shrink-0" />
                            <div className="bg-[#f6f6f3] p-6 flex-1 min-h-0 flex flex-col items-stretch justify-start">
                                <div className="w-full bg-white border-1 border-[#e4e7ec] rounded-[20px] p-5 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                                    <div className="flex items-start gap-3 shrink-0">
                                        <div className="w-14 h-14 rounded-full bg-[#f2f4f7] border border-[rgba(0,0,0,0.08)] flex items-center justify-center shrink-0">
                                            <LayoutGrid01 className="w-6 h-6 text-[#475467]" />
                                        </div>
                                        <div className="flex flex-col">
                                            <p className="text-[18px] font-semibold text-[#101828] leading-7">{name || "Room name"}</p>
                                            <p className="text-[14px] text-[#667085] leading-5">{capacityNum > 0 ? `${capacityNum} max` : "Capacity"}</p>
                                        </div>
                                    </div>
                                    {/* Only the seating chart scrolls — the rest of the
                                        preview card stays anchored. */}
                                    <div className="flex-1 min-h-0 overflow-hidden">
                                        <SeatingChartView rows={rowsNum} columns={colsNum} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function branchName(id: string): string {
    // Snapshot lookup via the live store at call time.
    return useAppStore.getState().branches.find(b => b.id === id)?.name ?? "this branch";
}

