import { streamText } from "ai";
import { claude } from "@/lib/agent/model";
import { resolveAuthContext } from "@/lib/agent/auth";
import { buildInsightPrompt, buildMigrationPrompt } from "@/lib/agent/prompt";
import { insightTools } from "@/lib/agent/tools";
import { migrationTools } from "@/lib/agent/migrationTools";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, mode, migrationSessionId } = await req.json();

  // Scope is derived server-side, never from the client/model.
  const ctx = resolveAuthContext();
  const today = new Date().toISOString().slice(0, 10);
  const isMigration = mode === "migration";

  // Mode gates which tools + prompt are active. Write tools are simply absent
  // during insight (analytics) — a nice safety property.
  const result = streamText({
    model: claude("claude-sonnet-5"),
    system: isMigration
      ? buildMigrationPrompt(ctx, today)
      : buildInsightPrompt(ctx, today),
    tools: isMigration
      ? migrationTools(ctx, migrationSessionId ?? "default")
      : insightTools(ctx),
    maxSteps: 6,
    messages,
    onError: ({ error }) => console.error("[agent] streamText error:", error),
  });

  return result.toDataStreamResponse({
    getErrorMessage: (error) =>
      error instanceof Error ? error.message : String(error),
  });
}
