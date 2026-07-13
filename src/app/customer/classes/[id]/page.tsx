"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Class Details (`/customer/classes/[id]`) — Figma 2386-36343
// ─────────────────────────────────────────────────────────────────────────────
//
// Composes the shared <ClassDetailLayout> (also used by Booking Detail) and
// supplies the discovery hero badge + a state-driven action zone: Book class /
// Join waitlist / Full / Manage in Bookings. Reads the live class detail VM.

import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomer } from "@/lib/customer/context";
import { to12h } from "@/lib/customer/dates";
import { useClassDetail } from "@/lib/customer/search-data";
import { branchTzLabel } from "@/lib/branch-time";
import { ClassDetailLayout } from "@/components/customer/classes/ClassDetailLayout";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Button } from "@/components/ui/button";

export default function ClassDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const detail = useClassDetail(id);
    const member = useCurrentCustomer();
    // Resolve the class's branch → its short TZ label so remote members
    // know the local zone before they book (client Jul 2026).
    const branch = useAppStore(s => s.branches).find(b => b.id === detail?.branchId);
    const branchTz = branch ? branchTzLabel(branch) : "";

    if (!detail) {
        return (
            <div className="flex min-h-full flex-col">
                <CustomerHeader>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-black/40 transition-colors active:bg-black/50"
                    >
                        <ChevronLeft className="size-5 text-white" aria-hidden />
                    </button>
                    <div className="flex-1" />
                </CustomerHeader>
                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                    <p className="text-base font-semibold text-[#101828]">This class is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/search")}>
                        Back to Search
                    </Button>
                </div>
            </div>
        );
    }

    const dateLabel = new Date(`${detail.dateISO}T00:00:00`).toLocaleString("en-US", {
        weekday: "short",
        day: "numeric",
        month: "short",
    });
    const badge =
        detail.state === "available"
            ? { label: `${detail.booked}/${detail.capacity}`, cls: "border-[#abefc6] bg-[#ecfdf3] text-[#067647]" }
            : detail.state === "waitlist"
              ? { label: "Waitlist open", cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
              : detail.state === "booked"
                ? { label: "Booked", cls: "border-[#abefc6] bg-[#ecfdf3] text-[#067647]" }
                : detail.state === "waitlisted"
                  ? { label: "Waitlisted", cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
                  : detail.state === "closed"
                    ? { label: "Closed", cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
                    : { label: "Full", cls: "border-[#fecdca] bg-[#fef3f2] text-[#b42318]" };

    const credits = member?.creditsRemaining;
    const booked = detail.state === "booked" || detail.state === "waitlisted";

    return (
        <ClassDetailLayout
            detail={detail}
            heroSubtitle={`${dateLabel} at ${to12h(detail.startTime)}${branchTz ? ` · ${branchTz}` : ""}`}
            heroBadge={
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${badge.cls}`}>
                    {badge.label}
                </span>
            }
            actionZone={
                <div className="flex items-center justify-between gap-6">
                    {booked ? (
                        <>
                            <span className="text-base font-semibold leading-6 text-[#101828]">
                                {detail.state === "booked" ? "You're booked" : "You're on the waitlist"}
                            </span>
                            <Button
                                variant="secondary"
                                size="xl"
                                className="rounded-full"
                                onClick={() => router.push("/customer/bookings")}
                            >
                                Manage in Bookings
                            </Button>
                        </>
                    ) : (
                        <>
                            <span className="text-base font-semibold leading-6 text-[#101828]">
                                {typeof credits === "number" ? `${credits} credits left` : " "}
                            </span>
                            {detail.state === "available" ? (
                                <Button
                                    variant="primary"
                                    size="xl"
                                    className="rounded-full"
                                    onClick={() =>
                                        router.push(member ? `/customer/classes/${detail.id}/book` : "/customer/auth")
                                    }
                                >
                                    {member ? "Book class" : "Log in to book"}
                                </Button>
                            ) : detail.state === "waitlist" ? (
                                <Button
                                    variant="primary"
                                    size="xl"
                                    className="rounded-full"
                                    onClick={() =>
                                        router.push(
                                            member
                                                ? `/customer/classes/${detail.id}/book?mode=waitlist`
                                                : "/customer/auth",
                                        )
                                    }
                                >
                                    {member ? "Join waitlist" : "Log in to join"}
                                </Button>
                            ) : (
                                <Button variant="secondary" size="xl" className="rounded-full" disabled>
                                    {detail.state === "closed" ? "Closed" : "Full"}
                                </Button>
                            )}
                        </>
                    )}
                </div>
            }
        />
    );
}
