"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Membership / Credit-package detail page (/products/[id])
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-screen detail page matching the /class-types/[id] shell exactly so
// every detail page in the dashboard shares the same chrome:
//   • 72px top header (X close + page title)
//   • h-[832px] two-column frame inside px-6 py-6 outer padding
//   • 320px left sidebar (banner + key stats + sidebar actions)
//   • Right panel: tabs (h-[48px] underline) + toolbar + scrollable body
//
// Figma references:
//   • Sidebar       — 2744:57990 (indigo pattern banner + 72px icon avatar)
//   • Details tab   — 6955:29502 (Basic / Pricing / Config / Applicable
//                                  branches / Duration & renewal / Purchase
//                                  rules cards)
//   • Customers tab — 2744:57991

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams, usePathname } from "next/navigation";
import {
    XClose, Edit02, Archive, SlashCircle01, RefreshCcw01, Trash01, Check,
    CreditCard02, Package as PackageIcon,
    DotsVertical, SearchMd, Eye, ChevronLeft, ChevronUp, ChevronDown,
    HelpCircle, Calendar, CalendarPlus01, CalendarCheck01, ShieldTick,
    CreditCardCheck, Coins01, RefreshCcw02, Announcement01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import {
    useAppStore,
    type Membership, type Package, type Customer, type PurchaseRulesData, type Branch,
} from "@/lib/store";
import { EmptyState } from "@/components/ui/EmptyState";
import { TaxSuffix } from "@/components/ui/TaxSuffix";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { StatusBadge } from "@/components/patterns/StatusBadge";

// ─── Types & helpers ────────────────────────────────────────────────────────

type ProductKind = "membership" | "package";
type ProductStatus = Membership["status"]; // active | inactive | archived

function formatAed(n: number): string {
    return `AED ${n.toLocaleString("en-US")}`;
}

function formatCredits(c: Membership["credits"] | Package["credits"]): string {
    if (c === "unlimited") return "Unlimited";
    return `${c} ${c === 1 ? "Credit" : "Credits"}`;
}

function formatDuration(months: number): string {
    if (months === 1) return "1 Month";
    if (months === 12) return "1 Year";
    if (months % 12 === 0) return `${months / 12} Years`;
    return `${months} Months`;
}

function formatValidity(days: number): string {
    if (days === 7) return "7 Days";
    if (days === 30) return "1 Month";
    if (days === 60) return "2 Months";
    if (days === 90) return "3 Months";
    return `${days} Days`;
}

function branchName(id: string, branches: Branch[]): string {
    return branches.find(b => b.id === id)?.name ?? id;
}

// Deterministic "created at" — pseudo-randomized per id until the column
// lands on the seed Membership/Package types.
function placeholderCreatedAt(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
    const epoch = 1672531200000; // 2023-01-01
    const span = 365 * 24 * 3600 * 1000 * 2; // 2 years
    const date = new Date(epoch + (hash % span));
    const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${DAYS[date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

// ─── Sidebar action button (from class-types/[id]) ──────────────────────────

function ActionBtn({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode; label: string; danger?: boolean; onClick?: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-[16px] font-semibold leading-[24px] transition-colors",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#344054]",
            )}>
            <span className="w-5 h-5 shrink-0">{icon}</span>
            {label}
        </button>
    );
}

// ─── Confirmation modal (mirrors class-types/[id] tone matrix) ──────────────

type ModalAction = "archive" | "deactivate" | "recover" | "reactivate" | "delete";

const MODAL_TONE: Record<ModalAction, "danger" | "success"> = {
    archive: "success",
    deactivate: "danger",
    recover: "success",
    reactivate: "success",
    delete: "danger",
};

const MODAL_CONFIG: Record<ModalAction, {
    IconComp: React.ElementType;
    title: string; description: string;
    confirmLabel: string;
}> = {
    archive: {
        IconComp: Archive,
        title: "Archive this product?",
        description: "This product will be hidden from the Point of Sale catalog and the class-types Applicable Plans list. You can recover archived products at any time.",
        confirmLabel: "Archive",
    },
    deactivate: {
        IconComp: SlashCircle01,
        title: "Deactivate this product?",
        description: "This product will be hidden from new Point of Sale sales. Customers who already hold it keep their access.",
        confirmLabel: "Deactivate",
    },
    recover: {
        IconComp: RefreshCcw01,
        title: "Recover this product?",
        description: "This product will be restored to Active status and become sellable again.",
        confirmLabel: "Recover",
    },
    reactivate: {
        IconComp: Check,
        title: "Reactivate this product?",
        description: "This product will become available again in the Point of Sale catalog.",
        confirmLabel: "Reactivate",
    },
    delete: {
        IconComp: Trash01,
        title: "Delete this product?",
        description: "This product will be permanently removed. This action cannot be undone.",
        confirmLabel: "Delete",
    },
};

// ─── Pattern banner (Figma 2744:57990 indigo-line decorative) ───────────────
//
// Pure-CSS adaptation of the Figma `Background pattern decorative` — five
// concentric rounded squares, rotated -12.5° within a -32.1° outer wrapper,
// soft-masked into the centre. The icon avatar sits on top.

function PatternBanner({ kind }: { kind: ProductKind }) {
    const Icon = kind === "package" ? PackageIcon : CreditCard02;
    const tint = kind === "package"
        ? { bg: "bg-[#c4edd6]", fg: "text-[#658774]", line: "#abefc6" }
        : { bg: "bg-[#e0eaff]", fg: "text-[#3538cd]", line: "#c7d7fe" };

    return (
        <div className="relative h-[155px] w-full overflow-hidden bg-[#f9fafb] shrink-0">
            {/* Background pattern — concentric rounded squares, tilted. The
                outer wrapper applies the -32.1° rotation; the inner squares
                apply the -12.5° offset around the centre. */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                <div className="size-[560px] flex items-center justify-center" style={{ transform: "rotate(-32.1deg)" }}>
                    <div className="relative size-[560px]"
                        style={{
                            // Radial soft mask so only the central ring of the
                            // pattern reaches the banner edges.
                            WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                            maskImage:        "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                        }}>
                        {[160, 240, 320, 400, 480, 560].map(sz => (
                            <div key={sz}
                                className="absolute left-1/2 top-1/2 rounded-[20px]"
                                style={{
                                    width: sz, height: sz,
                                    transform: "translate(-50%, -50%) rotate(-12.5deg)",
                                    border: `1.667px solid ${tint.line}`,
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Glossy 72px icon avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn(
                    "relative w-[72px] h-[72px] rounded-[16px] border-[2.65px] border-white/[0.12] flex items-center justify-center",
                    "shadow-[0px_3.49px_3.49px_rgba(0,0,0,0.04),-6.98px_10.47px_20.94px_rgba(224,248,164,0.08),10.47px_10.47px_20.94px_rgba(224,248,164,0.06),0px_3.49px_20.94px_rgba(224,248,164,0.12)]",
                    "backdrop-blur-[8.7px]",
                    tint.bg,
                )}>
                    <Icon className={cn("w-[42px] h-[42px]", tint.fg)} />
                    <div className="absolute inset-0 rounded-[16px] pointer-events-none shadow-[inset_2.5px_2.5px_3.3px_rgba(255,255,255,0.2)]" />
                </div>
            </div>
        </div>
    );
}

// ─── Left sidebar (Figma 2744:57990) ────────────────────────────────────────

function LeftSidebar({
    kind, name, priceAed, creditsLabel, durationLabel, customerCount, status, onAction,
}: {
    kind: ProductKind;
    name: string;
    priceAed: number;
    creditsLabel: string;
    durationLabel: string;
    customerCount: number;
    status: ProductStatus;
    onAction: (a: "edit" | ModalAction) => void;
}) {
    const productNoun = kind === "package" ? "credit package" : "membership";
    const hasHolders = customerCount > 0;

    const actions = (() => {
        // Archived products must be Recovered before they can be edited or
        // deleted; Inactive products must be Reactivated first.
        if (status === "archived") {
            return (
                <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label={`Recover ${productNoun}`} onClick={() => onAction("recover")} />
            );
        }
        if (status === "inactive") {
            return (
                <>
                    <ActionBtn icon={<RefreshCcw01 className="w-5 h-5" />} label={`Reactivate ${productNoun}`} onClick={() => onAction("reactivate")} />
                    <ActionBtn icon={<Archive className="w-5 h-5" />} label={`Archive ${productNoun}`} onClick={() => onAction("archive")} />
                </>
            );
        }
        return (
            <>
                <ActionBtn icon={<Edit02 className="w-5 h-5" />} label={`Edit ${productNoun}`} onClick={() => onAction("edit")} />
                <ActionBtn icon={<Archive className="w-5 h-5" />} label={`Archive ${productNoun}`} onClick={() => onAction("archive")} />
                {hasHolders ? (
                    <ActionBtn icon={<SlashCircle01 className="w-5 h-5" />} label={`Deactivate ${productNoun}`} danger onClick={() => onAction("deactivate")} />
                ) : (
                    <ActionBtn icon={<Trash01 className="w-5 h-5" />} label={`Delete ${productNoun}`} danger onClick={() => onAction("delete")} />
                )}
            </>
        );
    })();

    const actionsLabel = kind === "package" ? "Credit package actions" : "Membership actions";

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner */}
            <div className="relative shrink-0">
                <PatternBanner kind={kind} />
                <div className="absolute top-3 right-3">
                    <StatusBadge type="product" status={status} size="lg" />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{name}</h2>

                    <div className="flex flex-col gap-3">
                        <SidebarField
                            label="Price"
                            value={formatAed(priceAed)}
                            suffix={<TaxSuffix category={kind === "membership" ? "membership" : "credit_package"} />}
                        />
                        <SidebarField label="Credit amount" value={creditsLabel} />
                        <SidebarField label="Duration" value={durationLabel} />
                        <SidebarField label="Active customers" value={`${customerCount} Customers`} />
                    </div>
                </div>

                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">{actionsLabel}</p>
                    <div className="flex flex-col gap-4">{actions}</div>
                </div>
            </div>
        </div>
    );
}

function SidebarField({ label, value, suffix }: { label: string; value: string; suffix?: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
            {suffix}
        </div>
    );
}

// ─── Right panel tabs (same h-[48px] underline as class-types/[id]) ─────────

type TabId = "details" | "customers";

// ─── Right panel ────────────────────────────────────────────────────────────

function RightPanel({ kind, vm, productId, activeCustomers, renewalFor, branches }: {
    kind: ProductKind;
    vm: MembershipDetailVM;
    /** Product id — passed through so the details tab can resolve which
     *  class templates + services list this product in their applicable
     *  arrays (reverse-link surface). */
    productId: string;
    activeCustomers: Customer[];
    renewalFor: (c: Customer) => string;
    branches: Branch[];
}) {
    const [tab, setTab] = useState<TabId>("details");

    // The tab labels swap "Membership" → "Credit package" for the package
    // case. Both tabs always render — the toolbar's "Total" content is
    // tab-specific so we keep that inside the customers branch.
    const tabsCopy: { id: TabId; label: string }[] = [
        { id: "details",   label: kind === "package" ? "Package details" : "Membership details" },
        { id: "customers", label: "Active customers" },
    ];

    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
            {/* Tabs row — same h-[48px] underline pattern as class-types */}
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                <div className="flex gap-1">
                    {tabsCopy.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)}
                            className={cn(
                                "h-[48px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                                tab === t.id
                                    ? "border-b-2 border-[#101828] text-[#101828]"
                                    : "text-[#667085] hover:text-[#344054]",
                            )}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "details" ? (
                <DetailsTab vm={vm} productId={productId} branches={branches} />
            ) : (
                <ActiveCustomersTab customers={activeCustomers} productName={vm.name} renewalFor={renewalFor} />
            )}
        </div>
    );
}

// ─── Details tab content ────────────────────────────────────────────────────
//
// Read-only mirror of the multi-step create flow. Everything renders in a
// disabled-state visual treatment per the user's note — no green-bordered
// active cards, no white-on-green checkmarks. Checkboxes use muted gray
// fills, rule cards use the standard `#e4e7ec` border, and the only
// interactive affordances on the page are the collapse chevrons + tooltip
// hovers.
//
// Sections (Figma 6955:29503 / 29524 / 29540 / 29541 / 29562):
//   • Basic information      — Description + Welcome-message cards, then
//                              an inline 2-col `InlineStat` row (Price +
//                              Date created)
//   • Product configuration  — inline 2-col `InlineStat` row, with the
//                              "Multi-location access" stat carrying a
//                              `HelpTooltip` after the label
//   • Applicable branches    — collapsible card, disabled-checkbox list
//   • Duration & renewal     — inline 2-col + 1-row `InlineStat` grid;
//                              "Active on first use" carries a `HelpTooltip`
//   • Purchase rules         — 3 collapsible cards (Time bound, Eligibility,
//                              Usage cap), each with disabled-checkbox rule
//                              rows + descriptive subtext under each rule

function DetailsTab({ vm, productId, branches }: { vm: MembershipDetailVM; productId: string; branches: Branch[] }) {
    const groups = buildPurchaseRuleGroups(vm);
    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            {/* ── Basic information ── */}
            <SectionHeading>Basic information</SectionHeading>
            <DescriptionCard label="Description" body={vm.description || "—"} />
            <DescriptionCard label="Welcome message" body={vm.welcomeMessage || "—"} />
            <InlineStatRow>
                <InlineStat
                    icon={<Coins01 className="w-4 h-4" />}
                    label={`${vm.kindLabel} price`}
                    value={formatAed(vm.priceAed)}
                    tooltip={undefined}
                    suffix={<TaxSuffix category={vm.kind === "membership" ? "membership" : "credit_package"} />}
                />
                <InlineStat
                    icon={<CalendarPlus01 className="w-4 h-4" />}
                    label="Date created"
                    value={vm.createdAt}
                />
            </InlineStatRow>

            {/* ── Product configuration ──
                Credit packages add a "This package is an intro offer" row.
                Memberships keep the original 2-stat row (the Unlimited
                credits state is folded into the Number-of-credits value). */}
            <SectionHeading>Product configuration</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<CalendarCheck01 className="w-4 h-4" />}
                    label="Number of credits"
                    value={vm.unlimitedCredits ? "Unlimited" : vm.creditsLabel}
                />
                <InlineStat
                    icon={<ShieldTick className="w-4 h-4" />}
                    label="Multi-location access"
                    value={vm.multiLocation ? "On" : "Off"}
                    tooltip={vm.multiLocation
                        ? `${vm.kindLabel} can be use on multiple branches`
                        : `${vm.kindLabel} is only available on a single branch`}
                />
            </InlineStatRow>
            {vm.kind === "package" && (
                <InlineStatRow>
                    <InlineStat
                        icon={<Announcement01 className="w-4 h-4" />}
                        label="This package is an intro offer"
                        value={vm.isIntroOffer ? "Yes" : "No"}
                    />
                    <div />
                </InlineStatRow>
            )}

            {/* ── Applicable branches ── (kind- and multi-location-aware subtitle) */}
            <BranchesCard branchIds={vm.branchIds} productNoun={vm.productNoun} branches={branches} />

            {/* ── Duration block ──
                Membership: "Duration & renewal" with 3 stats (Duration,
                Active on first use, Auto-renew).
                Credit package: "Duration configuration" with just Duration —
                packages don't auto-renew and aren't gated on first use. */}
            {vm.kind === "membership" ? (
                <>
                    <SectionHeading>Duration &amp; renewal</SectionHeading>
                    <InlineStatRow>
                        <InlineStat
                            icon={<Calendar className="w-4 h-4" />}
                            label="Duration"
                            value={vm.durationLabel}
                        />
                        <InlineStat
                            icon={<CreditCardCheck className="w-4 h-4" />}
                            label="Active on first use"
                            value={vm.activeOnFirstUse ? "Yes" : "No"}
                            tooltip="Membership period begins when the customer first uses it"
                        />
                    </InlineStatRow>
                    <InlineStatRow>
                        <InlineStat
                            icon={<RefreshCcw02 className="w-4 h-4" />}
                            label="Auto-renew"
                            value={vm.autoRenew ? "Yes" : "No"}
                        />
                        <div />
                    </InlineStatRow>
                </>
            ) : (
                <>
                    <SectionHeading>Duration configuration</SectionHeading>
                    <InlineStatRow>
                        <InlineStat
                            icon={<Calendar className="w-4 h-4" />}
                            label="Duration"
                            value={vm.durationLabel}
                        />
                        <div />
                    </InlineStatRow>
                </>
            )}

            {/* ── Purchase rules ──
                Each section/rule visibility flows live from the persisted
                purchase_rules snapshot. Section master toggle off →
                "No rules selected" + no chevron + no body. Inside a section,
                rules with `on: false` are filtered out so the body only
                shows what the admin actually selected. */}
            <SectionHeading>Purchase rules</SectionHeading>

            {vm.kind === "package" && (
                <RulesCard
                    title="Purchase limit rules"
                    subtitle={`Control how often a customer can buy this ${vm.productNoun}`}
                    selectionStyle="radio"
                    enabled={groups.purchaseLimit.enabled}
                    rules={groups.purchaseLimit.rules}
                />
            )}

            <RulesCard
                title="Time bound rules"
                subtitle={`Control when this ${vm.productNoun} can be purchased`}
                enabled={groups.timeBound.enabled}
                rules={groups.timeBound.rules}
            />

            <RulesCard
                title="Eligibility rules"
                subtitle={`Control who can purchase this ${vm.productNoun}`}
                enabled={groups.eligibility.enabled}
                rules={groups.eligibility.rules}
            />

            <RulesCard
                title="Usage cap rules"
                subtitle="Limit total availability across all customers"
                enabled={groups.usageCap.enabled}
                rules={groups.usageCap.rules}
            />
        </div>
    );
}

// ─── Build per-section rule arrays from the persisted snapshot ───────────────
//
// One function so the rules logic stays in a single, testable place. Each
// section returns { enabled, rules }: `enabled` reflects the master toggle,
// `rules` only contains rules whose own `on` flag is true.

interface RuleGroupVM {
    enabled: boolean;
    rules: RuleDetail[];
}

function buildPurchaseRuleGroups(vm: MembershipDetailVM): {
    timeBound: RuleGroupVM;
    eligibility: RuleGroupVM;
    usageCap: RuleGroupVM;
    purchaseLimit: RuleGroupVM;
} {
    const r = vm.purchaseRules;

    // Section disabled OR no rules data → everything is "No rules selected".
    if (!r) {
        return {
            timeBound:     { enabled: false, rules: [] },
            eligibility:   { enabled: false, rules: [] },
            usageCap:      { enabled: false, rules: [] },
            purchaseLimit: { enabled: false, rules: [] },
        };
    }

    // ─── Time bound ────────────────────────────────────────────────────────
    const timeBoundRules: RuleDetail[] = [];
    if (r.timeBound.purchaseWindow.on) {
        const from = formatISODate(r.timeBound.purchaseWindow.from);
        const to   = formatISODate(r.timeBound.purchaseWindow.to);
        timeBoundRules.push({
            title: "Set purchase window",
            detail: `Availability: ${from || "—"} – ${to || "—"}`,
        });
    }
    if (r.timeBound.dayOfWeek.on) {
        const days = r.timeBound.dayOfWeek.days.map(d => FULL_WEEKDAYS[d] ?? d);
        timeBoundRules.push({
            title: "Day of week restrictions",
            detail: `Available on: ${days.length > 0 ? days.join(", ") : "Every day"}`,
        });
    }
    if (r.timeBound.activationDelay.on) {
        const days = Number(r.timeBound.activationDelay.days) || 0;
        timeBoundRules.push({
            title: "Activation delay",
            detail: `Days of delay: ${days} days`,
        });
    }

    // ─── Eligibility ───────────────────────────────────────────────────────
    const eligibilityRules: RuleDetail[] = [];
    if (r.eligibility.newCustomers.on) {
        // List each selected sub-option on its own line. Show "—" only when
        // the parent rule is checked but neither sub-option is — keeps the
        // row meaningful without misrepresenting the state.
        const lines: string[] = [];
        if (r.eligibility.newCustomers.neverPurchased) {
            lines.push("Never purchase any paid package");
        }
        if (r.eligibility.newCustomers.recentSignup) {
            const n = Number(r.eligibility.newCustomers.daysAgo) || 0;
            const unit = r.eligibility.newCustomers.daysUnit;
            const unitWord = n === 1 ? unit : `${unit}s`;
            lines.push(`Account created with last (${n}) ${unitWord}`);
        }
        eligibilityRules.push({
            title: "New customers only",
            detail: lines.length > 0 ? lines.join("\n") : "—",
        });
    }
    if (r.eligibility.existingCustomers.on) {
        const n = Number(r.eligibility.existingCustomers.minPackages) || 0;
        eligibilityRules.push({
            title: "Existing customers only",
            detail: `Must purchase at least (${n}) packages before`,
        });
    }
    // Package-only — gate purchase on holding a specific membership. The
    // membership name is resolved live from the store inside DetailsTab so
    // the rule reflects the current tier name even if it was renamed.
    if (vm.kind === "package" && r.eligibility.specificMembershipTier.on) {
        eligibilityRules.push({
            title: "Specific membership tier",
            detail: vm.specificMembershipTierName || "—",
        });
    }

    if (r.eligibility.locationRegion.on) {
        eligibilityRules.push({
            title: "Specific location/region",
            detail: r.eligibility.locationRegion.region || "—",
        });
    }

    // ─── Usage cap ─────────────────────────────────────────────────────────
    const usageCapRules: RuleDetail[] = [];
    if (r.usageCap.totalRedemptions.on) {
        const n = Number(r.usageCap.totalRedemptions.max) || 0;
        usageCapRules.push({
            title: "Total redemptions cap",
            detail: `Maximum (${n}) total purchases across all customers`,
        });
    }
    if (r.usageCap.perLocation.on) {
        const n = Number(r.usageCap.perLocation.max) || 0;
        usageCapRules.push({
            title: "Per-location cap",
            detail: `Maximum (${n}) total purchases per location`,
        });
    }
    if (r.usageCap.perDay.on) {
        const n = Number(r.usageCap.perDay.max) || 0;
        usageCapRules.push({
            title: "Per-day cap",
            detail: `Maximum (${n}) total purchases per day`,
        });
    }

    // ─── Purchase limit (package-only) ─────────────────────────────────────
    //
    // Single-select group — emit ONE rule per the admin's `selectedRule`.
    // Lifetime needs no extra data; Rolling reads the period from
    // `r.purchaseLimit.rolling`.
    const purchaseLimitRules: RuleDetail[] = [];
    if (r.purchaseLimit.selectedRule === "lifetime") {
        purchaseLimitRules.push({
            title: "Lifetime limit",
            detail: "Maximum 1 purchase per customer",
        });
    } else if (r.purchaseLimit.selectedRule === "rolling") {
        const every = Number(r.purchaseLimit.rolling.every) || 0;
        const unit = r.purchaseLimit.rolling.unit;
        const unitWord = every === 1 ? unit : `${unit}s`;
        purchaseLimitRules.push({
            title: "Rolling window or calendar period limit",
            detail: `Maximum 1 purchase per ${every} ${unitWord}`,
        });
    }

    return {
        timeBound:     { enabled: r.timeBound.on,     rules: timeBoundRules },
        eligibility:   { enabled: r.eligibility.on,   rules: eligibilityRules },
        usageCap:      { enabled: r.usageCap.on,      rules: usageCapRules },
        purchaseLimit: { enabled: r.purchaseLimit.on, rules: purchaseLimitRules },
    };
}

// ─── Section heading (small gray label, no border) ──────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[14px] text-[#667085] mt-2 first:mt-0">{children}</p>
    );
}

