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

import { CheckCircle, XCircle } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";

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
    if (!customer) return null;

    const fullName = `${customer.firstName} ${customer.lastName}`.trim();

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
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
