"use client";

import { useState } from "react";
import { revenueByMonth, attendanceByDay, classByPopularity, memberGrowth, classTypes, instructors, products } from "@/lib/mock-data";
import { useDataStore } from "@/lib/data-store";
import { cn, formatCurrency } from "@/lib/utils";
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";

const tabs = [
    { id: "class", label: "Class Performance" },
    { id: "packages", label: "Packages" },
    { id: "members", label: "Member Behavior" },
    { id: "sales", label: "Sales" },
    { id: "revenue", label: "Revenue" },
    { id: "retail", label: "Retail & Inventory" },
    { id: "frozen", label: "Frozen Packages" },
];

const datePresets = ["MTD", "YTD", "Last 30d", "Last 90d", "Custom"];

const COLORS = ["#6c47ff", "#34d399", "#f59e0b", "#ef4444", "#0891b2"];

const packageData = [
    { name: "10-Class Pack", used: 42, remaining: 18 },
    { name: "5-Class Reformer", used: 28, remaining: 7 },
    { name: "20-Class Pack", used: 65, remaining: 35 },
    { name: "Intro Offer", used: 12, remaining: 0 },
];

const salesByPackage = [
    { name: "10-Class Pack", sales: 9500, count: 10 },
    { name: "20-Class Pack", sales: 8500, count: 5 },
    { name: "5-Class Reformer", sales: 3600, count: 6 },
    { name: "Intro Offer", sales: 1500, count: 10 },
    { name: "Unlimited Monthly", sales: 6000, count: 5 },
    { name: "8x Monthly", sales: 4800, count: 6 },
];

const revenueBreakdown = [
    { name: "Recognized", value: 5600 },
    { name: "Deferred", value: 2800 },
    { name: "Expired", value: 400 },
];

