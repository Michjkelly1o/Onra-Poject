// In-memory store for generated exports. Keeps the (possibly large) tabular data
// server-side so it never enters the model's context — the tool returns only a
// small reference {exportId, rowCount, columns}. Downloads pull from here.
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

const g = globalThis as unknown as { __exportStore?: ExportStoreImpl };
export const exportStore = g.__exportStore ?? (g.__exportStore = new ExportStoreImpl());
