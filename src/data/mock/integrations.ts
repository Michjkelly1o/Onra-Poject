// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `integrations` seed (PRD 11 §8 / Phase 1)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors Figma `4457-22091` (Integrations card grid) — 4 demo rows in the
// order the Figma shows them across a 3-column grid:
//   1. Google Calendar     · row 1, col 1
//   2. Apple Calendar      · row 1, col 2
//   3. Google Analytics    · row 1, col 3
//   4. WhatsApp Business   · row 2, col 1
//
// All four start in `not_connected` state — Phase 1 surfaces the Connect
// button, Phase 2 wires the per-tool Connect modal → Loading → success
// toast → connected card state.
//
// Copy is lifted verbatim from the Figma so the cards read identically:
//   • Google Calendar    — "Sync classes and private sessions to your Google Calendar."
//   • Apple Calendar     — "Keep your teaching schedule updated on all Apple devices."
//   • Google Analytics   — "Track dashboard traffic and user booking behavior."
//   • WhatsApp Business  — "Send automated booking confirmations and reminders."

import type { IntegrationSeed } from "./_types";

export const integrations: IntegrationSeed[] = [
    {
        id: "int_google_calendar",
        slug: "google_calendar",
        name: "Google Calendar",
        description: "Sync classes and private sessions to your Google Calendar.",
        status: "not_connected",
    },
    {
        id: "int_apple_calendar",
        slug: "apple_calendar",
        name: "Apple Calendar",
        description: "Keep your teaching schedule updated on all Apple devices.",
        status: "not_connected",
    },
    {
        id: "int_google_analytics",
        slug: "google_analytics",
        name: "Google Analytics",
        description: "Track dashboard traffic and user booking behavior.",
        status: "not_connected",
    },
    {
        id: "int_whatsapp_business",
        slug: "whatsapp_business",
        name: "WhatsApp Business",
        description: "Send automated booking confirmations and reminders.",
        status: "not_connected",
    },
];
