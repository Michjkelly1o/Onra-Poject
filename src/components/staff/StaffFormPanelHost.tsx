"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — StaffFormPanelHost
// ─────────────────────────────────────────────────────────────────────────────
//
// Mounted once in the admin layout. Renders every Staff & Shifts create / edit
// form inside a right-anchored SlidePanel, driven by `useStaffFormPanelStore`.
// Any trigger across the module opens a form via `openStaffFormPanel(...)`
// (client 2026-07-30) — no page navigation.

import { useEffect, useState } from "react";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { useStaffFormPanelStore, type StaffFormPanel } from "@/lib/staff-form-panel";
import StaffFormPage from "@/components/staff/StaffFormPage";
import { ShiftFormPage } from "@/components/staff/ShiftFormPage";
import { BlockedTimeFormPage } from "@/components/staff/BlockedTimeFormPage";

// Same width as the POS "Add new customer" side panel (480px) for every form.
const WIDTH = 480;

export function StaffFormPanelHost() {
    const panel = useStaffFormPanelStore((s) => s.panel);
    const close = useStaffFormPanelStore((s) => s.close);

    // Retain the last panel through the ~300ms slide-out so its form stays
    // mounted (and visible) while the panel animates closed.
    const [shown, setShown] = useState<StaffFormPanel | null>(panel);
    useEffect(() => {
        if (panel) {
            setShown(panel);
            return;
        }
        const t = setTimeout(() => setShown(null), 320);
        return () => clearTimeout(t);
    }, [panel]);

    const s = shown;
    const isOpen = (k: StaffFormPanel["kind"]) => panel?.kind === k;

    return (
        <>
            <SlidePanel open={isOpen("staff")} onClose={close} width={WIDTH}>
                {s?.kind === "staff" && (
                    <StaffFormPage
                        mode={s.mode === "edit" ? "edit" : "create"}
                        staffId={s.id}
                        roleId={s.roleId}
                        onClose={close}
                    />
                )}
            </SlidePanel>

            <SlidePanel open={isOpen("shift")} onClose={close} width={WIDTH}>
                {s?.kind === "shift" && (
                    <ShiftFormPage mode={s.mode === "edit" ? "edit" : "create"} shiftId={s.id} onClose={close} />
                )}
            </SlidePanel>

            <SlidePanel open={isOpen("blocked")} onClose={close} width={WIDTH}>
                {s?.kind === "blocked" && (
                    <BlockedTimeFormPage mode={s.mode === "edit" ? "edit" : "create"} blockedTimeId={s.id} onClose={close} />
                )}
            </SlidePanel>
        </>
    );
}