// ── CSV Export Utility ──
function downloadCSV(filename: string, headers: string[], rows: string[][]) {
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── PDF Export Utility (simple text-based) ──
function downloadPDF(title: string, content: string) {
    // Simple HTML-to-print approach
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
        <html><head><title>${title}</title>
        <style>body{font-family:system-ui;padding:40px;color:#111}h1{font-size:20px;margin-bottom:16px}
        table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
        th{background:#f7f7f7;font-weight:600}</style></head>
        <body><h1>${title}</h1>${content}</body></html>
    `);
    printWindow.document.close();
    printWindow.print();
}

export default function ReportsPage() {
    const { userPackages, packages } = useDataStore();
    const [activeTab, setActiveTab] = useState("class");
    const [datePreset, setDatePreset] = useState("MTD");
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Frozen packages data
    const frozenPackages = userPackages.filter(up => up.status === "frozen").map(up => {
        const pkg = packages.find(p => p.id === up.package_id);
        return { ...up, packageName: pkg?.name || "Unknown" };
    });

    // Retail data from products
    const retailData = products.map(p => ({
        name: p.name,
        stock: p.stock_quantity,
        price: p.price,
        value: p.stock_quantity * p.price,
        category: p.category,
    }));

    const totalRetailValue = retailData.reduce((sum, r) => sum + r.value, 0);
    const lowStockItems = retailData.filter(r => r.stock < 10);

    // ── Export Handlers ──
    const handleExportCSV = () => {
        setShowExportMenu(false);
        if (activeTab === "class") {
            downloadCSV("class_performance", ["Class", "Bookings", "Occupancy %"], classByPopularity.map(c => [c.name, String(c.bookings), String(c.occupancy)]));
        } else if (activeTab === "revenue") {
            downloadCSV("revenue_report", ["Month", "Recognized", "Deferred"], revenueByMonth.map(r => [r.month, String(r.recognized), String(r.deferred)]));
        } else if (activeTab === "retail") {
            downloadCSV("retail_inventory", ["Product", "Category", "Stock", "Price", "Value"], retailData.map(r => [r.name, r.category, String(r.stock), String(r.price), String(r.value)]));
        } else if (activeTab === "frozen") {
            downloadCSV("frozen_packages", ["Package", "Credits Remaining", "Status"], frozenPackages.map(f => [f.packageName, String(f.credits_remaining), f.status]));
        } else if (activeTab === "sales") {
            downloadCSV("sales_report", ["Product", "Sales (AED)", "Count"], salesByPackage.map(s => [s.name, String(s.sales), String(s.count)]));
        } else if (activeTab === "members") {
            downloadCSV("member_growth", ["Month", "New", "Total"], memberGrowth.map(m => [m.month, String(m.new), String(m.total)]));
        } else {
            downloadCSV("packages_report", ["Package", "Used", "Remaining"], packageData.map(p => [p.name, String(p.used), String(p.remaining)]));
        }
    };

    const handleExportPDF = () => {
        setShowExportMenu(false);
        const title = `SyncFit Report — ${tabs.find(t => t.id === activeTab)?.label || activeTab}`;
        let tableHTML = "<table><thead><tr>";
        if (activeTab === "class") {
            tableHTML += "<th>Class</th><th>Bookings</th><th>Occupancy</th></tr></thead><tbody>";
            classByPopularity.forEach(c => { tableHTML += `<tr><td>${c.name}</td><td>${c.bookings}</td><td>${c.occupancy}%</td></tr>`; });
        } else if (activeTab === "revenue") {
            tableHTML += "<th>Month</th><th>Recognized</th><th>Deferred</th></tr></thead><tbody>";
            revenueByMonth.forEach(r => { tableHTML += `<tr><td>${r.month}</td><td>AED ${r.recognized}</td><td>AED ${r.deferred}</td></tr>`; });
        } else if (activeTab === "retail") {
            tableHTML += "<th>Product</th><th>Category</th><th>Stock</th><th>Price</th><th>Value</th></tr></thead><tbody>";
            retailData.forEach(r => { tableHTML += `<tr><td>${r.name}</td><td>${r.category}</td><td>${r.stock}</td><td>AED ${r.price}</td><td>AED ${r.value}</td></tr>`; });
        } else {
            tableHTML += "<th>Item</th><th>Value</th></tr></thead><tbody>";
            tableHTML += `<tr><td>Report type</td><td>${activeTab}</td></tr>`;
        }
        tableHTML += "</tbody></table>";
        downloadPDF(title, tableHTML);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
                    <p className="text-sm text-gray-500 mt-1">Track performance, revenue, and member behavior</p>
                </div>
                <div className="relative">
                    <button
                        onClick={() => setShowExportMenu(!showExportMenu)}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Export
                    </button>
                    {showExportMenu && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-fade-in">
                            <button
                                onClick={handleExportCSV}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                                Export as CSV
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                                <FileText className="w-4 h-4 text-red-500" />
                                Export as PDF
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-4 flex items-center gap-4 flex-wrap">
                <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                    {datePresets.map((p) => (
                        <button
                            key={p}
                            onClick={() => setDatePreset(p)}
                            className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                datePreset === p ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            )}
                        >
                            {p}
                        </button>
                    ))}
                </div>
                <select className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-200">
                    <option value="">All Instructors</option>
                    {instructors.map((i) => <option key={i.id} value={i.id}>{i.first_name} {i.last_name}</option>)}
                </select>
                <select className="px-3 py-2 border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-200">
                    <option value="">All Class Types</option>
                    {classTypes.map((ct) => <option key={ct.id} value={ct.id}>{ct.name}</option>)}
                </select>
            </div>

            {/* Report Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                            activeTab === tab.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="animate-fade-in">
                {/* Class Performance */}
                {activeTab === "class" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Avg Occupancy</p>
                                <p className="text-2xl font-bold text-gray-900">78%</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">No-show Rate</p>
                                <p className="text-2xl font-bold text-red-600">4.2%</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Late Cancel Rate</p>
                                <p className="text-2xl font-bold text-amber-600">2.8%</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Total Classes</p>
                                <p className="text-2xl font-bold text-gray-900">68</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                                <h3 className="font-semibold text-gray-900 mb-4">Attendance by Day</h3>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={attendanceByDay} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                        <Bar dataKey="attended" fill="#34d399" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="no_show" fill="#f87171" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                                <h3 className="font-semibold text-gray-900 mb-4">Class by Popularity</h3>
                                <div className="space-y-4">
                                    {classByPopularity.map((cls, i) => (
                                        <div key={cls.name} className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-700">{cls.name}</span>
                                                <span className="text-xs text-gray-500">{cls.bookings} bookings • {cls.occupancy}% occ.</span>
                                            </div>
                                            <div className="w-full bg-gray-100 rounded-full h-2">
                                                <div className="h-2 rounded-full" style={{ width: `${cls.occupancy}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Packages */}
                {activeTab === "packages" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Total Credits Used</p>
                                <p className="text-2xl font-bold text-gray-900">147</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Credits Remaining</p>
                                <p className="text-2xl font-bold text-brand-600">60</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                            <h3 className="font-semibold text-gray-900 mb-4">Credits by Package</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={packageData} layout="vertical" barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} width={140} />
                                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                    <Bar dataKey="used" fill="#6c47ff" radius={[0, 6, 6, 0]} name="Used" />
                                    <Bar dataKey="remaining" fill="#e2e8f0" radius={[0, 6, 6, 0]} name="Remaining" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Member Behavior */}
                {activeTab === "members" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Active Members</p>
                                <p className="text-2xl font-bold text-green-600">72</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Inactive (30d+)</p>
                                <p className="text-2xl font-bold text-red-600">12</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Retention Rate</p>
                                <p className="text-2xl font-bold text-gray-900">86%</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Avg Classes/mo</p>
                                <p className="text-2xl font-bold text-gray-900">4.2</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                            <h3 className="font-semibold text-gray-900 mb-4">Member Growth</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <AreaChart data={memberGrowth}>
                                    <defs>
                                        <linearGradient id="gradMem" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6c47ff" stopOpacity={0.15} />
                                            <stop offset="100%" stopColor="#6c47ff" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                    <Area type="monotone" dataKey="total" stroke="#6c47ff" strokeWidth={2} fill="url(#gradMem)" />
                                    <Line type="monotone" dataKey="new" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399", r: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Sales */}
                {activeTab === "sales" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Total Sales</p>
                                <p className="text-2xl font-bold text-gray-900">{formatCurrency(33900)}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Online Sales</p>
                                <p className="text-2xl font-bold text-blue-600">{formatCurrency(21400)}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">In-Studio Sales</p>
                                <p className="text-2xl font-bold text-purple-600">{formatCurrency(12500)}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                            <h3 className="font-semibold text-gray-900 mb-4">Sales by Product</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={salesByPackage}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} angle={-20} textAnchor="end" height={60} />
                                    <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                    <Bar dataKey="sales" fill="#6c47ff" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Revenue */}
                {activeTab === "revenue" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Recognized Revenue</p>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(5600)}</p>
                                <p className="text-xs text-gray-400 mt-1">Credits used this month</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Deferred Revenue</p>
                                <p className="text-2xl font-bold text-amber-600">{formatCurrency(2800)}</p>
                                <p className="text-xs text-gray-400 mt-1">Unused credits</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Expired Package Revenue</p>
                                <p className="text-2xl font-bold text-gray-600">{formatCurrency(400)}</p>
                                <p className="text-xs text-gray-400 mt-1">Unused expired credits</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                                <h3 className="font-semibold text-gray-900 mb-4">Revenue Trend</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <AreaChart data={revenueByMonth}>
                                        <defs>
                                            <linearGradient id="gradRecognized" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#34d399" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gradDeferred" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.2} />
                                                <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                                        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                        <Area type="monotone" dataKey="recognized" stroke="#34d399" strokeWidth={2} fill="url(#gradRecognized)" name="Recognized" />
                                        <Area type="monotone" dataKey="deferred" stroke="#fbbf24" strokeWidth={2} fill="url(#gradDeferred)" name="Deferred" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-soft">
                                <h3 className="font-semibold text-gray-900 mb-4">Revenue Breakdown</h3>
                                <ResponsiveContainer width="100%" height={260}>
                                    <PieChart>
                                        <Pie data={revenueBreakdown} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value">
                                            {revenueBreakdown.map((entry, i) => (
                                                <Cell key={entry.name} fill={["#34d399", "#fbbf24", "#94a3b8"][i]} />
                                            ))}
                                        </Pie>
                                        <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="flex items-center justify-center gap-4 mt-2">
                                    {revenueBreakdown.map((entry, i) => (
                                        <span key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ["#34d399", "#fbbf24", "#94a3b8"][i] }} />
                                            {entry.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Retail & Inventory */}
                {activeTab === "retail" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Total Inventory Value</p>
                                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalRetailValue)}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Total Products</p>
                                <p className="text-2xl font-bold text-brand-600">{retailData.length}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Low Stock Alerts</p>
                                <p className="text-2xl font-bold text-amber-600">{lowStockItems.length}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-900">Inventory Report</h3>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Product</th>
                                        <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Category</th>
                                        <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Stock</th>
                                        <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Unit Price</th>
                                        <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Total Value</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {retailData.map((item, i) => (
                                        <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/50">
                                            <td className="px-6 py-3 text-sm font-medium text-gray-900">{item.name}</td>
                                            <td className="px-6 py-3 text-sm text-gray-500 capitalize">{item.category}</td>
                                            <td className={cn("px-6 py-3 text-sm text-right font-medium", item.stock < 10 ? "text-amber-600" : "text-gray-900")}>
                                                {item.stock}
                                                {item.stock < 10 && <span className="ml-1 text-[10px] text-amber-500">Low</span>}
                                            </td>
                                            <td className="px-6 py-3 text-sm text-gray-700 text-right">{formatCurrency(item.price)}</td>
                                            <td className="px-6 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(item.value)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Frozen Packages */}
                {activeTab === "frozen" && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Frozen Packages</p>
                                <p className="text-2xl font-bold text-blue-600">{frozenPackages.length}</p>
                            </div>
                            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                                <p className="text-xs text-gray-500 mb-1">Frozen Credits Value</p>
                                <p className="text-2xl font-bold text-gray-900">
                                    {frozenPackages.reduce((sum, f) => sum + f.credits_remaining, 0)} credits
                                </p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                            <div className="px-6 py-4 border-b border-gray-100">
                                <h3 className="font-semibold text-gray-900">Frozen Package Details</h3>
                            </div>
                            {frozenPackages.length > 0 ? (
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50">
                                            <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Package</th>
                                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Credits Remaining</th>
                                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Credits Purchased</th>
                                            <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Expires</th>
                                            <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {frozenPackages.map((fp) => (
                                            <tr key={fp.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                                <td className="px-6 py-3 text-sm font-medium text-gray-900">{fp.packageName}</td>
                                                <td className="px-6 py-3 text-sm text-gray-700 text-right">{fp.credits_remaining}</td>
                                                <td className="px-6 py-3 text-sm text-gray-700 text-right">{fp.credits_total}</td>
                                                <td className="px-6 py-3 text-sm text-gray-500">{new Date(fp.expires_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-3">
                                                    <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-medium">Frozen</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="px-6 py-12 text-center">
                                    <p className="text-sm text-gray-400">No frozen packages at this time</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
