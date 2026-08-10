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

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
    ChevronLeft, Calendar, ClockFastForward, Users01, Grid01,
    CheckCircle, Dotpoints01,
} from "@untitledui/icons";
import { useAppStore, resolveTemplateCoverImage, type ClassSchedule } from "@/lib/store";
import { useIsAuthenticated, loginCustomer } from "@/lib/customer/auth";
import { DEMO_MEMBER_ID } from "@/lib/customer/context";
import { DROP_IN_PRICE_AED } from "@/lib/customer/booking-flow";
import { genderAccessIcon } from "@/components/ui/gender-icons";
import { InstructorAvatar } from "@/components/ui/InstructorAvatar";
import { Button } from "@/components/ui/button";
import { SocialAuthButtons } from "@/components/customer/auth/SocialAuthButtons";
import { BranchLocationCard } from "@/components/customer/branch/BranchLocationCard";

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
    const branding = useAppStore(s => s.brandingSettings);

    const s = classSchedules.find(x => x.id === id);
    const instructorImageUrl = staff.find(st => st.id === s?.instructorId)?.imageUrl;

    // Logged-in visitors skip the gate → straight to the customer flow.
    useEffect(() => {
        if (authed) router.replace(`/customer/classes/${id}?b=book`);
    }, [authed, id, router]);

    const [email, setEmail] = useState("");
    function continueToBooking() {
        // Demo auth — sign the visitor in, then hand off to the same customer
        // checkout flow the mobile app uses.
        loginCustomer(DEMO_MEMBER_ID);
        router.push(`/customer/classes/${id}?b=book`);
    }

    const template = useMemo(() => classTemplates.find(t => t.id === s?.templateId), [classTemplates, s]);
    const cover = template ? resolveTemplateCoverImage(template, classCategories) : undefined;
    const branch = branches.find(b => b.id === s?.branchId);

    const accent = branding.primaryColor || "#164E52";

    if (!s) {
        return (
            <div className="min-h-screen bg-[var(--colors-bg-secondary)] flex items-center justify-center px-6">
                <p className="text-[16px] text-[var(--colors-text-quaternary)]">This class is no longer available.</p>
            </div>
        );
    }
    if (authed) return null; // redirecting to the customer flow

    const dur = durationMin(s.startTime, (s as ClassSchedule & { endTime?: string }).endTime);
    const dateLabel = `${parseISO(s.dateISO).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })} · ${to12h(s.startTime)}`;
    const equipment = (s.equipment || "").split(",").map(e => e.trim()).filter(Boolean);
    const emailValid = EMAIL_RE.test(email.trim());

    return (
        <div className="min-h-screen bg-[var(--colors-bg-secondary)] px-6 md:px-16 py-10">
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
                                <p className="text-[20px] font-semibold leading-[30px]" style={{ color: accent }}>1 credit or AED {DROP_IN_PRICE_AED}</p>
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

                    {/* ── Right — log in / sign up ── */}
                    <div className="w-full lg:w-[420px] shrink-0 border border-[var(--colors-border-secondary)] rounded-[24px] p-6 flex flex-col gap-6">
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
