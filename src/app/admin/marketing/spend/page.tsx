"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Marketing Spend module (/admin/marketing/spend)
// ─────────────────────────────────────────────────────────────────────────────
//
// The admin data-entry home for marketing / ad spend — the number the
// Acquisition Efficiency report divides by to compute CPL / CAC / ROAS
// (client comment: "this spend needs to go somewhere to be able to generate
// this report"). One row per (month × channel × branch); the channel set
// mirrors the acquisition channels the report joins leads on, so spend and
// leads line up and the ratios resolve.
//
// State source of truth: useAppStore(s => s.marketingSpend). Add / edit go
// through a right side-panel (matches Campaigns / Tax); delete is a centered
// ConfirmModal. Every action fires a toast.

import { useMemo, useState } from "react";
import {
    Plus, Edit02, Trash02, Trash01, CurrencyDollarCircle,
    Calendar, MarkerPin01, Announcement01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectInput } from "@/components/ui/select-input";
import { SlidePanel } from "@/components/ui/SlidePanel";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAppStore } from "@/lib/store";
import type { MarketingSpend } from "@/data/mock/_types";

// Channels the Acquisition Efficiency report joins spend↔leads on. Keeping
// this list in lock-step with the lead sources is what makes CPL / CAC / ROAS
// resolve per channel.
const CHANNELS: MarketingSpend["channel"][] = [
    "Instagram", "Google", "Website", "Walk-in", "Referral", "WhatsApp",
];

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08" → "Aug 2026". */
function monthLabel(ym: string): string {
    const [y, m] = ym.split("-");
    const mi = Number(m) - 1;
    return `${MONTH_ABBR[mi] ?? m} ${y}`;
}

/** Last 18 calendar months, newest first — the Month picker options. */
function recentMonthOptions(): { value: string; label: string }[] {
    const out: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        out.push({ value: ym, label: monthLabel(ym) });
    }
    return out;
}

const AED = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

interface FormState {
    month: string;
    channel: MarketingSpend["channel"] | "";
    branchId: string;
    amount: string;
}

const EMPTY_FORM: FormState = { month: "", channel: "", branchId: "", amount: "" };

