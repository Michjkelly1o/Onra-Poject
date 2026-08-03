"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

type Unit = "AED" | "count";
type Seg = { label: string; value: number };

const PALETTE = ["#658774", "#aad4bd", "#e4e7ec", "#f0a875", "#7ba08c", "#c4edd6"];
const fmt = (v: number, unit?: Unit) =>
  unit === "AED" ? `AED ${Math.round(v).toLocaleString("en-US")}` : Math.round(v).toLocaleString("en-US");

export function Donut({
  segments,
  unit,
  centerLabel,
  centerValue,
}: {
  segments: Seg[];
  unit?: Unit;
  centerLabel?: string;
  centerValue?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;

  // Build cumulative arcs (pathLength = 100 normalizes the circle).
  let acc = 0;
  const arcs = segments.map((s, i) => {
    const pct = (s.value / total) * 100;
    const start = acc;
    acc += pct;
    return { ...s, pct, start, color: PALETTE[i % PALETTE.length] };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ctx = gsap.context(() => {
      const circles = el.querySelectorAll<SVGCircleElement>(".arc");
      circles.forEach((c) => {
        const pct = Number(c.dataset.pct);
        gsap.fromTo(
          c,
          { strokeDashoffset: pct },
          { strokeDashoffset: 0, duration: 1.0, ease: "power2.out" },
        );
      });
    }, el);
    return () => ctx.revert();
    // Stable key — avoid restarting on every streaming re-render (new array ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.map((s) => `${s.label}:${s.value}`).join("|")]);

  const R = 42;
  const CX = 60;
  return (
    <div className="donutwrap">
      <div className="donutsvg">
        <svg ref={ref} viewBox="0 0 120 120" width="132" height="132">
          <circle cx={CX} cy={CX} r={R} fill="none" stroke="#f2f4f7" strokeWidth="14" />
          {arcs.map((a, i) => (
            <circle
              key={i}
              className="arc"
              data-pct={a.pct}
              cx={CX}
              cy={CX}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="14"
              pathLength={100}
              strokeDasharray={`${a.pct} ${100 - a.pct}`}
              strokeDashoffset={a.pct}
              transform={`rotate(${-90 + a.start * 3.6} ${CX} ${CX})`}
            />
          ))}
          {(centerValue || centerLabel) && (
            <>
              <text x={CX} y={CX - 2} textAnchor="middle" fontSize="18" fontWeight="600" fill="#101828">
                {centerValue}
              </text>
              <text x={CX} y={CX + 15} textAnchor="middle" fontSize="10" fill="#667085">
                {centerLabel}
              </text>
            </>
          )}
        </svg>
      </div>
      <div className="donutlegend">
        {arcs.map((a, i) => (
          <div className="legrow" key={i}>
            <span className="dot" style={{ background: a.color }} />
            <span className="leglabel">{a.label}</span>
            <span className="legval">
              {fmt(a.value, unit)} · {Math.round(a.pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