// ─── Description card — bordered block + "See more" truncation ──────────────

function DescriptionCard({ label, body }: { label: string; body: string }) {
    const [expanded, setExpanded] = useState(false);
    // Truncate at ~280 chars so the card collapses to roughly 3 lines at the
    // typical width of the details panel. The "See more" link only renders
    // when the body actually overflows the threshold.
    const isTruncatable = body.length > 280;
    const shown = expanded || !isTruncatable ? body : `${body.slice(0, 280).trimEnd()}…`;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className="text-[16px] text-[#101828] leading-6 whitespace-pre-line">{shown}</p>
            {isTruncatable && (
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="self-start text-[14px] font-medium text-[#658774] hover:text-[#4f6e5d] transition-colors">
                    {expanded ? "See less" : "See more"}
                </button>
            )}
        </div>
    );
}

// ─── Inline icon-label-value stat (Figma rows for Price / Date / Credits) ──

function InlineStatRow({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function InlineStat({ icon, label, value, tooltip, suffix }: {
    icon: React.ReactNode;
    label: string;
    value: string;
    tooltip?: string;
    suffix?: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0 text-[#475467]">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                    <p className="text-[14px] text-[#667085] leading-5">{label}</p>
                    {tooltip && <HelpTooltip text={tooltip} />}
                </div>
                <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{value}</p>
                {suffix}
            </div>
        </div>
    );
}

// ─── HelpTooltip — ? icon with hover black popover (Figma user screenshot) ─

function HelpTooltip({ text }: { text: string }) {
    const [open, setOpen] = useState(false);
    return (
        <span className="relative inline-flex">
            <button type="button" aria-label="More information"
                onMouseEnter={() => setOpen(true)}
                onMouseLeave={() => setOpen(false)}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                className="text-[#98a2b3] hover:text-[#667085] transition-colors">
                <HelpCircle className="w-4 h-4" />
            </button>
            {open && (
                <span className="absolute left-1/2 bottom-[calc(100%+8px)] -translate-x-1/2 z-50 whitespace-nowrap rounded-[8px] bg-[#0c111d] text-white text-[12px] font-medium leading-[18px] px-3 py-2 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] pointer-events-none">
                    {text}
                    <span className="absolute left-1/2 top-full -translate-x-1/2 -mt-px w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#0c111d]" />
                </span>
            )}
        </span>
    );
}

// ─── Disabled-state checkbox (Figma "details" branch + rule rows) ───────────

function DisabledCheckbox({ checked }: { checked: boolean }) {
    return (
        <div className={cn(
            "w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0",
            checked ? "bg-[#f9fafb] border-[#d0d5dd]" : "bg-[#f9fafb] border-[#d0d5dd]",
        )}>
            {checked && <Check className="w-[10px] h-[10px] text-[#d0d5dd]" />}
        </div>
    );
}

// The reverse-link "Applicable on" card was removed per the Figma spec —
// memberships/packages don't surface the reverse list of class templates +
// services that link to them. The forward link is still authored on the
// other side: class templates (`applicableMembershipIds` /
// `applicablePackageIds`) and services own those arrays, and their
// create/edit forms let admins pick which memberships/packages a class or
// service can be redeemed against.

// ─── Applicable branches — collapsible card, disabled checkboxes ────────────
//
// Subtitle is kind- AND mode-aware:
//   • multi-location (≥2 branches OR empty/"all branches"): "can be use on
//     multiple branches"
//   • single-location (exactly 1 branch):                    "can only be
//     use on a single branch"

function BranchesCard({ branchIds, productNoun, branches }: { branchIds: string[]; productNoun: string; branches: Branch[] }) {
    const [open, setOpen] = useState(true);
    const isSingleLocation = branchIds.length === 1;
    const subtitle = isSingleLocation
        ? `The ${productNoun} can only be use on a single branch`
        : `The ${productNoun} can be use on multiple branches`;
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">Applicable branches</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {branchIds.length} selected
                </span>
                <button type="button" onClick={() => setOpen(p => !p)}
                    aria-label={open ? "Collapse" : "Expand"}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0 hover:text-[#344054] transition-colors">
                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>
            {open && (
                <div className="flex flex-col gap-3">
                    {branchIds.length === 0 ? (
                        <div className="flex items-center gap-2">
                            <DisabledCheckbox checked />
                            <span className="text-[14px] font-medium text-[#101828]">All active branches</span>
                        </div>
                    ) : (
                        branchIds.map(id => (
                            <div key={id} className="flex items-center gap-2">
                                <DisabledCheckbox checked />
                                <span className="text-[14px] font-medium text-[#101828]">{branchName(id, branches)}</span>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Rules card — collapsible, with disabled-checkbox rule rows ────────────
//
// `selectionStyle` switches the leading indicator: "checkbox" (default —
// multi-select rule groups) vs "radio" (single-select groups, e.g. credit
// package's Purchase-limit rules where only one option can apply).
//
// `enabled` mirrors the section's master toggle in the create flow. When
// the admin turns the whole section off, the badge reads "No rules
// selected", the chevron is gone, and the body is hidden — matching the
// "section disabled" state the create form models.

interface RuleDetail { title: string; detail: string }

function RulesCard({ title, subtitle, rules, enabled, selectionStyle = "checkbox" }: {
    title: string; subtitle: string;
    rules: RuleDetail[];
    enabled: boolean;
    selectionStyle?: "checkbox" | "radio";
}) {
    const [open, setOpen] = useState(true);

    // Section off → fixed badge + no chevron + no body. Section on with no
    // rules → still shows the chevron + "0 rules selected" so the empty
    // section reads correctly (not "broken").
    const collapsible = enabled;

    const badgeText = !enabled
        ? "No rules selected"
        : `${rules.length} ${rules.length === 1 ? "rule" : "rules"} selected`;

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#667085] leading-5">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {badgeText}
                </span>
                {collapsible && (
                    <button type="button" onClick={() => setOpen(p => !p)}
                        aria-label={open ? "Collapse" : "Expand"}
                        className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0 hover:text-[#344054] transition-colors">
                        {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                )}
            </div>
            {collapsible && open && rules.length > 0 && (
                <div className="flex flex-col gap-3">
                    {rules.map(r => (
                        <div key={r.title} className="flex items-start gap-2">
                            {selectionStyle === "radio" ? <DisabledRadio checked /> : <DisabledCheckbox checked />}
                            <div className="flex flex-col -mt-0.5">
                                <p className="text-[14px] font-medium text-[#101828] leading-5">{r.title}</p>
                                {/* whitespace-pre-line lets multi-line `detail`
                                    strings (e.g. the joined "Never purchase
                                    any paid package" + "Account created..."
                                    sub-options of New customers only) render
                                    one line per option. */}
                                <p className="text-[14px] text-[#667085] leading-5 whitespace-pre-line">{r.detail}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// Companion to DisabledCheckbox — same muted gray treatment for single-select
// rule groups. Filled inner dot in `#d0d5dd` so the radio reads as "this
// option is set, but read-only" the same way the checkboxes do.
function DisabledRadio({ checked }: { checked: boolean }) {
    return (
        <div className="w-4 h-4 rounded-full bg-[#f9fafb] border border-[#d0d5dd] flex items-center justify-center shrink-0">
            {checked && <div className="w-1.5 h-1.5 rounded-full bg-[#d0d5dd]" />}
        </div>
    );
}

// ─── Active customers tab (Figma 2744:57991, no bulk-select) ────────────────

function ActiveCustomersTab({ customers, productName, renewalFor }: {
    customers: Customer[]; productName: string;
    /** Resolves a customer's plan expiry/renewal date for the "Exp./Renewal" column. */
    renewalFor: (c: Customer) => string;
}) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => { setPage(1); }, [search]);

    const q = search.trim().toLowerCase();
    const filtered = useMemo(() => customers.filter(c => {
        if (!q) return true;
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone ?? ""}`.toLowerCase();
        return hay.includes(q);
    }), [customers, q]);

    // ── Sortable columns — Name / Contact (email) / Exp./Renewal (ISO). ──
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<Customer>(filtered, {
        name:    (a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
        contact: (a, b) => a.email.localeCompare(b.email),
        renewal: (a, b) => renewalFor(a).localeCompare(renewalFor(b)),
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clamped = Math.min(Math.max(1, page), totalPages);
    const paged = sortedRows.slice((clamped - 1) * pageSize, clamped * pageSize);

    return (
        <>
            {/* Toolbar — same as class-types/[id] */}
            <div className="shrink-0 flex items-center gap-3 px-6 py-4">
                <div className="flex-1">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">{filtered.length} customers</p>
                </div>
                <div className="relative w-[200px]">
                    <SearchMd className="absolute left-[12px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#667085]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search customer..."
                        className="h-9 w-full pl-[36px] pr-[14px] bg-white border border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative">
                {filtered.length === 0 ? (
                    <EmptyState
                        title={customers.length === 0 ? "No active customers" : "No customers found"}
                        subtitle={customers.length === 0
                            ? `No customers currently hold ${productName}.`
                            : "Try adjusting your search."}
                    />
                ) : (
                    <div className="px-6">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">
                                        <SortableHeader sortKey="name"    currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Name</SortableHeader>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">
                                        <SortableHeader sortKey="contact" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Contact</SortableHeader>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec]">
                                        <SortableHeader sortKey="renewal" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Exp./Renewal</SortableHeader>
                                    </th>
                                    <th className="px-4 py-3 text-left text-[12px] font-medium text-[#667085] border-b border-[#e4e7ec] w-[52px]"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paged.map(c => <CustomerRow key={c.id} customer={c} renewal={renewalFor(c)} />)}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination — same shell as class-types pagination */}
            <div className="px-6 shrink-0">
                <CustomersPagination
                    page={clamped} total={sortedRows.length} pageSize={pageSize}
                    onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            </div>
        </>
    );
}

function CustomerRow({ customer, renewal }: { customer: Customer; renewal: string }) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const btnRef = useRef<HTMLButtonElement>(null);

    const goToCustomer = () => router.push(`/customers/${customer.id}?returnTo=${encodeURIComponent(pathname)}`);

    return (
        <tr onClick={goToCustomer}
            className="hover:bg-[#f9fafb] transition-colors cursor-pointer">
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="flex items-center gap-3">
                    <CustomerAvatar customer={customer} />
                    <span className="text-[14px] font-medium text-[#101828]">{customer.firstName} {customer.lastName}</span>
                </div>
            </td>
            <td className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="flex flex-col">
                    <span className="text-[14px] text-[#101828]">{customer.email}</span>
                    {customer.phone && <span className="text-[14px] text-[#667085]">{customer.phone}</span>}
                </div>
            </td>
            <td className="px-4 py-4 border-b border-[#f2f4f7] text-[14px] text-[#344054] whitespace-nowrap">{renewal}</td>
            <td onClick={e => e.stopPropagation()}
                className="px-4 py-4 border-b border-[#f2f4f7]">
                <div className="relative">
                    <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f2f4f7] transition-colors">
                        <DotsVertical className="w-4 h-4 text-[#667085]" />
                    </button>
                    <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                        <button type="button"
                            onClick={() => { setOpen(false); goToCustomer(); }}
                            className="flex items-center gap-2 w-full px-4 py-[10px] text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors">
                            <Eye className="w-4 h-4 text-[#667085]" />View customer
                        </button>
                    </FixedDropdown>
                </div>
            </td>
        </tr>
    );
}

function CustomerAvatar({ customer }: { customer: Customer }) {
    if (customer.imageUrl) {
        return <img src={customer.imageUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />;
    }
    return (
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[14px] font-semibold shrink-0"
            style={{ backgroundColor: "#658774" }}>
            {customer.initials}
        </div>
    );
}

function CustomersPagination({ page, total, pageSize, onPage, onPageSize }: {
    page: number; total: number; pageSize: number; onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
    const [sizeOpen, setSizeOpen] = useState(false);
    const sizeRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function h(e: MouseEvent) { if (sizeRef.current && !sizeRef.current.contains(e.target as Node)) setSizeOpen(false); }
        document.addEventListener("mousedown", h);
        return () => document.removeEventListener("mousedown", h);
    }, []);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return (
        <div className="shrink-0 flex items-center gap-3 py-4 border-t border-[#e4e7ec]">
            <div ref={sizeRef} className="relative flex items-center gap-2 flex-1">
                <button type="button" onClick={() => setSizeOpen(p => !p)}
                    className="flex items-center gap-1 px-3 py-[7px] border-1 border-[#d0d5dd] rounded-[8px] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] text-[14px] font-semibold text-[#344054]">
                    {pageSize}<ChevronLeft className="w-4 h-4 text-[#667085] rotate-90" />
                </button>
                {sizeOpen && (
                    <div className="absolute bottom-[calc(100%+4px)] left-0 z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08)] py-1 min-w-[80px]">
                        {[10, 20, 30].map(s => (
                            <button key={s} type="button" onClick={() => { onPageSize(s); setSizeOpen(false); }}
                                className={cn("flex items-center w-full px-4 py-[9px] text-[14px] font-medium hover:bg-[#f9fafb] transition-colors", s === pageSize ? "text-[#101828] font-semibold" : "text-[#344054]")}>{s}</button>
                        ))}
                    </div>
                )}
                <span className="text-[14px] font-medium text-[#344054]">per page</span>
            </div>
            <div className="flex items-center gap-3">
                <button type="button" disabled={page <= 1} onClick={() => onPage(Math.max(1, page - 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page <= 1 ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Previous</button>
                <button type="button" disabled={page >= totalPages} onClick={() => onPage(Math.min(totalPages, page + 1))}
                    className={cn("px-3 py-[7px] border-1 rounded-[8px] text-[14px] font-semibold shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] transition-colors",
                        page >= totalPages ? "border-[#e4e7ec] text-[#98a2b3] cursor-not-allowed bg-white" : "border-[#d0d5dd] text-[#344054] bg-white hover:bg-[#f9fafb]")}>Next</button>
            </div>
        </div>
    );
}

// ─── ViewModel + mappers ────────────────────────────────────────────────────

interface MembershipDetailVM {
    kind: ProductKind;
    kindLabel: string;         // "Membership" / "Credit package"
    productNoun: string;       // "membership" / "credit package"
    name: string;
    description?: string;
    welcomeMessage: string;
    priceAed: number;
    creditsLabel: string;
    durationLabel: string;
    branchIds: string[];
    createdAt: string;
    unlimitedCredits: boolean;
    multiLocation: boolean;
    autoRenew: boolean;
    activeOnFirstUse: boolean;
    // Credit-package-only — flagged from the create flow's intro-offer toggle.
    isIntroOffer: boolean;
    /** Raw persisted purchase-rule snapshot — the detail tab uses this to
     *  build per-rule visibility (section.on / rule.on flags) so toggling
     *  rules off in the form correctly hides them here. */
    purchaseRules: PurchaseRulesData | null;
    /** Resolved membership name for the package-only "Specific membership
     *  tier" eligibility row. Populated live from the store using the
     *  membershipId stored on the rule. */
    specificMembershipTierName: string;
}

// ─── Purchase-rule display helpers ──────────────────────────────────────────
//
// These translate the persisted `PurchaseRulesData` snapshot (the same
// shape the create flow writes) into the strings rendered by the
// `RulesCard` rows on the detail page.

const FULL_WEEKDAYS: Record<string, string> = {
    Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday",
    Fri: "Friday", Sat: "Saturday", Sun: "Sunday",
};

/** Format an ISO date "2026-04-20" as "20 April 2026". */
function formatISODate(iso: string): string {
    if (!iso) return "";
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!m) return iso;
    const months = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    const year = m[1], monthIdx = Number(m[2]) - 1, day = Number(m[3]);
    return `${day} ${months[monthIdx] ?? ""} ${year}`;
}

/** Format an ISO timestamp as "Sun, 28 Feb 2025". */
function formatCreatedAtISO(iso: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function buildMembershipVM(m: Membership, tierName: string): MembershipDetailVM {
    return {
        kind: "membership",
        kindLabel: "Membership",
        productNoun: "membership",
        name: m.name,
        description: m.description,
        welcomeMessage: m.welcome_message ?? "",
        priceAed: m.price_aed,
        creditsLabel: formatCredits(m.credits),
        durationLabel: formatDuration(m.duration_months),
        branchIds: m.branch_ids,
        createdAt: m.created_at ? formatCreatedAtISO(m.created_at) : placeholderCreatedAt(m.id),
        unlimitedCredits: m.credits === "unlimited",
        multiLocation: m.branch_ids.length !== 1,
        autoRenew: m.auto_renew ?? false,
        activeOnFirstUse: m.active_on_first_use ?? false,
        isIntroOffer: false,
        purchaseRules: m.purchase_rules ?? null,
        specificMembershipTierName: tierName,
    };
}

function buildPackageVM(p: Package, tierName: string): MembershipDetailVM {
    return {
        kind: "package",
        kindLabel: "Package",
        productNoun: "credit package",
        name: p.name,
        description: p.description,
        welcomeMessage: p.welcome_message ?? "",
        priceAed: p.price_aed,
        creditsLabel: formatCredits(p.credits),
        durationLabel: formatValidity(p.validity_days),
        branchIds: p.branch_ids,
        createdAt: p.created_at ? formatCreatedAtISO(p.created_at) : placeholderCreatedAt(p.id),
        unlimitedCredits: false,
        multiLocation: p.branch_ids.length !== 1,
        autoRenew: false,
        activeOnFirstUse: false,
        isIntroOffer: p.is_intro_offer ?? false,
        purchaseRules: p.purchase_rules ?? null,
        specificMembershipTierName: tierName,
    };
}

// ─── Page ───────────────────────────────────────────────────────────────────

function ProductDetailPageInner() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams<{ id: string }>();
    const id = params?.id ?? "";
    const searchParams = useSearchParams();
    const returnTo = searchParams.get("returnTo") ?? "/admin/products";

    const memberships         = useAppStore(s => s.memberships);
    const packages            = useAppStore(s => s.packages);
    const customers           = useAppStore(s => s.customers);
    const branches            = useAppStore(s => s.branches);
    const setMembershipStatus = useAppStore(s => s.setMembershipStatus);
    const setPackageStatus    = useAppStore(s => s.setPackageStatus);
    const deleteMembership    = useAppStore(s => s.deleteMembership);
    const deletePackage       = useAppStore(s => s.deletePackage);
    const showToast           = useAppStore(s => s.showToast);

    const membership = memberships.find(m => m.id === id) ?? null;
    const pkg = membership ? null : (packages.find(p => p.id === id) ?? null);
    const kind: ProductKind | null = membership ? "membership" : pkg ? "package" : null;
    const product = membership ?? pkg;

    const [confirmAction, setConfirmAction] = useState<ModalAction | null>(null);

    const activeCustomers = useMemo(() => {
        if (!product) return [];
        if (kind === "membership") {
            return customers.filter(c => c.planKind === "membership" && c.membershipId === id);
        }
        return customers.filter(c => c.planKind === "package" && (c.packageIds ?? []).includes(id));
    }, [customers, product, kind, id]);

    if (!product || !kind) {
        return (
            <div className="h-screen bg-white flex flex-col items-center justify-center">
                <p className="text-[18px] font-semibold text-[#101828]">Product not found</p>
                <button type="button" onClick={() => router.push(returnTo)}
                    className="mt-4 text-[14px] text-[#658774] hover:underline">
                    Back to memberships &amp; packages
                </button>
            </div>
        );
    }

    // Resolve the package's specific-membership-tier name from the live
    // store so a tier rename / archive ripples through to the details view.
    const tierMembershipId = product.purchase_rules?.eligibility.specificMembershipTier.membershipId ?? "";
    const tierName = tierMembershipId
        ? (memberships.find(m => m.id === tierMembershipId)?.name ?? "")
        : "";

    const vm = kind === "membership"
        ? buildMembershipVM(product as Membership, tierName)
        : buildPackageVM(product as Package, tierName);

    /** "Exp./Renewal" date for a customer holding this product — their join
     *  date plus the plan's duration (membership months / package days). */
    function renewalDate(customer: Customer): string {
        const d = new Date(customer.createdAt);
        if (Number.isNaN(d.getTime())) return "—";
        if (kind === "membership") {
            d.setMonth(d.getMonth() + (product as Membership).duration_months);
        } else {
            d.setDate(d.getDate() + (product as Package).validity_days);
        }
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function handleAction(a: "edit" | ModalAction) {
        if (a === "edit") {
            router.push(`/products/${id}/edit?returnTo=${encodeURIComponent(pathname)}`);
            return;
        }
        setConfirmAction(a);
    }

    function handleConfirm() {
        if (!confirmAction || !product) return;
        const name = vm.name;
        if (confirmAction === "archive") {
            if (kind === "membership") setMembershipStatus([id], "archived");
            else                       setPackageStatus([id], "archived");
            showToast("Product archived", `${name} has been archived.`, "success", "archive");
            setConfirmAction(null);
        } else if (confirmAction === "deactivate") {
            if (kind === "membership") setMembershipStatus([id], "inactive");
            else                       setPackageStatus([id], "inactive");
            showToast("Product deactivated", `${name} has been deactivated.`, "error", "slash");
            setConfirmAction(null);
        } else if (confirmAction === "recover") {
            if (kind === "membership") setMembershipStatus([id], "active");
            else                       setPackageStatus([id], "active");
            showToast("Product recovered", `${name} has been recovered and is now active.`, "success", "refresh");
            setConfirmAction(null);
        } else if (confirmAction === "reactivate") {
            if (kind === "membership") setMembershipStatus([id], "active");
            else                       setPackageStatus([id], "active");
            showToast("Product reactivated", `${name} is now active again.`, "success", "check");
            setConfirmAction(null);
        } else if (confirmAction === "delete") {
            const ok = kind === "membership" ? deleteMembership(id) : deletePackage(id);
            if (ok) {
                showToast("Product deleted", `${name} has been deleted.`, "success", "trash");
                setConfirmAction(null);
                router.push(returnTo);
            } else {
                showToast(
                    "Cannot delete",
                    `${name} is still held by customers. Archive it instead.`,
                    "error", "slash",
                );
                setConfirmAction(null);
            }
        }
    }

    const headerTitle = kind === "membership" ? "Membership details" : "Credit package details";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as class-types/[id] */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{headerTitle}</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* Body — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={
                    <LeftSidebar
                        kind={kind}
                        name={vm.name}
                        priceAed={vm.priceAed}
                        creditsLabel={vm.creditsLabel}
                        durationLabel={vm.durationLabel}
                        customerCount={activeCustomers.length}
                        status={product.status}
                        onAction={handleAction}
                    />
                }
                main={<RightPanel kind={kind} vm={vm} productId={id} activeCustomers={activeCustomers} renewalFor={renewalDate} branches={branches} />}
            />

            {confirmAction && (() => {
                const cfg = MODAL_CONFIG[confirmAction];
                return (
                    <ConfirmModal
                        open={true}
                        onClose={() => setConfirmAction(null)}
                        icon={cfg.IconComp}
                        tone={MODAL_TONE[confirmAction]}
                        title={cfg.title}
                        description={cfg.description}
                        confirmLabel={cfg.confirmLabel}
                        onConfirm={handleConfirm}
                    />
                );
            })()}
            <Toast />
        </div>
    );
}

export default function ProductDetailPage() {
    return (
        <Suspense fallback={null}>
            <ProductDetailPageInner />
        </Suspense>
    );
}
