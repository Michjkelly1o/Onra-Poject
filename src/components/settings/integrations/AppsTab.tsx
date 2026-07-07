"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Apps tab (inside the unified Integrations module)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: 7632:17561 (Apps tab — grouped 3-col grid with filter
// dropdown + search + Request integrations card).
//
// Renders inside /admin/settings/integrations as the Apps tab. The card
// chrome + the full Connect / Loading / View / Disconnect modal chain
// is REUSED VERBATIM from the existing standalone integrations page via
// the shared `IntegrationModalChain` primitives. The only NEW behaviour
// here is:
//   • Cards are grouped by category (Calendar / Marketing & communication /
//     Analytics & accounting) — category derived from slug, not stored.
//   • Toolbar: search input + Filter dropdown (filters by category).
//   • Final tile in the grid is a dashed "Request integrations" card that
//     opens the RequestIntegrationModal.
//
// Data shape + store actions + cascade rules are unchanged.

import { useEffect, useMemo, useRef, useState } from "react";
import { SearchMd, FilterLines, Link04, Plus, Check } from "@untitledui/icons";
import { useAppStore, type Integration } from "@/lib/store";
import {
    IntegrationCard,
    ConnectModal,
    LoadingModal,
    ViewModal,
    DisconnectConfirm,
    configFor,
} from "@/components/integrations/IntegrationModalChain";
import { cn } from "@/lib/utils";
import {
    INTEGRATION_CATEGORIES,
    integrationCategoryFor,
    integrationCategoryLabel,
    type IntegrationCategory,
} from "./categories";
import { RequestIntegrationModal } from "./RequestIntegrationModal";

// One discriminated-union flow state covering every modal step.
type FlowState =
    | { kind: "idle" }
    | { kind: "connect"; integration: Integration }
    | { kind: "loading"; integration: Integration }
    | { kind: "view"; integration: Integration }
    | { kind: "disconnect"; integration: Integration }
    | { kind: "request" };

const LOADING_MS = 1500;

/** Search + Filter toolbar for the Apps tab. Exported so the parent page can
 *  render it inline with the SegmentedTabs row (Figma feedback Jul 2026). */
export function AppsToolbar({
    search, setSearch, categoryFilter, setCategoryFilter, filterOpen, setFilterOpen,
}: {
    search: string;
    setSearch: (v: string) => void;
    categoryFilter: IntegrationCategory | null;
    setCategoryFilter: (v: IntegrationCategory | null) => void;
    filterOpen: boolean;
    setFilterOpen: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="relative w-[280px]">
                <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="h-10 w-full pl-[36px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                />
            </div>
            <FilterDropdown
                open={filterOpen}
                onOpenChange={setFilterOpen}
                value={categoryFilter}
                onChange={setCategoryFilter}
            />
        </div>
    );
}

export interface AppsTabProps {
    search: string;
    categoryFilter: IntegrationCategory | null;
}

