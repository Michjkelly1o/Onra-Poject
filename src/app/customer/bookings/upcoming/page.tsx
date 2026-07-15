"use client";

// Customer — Upcoming bookings (`/customer/bookings/upcoming`).
import { BookingsView } from "@/components/customer/bookings/BookingsView";

export default function UpcomingBookingsPage() {
    return <BookingsView tab="upcoming" />;
}
