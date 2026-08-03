"use client";
import type { MigrationCard } from "@/lib/agent/migrationCards";

type Actions = {
  send: (text: string) => void;
  openUpload: () => void; // opens the file picker so the user uploads their own CSV
};

export function MigCard({ data, act }: { data: MigrationCard; act: Actions }) {
  if (!data || typeof data !== "object" || !("card" in data)) return null;

  const StepBadge = ({ step }: { step: number }) => (
    <span className="stepbadge">{step} of 4 steps</span>
  );

  if (data.card === "source_options") {
    return (
      <div className="mcard">
        <StepBadge step={data.step} />
        <h4>{data.title}</h4>
        <p className="mbody">{data.body}</p>
        <div className="platforms">
          {data.platforms.map((p) => (
            <button
              key={p.slug}
              className={`platform ${p.slug === "upload" ? "platform-upload" : ""}`}
              onClick={() =>
                p.slug === "upload"
                  ? act.openUpload()
                  : act.send(`I'm migrating from ${p.name}. I'll upload my customer export.`)
              }
            >
              {p.slug === "upload" ? "📄 " : "◆ "}
              {p.name}
            </button>
          ))}
        </div>
        <div className="mhint">
          Choose your platform, then click <b>Upload file</b> (or the 📎) to add your CSV —
          the upload only happens when you pick a file, and I read your actual data.
        </div>
      </div>
    );
  }

  if (data.card === "branch_assignment") {
    if (data.blocked?.reason === "no_branches") {
      return (
        <div className="mcard">
          <StepBadge step={data.step} />
          <p className="mbody">
            I couldn&apos;t find a branch column, and no studio branches exist yet. Create a
            branch first to continue assigning imported records.
          </p>
          <button className="mbtn" onClick={() => act.send("Add a new branch")}>
            + Add new branch
          </button>
        </div>
      );
    }
    return (
      <div className="mcard">
        <StepBadge step={data.step} />
        {data.filename && (
          <div className="fileread">
            <div className="filereadhead">
              📄 {data.filename}
              <span className="filereadmeta">
                {data.rowCount} rows · {data.columns?.length ?? 0} columns read
              </span>
            </div>
            {data.columns && (
              <div className="colchips">
                {data.columns.map((c) => (
                  <span className="colchip" key={c}>
                    {c}
                  </span>
                ))}
              </div>
            )}
            {data.sample && data.sample.length > 0 && (
              <table className="tbl sampletbl">
                <thead>
                  <tr>
                    {data.columns?.slice(0, 5).map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.sample.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {data.note && <p className="mbody">{data.note}</p>}
        {data.rows.length > 0 && (
          <div className="branchlist">
            {data.rows.map((r, i) => (
              <div className="branchrow" key={i}>
                <span>🏢 {r.branch_name}</span>
                <span className="muted">{r.count} rows</span>
              </div>
            ))}
          </div>
        )}
        <button className="mbtn primary" onClick={() => act.send("Looks good — map the columns.")}>
          Continue to mapping
        </button>
      </div>
    );
  }

  if (data.card === "column_mapping") {
    return (
      <div className="mcard">
        <StepBadge step={data.step} />
        <div className="mhead">
          <h4 style={{ margin: 0 }}>Column mapping</h4>
          <div>
            <span className="pill green">{data.summary.mapped} mapped</span>
            {data.summary.needs_review > 0 && (
              <span className="pill amber">{data.summary.needs_review} need review</span>
            )}
          </div>
        </div>
        <div className="maprows">
          {data.mappings.map((m, i) => (
            <div className="maprow" key={i}>
              <div className="src">{m.source}</div>
              <select
                className={`tgt ${m.status === "needs_review" ? "review" : ""}`}
                defaultValue={m.target ?? "__skip"}
              >
                <option value="__skip">Skip this column</option>
                {data.targetOptions.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <div className="mactions">
          <button className="mbtn primary" onClick={() => act.send("Accept all suggested mappings and preview the import.")}>
            ✓ Accept all suggestions
          </button>
          <button className="mbtn" onClick={() => act.send("Skip the unmatched columns and preview the import.")}>
            Skip unmatched
          </button>
        </div>
      </div>
    );
  }

  if (data.card === "mapping_summary") {
    const t = data.totals;
    return (
      <div className="mcard">
        <StepBadge step={data.step} />
        <div className="mhead">
          <h4 style={{ margin: 0 }}>Summary</h4>
          <span className="pill green">{data.columnsNote}</span>
        </div>
        <div className="tiles four">
          <Tile label="Total rows" value={t.total} />
          <Tile label="Valid rows" value={t.valid} tone="green" />
          <Tile label="Invalid rows" value={t.invalid} tone={t.invalid ? "red" : undefined} />
          <Tile label="Duplicate rows" value={t.duplicate} tone={t.duplicate ? "amber" : undefined} />
        </div>
        <table className="tbl" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>Incoming field</th>
              <th>Onra field</th>
            </tr>
          </thead>
          <tbody>
            {data.fields.map((f, i) => (
              <tr key={i}>
                <td>{f.source}</td>
                <td>
                  <span className="pill green">{f.target}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mactions">
          <button className="mbtn primary" onClick={() => act.send("Yes, start the import.")}>
            ✓ Yes, start import
          </button>
          <button className="mbtn" onClick={() => act.send("No, take me back to mapping.")}>
            ✕ No, back to mapping
          </button>
        </div>
      </div>
    );
  }

  if (data.card === "import_result") {
    if (data.created + data.skipped + data.failed === 0) {
      return (
        <div className="mcard">
          <p className="mbody">
            Nothing to import yet — upload your customer export to begin.
          </p>
        </div>
      );
    }
    return (
      <div className="mcard">
        <div className="donebadge">✓ Import complete</div>
        <div className="tiles three">
          <Tile label="Created" value={data.created} tone="green" />
          <Tile label="Skipped (dupes)" value={data.skipped} tone="amber" />
          <Tile label="Failed" value={data.failed} tone={data.failed ? "red" : undefined} />
        </div>
      </div>
    );
  }
  return null;
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "green" | "red" | "amber";
}) {
  const color =
    tone === "green"
      ? "#658774"
      : tone === "red"
        ? "#b42318"
        : tone === "amber"
          ? "#b54708"
          : "#101828";
  return (
    <div className="tile">
      <div className="lbl">{label}</div>
      <div className="val" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
