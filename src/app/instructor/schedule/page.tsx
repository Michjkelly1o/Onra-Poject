"use client";

import { useDataStore } from "@/lib/data-store";
import { cn, formatTime, formatDate } from "@/lib/utils";
import { Clock, Users, MapPin, CheckCircle, XCircle, AlertTriangle, Calendar } from "lucide-react";

export default function InstructorSchedulePage() {
    const { classInstances, bookings } = useDataStore();
    // Filter classes for this instructor (Sara Al-Rashid - u-inst-1)
    const myClasses = classInstances.filter((c) => c.instructor_id === "u-inst-1");

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Schedule</h1>
                <p className="text-sm text-gray-500 mt-1">Your upcoming and past classes</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-emerald-600 mb-2">
                        <Calendar className="w-5 h-5" />
                        <span className="text-sm font-medium">This Week</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myClasses.length}</p>
                    <p className="text-xs text-gray-500">classes scheduled</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-blue-600 mb-2">
                        <Users className="w-5 h-5" />
                        <span className="text-sm font-medium">Total Signups</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{myClasses.reduce((s, c) => s + c.booked_count, 0)}</p>
                    <p className="text-xs text-gray-500">across all classes</p>
                </div>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-soft">
                    <div className="flex items-center gap-2 text-purple-600 mb-2">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Avg Occupancy</span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {myClasses.length > 0
                            ? Math.round(myClasses.reduce((s, c) => s + (c.booked_count / c.capacity) * 100, 0) / myClasses.length)
                            : 0}%
                    </p>
                    <p className="text-xs text-gray-500">fill rate</p>
                </div>
            </div>

            {/* Classes List */}
            <div className="space-y-3">
                {myClasses.map((cls) => {
                    const classBookings = bookings.filter((b) => b.class_instance_id === cls.id);
                    return (
                        <div key={cls.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: cls.class_type?.color }} />
                                    <div>
                                        <h3 className="font-semibold text-gray-900">{cls.class_type?.name}</h3>
                                        <p className="text-sm text-gray-500">{formatDate(cls.start_time)}</p>
                                    </div>
                                </div>
                                <span className={cn("text-xs px-3 py-1 rounded-full font-medium",
                                    cls.status === "scheduled" && "bg-blue-50 text-blue-600",
                                    cls.status === "cancelled" && "bg-red-50 text-red-600",
                                    cls.status === "completed" && "bg-green-50 text-green-600",
                                )}>
                                    {cls.status}
                                </span>
                            </div>

                            <div className="flex items-center gap-6 text-sm text-gray-500 mb-4">
                                <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{formatTime(cls.start_time)} – {formatTime(cls.end_time)}</span>
                                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{cls.room?.name}</span>
                                <span className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400" />{cls.booked_count}/{cls.capacity}</span>
                            </div>

                            {/* Attendee List */}
                            <div className="border-t border-gray-100 pt-3">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Attendees</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {classBookings.map((b) => (
                                        <div key={b.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50">
                                            <span className="text-sm text-gray-700">{b.user?.first_name} {b.user?.last_name}</span>
                                            <div className="flex items-center gap-1.5">
                                                {b.status === "attended" && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                {b.status === "no_show" && <XCircle className="w-4 h-4 text-red-500" />}
                                                {b.status === "confirmed" && <Clock className="w-4 h-4 text-blue-400" />}
                                                {b.status === "late_cancelled" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                                                <span className={cn("text-xs font-medium capitalize",
                                                    b.status === "attended" && "text-green-600",
                                                    b.status === "no_show" && "text-red-600",
                                                    b.status === "confirmed" && "text-blue-600",
                                                    b.status === "late_cancelled" && "text-amber-600",
                                                )}>
                                                    {b.status.replace("_", " ")}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                    {classBookings.length === 0 && <p className="text-sm text-gray-400 col-span-2">No bookings yet</p>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
