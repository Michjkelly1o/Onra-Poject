"use client";

import { BookingModal } from "@/components/customer/bookings/BookingModal";
import { useDataStore } from "@/lib/data-store";
import { cn, formatTime, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    ChevronLeft,
    ChevronRight,
    Filter,
    Search,
} from "lucide-react";
import { useState, useMemo } from "react";
import { ClassInstance } from "@/types";

export default function CustomerBrowse() {
    const { classInstances, bookings, users } = useDataStore();
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [selectedClass, setSelectedClass] = useState<ClassInstance | null>(null);
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

    // Hardcoded current user for demo (Olivia Martinez)
    const currentUserId = "u-mem-3";

    // Generate week dates
    const weekDates = useMemo(() => {
        const dates = [];
        const start = new Date();
        start.setDate(start.getDate() - start.getDay() + 1); // Start from Monday
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(start.getDate() + i);
            dates.push(d);
        }
        return dates;
    }, []);

    // Filter classes for selected date
    const dayClasses = classInstances.filter(c => {
        const d = new Date(c.start_time);
        return (
            d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear()
        );
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());


    const handleBookClick = (cls: ClassInstance) => {
        setSelectedClass(cls);
        setIsBookingModalOpen(true);
    };

    const handleBookingComplete = () => {
        setIsBookingModalOpen(false);
        setSelectedClass(null);
        // data store updates automatically, no refresh needed
    };

    return (
        <div className="space-y-6 animate-fade-in relative">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Book a Class</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Find and book your next session.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="w-4 h-4 mr-2" /> Filters
                    </Button>
                </div>
            </div>

            {/* Date Picker (Week View) */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                {weekDates.map((date) => {
                    const isSelected =
                        date.getDate() === selectedDate.getDate() &&
                        date.getMonth() === selectedDate.getMonth();
                    const isToday = new Date().getDate() === date.getDate();

                    return (
                        <button
                            key={date.toISOString()}
                            onClick={() => setSelectedDate(date)}
                            className={cn(
                                "flex flex-col items-center justify-center min-w-[60px] p-2 rounded-lg transition-all",
                                isSelected
                                    ? "bg-brand-600 text-white shadow-md transform scale-105"
                                    : "hover:bg-gray-50 text-gray-500"
                            )}
                        >
                            <span className="text-xs font-medium uppercase opacity-80">
                                {date.toLocaleDateString("en-US", { weekday: "short" })}
                            </span>
                            <span
                                className={cn(
                                    "text-lg font-bold",
                                    isToday && !isSelected && "text-brand-600"
                                )}
                            >
                                {date.getDate()}
                            </span>
                            {isToday && isSelected && (
                                <span className="w-1 h-1 bg-white rounded-full mt-1" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Class List */}
            <div className="space-y-4">
                {dayClasses.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Calendar className="w-6 h-6 text-gray-400" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">No classes scheduled</h3>
                        <p className="text-gray-500">Try selecting another date.</p>
                    </div>
                ) : (
                    dayClasses.map((cls) => {
                        const isBooked = bookings.some(
                            (b) =>
                                b.class_instance_id === cls.id &&
                                b.user_id === currentUserId &&
                                b.status !== "cancelled"
                        );
                        const isFull = cls.booked_count >= cls.capacity;

                        // Check Level Requirement (Batch 7)
                        const userLevel = 5; // Hardcoded for demo (Olivia is level 5)
                        const requiredLevel = cls.class_type?.level_required || 0;
                        const isLevelLocked = requiredLevel > userLevel;

                        return (
                            <div
                                key={cls.id}
                                className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4">
                                        {/* Time */}
                                        <div className="text-center min-w-[60px]">
                                            <p className="text-sm font-bold text-gray-900">
                                                {formatTime(cls.start_time)}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {cls.class_type?.default_duration_min} min
                                            </p>
                                        </div>

                                        {/* Info */}
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-gray-900 group-hover:text-brand-600 transition-colors">
                                                    {cls.class_type?.name}
                                                </h3>
                                                {/* Level Badge */}
                                                {requiredLevel > 0 && (
                                                    <span className={cn(
                                                        "text-[10px] px-1.5 py-0.5 rounded border font-medium",
                                                        isLevelLocked
                                                            ? "bg-gray-100 text-gray-500 border-gray-200"
                                                            : "bg-indigo-50 text-indigo-600 border-indigo-100"
                                                    )}>
                                                        Lvl {requiredLevel}+
                                                    </span>
                                                )}
                                                {isLevelLocked && (
                                                    <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                                        Locked (You are Lvl {userLevel})
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-600 mb-2">
                                                {cls.class_type?.description}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <div className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5" />
                                                    {cls.instructor?.first_name} {cls.instructor?.last_name}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="w-3.5 h-3.5" />
                                                    {cls.room?.name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action */}
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="text-right">
                                            <span
                                                className={cn(
                                                    "text-xs font-semibold px-2 py-1 rounded-full",
                                                    isFull
                                                        ? "bg-red-50 text-red-600"
                                                        : "bg-emerald-50 text-emerald-600"
                                                )}
                                            >
                                                {cls.booked_count}/{cls.capacity} spots
                                            </span>
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={() => handleBookClick(cls)}
                                            disabled={isBooked || isFull || isLevelLocked}
                                            variant={isBooked ? "outline" : "default"}
                                            className={cn(
                                                isBooked && "text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                                            )}
                                        >
                                            {isBooked ? "Booked" : isFull ? "Full" : "Book Class"}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Booking Modal */}
            <BookingModal
                classInstance={selectedClass}
                open={isBookingModalOpen}
                onOpenChange={setIsBookingModalOpen}
                onBookingComplete={handleBookingComplete}
            />
        </div>
    );
}
