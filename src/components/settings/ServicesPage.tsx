"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Services settings (client 2026-08-04)
// ─────────────────────────────────────────────────────────────────────────────
//
// Studio-level on/off switches for the OPTIONAL service types. Not every
// studio runs all of them — a small yoga studio may only sell class
// memberships, a physio clinic may only sell recovery sessions. Turning a
// service OFF is meant to hide EVERYTHING related to it across the app:
// sidebar menu items, POS tabs, product/catalog surfaces, customer plans,
// schedule filters, and reports.
//
// Classes are the studio's core and are ALWAYS available — only the three
// optional services below can be switched off.
//
// ⚠️ UI ONLY (this phase). The toggles hold local state so the interaction
// feels real in the demo, but they DON'T persist and DON'T hide anything
// yet — the store wiring + cascade rules land in a later phase. Every flip
// is gated behind a confirmation modal. See docs/services-configuration.md
// for the full impact map per toggle.

import { useState } from "react";
import { Lightbulb02, CreditCard02, User01, Heart } from "@untitledui/icons";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";
import { ConfirmModal } from "@/components/modals/ConfirmModal";

// ─── Service definitions ─────────────────────────────────────────────────────

type ServiceKey = "membership" | "private" | "recovery";

interface ServiceDef {
    key:   ServiceKey;
    icon:  ComponentType<{ className?: string }>;
    title: string;
    description: string;
}

const SERVICES: ServiceDef[] = [
    {
        key:   "membership",
        icon:  CreditCard02,
        title: "Memberships",
        description: "Recurring plans customers subscribe to for ongoing access to your studio.",
    },
    {
        key:   "private",
        icon:  User01,
        title: "Private sessions",
        description: "One-to-one bookings with an instructor, such as personal training or a private class.",
    },
    {
        key:   "recovery",
        icon:  Heart,
        title: "Recovery",
        description: "Wellness and recovery sessions such as sauna, stretch, ice bath or physiotherapy.",
    },
];

// ─── Toggle primitive (matches the Booking-rules DS switch) ──────────────────

function Toggle({ on, onClick, ariaLabel }: {
    on: boolean; onClick: () => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={onClick}
            className={cn(
                "w-11 h-6 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[var(--colors-secondary-600)]" : "bg-[var(--colors-bg-tertiary)]",
            )}>
            <div className={cn(
                "w-5 h-5 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-5" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
    const showToast = useAppStore(s => s.showToast);

    // Local-only state — all services default ON. No store, no persistence
    // (UI-only phase). Every studio starts with everything enabled and opts
    // out of what they don't run.
    const [enabled, setEnabled] = useState<Record<ServiceKey, boolean>>({
        membership: true,
        private:    true,
        recovery:   true,
    });

    // Pending confirmation — which service is being flipped and to what value.
    // Set when a toggle is clicked; cleared on confirm/cancel. The flip only
    // applies after the admin confirms.
    const [pending, setPending] = useState<{ key: ServiceKey; next: boolean } | null>(null);

    const pendingDef = pending ? SERVICES.find(s => s.key === pending.key) ?? null : null;

    function confirmFlip() {
        if (!pending || !pendingDef) return;
        setEnabled(prev => ({ ...prev, [pending.key]: pending.next }));
        showToast(
            pending.next ? `${pendingDef.title} turned on` : `${pendingDef.title} turned off`,
            pending.next
                ? `${pendingDef.title} is now available across menus, catalog and reports.`
                : `Everything related to ${pendingDef.title.toLowerCase()} is now hidden.`,
            pending.next ? "success" : "error",
            pending.next ? "check"   : "slash",
        );
        setPending(null);
    }

    return (
        <div className="flex w-full flex-col gap-4">
            {/* ── Intro / context banner ───────────────────────────── */}
            <div className="flex items-start gap-3 rounded-[12px] bg-[var(--colors-tertiary-50)] p-4">
                <Lightbulb02 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--colors-text-tertiary)]" />
                <div className="flex flex-col gap-1">
                    <p className="text-[14px] font-medium text-[var(--colors-text-secondary)]">
                        Choose what your studio offers
                    </p>
                    <p className="text-[13px] leading-[19px] text-[var(--colors-text-tertiary)]">
                        Classes are always available. Turn the optional services below on or
                        off — switching one off hides everything related to it across menus,
                        modules, customer plans and reports. You can turn it back on anytime.
                    </p>
                </div>
            </div>

            {/* ── Services card ────────────────────────────────────── */}
            <div className="flex flex-col rounded-[16px] border-1 border-[var(--colors-border-secondary)] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="flex flex-col gap-1 p-6 pb-4">
                    <p className="text-[16px] font-semibold text-[var(--colors-text-primary)]">Services</p>
                    <p className="text-[14px] leading-[20px] text-[var(--colors-text-quaternary)]">
                        Enable only what this studio actually sells.
                    </p>
                </div>

                {SERVICES.map((s, i) => {
                    const Icon = s.icon;
                    const on = enabled[s.key];
                    return (
                        <div
                            key={s.key}
                            className={cn(
                                "flex items-center gap-4 px-6 py-5",
                                i > 0 && "border-t border-[var(--colors-border-tertiary)]",
                            )}
                        >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border-1 border-[var(--colors-border-secondary)] bg-[var(--colors-bg-secondary)]">
                                <Icon className="h-5 w-5 text-[var(--colors-text-tertiary)]" />
                            </div>
                            <div className="flex flex-1 flex-col gap-1 min-w-0">
                                <p className="text-[15px] font-semibold text-[var(--colors-text-primary)]">{s.title}</p>
                                <p className="text-[13px] leading-[19px] text-[var(--colors-text-quaternary)]">{s.description}</p>
                            </div>
                            <Toggle
                                on={on}
                                onClick={() => setPending({ key: s.key, next: !on })}
                                ariaLabel={`${on ? "Turn off" : "Turn on"} ${s.title}`}
                            />
                        </div>
                    );
                })}
            </div>

            {/* ── Confirmation modal (every flip is gated) ─────────── */}
            {pendingDef && pending && (
                <ConfirmModal
                    open
                    onClose={() => setPending(null)}
                    icon={pendingDef.icon}
                    tone={pending.next ? "success" : "danger"}
                    title={pending.next ? `Turn on ${pendingDef.title}?` : `Turn off ${pendingDef.title}?`}
                    description={
                        pending.next
                            ? `${pendingDef.title} will be available again across menus, catalog, customer plans and reports.`
                            : `Everything related to ${pendingDef.title.toLowerCase()} will be hidden across menus, catalog, customer plans and reports. Existing records are kept — you can turn it back on anytime.`
                    }
                    confirmLabel={pending.next ? "Turn on" : "Turn off"}
                    onConfirm={confirmFlip}
                />
            )}
        </div>
    );
}
