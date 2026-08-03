"use client";
import { useEffect, useRef } from "react";
import gsap from "gsap";

type Unit = "AED" | "count" | "rating";
type Bar = { label: string; sublabel?: string; value: number };

const fmt = (v: number, unit?: Unit) =>
  unit === "AED"
    ? `AED ${Math.round(v).toLocaleString("en-US")}`
    : unit === "rating"
      ? `${v.toFixed(2)}★`
      : Math.round(v).toLocaleString("en-US");

export function BarChart({
  bars,
  unit,
  maxValue,
}: {
  bars: Bar[];
  unit?: Unit;
  maxValue?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const max = maxValue ?? Math.max(...bars.map((b) => b.value), 1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fills = el.querySelectorAll(".barfill");
    // clearProps on completion → resting state is natural full width (scaleX 1),
    // so bars are always correct even if the effect re-runs (Strict Mode).
    const tw = gsap.fromTo(
      fills,
      { scaleX: 0 },
      {
        scaleX: 1,
        duration: 0.9,
        ease: "power3.out",
        stagger: 0.08,
        transformOrigin: "left center",
        clearProps: "transform",
      },
    );
    return () => {
      tw.kill();
      gsap.set(fills, { clearProps: "transform" });
    };
    // Key off a stable string, not the array ref — streaming re-renders create a
    // new `bars` reference each token and would otherwise restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars.map((b) => `${b.label}:${b.value}`).join("|")]);

  return (
    <div className="barchart" ref={ref}>
      {bars.map((b, i) => (
        <div className="barrow" key={i}>
          <div className="barhead">
            <span className="barlabel">
              {b.label}
              {b.sublabel && <span className="barsub"> · {b.sublabel}</span>}
            </span>
            <span className="barval">{fmt(b.value, unit)}</span>
          </div>
          <div className="bartrack">
            <div
              className="barfill"
              style={{ width: `${Math.max(2, (b.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
