"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor profile · Integrations tab (Figma 6378:524321)
// ─────────────────────────────────────────────────────────────────────────────
//
// Per-instructor calendar connections. The card + modal chain comes from
// the SHARED `IntegrationModalChain` module — same components admin uses,
// so the visual treatment + flow are 1:1 identical with the studio-level
// Integrations page. This file is just the per-instructor data wiring +
// flow controller.
//
// ──────────────────────────────────────────────────────────────────
// ROLE-SCOPED VIEW — reads/writes the SAME centralized store. The
// `.filter(i => i.staffProfileId === currentStaffId)` is the only
// scoping logic; when this moves to Supabase that filter becomes an
// RLS policy on `instructor_integrations.staff_profile_id`. Do NOT
// fork the integrations seed or modal chain.
// ──────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import {
    useAppStore,
    type Integration,
    type InstructorIntegration,
    type InstructorIntegrationSlug,
} from "@/lib/store";
import {
    IntegrationCard,
    ConnectModal,
    LoadingModal,
    ViewModal,
    DisconnectConfirm,
    configFor,
} from "@/components/integrations/IntegrationModalChain";

// ────────────────────────────────────────────────────────────────────────────
// Display copy per provider — what the card name + description should read
// on the instructor side. The studio-level `Integration.name` /
// `.description` come from the admin seed; for instructor we synthesize
// them from the slug so the cards render the same "Google Calendar / Sync
// classes and private sessions to your Google Calendar." treatment the
// Figma 6378:524321 shows.
// ────────────────────────────────────────────────────────────────────────────
const PROVIDER_DISPLAY: Record<InstructorIntegrationSlug, { name: string; description: string }> = {
    google_calendar: {
        name: "Google Calendar",
        description: "Sync classes and private sessions to your Google Calendar.",
    },
    apple_calendar: {
        name: "Apple Calendar",
        description: "Keep your teaching schedule updated on all Apple devices.",
    },
};

/** Adapt an `InstructorIntegration` row into the `Integration` shape the
 *  shared modal chain expects. Both shapes carry the same fields apart
 *  from `name` + `description`, which the modal renders verbatim — we
 *  pull those from the local display map. */
function toIntegrationShape(row: InstructorIntegration): Integration {
    const display = PROVIDER_DISPLAY[row.slug];
    return {
        id: row.id,
        slug: row.slug,
        name: display.name,
        description: display.description,
        status: row.status,
        connectedAt: row.connectedAt,
        accountLabel: row.accountLabel,
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Flow state — mirrors the admin Integrations page exactly so the two
// surfaces stay in lockstep.
// ────────────────────────────────────────────────────────────────────────────
type FlowState =
    | { kind: "idle" }
    | { kind: "connect"; integration: Integration }
    | { kind: "loading"; integration: Integration }
    | { kind: "view"; integration: Integration }
    | { kind: "disconnect"; integration: Integration };

const LOADING_MS = 1500;

interface IntegrationsTabProps {
    staffProfileId: string;
}

export function IntegrationsTab({ staffProfileId }: IntegrationsTabProps) {
    const integrations = useAppStore(s => s.instructorIntegrations);
    const connectInstructorIntegration = useAppStore(s => s.connectInstructorIntegration);
    const disconnectInstructorIntegration = useAppStore(s => s.disconnectInstructorIntegration);
    const showToast = useAppStore(s => s.showToast);

    // Per-instructor scoping — only Liam's rows reach the cards.
    const myIntegrations = useMemo(
        () => integrations
            .filter(i => i.staffProfileId === staffProfileId)
            .map(toIntegrationShape),
        [integrations, staffProfileId],
    );

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Loading → connect → toast (same shape as admin, just calls the
    // per-instructor mutator).
    useEffect(() => {
        if (flow.kind !== "loading") return;
        const integration = flow.integration;
        const cfg = configFor(integration);
        const slug = integration.slug as InstructorIntegrationSlug;
        const t = setTimeout(() => {
            try {
                window.open(cfg.consentUrl, "_blank", "noopener,noreferrer");
            } catch {
                // Popup blocked — ignore; the toast + state flip still fire.
            }
            connectInstructorIntegration(
                staffProfileId,
                slug,
                cfg.accountFields[0]?.value,
            );
            showToast(
                `${integration.name} connected successfully`,
                `Your ${integration.name} account is now connected!`,
                "success", "check",
            );
            setFlow({ kind: "idle" });
        }, LOADING_MS);
        return () => clearTimeout(t);
    }, [flow, staffProfileId, connectInstructorIntegration, showToast]);

    function handleDisconnectConfirmed(i: Integration) {
        disconnectInstructorIntegration(staffProfileId, i.slug as InstructorIntegrationSlug);
        showToast(
            `${i.name} account has been disconnected`,
            `${i.name} account information and access has been remove.`,
            "error", "slash",
        );
        setFlow({ kind: "idle" });
    }

    return (
        // `min-h-[760px]` follows CLAUDE.md rule #7 — view cards must
        // fill, not hug content. Without it the Integrations + Notification
        // settings cards would render dramatically shorter than the
        // Personal info one, and the page would jump between tabs.
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_1px_rgba(16,24,40,0.05)] p-6 w-full min-h-[760px]">
            <div className="flex flex-col gap-5 w-full">
                <p className="text-[18px] font-semibold text-[#101828] leading-7">Integrations</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    {myIntegrations.map(integration => (
                        <IntegrationCard
                            key={integration.id}
                            integration={integration}
                            onConnect={int   => setFlow({ kind: "connect",    integration: int })}
                            onView={int      => setFlow({ kind: "view",       integration: int })}
                            onDisconnect={int => setFlow({ kind: "disconnect", integration: int })}
                        />
                    ))}
                </div>
            </div>

            {/* ── Modal chain — same components admin uses ─────────────── */}

            {flow.kind === "connect" && (
                <ConnectModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                    onContinue={() => setFlow({ kind: "loading", integration: flow.integration })}
                />
            )}

            {flow.kind === "loading" && (
                <LoadingModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                />
            )}

            {flow.kind === "view" && (
                <ViewModal
                    integration={flow.integration}
                    onClose={() => setFlow({ kind: "idle" })}
                    onDisconnect={() => setFlow({ kind: "disconnect", integration: flow.integration })}
                />
            )}

            {flow.kind === "disconnect" && (
                <DisconnectConfirm
                    integration={flow.integration}
                    onCancel={() => setFlow({ kind: "idle" })}
                    onConfirm={() => handleDisconnectConfirmed(flow.integration)}
                />
            )}
        </div>
    );
}
