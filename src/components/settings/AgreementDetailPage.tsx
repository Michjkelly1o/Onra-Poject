"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Agreement detail page (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Mirrors the canonical detail-page chrome already shipped by the membership
// (/products/[id]) and class-types/[id] modules so every detail page in the
// dashboard shares the same shell:
//   • 72px top header (XClose + page title)
//   • h-[832px] two-column frame inside px-6 py-6 outer padding
//   • 320px left sidebar — PatternBanner (radial mask, -32.1° outer +
//     -12.5° per square, opacity-40) with the StatusBadge floating
//     absolute top-right + 3 info fields + actions section
//   • Right panel: tabs h-[48px] px-3 gap-1 underline, then DetailsTab or
//     VersionsTab body
//
// Figma references:
//   • Overall layout                 — 4209-150012
//   • Agreement details tab content  — 4209-150030
//   • Agreement version tab content  — 4209-154039
//   • View-content modal             — 4209-156334

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    XClose, Plus, Edit02, Archive, Eye, Send03, File06, File02,
    Calendar, ChevronUp, ChevronDown, ChevronLeft, Check, RefreshCcw01, SearchLg,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { ConfirmModal } from "@/components/modals/ConfirmModal";
import { DetailPageShell } from "@/components/patterns/DetailPageShell";
import {
    useAppStore,
    type Agreement, type AgreementStatus, type AgreementVersion,
} from "@/lib/store";
import { AgreementContentModal } from "./AgreementContentModal";
import { SortableHeader, useSort } from "@/components/ui/SortableHeader";
import { StatusBadge } from "@/components/patterns/StatusBadge";
import { RowActions } from "@/components/patterns/RowActions";

// ─── Display helpers ─────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function formatDateShort(iso: string): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function scopeLabel(a: Agreement): string {
    if (a.allLocations || a.locationIds.length > 1) return "Multi-branch";
    return "Specific branch";
}

// ─── Disabled-state checkbox (matches membership "details" branch rows) ─────

function DisabledCheckbox({ checked }: { checked: boolean }) {
    return (
        <div className="w-4 h-4 rounded-[4px] border bg-[#f9fafb] border-[#d0d5dd] flex items-center justify-center shrink-0">
            {checked && <Check className="w-[10px] h-[10px] text-[#d0d5dd]" />}
        </div>
    );
}

// ─── PatternBanner (Figma 5773:212229 — concentric tilted squares) ──────────
//
// Pure-CSS adaptation of the Figma `Background pattern decorative` — six
// concentric rounded squares, each rotated -12.5° inside a -32.1° outer
// wrapper, soft-masked into the centre. Mirrors the membership detail
// PatternBanner exactly so all detail pages share the same banner art.

