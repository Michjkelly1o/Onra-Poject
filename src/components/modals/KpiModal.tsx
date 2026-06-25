"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — KpiModal (instructor dashboard KPI tile click-through)
// ─────────────────────────────────────────────────────────────────────────────
//
// Fixed-size dashboard KPI modal — used by the 4 modals that open from the
// instructor dashboard metric cards: CancellationsModal, ClassesModal,
// AttendanceModal, ClientsModal. Each previously copy-pasted ~50 lines of
// identical chrome (backdrop, container, header, close button). Now they
// share the Modal base + KpiModal wrapper for the dashboard-specific size.
//
// Per the second-pass audit, the 4 KPI modals share:
//   • max-width 720–860 (Attendance uses 860; the rest use 720)
//   • height ~560–620 (Attendance uses 620 to fit its 6-col grid)
//   • Stronger backdrop (`bg-[#0c111d]/70` vs the 60% baseline)
//   • Title + subtitle header layout
//
// API: thin wrapper around Modal that locks in the dashboard width/height
// defaults and forwards everything else through.

import { Modal } from "./Modal";

export interface KpiModalProps {
    open: boolean;
    onClose: () => void;
    title: string;
    subtitle?: React.ReactNode;
    children: React.ReactNode;
    /** Container max-width in pixels. Default 720. Override to 760 / 860
     *  for the wider Clients / Attendance variants. */
    maxWidth?: number;
    /** Container height in pixels. Default 560. Override to 600 / 620 for
     *  the taller Clients / Attendance variants. */
    height?: number;
    /** z-index. Default 50 (above the dashboard content + sidebars but
     *  below toast notifications). */
    zIndex?: number;
    /** Optional id for ariaLabelledBy linkage. */
    titleId?: string;
}

export function KpiModal({
    open,
    onClose,
    title,
    subtitle,
    children,
    maxWidth = 720,
    height = 560,
    zIndex = 50,
    titleId,
}: KpiModalProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            maxWidth={maxWidth}
            height={height}
            zIndex={zIndex}
            ariaLabelledBy={titleId}
            className="rounded-[16px]"
        >
            <Modal.Header
                id={titleId}
                title={title}
                subtitle={subtitle}
                onClose={onClose}
            />
            <Modal.Body>{children}</Modal.Body>
        </Modal>
    );
}