export default function MarketingSpendPage() {
    const marketingSpend      = useAppStore(s => s.marketingSpend);
    const branches            = useAppStore(s => s.branches);
    const addMarketingSpend   = useAppStore(s => s.addMarketingSpend);
    const updateMarketingSpend= useAppStore(s => s.updateMarketingSpend);
    const deleteMarketingSpend= useAppStore(s => s.deleteMarketingSpend);
    const showToast           = useAppStore(s => s.showToast);

    const [panelOpen, setPanelOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm]           = useState<FormState>(EMPTY_FORM);
    const [confirmDelete, setConfirmDelete] = useState<MarketingSpend | null>(null);

    const activeBranches = useMemo(
        () => branches.filter(b => b.status !== "archived"),
        [branches],
    );
    const branchName = (id: string) => branches.find(b => b.id === id)?.name ?? "—";
    const monthOptions = useMemo(recentMonthOptions, []);

    // Newest month first, then channel A→Z, then branch — a stable, scannable order.
    const rows = useMemo(
        () => [...marketingSpend].sort(
            (a, b) =>
                b.month.localeCompare(a.month) ||
                a.channel.localeCompare(b.channel) ||
                branchName(a.branch_id).localeCompare(branchName(b.branch_id)),
        ),
        [marketingSpend, branches],
    );

    const total = useMemo(
        () => marketingSpend.reduce((s, r) => s + (r.spend_aed || 0), 0),
        [marketingSpend],
    );

    function openAdd() {
        setEditingId(null);
        setForm({ ...EMPTY_FORM, month: monthOptions[0]?.value ?? "", branchId: activeBranches[0]?.id ?? "" });
        setPanelOpen(true);
    }

    function openEdit(row: MarketingSpend) {
        setEditingId(row.id);
        setForm({ month: row.month, channel: row.channel, branchId: row.branch_id, amount: String(row.spend_aed) });
        setPanelOpen(true);
    }

    const amountNum = Number(form.amount);
    const isValid =
        form.month !== "" &&
        form.channel !== "" &&
        form.branchId !== "" &&
        Number.isFinite(amountNum) &&
        amountNum > 0;

    function handleSave() {
        if (!isValid || form.channel === "") return;
        const payload = {
            month: form.month,
            channel: form.channel,
            spend_aed: amountNum,
            branch_id: form.branchId,
        };
        if (editingId) {
            updateMarketingSpend(editingId, payload);
            showToast("Spend updated", `${form.channel} · ${monthLabel(form.month)} set to AED ${AED.format(amountNum)}.`, "success", "check");
        } else {
            addMarketingSpend(payload);
            showToast("Spend added", `AED ${AED.format(amountNum)} on ${form.channel} for ${monthLabel(form.month)}.`, "success", "check");
        }
        setPanelOpen(false);
        setEditingId(null);
    }

    function handleDelete(row: MarketingSpend) {
        deleteMarketingSpend(row.id);
        showToast("Spend deleted", `${row.channel} · ${monthLabel(row.month)} removed.`, "success", "trash");
        setConfirmDelete(null);
    }

    return (
        <>
            <div className="flex flex-col gap-6 py-8">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 px-6">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-[24px] font-semibold leading-[32px] text-[var(--colors-text-primary)]">
                            Marketing Spend
                        </h1>
                        <p className="text-[14px] leading-[20px] text-[var(--colors-text-tertiary)] max-w-[640px]">
                            Track ad &amp; marketing spend per channel and month. These figures feed the
                            Acquisition Efficiency report — CPL, CAC and ROAS are calculated against them.
                        </p>
                    </div>
                    <Button variant="primary" onClick={openAdd} className="shrink-0">
                        <Plus className="size-[18px]" />
                        Add spend
                    </Button>
                </div>

                {/* Table card — fixed min-height so it never hugs sparse data. */}
                <div className="px-6">
                    <div className="min-h-[760px] rounded-[12px] border-1 border-[var(--colors-border-secondary)] bg-white overflow-hidden flex flex-col">
                        {rows.length === 0 ? (
                            <div className="relative flex-1 flex flex-col items-center justify-center gap-5">
                                <EmptyState
                                    icon={CurrencyDollarCircle}
                                    title="No marketing spend yet"
                                    subtitle="Add your first spend entry to power the Acquisition Efficiency report."
                                    absolute={false}
                                />
                                <Button variant="primary" onClick={openAdd}>
                                    <Plus className="size-[18px]" />
                                    Add spend
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="border-b border-[var(--colors-border-secondary)]">
                                                <Th>Month</Th>
                                                <Th>Channel</Th>
                                                <Th>Branch</Th>
                                                <Th align="right">Amount (AED)</Th>
                                                <th className="w-[100px] px-6 py-3" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map(row => (
                                                <tr key={row.id} className="border-b border-[var(--colors-border-secondary)] last:border-b-0 hover:bg-[var(--colors-bg-secondary)] transition-colors">
                                                    <Td>{monthLabel(row.month)}</Td>
                                                    <Td>{row.channel}</Td>
                                                    <Td>{branchName(row.branch_id)}</Td>
                                                    <Td align="right" className="tabular-nums">{AED.format(row.spend_aed)}</Td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <IconBtn label="Edit" onClick={() => openEdit(row)}>
                                                                <Edit02 className="size-[18px]" />
                                                            </IconBtn>
                                                            <IconBtn label="Delete" onClick={() => setConfirmDelete(row)}>
                                                                <Trash02 className="size-[18px]" />
                                                            </IconBtn>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Total footer */}
                                <div className="flex items-center justify-between border-t border-[var(--colors-border-secondary)] px-6 py-4">
                                    <span className="text-[13px] text-[var(--colors-text-tertiary)]">
                                        {rows.length} {rows.length === 1 ? "entry" : "entries"}
                                    </span>
                                    <span className="text-[14px] font-semibold text-[var(--colors-text-primary)] tabular-nums">
                                        Total: AED {AED.format(total)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Add / Edit side panel */}
            <SlidePanel open={panelOpen} onClose={() => setPanelOpen(false)} width={440}>
                <div className="flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4 border-b border-[var(--colors-border-secondary)] px-6 py-5">
                        <div className="flex flex-col gap-1">
                            <h2 className="text-[18px] font-semibold leading-[26px] text-[var(--colors-text-primary)]">
                                {editingId ? "Edit spend" : "Add spend"}
                            </h2>
                            <p className="text-[13px] leading-[18px] text-[var(--colors-text-tertiary)]">
                                Record ad / marketing spend for a channel and month.
                            </p>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-5">
                        <Field label="Month">
                            <SelectInput
                                triggerIcon={<Calendar className="size-[18px]" />}
                                placeholder="Select month"
                                options={monthOptions}
                                value={form.month}
                                onChange={v => setForm(f => ({ ...f, month: v }))}
                                width="w-full"
                                searchable
                            />
                        </Field>

                        <Field label="Channel">
                            <SelectInput
                                triggerIcon={<Announcement01 className="size-[18px]" />}
                                placeholder="Select channel"
                                options={CHANNELS.map(c => ({ value: c, label: c }))}
                                value={form.channel}
                                onChange={v => setForm(f => ({ ...f, channel: v as MarketingSpend["channel"] }))}
                                width="w-full"
                            />
                        </Field>

                        <Field label="Branch">
                            <SelectInput
                                triggerIcon={<MarkerPin01 className="size-[18px]" />}
                                placeholder="Select branch"
                                options={activeBranches.map(b => ({ value: b.id, label: b.name }))}
                                value={form.branchId}
                                onChange={v => setForm(f => ({ ...f, branchId: v }))}
                                width="w-full"
                            />
                        </Field>

                        <Field label="Amount (AED)">
                            <Input
                                inputMode="numeric"
                                placeholder="0"
                                value={form.amount === "0" ? "" : form.amount}
                                onChange={e => {
                                    // Digits only; strip leading zeros (number-input convention).
                                    const cleaned = e.target.value.replace(/[^0-9]/g, "").replace(/^0+(?=\d)/, "");
                                    setForm(f => ({ ...f, amount: cleaned }));
                                }}
                            />
                        </Field>
                    </div>

                    <div className="flex items-center justify-end gap-3 border-t border-[var(--colors-border-secondary)] px-6 py-4">
                        <Button variant="secondary-gray" onClick={() => setPanelOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="primary" onClick={handleSave} disabled={!isValid}>
                            {editingId ? "Save changes" : "Add spend"}
                        </Button>
                    </div>
                </div>
            </SlidePanel>

            {/* Delete confirmation */}
            <ConfirmModal
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                icon={Trash01}
                tone="danger"
                title="Delete spend entry?"
                description={confirmDelete ? (
                    <>Remove the <span className="font-medium text-[var(--colors-text-primary)]">{confirmDelete.channel} · {monthLabel(confirmDelete.month)}</span> spend of AED {AED.format(confirmDelete.spend_aed)}. The Acquisition Efficiency report will recompute without it.</>
                ) : ""}
                confirmLabel="Delete"
                onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
            />
        </>
    );
}

// ─── Small presentational helpers ────────────────────────────────────────────

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
    return (
        <th className={cn(
            "px-6 py-3 text-[12px] font-medium text-[var(--colors-text-tertiary)] leading-[18px] whitespace-nowrap",
            align === "right" ? "text-right" : "text-left",
        )}>
            {children}
        </th>
    );
}

function Td({ children, align = "left", className }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
    return (
        <td className={cn(
            "px-6 py-4 text-[14px] leading-[20px] text-[var(--colors-text-secondary)] whitespace-nowrap",
            align === "right" ? "text-right" : "text-left",
            className,
        )}>
            {children}
        </td>
    );
}

function IconBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            aria-label={label}
            onClick={onClick}
            className="flex size-9 items-center justify-center rounded-[8px] text-[var(--colors-text-tertiary)] hover:bg-[var(--colors-bg-secondary)] hover:text-[var(--colors-text-secondary)] transition-colors"
        >
            {children}
        </button>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-[var(--colors-text-secondary)]">{label}</span>
            {children}
        </label>
    );
}
