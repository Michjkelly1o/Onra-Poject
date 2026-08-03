"use client";
import type { InsightCard } from "@/lib/agent/cards";
import { LineChart } from "@/components/LineChart";
import { BarChart } from "@/components/BarChart";
import { Donut } from "@/components/Donut";
import { ExportCard } from "@/components/ExportCard";

function DeepLink({ label }: { label?: string }) {
  if (!label) return null;
  return <div className="deeplink">↗ {label}</div>;
}

export function Card({ data }: { data: InsightCard }) {
  if (!data || typeof data !== "object" || !("card" in data)) return null;

  if (data.card === "line_chart") {
    return (
      <div className="card">
        <h4>{data.title}</h4>
        <LineChart
          series={data.series}
          unit={data.unit}
          valueLabel={data.valueLabel}
        />
        {data.note && <div className="note">{data.note}</div>}
        <DeepLink label={data.deepLink} />
      </div>
    );
  }

  if (data.card === "bar_chart") {
    return (
      <div className="card">
        <h4>{data.title}</h4>
        <BarChart bars={data.bars} unit={data.unit} maxValue={data.maxValue} />
        {data.note && <div className="note">{data.note}</div>}
        <DeepLink label={data.deepLink} />
      </div>
    );
  }

  if (data.card === "donut") {
    return (
      <div className="card">
        <h4>{data.title}</h4>
        <Donut
          segments={data.segments}
          unit={data.unit}
          centerLabel={data.centerLabel}
          centerValue={data.centerValue}
        />
        {data.note && <div className="note">{data.note}</div>}
        <DeepLink label={data.deepLink} />
      </div>
    );
  }

  if (data.card === "metric_group") {
    return (
      <div className="card">
        {data.title && <h4>{data.title}</h4>}
        <div className="tiles">
          {data.tiles.map((t, i) => (
            <div className="tile" key={i}>
              <div className="lbl">{t.label}</div>
              <div className="val">{t.value}</div>
            </div>
          ))}
        </div>
        {data.note && <div className="note">{data.note}</div>}
        <DeepLink label={data.deepLink} />
      </div>
    );
  }

  if (data.card === "ranked_list") {
    return (
      <div className="card ranked">
        <h4>{data.title}</h4>
        {data.rows.map((r, i) => (
          <div className="item" key={i}>
            <div>
              <div className="t">{r.title}</div>
              {r.subtitle && <div className="s">{r.subtitle}</div>}
            </div>
            <div className="r">
              {r.right1 && <div className="r1">{r.right1}</div>}
              {r.right2 && <div className="r2">{r.right2}</div>}
            </div>
          </div>
        ))}
        {data.note && <div className="note">{data.note}</div>}
        <DeepLink label={data.deepLink} />
      </div>
    );
  }

  if (data.card === "data_table") {
    return (
      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              {data.columns.map((c, i) => (
                <th key={i}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.note && <div className="note">{data.note}</div>}
      </div>
    );
  }

  if (data.card === "export") {
    return (
      <ExportCard
        exportId={data.exportId}
        title={data.title}
        rowCount={data.rowCount}
        columns={data.columns}
      />
    );
  }

  if (data.card === "empty") {
    return <div className="card empty-card">{data.message}</div>;
  }
  return null;
}
