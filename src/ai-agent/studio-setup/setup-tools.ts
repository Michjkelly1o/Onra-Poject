// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Studio-setup tools (Phase 11)
// ─────────────────────────────────────────────────────────────────────────────
//
// Two tools power the third thread. Both READ-ONLY — the studio-setup
// flow never writes; it advises + navigates. All writes happen when the
// tester clicks a deep-link chip and lands on the corresponding admin
// settings page.
//
// Every tool returns an InsightCard so the ChatThread renderer already
// knows how to draw them — no new card type needed. Uses metric_group
// (status tile row) + ranked_list (steps with deep links).

import { tool } from "ai";
import { z } from "zod";
import type { AuthContext } from "@/ai-agent/agent/auth";
import { askQuestionsTool } from "@/ai-agent/agent/tools";
import type { InsightCard } from "@/ai-agent/agent/cards";
import type { AiAgentStateSnapshot } from "@/ai-agent/types/request";
import {
    SETUP_STEPS,
    type SetupStep,
} from "@/ai-agent/studio-setup/setup-catalog";

/** Which steps are done vs missing, computed from the snapshot. */
function partition(snapshot: AiAgentStateSnapshot) {
    const done: SetupStep[] = [];
    const missing: SetupStep[] = [];
    for (const step of SETUP_STEPS) {
        (step.isConfigured(snapshot) ? done : missing).push(step);
    }
    return { done, missing };
}

export function setupTools(
    ctx: AuthContext,
    snapshot: AiAgentStateSnapshot,
) {
    return {
        ...askQuestionsTool(),
        check_studio_status: tool({
            description:
                "Get an at-a-glance snapshot of what's currently configured in the studio — total counts of branches, rooms, class categories, class templates, instructors, memberships, packages. Call this first when the user asks 'what's set up?' / 'where do I start?' / 'walk me through onboarding'. The returned card renders as a tile row.",
            parameters: z.object({}),
            execute: async (): Promise<InsightCard> => {
                const { done, missing } = partition(snapshot);
                const tiles = [
                    { label: "Branches",         value: String(snapshot.branches.length) },
                    { label: "Rooms",            value: String(snapshot.rooms.length) },
                    { label: "Class categories", value: String(snapshot.classCategories.length) },
                    { label: "Class templates",  value: String(snapshot.classTemplates.length) },
                    { label: "Instructors",      value: String(snapshot.instructors.length) },
                    { label: "Memberships",      value: String(snapshot.memberships.length) },
                    { label: "Packages",         value: String(snapshot.packages.length) },
                    { label: "Setup progress",   value: `${done.length}/${SETUP_STEPS.length}` },
                ];
                const note =
                    missing.length === 0
                        ? "Everything's configured — nice."
                        : `Still to set up: ${missing
                              .slice(0, 4)
                              .map((s) => s.label)
                              .join(", ")}${missing.length > 4 ? "…" : "."}`;
                return {
                    card: "metric_group",
                    title: `${ctx.displayName}'s studio · setup snapshot`,
                    tiles,
                    note,
                };
            },
        }),

        list_setup_steps: tool({
            description:
                "Return a ranked list of onboarding steps with a short description and a deep link to the admin page that configures each. Use when the user wants to know 'what should I do next?' / 'how do I set up memberships?' / 'list all setup steps'. The `filter` arg lets you show only the missing steps (default) or every step. The card renders as a ranked_list with a 'Go to setting' chip on each row.",
            parameters: z.object({
                filter: z
                    .enum(["missing", "all"])
                    .optional()
                    .describe(
                        "'missing' = only steps not yet configured (default; better for guidance). 'all' = the full sequence including done items.",
                    ),
            }),
            execute: async ({ filter }): Promise<InsightCard> => {
                const which = filter ?? "missing";
                const { done, missing } = partition(snapshot);
                const rows =
                    which === "missing"
                        ? missing
                        : SETUP_STEPS;
                if (rows.length === 0) {
                    return {
                        card: "empty",
                        message:
                            "Nothing left to set up — every step in the onboarding sequence is configured.",
                    };
                }
                return {
                    card: "ranked_list",
                    title:
                        which === "missing"
                            ? "Left to set up"
                            : `Full onboarding sequence (${done.length}/${SETUP_STEPS.length} done)`,
                    rows: rows.map((step) => ({
                        title: step.label,
                        subtitle: step.description,
                        right1: step.isConfigured(snapshot)
                            ? "✓ done"
                            : "→ not yet",
                    })),
                    // Route the tester at the first missing item so
                    // there's a single obvious "next action" chip.
                    deepLink: {
                        label:
                            which === "missing" && missing[0]
                                ? `Go to ${missing[0].label}`
                                : "Open settings",
                        href:
                            which === "missing" && missing[0]
                                ? missing[0].href
                                : "/admin/settings",
                    },
                };
            },
        }),
    };
}
