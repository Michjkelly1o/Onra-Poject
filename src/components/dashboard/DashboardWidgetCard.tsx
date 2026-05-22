"use client";

import { useState, useRef, useEffect } from "react";
import { DotsVertical, Trash01, Plus } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { WIDGET_CATALOG } from "./widget-catalog";
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer,
} from "recharts";

// ─── Shared chart data ────────────────────────────────────────────────────────

const DATES = ["Feb 22", "Feb 23", "Feb 24", "Feb 25", "Feb 26", "Feb 27", "Feb 28"];

const DATA: Record<string, object[]> = {
    "payments-collected": DATES.map((date, i) => ({ date, v: [220, 195, 240, 250, 235, 265, 280][i] })),
    "payments-status":    DATES.map((date, i) => ({ date, paid: [38, 12, 22, 28, 35, 30, 25][i], failed: [8, 12, 6, 10, 4, 8, 5][i] })),
    "payments-by-method": DATES.map((date, i) => ({ date, card: [25, 18, 22, 35, 28, 32, 20][i], cash: [8, 5, 6, 5, 9, 7, 4][i], apple: [5, 3, 4, 4, 6, 5, 3][i] })),
    "payments-by-source": DATES.map((date, i) => ({ date, crm: [4, 3, 5, 4, 6, 4, 3][i], app: [26, 20, 22, 26, 30, 28, 24][i], web: [10, 8, 9, 10, 12, 11, 8][i] })),
    "revenue-overview":   DATES.map((date, i) => ({ date, revenue: [480, 540, 600, 680, 760, 830, 910][i], lastWeek: [640, 610, 630, 615, 595, 605, 610][i] })),
    "sales-by-product":   DATES.map((date, i) => ({ date, membership: [28, 18, 15, 10, 30, 35, 8][i], package: [8, 12, 5, 8, 10, 42, 5][i] })),
    "active-memberships": DATES.map((date, i) => ({ date, v: [28, 30, 32, 35, 34, 38, 42][i] })),
    "active-subscriptions":DATES.map((date, i) => ({ date, v: [32, 33, 35, 34, 37, 40, 44][i] })),
    "active-credits":     DATES.map((date, i) => ({ date, v: [30, 32, 35, 33, 36, 38, 40][i] })),
    "top-memberships": [
        { name: "Beginner",  v: 28 },
        { name: "Unlimited", v: 12 },
        { name: "40 Credit", v: 35 },
        { name: "30 Credit", v: 18 },
        { name: "Advanced",  v: 38 },
    ],
    "memberships-sold":   DATES.map((date, i) => ({ date, beginner: [10, 8, 12, 9, 14, 11, 13][i], advanced: [15, 10, 13, 15, 12, 18, 16][i], unlimited: [7, 6, 8, 7, 9, 8, 10][i] })),
    "class-bookings":     DATES.map((date, i) => ({ date, v: [32, 28, 35, 30, 40, 38, 45][i] })),
    "bookings-by-source": DATES.map((date, i) => ({ date, crm: [4, 3, 5, 4, 6, 4, 3][i], app: [26, 20, 22, 26, 30, 28, 24][i], web: [10, 8, 9, 10, 12, 11, 8][i] })),
    "bookings-vs-visits": DATES.map((date, i) => ({ date, bookings: [35, 28, 32, 40, 38, 42, 36][i], visits: [28, 22, 25, 32, 30, 35, 28][i] })),
    "attendance-overview":DATES.map((date, i) => ({ date, visits: [22, 18, 12, 35, 25, 28, 22][i], cancellations: [8, 30, 10, 6, 22, 24, 20][i], noShow: [3, 4, 2, 3, 2, 3, 2][i] })),
    "class-by-popularity": [
        { name: "Reformer Pilates", instructor: "Sara Al-Rashid", color: "#b892ba", bookings: 142, occupancy: 89 },
        { name: "Mat Pilates",      instructor: "Liam Chen",      color: "#92baa4", bookings: 98,  occupancy: 78 },
        { name: "Barre",            instructor: "Maya Johnson",    color: "#92d1de", bookings: 87,  occupancy: 72 },
        { name: "Roller Release",   instructor: "Liam Chen",      color: "#9ea093", bookings: 45,  occupancy: 65 },
    ],
};

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white border border-[#e4e7ec] rounded-lg shadow-lg px-3 py-2 text-xs min-w-[140px]">
            <p className="font-semibold text-[#101828] mb-1.5">{label}</p>
            {payload.map((p: any) => (
                <p key={p.dataKey} className="flex items-center gap-1.5 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                    <span className="text-[#475467]">{p.name}:</span>
                    <span className="font-medium text-[#101828]">{p.value}</span>
                </p>
            ))}
        </div>
    );
};