function PatternBanner() {
    return (
        <div className="relative h-[155px] w-full overflow-hidden bg-[#f9fafb] shrink-0">
            {/* Background pattern — concentric rounded squares, tilted. */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-40">
                <div className="size-[560px] flex items-center justify-center" style={{ transform: "rotate(-32.1deg)" }}>
                    <div className="relative size-[560px]"
                        style={{
                            WebkitMaskImage: "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                            maskImage:        "radial-gradient(circle at center, black 0%, black 30%, transparent 70%)",
                        }}>
                        {[160, 240, 320, 400, 480, 560].map(sz => (
                            <div key={sz}
                                className="absolute left-1/2 top-1/2 rounded-[20px]"
                                style={{
                                    width: sz, height: sz,
                                    transform: "translate(-50%, -50%) rotate(-12.5deg)",
                                    border: "1.667px solid #d5d9eb",
                                }}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Glossy 72px icon avatar */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className={cn(
                    "relative w-[72px] h-[72px] rounded-[16px] border-[2.65px] border-white/[0.12] flex items-center justify-center bg-[#eaecf5]",
                    "shadow-[0px_3.49px_3.49px_rgba(0,0,0,0.04),-6.98px_10.47px_20.94px_rgba(224,248,164,0.08),10.47px_10.47px_20.94px_rgba(224,248,164,0.06),0px_3.49px_20.94px_rgba(224,248,164,0.12)]",
                    "backdrop-blur-[8.7px]",
                )}>
                    <File06 className="w-[42px] h-[42px] text-[#475467]" />
                    <div className="absolute inset-0 rounded-[16px] pointer-events-none shadow-[inset_2.5px_2.5px_3.3px_rgba(255,255,255,0.2)]" />
                </div>
            </div>
        </div>
    );
}

// ─── Action button — used in the side card's "Agreement actions" group ─────

function SideAction({ icon, label, danger = false, onClick }: {
    icon: React.ReactNode;
    label: string;
    danger?: boolean;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "flex items-center gap-2 w-full text-left text-[16px] font-semibold transition-colors",
                danger ? "text-[#b42318] hover:text-[#912018]" : "text-[#475467] hover:text-[#101828]",
            )}>
            {icon}
            {label}
        </button>
    );
}

// ─── LeftSidebar (mirrors membership LeftSidebar exactly) ────────────────────

function LeftSidebar({ agreement, onAddVersion, onEdit, onArchive, onRecover }: {
    agreement: Agreement;
    onAddVersion: () => void;
    onEdit: () => void;
    onArchive: () => void;
    onRecover: () => void;
}) {
    const actions = (() => {
        if (agreement.status === "archived") {
            return (
                <SideAction icon={<RefreshCcw01 className="w-5 h-5" />} label="Recover agreement" onClick={onRecover} />
            );
        }
        return (
            <>
                <SideAction icon={<Plus className="w-5 h-5" />} label="Add new version" onClick={onAddVersion} />
                <SideAction icon={<Edit02 className="w-5 h-5" />} label="Edit agreement" onClick={onEdit} />
                <SideAction icon={<Archive className="w-5 h-5" />} label="Archive agreement" onClick={onArchive} />
            </>
        );
    })();

    return (
        <div className="w-[320px] shrink-0 bg-white border border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden h-full">
            {/* Banner with floating status badge top-right */}
            <div className="relative shrink-0">
                <PatternBanner />
                <div className="absolute top-3 right-3">
                    <StatusBadge type="agreement" status={agreement.status} size="lg" />
                </div>
            </div>

            <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                <div className="flex flex-col gap-5 px-6 pt-5 pb-6 flex-1">
                    <h2 className="font-semibold text-[20px] leading-[30px] text-[#101828]">{agreement.name}</h2>

                    <div className="flex flex-col gap-3">
                        <SidebarField label="Current version" value={`Version ${agreement.currentVersion}`} />
                        <SidebarField label="Type" value={scopeLabel(agreement)} />
                        <SidebarField label="Effective until" value={formatDateLong(agreement.effectiveUntil)} />
                    </div>
                </div>

                <div className="px-6 pb-6 shrink-0">
                    <div className="h-px w-full bg-[#e4e7ec] mb-5" />
                    <p className="text-[14px] text-[#667085] mb-4">Agreement actions</p>
                    <div className="flex flex-col gap-4">{actions}</div>
                </div>
            </div>
        </div>
    );
}

function SidebarField({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex flex-col gap-1">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <p className="text-[16px] font-medium text-[#101828]">{value}</p>
        </div>
    );
}

// ─── Shared section + cards (mirrors membership detail helpers) ─────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[14px] text-[#667085] mt-2 first:mt-0">{children}</p>
    );
}

function DescriptionCard({ label, body }: { label: string; body: string }) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-2 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <p className="text-[14px] text-[#667085] leading-5">{label}</p>
            <p className="text-[16px] text-[#101828] leading-6 whitespace-pre-line">{body}</p>
        </div>
    );
}

