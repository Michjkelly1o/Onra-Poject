"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Embed booking gate (Class details + Log in / sign up)
// ─────────────────────────────────────────────────────────────────────────────
//
// Where "Book now" from the embedded schedule lands. Two columns (Figma
// 8097-78562): left = the class details; right = a log-in / sign-up card.
//   • Guest    → sees this gate; logging in continues to the customer checkout.
//   • Logged-in → skips straight to the customer flow (/customer/classes/[id]).
//
// Real class data (cover, name, price, description, time, spots, instructor,
// equipment, location). Uses the studio's live brand tokens.

import { useEffect, useMemo, useState, type ComponentType, type SVGProps } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ChevronLeft, Calendar, ClockFastForward, Users01, Grid01,
    CheckCircle, Dotpoints01, Check, MarkerPin01, Clock,
    CoinsStacked03, BankNote01, InfoCircle,
} from "@untitledui/icons";
import { useAppStore, resolveTemplateCoverImage, type ClassSchedule } from "@/lib/store";
import { useIsAuthenticated, loginCustomer } from "@/lib/customer/auth";
import { DEMO_MEMBER_ID } from "@/lib/customer/context";
import { DROP_IN_PRICE_AED } from "@/lib/customer/booking-flow";
import { distributePackageCredits } from "@/lib/customer/credit-balance";
import { genderAccessIcon } from "@/components/ui/gender-icons";
import { InstructorAvatar } from "@/components/ui/InstructorAvatar";
import { Button } from "@/components/ui/button";
import { SocialAuthButtons } from "@/components/customer/auth/SocialAuthButtons";
import { BranchLocationCard } from "@/components/customer/branch/BranchLocationCard";
import { SpotPicker } from "@/components/customer/classes/SpotPicker";
import { PhoneCountryDropdown, splitPhone } from "@/components/customers/CustomerFormPage";

// Same guest-form field styling the customer Review & Book sheet uses.
const CLASS_CREDIT_COST = 1;
const GUEST_INPUT =
    "w-full rounded-xl border border-[#d0d5dd] bg-white px-3.5 py-2.5 text-base leading-6 text-[var(--colors-text-primary)] placeholder:text-[#667085] focus:border-[var(--colors-secondary-500)] focus:outline-none";

