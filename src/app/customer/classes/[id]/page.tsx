"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Class Details (`/customer/classes/[id]`) — Figma 2386-36343
// ─────────────────────────────────────────────────────────────────────────────
//
// Composes the shared <ClassDetailLayout> (also used by Booking Detail) and
// supplies the discovery hero badge + a state-driven action zone: Book class /
// Join waitlist / Full / Manage in Bookings. Reads the live class detail VM.

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { loginHref } from "@/lib/customer/auth-flow";
import { ChevronLeft, Hourglass03, Users01 } from "@untitledui/icons";
import { useCurrentCustomer } from "@/lib/customer/context";
import { useClassDetail } from "@/lib/customer/search-data";
import { formatLongDate, to12h } from "@/lib/customer/dates";
import { ClassDetailLayout } from "@/components/customer/classes/ClassDetailLayout";
import { WaitlistClaimSheet } from "@/components/customer/classes/WaitlistClaimSheet";
import { hasLiveWaitlistClaim, useAppStore } from "@/lib/store";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { Button } from "@/components/ui/button";
import { getFrozenActiveMembership } from "@/lib/customer/freeze-eligibility";
import { shortDate } from "@/lib/customer/profile-format";

// One class credit is spent per booked seat (see `addClassBooking`).
const CLASS_CREDIT_COST = 1;

export default function ClassDetailPage() {
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const detail = useClassDetail(id);
    const member = useCurrentCustomer();

    // ── "Notify to accept" waitlist offer ──────────────────────────────────
    // When a booked member cancels and Booking Rules say "Notify to accept",
    // the store reserves the spot for the next person in line. If that's this
    // member, present the claim/decline sheet the moment they open the class —
    // whether they arrived from the notification or navigated here themselves.
    const bookings = useAppStore((st) => st.classBookings);
    const claimWaitlistSpot = useAppStore((st) => st.claimWaitlistSpot);
    const declineWaitlistSpot = useAppStore((st) => st.declineWaitlistSpot);
    const expireWaitlistClaims = useAppStore((st) => st.expireWaitlistClaims);
    const showToast = useAppStore((st) => st.showToast);
    // Phase 3 — a frozen membership blocks the waitlist claim path too. The
    // sheet still opens so the member sees why they can't claim, but the
    // primary CTA is disabled + a red banner tells them the resume date.
    const customerPlans = useAppStore((st) => st.customerPlans);
    const frozenMembership = member ? getFrozenActiveMembership(member.id, customerPlans) : null;
    // Lapse any stale offers on entry so an expired claim cascades to the next
    // person without needing a background timer.
    useEffect(() => {
        expireWaitlistClaims();
    }, [expireWaitlistClaims]);
    const myClaim = member
        ? bookings.find((b) => b.classScheduleId === id && b.customerId === member.id && hasLiveWaitlistClaim(b))
        : undefined;
    const [claimSheetOpen, setClaimSheetOpen] = useState(false);
    const [claimDismissed, setClaimDismissed] = useState(false);
    useEffect(() => {
        if (myClaim && !claimDismissed) setClaimSheetOpen(true);
    }, [myClaim, claimDismissed]);

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
                    <p className="text-base font-semibold text-[var(--brand-text)]">This class is no longer available</p>
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={() => router.push("/customer/search")}>
                        Back to Search
                    </Button>
                </div>
            </div>
        );
    }

    // Hero badge — leading icon + label mirror the class card (Users for open
    // spots, Hourglass for waitlist; FULL / Closed / Booked stay text-only).
    const badge =
        detail.state === "available"
            ? { icon: Users01, label: `${detail.booked}/${detail.capacity} spots`, cls: "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]" }
            : detail.state === "waitlist"
              ? { icon: Hourglass03, label: `${detail.waitlistCount}/${detail.maxWaitlist} waitlist`, cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
              : detail.state === "booked"
                ? { icon: null, label: "Booked", cls: "border-[var(--brand-primary)] bg-[var(--brand-tertiary)] text-[var(--brand-primary)]" }
                : detail.state === "waitlisted"
                  ? { icon: null, label: "Waitlisted", cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
                  : detail.state === "closed"
                    ? { icon: null, label: "Closed", cls: "border-[#e4e7ec] bg-white/90 text-[#344054]" }
                    : { icon: null, label: "FULL", cls: "border-[#fecdca] bg-[#fef3f2] text-[#b42318]" };
    const BadgeIcon = badge.icon;

    const credits = member?.creditsRemaining;
    const booked = detail.state === "booked" || detail.state === "waitlisted";

    const claimMinutesLeft = myClaim?.waitlistClaimExpiresAt
        ? Math.max(1, Math.round((Date.parse(myClaim.waitlistClaimExpiresAt) - Date.now()) / 60_000))
        : null;

    return (
        <>
        <ClassDetailLayout
            detail={detail}
            heroBadge={
                <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-[18px] ${badge.cls}`}>
                    {BadgeIcon && <BadgeIcon className="size-3 shrink-0" aria-hidden />}
                    {badge.label}
                </span>
            }
            actionZone={
                <div className="flex items-center justify-between gap-6">
                    {booked ? (
                        <>
                            <span className="text-base font-semibold leading-6 text-[var(--brand-text)]">
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
                            {/* What this class costs leads (prominent); the running
                                balance sits under it, muted. 4px apart. */}
                            <span className="flex min-w-0 flex-col gap-1">
                                <span className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                                    {CLASS_CREDIT_COST} credit{CLASS_CREDIT_COST === 1 ? "" : "s"}
                                </span>
                                <span className="text-sm font-normal leading-5 text-[#475467]">
                                    {typeof credits === "number" ? `${credits} credits left` : " "}
                                </span>
                            </span>
                            {detail.state === "available" ? (
                                <Button
                                    variant="primary"
                                    size="xl"
                                    className="rounded-full"
                                    onClick={() =>
                                        router.push(member ? `/customer/classes/${detail.id}/book` : loginHref(`/customer/classes/${detail.id}`))
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
                                                : loginHref(`/customer/classes/${detail.id}`),
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
        {myClaim && (
            <WaitlistClaimSheet
                open={claimSheetOpen}
                onClose={() => {
                    // Dismissing without choosing leaves the offer live — it
                    // lapses on its own and passes to the next person.
                    setClaimSheetOpen(false);
                    setClaimDismissed(true);
                }}
                className={detail.name}
                when={`${formatLongDate(detail.dateISO)} • ${to12h(detail.startTime)}`}
                expiresLabel={claimMinutesLeft ? `${claimMinutesLeft} minute${claimMinutesLeft === 1 ? "" : "s"}` : undefined}
                blockedReason={
                    frozenMembership
                        ? `Your ${frozenMembership.planName} is frozen — you can book again on ${shortDate(frozenMembership.resumeISO)}.`
                        : undefined
                }
                onClaim={() => {
                    if (frozenMembership) return;
                    const ok = claimWaitlistSpot(myClaim.id);
                    showToast(
                        ok ? "You're booked!" : "Spot no longer available",
                        ok
                            ? `You've been moved from the waitlist into ${detail.name}.`
                            : "That spot was taken or the claim window closed.",
                        ok ? "success" : "error",
                    );
                }}
                onDecline={() => {
                    declineWaitlistSpot(myClaim.id);
                    showToast("Spot declined", "It's been offered to the next person on the waitlist.", "success");
                }}
            />
        )}
        </>
    );
}
