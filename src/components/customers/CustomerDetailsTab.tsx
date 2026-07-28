"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer detail · Details tab
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 2481:19397 (base layout) + 7748:61474 (v28 Marketing preferences).
//
// A read-only profile display, split into four sections separated by dividers:
//   • Personal information — name, DOB, gender, full address
//   • Sign in credentials  — email, phone, linked Google account
//   • Marketing preferences — 8-field 2-col grid: 4 delivery channels
//     (Email · WhatsApp · SMS · Push notifications) + 4 content topics
//     (Studio announcements · New class launch · Special offers · Promo
//     code offers). Each field renders "Subscribed" (green check) or
//     "Unsubscribed" (red x). See customers.ts + _types.ts for the
//     dispatch-time semantics — this tab is display-only.
//   • Emergency contact    — name, phone, relation
//
// Every value is read live from the `customers` store so an Edit-customer
// change is reflected here on the next render. Two-way wiring to the
// customer-facing prefs UI and the admin dispatch layer lands in a later
// phase; the fields exist now so the display is real.

import { useMemo, useState } from "react";
import { CheckCircle, XCircle, Eye, EyeOff } from "@untitledui/icons";
import { useAppStore, type FollowUpStatus } from "@/lib/store";
import { getCustomerPassword, useHasCustomerPassword } from "@/lib/customer/customer-password";
// v83 Phase 3 — Follow-up section reuses SelectInput (same as every other
// dropdown on the profile). computeLifecycleTag gates whether the section
// renders (pre-conversion only per plan §Phase 3).
import { SelectInput } from "@/components/ui/select-input";
import { computeLifecycleTag } from "@/lib/customer/lifecycle";
import { lookupStageLabel } from "@/lib/customer/follow-up-tasks";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FULL_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** "20 November 2000" — birthday format. */
function fmtBirthday(iso?: string): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.getUTCDate()} ${FULL_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Falls back to an em-dash for empty values. */
function orDash(v?: string): string {
    return v && v.trim() ? v : "—";
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
    return <p className="text-[16px] font-medium text-[#667085]">{children}</p>;
}

function Divider() {
    return <div className="h-px w-full bg-[#e4e7ec] shrink-0" />;
}

/** Label + value pair. `value` accepts plain text or a node (status rows). */
function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-0.5 min-w-0">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] leading-[24px] flex items-center gap-1.5">
                {value}
            </div>
        </div>
    );
}

/** Boolean value rendered as a labelled check / cross — for opt-ins + links. */
function StatusValue({ ok, onLabel, offLabel }: { ok: boolean; onLabel: string; offLabel: string }) {
    return (
        <>
            <span>{ok ? onLabel : offLabel}</span>
            {ok
                ? <CheckCircle className="w-4 h-4 text-[#039855]" />
                : <XCircle className="w-4 h-4 text-[#d92d20]" />}
        </>
    );
}

const GRID = "grid grid-cols-2 gap-x-4 gap-y-5";

// ─── Details tab ──────────────────────────────────────────────────────────────