function parseISO(iso: string): Date {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}
function durationMin(start?: string, end?: string): number | null {
    if (!start || !end) return null;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? mins : null;
}
function genderLabel(g: string): string {
    return g === "male" ? "Male only" : g === "female" ? "Female only" : "All gender";
}
function to12h(hhmm: string): string {
    const [h, m] = (hhmm || "").split(":").map(Number);
    if (Number.isNaN(h)) return hhmm;
    const period = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${String(m ?? 0).padStart(2, "0")} ${period}`;
}
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmbedClassPage() {
    const params = useParams();
    const id = String(params.id);
    const router = useRouter();
    const authed = useIsAuthenticated();

    const classSchedules = useAppStore(s => s.classSchedules);
    const classTemplates = useAppStore(s => s.classTemplates);
    const classCategories = useAppStore(s => s.classCategories);
    const branches = useAppStore(s => s.branches);
    const staff = useAppStore(s => s.staff);
    const customers = useAppStore(s => s.customers);
    const customerPlans = useAppStore(s => s.customerPlans);
    const packages = useAppStore(s => s.packages);
    const classBookings = useAppStore(s => s.classBookings);
    const leads = useAppStore(s => s.leads);
    const addClassBooking = useAppStore(s => s.addClassBooking);
    const addLead = useAppStore(s => s.addLead);
    const showToast = useAppStore(s => s.showToast);
    const branding = useAppStore(s => s.brandingSettings);

    const s = classSchedules.find(x => x.id === id);
    const instructorImageUrl = staff.find(st => st.id === s?.instructorId)?.imageUrl;

    // Right-column stage machine — everything stays INSIDE the embed, we never
    // redirect to the customer app:
    //   "auth" → log in / sign up   →   "book" → inline book flow (Book to /
    //   Spot / Pay with, same as the customer app)   →   "done" → confirmed.
    type Stage = "auth" | "book" | "done";
    const [stage, setStage] = useState<Stage>("auth");
    // A visitor who is already signed in (or signs in via another tab) skips
    // straight to the book flow; "done" is never rewound.
    useEffect(() => { if (authed) setStage(st => (st === "auth" ? "book" : st)); }, [authed]);

    const [email, setEmail] = useState("");
    const [bookTo, setBookTo] = useState<"myself" | "guest">("myself");
    const [guestName, setGuestName] = useState("");
    const [guestPhone, setGuestPhone] = useState("");
    const [guestPhoneCountry, setGuestPhoneCountry] = useState(() => splitPhone(undefined).country);
    const [guestEmail, setGuestEmail] = useState("");
    const [selectedSpot, setSelectedSpot] = useState<string | undefined>(undefined);
    const [payWith, setPayWith] = useState<string | null>(null); // planId, "drop_in", or null → default

    function continueToBooking() {
        // Demo auth — sign the visitor in, then swap the right column to the
        // inline book flow (no redirect to the customer side).
        loginCustomer(DEMO_MEMBER_ID);
        setStage("book");
    }

    const template = useMemo(() => classTemplates.find(t => t.id === s?.templateId), [classTemplates, s]);
    const cover = template ? resolveTemplateCoverImage(template, classCategories) : undefined;
    const branch = branches.find(b => b.id === s?.branchId);

    const accent = branding.primaryColor || "#164E52";

    if (!s) {
        return (
            <div className="min-h-screen bg-[var(--colors-bg-canvas)] flex items-center justify-center px-6">
                <p className="text-[16px] text-[var(--colors-text-quaternary)]">This class is no longer available.</p>
            </div>
        );
    }
    const dur = durationMin(s.startTime, (s as ClassSchedule & { endTime?: string }).endTime);
    const dateLabel = `${parseISO(s.dateISO).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${to12h(s.startTime)}`;
    const equipment = (s.equipment || "").split(",").map(e => e.trim()).filter(Boolean);
    const emailValid = EMAIL_RE.test(email.trim());

    // ── Inline book-flow derivations — same logic the customer Review & Book
    //    sheet uses, reading from the SAME centralized store slices. ──
    const member = customers.find(c => c.id === DEMO_MEMBER_ID);
    // Plans the member can pay a class credit from (matches customer eligibility:
    // same plan kind, active/frozen), newest first.
    const eligiblePlans = member?.planKind
        ? customerPlans
            .filter(p => p.customerId === member.id && p.kind === member.planKind
                && (p.status === "active" || p.status === "frozen" || p.status === "freeze_requested"))
            .sort((a, b) => (b.purchasedAtISO ?? "").localeCompare(a.purchasedAtISO ?? ""))
        : [];
    const credits = member?.creditsRemaining;
    const hasCredits = typeof credits === "number";
    // Per-package remaining so "credits left after" reflects the individual
    // package, not the combined balance.
    const pkgRemaining = distributePackageCredits(eligiblePlans, credits ?? 0);
    const creditsLeftAfter = (p: (typeof eligiblePlans)[number]): number => {
        const rem = p.kind === "package" ? (pkgRemaining.get(p.id) ?? 0) : (credits ?? 0);
        return Math.max(0, rem - CLASS_CREDIT_COST);
    };
    const hasEligiblePlan = eligiblePlans.length > 0 && (!hasCredits || (credits ?? 0) > 0);
    // "Pay per class" = cheapest active single-credit package for this branch —
    // same computation as the customer sheet's dropInPlan.
    const dropInPlan = (() => {
        const cheapest = packages
            .filter(p => p.status === "active" && p.credits === 1 && (p.branch_ids ?? []).includes(s!.branchId))
            .sort((a, b) => a.price_aed - b.price_aed)[0];
        return cheapest ? { name: cheapest.name, price: cheapest.price_aed } : null;
    })();
    const activePay = payWith ?? eligiblePlans[0]?.id ?? "drop_in";

    // At capacity → this becomes a WAITLIST join (mirrors the customer flow):
    // nothing is charged, no spot is reserved until a seat opens.
    const full = (s.capacity ?? 0) - (s.booked ?? 0) <= 0;
    const spotRequired = !!(s.spotSelectionEnabled && s.spotLayout);
    const takenSpots = spotRequired
        ? [...(s.spotLayout!.blockedSpots || []), ...classBookings.filter(b => b.classScheduleId === s.id && b.spot).map(b => b.spot as string)]
        : [];
    const spotReady = full || !spotRequired || !!selectedSpot;
    const guestReady = bookTo === "myself" || guestName.trim().length > 0;
    const canBook = !!member && guestReady && spotReady;
    const instructorInitials = s.instructorInitials || (s.instructorName || "?").charAt(0);

    function handleBook() {
        if (!member || !canBook) return;
        const status = full ? "waitlisted" : "booked";
        // A waitlist seat costs nothing until promoted → never charge a credit.
        const usingPlan = !full && hasEligiblePlan && activePay !== "drop_in";
        if (bookTo === "myself") {
            addClassBooking({ classScheduleId: s!.id, customerId: member.id, status, spot: full ? undefined : selectedSpot });
        } else {
            const phone = guestPhone.trim() ? `${guestPhoneCountry.dial} ${guestPhone.trim()}` : "";
            addClassBooking({
                classScheduleId: s!.id,
                customerId: member.id,
                status,
                spot: full ? undefined : selectedSpot,
                guestName: guestName.trim(),
                guestPhone: phone || undefined,
                guestEmail: guestEmail.trim() || undefined,
                guestPayment: usingPlan ? "booker_credit" : "drop_in",
                chargeBookerCredit: usingPlan,
            });
            // Guest → Lead: capture the prospect under admin Customers → Leads
            // (dedup by phone), exactly like the customer booking flow.
            const norm = phone.replace(/\s+/g, "");
            if (norm) {
                const known =
                    customers.some(c => c.phone && c.phone.replace(/\s+/g, "") === norm) ||
                    leads.some(l => l.phone && l.phone.replace(/\s+/g, "") === norm);
                if (!known) {
                    addLead({
                        contact_name: guestName.trim() || phone,
                        contact_email: guestEmail.trim(),
                        phone,
                        source: "Referral",
                        stage: "new",
                        engagement_status: "warm",
                        branch_id: s!.branchId,
                    });
                }
            }
        }
        showToast(
            full ? "Added to waitlist" : "Booking confirmed",
            full
                ? `${s!.name} — ${bookTo === "myself" ? "you're" : `${guestName.trim()} is`} on the waitlist.`
                : `${s!.name} booked for ${bookTo === "myself" ? "you" : guestName.trim()}.`,
            "success",
        );
        setStage("done");
    }

    return (
        <div className="min-h-screen bg-[var(--colors-bg-canvas)] px-6 md:px-16 py-10">
            <div className="max-w-[1024px] mx-auto flex flex-col gap-8">
                {/* Back + title */}
                <div className="flex flex-col gap-4">
                    <button type="button" onClick={() => router.back()} aria-label="Back"
                        className="w-10 h-10 flex items-center justify-center rounded-[8px] border border-[var(--colors-border-primary)] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[var(--colors-bg-secondary)] transition-colors">
                        <ChevronLeft className="w-5 h-5 text-[var(--colors-text-secondary)]" />
                    </button>
                    <h1 className="text-[30px] md:text-[36px] font-semibold tracking-[-0.72px] text-[var(--colors-text-primary)] leading-tight">
                        Class details
                    </h1>
                </div>

                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    {/* ── Left — class details ── */}
                    <div className="flex-1 min-w-0 w-full border border-[var(--colors-border-secondary)] rounded-[24px] p-6 flex flex-col gap-6">
                        <div className="flex flex-col gap-3">
                            <div className="size-[88px] rounded-full bg-[var(--colors-bg-secondary)] overflow-hidden flex items-center justify-center">
                                {cover
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={cover} alt="" className="w-full h-full object-cover" />
                                    : <span className="text-[28px] font-semibold text-[var(--colors-text-tertiary)]">{(s.name || "?").charAt(0)}</span>}
                            </div>
                            <div className="flex flex-col gap-1">
                                <p className="text-[20px] font-semibold text-[var(--colors-text-primary)] leading-[30px]">{s.name}</p>
                                <p className="text-[20px] font-semibold leading-[30px]" style={{ color: accent }}>1 credit or AED {dropInPlan?.price ?? DROP_IN_PRICE_AED}</p>
                            </div>
                            {s.description && (
                                <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">{s.description}</p>
                            )}
                        </div>

                        {/* Meta */}
                        <div className="flex flex-col gap-4">
                            <MetaRow icon={<Calendar className="w-4 h-4" />} text={dateLabel} />
                            {dur != null && <MetaRow icon={<ClockFastForward className="w-4 h-4" />} text={`${dur} minutes`} />}
                            <MetaRow icon={<Users01 className="w-4 h-4" />} text={`${s.booked ?? 0}/${s.capacity ?? 0} spots`} />
                            <MetaRow icon={<Grid01 className="w-4 h-4" />} text={s.category || "Class"} />
                            <MetaRow icon={genderAccessIcon(s.genderAccess, "w-4 h-4 text-[var(--colors-text-quaternary)]")} text={genderLabel(s.genderAccess)} />
                            <MetaRow
                                icon={<InstructorAvatar imageUrl={instructorImageUrl} initials={s.instructorInitials || (s.instructorName || "?").charAt(0)} color={s.instructorColor} size={16} />}
                                text={s.instructorName || "Instructor"}
                            />
                        </div>

                        {equipment.length > 0 && (
                            <>
                                <Divider />
                                <Section title="Equipment">
                                    {equipment.map(e => <MetaRow key={e} icon={<Dotpoints01 className="w-4 h-4" />} text={e} />)}
                                </Section>
                            </>
                        )}

                        <Divider />
                        <Section title="Check-in or arrival guidance">
                            <MetaRow icon={<CheckCircle className="w-4 h-4" />} text="Arrive 10 minutes early" />
                            <MetaRow icon={<CheckCircle className="w-4 h-4" />} text="Late entry not permitted after 5 min" />
                        </Section>

                        <Divider />
                        <Section title="Cancellation policy">
                            <p className="text-[14px] text-[var(--colors-text-tertiary)] leading-5">Full refund if you cancel 24 hours before.</p>
                        </Section>

                        <Divider />
                        <BranchLocationCard branch={branch} room={s.room} heading="Location" />
                    </div>

                    {/* ── Right — log in / sign up → inline book flow → confirmed ── */}
                    <div className="w-full lg:w-[420px] shrink-0 border border-[var(--colors-border-secondary)] rounded-[24px] p-6 flex flex-col gap-6">
                        {stage === "auth" && (
                            <>
                                <div className="flex flex-col gap-2">
                                    <p className="text-[24px] font-semibold text-[var(--colors-text-primary)] leading-8">Log in or sign up</p>
                                    <p className="text-[16px] text-[var(--colors-text-quaternary)] leading-6">
                                        Create an account or log in to book and manage your appointments.
                                    </p>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[14px] font-medium text-[var(--colors-text-secondary)]">Email</label>
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            onKeyDown={e => { if (e.key === "Enter" && emailValid) continueToBooking(); }}
                                            placeholder="Enter email address"
                                            className="h-11 px-3.5 border border-[var(--colors-border-primary)] rounded-[8px] text-[16px] text-[var(--colors-text-primary)] placeholder:text-[var(--colors-text-placeholder)] focus:outline-none focus:ring-2 focus:ring-[var(--colors-secondary-300)] focus:border-[var(--colors-secondary-500)] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                                        />
                                    </div>
                                    <Button variant="primary" size="xl" className="w-full rounded-full" disabled={!emailValid} onClick={continueToBooking}>
                                        Continue
                                    </Button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="flex-1 h-px bg-[var(--colors-border-secondary)]" />
                                    <span className="text-[16px] text-[var(--colors-text-quaternary)]">or</span>
                                    <span className="flex-1 h-px bg-[var(--colors-border-secondary)]" />
                                </div>

                                <SocialAuthButtons onProvider={() => continueToBooking()} />
                            </>
                        )}

                        {stage === "book" && member && (
                            <>
                                {/* Book to — Myself / Guest (same as the customer app). */}
                                <section className="flex w-full flex-col gap-3">
                                    <p className="text-base font-semibold leading-6 text-[var(--colors-text-primary)]">Book to</p>
                                    <div className="flex rounded-full border border-[#e4e7ec] bg-[#f9fafb] p-1">
                                        {(["myself", "guest"] as const).map(t => {
                                            const active = bookTo === t;
                                            return (
                                                <button key={t} type="button" onClick={() => setBookTo(t)}
                                                    className={`flex-1 rounded-full py-1 text-sm leading-5 transition-colors ${active ? "bg-white font-semibold text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.06)]" : "font-medium text-[#667085]"}`}>
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
                                                <span className="truncate text-sm font-medium leading-5 text-[var(--colors-text-primary)]">
                                                    {`${member.firstName} ${member.lastName}`.trim()} <span className="font-normal text-[#667085]">(You)</span>
                                                </span>
                                                <span className="truncate text-sm font-normal leading-5 text-[#667085]">{member.email}</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex w-full flex-col gap-4">
                                            <label className="flex w-full flex-col gap-1.5">
                                                <span className="text-sm font-medium leading-5 text-[#344054]">Guest name</span>
                                                <input className={GUEST_INPUT} placeholder="Enter guest name" value={guestName} onChange={e => setGuestName(e.target.value)} />
                                            </label>
                                            <label className="flex w-full flex-col gap-1.5">
                                                <span className="text-sm font-medium leading-5 text-[#344054]">Phone number</span>
                                                {/* Country selector + number share ONE bordered box (same as the
                                                    admin/customer phone field) so the +971 pill isn't background-less. */}
                                                <div className="flex items-stretch rounded-xl border border-[#d0d5dd] bg-white">
                                                    <PhoneCountryDropdown value={guestPhoneCountry} onChange={setGuestPhoneCountry} />
                                                    <input type="tel" inputMode="tel" placeholder="Enter phone number"
                                                        value={guestPhone} onChange={e => setGuestPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                                                        className="flex-1 min-w-0 rounded-r-xl bg-transparent px-3.5 py-2.5 text-base leading-6 text-[var(--colors-text-primary)] placeholder:text-[#667085] focus:outline-none" />
                                                </div>
                                            </label>
                                            <label className="flex w-full flex-col gap-1.5">
                                                <span className="text-sm font-medium leading-5 text-[#344054]">Email <span className="font-normal text-[#98a2b3]">(optional)</span></span>
                                                <input className={GUEST_INPUT} type="email" placeholder="Enter email address" value={guestEmail} onChange={e => setGuestEmail(e.target.value)} />
                                            </label>
                                        </div>
                                    )}

                                    {spotRequired && s.spotLayout && (
                                        <SpotPicker
                                            cols={s.spotLayout.cols}
                                            rows={s.spotLayout.rows}
                                            unavailable={takenSpots}
                                            selected={[selectedSpot]}
                                            seats={[{ initials: member.initials, label: "You" }]}
                                            onChange={next => setSelectedSpot(next[0])}
                                            compact
                                        />
                                    )}
                                </section>

                                {/* Pay with — hidden on a waitlist join (a seat costs nothing
                                    until it's promoted, so nothing is charged now). */}
                                {full ? (
                                    <div className="flex w-full items-start gap-2 rounded-xl border border-[#eaecf0] bg-[#f9fafb] p-4">
                                        <InfoCircle className="mt-0.5 size-4 shrink-0 text-[#667085]" aria-hidden />
                                        <p className="text-sm font-normal leading-5 text-[#475467]">
                                            This class is full. Join the waitlist now — you&apos;ll choose how to pay if a spot opens.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <Divider />

                                        {/* Pay with — plan credit (FeaturedIcon + RadioDot) or drop-in. */}
                                        <section className="flex w-full flex-col gap-3">
                                            <p className="text-base font-semibold leading-6 text-[var(--colors-text-primary)]">Pay with</p>
                                            {hasEligiblePlan ? (
                                                eligiblePlans.map(p => {
                                                    const sel = activePay === p.id;
                                                    const sub = !hasCredits ? "Included in your membership" : `${creditsLeftAfter(p)} credits left after this booking`;
                                                    return (
                                                        <button key={p.id} type="button" onClick={() => setPayWith(p.id)}
                                                            className={`flex w-full items-center gap-3 rounded-xl bg-white p-4 text-left transition-colors ${sel ? "border-2" : "border border-[#e4e7ec]"}`}
                                                            style={sel ? { borderColor: accent } : undefined}>
                                                            <FeaturedIcon icon={CoinsStacked03} />
                                                            <span className="flex min-w-0 flex-1 flex-col">
                                                                <span className="truncate text-sm font-medium leading-5 text-[var(--colors-text-primary)]">{p.name}</span>
                                                                <span className="truncate text-sm font-normal leading-5 text-[#475467]">{sub}</span>
                                                            </span>
                                                            <RadioDot checked={sel} accent={accent} />
                                                        </button>
                                                    );
                                                })
                                            ) : (
                                                <div className="flex w-full items-center gap-3 rounded-xl border-2 bg-white p-4" style={{ borderColor: accent }}>
                                                    <FeaturedIcon icon={BankNote01} />
                                                    <span className="flex min-w-0 flex-1 flex-col">
                                                        <span className="truncate text-sm font-medium leading-5 text-[var(--colors-text-primary)]">Pay per class</span>
                                                        <span className="truncate text-sm font-normal leading-5 text-[#667085]">AED {dropInPlan?.price ?? DROP_IN_PRICE_AED} · single drop-in</span>
                                                    </span>
                                                    <RadioDot checked accent={accent} />
                                                </div>
                                            )}
                                        </section>
                                    </>
                                )}

                                <Button variant="primary" size="xl" className="w-full rounded-full mt-auto" disabled={!canBook} onClick={handleBook}>
                                    {full ? "Join waitlist" : "Book now"}
                                </Button>
                            </>
                        )}

                        {stage === "done" && (
                            <div className="flex flex-col items-center gap-6 py-4">
                                {/* Ringed brand check (mirrors the customer success screen). */}
                                <div className="relative flex size-12 shrink-0 items-center justify-center">
                                    <span className="absolute -inset-[7px] rounded-full border-2 opacity-30" style={{ borderColor: accent }} aria-hidden />
                                    <span className="absolute -inset-[15px] rounded-full border-2 opacity-10" style={{ borderColor: accent }} aria-hidden />
                                    <span className="flex size-12 items-center justify-center rounded-full" style={{ backgroundColor: accent }}>
                                        <Check className="size-6 text-white" strokeWidth={3} aria-hidden />
                                    </span>
                                </div>

                                <p className="text-center text-[20px] font-semibold leading-[30px] text-[var(--colors-text-primary)]">
                                    {full ? "You're on the waitlist!" : "Your booking is confirmed!"}
                                </p>

                                <div className="w-full flex flex-col gap-4 rounded-[20px] border border-[var(--colors-border-secondary)] bg-white p-4 shadow-[0px_24px_48px_-12px_rgba(16,24,40,0.12)]">
                                    <div className="relative h-[160px] w-full overflow-hidden rounded-2xl bg-[var(--colors-bg-secondary)]">
                                        {cover && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
                                        )}
                                        {full ? (
                                            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-[var(--colors-border-secondary)] bg-white px-2 py-0.5 text-xs font-medium leading-[18px] text-[var(--colors-text-secondary)]">
                                                Waitlisted
                                            </span>
                                        ) : (
                                            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-xs font-medium leading-[18px]" style={{ borderColor: accent, color: accent }}>
                                                <CheckCircle className="size-3 shrink-0" aria-hidden /> Booked
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <p className="text-[16px] font-semibold leading-6 text-[var(--colors-text-primary)]">{s.name}</p>
                                        <p className="text-[14px] font-normal leading-5 text-[var(--colors-text-tertiary)]">{dateLabel}</p>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-[14px] font-normal leading-5 text-[var(--colors-text-tertiary)]">
                                            {dur != null && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                                    {dur} mins
                                                </span>
                                            )}
                                            {s.instructorName && <span aria-hidden>•</span>}
                                            {s.instructorName && (
                                                <span className="flex items-center gap-1.5">
                                                    <InstructorAvatar imageUrl={instructorImageUrl} initials={instructorInitials} color={s.instructorColor} size={20} />
                                                    {s.instructorName}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-start gap-1.5 pt-1 text-[14px] font-normal leading-5 text-[var(--colors-text-tertiary)]">
                                            <MarkerPin01 className="mt-0.5 size-4 shrink-0 text-[var(--colors-text-quaternary)]" aria-hidden />
                                            <span className="min-w-0 flex-1">{s.room ? `${s.room} - ${branch?.name ?? ""}` : (branch?.name ?? "")}</span>
                                        </div>
                                    </div>
                                </div>

                                <Button variant="secondary" size="lg" className="w-full rounded-full" onClick={() => router.back()}>
                                    Done
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function MetaRow({ icon, text }: { icon: React.ReactNode; text: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2 text-[14px] text-[var(--colors-text-tertiary)] leading-5">
            <span className="shrink-0 mt-0.5 text-[var(--colors-text-quaternary)] flex items-center">{icon}</span>
            <span className="min-w-0">{text}</span>
        </div>
    );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3">
            <p className="text-[16px] font-semibold text-[var(--colors-text-primary)] leading-6">{title}</p>
            {children}
        </div>
    );
}
function Divider() {
    return <div className="h-px w-full bg-[var(--colors-border-secondary)]" />;
}
function FeaturedIcon({ icon: Icon }: { icon: ComponentType<SVGProps<SVGSVGElement>> }) {
    // DS "Featured icon — default": white tile, subtle border + shadow, dark glyph
    // (identical to the customer Review & Book sheet).
    return (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <Icon className="size-5 text-[#344054]" aria-hidden />
        </span>
    );
}
function RadioDot({ checked, accent }: { checked: boolean; accent: string }) {
    return (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: checked ? accent : "#d0d5dd" }}>
            {checked && <span className="size-2.5 rounded-full" style={{ backgroundColor: accent }} />}
        </span>
    );
}
