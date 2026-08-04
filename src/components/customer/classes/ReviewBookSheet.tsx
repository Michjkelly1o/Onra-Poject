"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Review & Book (bottom sheet) — Figma 4580-161234
// ─────────────────────────────────────────────────────────────────────────────
//
// The class booking review, presented as a fixed-height bottom sheet over the
// page it was opened from (Class Details / Search). Sections top-to-bottom:
//   • Class Summary — cover + name + date·time + room·branch + duration·instructor
//   • Book to — Myself / Guest tabs (merges the old Guest + Spot sections). Guest
//     opens the Guest Details sub-sheet. Spot picker shows only when the class has
//     spot selection enabled.
//   • Pay with — Myself: the member's eligible plan(s) (preselected) or a
//     "Purchase plan" card; Guest: drop-in / use their credits / send invite link.
//   • Sticky footer — credit cost + "Book now" (same chrome as Class Details).
//
// Confirm hands off to the existing Processing → Success routes via `bookingDraft`
// (unchanged write path), so all credit/plan/spot/waitlist business logic is
// preserved.

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BankNote01, ChevronRight, Clock, CoinsStacked03, Link01, MarkerPin01, ShoppingBag03, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useClassDetail, useNeedsWaiver } from "@/lib/customer/search-data";
import { getFrozenActiveMembership } from "@/lib/customer/freeze-eligibility";
import { bookingDraft, ensureBookingDraft, DROP_IN_PRICE_AED, type GuestPayment } from "@/lib/customer/booking-flow";
import { shortDate } from "@/lib/customer/profile-format";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SpotPicker } from "@/components/customer/classes/SpotPicker";
import { GuestDetailsSheet } from "@/components/customer/classes/GuestDetailsSheet";
import { Button } from "@/components/ui/button";

const CLASS_CREDIT_COST = 1;

type BookTo = "myself" | "guest";
/** Guest pay options (never the booker's own plan — client 2026-08). */
type GuestPay = Extract<GuestPayment, "drop_in" | "guest_package" | "invite_link">;

