// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Export store (in-memory, server-side)
// ─────────────────────────────────────────────────────────────────────────────
//
// Holds generated export tables so the (possibly large) tabular data lives
// server-side and never enters the model context. The `export_report`
// tool returns only a small reference `{ exportId, rowCount, columns }`,
// and the client downloads via `GET /api/ai-agent/export?id=…`.
//
// Cache lives on `globalThis` so hot-reloads in dev + a warm serverless
// container reuse the same map. Cold-starts (Vercel Hobby) may lose
// entries; the client should re-run the export tool if a download 404s.
//
// Ported from ONRA AI-Agent/lib/export/ExportStore.ts.

export interface ExportTable {
    title: string;
    columns: string[];
    rows: string[][];
    createdAt: number;
}

class ExportStoreImpl {
    private map = new Map<string, ExportTable>();
    save(table: Omit<ExportTable, "createdAt">): string {
        const id = `exp_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
        this.map.set(id, { ...table, createdAt: Date.now() });
        return id;
    }
    get(id: string): ExportTable | undefined {
        return this.map.get(id);
    }
}

const g = globalThis as unknown as { __onraAiExportStore?: ExportStoreImpl };
export const exportStore =
    g.__onraAiExportStore ?? (g.__onraAiExportStore = new ExportStoreImpl());
