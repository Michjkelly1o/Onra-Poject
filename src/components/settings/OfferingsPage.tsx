"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Offerings settings (client 2026-08-04)
// ─────────────────────────────────────────────────────────────────────────────
//
// Studio-level on/off switches for the OPTIONAL offering types. Not every
// studio runs all of them — a small yoga studio may only sell class
// memberships, a physio clinic may only sell recovery sessions. Turning an
// offering OFF is meant to hide EVERYTHING related to it across the app:
// sidebar menu items, POS tabs, product/catalog surfaces, customer plans,
// schedule filters, and reports.
//
// Classes are the studio's core and are ALWAYS available — only the three
// optional offerings below can be switched off.
//
// ⚠️ UI ONLY (this phase). The toggles hold local state so the interaction
// feels real in the demo, but they DON'T persist and DON'T hide anything
// yet — the store wiring + cascade rules land in a later phase. See
// docs/offerings-configuration.md for the full impact map per toggle.

import { useState } from "react";
import { Lightbulb02, CreditCard02, User01, Heart } from "@untitledui/icons";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

// ─── Offering definitions ────────────────────────────────────────────────────

type OfferingKey = "membership" | "private" | "recovery";

interface OfferingDef {
    key:   OfferingKey;
    icon:  ComponentType<{ className?: string }>;
    title: string;
    description: string;
    /** One-line summary of what disappears when this is off — surfaced as a
     *  helper caption so admins understand the blast radius before flipping. */
    hidesCaption: string;
}

const OFFERINGS: OfferingDef[] = [
    {
        key:   "membership",
        icon:  CreditCard02,
        title: "Memberships",
        description: "Recurring plans customers subscribe to for ongoing access to your studio.",
        hidesCaption: "the Memberships product tab, the POS Memberships tab, customer membership plans, and membership reports.",
    },
    {
        key:   "private",
        icon:  User01,
        title: "Private sessions",
        description: "One-to-one bookings with an instructor, such as personal training or a private class.",
        hidesCaption: "Private services, the POS Private sessions tab, private appointment scheduling, and private-session reports.",
    },
    {
        key:   "recovery",
        icon:  Heart,
        title: "Recovery",
        description: "Wellness and recovery sessions such as sauna, stretch, ice bath or physiotherapy.",
        hidesCaption: "Recovery services, the POS Recovery tab, recovery appointment scheduling, and recovery reports.",
    },
];

// ─── Toggle primitive (matches the Booking-rules DS switch) ──────────────────

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function OfferingsPage() {
    // Local-only state — all offerings default ON. No store, no persistence
    // (UI-only phase). Every studio starts with everything enabled and opts
    // out of what they don't run.
    const [enabled, setEnabled] = useState<Record<OfferingKey, boolean>>({
        membership: true,
        private:    true,
        recovery:   true,
    });

    return (
        <div className="flex w-full flex-col gap-4">
            {/* ── Intro / context banner ───────────────────────────── */}
            <div className="flex items-start gap-3 rounded-[12px] bg-[#f1f2ed] p-4">
                <Lightbulb02 className="mt-0.5 h-5 w-5 shrink-0 text-[#475467]" />
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-medium text-[#344054]">
                        Choose what your studio offers
                    </p>
                    <p className="text-[13px] leading-[19px] text-[#475467]">
                        Classes are always available. Turn the optional offerings below on or
                        off — switching one off hides everything related to it across menus,
                        modules, customer plans and reports. You can turn it back on anytime.
                    </p>
                </div>
            </div>

            {/* ── Offerings card ───────────────────────────────────── */}
            <div className="flex flex-col rounded-[16px] border-1 border-[#e4e7ec] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex flex-col gap-1 p-6 pb-4">
                    <p className="text-[16px] font-semibold text-[#101828]">Offerings</p>
                    <p className="text-[14px] leading-[20px] text-[#667085]">
                        Enable only the offerings this studio actually sells.
                    </p>
                </div>

                {OFFERINGS.map((o, i) => {
                    const Icon = o.icon;
                    const on = enabled[o.key];
                    return (
                        <div
                            key={o.key}
                            className={cn(
                                "flex items-start gap-4 px-6 py-5",
                                i > 0 && "border-t border-[#eaecf0]",
                            )}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-1 border-[#e4e7ec] bg-[#f9fafb]">
                                <Icon className="h-5 w-5 text-[#475467]" />
                            </div>
                            <div className="flex flex-1 flex-col gap-1 min-w-0">
                                <p className="text-[15px] font-semibold text-[#101828]">{o.title}</p>
                                <p className="text-[13px] leading-[19px] text-[#667085]">{o.description}</p>
                                <p className="mt-0.5 text-[12px] leading-[17px] text-[#98a2b3]">
                                    When off, hides {o.hidesCaption}
                                </p>
                            </div>
                            <div className="pt-0.5">
                                <Toggle
                                    on={on}
                                    onChange={next => setEnabled(prev => ({ ...prev, [o.key]: next }))}
                                    ariaLabel={`Enable ${o.title}`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
