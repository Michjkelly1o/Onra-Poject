"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import {
    revenueProjection,
    churnRiskSummary,
    aiInsights,
    members,
} from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
    Brain,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    UserX,
    Zap,
    ChevronRight,
    Sparkles,
    ShieldAlert,
    BarChart3,
    Target,
} from "lucide-react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Line,
} from "recharts";

const severityStyles = {
    critical: { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", icon: ShieldAlert, iconColor: "text-red-500", dot: "bg-red-500" },
    high: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", icon: AlertTriangle, iconColor: "text-orange-500", dot: "bg-orange-500" },
    positive: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", icon: TrendingUp, iconColor: "text-emerald-500", dot: "bg-emerald-500" },
    info: { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: Zap, iconColor: "text-blue-500", dot: "bg-blue-500" },
};

export default function InsightsPage() {
    const [dismissedIds, setDismissedIds] = useState<string[]>([]);

    const activeInsights = aiInsights.filter(i => !dismissedIds.includes(i.id));

    // Churn risk members
    const atRiskMembers = members
        .filter(m => (m.churn_risk_score ?? 0) >= 40)
        .sort((a, b) => (b.churn_risk_score ?? 0) - (a.churn_risk_score ?? 0));

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-purple-200">
                            <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">AI Insights</h1>
                            <p className="text-sm text-gray-500 mt-0.5">Smart analytics powered by machine learning</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-violet-50 rounded-full border border-violet-200">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-medium text-violet-700">AI-Powered</span>
                </div>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover-lift">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-violet-100">
                            <Target className="w-4 h-4 text-violet-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Projected Revenue</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">AED 11,500</p>
                    <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">+12% by July</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover-lift">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-red-100">
                            <UserX className="w-4 h-4 text-red-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Churn Risk</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{churnRiskSummary.totalAtRisk} Members</p>
                    <div className="flex items-center gap-1 mt-1">
                        <TrendingDown className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs text-emerald-600 font-medium">{churnRiskSummary.trend}% vs last month</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover-lift">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-amber-100">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 uppercase">Churn Rate</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{churnRiskSummary.projectedChurnRate}%</p>
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-500">Industry avg: 12%</span>
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft hover-lift">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-lg bg-emerald-100">
                            <BarChart3 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 uppercase">AI Confidence</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">87%</p>
                    <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-gray-500">Based on 6 months of data</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Projection Chart */}
                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="font-semibold text-gray-900">Revenue Forecast</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Projected revenue for the next 6 months</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                Actual
                            </span>
                            <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-violet-400" />
                                Projected
                            </span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={revenueProjection}>
                            <defs>
                                <linearGradient id="gradProjected" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                            <Area type="monotone" dataKey="projected" stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 4" fill="url(#gradProjected)" />
                            <Line type="monotone" dataKey="actual" stroke="#34d399" strokeWidth={2.5} dot={{ fill: "#34d399", r: 5 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Churn Risk Members */}
                <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-gray-900">At-Risk Members</h3>
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-full font-semibold">
                            {atRiskMembers.length} flagged
                        </span>
                    </div>
                    <div className="space-y-3">
                        {atRiskMembers.map(member => {
                            const score = member.churn_risk_score ?? 0;
                            const riskLevel = score >= 80 ? "critical" : score >= 60 ? "high" : "medium";
                            const riskColor = riskLevel === "critical" ? "text-red-600 bg-red-50" : riskLevel === "high" ? "text-orange-600 bg-orange-50" : "text-amber-600 bg-amber-50";
                            const barColor = riskLevel === "critical" ? "bg-red-500" : riskLevel === "high" ? "bg-orange-500" : "bg-amber-500";

                            return (
                                <div key={member.id} className="p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
                                                {member.first_name[0]}{member.last_name[0]}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-900">{member.first_name} {member.last_name}</p>
                                                <p className="text-[10px] text-gray-500">{member.email}</p>
                                            </div>
                                        </div>
                                        <span className={cn("text-xs font-bold px-2 py-0.5 rounded-full", riskColor)}>
                                            {score}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                        <div className={cn("h-1.5 rounded-full transition-all", barColor)} style={{ width: `${score}%` }} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* AI Action Cards */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 text-lg">Actionable Insights</h3>
                    <span className="text-xs text-gray-500">{activeInsights.length} active</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeInsights.map(insight => {
                        const style = severityStyles[insight.severity as keyof typeof severityStyles];
                        const Icon = style.icon;
                        return (
                            <div key={insight.id} className={cn("rounded-2xl p-5 border transition-all hover:shadow-md", style.bg, style.border)}>
                                <div className="flex items-start gap-3">
                                    <div className={cn("p-2 rounded-lg bg-white/60")}>
                                        <Icon className={cn("w-5 h-5", style.iconColor)} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={cn("w-1.5 h-1.5 rounded-full", style.dot)} />
                                            <h4 className={cn("text-sm font-semibold", style.text)}>{insight.title}</h4>
                                        </div>
                                        <p className="text-xs text-gray-600 leading-relaxed">{insight.description}</p>
                                        <div className="flex items-center justify-between mt-3">
                                            <button className={cn("text-xs font-medium flex items-center gap-1", style.text)}>
                                                {insight.actionLabel} <ChevronRight className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => setDismissedIds(prev => [...prev, insight.id])}
                                                className="text-[10px] text-gray-400 hover:text-gray-600"
                                            >
                                                Dismiss
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
