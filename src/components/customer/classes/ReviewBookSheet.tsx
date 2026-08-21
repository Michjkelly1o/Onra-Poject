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
import { AlertCircle, BankNote01, ChevronLeft, ChevronRight, Clock, CoinsStacked03, InfoCircle, Link01, MarkerPin01, ShoppingBag03, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { useCurrentCustomerContext } from "@/lib/customer/context";
import { useClassDetail, useNeedsWaiver } from "@/lib/customer/search-data";
import { getFrozenActiveMembership } from "@/lib/customer/freeze-eligibility";
import { bookingDraft, ensureBookingDraft, type GuestPayment } from "@/lib/customer/booking-flow";
import { distributePackageCredits } from "@/lib/customer/credit-balance";
import { addToCart, cartCount, cartTotal, ensurePurchaseCart, purchaseCart, usePurchasePlans, type PlanRow } from "@/lib/customer/purchase";
import { shortDate } from "@/lib/customer/profile-format";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { ProductCard } from "@/components/customer/products/ProductCard";
import { CheckoutCart } from "@/components/customer/checkout/CheckoutCart";
import { PaymentProcessing } from "@/components/customer/checkout/PaymentProcessing";
import { SpotPicker } from "@/components/customer/classes/SpotPicker";
import { PhoneCountrySheet } from "@/components/customer/profile/PhoneCountrySheet";
import { splitPhone } from "@/components/customers/CustomerFormPage";
import { Button } from "@/components/ui/button";

const DEFAULT_GUEST_COUNTRY = splitPhone(undefined).country;

const CLASS_CREDIT_COST = 1;
// Same slide feel as the appointment flow — one sheet, panels slide left/right.
const SLIDE_MS = 360;
const SLIDE_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

const GUEST_INPUT =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--brand-text)] placeholder:text-[#667085] focus:border-[var(--brand-primary)] focus:outline-none";

type BookTo = "myself" | "guest";
/** Guest pay options (simplified, client 2026-08). Only two remain:
 *  `booker_credit` = "Use my plan" (host pays a credit for the guest, if the
 *  studio allows it) and `invite_link` = "Send invite link" (the friend gets a
 *  WhatsApp link and books themselves). Drop-in + "use their credits" retired. */
type GuestPay = Extract<GuestPayment, "invite_link" | "booker_credit">;

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
    const packages = useAppStore((s) => s.packages);
    const memberships = useAppStore((s) => s.memberships);
    const purchasePlans = usePurchasePlans();
    const customers = useAppStore((s) => s.customers);
    const leads = useAppStore((s) => s.leads);
    const addLead = useAppStore((s) => s.addLead);
    const showToast = useAppStore((s) => s.showToast);
    const classesSettings = useAppStore((s) => s.classesSettings);
    // Booking Rules → "Guest bookings" gating (defaults cover a pre-v105 store).
    const guestsUsePlan = classesSettings.guests_use_plan_enabled ?? true;
    const guestsAllowUnlimited = classesSettings.guests_allow_unlimited ?? false;
    const needsWaiver = useNeedsWaiver();
    const frozenMembership = member ? getFrozenActiveMembership(member.id, customerPlans) : null;

    const [bookTo, setBookTo] = useState<BookTo>("myself");
    const [guest, setGuest] = useState<{ name: string; phone: string; email: string } | null>(null);
    const [guestPay, setGuestPay] = useState<GuestPay>("booker_credit");
    const [selectedSpots, setSelectedSpots] = useState<(string | undefined)[]>([]);
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
    // One sliding sheet — every screen is a forward/back panel (never a new sheet):
    //   0 main · 1 guest details · 2 payment methods · 3 purchase plan (tabs) ·
    //   4 plan checkout · 5 pay-per-class checkout. Panels slide left/right.
    const [step, setStep] = useState<number>(0);
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [guestPhoneCountry, setGuestPhoneCountry] = useState(DEFAULT_GUEST_COUNTRY);
    const [guestEmail, setGuestEmail] = useState("");
    // Purchase-plan panel: which tab (Membership / Packages) is shown.
    const [planTab, setPlanTab] = useState<"membership" | "package">("membership");
    // Which checkout panel is live (4 = plan purchase · 5 = pay-per-class · null =
    // none). Only ONE CheckoutCart mounts at a time so the two never fight over the
    // shared purchase cart; it stays mounted through a slide-back until the other
    // checkout is entered (so it never blanks mid-slide).
    const [checkoutPanel, setCheckoutPanel] = useState<4 | 5 | null>(null);
    // In-sheet plan-purchase processing (panel 6): the key remounts a fresh
    // <PaymentProcessing> per purchase; the method label feeds its receipt.
    const [processingKey, setProcessingKey] = useState(0);
    const [paidMethod, setPaidMethod] = useState("Apple pay");
    // True while a CheckoutCart sub-panel (Payment method / Promo) covers the sheet
    // — the shared header hides so there's never a double header.
    const [checkoutSubActive, setCheckoutSubActive] = useState(false);
    // Bumps the purchase-plan panel so the floating cart bar reflects cart edits.
    const [, bumpCart] = useState(0);

    // Reset the flow state each time the sheet opens for a class.
    useEffect(() => {
        if (!open) return;
        ensureBookingDraft(classId);
        setBookTo("myself");
        setGuest(null);
        setGuestPay("booker_credit");
        setSelectedSpots([]);
        setStep(0);
        setGuestName("");
        setGuestPhone("");
        setGuestPhoneCountry(DEFAULT_GUEST_COUNTRY);
        setGuestEmail("");
        setPlanTab("membership");
        setCheckoutPanel(null);
        setCheckoutSubActive(false);
        setProcessingKey(0);
    }, [open, classId]);

    // Enter the guest-details panel, seeding the form from any saved guest.
    function openGuestPanel() {
        setGuestName(guest?.name ?? "");
        const seed = splitPhone(guest?.phone);
        setGuestPhone(seed.number);
        setGuestPhoneCountry(seed.country);
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

    // "Pay per class" (currency) buys the cheapest single-credit package
    // applicable to this class's branch — one credit = one class. Hidden when
    // the branch offers no such drop-in package.
    const dropInPlan = useMemo(() => {
        const branchId = detail?.branchId;
        if (!branchId) return null;
        const cheapest = packages
            .filter((p) => p.status === "active" && p.credits === 1 && (p.branch_ids ?? []).includes(branchId))
            .sort((a, b) => a.price_aed - b.price_aed)[0];
        return cheapest ? (purchasePlans.find((pl) => pl.id === cheapest.id) ?? null) : null;
    }, [packages, purchasePlans, detail?.branchId]);

    // Plans applicable to THIS class's branch, split for the Membership / Packages
    // tabs (mirrors the Products module split, reusing <ProductCard>).
    const branchPlans = useMemo(() => {
        const branchId = detail?.branchId;
        if (!branchId) return purchasePlans;
        return purchasePlans.filter((plan) => {
            const rec =
                plan.kind === "membership"
                    ? memberships.find((m) => m.id === plan.id)
                    : packages.find((p) => p.id === plan.id);
            return (rec?.branch_ids ?? []).includes(branchId);
        });
    }, [purchasePlans, memberships, packages, detail?.branchId]);

    if (!open || !detail || !member) return null;

    const membershipPlans = branchPlans.filter((p) => p.kind === "membership");
    const packagePlans = branchPlans.filter((p) => p.kind === "package");

    const credits = member.creditsRemaining;
    const hasCredits = typeof credits === "number";
    const creditsAfter = hasCredits ? Math.max(0, credits - CLASS_CREDIT_COST) : null;
    // Per-PACKAGE remaining (distributed from the balance) so "credits left after"
    // reflects the individual package, not the combined total across packages.
    const pkgRemaining = distributePackageCredits(eligiblePlans, credits ?? 0);
    const creditsLeftAfter = (p: (typeof eligiblePlans)[number]): number => {
        const rem = p.kind === "package" ? (pkgRemaining.get(p.id) ?? 0) : (credits ?? 0);
        return Math.max(0, rem - CLASS_CREDIT_COST);
    };
    const hasEligiblePlan = eligiblePlans.length > 0 && (!hasCredits || (credits ?? 0) > 0);

    // "Use my plan" (booker_credit) — the host pays a credit for the guest. Shown
    // only when Booking Rules allow it, the host has an eligible plan, and (for an
    // unlimited membership) unlimited plans are allowed for guests.
    const hostGuestEligible =
        guestsUsePlan && eligiblePlans.length > 0 && (hasCredits ? (credits ?? 0) > 0 : guestsAllowUnlimited);
    // Clamp the selection to a still-valid option: "Use my plan" falls back to
    // "Send invite link" when the host has no eligible plan / the studio disallows it.
    const guestPaySafe: GuestPay =
        guestPay === "booker_credit" && !hostGuestEligible ? "invite_link" : guestPay;
    // The host plan that "Use my plan" spends (auto-selected first, switchable
    // via the plan picker when the host holds more than one eligible plan).
    const selectedHostPlan = eligiblePlans.find((p) => p.id === selectedPlanId) ?? eligiblePlans[0];

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

    /** Record the guest as a Lead (admin Customers → Leads) — dedup by phone,
     *  keeping the optional email when the guest provided one. */
    function captureGuestLead(name: string, phone: string, email: string) {
        const p = phone.trim();
        if (!p || !detail) return;
        const norm = p.replace(/\s+/g, "");
        const known =
            customers.some((c) => c.phone && c.phone.replace(/\s+/g, "") === norm) ||
            leads.some((l) => l.phone && l.phone.replace(/\s+/g, "") === norm);
        if (known) return;
        addLead({
            contact_name: name.trim() || p,
            contact_email: email.trim(),
            phone: p,
            source: "Referral",
            stage: "new",
            engagement_status: "warm",
            branch_id: detail.branchId,
        });
    }

    function confirm() {
        if (!detail || !member || !canConfirm) return;
        // "Send invite link" — the friend books themselves, so we DON'T reserve a
        // seat: share the class link over WhatsApp + log the guest as a lead.
        if (bookTo === "guest" && guest && guestPaySafe === "invite_link") {
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const classUrl = `${origin}/customer/classes/${detail.id}`;
            const message = `Hi ${guest.name || "there"}! Join me for ${detail.name} on ${fullDate} at ${startTime12}. Book your spot here: ${classUrl}`;
            const waDigits = guest.phone.replace(/\D/g, "");
            const waUrl = waDigits
                ? `https://wa.me/${waDigits}?text=${encodeURIComponent(message)}`
                : `https://wa.me/?text=${encodeURIComponent(message)}`;
            if (typeof window !== "undefined") window.open(waUrl, "_blank");
            captureGuestLead(guest.name, guest.phone, guest.email);
            showToast("Invite ready", `WhatsApp invite prepared for ${guest.name || "your guest"}.`, "success", "check");
            onClose();
            return;
        }
        bookingDraft.bookSelf = bookTo === "myself";
        bookingDraft.guests =
            bookTo === "guest" && guest
                ? [{ name: guest.name.trim(), phone: guest.phone.trim(), email: guest.email.trim(), payment: guestPaySafe }]
                : [];
        bookingDraft.spots = spotRequired ? (selectedSpots[0] ? [selectedSpots[0]] : []) : [];
        const params = new URLSearchParams({ mode });
        if (spotRequired && selectedSpots[0]) params.set("spot", selectedSpots[0]);
        const next = needsWaiver ? "waiver" : "processing";
        onClose();
        router.push(`/customer/classes/${detail.id}/book/${next}?${params.toString()}`);
    }

    // #5 — slide forward to the purchase-plan panel (Membership / Packages tabs).
    function openPurchasePlan() {
        if (!detail) return;
        // Start the plan cart clean, defaulting to the tab that has options.
        ensurePurchaseCart(detail.id);
        purchaseCart.items = [];
        purchaseCart.promoId = null;
        setPlanTab(membershipPlans.length > 0 ? "membership" : "package");
        setStep(3);
    }

    // Add a plan to the cart. A membership is exclusive → slide straight to
    // checkout; a package stacks and stays so more can be added (floating bar).
    function addPlan(plan: PlanRow) {
        if (!detail) return;
        ensurePurchaseCart(detail.id);
        addToCart(plan, 1);
        bumpCart((n) => n + 1);
        if (plan.kind === "membership") {
            setCheckoutPanel(4);
            setStep(4);
        }
    }

    // #4b — pay for THIS class with currency (like the appointment checkout): a
    // fixed drop-in price paid by card / wallet, no plan added to the account.
    function openPayPerClass() {
        if (!detail || !dropInPlan) return;
        // Spot-selection classes must have a spot chosen BEFORE payment (same rule
        // as "Book now") so the paid seat is never auto-assigned behind the member.
        if (spotMissing) {
            showToast("Select a spot", "Choose your spot before continuing to payment.", "warning");
            return;
        }
        // Book the member into this class once the currency payment completes.
        ensureBookingDraft(detail.id);
        bookingDraft.bookSelf = true;
        bookingDraft.guests = [];
        bookingDraft.spots = spotRequired && selectedSpots[0] ? [selectedSpots[0]] : [];
        setCheckoutPanel(5);
        setStep(5);
    }

    // Plan checkout "Pay now" — process the purchase IN-SHEET (panel 6), then slide
    // back to Review & Book with the new plan auto-selected (no full-page success).
    function handlePlanPaid(method: string) {
        setPaidMethod(method);
        setProcessingKey((k) => k + 1);
        setStep(6);
    }
    function handlePlanProcessed() {
        // applyPurchase (run by PaymentProcessing) created the plan → clear the
        // selection so the preselect effect picks the freshly-bought plan.
        setSelectedPlanId(null);
        setCheckoutPanel(null);
        setStep(0);
        showToast("Plan added", "Your new plan is ready — you can book this class now.", "success", "check");
    }

    // Per-step header: title + which step "Back" returns to. The checkout panels
    // (4 plan / 5 pay-per-class) hand their header to the shared one, EXCEPT while
    // a CheckoutCart sub-panel is open — then it renders its own (appointment flow).
    const stepTitle =
        step === 1 ? "Guest details"
            : step === 2 ? "Payment method"
                : step === 3 ? "Purchase plan"
                    : step === 4 || step === 5 ? "Payment"
                        : "Review and book";
    const backTarget: number | null = step === 4 ? 3 : step >= 1 && step !== 6 ? 0 : null;
    // Hidden while a checkout sub-panel covers the sheet, and during the transient
    // plan-purchase processing panel (6) which owns the whole surface.
    const showHeader = !((step === 4 || step === 5) && checkoutSubActive) && step !== 6;

    // Class summary card for the pay-per-class (currency) checkout — same shape as
    // the appointment checkout summary so both currency flows read identically.
    const classSummary = (
        <div className="flex w-full flex-col gap-5">
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
                                <span className="text-xs leading-[18px] text-[#475467]" aria-hidden>•</span>
                                <span className="text-xs font-normal leading-[18px] text-[#475467]">{detail.instructorName}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="h-px w-full bg-[#e4e7ec]" />
        </div>
    );

    // Booking has the full form (scrolls) → fixed tall sheet. Joining a waitlist
    // is short → let the sheet HUG its content so it doesn't leave empty space.
    // Both booking AND joining a waitlist use the full tall sheet, with the main
    // content scrolling — one consistent height across the flows (client 2026-08).
    const tallMode = true;
    return (
      <>
        <CustomerSheet open={open} onClose={onClose} tall={tallMode}>
          <div className={tallMode ? "flex h-full flex-col" : "flex flex-col"}>
            {/* Sticky header — title + back (sub-panels) / X close (main). Hidden
                while a checkout sub-panel covers the sheet (it draws its own). */}
            {showHeader && (
            <div className="relative flex shrink-0 items-center justify-center pb-3">
                {backTarget != null ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (step === 1 && !guest) setBookTo("myself");
                            setStep(backTarget);
                        }}
                        aria-label="Back"
                        className="absolute left-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                    </button>
                ) : (
                    <span aria-hidden className="absolute left-0 size-8" />
                )}
                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">{stepTitle}</p>
                {backTarget != null ? (
                    <span aria-hidden className="absolute right-0 size-8" />
                ) : (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute right-0 flex size-8 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                    >
                        <XClose className="size-5 text-[#344054]" aria-hidden />
                    </button>
                )}
            </div>
            )}

            {/* Sliding track — main → guest details → payment methods (seamless). */}
            <div className={`relative -mx-4 mt-1 overflow-hidden ${tallMode ? "min-h-0 flex-1" : ""}`}>
                <div
                    className={`flex w-full ${tallMode ? "h-full" : "items-start"}`}
                    style={{ transform: `translateX(-${step * 100}%)`, transition: `transform ${SLIDE_MS}ms ${SLIDE_EASE}` }}
                >
                    {/* Panel 0 — main */}
                    <div className={`flex w-full shrink-0 flex-col px-4 ${tallMode ? "h-full" : ""}`}>
                        <div className={`flex flex-col gap-5 pt-2 ${tallMode ? "min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`}>
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
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Book to</p>
                        <div className="flex rounded-full border border-[#e4e7ec] bg-[#f9fafb] p-1">
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
                                        {guest.phone || "Guest booking"}
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

                    {/* Pay with — for a waitlist join this records the INTENDED
                        payment (Myself or Guest, same options); nothing is charged
                        until the spot is promoted to booked. */}
                    {(
                        <>
                            <div className="h-px w-full shrink-0 bg-[#e4e7ec]" />
                            <section className="flex w-full flex-col gap-3">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Pay with</p>

                                {bookTo === "myself" ? (
                                    hasEligiblePlan ? (
                                        <div className="flex flex-col gap-3">
                                            {/* Full list of eligible plans — pick one directly (no
                                                "See more"). A single plan auto-selects. */}
                                            {eligiblePlans.map((p) => {
                                                const sel = (selectedPlanId ?? eligiblePlans[0]?.id) === p.id;
                                                const sub = !hasCredits
                                                    ? "Included in your membership"
                                                    : `${creditsLeftAfter(p)} credits left after this booking`;
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
                                    ) : mode === "book" ? (
                                        <div className="flex flex-col gap-3">
                                            {/* #4b — pay for this class with currency (drop-in). Shown
                                                only when the branch sells a single-class package. */}
                                            {dropInPlan && (
                                                <button
                                                    type="button"
                                                    onClick={openPayPerClass}
                                                    className={`flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors ${spotMissing ? "opacity-60" : "active:bg-gray-50"}`}
                                                >
                                                    <FeaturedIcon icon={BankNote01} />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">
                                                            Pay per class
                                                        </span>
                                                        <span className="truncate text-sm font-normal leading-5 text-[#667085]">
                                                            {spotMissing ? "Select your spot first" : `AED ${dropInPlan.price} · single drop-in`}
                                                        </span>
                                                    </span>
                                                    <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                                </button>
                                            )}
                                            {/* #5 — buy a membership / package (bottom sheet). */}
                                            <button
                                                type="button"
                                                onClick={openPurchasePlan}
                                                className="flex w-full items-center gap-3 rounded-xl border border-[#e4e7ec] bg-white p-4 text-left transition-colors active:bg-gray-50"
                                            >
                                                <FeaturedIcon icon={ShoppingBag03} />
                                                <span className="flex min-w-0 flex-1 flex-col">
                                                    <span className="truncate text-sm font-medium leading-5 text-[var(--brand-text)]">
                                                        Purchase plan
                                                    </span>
                                                    <span className="truncate text-sm font-normal leading-5 text-[#667085]">
                                                        Membership or class package
                                                    </span>
                                                </span>
                                                <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex w-full items-start gap-2 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                                            <InfoCircle className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                                You can join the waitlist now — you&apos;ll choose how to pay if a spot opens.
                                            </p>
                                        </div>
                                    )
                                ) : (
                                    <div className="flex flex-col gap-3">
                                        {([
                                            // "Use my plan" — host pays a credit; shown only when the
                                            // studio allows it and the host holds an eligible plan.
                                            { id: "booker_credit" as GuestPay, icon: CoinsStacked03, label: "Use my plan", sub: selectedHostPlan?.name ? `${selectedHostPlan.name} · ${CLASS_CREDIT_COST} credit` : `${CLASS_CREDIT_COST} credit from your plan`, disabled: false, show: hostGuestEligible },
                                            // "Send invite link" — the friend gets a WhatsApp link, signs
                                            // in / signs up, and books the class themselves.
                                            { id: "invite_link" as GuestPay, icon: Link01, label: "Send invite link", sub: "Friend gets a WhatsApp link & books themselves", disabled: false, show: true },
                                        ].filter((o) => o.show)).map((o) => {
                                            const sel = guestPaySafe === o.id;
                                            const canSwitchPlan = o.id === "booker_credit" && sel && eligiblePlans.length > 1;
                                            return (
                                                <button
                                                    key={o.id}
                                                    type="button"
                                                    disabled={o.disabled}
                                                    onClick={() => (canSwitchPlan ? setStep(2) : !o.disabled && setGuestPay(o.id))}
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
                                                        <span className="truncate text-sm font-normal leading-5 text-[#667085]">{o.sub}</span>
                                                    </span>
                                                    {canSwitchPlan ? (
                                                        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold leading-5 text-[var(--brand-primary)]">
                                                            Change
                                                            <ChevronRight className="size-4" aria-hidden />
                                                        </span>
                                                    ) : (
                                                        <RadioDot checked={sel} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        </>
                    )}

                    {/* Waitlist → a gray "nothing charged yet" note (no cancellation
                        policy, since joining a waitlist doesn't take a credit until
                        a spot opens). Booking → the cancellation policy. */}
                    {mode === "waitlist" ? (
                        <div className="flex w-full shrink-0 items-start gap-2 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                            <InfoCircle className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                You won&apos;t be charged now. Your selected payment is applied only if a spot opens
                                and your waitlist spot becomes a booking.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="h-px w-full shrink-0 bg-[#e4e7ec]" />
                            <section className="flex w-full flex-col gap-2">
                                <p className="text-base font-semibold leading-6 text-[var(--brand-text)] font-heading">Cancellation policy</p>
                                <p className="text-sm font-normal leading-5 text-[#475467]">Full refund if you cancel 24 hours before.</p>
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

                        {/* Footer — total reflects the chosen payment. Guest drop-in
                            → AED; plan/credit → "1 credit"; invite link → nothing (the
                            guest completes the booking themselves). */}
                        <div className="flex shrink-0 items-center justify-between gap-6 pt-4">
                            <span className="text-base font-semibold leading-6 text-[var(--brand-text)]">
                                {(() => {
                                    const creditText = `${CLASS_CREDIT_COST} credit${CLASS_CREDIT_COST === 1 ? "" : "s"}`;
                                    if (bookTo !== "guest") return creditText;
                                    if (guestPaySafe === "invite_link") return "";
                                    return creditText; // booker_credit
                                })()}
                            </span>
                            <Button variant="primary" size="xl" className="rounded-full" disabled={!canConfirm} onClick={confirm}>
                                {mode === "waitlist" ? "Join waitlist" : spotMissing ? "Select a spot" : "Book now"}
                            </Button>
                        </div>
                    </div>

                    {/* Panel 1 — Guest details (slides in from the Guest tab). */}
                    <div className={`flex w-full shrink-0 flex-col px-4 ${tallMode ? "h-full" : ""}`}>
                        <div className={`flex flex-col gap-4 pt-2 ${tallMode ? "min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""}`}>
                            <label className="flex w-full flex-col gap-1.5">
                                <span className="text-sm font-medium leading-5 text-[#344054]">Guest name</span>
                                <input
                                    className={GUEST_INPUT}
                                    placeholder="Enter guest name"
                                    value={guestName}
                                    onChange={(e) => setGuestName(e.target.value)}
                                />
                            </label>
                            <label className="flex w-full flex-col gap-1.5">
                                <span className="text-sm font-medium leading-5 text-[#344054]">Phone number</span>
                                <div className="flex items-stretch gap-2">
                                    <PhoneCountrySheet value={guestPhoneCountry} onChange={setGuestPhoneCountry} />
                                    <input
                                        className={`${GUEST_INPUT} flex-1`}
                                        type="tel"
                                        inputMode="tel"
                                        placeholder="Enter phone number"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                                    />
                                </div>
                            </label>
                            <label className="flex w-full flex-col gap-1.5">
                                <span className="text-sm font-medium leading-5 text-[#344054]">Email <span className="font-normal text-[#98a2b3]">(optional)</span></span>
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
                                    const phone = guestPhone.trim() ? `${guestPhoneCountry.dial} ${guestPhone.trim()}` : "";
                                    setGuest({ name: guestName.trim(), phone, email: guestEmail.trim() });
                                    setBookTo("guest");
                                    setStep(0);
                                }}
                            >
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* Panel 2 — Payment methods (all eligible plans; "See more").
                        Always mounted so the sliding-track indices stay aligned
                        across book + waitlist modes. */}
                    <div className="flex w-full shrink-0 flex-col px-4 h-full">
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {eligiblePlans.map((p) => {
                                const sel = selectedPlanId === p.id;
                                const sub = !hasCredits
                                    ? "Included in your membership"
                                    : `${creditsLeftAfter(p)} credits left after this booking`;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedPlanId(p.id);
                                            setStep(0);
                                        }}
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
                    </div>

                    {/* Panel 3 — Purchase plan (Membership / Packages tabs, reusing
                        the Products <ProductCard>). Adding a plan slides forward to
                        the plan checkout (panel 4). */}
                    <div className="flex w-full shrink-0 flex-col px-4 h-full">
                        {/* Tabs — only two, so each fills half the width (underline
                            spans the full tab). */}
                        <div className="flex shrink-0 border-b border-[#eaecf0]">
                            {([
                                { id: "membership" as const, label: "Membership" },
                                { id: "package" as const, label: "Packages" },
                            ]).map((t) => {
                                const active = planTab === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setPlanTab(t.id)}
                                        className={`-mb-px flex h-9 flex-1 items-center justify-center whitespace-nowrap text-sm leading-5 transition-colors ${
                                            active
                                                ? "border-b-2 border-[var(--brand-text)] font-semibold text-[var(--brand-text)]"
                                                : "font-medium text-[#667085]"
                                        }`}
                                    >
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pt-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {(planTab === "membership" ? membershipPlans : packagePlans).map((plan) => (
                                <ProductCard
                                    key={plan.id}
                                    product={plan}
                                    cartQty={purchaseCart.items.find((i) => i.id === plan.id)?.quantity ?? 0}
                                    onAdd={() => addPlan(plan)}
                                />
                            ))}
                            {(planTab === "membership" ? membershipPlans : packagePlans).length === 0 && (
                                <p className="px-1 pt-8 text-center text-sm font-normal leading-5 text-[#667085]">
                                    No {planTab === "membership" ? "memberships" : "packages"} available for this class.
                                </p>
                            )}
                        </div>
                        {/* Floating cart bar — packages stack; tap to review + pay. */}
                        {cartCount() > 0 && (
                            <div className="shrink-0 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setCheckoutPanel(4);
                                        setStep(4);
                                    }}
                                    className="flex w-full items-center gap-4 rounded-xl bg-[var(--brand-tertiary)] px-4 py-3 text-left shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] transition-colors active:brightness-95"
                                >
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-sm font-normal leading-5 text-[#344054]">
                                            {cartCount()} item{cartCount() === 1 ? "" : "s"}
                                        </span>
                                        <span className="text-sm font-semibold leading-5 text-[var(--brand-text)]">AED {cartTotal()}</span>
                                    </div>
                                    <ChevronRight className="size-5 shrink-0 text-[#344054]" aria-hidden />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Panel 4 — Plan checkout (buy the membership / packages). Its
                        header is the shared one; sub-panels (methods / promo) slide
                        in and hide it via onSubviewChange. */}
                    <div className="flex w-full shrink-0 flex-col px-4 h-full">
                        {checkoutPanel === 4 && (
                            <CheckoutCart
                                variant="sheet"
                                originId={detail.id}
                                hideHeader
                                onBack={() => setStep(3)}
                                onSubviewChange={setCheckoutSubActive}
                                onPaid={handlePlanPaid}
                                processingHref={`/customer/classes/${detail.id}/book/checkout/processing`}
                            />
                        )}
                    </div>

                    {/* Panel 5 — Pay per class (currency). Fixed drop-in price paid
                        by card / wallet — like the appointment checkout — then the
                        member is booked into the class. */}
                    <div className="flex w-full shrink-0 flex-col px-4 h-full">
                        {checkoutPanel === 5 && dropInPlan && (
                            <CheckoutCart
                                variant="sheet"
                                originId={`class-dropin-${detail.id}`}
                                hideHeader
                                summary={classSummary}
                                fixedSubtotal={dropInPlan.price}
                                onBack={() => setStep(0)}
                                onSubviewChange={setCheckoutSubActive}
                                processingHref={`/customer/classes/${detail.id}/book/processing`}
                            />
                        )}
                    </div>

                    {/* Panel 6 — In-sheet plan-purchase processing. Applies the
                        purchase (creates the plan) then slides back to Review & Book
                        (panel 0) with the new plan selected — no full-page success. */}
                    <div className="flex w-full shrink-0 flex-col px-4 h-full">
                        {processingKey > 0 && (
                            <PaymentProcessing
                                key={processingKey}
                                originId={detail.id}
                                method={paidMethod}
                                onDone={handlePlanProcessed}
                            />
                        )}
                    </div>
                </div>
            </div>
          </div>
        </CustomerSheet>
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
