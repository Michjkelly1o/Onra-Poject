"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Add complimentary credit (full-page screen + confirm modal)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 6160:272373 (configuration page) + 6170:233860 (summary modal).
//
// Flow: admin grants free class credits to a customer with a reason + expiry,
// optionally notifying the customer. "Confirm" opens a summary modal; confirming
// there adds the credits to the customer's balance through the store.
//
// Role-based grant limits (Owner = unlimited, Branch Admin = capped, etc.) are
// surfaced in the summary modal but not yet enforced — the brief defers limit
// configuration to the future Staff & Permissions module.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XClose, Check, HeartHand } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { SelectInput } from "@/components/ui/select-input";
import { NumericInput } from "@/components/ui/NumericInput";
import { TableAvatar } from "@/components/ui/avatar";
import { useAppStore } from "@/lib/store";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [{ n: 1, label: "Complimentary configuration" }];

const REASON_OPTIONS = [
    { value: "service_recovery", label: "Service recovery" },
    { value: "marketing", label: "Marketing" },
    { value: "referral", label: "Referral" },
    { value: "staff_perk", label: "Staff perk" },
    { value: "other", label: "Other" },
];

/** Notional AED value of one class credit — used for the summary "Value" row
 *  and (later) role-based grant-value limits. */
const CREDIT_VALUE_AED = 100;

type ExpiryChoice = "" | "30" | "60" | "90" | "custom";
const PRESET_DAYS: Record<"30" | "60" | "90", number> = { "30": 30, "60": 60, "90": 90 };

// ─── Date helpers (UTC-anchored, timezone-independent) ───────────────────────

function addDaysISO(iso: string, days: number): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string): string {
    if (!iso) return "—";
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepItem({ step, current, total }: { step: { n: number; label: string }; current: number; total: number }) {
    const active = step.n === current;
    const complete = step.n < current;
    const isLast = step.n === total;
    return (
        <div className={cn("flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full", active && "bg-[#f5fffa]")}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium z-10",
                    active ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                    : complete ? "bg-[#658774] text-white"
                    : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]")}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />}
            </div>
            <span className={cn("text-[14px]", active ? "font-semibold text-[#3b5446]" : "font-medium text-[#667085]")}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
    return (
        <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on && "translate-x-4",
            )} />
        </button>
    );
}

// ─── Expiry radio card ────────────────────────────────────────────────────────

function ExpiryCard({ title, subtitle, selected, onClick }: {
    title: string; subtitle: string; selected: boolean; onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-3 p-4 rounded-[12px] text-left transition-all",
                selected
                    ? "border-2 border-[#7ba08c] bg-[#f5fffa]"
                    : "border-1 border-[#e4e7ec] bg-white hover:border-[#aad4bd]",
            )}>
            <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-[14px] font-medium text-[#344054]">{title}</span>
                <span className="text-[14px] text-[#475467]">{subtitle}</span>
            </div>
            <span className={cn(
                "w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors",
                selected ? "border-[#658774]" : "border-[#d0d5dd]",
            )}>
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#658774]" />}
            </span>
        </button>
    );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

const labelCls = "text-[14px] font-medium text-[#344054]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5">
            <label className={labelCls}>{label}</label>
            {children}
        </div>
    );
}

// ─── Summary modal info row ───────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-[14px] text-[#667085] whitespace-nowrap">{label}</p>
            <div className="text-[16px] font-medium text-[#101828] text-right">{children}</div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

/**
 * Add Complimentary Credit screen.
 * @param customerId — the customer receiving the grant.
 */
