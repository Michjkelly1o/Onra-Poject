"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Integrations module (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • List view (3-col card grid)   — 4457-22091
//   • Connected card state           — 5335-98795
//   • Connect Google Calendar modal  — 4457-22869
//   • Connect WhatsApp Business      — 4457-22960
//   • Connect Apple Calendar         — 4457-23052
//   • Connect Google Analytics       — 4457-23144
//   • Loading modal                  — 4457-22530
//   • View modal                     — 4457-22433
//   • Success toast                  — 4457-22222
//   • Disconnect toast               — 4457-23238
//
// Card + modal chain primitives live in
// [IntegrationModalChain](src/components/integrations/IntegrationModalChain.tsx)
// — extracted there so the instructor profile's Integrations tab can reuse
// the EXACT same flow without forking. This page is now just the studio-
// scoped data wiring + flow-state controller.

import { useEffect, useState } from "react";
import { useAppStore, type Integration } from "@/lib/store";
import {
    IntegrationCard,
    ConnectModal,
    LoadingModal,
    ViewModal,
    DisconnectConfirm,
    configFor,
} from "@/components/integrations/IntegrationModalChain";

// One discriminated-union flow state covering every modal step.
type FlowState =
    | { kind: "idle" }
    | { kind: "connect"; integration: Integration }
    | { kind: "loading"; integration: Integration }
    | { kind: "view"; integration: Integration }
    | { kind: "disconnect"; integration: Integration };

const LOADING_MS = 1500;

export default function IntegrationsPage() {
    const integrations = useAppStore(s => s.integrations);
    const connectIntegration = useAppStore(s => s.connectIntegration);
    const disconnectIntegration = useAppStore(s => s.disconnectIntegration);
    const showToast = useAppStore(s => s.showToast);

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Loading modal auto-resolves after LOADING_MS — closes itself, opens
    // the provider's consent screen in a new tab (simulated OAuth handoff
    // for the demo), flips status, fires the success toast.
    useEffect(() => {
        if (flow.kind !== "loading") return;
        const integration = flow.integration;
        const cfg = configFor(integration);
        const t = setTimeout(() => {
            try {
                window.open(cfg.consentUrl, "_blank", "noopener,noreferrer");
            } catch {
                // Popup blocked — ignore; the toast + state flip still fire.
            }
            connectIntegration(integration.id, cfg.accountFields[0]?.value);
            showToast(
                `${integration.name} connected successfully`,
                `Your ${integration.name} account is now connected!`,
                "success", "check",
            );
            setFlow({ kind: "idle" });
        }, LOADING_MS);
        return () => clearTimeout(t);
    }, [flow, connectIntegration, showToast]);

    function handleDisconnectConfirmed(i: Integration) {
        disconnectIntegration(i.id);
        // Figma 4457-23238 — pink/red toast tone with broken-link icon.
        showToast(
            `${i.name} account has been disconnected`,
            `${i.name} account information and access has been remove.`,
            "error", "slash",
        );
        setFlow({ kind: "idle" });
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Section header (Figma 4457:22112) */}
            <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828] leading-6">Integrations</p>
                <p className="text-[14px] text-[#6e776f] leading-5">
                    Supercharge business workflow and connect with the every day tools
                </p>
            </div>

            {/* Grid — 1 / 2 / 3 cols depending on viewport */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map(i => (
                    <IntegrationCard
                        key={i.id}
                        integration={i}
                        onConnect={int   => setFlow({ kind: "connect",    integration: int })}
                        onView={int      => setFlow({ kind: "view",       integration: int })}
                        onDisconnect={int => setFlow({ kind: "disconnect", integration: int })}
                    />
                ))}
            </div>

            {/* ── Modal chain ──────────────────────────────────────────── */}

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
