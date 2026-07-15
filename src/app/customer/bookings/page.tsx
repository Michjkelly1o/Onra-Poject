"use client";

// Customer — Bookings entry (`/customer/bookings`). Bookings is now split into
// two pages (Upcoming / Past); this entry redirects to Upcoming so every existing
// link keeps working.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { bookingsUi } from "@/lib/customer/bookings-data";

export default function BookingsIndexPage() {
    const router = useRouter();
    useEffect(() => {
        router.replace(bookingsUi.tab === "past" ? "/customer/bookings/past" : "/customer/bookings/upcoming");
    }, [router]);
    return <div className="min-h-[100dvh]" />;
}