export function AddComplimentaryCreditPage({ customerId }: { customerId: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo");
    const { customers, updateCustomer, addComplimentaryPlan, showToast, currentUser } = useAppStore();

    const customer = customers.find(c => c.id === customerId);

    // ─── Form state ─────────────────────────────────────────────────────────
    const [credits, setCredits] = useState(1);
    const [reasonCategory, setReasonCategory] = useState("");
    const [reasonNote, setReasonNote] = useState("");
    const [expiryChoice, setExpiryChoice] = useState<ExpiryChoice>("");
    const [customDate, setCustomDate] = useState("");
    const [notify, setNotify] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);

    const today = todayISO();

    // Resolved expiry ISO date for the chosen option.
    const resolvedExpiry =
        expiryChoice === "custom" ? customDate
        : expiryChoice === "" ? ""
        : addDaysISO(today, PRESET_DAYS[expiryChoice]);

    const reasonLabel = REASON_OPTIONS.find(o => o.value === reasonCategory)?.label ?? "";

    const canConfirm =
        !!customer &&
        credits >= 1 &&
        reasonCategory !== "" &&
        (reasonCategory !== "other" || reasonNote.trim() !== "") &&
        expiryChoice !== "" &&
        (expiryChoice !== "custom" || customDate !== "");

    // Customer id no longer resolves (deleted / stale link).
    if (!customer) {
        return (
            <div className="h-screen flex flex-col items-center justify-center gap-4 bg-white">
                <p className="text-[16px] text-[#667085]">This customer could not be found.</p>
                <Button variant="secondary-gray" size="md" onClick={() => router.push("/admin/customers")}>
                    Back to customers
                </Button>
            </div>
        );
    }

    const customerName = `${customer.firstName} ${customer.lastName}`.trim();

    function handleConfirmGrant() {
        if (!customer || !canConfirm) return;
        const creditWord = credits === 1 ? "credit" : "credits";
        updateCustomer(customer.id, {
            creditsRemaining: (customer.creditsRemaining ?? 0) + credits,
        });
        // Record the grant as a complimentary plan row so it shows up in the
        // customer's Plan tab — where it can later be viewed or removed.
        addComplimentaryPlan({
            customerId: customer.id,
            name: "Free credit",
            creditsLabel: `${credits} free ${creditWord}`,
            purchasedAtISO: today,
            expiryISO: `${resolvedExpiry}T22:00:00Z`,
            freeCredits: credits,
            grantReason: reasonLabel,
            grantIssuedBy: `${currentUser.first_name} ${currentUser.last_name}`,
            grantIssuedRole: "Owner",
        });
        showToast(
            "Complimentary credit added",
            `${credits} free ${creditWord} granted to ${customerName}${notify ? " — customer notified." : "."}`,
            "success", "check",
        );
        router.push(returnTo ?? "/admin/customers");
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-white">
            {/* Header */}
            <div className="shrink-0 h-[72px] flex items-center px-6 gap-3">
                <button type="button" onClick={() => router.back()}
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <p className="text-[20px] font-semibold text-[#101828]">Add complimentary credit</p>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden gap-8 px-6 py-6">
                {/* Steps sidebar */}
                <div className="w-[300px] shrink-0 flex flex-col gap-0 pt-2">
                    {STEPS.map(s => <StepItem key={s.n} step={s} current={1} total={STEPS.length} />)}
                </div>

                {/* Form card */}
                <div className="flex-1 max-w-[628px] bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-8">
                        {/* ─── Complimentary configuration ─── */}
                        <div className="flex flex-col gap-4">
                            <p className="text-[18px] font-semibold text-[#101828]">Complimentary configuration</p>

                            <Field label="Number of free credit">
                                <NumericInput value={credits} onChange={setCredits} min={1} max={50} suffix="credits" />
                            </Field>

                            <Field label="Reason category">
                                <SelectInput value={reasonCategory} onChange={setReasonCategory}
                                    placeholder="Select reason"
                                    options={REASON_OPTIONS}
                                    width="w-full" />
                            </Field>

                            {/* Free-text note — only when "Other" is chosen. */}
                            {reasonCategory === "other" && (
                                <Field label="Reason note">
                                    <textarea value={reasonNote} onChange={e => setReasonNote(e.target.value)}
                                        rows={3} placeholder="Describe the reason for this complimentary credit..."
                                        className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-none" />
                                </Field>
                            )}

                            <Field label="Grant expires">
                                <div className="grid grid-cols-2 gap-3">
                                    <ExpiryCard title="30 days from today"
                                        subtitle={`Expiry ${fmtDate(addDaysISO(today, 30))}`}
                                        selected={expiryChoice === "30"} onClick={() => setExpiryChoice("30")} />
                                    <ExpiryCard title="60 days from today"
                                        subtitle={`Expiry ${fmtDate(addDaysISO(today, 60))}`}
                                        selected={expiryChoice === "60"} onClick={() => setExpiryChoice("60")} />
                                    <ExpiryCard title="90 days from today"
                                        subtitle={`Expiry ${fmtDate(addDaysISO(today, 90))}`}
                                        selected={expiryChoice === "90"} onClick={() => setExpiryChoice("90")} />
                                    <ExpiryCard title="Custom date"
                                        subtitle="Set a custom expiration date."
                                        selected={expiryChoice === "custom"} onClick={() => setExpiryChoice("custom")} />
                                </div>
                            </Field>

                            {/* Custom-date picker — only when "Custom date" is chosen. */}
                            {expiryChoice === "custom" && (
                                <Field label="Custom expiry date">
                                    <DatePicker value={customDate} onChange={setCustomDate}
                                        placeholder="DD/MM/YYYY" minDate={addDaysISO(today, 1)} />
                                </Field>
                            )}
                        </div>

                        {/* ─── Notification ─── */}
                        <div className="flex flex-col gap-4">
                            <p className="text-[18px] font-semibold text-[#101828]">Notification</p>
                            <div className="flex items-center gap-4 border-1 border-[#e4e7ec] rounded-[12px] p-4">
                                <div className="flex-1 min-w-0 flex flex-col">
                                    <span className="text-[14px] font-medium text-[#101828]">Notification to customer</span>
                                    <span className="text-[14px] text-[#667085]">
                                        Send notification &ldquo;You&apos;ve received {credits || 0} {credits === 1 ? "credit" : "credits"} on your account&rdquo; to customer.
                                    </span>
                                </div>
                                <Toggle on={notify} onChange={setNotify} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                        <Button variant="primary" size="md" disabled={!canConfirm} onClick={() => setSummaryOpen(true)}>
                            Confirm
                        </Button>
                    </div>
                </div>
            </div>

            {/* ─── Complimentary summary modal ─── */}
            {summaryOpen && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center">
                    <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => setSummaryOpen(false)} />
                    <div className="relative bg-white rounded-[16px] w-[512px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                        {/* Header */}
                        <div className="relative flex flex-col gap-1 px-6 pt-6 pb-5">
                            <button type="button" onClick={() => setSummaryOpen(false)}
                                className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <XClose className="w-6 h-6 text-[#667085]" />
                            </button>
                            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Complimentary summary</h3>
                            <p className="text-[14px] text-[#475467] leading-[20px]">Review your summary before adding the complimentary credit.</p>
                        </div>
                        <div className="h-px bg-[#e4e7ec]" />

                        {/* Content */}
                        <div className="flex flex-col gap-4 px-6 py-5">
                            {/* Role + grant limit */}
                            <div className="border-1 border-[#e4e7ec] rounded-[16px] p-6 flex flex-col gap-4">
                                <span className="self-start inline-flex items-center px-2 py-[2px] rounded-full text-[14px] font-medium bg-[#eff8ff] border-1 border-[#b2ddff] text-[#175cd3]">
                                    Owner
                                </span>
                                <div className="flex gap-4">
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <p className="text-[16px] font-semibold text-[#101828]">Grant limit</p>
                                        <p className="text-[16px] text-[#475467]">Unlimited</p>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                                        <p className="text-[16px] font-semibold text-[#101828]">Remaining value</p>
                                        <p className="text-[16px] text-[#475467]">Unlimited</p>
                                    </div>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                <p className="text-[18px] font-semibold text-[#101828]">Details</p>
                                <div className="flex flex-col gap-2">
                                    <InfoRow label="Granting to">
                                        <div className="flex items-center gap-2">
                                            <TableAvatar initials={customer.initials} imageUrl={customer.imageUrl} size={24} />
                                            <span>{customerName}</span>
                                        </div>
                                    </InfoRow>
                                    <InfoRow label="Grant">
                                        {credits} free {credits === 1 ? "credit" : "credits"}
                                    </InfoRow>
                                    <InfoRow label="Value">
                                        AED {(credits * CREDIT_VALUE_AED).toLocaleString("en-US")}
                                    </InfoRow>
                                    <InfoRow label="Expires">{fmtDate(resolvedExpiry)}</InfoRow>
                                    <InfoRow label="Reason">{reasonLabel}</InfoRow>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="border-t border-[#e4e7ec] px-6 pt-6 pb-6 flex gap-3">
                            <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setSummaryOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" size="lg" className="flex-1"
                                leftIcon={<HeartHand className="w-5 h-5" />}
                                onClick={handleConfirmGrant}>
                                Add complimentary
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Toast />
        </div>
    );
}
