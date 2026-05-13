"use client";

import { useDataStore } from "@/lib/data-store";
import { instructorPayRules } from "@/lib/mock-data";
import { cn, formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { DollarSign, Clock, TrendingUp, Calendar, Users } from "lucide-react";
import { useState } from "react";

export default function InstructorEarningsPage() {
    const { classInstances, bookings, users } = useDataStore();
    const currentInstructorId = "u-inst-1"; // Lena Voss
    const instructor = users.find(u => u.id === currentInstructorId);
    if (!instructor) return null;

    const rule = instructorPayRules.find(r => r.instructor_id === currentInstructorId);
    const myClasses = classInstances.filter(c => c.instructor_id === currentInstructorId);
    const totalStudents = myClasses.reduce((s, c) => s + c.booked_count, 0);
    const totalHours = myClasses.reduce((s, c) => {
        return s + (new Date(c.end_time).getTime() - new Date(c.start_time).getTime()) / 3600000;
    }, 0);

    // Calculate per-class earnings
    const classEarnings = myClasses.map(cls => {
        let earning = 0;
        if (rule) {
            switch (rule.pay_type) {
                case "per_class": earning = rule.rate; break;
                case "per_head": earning = cls.booked_count * rule.rate; break;
                case "hourly": earning = ((new Date(cls.end_time).getTime() - new Date(cls.start_time).getTime()) / 3600000) * rule.rate; break;
                case "fixed_monthly": earning = rule.rate / myClasses.length; break;
            }
        }
        return { ...cls, earning: Math.round(earning) };
    });

    const totalEarnings = classEarnings.reduce((s, c) => s + c.earning, 0);

    // Ratings from bookings
    const myBookings = bookings.filter(b => myClasses.some(c => c.id === b.class_instance_id) && b.status === "attended");
    const avgRating = 4.7; // simulated

    const payTypeLabel: Record<string, string> = {
        per_class: "Per Class",
        per_head: "Per Head",
        hourly: "Hourly",
        fixed_monthly: "Fixed Monthly",
    };

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Earnings</h1>
                <p className="text-sm text-gray-500 mt-1">Track your compensation and class performance</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <DollarSign className="w-4 h-4 text-emerald-500" />
                        <span className="text-xs font-medium">Total Earnings</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalEarnings)}</p>
                    <p className="text-xs text-gray-400 mt-1">This month</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Calendar className="w-4 h-4 text-blue-500" />
                        <span className="text-xs font-medium">Classes Taught</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myClasses.length}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <Users className="w-4 h-4 text-purple-500" />
                        <span className="text-xs font-medium">Total Students</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{totalStudents}</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-medium">Avg Rating</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{avgRating} ⭐</p>
                </div>
            </div>

            {/* Pay Info */}
            {rule && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Pay Structure</h3>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Type: <strong>{payTypeLabel[rule.pay_type]}</strong></span>
                        <span className="text-sm text-gray-600">Rate: <strong>{formatCurrency(rule.rate)}</strong></span>
                        <span className="text-sm text-gray-600">Hours: <strong>{Math.round(totalHours * 10) / 10}h</strong></span>
                    </div>
                </div>
            )}

            {/* Earnings Breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900">Earnings Breakdown</h3>
                </div>
                <div className="divide-y divide-gray-50">
                    {classEarnings.map(cls => (
                        <div key={cls.id} className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-1 h-10 rounded-full" style={{ backgroundColor: cls.class_type?.color }} />
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{cls.class_type?.name}</p>
                                    <p className="text-xs text-gray-400">
                                        {formatDate(cls.start_time)} · {formatTime(cls.start_time)} – {formatTime(cls.end_time)} · {cls.booked_count} students
                                    </p>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-emerald-600">{formatCurrency(cls.earning)}</span>
                        </div>
                    ))}
                </div>
                <div className="px-6 py-4 border-t-2 border-gray-200 bg-gray-50 flex items-center justify-between">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <span className="text-sm font-bold text-gray-900">{formatCurrency(totalEarnings)}</span>
                </div>
            </div>
        </div>
    );
}