// ─── Chart content ────────────────────────────────────────────────────────────

type ChartSize = "mini" | "full";

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

function renderChart(id: string, size: ChartSize): React.ReactNode {
    const h = size === "mini" ? 150 : 240;
    const data = DATA[id] ?? [];
    const axisProps = {
        axisLine: false, tickLine: false,
        tick: { fill: "#667085", fontSize: 10, dy: 6 },
    };

    switch (id) {
        case "payments-collected":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} />
                        <YAxis {...axisProps} width={32} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Payments (AED)" stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "payments-status":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Paid" }, { color: "#f97066", label: "Failed" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="paid" name="Paid" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="failed" name="Failed" fill="#f97066" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "payments-by-method":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "Card" }, { color: "#92d1de", label: "Cash" }, { color: "#92baa4", label: "Apple pay" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="card"  name="Card"      fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="cash"  name="Cash"      fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="apple" name="Apple pay" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "payments-by-source":
        case "bookings-by-source":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "CRM" }, { color: "#92d1de", label: "Customer App" }, { color: "#92baa4", label: "Website" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="crm" name="CRM"          fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="app" name="Customer App" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="web" name="Website"      fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "revenue-overview":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92d1de", label: "Net revenue" }, { color: "#aad4bd", label: "Net revenue last week" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <LineChart data={data}>
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={36} domain={[0, 1200]} ticks={[0,200,400,600,800,1000]} />
                            <Tooltip content={<ChartTooltip />} />
                            <Line type="monotone" dataKey="revenue"  name="Net revenue"      stroke="#92d1de" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="lastWeek" name="Last week"         stroke="#aad4bd" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            );

        case "sales-by-product":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#c4edd6", label: "Membership" }, { color: "#92d1de", label: "Class package" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} domain={[0, 50]} ticks={[0,10,20,30,40,50]} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="membership" name="Membership"   fill="#c4edd6" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="package"    name="Class package" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "active-memberships":
        case "active-subscriptions":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name={id === "active-memberships" ? "Active memberships" : "Active subscriptions"} stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "active-credits":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Active credit packages" stroke="#b892ba" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "top-memberships":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <BarChart data={data} barCategoryGap="35%">
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="name" {...axisProps} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                        <Bar dataKey="v" name="Total purchases" fill="#92d1de" radius={[3,3,0,0]} maxBarSize={32} />
                    </BarChart>
                </ResponsiveContainer>
            );

        case "memberships-sold":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#b892ba", label: "Beginner" }, { color: "#92d1de", label: "Advanced" }, { color: "#92baa4", label: "Unlimited" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="25%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="beginner"  name="Beginner"  fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="advanced"  name="Advanced"  fill="#92d1de" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="unlimited" name="Unlimited" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "class-bookings":
            return (
                <ResponsiveContainer width="100%" height={h}>
                    <LineChart data={data}>
                        <CartesianGrid vertical={false} stroke="#f2f4f7" />
                        <XAxis dataKey="date" {...axisProps} />
                        <YAxis {...axisProps} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="v" name="Total bookings" stroke="#92d1de" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            );

        case "bookings-vs-visits":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Total bookings" }, { color: "#92d1de", label: "Total visits" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="bookings" name="Total bookings" fill="#92baa4" radius={[3,3,0,0]} maxBarSize={10} />
                            <Bar dataKey="visits"   name="Total visits"   fill="#92d1de" radius={[3,3,0,0]} maxBarSize={10} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "attendance-overview":
            return (
                <div className="flex flex-col gap-2">
                    <Legend items={[{ color: "#92baa4", label: "Total visits" }, { color: "#c4edd6", label: "Total cancellations" }, { color: "#b892ba", label: "Total no show" }]} />
                    <ResponsiveContainer width="100%" height={h}>
                        <BarChart data={data} barCategoryGap="30%">
                            <CartesianGrid vertical={false} stroke="#f2f4f7" />
                            <XAxis dataKey="date" {...axisProps} />
                            <YAxis {...axisProps} width={28} domain={[0, 50]} ticks={[0,10,20,30,40,50]} />
                            <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f9fafb" }} />
                            <Bar dataKey="visits"        name="Total visits"        fill="#92baa4" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="cancellations" name="Total cancellations" fill="#c4edd6" radius={[3,3,0,0]} maxBarSize={8} />
                            <Bar dataKey="noShow"        name="No show"             fill="#b892ba" radius={[3,3,0,0]} maxBarSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            );

        case "class-by-popularity": {
            const rows = data as { name: string; instructor: string; color: string; bookings: number; occupancy: number }[];
            return (
                <div className="flex flex-col gap-0 mt-1">
                    {rows.map((cls, idx) => (
                        <div key={cls.name} className={cn("flex items-center gap-3 py-3", idx < rows.length - 1 && "border-b border-[#f9fafb]")}>
                            <div className="w-10 h-10 rounded-md flex-shrink-0 border border-[#e4e7ec] overflow-hidden" style={{ backgroundColor: cls.color + "40" }}>
                                <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${cls.color}80, ${cls.color}20)` }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-[#101828] truncate">{cls.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cls.color }} />
                                    <span className="text-xs text-[#667085]">{cls.instructor}</span>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <p className="text-xs text-[#667085]">{cls.bookings} bookings</p>
                                <p className="text-xs font-medium text-[#475467] mt-0.5">{cls.occupancy}% occupancy</p>
                            </div>
                        </div>
                    ))}
                </div>
            );
        }

        default:
            return null;
    }
}

// ─── Kebab menu (··· → Remove widget) ────────────────────────────────────────

export function WidgetKebabMenu({ onRemove }: { onRemove: () => void }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] border border-[#d0d5dd] bg-white hover:bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
            >
                <DotsVertical className="w-4 h-4 text-[#667085]" />
            </button>
            {open && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-30 bg-white border border-[#e4e7ec] rounded-[12px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1.5 min-w-[160px]">
                    <button
                        type="button"
                        onClick={() => { onRemove(); setOpen(false); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-[14px] font-medium text-[#d92c20] hover:bg-[#fef2f1] transition-colors"
                    >
                        <Trash01 className="w-4 h-4 shrink-0" />
                        Remove widget
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Dashboard widget card ────────────────────────────────────────────────────

interface DashboardWidgetCardProps {
    widgetId: string;
    /** undefined = no action button; "add" = + button; "kebab" = ··· remove menu */
    action?: "add" | "kebab";
    onAdd?: () => void;
    onRemove?: () => void;
    className?: string;
}

export function DashboardWidgetCard({ widgetId, action, onAdd, onRemove, className }: DashboardWidgetCardProps) {
    const meta = WIDGET_CATALOG.find(w => w.id === widgetId);
    if (!meta) return null;

    return (
        <div className={cn("bg-white border border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]", className)}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="font-semibold text-[18px] leading-[28px] text-[#101828] truncate">{meta.title}</p>
                    <p className="text-[14px] text-[#6e776f] truncate mt-0.5">{meta.description}</p>
                </div>
                {action === "add" && (
                    <button
                        type="button"
                        onClick={onAdd}
                        className="w-9 h-9 flex items-center justify-center shrink-0 rounded-[8px] border border-[#d0d5dd] bg-white hover:bg-[#f9fafb] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors"
                    >
                        <Plus className="w-5 h-5 text-[#344054]" />
                    </button>
                )}
                {action === "kebab" && onRemove && (
                    <WidgetKebabMenu onRemove={onRemove} />
                )}
            </div>
            {/* Chart */}
            <div className="min-w-0">
                {renderChart(widgetId, "full")}
            </div>
        </div>
    );
}