export function CustomerDetailsTab({ customerId }: { customerId: string }) {
    const customers = useAppStore(s => s.customers);
    const customer = customers.find(c => c.id === customerId);
    // Customer sign-in password — reactive read from the same localStorage-
    // backed per-account map the customer app uses. `useHasCustomerPassword`
    // subscribes to changes so a customer-side edit re-renders this tab;
    // `getCustomerPassword` returns the effective value (per-account override
    // or the seeded demo default). View-only on admin per client Jul 2026 (no
    // "Change" affordance — that stays a self-service action on the
    // customer side).
    const hasPassword = useHasCustomerPassword(customerId);
    const password = hasPassword ? getCustomerPassword(customerId) : "";
    const [revealPassword, setRevealPassword] = useState(false);
    // v83 Phase 3 — Follow-up section deps. Reads the store slices the
    // compute + option lists need. Reactive so the dropdowns show fresh
    // labels after a Settings (Phase 6) rename.
    const classBookings = useAppStore(s => s.classBookings);
    const customerPlans = useAppStore(s => s.customerPlans);
    const customerTransactions = useAppStore(s => s.customerTransactions);
    const leadSources = useAppStore(s => s.leadSources);
    const followUpStages = useAppStore(s => s.followUpStages);
    const staff = useAppStore(s => s.staff);
    const updateCustomer = useAppStore(s => s.updateCustomer);
    const showToast = useAppStore(s => s.showToast);

    const lifecycle = useMemo(() => {
        if (!customer) return null;
        return computeLifecycleTag(customerId, {
            customers,
            classBookings,
            customerPlans,
            customerTransactions,
        });
    }, [customer, customerId, customers, classBookings, customerPlans, customerTransactions]);

    if (!customer) return null;

    const fullName = `${customer.firstName} ${customer.lastName}`.trim();

    // Follow-up scoping — pre-conversion only, per plan §Phase 3.
    const isPreConversion = lifecycle?.tag === "Lead" || lifecycle?.tag === "Trialist";

    // Staff options — every active/pending staff member with a display name.
    // Same list the Assignments column will use in Phase 5's widget so we
    // stay consistent about who a lead can be assigned to.
    const staffOptions = [
        { value: "", label: "Unassigned" },
        ...staff
            .filter(s => s.status !== "archive")
            .map(s => ({
                value: s.id,
                label: (s.fullName || `${s.firstName} ${s.lastName}`).trim() || s.email,
            })),
    ];

    const sourceLabel =
        leadSources.find(s => s.id === customer.sourceId)?.label ??
        customer.marketingSource ??
        "—";

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            {/* v83 Phase 3 — Follow-up section. Client 2026-07-27 revision:
                • "Assigned to" is shown for EVERY customer (Loyal Active,
                  Churned, etc. can all be assigned to a staff member for
                  CS follow-up), matching the plan §Phase 3 "all customers
                  get an assignment field" phrasing.
                • "Follow-up status" stays scoped to Lead / Trialist only —
                  that funnel doesn't apply after conversion.
                • "Source" shows for every customer for auditability. */}
            <div className="flex flex-col gap-3">
                <SectionHeader>Follow-up</SectionHeader>
                <div className={GRID}>
                    <div className="flex flex-col gap-1.5">
                        <p className="text-[14px] text-[#667085]">Assigned to</p>
                        <SelectInput
                            value={customer.assignedTo ?? ""}
                            onChange={(next) => {
                                updateCustomer(customerId, { assignedTo: next || undefined });
                                const label = next
                                    ? staffOptions.find(o => o.value === next)?.label ?? "staff"
                                    : "Unassigned";
                                showToast(
                                    "Assignment updated",
                                    `${fullName} → ${label}.`,
                                    "success",
                                    "check",
                                );
                            }}
                            options={staffOptions}
                        />
                    </div>
                    {isPreConversion && (
                        <div className="flex flex-col gap-1.5">
                            <p className="text-[14px] text-[#667085]">Follow-up status</p>
                            <SelectInput
                                // v83 audit-3 fix (2026-07-27) — resolve
                                // the "New" default via the current stage
                                // list so a Phase-6 rename ("New" → "New
                                // Lead") keeps the SelectInput's value
                                // matching an option; hardcoding "New"
                                // rendered blank after a rename.
                                value={customer.followUpStatus ?? lookupStageLabel(followUpStages, "stg_new", "New")}
                                onChange={(next) => {
                                    const val = (next || lookupStageLabel(followUpStages, "stg_new", "New")) as FollowUpStatus;
                                    updateCustomer(customerId, { followUpStatus: val });
                                    showToast(
                                        "Follow-up status updated",
                                        `${fullName} moved to "${val}".`,
                                        "success",
                                        "check",
                                    );
                                }}
                                options={followUpStages.map(s => ({
                                    value: s.label,
                                    label: s.label,
                                }))}
                            />
                        </div>
                    )}
                    <DetailField
                        label="Source"
                        value={<span className="text-[14px] font-normal text-[#101828]">{sourceLabel}</span>}
                    />
                </div>
            </div>
            <Divider />

            {/* Personal information */}
            <div className="flex flex-col gap-3">
                <SectionHeader>Personal information</SectionHeader>
                <div className="flex flex-col gap-5">
                    <div className={GRID}>
                        <DetailField label="Name" value={orDash(fullName)} />
                        <DetailField label="Date of birth" value={fmtBirthday(customer.dateOfBirth)} />
                        <DetailField label="Gender" value={orDash(customer.gender)} />
                    </div>
                    <div className={GRID}>
                        <DetailField label="Country" value={orDash(customer.country)} />
                        <DetailField label="State" value={orDash(customer.state)} />
                        <DetailField label="City" value={orDash(customer.city)} />
                        <DetailField label="Postal code" value={orDash(customer.postalCode)} />
                        <DetailField label="Street address" value={orDash(customer.streetAddress)} />
                    </div>
                </div>
            </div>

            <Divider />

            {/* Sign in credentials */}
            <div className="flex flex-col gap-3">
                <SectionHeader>Sign in credentials</SectionHeader>
                <div className={GRID}>
                    <DetailField label="Email" value={orDash(customer.email)} />
                    <DetailField label="Phone" value={orDash(customer.phone)} />
                    <DetailField label="Google account"
                        value={<StatusValue ok={!!customer.googleConnected} onLabel="Connected" offLabel="Not connected" />} />
                    {/* Password — view-only for admin. Masked with an Eye
                        reveal toggle; there is intentionally NO "Change"
                        affordance (client Jul 2026 — admin cannot rewrite a
                        customer's sign-in password; that stays a
                        self-service action on the customer side). Reads the
                        same per-account password map the customer app uses
                        so any customer-side change reflects here on the
                        next render. */}
                    <DetailField
                        label="Password"
                        value={
                            <div className="flex items-center gap-2">
                                <span className="font-mono">
                                    {password
                                        ? (revealPassword ? password : "•".repeat(Math.min(password.length, 10)))
                                        : "—"}
                                </span>
                                {password && (
                                    <button
                                        type="button"
                                        onClick={() => setRevealPassword(v => !v)}
                                        aria-label={revealPassword ? "Hide password" : "Show password"}
                                        className="text-[#667085] hover:text-[#344054] transition-colors shrink-0"
                                    >
                                        {revealPassword
                                            ? <EyeOff className="w-4 h-4" />
                                            : <Eye className="w-4 h-4" />}
                                    </button>
                                )}
                            </div>
                        }
                    />
                </div>
            </div>

            <Divider />

            {/* Marketing preferences — 4 channels + 4 topics, 2-col grid per
             *  Figma 7748:61474. Reading order is left→right, top→bottom:
             *  channels in the top two rows, topics in the bottom two. */}
            <div className="flex flex-col gap-3">
                <SectionHeader>Marketing preferences</SectionHeader>
                <div className={GRID}>
                    {/* Row 1 — delivery channels (email + whatsapp) */}
                    <DetailField label="Marketing emails"
                        value={<StatusValue ok={!!customer.marketingChannelEmail} onLabel="Subscribed" offLabel="Unsubscribed" />} />
                    <DetailField label="Marketing WhatsApp"
                        value={<StatusValue ok={!!customer.marketingChannelWhatsapp} onLabel="Subscribed" offLabel="Unsubscribed" />} />

                    {/* Row 2 — delivery channels (sms + push) */}
                    <DetailField label="Marketing SMS"
                        value={<StatusValue ok={!!customer.marketingChannelSms} onLabel="Subscribed" offLabel="Unsubscribed" />} />
                    <DetailField label="Push notifications"
                        value={<StatusValue ok={!!customer.marketingChannelPush} onLabel="Subscribed" offLabel="Unsubscribed" />} />

                    {/* Row 3 — content topics (studio announcements + new class launch) */}
                    <DetailField label="Studio announcements"
                        value={<StatusValue ok={!!customer.marketingTopicStudioAnnouncements} onLabel="Subscribed" offLabel="Unsubscribed" />} />
                    <DetailField label="New class launch"
                        value={<StatusValue ok={!!customer.marketingTopicNewClassLaunch} onLabel="Subscribed" offLabel="Unsubscribed" />} />

                    {/* Row 4 — content topics (special offers + promo code offers) */}
                    <DetailField label="Special offers"
                        value={<StatusValue ok={!!customer.marketingTopicSpecialOffers} onLabel="Subscribed" offLabel="Unsubscribed" />} />
                    <DetailField label="Promotion offers"
                        value={<StatusValue ok={!!customer.marketingTopicPromoCodeOffers} onLabel="Subscribed" offLabel="Unsubscribed" />} />
                </div>
            </div>

            <Divider />

            {/* Emergency contact */}
            <div className="flex flex-col gap-3">
                <SectionHeader>Emergency contact</SectionHeader>
                <div className={GRID}>
                    <DetailField label="Name" value={orDash(customer.emergencyContactName)} />
                    <DetailField label="Phone" value={orDash(customer.emergencyContactPhone)} />
                    <DetailField label="Relation" value={orDash(customer.emergencyContactRelation)} />
                </div>
            </div>
        </div>
    );
}

