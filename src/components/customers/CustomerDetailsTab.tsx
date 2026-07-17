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

import { useState } from "react";
import { CheckCircle, XCircle, Eye, EyeOff, XClose } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import {
    setCustomerPassword,
    useCustomerPassword,
} from "@/lib/customer/customer-password";
import { checkPassword, PASSWORD_RULES, passwordValid } from "@/lib/customer/password-rules";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    // backed store the customer app uses (`useCustomerPassword`). Editing here
    // fans out via `setCustomerPassword`, so any customer session in another
    // tab sees the change the same render cycle (client Jul 2026 — admin
    // sync-to-customer). Prototype note: `customer-password.ts` is a single
    // global demo password today, not per-customer; changing it on one
    // profile updates the shared demo password.
    const password = useCustomerPassword();
    const showToast = useAppStore(s => s.showToast);
    const [revealPassword, setRevealPassword] = useState(false);
    const [changeOpen, setChangeOpen]     = useState(false);
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
                    {/* Password — masked with reveal toggle; "Change" opens
                        a modal that fans out through `setCustomerPassword`
                        so the customer's login stays in sync. */}
                    <DetailField
                        label="Password"
                        value={
                            <div className="flex items-center gap-3">
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
                                <button
                                    type="button"
                                    onClick={() => setChangeOpen(true)}
                                    className="text-[14px] font-medium text-[#658774] hover:text-[#3b5446] transition-colors shrink-0"
                                >
                                    Change
                                </button>
                            </div>
                        }
                    />
                </div>
            </div>

            {/* Change-password modal — mirrors the customer-side
                /customer/profile/change-password flow (same validation
                rules, same store write). Admin has full override, so we
                skip the "current password" gate a member would face. */}
            {changeOpen && (
                <ChangePasswordModal
                    customerName={fullName}
                    onClose={() => setChangeOpen(false)}
                    onSave={(next) => {
                        setCustomerPassword(next);
                        setChangeOpen(false);
                        showToast(
                            "Password updated",
                            `${fullName}'s sign-in password has been changed.`,
                            "success", "check",
                        );
                    }}
                />
            )}

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

// ─── Change-password modal ────────────────────────────────────────────────────
//
// Small centered modal — new + confirm fields, live PASSWORD_RULES checklist,
// "Update password" primary button. Validation is the same `passwordValid`
// helper the customer-side change-password page uses, so an entry that would
// pass the customer's own flow will pass here too. Admin skips the "enter
// current password" gate — this is an override.

function ChangePasswordModal({ customerName, onClose, onSave }: {
    customerName: string;
    onClose: () => void;
    onSave: (next: string) => void;
}) {
    const [next, setNext]       = useState("");
    const [confirm, setConfirm] = useState("");
    const [showNew, setShowNew]         = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const checks   = checkPassword(next);
    const matches  = confirm.length > 0 && confirm === next;
    const canSave  = passwordValid(next) && matches;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-[520px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="absolute right-[16px] top-[16px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-10"
                >
                    <XClose className="w-6 h-6 text-[#667085]" />
                </button>

                <div className="flex flex-col gap-1 pt-6 px-6">
                    <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Change password</h3>
                    <p className="text-[14px] text-[#475467] leading-[20px]">
                        Set a new sign-in password for {customerName || "this member"}.
                    </p>
                </div>

                <div className="flex flex-col gap-4 px-6 pt-6">
                    <PwField
                        label="New password"
                        value={next}
                        onChange={setNext}
                        show={showNew}
                        onToggle={() => setShowNew(v => !v)}
                        autoFocus
                    />

                    <div className="flex flex-col gap-1.5">
                        {PASSWORD_RULES.map(rule => {
                            const ok = checks[rule.key];
                            return (
                                <div key={rule.key} className="flex items-center gap-2">
                                    {ok
                                        ? <CheckCircle className="w-4 h-4 text-[#039855]" />
                                        : <XCircle className="w-4 h-4 text-[#98a2b3]" />}
                                    <span className={cn("text-[13px]", ok ? "text-[#344054]" : "text-[#667085]")}>{rule.label}</span>
                                </div>
                            );
                        })}
                    </div>

                    <PwField
                        label="Confirm password"
                        value={confirm}
                        onChange={setConfirm}
                        show={showConfirm}
                        onToggle={() => setShowConfirm(v => !v)}
                    />
                    {confirm.length > 0 && !matches && (
                        <p className="text-[13px] text-[#b42318]">Passwords don&apos;t match.</p>
                    )}
                </div>

                <div className="flex gap-3 px-6 pt-6 pb-6">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>Cancel</Button>
                    <Button
                        variant="primary" size="lg" className="flex-1"
                        disabled={!canSave}
                        onClick={() => canSave && onSave(next)}
                    >
                        Update password
                    </Button>
                </div>
            </div>
        </div>
    );
}

function PwField({ label, value, onChange, show, onToggle, autoFocus }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    onToggle: () => void;
    autoFocus?: boolean;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            <div className="relative">
                <input
                    type={show ? "text" : "password"}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    autoFocus={autoFocus}
                    className="h-11 w-full pl-[14px] pr-[44px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                />
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label={show ? "Hide password" : "Show password"}
                    className="absolute right-[12px] top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#344054] transition-colors"
                >
                    {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
}