export function AppsTab({ search, categoryFilter }: AppsTabProps) {
    const integrations = useAppStore(s => s.integrations);
    const connectIntegration = useAppStore(s => s.connectIntegration);
    const disconnectIntegration = useAppStore(s => s.disconnectIntegration);
    const showToast = useAppStore(s => s.showToast);

    const [flow, setFlow] = useState<FlowState>({ kind: "idle" });

    // Loading modal auto-resolves after LOADING_MS (same flow as the
    // previous /admin/settings/integrations page).
    useEffect(() => {
        if (flow.kind !== "loading") return;
        const integration = flow.integration;
        const cfg = configFor(integration);
        const t = setTimeout(() => {
            try {
                window.open(cfg.consentUrl, "_blank", "noopener,noreferrer");
            } catch {
                // Popup blocked — toast + state flip still fire.
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
        showToast(
            `${i.name} account has been disconnected`,
            `${i.name} account information and access has been remove.`,
            "error", "slash",
        );
        setFlow({ kind: "idle" });
    }

    function handleRequestSubmitted() {
        setFlow({ kind: "idle" });
        showToast(
            "Request submitted",
            "We'll review your request and get back to you within 2-3 business days.",
            "success", "check",
        );
    }

    // Filter by search + category, then group by category.
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return integrations.filter(i => {
            if (categoryFilter && integrationCategoryFor(i.slug) !== categoryFilter) return false;
            if (q) {
                const hay = `${i.name} ${i.description}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [integrations, search, categoryFilter]);

    const groupedByCategory = useMemo(() => {
        const map = new Map<IntegrationCategory, Integration[]>();
        for (const i of filtered) {
            const cat = integrationCategoryFor(i.slug);
            const arr = map.get(cat) ?? [];
            arr.push(i);
            map.set(cat, arr);
        }
        return map;
    }, [filtered]);

    // Render groups in canonical order (Calendar → Marketing → Analytics),
    // skipping any that ended up empty after filtering.
    const visibleGroups = INTEGRATION_CATEGORIES.filter(c =>
        (groupedByCategory.get(c.key) ?? []).length > 0,
    );

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar (search + category filter) is rendered by the page,
                inline with the SegmentedTabs row — see integrations/page.tsx. */}

            {/* ── Empty state ─────────────────────────────────────────── */}
            {/* When the filter / search yields zero results, render a small
                empty-state row AND keep the Request card visible so the
                admin can still submit a request from a dry feed. */}
            {visibleGroups.length === 0 && (
                <>
                    <div className="bg-white border-1 border-dashed border-[#e4e7ec] rounded-[12px] py-10 flex flex-col items-center gap-1">
                        <p className="text-[14px] font-medium text-[#344054]">No apps found</p>
                        <p className="text-[13px] text-[#667085]">Try a different search or pick another filter.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <RequestIntegrationsCard onClick={() => setFlow({ kind: "request" })} />
                    </div>
                </>
            )}

            {/* ── Grouped grids ───────────────────────────────────────── */}
            {/* The "Request integrations" card sits inside the LAST visible
                group's grid (per Figma 7632:17561 — the Analytics & accounting
                row ends with Google Analytics, Xero, Request). When the
                filter narrows the feed to fewer groups, the Request card
                follows the last surviving group's grid so it always appears
                inline with real integration cards instead of breaking onto
                its own row beneath everything. */}
            {visibleGroups.map((group, idx) => {
                const isLast = idx === visibleGroups.length - 1;
                const groupItems = groupedByCategory.get(group.key) ?? [];
                return (
                    <div key={group.key} className="flex flex-col gap-3">
                        <p className="text-[14px] font-medium text-[#475467]">{group.label}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {groupItems.map(i => (
                                <IntegrationCard
                                    key={i.id}
                                    integration={i}
                                    onConnect={int   => setFlow({ kind: "connect",    integration: int })}
                                    onView={int      => setFlow({ kind: "view",       integration: int })}
                                    onDisconnect={int => setFlow({ kind: "disconnect", integration: int })}
                                />
                            ))}
                            {isLast && (
                                <RequestIntegrationsCard onClick={() => setFlow({ kind: "request" })} />
                            )}
                        </div>
                    </div>
                );
            })}

            {/* ── Modal chain ─────────────────────────────────────────── */}

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

            {flow.kind === "request" && (
                <RequestIntegrationModal
                    onClose={() => setFlow({ kind: "idle" })}
                    onSubmitted={handleRequestSubmitted}
                />
            )}
        </div>
    );
}

// ─── Filter dropdown ──────────────────────────────────────────────────────
//
// Lightweight dropdown matching the Figma — pill-button trigger with a
// FilterLines icon, opens a card-style menu listing each category with a
// "Clear filter" item at the bottom when a filter is active.

function FilterDropdown({ open, onOpenChange, value, onChange }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    value: IntegrationCategory | null;
    onChange: (v: IntegrationCategory | null) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) onOpenChange(false);
        }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, [onOpenChange]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                className="h-10 px-3 inline-flex items-center gap-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
            >
                <div className="relative">
                    <FilterLines className="w-4 h-4 text-[#475467]" />
                    {value && <span className="absolute -top-[4px] -right-[4px] w-[8px] h-[8px] rounded-full bg-[#47b881] border-1 border-white" />}
                </div>
                Filter
            </button>
            {open && (
                // min-w-[240px] fits "Marketing & communication" on a
                // single line — the previous 200px wrapped the label.
                // Clear-filter row dropped per the brief: admins toggle off
                // by clicking the selected category again (same pattern as
                // every other filter dropdown across the app).
                <div className="absolute top-[calc(100%+4px)] right-0 z-50 min-w-[240px] bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1">
                    {INTEGRATION_CATEGORIES.map(cat => {
                        const selected = value === cat.key;
                        return (
                            <button
                                key={cat.key}
                                type="button"
                                onClick={() => { onChange(selected ? null : cat.key); onOpenChange(false); }}
                                className={cn(
                                    "flex items-center justify-between gap-3 w-full px-4 py-[10px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors whitespace-nowrap",
                                    selected ? "text-[#101828] font-semibold" : "text-[#344054]",
                                )}
                            >
                                <span>{cat.label}</span>
                                {selected && <Check className="w-4 h-4 text-[#658774] shrink-0" />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ─── Request integrations card (Figma 7632:17594) ──────────────────────────
//
// Dashed-border card matching the Figma's "Request integrations" tile.
// Rendered as the last item in the Apps tab so an admin can always
// surface the request modal regardless of which category is active.

function RequestIntegrationsCard({ onClick }: { onClick: () => void }) {
    // w-full lets the card stretch to the parent grid cell so it matches
    // the neighbouring IntegrationCard width exactly. Dropped the previous
    // max-w cap that made it look narrower than the real-integration
    // cards when sitting inline at the end of a group's grid.
    return (
        <div className="bg-[#f9fafb] border-1 border-dashed border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 w-full">
            <div className="w-10 h-10 rounded-[8px] bg-white border-1 border-[#e4e7ec] flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <Link04 className="w-5 h-5 text-[#475467]" />
            </div>
            <div className="flex flex-col gap-1">
                <p className="text-[16px] font-semibold text-[#101828] leading-6">Request integrations</p>
                <p className="text-[14px] text-[#6e776f] leading-5">
                    Tell us what to build next or connect anything via Zapier & our open API
                </p>
            </div>
            <button
                type="button"
                onClick={onClick}
                className="inline-flex items-center justify-center gap-1.5 h-10 px-3 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
            >
                <Plus className="w-4 h-4 text-[#475467]" />
                Request
            </button>
        </div>
    );
}