export function ReviewBookSheet({
    open,
    onClose,
    classId,
    mode,
}: {
    open: boolean;
    onClose: () => void;
    classId: string;
    mode: "book" | "waitlist";
}) {
    const router = useRouter();
    const detail = useClassDetail(classId);
    const { member } = useCurrentCustomerContext();
    const allBookings = useAppStore((s) => s.classBookings);
    const customerPlans = useAppStore((s) => s.customerPlans);
    const customers = useAppStore((s) => s.customers);
    const needsWaiver = useNeedsWaiver();
    const frozenMembership = member ? getFrozenActiveMembership(member.id, customerPlans) : null;

    const [bookTo, setBookTo] = useState<BookTo>("myself");
    const [guest, setGuest] = useState<{ name: string; email: string } | null>(null);
    const [guestPay, setGuestPay] = useState<GuestPay>("drop_in");
    const [selectedSpots, setSelectedSpots] = useState<(string | undefined)[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    const [guestSheet, setGuestSheet] = useState(false);

    // Reset the flow state each time the sheet opens for a class.
    useEffect(() => {
        if (!open) return;
        ensureBookingDraft(classId);
        setBookTo("myself");
        setGuest(null);
        setGuestPay("drop_in");
        setSelectedSpots([]);
    }, [open, classId]);

    // The member's eligible plan(s) for "Pay with" (Myself) — active/frozen,
    // non-complimentary, matching the held plan kind. Newest first.
    const eligiblePlans = useMemo(() => {
        if (!member?.planKind) return [];
        return customerPlans
            .filter(
                (p) =>
                    p.customerId === member.id &&
                    p.kind === member.planKind &&
                    (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"),
            )
            .sort((a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""));
    }, [customerPlans, member]);

    // Preselect the first eligible plan whenever the set changes.
    useEffect(() => {
        if (eligiblePlans.length > 0) setSelectedPlanId((cur) => cur ?? eligiblePlans[0].id);
    }, [eligiblePlans]);

    // Resolve the guest (by email) to an active member — gates "Use their credits"
    // on the GUEST's own plan (a customer never pays for a guest from their plan).
    const guestMember = guest?.email
        ? customers.find((c) => c.status === "active" && c.email.trim().toLowerCase() === guest.email.trim().toLowerCase())
        : undefined;
    const guestHasCredits =
        !!guestMember && typeof guestMember.creditsRemaining === "number" && (guestMember.creditsRemaining ?? 0) > 0;
    // If "use their credits" was picked but the guest has no eligible plan, fall back.
    useEffect(() => {
        if (guestPay === "guest_package" && !guestHasCredits) setGuestPay("drop_in");
    }, [guestPay, guestHasCredits]);

    if (!open || !detail || !member) return null;

    const credits = member.creditsRemaining;
    const hasCredits = typeof credits === "number";
    const creditsAfter = hasCredits ? Math.max(0, credits - CLASS_CREDIT_COST) : null;
    const hasEligiblePlan = eligiblePlans.length > 0 && (!hasCredits || (credits ?? 0) > 0);

    const fullDate = new Date(`${detail.dateISO}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const startTime12 = new Date(`${detail.dateISO}T${detail.startTime}:00`).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });

    // ── Spot selection (only when the admin enabled it; never on a waitlist join) ──
    const spotLayout = detail.spotSelectionEnabled ? detail.spotLayout : undefined;
    const spotRequired = !!spotLayout && mode === "book";
    const takenSpots = spotLayout
        ? [
              ...spotLayout.blockedSpots,
              ...allBookings
                  .filter((b) => b.classScheduleId === detail.id && b.status === "booked" && b.spot)
                  .map((b) => b.spot as string),
          ]
        : [];
    // A single seat — placed for whoever the booking is for (You / the guest).
    const seatLabel = bookTo === "guest" ? (guest?.name?.trim() || "Guest") : "You";
    const seatInitials =
        bookTo === "guest"
            ? (guest?.name?.trim().slice(0, 1).toUpperCase() || "G")
            : (member.initials ?? "You");
    const spotSeats = [{ initials: seatInitials, label: seatLabel }];
    const spotMissing = spotRequired && !selectedSpots[0];

    // ── Validation ──
    const guestReady = bookTo === "myself" || (!!guest && !!guest.name.trim());
    const payReady = mode === "waitlist" || (bookTo === "guest" ? true : hasEligiblePlan);
    const canConfirm = !frozenMembership && guestReady && payReady && !spotMissing;

    function confirm() {
        if (!detail || !member || !canConfirm) return;
        bookingDraft.bookSelf = bookTo === "myself";
        bookingDraft.guests =
            bookTo === "guest" && guest
                ? [{ name: guest.name.trim(), email: guest.email.trim(), payment: guestPay }]
                : [];
        bookingDraft.spots = spotRequired ? (selectedSpots[0] ? [selectedSpots[0]] : []) : [];
        const params = new URLSearchParams({ mode });
        if (spotRequired && selectedSpots[0]) params.set("spot", selectedSpots[0]);
        const next = needsWaiver ? "waiver" : "processing";
        onClose();
        router.push(`/customer/classes/${detail.id}/book/${next}?${params.toString()}`);
    }

    return (
        <>
            <CustomerSheet open={open} onClose={onClose} tall>
                {/* Header */}
                <div className="relative flex shrink-0 items-center justify-center pb-3">
                    <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Review and book</p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                </div>

                {/* Scroll body */}
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Class Summary */}
                    <div className="flex w-full items-start gap-3">
                        <div
                            className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[#e4e7ec]"
                            style={!detail.coverImage ? { backgroundColor: detail.coverColor } : undefined}
                        >
                            {detail.coverImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={detail.coverImage} alt="" className="size-full object-cover" />
                            )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <p className="truncate text-sm font-medium leading-5 text-[#101828]">{detail.name}</p>
                            <p className="text-xs font-normal leading-[18px] text-[#475467]">
                                {fullDate} at {startTime12}
                            </p>
                            <div className="flex items-start gap-1.5">
                                <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                                <p className="text-xs font-normal leading-[18px] text-[#475467]">
                                    {detail.room} - {detail.branchName}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[#475467]">
                                    <Clock className="size-4 shrink-0 text-[#667085]" aria-hidden />
                                    {detail.durationMins} mins
                                </span>
                                {detail.instructorName && (
                                    <>
                                        <span className="text-xs leading-[18px] text-[#475467]" aria-hidden>
                                            •
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-normal leading-[18px] text-[#475467]">
                                            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                                {detail.instructorImageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={detail.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                                ) : (
                                                    <span className="text-[9px] font-semibold leading-none text-[#667085]">
                                                        {detail.instructorInitials}
                                                    </span>
                                                )}
                                            </span>
                                            {detail.instructorName}
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px w-full shrink-0 bg-[#e4e7ec]" />

                    {/* Book to */}
                    <section className="flex w-full flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Book to</p>
                        <div className="flex rounded-full border border-[#e4e7ec] bg-[#f9fafb] p-1">
                            {(["myself", "guest"] as BookTo[]).map((t) => {
                                const active = bookTo === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setBookTo(t);
                                            // Switching to Guest with no guest yet → open the details sheet.
                                            if (t === "guest" && !guest) setGuestSheet(true);
                                        }}
                                        className={`flex-1 rounded-full py-1 text-sm leading-5 transition-colors ${
                                            active
                                                ? "bg-white font-semibold text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                                : "font-medium text-[#667085]"
                                        }`}
                                    >
                                        {t === "myself" ? "Myself" : "Guest"}
                                    </button>
                                );
                            })}
                        </div>

                        {bookTo === "myself" ? (
                            <div className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f2f4f7]">
                                    {member.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={member.imageUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-semibold leading-none text-[#667085]">{member.initials}</span>
                                    )}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">
                                        {`${member.firstName} ${member.lastName}`.trim()}{" "}
                                        <span className="font-normal text-[#667085]">(You)</span>
                                    </span>
                                    <span className="truncate text-sm font-normal leading-5 text-[#667085]">{member.email}</span>
                                </div>
                            </div>
                        ) : guest ? (
                            <div className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#f2f4f7] text-xs font-semibold text-[#667085]">
                                    {guest.name.trim().slice(0, 1).toUpperCase() || "G"}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{guest.name}</span>
                                    <span className="truncate text-sm font-normal leading-5 text-[#667085]">
                                        {guest.email || "Guest booking"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setGuestSheet(true)}
                                    className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                                >
                                    Edit
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setGuestSheet(true)}
                                className="flex w-full items-center justify-center rounded-xl border border-dashed border-[#d0d5dd] bg-white p-4 text-sm font-semibold leading-5 text-[var(--brand-primary)] transition-colors active:bg-gray-50"
                            >
                                Add guest details
                            </button>
                        )}

                        {/* Spot selection — merged in; hidden entirely when disabled. */}
                        {spotRequired && spotLayout && (
                            <SpotPicker
                                cols={spotLayout.cols}
                                rows={spotLayout.rows}
                                unavailable={takenSpots}
                                selected={selectedSpots}
                                seats={spotSeats}
                                onChange={setSelectedSpots}
                                compact
                            />
                        )}
                    </section>

                    {/* Pay with — hidden for waitlist (nothing charged until promoted). */}
                    {mode === "book" && (
                        <>
                            <div className="h-px w-full shrink-0 bg-[#e4e7ec]" />
                            <section className="flex w-full flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Pay with</p>

                                {bookTo === "myself" ? (
                                    hasEligiblePlan ? (
                                        <div className="flex flex-col gap-3">
                                            {eligiblePlans.map((p) => {
                                                const sel = selectedPlanId === p.id;
                                                const sub =
                                                    !hasCredits
                                                        ? "Included in your membership"
                                                        : `${creditsAfter} credits left after this booking`;
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => setSelectedPlanId(p.id)}
                                                        className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                                                            sel ? "border-2 border-[var(--brand-primary)] bg-white" : "border border-[#e4e7ec] bg-white"
                                                        }`}
                                                    >
                                                        <FeaturedIcon icon={CoinsStacked03} />
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{p.name}</span>
                                                            <span className="truncate text-sm font-normal leading-5 text-[#475467]">{sub}</span>
                                                        </span>
                                                        <RadioDot checked={sel} />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                router.push(`/customer/classes/${detail.id}/book/plans`);
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors active:bg-gray-50"
                                        >
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#e4e7ec] bg-white">
                                                <ShoppingBag03 className="size-5 text-[#344054]" aria-hidden />
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-base font-medium leading-6 text-[var(--brand-text)]">
                                                Purchase plan
                                            </span>
                                            <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                        </button>
                                    )
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {([
                                            { id: "drop_in" as GuestPay, icon: BankNote01, label: "Guest pays drop-in", sub: `AED ${DROP_IN_PRICE_AED} per class`, disabled: false },
                                            { id: "guest_package" as GuestPay, icon: CoinsStacked03, label: "Use their credits", sub: guestHasCredits ? "1 credit from their plan" : "No eligible plan for this guest", disabled: !guestHasCredits },
                                            { id: "invite_link" as GuestPay, icon: Link01, label: "Send invite link", sub: "Friend pays & books themselves", disabled: false },
                                        ]).map((o) => {
                                            const sel = guestPay === o.id;
                                            return (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    disabled={o.disabled}
                                                    onClick={() => !o.disabled && setGuestPay(o.id)}
                                                    className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                                                        o.disabled
                                                            ? "border border-[#e4e7ec] bg-[#f9fafb] opacity-60"
                                                            : sel
                                                              ? "border-2 border-[var(--brand-primary)] bg-white"
                                                              : "border border-[#e4e7ec] bg-white"
                                                    }`}
                                                >
                                                    <FeaturedIcon icon={o.icon} />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{o.label}</span>
                                                        <span className="text-sm font-normal leading-5 text-[#667085]">{o.sub}</span>
                                                    </span>
                                                    <RadioDot checked={sel} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {frozenMembership && (
                        <div className="flex w-full items-start gap-2 rounded-xl border border-[#fda29b] bg-[#fffbfa] p-4">
                            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#d92d20]" aria-hidden />
                            <p className="text-sm font-normal leading-5 text-[#b42318]">
                                Your <span className="font-semibold">{frozenMembership.planName}</span> is frozen — you can book again on{" "}
                                {shortDate(frozenMembership.resumeISO)}.
                            </p>
                        </div>
                    )}
                </div>

                {/* Sticky footer — credit cost + Book now (Class Details chrome). */}
                <div className="flex shrink-0 items-center justify-between gap-6 pt-4">
                    <span className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                        {CLASS_CREDIT_COST} credit{CLASS_CREDIT_COST === 1 ? "" : "s"}
                    </span>
                    <Button variant="primary" size="xl" className="rounded-full" disabled={!canConfirm} onClick={confirm}>
                        {mode === "waitlist" ? "Join waitlist" : spotMissing ? "Select a spot" : "Book now"}
                    </Button>
                </div>
            </CustomerSheet>

            {/* Guest Details sub-sheet */}
            <GuestDetailsSheet
                open={guestSheet}
                initial={guest}
                onBack={() => {
                    // Cancelling with no guest yet reverts to Myself.
                    if (!guest) setBookTo("myself");
                    setGuestSheet(false);
                }}
                onSave={(g) => {
                    setGuest(g);
                    setBookTo("guest");
                    setGuestSheet(false);
                }}
            />
        </>
    );
}

function FeaturedIcon({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
    // DS "Featured icon — default": white tile, subtle border + shadow, dark glyph
    // (no colour fill, matching the Products module). Figma uses a tint here but
    // the client wants the plain default (client 2026-08).
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <Icon className="size-5 text-[#344054]" aria-hidden />
        </span>
    );
}

function RadioDot({ checked }: { checked: boolean }) {
    return (
        <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                checked ? "border-[var(--brand-primary)]" : "border-[#d0d5dd]"
            }`}
        >
            {checked && <span className="size-2.5 rounded-full bg-[var(--brand-primary)]" />}
        </span>
    );
}