function InlineStatRow({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-2 gap-4">{children}</div>;
}

function InlineStat({ icon, label, value }: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shrink-0 text-[#475467]">
                {icon}
            </div>
            <div className="flex flex-col min-w-0">
                <p className="text-[14px] text-[#667085] leading-5">{label}</p>
                <p className="text-[16px] font-medium text-[#101828] leading-6 truncate">{value}</p>
            </div>
        </div>
    );
}

// ─── ServicesCard accordion (mirrors membership BranchesCard) ───────────────

function ServicesCard({ serviceList, totalSelected }: {
    serviceList: { branchName: string; services: { id: string; name: string }[] }[];
    totalSelected: number;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-3 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">Applicable service &amp; branch</p>
                    <p className="text-[14px] text-[#667085] leading-5">The agreement can be use on multiple services</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {totalSelected} selected
                </span>
                <button type="button" onClick={() => setOpen(p => !p)}
                    aria-label={open ? "Collapse" : "Expand"}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0 hover:text-[#344054] transition-colors">
                    {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>
            {open && (
                <div className="flex flex-col gap-3">
                    {serviceList.length === 0 ? (
                        <p className="text-[14px] text-[#667085]">No services selected.</p>
                    ) : serviceList.map(g => (
                        <div key={g.branchName} className="flex flex-col gap-3">
                            <p className="text-[12px] text-[#667085] leading-[18px]">{g.branchName}</p>
                            {g.services.map(s => (
                                <div key={s.id} className="flex items-center gap-2">
                                    <DisabledCheckbox checked />
                                    <span className="text-[14px] font-medium text-[#101828]">{s.name}</span>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── DetailsTab (mirrors membership DetailsTab layout) ──────────────────────

function DetailsTab({ agreement, serviceList }: {
    agreement: Agreement;
    serviceList: { branchName: string; services: { id: string; name: string }[] }[];
}) {
    const totalSelected = serviceList.reduce((sum, g) => sum + g.services.length, 0);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide px-6 py-6 flex flex-col gap-6">
            <SectionHeading>Basic information</SectionHeading>
            <DescriptionCard label="Description" body={agreement.description || "—"} />

            <SectionHeading>Rule</SectionHeading>
            <InlineStatRow>
                <InlineStat
                    icon={<File02 className="w-4 h-4" />}
                    label="Agreement type"
                    value={scopeLabel(agreement)}
                />
                <InlineStat
                    icon={<Calendar className="w-4 h-4" />}
                    label="Effective until"
                    value={formatDateLong(agreement.effectiveUntil)}
                />
            </InlineStatRow>

            <ServicesCard serviceList={serviceList} totalSelected={totalSelected} />
        </div>
    );
}

// ─── VersionsTab (Figma 4209-154039) ────────────────────────────────────────

function VersionsTab({ agreement, versions, onView, onRepublish }: {
    agreement: Agreement;
    versions: AgreementVersion[];
    onView: (v: AgreementVersion) => void;
    onRepublish: (v: AgreementVersion) => void;
}) {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return versions
            .filter(v => q === "" || `version ${v.versionNumber}`.includes(q))
            .sort((a, b) => b.versionNumber - a.versionNumber);
    }, [versions, search]);

    // ── Version sort — Version number / Status (current vs. archived,
    //    derived from agreement.currentVersion). ──
    const { sorted: sortedRows, sortKey, sortDir, toggle: toggleSort } = useSort<AgreementVersion>(filtered, {
        version: (a, b) => a.versionNumber - b.versionNumber,
        status:  (a, b) => {
            const aCur = a.versionNumber === agreement.currentVersion ? 0 : 1;
            const bCur = b.versionNumber === agreement.currentVersion ? 0 : 1;
            return aCur - bCur;
        },
    });

    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const clampedPage = Math.min(Math.max(1, page), totalPages);
    const pagedRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

    return (
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col">
            {/* Toolbar */}
            <div className="shrink-0 px-6 pt-6 pb-3 flex items-center justify-between gap-3">
                <div className="flex flex-col">
                    <p className="text-[14px] text-[#667085]">Total</p>
                    <p className="text-[14px] font-medium text-[#101828]">
                        {filtered.length} Version
                    </p>
                </div>
                <div className="relative w-[220px]">
                    <SearchLg className="absolute left-[12px] top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#667085]" />
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search version..."
                        className="h-10 w-full pl-[40px] pr-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 px-6">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-[#e4e7ec]">
                            <th className="py-3 pr-3 text-left text-[12px] font-medium text-[#475467]">
                                <SortableHeader sortKey="version" currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Version</SortableHeader>
                            </th>
                            <th className="py-3 pr-3 text-center text-[12px] font-medium text-[#475467] w-[140px]">
                                <SortableHeader sortKey="status"  currentSort={sortKey} dir={sortDir} onSort={toggleSort}>Status</SortableHeader>
                            </th>
                            <th className="py-3 pr-3 w-[52px]" />
                        </tr>
                    </thead>
                    <tbody>
                        {pagedRows.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="py-10 text-center text-[14px] text-[#667085]">
                                    {versions.length === 0 ? "No versions yet." : "No versions match your search."}
                                </td>
                            </tr>
                        ) : pagedRows.map(v => {
                            const isCurrent = v.versionNumber === agreement.currentVersion;
                            return (
                                <tr key={v.id}
                                    onClick={() => onView(v)}
                                    className="transition-colors border-b border-[#f2f4f7] hover:bg-[#f9fafb] cursor-pointer">
                                    <td className="py-4 pr-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#f2f4f7] flex items-center justify-center shrink-0 relative">
                                                <File06 className="w-5 h-5 text-[#475467]" />
                                                <div className="absolute inset-0 rounded-full border-[0.75px] border-black/[0.08] pointer-events-none" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[14px] font-medium text-[#101828]">Version {v.versionNumber}</span>
                                                <span className="text-[14px] text-[#667085]">Added on {formatDateShort(v.publishedAt)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 pr-3 text-center">
                                        <StatusBadge type="version" status={isCurrent ? "active" : "archived"} size="lg" />
                                    </td>
                                    <td onClick={e => e.stopPropagation()} className="py-4 pr-3">
                                        <div className="flex justify-end">
                                            <RowActions
                                                items={[
                                                    { label: "View", icon: Eye, onClick: () => onView(v) },
                                                    { label: "Republish agreement", icon: Send03, onClick: () => onRepublish(v), hidden: !isCurrent },
                                                ]}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="shrink-0 px-6">
                <VersionPagination
                    page={clampedPage}
                    total={sortedRows.length}
                    pageSize={pageSize}
                    onPage={setPage}
                    onPageSize={s => { setPageSize(s); setPage(1); }}
                />
            </div>
        </div>
    );
}

function VersionPagination({ page, total, pageSize, onPage, onPageSize }: {
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
                <span className="text-[14px] font-medium text-[#344054] whitespace-nowrap">Page {page} of {totalPages}</span>
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

// ─── Right panel (mirrors membership RightPanel — h-[48px] tabs) ────────────

type TabId = "details" | "versions";

function RightPanel({ agreement, versions, serviceList, onView, onRepublish }: {
    agreement: Agreement;
    versions: AgreementVersion[];
    serviceList: { branchName: string; services: { id: string; name: string }[] }[];
    onView: (v: AgreementVersion) => void;
    onRepublish: (v: AgreementVersion) => void;
}) {
    const [tab, setTab] = useState<TabId>("details");
    const TABS: { id: TabId; label: string }[] = [
        { id: "details",  label: "Agreement details" },
        { id: "versions", label: "Agreement version" },
    ];

    return (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border border-[#e4e7ec] rounded-[20px]">
            {/* Tabs row — same h-[48px] underline pattern as membership detail */}
            <div className="shrink-0 border-b border-[#e4e7ec] px-6 pt-6">
                <div className="flex gap-1">
                    {TABS.map(t => (
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
                <DetailsTab agreement={agreement} serviceList={serviceList} />
            ) : (
                <VersionsTab
                    agreement={agreement}
                    versions={versions}
                    onView={onView}
                    onRepublish={onRepublish}
                />
            )}
        </div>
    );
}

// ─── Archive / Recover confirmation modal ───────────────────────────────────

// Local ConfirmModal removed — call sites use the canonical
// `<ConfirmModal>` from `@/components/modals/ConfirmModal`.

// ─── Page ───────────────────────────────────────────────────────────────────

export function AgreementDetailPage({ agreementId, returnTo = "/admin/settings/agreements" }: { agreementId: string; returnTo?: string }) {
    const router = useRouter();
    const pathname = usePathname();

    const agreement = useAppStore(s => s.agreements.find(a => a.id === agreementId));
    const allVersions = useAppStore(s => s.agreementVersions);
    const branches = useAppStore(s => s.branches);
    const classTemplates = useAppStore(s => s.classTemplates);
    const setAgreementsStatus = useAppStore(s => s.setAgreementsStatus);
    const republishAgreementVersion = useAppStore(s => s.republishAgreementVersion);
    const showToast = useAppStore(s => s.showToast);

    const [viewVersion, setViewVersion] = useState<AgreementVersion | null>(null);
    const [confirm, setConfirm] = useState<"archive" | "recover" | null>(null);

    useEffect(() => {
        if (!agreement) router.replace(returnTo);
    }, [agreement, router]);

    const versions = useMemo(
        () => allVersions.filter(v => v.agreementId === agreementId),
        [allVersions, agreementId],
    );

    const serviceList = useMemo(() => {
        if (!agreement) return [];
        const branchNameById = new Map(branches.map(b => [b.id, b.name]));
        const activeTemplates = classTemplates.filter(t => t.status === "Active");
        const includeAll = agreement.applicableClassTemplateIds.length === 0;
        const chosenIds = new Set(agreement.applicableClassTemplateIds);

        const groups: { branchName: string; services: { id: string; name: string }[] }[] = [];
        for (const b of branches.filter(b => b.status === "active")) {
            const items: { id: string; name: string }[] = [];
            for (const t of activeTemplates) {
                const tBranchIds = (t as { branch_ids?: string[] }).branch_ids;
                const inBranch = tBranchIds && tBranchIds.length > 0
                    ? tBranchIds.includes(b.id)
                    : true;
                if (!inBranch) continue;
                if (!includeAll && !chosenIds.has(t.id)) continue;
                items.push({ id: t.id, name: t.name });
            }
            if (items.length > 0) {
                groups.push({ branchName: branchNameById.get(b.id) ?? b.id, services: items });
            }
        }
        return groups;
    }, [agreement, branches, classTemplates]);

    if (!agreement) return null;

    function handleClose() {
        router.push(returnTo);
    }
    function handleAddVersion() {
        router.push(`/settings/agreements/${agreementId}/new-version?returnTo=${encodeURIComponent(pathname)}`);
    }
    function handleEdit() {
        router.push(`/settings/agreements/${agreementId}/edit?returnTo=${encodeURIComponent(pathname)}`);
    }
    function handleArchiveConfirmed() {
        if (!agreement) return;
        setAgreementsStatus([agreement.id], "archived");
        showToast(
            "Agreement archived",
            `${agreement.name} has been archived.`,
            "success", "archive",
        );
        setConfirm(null);
        // Stay on the detail page — the row's status flips and the sidebar
        // actions auto-swap to "Recover agreement" (parity with how the
        // membership / staff detail pages handle archive in-place).
    }
    function handleRecoverConfirmed() {
        if (!agreement) return;
        setAgreementsStatus([agreement.id], "active");
        showToast(
            "Agreement recovered",
            `${agreement.name} has been recovered.`,
            "success", "refresh",
        );
        setConfirm(null);
    }
    function handleRepublish(v: AgreementVersion) {
        // Phase 4 cross-module sync: flip every signed customer_agreements
        // row for this exact (agreementId, versionNumber) back to "unsigned"
        // so customers must re-sign on the customer side. Older versions
        // stay signed (historical record).
        republishAgreementVersion(v.agreementId, v.versionNumber);
        showToast(
            "Agreement has been republish",
            "Agreement has been republish to the customer.",
            "success", "check",
        );
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header — same 72px chrome as membership detail */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                    Agreement details
                </h1>
            </div>

            {/* Body — canonical DetailPageShell wraps the 832px frame. */}
            <DetailPageShell
                sidebar={
                    <LeftSidebar
                        agreement={agreement}
                        onAddVersion={handleAddVersion}
                        onEdit={handleEdit}
                        onArchive={() => setConfirm("archive")}
                        onRecover={() => setConfirm("recover")}
                    />
                }
                main={
                    <RightPanel
                        agreement={agreement}
                        versions={versions}
                        serviceList={serviceList}
                        onView={setViewVersion}
                        onRepublish={handleRepublish}
                    />
                }
            />

            <AgreementContentModal
                version={viewVersion}
                agreementName={agreement.name}
                versionLabel={viewVersion ? `Version ${viewVersion.versionNumber}` : undefined}
                onClose={() => setViewVersion(null)}
            />

            {confirm && (() => {
                const isArchive = confirm === "archive";
                return (
                    <ConfirmModal
                        open
                        onClose={() => setConfirm(null)}
                        icon={isArchive ? Archive : RefreshCcw01}
                        tone="success"
                        title={isArchive ? "Archive this agreement?" : "Recover this agreement?"}
                        description={
                            <>
                                <span className="font-medium text-[#344054]">{agreement.name}</span>
                                {isArchive
                                    ? " will be hidden from the default list. All signed records and version history are preserved — you can recover archived agreements at any time."
                                    : " will be restored to Active status and shown in the agreements list again."}
                            </>
                        }
                        confirmLabel={isArchive ? "Archive" : "Recover"}
                        onConfirm={isArchive ? handleArchiveConfirmed : handleRecoverConfirmed}
                    />
                );
            })()}

            {/* The /settings/* route lives outside the admin layout, which
                normally mounts the Toast. Mount it directly here so
                Republish / Archive / Recover toasts surface on this page. */}
            <Toast />
        </div>
    );
}
