// ─────────────────────────────────────────────────────────────────────────────
// /ai-agent — full-viewport route for the AI Agent
// ─────────────────────────────────────────────────────────────────────────────
//
// Sits at the root (NOT under /admin/) so the admin sidebar/header layout
// wrapper doesn't render. Same convention as other detail-style routes in
// this app (/customers/[id], /schedule/[classId], /staff/pay-rate/[id]).
//
// URL contract:
//   /ai-agent                          — opens the agent, closes to /admin/dashboard
//   /ai-agent?returnTo=/admin/reports  — opens the agent, closes back to reports
//
// The FloatingAiButton (mounted in the admin layout) supplies `returnTo`
// from the caller's current pathname. Direct URL access uses the default.
//
// Suspense wrapper is required because AiAgentPage reads useSearchParams;
// without it Next.js would opt this route out of static prerendering.

import { Suspense } from "react";
import { AiAgentPage } from "@/ai-agent/components/AiAgentPage";

export default function AiAgentRoute() {
    return (
        <Suspense fallback={null}>
            <AiAgentPage />
        </Suspense>
    );
}
