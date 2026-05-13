"use client";

import { useDataStore } from "@/lib/data-store";
import { cn, formatDate, formatTime, getStatusColor } from "@/lib/utils";
import { Calendar, Clock, MapPin, AlertCircle, CalendarPlus, Star, Download, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { studio } from "@/lib/mock-data";

function generateICS(booking: any) {
    const cls = booking.class_instance;
    if (!cls) return "";
    const dtStart = cls.start_time.replace(/[-:]/g, "").replace(".000Z", "Z");
    const dtEnd = cls.end_time.replace(/[-:]/g, "").replace(".000Z", "Z");
    return [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//SyncFit//EN",
        "BEGIN:VEVENT",
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${cls.class_type?.name || "Class"}`,
        `DESCRIPTION:Instructor: ${cls.instructor?.first_name} ${cls.instructor?.last_name}`,
        `LOCATION:${cls.room?.name || "Studio"}`,
        "END:VEVENT",
        "END:VCALENDAR",
    ].join("\r\n");
}

function downloadICS(booking: any) {
    const content = generateICS(booking);
    const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `syncfit-${booking.class_instance?.class_type?.name || "class"}.ics`;
    a.click();
    URL.revokeObjectURL(url);
}

export default function MemberBookingsPage() {
    const { bookings, cancelBooking } = useDataStore();
    const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
    const [ratings, setRatings] = useState<Record<string, number>>({});
    const [hoveredStar, setHoveredStar] = useState<{ id: string; star: number } | null>(null);

    // Filter for member u-mem-3 (Olivia Martinez)
    const currentUserId = "u-mem-3";
    const myBookings = bookings.filter((b) => b.user_id === currentUserId);

    const upcoming = myBookings.filter(
        (b) => (b.status === "confirmed" || b.status === "waitlist")
    ).sort((a, b) => new Date(a.class_instance?.start_time!).getTime() - new Date(b.class_instance?.start_time!).getTime());

    const past = myBookings.filter(
        (b) => b.status === "attended" || b.status === "no_show" || b.status === "cancelled" || b.status === "late_cancelled"
    ).sort((a, b) => new Date(b.class_instance?.start_time!).getTime() - new Date(a.class_instance?.start_time!).getTime());

    const list = tab === "upcoming" ? upcoming : past;

    const handleCancel = (bookingId: string, classStartTime?: string) => {
        const cancellationWindowHours = studio.cancellation_window_hours || 12;
        let isLateCancellation = false;
        if (classStartTime) {
            const hoursUntilClass = (new Date(classStartTime).getTime() - Date.now()) / 3600000;
            isLateCancellation = hoursUntilClass < cancellationWindowHours;
        }
        const message = isLateCancellation
            ? "This is a late cancellation (within " + cancellationWindowHours + "h). Your credit will be forfeited. Continue?"
            : "Your credit will be refunded. Cancel this booking?";
        if (confirm(message)) {
            cancelBooking(bookingId);
        }
    };

    const handleRate = (bookingId: string, star: number) => {
        setRatings(prev => ({ ...prev, [bookingId]: star }));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
                <p className="text-sm text-gray-500 mt-1">View and manage your class bookings</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setTab("upcoming")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        tab === "upcoming" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    )}
                >
                    Upcoming ({upcoming.length})
                </button>
                <button
                    onClick={() => setTab("past")}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
                        tab === "past" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                    )}
                >
                    Past ({past.length})
                </button>
            </div>

            {/* Booking Cards */}
            {list.length > 0 ? (
                <div className="space-y-3">
                    {list.map((b) => {
                        const cls = b.class_instance;
                        if (!cls) return null;
                        return (
                            <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-soft p-5 hover-lift">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: cls.class_type?.color }} />
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{cls.class_type?.name}</h3>
                                            <p className="text-sm text-gray-500">with {cls.instructor?.first_name} {cls.instructor?.last_name}</p>
                                        </div>
                                    </div>
                                    <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium capitalize", getStatusColor(b.status))}>
                                        {b.status.replace("_", " ")}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6 text-sm text-gray-500 mt-3">
                                    <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-gray-400" />{formatDate(cls.start_time)}</span>
                                    <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-gray-400" />{`${formatTime(cls.start_time)} – ${formatTime(cls.end_time)}`}</span>
                                    <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-gray-400" />{cls.room?.name}</span>
                                </div>

                                {/* Upcoming: Cancel + Add to Calendar */}
                                {tab === "upcoming" && (b.status === "confirmed" || b.status === "waitlist") && (
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                                        {(() => {
                                            const hoursUntil = (new Date(cls.start_time).getTime() - Date.now()) / 3600000;
                                            const isLate = hoursUntil < (studio.cancellation_window_hours || 12);
                                            return (
                                                <p className={cn("text-xs flex items-center gap-1", isLate ? "text-amber-600" : "text-gray-400")}>
                                                    {isLate ? <AlertTriangle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                                    {isLate ? "Late cancellation — credit will be forfeited" : `Free cancellation until ${studio.cancellation_window_hours || 12}h before`}
                                                </p>
                                            );
                                        })()}
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => downloadICS(b)}
                                                className="px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-medium hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                            >
                                                <CalendarPlus className="w-3.5 h-3.5" /> Add to Calendar
                                            </button>
                                            <button
                                                onClick={() => handleCancel(b.id, cls.start_time)}
                                                className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors"
                                            >
                                                Cancel Booking
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Past: Rate this class */}
                                {tab === "past" && b.status === "attended" && (
                                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">Rate this class:</span>
                                            <div className="flex items-center gap-0.5">
                                                {[1, 2, 3, 4, 5].map(star => {
                                                    const isHovered = hoveredStar?.id === b.id && star <= hoveredStar.star;
                                                    const isRated = ratings[b.id] && star <= ratings[b.id];
                                                    return (
                                                        <button
                                                            key={star}
                                                            onMouseEnter={() => setHoveredStar({ id: b.id, star })}
                                                            onMouseLeave={() => setHoveredStar(null)}
                                                            onClick={() => handleRate(b.id, star)}
                                                            className="p-0.5 transition-transform hover:scale-110"
                                                        >
                                                            <Star
                                                                className={cn("w-4 h-4 transition-colors",
                                                                    isHovered || isRated
                                                                        ? "text-amber-400 fill-amber-400"
                                                                        : "text-gray-300"
                                                                )}
                                                            />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {ratings[b.id] && (
                                                <span className="text-xs text-amber-600 font-medium ml-1">
                                                    {ratings[b.id]}/5
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft p-12 text-center">
                    <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No {tab} bookings</p>
                    <p className="text-sm text-gray-400 mt-1">
                        {tab === "upcoming" ? "Browse classes to book your next session" : "Your past bookings will appear here"}
                    </p>
                </div>
            )}
        </div>
    );
}
