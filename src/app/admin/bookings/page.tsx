"use client";

import { useState } from "react";
import { useDataStore } from "@/lib/data-store";
import { cn, formatDate, formatTime, getStatusColor } from "@/lib/utils";
import { Search, Download, MoreHorizontal, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { BookingStatus } from "@/types";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusFilters: (BookingStatus | "all")[] = ["all", "confirmed", "attended", "cancelled", "no_show", "late_cancelled"];

export default function BookingsPage() {
    const { bookings, updateBookingStatus, cancelBooking } = useDataStore();
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<BookingStatus | "all">("all");

    const filtered = bookings.filter((b) => {
        const matchesSearch = `${b.user?.first_name} ${b.user?.last_name} ${b.class_instance?.class_type?.name}`.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" || b.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleCancel = (bookingId: string) => {
        if (confirm("Are you sure you want to cancel this booking?")) {
            cancelBooking(bookingId);
        }
    };

    const handleStatusUpdate = (bookingId: string, status: BookingStatus) => {
        updateBookingStatus(bookingId, status);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
                    <p className="text-sm text-gray-500 mt-1">{bookings.length} total bookings</p>
                </div>
                <button className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                    <Download className="w-4 h-4" />
                    Export
                </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 flex-wrap">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by member or class..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-200"
                    />
                </div>
                <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
                    {statusFilters.map((s) => (
                        <button
                            key={s}
                            onClick={() => setStatusFilter(s)}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                                statusFilter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {s === "all" ? "All" : s.replace("_", " ")}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-soft overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Member</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Class</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Date & Time</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Payment</th>
                                <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
                                <th className="px-5 py-3"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((b) => (
                                <tr key={b.id} className="table-row-hover border-b border-gray-50">
                                    <td className="px-5 py-3.5">
                                        <p className="text-sm font-medium text-gray-900">{b.user?.first_name} {b.user?.last_name}</p>
                                        <p className="text-xs text-gray-400">{b.user?.email}</p>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: b.class_instance?.class_type?.color }} />
                                            <span className="text-sm text-gray-700">{b.class_instance?.class_type?.name}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-0.5">{b.class_instance?.instructor?.first_name}</p>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <p className="text-sm text-gray-700">{b.class_instance ? formatDate(b.class_instance.start_time) : ""}</p>
                                        <p className="text-xs text-gray-400">{b.class_instance ? formatTime(b.class_instance.start_time) : ""}</p>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                                            {b.payment_method.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium capitalize", getStatusColor(b.status))}>
                                            {b.status.replace("_", " ")}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3.5 text-right">
                                        {b.status === "confirmed" && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 focus:outline-none">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(b.id, "attended")}>
                                                        <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                                        Mark Attended
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleStatusUpdate(b.id, "no_show")}>
                                                        <AlertCircle className="w-4 h-4 mr-2 text-amber-500" />
                                                        Mark No Show
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleCancel(b.id)}>
                                                        <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                                        Cancel Booking
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
