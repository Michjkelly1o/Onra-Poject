"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { instructorPayRules } from "@/lib/mock-data";
import { cn, formatCurrency } from "@/lib/utils";
import {
    DollarSign,
    Users,
    Clock,
    TrendingUp,
    Edit3,
    Save,
    X,
    Plus,
} from "lucide-react";

const payTypes = ["per_class", "per_head", "hourly", "fixed_monthly"] as const;
const payTypeLabels: Record<string, string> = {
    per_class: "Per Class",
    per_head: "Per Head",
    hourly: "Hourly",
    fixed_monthly: "Fixed Monthly",
};

export default function CompensationPage() {
    const { users, classInstances } = useDataStore();
    const instructors = users.filter(u => u.role === "instructor");
    const [selectedInstructor, setSelectedInstructor] = useState<string | null>(null);

    // Calculate earnings per instructor
    const instructorEarnings = instructors.map(inst => {
        const rule = instructorPayRules.find(r => r.instructor_id === inst.id);
        const classes = classInstances.filter(c => c.instructor_id === inst.id);
        const totalClasses = classes.length;
        const totalStudents = classes.reduce((sum, c) => sum + c.booked_count, 0);
        const totalHours = classes.reduce((sum, c) => {
            const dur = (new Date(c.end_time).getTime() - new Date(c.start_time).getTime()) / 3600000;
            return sum + dur;
        }, 0);

        let estimated = 0;
        if (rule) {
            switch (rule.pay_type) {
                case "per_class": estimated = totalClasses * rule.rate; break;
                case "per_head": estimated = totalStudents * rule.rate; break;
                case "hourly": estimated = totalHours * rule.rate; break;
                case "fixed_monthly": estimated = rule.rate; break;
            }
        }

        return {
            ...inst,
            rule,
            totalClasses,
            totalStudents,
            totalHours: Math.round(totalHours * 10) / 10,
            estimated: Math.round(estimated),
        };
    });

    const totalPayroll = instructorEarnings.reduce((sum, ie) => sum + ie.estimated, 0);
    const avgPerClass = instructorEarnings.reduce((sum, ie) => sum + ie.totalClasses, 0);

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Instructor Compensation</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage pay rules and track instructor earnings</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                            <DollarSign className="w-4.5 h-4.5 text-green-600" />
                        </div>
                        <p className="text-xs text-gray-500">Est. Monthly Payroll</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPayroll)}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                            <Users className="w-4.5 h-4.5 text-blue-600" />
                        </div>
                        <p className="text-xs text-gray-500">Active Instructors</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{instructors.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                            <Clock className="w-4.5 h-4.5 text-purple-600" />
                        </div>
                        <p className="text-xs text-gray-500">Total Classes</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgPerClass}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
                            <TrendingUp className="w-4.5 h-4.5 text-amber-600" />
                        </div>
                        <p className="text-xs text-gray-500">Avg Cost/Class</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(avgPerClass > 0 ? Math.round(totalPayroll / avgPerClass) : 0)}</p>
                </div>
            </div>

            {/* Instructor Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Pay Rules & Earnings</h3>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50">
                            <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Instructor</th>
                            <th className="text-left text-xs font-medium text-gray-500 px-6 py-3">Pay Type</th>
                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Rate</th>
                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Classes</th>
                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Students</th>
                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Hours</th>
                            <th className="text-right text-xs font-medium text-gray-500 px-6 py-3">Est. Earnings</th>
                        </tr>
                    </thead>
                    <tbody>
                        {instructorEarnings.map((ie) => (
                            <tr
                                key={ie.id}
                                className={cn("border-t border-gray-50 hover:bg-gray-50/50 cursor-pointer transition-colors",
                                    selectedInstructor === ie.id && "bg-brand-50/30"
                                )}
                                onClick={() => setSelectedInstructor(selectedInstructor === ie.id ? null : ie.id)}
                            >
                                <td className="px-6 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                                            <span className="text-xs font-semibold text-brand-700">{ie.first_name[0]}{ie.last_name[0]}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{ie.first_name} {ie.last_name}</p>
                                            <p className="text-xs text-gray-400">{ie.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-3">
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium">
                                        {ie.rule ? payTypeLabels[ie.rule.pay_type] : "Not Set"}
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-700 text-right font-medium">
                                    {ie.rule ? formatCurrency(ie.rule.rate) : "—"}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-700 text-right">{ie.totalClasses}</td>
                                <td className="px-6 py-3 text-sm text-gray-700 text-right">{ie.totalStudents}</td>
                                <td className="px-6 py-3 text-sm text-gray-700 text-right">{ie.totalHours}h</td>
                                <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(ie.estimated)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-200 bg-gray-50">
                            <td colSpan={6} className="px-6 py-3 text-sm font-semibold text-gray-700">Total Estimated Payroll</td>
                            <td className="px-6 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(totalPayroll)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Detail Panel */}
            {selectedInstructor && (() => {
                const ie = instructorEarnings.find(i => i.id === selectedInstructor);
                if (!ie) return null;
                const classes = classInstances.filter(c => c.instructor_id === ie.id);
                return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-gray-900">{ie.first_name} {ie.last_name} — Recent Classes</h3>
                            <button onClick={() => setSelectedInstructor(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {classes.slice(0, 8).map(cls => (
                                <div key={cls.id} className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: cls.class_type?.color }} />
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{cls.class_type?.name}</p>
                                            <p className="text-xs text-gray-400">{new Date(cls.start_time).toLocaleDateString()} · {cls.booked_count} students</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-700">
                                        {ie.rule?.pay_type === "per_class" && formatCurrency(ie.rule.rate)}
                                        {ie.rule?.pay_type === "per_head" && formatCurrency(cls.booked_count * (ie.rule?.rate || 0))}
                                        {ie.rule?.pay_type === "hourly" && formatCurrency(((new Date(cls.end_time).getTime() - new Date(cls.start_time).getTime()) / 3600000) * (ie.rule?.rate || 0))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
