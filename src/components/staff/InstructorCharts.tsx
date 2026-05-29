"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Instructor detail charts
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references (file nzV4uBZZ4MWQAKNs6lnW0O):
//   • 7127-147606 — Overall performance line chart (retention rate %)
//   • 7127-147672 — Class bookings line chart
//   • 7127-147673 — Attendance overview bar chart (visits / cancellations / no-show)
//
// Mirrors the Recharts setup used by [DashboardWidgetCard](../dashboard/DashboardWidgetCard.tsx)
// so the staff detail Overview tab feels identical to the dashboard:
// shared `ChartTooltip` shape, same axis chrome (no axis line, no tick line,
// grey labels), same `f2f4f7` cartesian grid.

import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from "recharts";

// ─── Shared tooltip (lifted from DashboardWidgetCard) ─────────────────────

interface TooltipPayloadEntry {
    name: string;
    value: number;
    color: string;
    dataKey: string;
}
interface ChartTooltipProps {
    active?: boolean;
    label?: string;
    payload?: TooltipPayloadEntry[];
}
function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map(p => (
                <p key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#475467]">{p.name}:</span>
                    <span className="font-medium text-[#101828]">{p.value}</span>
                </p>
            ))}
        </div>
    );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
    return (
        <div className="flex items-center gap-4 justify-end flex-wrap">
            {items.map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                    <span className="text-xs text-[#667085]">{l.label}</span>
                </div>
            ))}
        </div>
    );
}

const AXIS_PROPS = {
    axisLine: false,
    tickLine: false,
    tick: { fill: "#667085", fontSize: 10, dy: 6 },
} as const;

// ─── Public chart card ───────────────────────────────────────────────────

interface ChartCardProps {
    title: string;
    /** Card surrounds the chart with a 12px-border card matching the
     *  Figma "Performance" / "Class bookings" frames. */
    children: React.ReactNode;
}
function ChartCard({ title, children }: ChartCardProps) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-[14px] text-[#667085]">{title}</p>
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4">
                {children}
            </div>
        </div>
    );
}

// ─── Performance line chart (retention rate %) ───────────────────────────

export interface LinePoint { date: string; value: number }

export function PerformanceLineChart({ title, data, color, valueLabel, valueSuffix = "" }: {
    title: string;
    data: LinePoint[];
    /** Stroke color — `#92d1de` (cyan) for Overall performance, `#92baa4`
     *  (sage) for Class bookings. */
    color: string;
    /** Display name for the value in the tooltip — "Retention rate",
     *  "Total booking", etc. */
    valueLabel: string;
    valueSuffix?: string;
}) {
    // The recharts payload renders `value: <number>` — to surface "70%" or
    // similar units inline we wrap the data points so the rendered series
    // carries a pre-formatted number we can display directly.
    return (
        <ChartCard title={title}>
            <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="#f2f4f7" />
                    <XAxis dataKey="date" {...AXIS_PROPS} />
                    <YAxis
                        {...AXIS_PROPS}
                        width={36}
                        tickFormatter={v => `${v}${valueSuffix}`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="value" name={valueLabel} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 5, fill: color }} />
                </LineChart>
            </ResponsiveContainer>
        </ChartCard>
    );
}

// ─── Attendance overview bar chart (3 series) ────────────────────────────

export interface AttendancePoint {
    date: string;
    visits: number;
    cancellations: number;
    noShow: number;
}

const ATTENDANCE_COLORS = {
    visits:        "#b892ba", // Mauve  — "Total visits"
    cancellations: "#92baa4", // Sage   — "Total cancellations"
    noShow:        "#92d1de", // Cyan   — "Total no show"
} as const;

export function AttendanceBarChart({ title, data }: {
    title: string;
    data: AttendancePoint[];
}) {
    return (
        <ChartCard title={title}>
            <div className="flex flex-col gap-2">
                <Legend items={[
                    { color: ATTENDANCE_COLORS.visits,        label: "Total visits" },
                    { color: ATTENDANCE_COLORS.cancellations, label: "Total cancellations" },
                    { color: ATTENDANCE_COLORS.noShow,        label: "Total no show" },
                ]} />
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data} barCategoryGap="30%" margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...AXIS_PROPS} />
                        <YAxis {...AXIS_PROPS} width={28} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                        <Bar dataKey="visits"        name="Visits"        fill={ATTENDANCE_COLORS.visits}        radius={[3,3,0,0]} maxBarSize={10} />
                        <Bar dataKey="cancellations" name="Cancellations" fill={ATTENDANCE_COLORS.cancellations} radius={[3,3,0,0]} maxBarSize={10} />
                        <Bar dataKey="noShow"        name="No show"       fill={ATTENDANCE_COLORS.noShow}        radius={[3,3,0,0]} maxBarSize={10} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </ChartCard>
    );
}
