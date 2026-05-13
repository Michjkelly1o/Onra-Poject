"use client";

import { useDataStore } from "@/lib/data-store";
import { cn, formatTime, formatDate } from "@/lib/utils";
import { CheckCircle, XCircle, Clock, AlertTriangle, Users, Search } from "lucide-react";
import { useState } from "react";
import type { BookingStatus } from "@/types";

export default function InstructorAttendancePage() {
    const { classInstances, bookings, updateBookingStatus } = useDataStore();
    const myClasses = classInstances.filter((c) => c.instructor_id === "u-inst-1");
    // Default to first class if available
    const [selectedClassId, setSelectedClassId] = useState(myClasses[0]?.id || "");

    const selectedClass = myClasses.find((c) => c.id === selectedClassId);
    // Filter bookings for the selected class that are not cancelled
    const classBookings = bookings.filter((b) => b.class_instance_id === selectedClassId && b.status !== 'cancelled');

    const stats = {
        attended: classBookings.filter(b => b.status === "attended").length,
        no_show: classBookings.filter(b => b.status === "no_show").length,
        confirmed: classBookings.filter(b => b.status === "confirmed").length,
    };

    const handleStatusUpdate = (bookingId: string, status: BookingStatus) => {
        updateBookingStatus(bookingId, status);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
                <p className="text-sm text-gray-500 mt-1">Mark attendance and track no-shows</p>
            </div>

            {/* Class Selector */}
            <div className="flex items-center gap-4 flex-wrap">
                <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 min-w-[280px]"
                >
                    {myClasses.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                            {cls.class_type?.name} — {formatDate(cls.start_time)} {formatTime(cls.start_time)}
                        </option>
                    ))}
                    {myClasses.length === 0 && <option value="">No classes scheduled</option>}
                </select>
            </div>

            {selectedClass && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft flex items-center gap-3">
                            <CheckCircle className="w-8 h-8 text-green-500" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{stats.attended}</p>
                                <p className="text-xs text-gray-500">Attended</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft flex items-center gap-3">
                            <XCircle className="w-8 h-8 text-red-500" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{stats.no_show}</p>
                                <p className="text-xs text-gray-500">No-show</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-soft flex items-center gap-3">
                            <Clock className="w-8 h-8 text-blue-500" />
                            <div>
                                <p className="text-xl font-bold text-gray-900">{stats.confirmed}</p>
                                <p className="text-xs text-gray-500">Pending</p>
                            </div>
                        </div>
                    </div>

                    {/* Attendee List */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="font-semibold text-gray-900">{selectedClass.class_type?.name}</h3>
                            <p className="text-sm text-gray-500">{formatDate(selectedClass.start_time)} • {formatTime(selectedClass.start_time)} – {formatTime(selectedClass.end_time)}</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {classBookings.map((b) => (
                                <div key={b.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <span className="text-xs font-semibold text-emerald-700">
                                                {b.user?.first_name?.[0]}{b.user?.last_name?.[0]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{b.user?.first_name} {b.user?.last_name}</p>
                                            <p className="text-xs text-gray-400">{b.user?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize",
                                            b.status === "attended" && "bg-green-50 text-green-600",
                                            b.status === "no_show" && "bg-red-50 text-red-600",
                                            b.status === "confirmed" && "bg-blue-50 text-blue-600",
                                            b.status === "late_cancelled" && "bg-amber-50 text-amber-600",
                                        )}>
                                            {b.status.replace("_", " ")}
                                        </span>
                                        {b.status === "confirmed" && (
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleStatusUpdate(b.id, "attended")}
                                                    className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-medium hover:bg-green-100 transition-colors"
                                                >
                                                    Check In
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(b.id, "no_show")}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                                                >
                                                    No-show
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {classBookings.length === 0 && (
                                <div className="p-8 text-center text-gray-400 text-sm">No bookings for this class</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
