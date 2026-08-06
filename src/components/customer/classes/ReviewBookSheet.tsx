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
import { AlertCircle, BankNote01, ChevronLeft, ChevronRight, Clock, CoinsStacked03, Link01, MarkerPin01, ShoppingBag03, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useClassDetail, useNeedsWaiver } from "@/lib/customer/search-data";
import { getFrozenActiveMembership } from "@/lib/customer/freeze-eligibility";
import { bookingDraft, ensureBookingDraft, DROP_IN_PRICE_AED, type GuestPayment } from "@/lib/customer/booking-flow";
import { shortDate } from "@/lib/customer/profile-format";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SpotPicker } from "@/components/customer/classes/SpotPicker";
import { Button } from "@/components/ui/button";

const CLASS_CREDIT_COST = 1;
// Same slide feel as the appointment flow — one sheet, panels slide left/right.
const SLIDE_MS = 360;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

const GUEST_INPUT =
    "w-full rounded-xl border border-[var(--colors-border-primary)] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[var(--colors-text-quaternary)] focus:border-[var(--brand-primary)] focus:outline-none";

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
    // 0 = main · 1 = guest details · 2 = payment methods ("See more"). Panels slide.
    const [step, setStep] = useState<0 | 1 | 2>(0);
    const [guestName, setGuestName] = useState("");
    const [guestEmail, setGuestEmail] = useState("");

    // Reset the flow state each time the sheet opens for a class.
    useEffect(() => {
        if (!open) return;
        ensureBookingDraft(classId);
        setBookTo("myself");
        setGuest(null);
        setGuestPay("drop_in");
        setSelectedSpots([]);
        setStep(0);
        setGuestName("");
        setGuestEmail("");
    }, [open, classId]);

    // Enter the guest-details panel, seeding the form from any saved guest.
    function openGuestPanel() {
        setGuestName(guest?.name ?? "");
        setGuestEmail(guest?.email ?? "");
        setStep(1);
    }

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

    const headerTitle = step === 1 ? "Guest details" : step === 2 ? "Payment method" : "Review and book";
    return (
        <CustomerSheet open={open} onClose={onClose} tall>
            {/* Sticky header — title + back (sub-panels) / X close (main). */}
            <div className="relative flex shrink-0 items-center justify-center pb-3">
                {step !== 0 ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (step === 1 && !guest) setBookTo("myself");
                            setStep(0);
                        }}
                        aria-label="Back"
                        className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                ) : (
                    <span aria-hidden className="absolute left-0 size-8" />
                )}
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">{headerTitle}</p>
                {step !== 0 ? (
                    <span aria-hidden className="absolute right-0 size-8" />
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[var(--colors-border-secondary)] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                    </button>
                )}
            </div>

            {/* Sliding track — main → guest details → payment methods (seamless). */}
            <div className="relative -mx-4 mt-1 min-h-0 flex-1 overflow-hidden">
                <div
                    className="flex h-full w-full"
                    style={{ transform: `translateX(-${step * 100}%)`, transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}` }}
                >
                    {/* Panel 0 — main */}
                    <div className="flex h-full w-full shrink-0 flex-col px-4">
                        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {/* Class Summary */}
                    <div className="flex w-full items-start gap-3">
                        <div
                            className="size-[82px] shrink-0 overflow-hidden rounded-[10px] border border-[var(--colors-border-secondary)]"
                            style={!detail.coverImage ? { backgroundColor: detail.coverColor } : undefined}
                        >
                            {detail.coverImage && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={detail.coverImage} alt="" className="size-full object-cover" />
                            )}
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <p className="truncate text-sm font-medium leading-5 text-[var(--colors-text-primary)]">{detail.name}</p>
                            <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                                {fullDate} at {startTime12}
                            </p>
                            <div className="flex items-start gap-1.5">
                                <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                <p className="text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                                    {detail.room} - {detail.branchName}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="flex items-center gap-1 text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                                    <Clock className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                    {detail.durationMins} mins
                                </span>
                                {detail.instructorName && (
                                    <>
                                        <span className="text-xs leading-[18px] text-[var(--colors-text-tertiary)]" aria-hidden>
                                            •
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs font-normal leading-[18px] text-[var(--colors-text-tertiary)]">
                                            <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                                                {detail.instructorImageUrl ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={detail.instructorImageUrl} alt="" className="size-full scale-[1.4] object-cover" />
                                                ) : (
                                                    <span className="text-[9px] font-semibold leading-none text-[var(--colors-text-quaternary)]">
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

                    <div className="h-px w-full shrink-0 bg-[var(--colors-bg-quaternary)]" />

                    {/* Book to */}
                    <section className="flex w-full flex-col gap-3">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Book to</p>
                        <div className="flex rounded-full border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] p-1">
                            {(["myself", "guest"] as BookTo[]).map((t) => {
                                const active = bookTo === t;
                                return (
                                    <button
                                        key={t}
                                        type="button"
                                        onClick={() => {
                                            setBookTo(t);
                                            // Switching to Guest with no guest yet → slide to the details panel.
                                            if (t === "guest" && !guest) openGuestPanel();
                                        }}
                                        className={`flex-1 rounded-full py-1 text-sm leading-5 transition-colors ${
                                            active
                                                ? "bg-white font-semibold text-[var(--colors-text-secondary)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)]"
                                                : "font-medium text-[var(--colors-text-quaternary)]"
                                        }`}
                                    >
                                        {t === "myself" ? "Myself" : "Guest"}
                                    </button>
                                );
                            })}
                        </div>

                        {bookTo === "myself" ? (
                            <div className="flex w-full items-center gap-3 rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--colors-bg-tertiary)]">
                                    {member.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={member.imageUrl} alt="" className="size-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-semibold leading-none text-[var(--colors-text-quaternary)]">{member.initials}</span>
                                    )}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">
                                        {`${member.firstName} ${member.lastName}`.trim()}{" "}
                                        <span className="font-normal text-[var(--colors-text-quaternary)]">(You)</span>
                                    </span>
                                    <span className="truncate text-sm font-normal leading-5 text-[var(--colors-text-quaternary)]">{member.email}</span>
                                </div>
                            </div>
                        ) : guest ? (
                            <div className="flex w-full items-center gap-3 rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4">
                                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--colors-bg-tertiary)] text-xs font-semibold text-[var(--colors-text-quaternary)]">
                                    {guest.name.trim().slice(0, 1).toUpperCase() || "G"}
                                </span>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{guest.name}</span>
                                    <span className="truncate text-sm font-normal leading-5 text-[var(--colors-text-quaternary)]">
                                        {guest.email || "Guest booking"}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={openGuestPanel}
                                    className="shrink-0 text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                                >
                                    Edit
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={openGuestPanel}
                                className="flex w-full items-center justify-center rounded-xl border border-dashed border-[var(--colors-border-primary)] bg-white p-4 text-sm font-semibold leading-5 text-[var(--brand-primary)] transition-colors active:bg-gray-50"
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
                            <div className="h-px w-full shrink-0 bg-[var(--colors-bg-quaternary)]" />
                            <section className="flex w-full flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Pay with</p>

                                {bookTo === "myself" ? (
                                    hasEligiblePlan ? (
                                        <div className="flex flex-col gap-3">
                                            {/* Only the selected (most-recent by default) plan shows;
                                                "See more" slides to the full list to switch. */}
                                            {(() => {
                                                const p = eligiblePlans.find((x) => x.id === selectedPlanId) ?? eligiblePlans[0];
                                                const sub = !hasCredits
                                                    ? "Included in your membership"
                                                    : `${creditsAfter} credits left after this booking`;
                                                return (
                                                    <div className="flex w-full items-center gap-3 rounded-xl border-2 border-[var(--brand-primary)] bg-white p-4 text-left">
                                                        <FeaturedIcon icon={CoinsStacked03} />
                                                        <span className="flex min-w-0 flex-1 flex-col">
                                                            <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{p.name}</span>
                                                            <span className="truncate text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{sub}</span>
                                                        </span>
                                                        <RadioDot checked />
                                                    </div>
                                                );
                                            })()}
                                            {eligiblePlans.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => setStep(2)}
                                                    className="flex items-center gap-1 self-start text-sm font-semibold leading-5 text-[var(--brand-primary)]"
                                                >
                                                    See more
                                                    <ChevronRight className="size-4" aria-hidden />
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onClose();
                                                router.push(`/customer/classes/${detail.id}/book/plans`);
                                            }}
                                            className="flex w-full items-center gap-3 rounded-xl border border-[var(--colors-border-secondary)] bg-white p-4 text-left transition-colors active:bg-gray-50"
                                        >
                                            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--colors-border-secondary)] bg-white">
                                                <ShoppingBag03 className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
                                            </span>
                                            <span className="min-w-0 flex-1 truncate text-base font-medium leading-6 text-[var(--brand-text)]">
                                                Purchase plan
                                            </span>
                                            <ChevronRight className="size-5 shrink-0 text-[var(--colors-text-secondary)]" aria-hidden />
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
                                                            ? "border border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)] opacity-60"
                                                            : sel
                                                              ? "border-2 border-[var(--brand-primary)] bg-white"
                                                              : "border border-[var(--colors-border-secondary)] bg-white"
                                                    }`}
                                                >
                                                    <FeaturedIcon icon={o.icon} />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="text-sm font-medium leading-5 text-[var(--brand-text)]">{o.label}</span>
                                                        <span className="text-sm font-normal leading-5 text-[var(--colors-text-quaternary)]">{o.sub}</span>
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

                    {/* Cancellation policy — mirrors the Class Details section. */}
                    <div className="h-px w-full shrink-0 bg-[var(--colors-bg-quaternary)]" />
                    <section className="flex w-full flex-col gap-2">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Cancellation policy</p>
                        <p className="text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">Full refund if you cancel 24 hours before.</p>
                    </section>

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

                        {/* Footer — credit cost + Book now (Class Details chrome). */}
                        <div className="flex shrink-0 items-center justify-between gap-6 pt-4">
                            <span className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                                {CLASS_CREDIT_COST} credit{CLASS_CREDIT_COST === 1 ? "" : "s"}
                            </span>
                            <Button variant="primary" size="xl" className="rounded-full" disabled={!canConfirm} onClick={confirm}>
                                {mode === "waitlist" ? "Join waitlist" : spotMissing ? "Select a spot" : "Book now"}
                            </Button>
                        </div>
                    </div>

                    {/* Panel 1 — Guest details (slides in from the Guest tab). */}
                    <div className="flex h-full w-full shrink-0 flex-col px-4">
                        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            <label className="flex w-full flex-col gap-1.5">
                                <span className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Guest name</span>
                                <input
                                    className={GUEST_INPUT}
                                    placeholder="Enter guest name"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                />
                            </label>
                            <label className="flex w-full flex-col gap-1.5">
                                <span className="text-sm font-medium leading-5 text-[var(--colors-text-secondary)]">Email</span>
                                <input
                                    className={GUEST_INPUT}
                                    type="email"
                                    placeholder="Enter email address"
                                    value={guestEmail}
                                    onChange={(e) => setGuestEmail(e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="shrink-0 pt-4">
                            <Button
                                variant="primary"
                                size="xl"
                                className="w-full rounded-full"
                                disabled={!guestName.trim()}
                                onClick={() => {
                                    setGuest({ name: guestName.trim(), email: guestEmail.trim() });
                                    setBookTo("guest");
                                    setStep(0);
                                }}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* Panel 2 — Payment methods (all eligible plans; "See more"). */}
                    <div className="flex h-full w-full shrink-0 flex-col px-4">
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {eligiblePlans.map((p) => {
                                const sel = selectedPlanId === p.id;
                                const sub = !hasCredits
                                    ? "Included in your membership"
                                    : `${creditsAfter} credits left after this booking`;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPlanId(p.id);
                                            setStep(0);
                                        }}
                                        className={`flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors ${
                                            sel ? "border-2 border-[var(--brand-primary)] bg-white" : "border border-[var(--colors-border-secondary)] bg-white"
                                        }`}
                                    >
                                        <FeaturedIcon icon={CoinsStacked03} />
                                        <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">{p.name}</span>
                                            <span className="truncate text-sm font-normal leading-5 text-[var(--colors-text-tertiary)]">{sub}</span>
                                        </span>
                                        <RadioDot checked={sel} />
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </CustomerSheet>
    );
}

function FeaturedIcon({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
    // DS "Featured icon — default": white tile, subtle border + shadow, dark glyph
    // (no colour fill, matching the Products module). Figma uses a tint here but
    // the client wants the plain default (client 2026-08).
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--colors-border-secondary)] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <Icon className="size-5 text-[var(--colors-text-secondary)]" aria-hidden />
        </span>
    );
}

function RadioDot({ checked }: { checked: boolean }) {
    return (
        <span
            className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                checked ? "border-[var(--brand-primary)]" : "border-[var(--colors-border-primary)]"
            }`}
        >
            {checked && <span className="size-2.5 rounded-full bg-[var(--brand-primary)]" />}
        </span>
    );
}
