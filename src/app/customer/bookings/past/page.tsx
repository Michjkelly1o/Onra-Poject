"use client";

// Customer — Past bookings (`/customer/bookings/past`).
import { BookingsView } from "@/components/customer/bookings/BookingsView";

export default function PastBookingsPage() {
    return <BookingsView tab="past" />;
}
