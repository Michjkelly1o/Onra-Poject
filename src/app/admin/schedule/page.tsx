"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, formatTime } from "@/lib/utils";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Clock,
    Users,
    MapPin,
    Trash2,
    AlertCircle,
    Copy,
    UserCheck,
    Save,
    CalendarPlus,
} from "lucide-react";

const HOURS = Array.from({ length: 14 }, (_, i) => i + 6); // 6am to 7pm
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekDates(): Date[] {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        return d;
    });
}

export default function SchedulePage() {
    const { classInstances, classTypes, users, rooms, bookings, addClass, deleteClass, updateClass } = useDataStore();
    const instructors = users.filter((u) => u.role === "instructor");

    const [view, setView] = useState<"week" | "month">("week");
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [filterLevel, setFilterLevel] = useState<string>("all");
    const [showSubstituteModal, setShowSubstituteModal] = useState(false);
    const [templateSaved, setTemplateSaved] = useState(false);
    const [showApplyTemplate, setShowApplyTemplate] = useState(false);
    const weekDates = getWeekDates();

    // Form State
    const [formData, setFormData] = useState({
        class_type_id: "",
        date: new Date().toISOString().split("T")[0],
        time: "09:00",
        instructor_id: "",
        room_id: ""
    });

    const selectedInstance = selectedClassId
        ? classInstances.find((c) => c.id === selectedClassId)
        : null;

    // Filter instances
    const filteredInstances = classInstances.filter(inst => {
        if (filterLevel === "all") return true;
        return inst.class_type?.difficulty_level === filterLevel;
    });

    const handleCreateClass = () => {
        if (!formData.class_type_id || !formData.instructor_id || !formData.room_id) return;

        const ct = classTypes.find(t => t.id === formData.class_type_id);
        if (!ct) return;

        const startDateTime = new Date(`${formData.date}T${formData.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + ct.default_duration_min * 60000);

        addClass({
            studio_id: "s1",
            class_type_id: formData.class_type_id,
            instructor_id: formData.instructor_id,
            room_id: formData.room_id,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            capacity: ct.default_capacity,
        });

        setShowAddModal(false);
        setFormData({ class_type_id: "", date: new Date().toISOString().split("T")[0], time: "09:00", instructor_id: "", room_id: "" });
    };

    const handleDelete = (id: string) => {
        if (confirm("Are you sure you want to cancel and delete this class?")) {
            deleteClass(id);
            setSelectedClassId(null);
        }
    };

    // ── Duplicate Class ──
    const handleDuplicate = (cls: typeof classInstances[0]) => {
        const ct = classTypes.find(t => t.id === cls.class_type_id);
        if (!ct) return;
        // Pre-fill form and open add modal
        const startDate = new Date(cls.start_time);
        // Set to tomorrow same time
        const tomorrow = new Date(startDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        setFormData({
            class_type_id: cls.class_type_id,
            date: tomorrow.toISOString().split("T")[0],
            time: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
            instructor_id: cls.instructor_id,
            room_id: cls.room_id,
        });
        setShowAddModal(true);
        setSelectedClassId(null);
    };

    // ── Substitute Instructor ──
    const handleSubstitute = (classId: string, newInstructorId: string) => {
        updateClass(classId, { instructor_id: newInstructorId });
        setShowSubstituteModal(false);
    };

    // ── Save / Apply Weekly Template ──
    const handleSaveTemplate = () => {
        // Save current week's classes as a template
        const templateClasses = classInstances.map(c => ({
            class_type_id: c.class_type_id,
            instructor_id: c.instructor_id,
            room_id: c.room_id,
            dayOfWeek: new Date(c.start_time).getDay(),
            hour: new Date(c.start_time).getHours(),
            minute: new Date(c.start_time).getMinutes(),
            durationMin: (new Date(c.end_time).getTime() - new Date(c.start_time).getTime()) / 60000,
            capacity: c.capacity,
        }));
        localStorage.setItem("syncfit_schedule_template", JSON.stringify(templateClasses));
        setTemplateSaved(true);
        setTimeout(() => setTemplateSaved(false), 3000);
    };

    const handleApplyTemplate = () => {
        const raw = localStorage.getItem("syncfit_schedule_template");
        if (!raw) return;
        const templateClasses = JSON.parse(raw);
        // Apply to next week
        const nextMonday = new Date(weekDates[0]);
        nextMonday.setDate(nextMonday.getDate() + 7);

        templateClasses.forEach((tc: { class_type_id: string; instructor_id: string; room_id: string; dayOfWeek: number; hour: number; minute: number; durationMin: number; capacity: number }) => {
            const classDate = new Date(nextMonday);
            const offset = ((tc.dayOfWeek + 6) % 7); // Mon=0
            classDate.setDate(nextMonday.getDate() + offset);
            classDate.setHours(tc.hour, tc.minute, 0, 0);
            const endDate = new Date(classDate.getTime() + tc.durationMin * 60000);

            addClass({
                studio_id: "s1",
                class_type_id: tc.class_type_id,
                instructor_id: tc.instructor_id,
                room_id: tc.room_id,
                start_time: classDate.toISOString(),
                end_time: endDate.toISOString(),
                capacity: tc.capacity,
            });
        });
        setShowApplyTemplate(false);
    };

    // ── Month View ──
    const getMonthDays = () => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth(), 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const startPad = (first.getDay() + 6) % 7; // Monday start
        const days: (Date | null)[] = Array.from({ length: startPad }, () => null);
        for (let d = 1; d <= last.getDate(); d++) {
            days.push(new Date(now.getFullYear(), now.getMonth(), d));
        }
        return days;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Manage your weekly class schedule
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="flex bg-gray-100 rounded-xl p-1">
                        <button
                            onClick={() => setView("week")}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                view === "week" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            )}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setView("month")}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                view === "month" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
                            )}
                        >
                            Month
                        </button>
                    </div>

                    {/* Filter */}
                    <select
                        value={filterLevel}
                        onChange={(e) => setFilterLevel(e.target.value)}
                        className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-200"
                    >
                        <option value="all">All Levels</option>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                    </select>

                    {/* Template buttons */}
                    <button
                        onClick={handleSaveTemplate}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all",
                            templateSaved
                                ? "bg-green-50 border-green-200 text-green-600"
                                : "border-gray-200 text-gray-600 hover:bg-gray-50"
                        )}
                    >
                        <Save className="w-4 h-4" />
                        {templateSaved ? "Saved!" : "Save Template"}
                    </button>
                    <button
                        onClick={() => setShowApplyTemplate(true)}
                        className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                        <CalendarPlus className="w-4 h-4" />
                        Apply Template
                    </button>

                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity shadow-glow"
                    >
                        <Plus className="w-4 h-4" />
                        Add Class
                    </button>
                </div>
            </div>

            {/* Week Navigation */}
            <div className="flex items-center gap-4">
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>
                <h2 className="text-sm font-semibold text-gray-700">
                    {weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} —{" "}
                    {weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>
                <button className="text-xs text-brand-600 font-medium hover:text-brand-700 ml-2">
                    Today
                </button>
            </div>

            {/* ── WEEK VIEW ── */}
            {view === "week" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                    {/* Day Headers */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100">
                        <div className="p-3" />
                        {weekDates.map((date, i) => {
                            const isToday = date.toDateString() === new Date().toDateString();
                            return (
                                <div key={i} className={cn("p-3 text-center border-l border-gray-100", isToday && "bg-brand-50/50")}>
                                    <p className="text-xs text-gray-500 font-medium">{DAYS[i]}</p>
                                    <p className={cn("text-lg font-semibold mt-0.5", isToday ? "text-brand-600" : "text-gray-900")}>
                                        {date.getDate()}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    {/* Time Grid */}
                    <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                        {HOURS.map((hour) => (
                            <div key={hour} className="contents">
                                <div className="h-16 px-2 pt-1 text-right border-t border-gray-50">
                                    <span className="text-[10px] text-gray-400 font-medium">
                                        {hour > 12 ? `${hour - 12} PM` : hour === 12 ? "12 PM" : `${hour} AM`}
                                    </span>
                                </div>
                                {Array.from({ length: 7 }, (_, dayIdx) => (
                                    <div key={`${hour}-${dayIdx}`} className="h-16 border-l border-t border-gray-50 relative" />
                                ))}
                            </div>
                        ))}

                        {/* Class Blocks */}
                        {filteredInstances.map((cls) => {
                            const startDate = new Date(cls.start_time);
                            const dayIdx = (startDate.getDay() + 6) % 7;
                            const startHour = startDate.getHours() + startDate.getMinutes() / 60;
                            const endDate = new Date(cls.end_time);
                            const endHour = endDate.getHours() + endDate.getMinutes() / 60;
                            const duration = endHour - startHour;
                            const top = (startHour - 6) * 64;
                            const height = duration * 64;
                            const isFull = cls.booked_count >= cls.capacity;
                            const hasWaitlist = cls.waitlist_count > 0;

                            if (startHour < 6 || startHour > 20) return null;

                            return (
                                <div
                                    key={cls.id}
                                    onClick={() => setSelectedClassId(cls.id)}
                                    className={cn(
                                        "absolute rounded-lg px-2 py-1.5 cursor-pointer transition-all hover:shadow-md hover:z-10 overflow-hidden group",
                                        selectedClassId === cls.id && "ring-2 ring-brand-400 z-10"
                                    )}
                                    style={{
                                        top: `${top}px`,
                                        height: `${height}px`,
                                        left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7) + 4px)`,
                                        width: `calc((100% - 60px) / 7 - 8px)`,
                                        backgroundColor: `${cls.class_type?.color}15`,
                                        borderLeft: `3px solid ${cls.class_type?.color}`,
                                    }}
                                >
                                    <div className="flex justify-between items-start">
                                        <p className="text-[11px] font-semibold leading-tight truncate" style={{ color: cls.class_type?.color }}>
                                            {cls.class_type?.name}
                                        </p>
                                        {hasWaitlist && (
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0 mt-0.5" title="Waitlist active" />
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-500 truncate mt-0.5">
                                        {cls.instructor?.first_name}
                                    </p>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-[10px] text-gray-400">
                                            {cls.booked_count}/{cls.capacity}
                                        </p>
                                        {isFull && <span className="text-[9px] text-red-500 font-bold uppercase">FULL</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── MONTH VIEW ── */}
            {view === "month" && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <h2 className="text-sm font-semibold text-gray-700">
                            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                        </h2>
                    </div>
                    <div className="grid grid-cols-7">
                        {DAYS.map(d => (
                            <div key={d} className="p-2 text-center text-xs font-medium text-gray-500 border-b border-gray-100">
                                {d}
                            </div>
                        ))}
                        {getMonthDays().map((day, idx) => {
                            const dayClasses = day ? filteredInstances.filter(c => {
                                const cd = new Date(c.start_time);
                                return cd.getDate() === day.getDate() && cd.getMonth() === day.getMonth();
                            }) : [];
                            const isToday = day?.toDateString() === new Date().toDateString();
                            return (
                                <div
                                    key={idx}
                                    className={cn(
                                        "min-h-[80px] p-1.5 border-b border-r border-gray-50",
                                        !day && "bg-gray-50/30",
                                        isToday && "bg-brand-50/30"
                                    )}
                                >
                                    {day && (
                                        <>
                                            <p className={cn("text-xs font-medium mb-1", isToday ? "text-brand-600" : "text-gray-700")}>
                                                {day.getDate()}
                                            </p>
                                            <div className="space-y-0.5">
                                                {dayClasses.slice(0, 3).map(c => (
                                                    <div
                                                        key={c.id}
                                                        onClick={() => { setSelectedClassId(c.id); setView("week"); }}
                                                        className="text-[9px] px-1 py-0.5 rounded cursor-pointer truncate hover:opacity-80"
                                                        style={{ backgroundColor: `${c.class_type?.color}20`, color: c.class_type?.color }}
                                                    >
                                                        {c.class_type?.name}
                                                    </div>
                                                ))}
                                                {dayClasses.length > 3 && (
                                                    <p className="text-[9px] text-gray-400 text-center">+{dayClasses.length - 3} more</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Class Detail Slide Over */}
            {selectedInstance && (
                <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-100 z-50 animate-slide-in-right overflow-y-auto">
                    <div className="p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="font-bold text-lg text-gray-900">Class Details</h2>
                            <button onClick={() => setSelectedClassId(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="w-full h-2 rounded-full mb-6" style={{ backgroundColor: selectedInstance.class_type?.color }} />

                        <div className="space-y-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border uppercase tracking-wider", "bg-gray-100 text-gray-600 border-gray-200")}>
                                        {selectedInstance.class_type?.difficulty_level?.replace("_", " ") || "All Levels"}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedInstance.class_type?.name}</h3>
                                <p className="text-sm text-gray-500 mt-1">{selectedInstance.class_type?.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Time</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {formatTime(selectedInstance.start_time)} – {formatTime(selectedInstance.end_time)}
                                    </p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Capacity</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <p className="text-sm font-semibold text-gray-900">
                                            {selectedInstance.booked_count}/{selectedInstance.capacity}
                                        </p>
                                        {selectedInstance.waitlist_count > 0 && (
                                            <span className="text-xs text-orange-600 font-medium">
                                                (+{selectedInstance.waitlist_count} WL)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                        <MapPin className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Room</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">{selectedInstance.room?.name}</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-gray-500 mb-1">
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-xs font-medium">Instructor</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">
                                        {selectedInstance.instructor?.first_name} {selectedInstance.instructor?.last_name}
                                    </p>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => handleDuplicate(selectedInstance)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    Duplicate
                                </button>
                                <button
                                    onClick={() => setShowSubstituteModal(true)}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-blue-200 text-blue-600 rounded-xl text-sm font-medium hover:bg-blue-50 transition-colors"
                                >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    Sub Instructor
                                </button>
                            </div>
                            <button
                                onClick={() => handleDelete(selectedInstance.id)}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" />
                                Cancel Class
                            </button>

                            <div className="pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="text-sm font-semibold text-gray-700">Attendees</h4>
                                    {selectedInstance.waitlist_count > 0 && (
                                        <span className="flex items-center gap-1 text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-full">
                                            <AlertCircle className="w-3 h-3" />
                                            {selectedInstance.waitlist_count} on Waitlist
                                        </span>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {bookings
                                        .filter((b) => b.class_instance_id === selectedInstance.id)
                                        .map((booking) => (
                                            <div key={booking.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                                                        <span className="text-xs font-semibold text-brand-700">
                                                            {booking.user?.first_name?.[0]}
                                                            {booking.user?.last_name?.[0]}
                                                        </span>
                                                    </div>
                                                    <span className="text-sm text-gray-700">
                                                        {booking.user?.first_name} {booking.user?.last_name}
                                                    </span>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "text-xs px-2 py-0.5 rounded-full font-medium",
                                                        booking.status === "confirmed" && "bg-blue-50 text-blue-600",
                                                        booking.status === "attended" && "bg-green-50 text-green-600",
                                                        booking.status === "no_show" && "bg-red-50 text-red-600",
                                                        booking.status === "cancelled" && "bg-gray-100 text-gray-500",
                                                        booking.status === "late_cancelled" && "bg-orange-50 text-orange-600",
                                                        booking.status === "waitlist" && "bg-yellow-50 text-yellow-600"
                                                    )}
                                                >
                                                    {booking.status.replace("_", " ")}
                                                </span>
                                            </div>
                                        ))}
                                    {bookings.filter((b) => b.class_instance_id === selectedInstance.id).length === 0 && (
                                        <p className="text-sm text-gray-400 text-center py-4">No bookings yet</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Substitute Instructor Modal */}
            {showSubstituteModal && selectedInstance && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-gray-900">Substitute Instructor</h2>
                            <button onClick={() => setShowSubstituteModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">
                            Replace <strong>{selectedInstance.instructor?.first_name} {selectedInstance.instructor?.last_name}</strong> for this class
                        </p>
                        <div className="space-y-2">
                            {instructors
                                .filter(i => i.id !== selectedInstance.instructor_id)
                                .map(inst => (
                                    <button
                                        key={inst.id}
                                        onClick={() => handleSubstitute(selectedInstance.id, inst.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-all text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                                            <span className="text-xs font-semibold text-brand-700">
                                                {inst.first_name[0]}{inst.last_name[0]}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{inst.first_name} {inst.last_name}</p>
                                            <p className="text-xs text-gray-500">{inst.email}</p>
                                        </div>
                                    </button>
                                ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Apply Template Confirmation Modal */}
            {showApplyTemplate && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-md mx-4 p-6 shadow-2xl animate-scale-in">
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Apply Schedule Template</h2>
                        <p className="text-sm text-gray-500 mb-6">
                            This will copy the saved schedule template to next week. Classes will be created with the same times, instructors, and rooms.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowApplyTemplate(false)}
                                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleApplyTemplate}
                                className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90"
                            >
                                Apply to Next Week
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Class Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl animate-scale-in">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900">Add New Class</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                                <X className="w-4 h-4 text-gray-500" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Class Type</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                                    value={formData.class_type_id}
                                    onChange={(e) => setFormData({ ...formData, class_type_id: e.target.value })}
                                >
                                    <option value="">Select class type...</option>
                                    {classTypes.map((ct) => (
                                        <option key={ct.id} value={ct.id}>{ct.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
                                    <input
                                        type="date"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Time</label>
                                    <input
                                        type="time"
                                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                                        value={formData.time}
                                        onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructor</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                                    value={formData.instructor_id}
                                    onChange={(e) => setFormData({ ...formData, instructor_id: e.target.value })}
                                >
                                    <option value="">Select instructor...</option>
                                    {instructors.map((inst) => (
                                        <option key={inst.id} value={inst.id}>{inst.first_name} {inst.last_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">Room</label>
                                <select
                                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200 focus:border-brand-300"
                                    value={formData.room_id}
                                    onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                                >
                                    <option value="">Select room...</option>
                                    {rooms.map((room) => (
                                        <option key={room.id} value={room.id}>{room.name} (cap: {room.capacity})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateClass}
                                    className="flex-1 py-2.5 gradient-bg-brand text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
                                >
                                    Create Class
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
