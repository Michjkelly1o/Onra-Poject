"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Agreement create / edit wizard (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma references:
//   • Outer chrome (header + steps)        — 4205-125208
//   • Step 1: Basic information            — 4205-125233
//   • Step 2: Rules                        — 4209-152920
//   • Step 3: Agreement (write text)       — 4983-113037
//   • Step 3: Agreement (upload file)      — 4984-116659
//
// Brief §2 logic:
//   • Issue date is locked to TODAY on create (matches the brief's
//     "we only can set the issued date on live date").
//   • Expiry date cannot be in the past (DatePicker's minDate = today).
//   • Edit mode = Steps 1 + 2 only (no content step — content versions
//     live under the Phase 3 "Add new version" flow).
//
// Reused patterns (no re-invention):
//   • StepItem / FormCard / FormField / Section — ProductFormPage
//   • SelectInput / DatePicker / RichTextEditor — existing shared comps
//   • Toggle (the 44×24 large variant) — tax page top-of-page toggle
//   • LocationSelect (multi-branch chooser) — ApplyTaxRatesView (FixedDropdown)
//   • FixedDropdown — portal-positioned menu (prevents form-card clip)

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    XClose, Check, MarkerPin01, ChevronDown, ChevronUp, Lightbulb02,
    UploadCloud02, Trash01, File02, FilterLines,
    RefreshCcw01, Calendar,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { DatePicker, todayISO } from "@/components/ui/DatePicker";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { FixedDropdown } from "@/components/ui/FixedDropdown";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
    useAppStore,
    type Agreement, type AgreementContentType,
} from "@/lib/store";

// ─── Steps ──────────────────────────────────────────────────────────────────

const STEPS_CREATE = [
    { n: 1, label: "Basic information" },
    { n: 2, label: "Rule" },
    { n: 3, label: "Agreement" },
];

// Edit mode skips Step 3 (content lives on agreement_versions — Phase 3's
// "Add new version" flow handles republishing).
const STEPS_EDIT = [
    { n: 1, label: "Basic information" },
    { n: 2, label: "Rule" },
];

// ─── Step sidebar item (mirrors ProductFormPage) ────────────────────────────

function StepItem({ step, current, isLast }: {
    step: { n: number; label: string };
    current: number;
    isLast: boolean;
}) {
    const active   = step.n === current;
    const complete = step.n < current;

    return (
        <div className={cn(
            "flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full",
            active && "bg-[#f5fffa]",
        )}>
            <div className="relative flex flex-col items-center shrink-0">
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium",
                    active
                        ? "bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]"
                        : complete
                            ? "bg-[#658774] text-white"
                            : "bg-[#f2f4f7] border-1 border-[#e4e7ec] text-[#98a2b3]",
                )}>
                    {complete ? <Check className="w-3 h-3" /> : step.n}
                </div>
                {!isLast && (
                    <div className="absolute top-[24px] left-[11px] w-[2px] h-[40px] bg-[#e4e7ec] rounded-[2px]" />
                )}
            </div>
            <span className={cn(
                "text-[14px]",
                active
                    ? "font-semibold text-[#3b5446]"
                    : complete
                        ? "font-medium text-[#344054]"
                        : "font-medium text-[#667085]",
            )}>
                {step.label}
            </span>
        </div>
    );
}

// ─── Form chrome (FormCard / Section / FormField / TextInput / Textarea) ────

function FormCard({ title, children, footer }: {
    title?: string;
    children: React.ReactNode;
    footer: React.ReactNode;
}) {
    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                {title && (
                    <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h2>
                )}
                {children}
            </div>
            <div className="shrink-0 px-6 pb-6 pt-6 flex items-center w-full">{footer}</div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-4 w-full">
            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">{title}</h3>
            <div className="flex flex-col gap-4 w-full">{children}</div>
        </div>
    );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label className="text-[14px] font-medium text-[#344054]">{label}</label>
            {children}
        </div>
    );
}

const INPUT_CLS = "h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white";

function TextInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={INPUT_CLS}
        />
    );
}

function Textarea({ value, onChange, placeholder, minHeight = 120 }: {
    value: string; onChange: (v: string) => void; placeholder?: string; minHeight?: number;
}) {
    return (
        <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            style={{ minHeight }}
            className="w-full px-[14px] py-3 border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white resize-y leading-6"
        />
    );
}

// ─── Toggle 44×24 (Figma 5405:39842 — same as tax page top-of-page) ─────────

function LargeToggle({ on, onChange, ariaLabel }: {
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

// ─── Effective date mode + Toggle card (v24) ────────────────────────────────

/** Radio card for the "Ongoing" / "Set an expiry date" choice in Step
 *  2. Selected state paints the card border sage green + shows a sage
 *  radio dot; unselected shows a subtle gray border + hollow ring. */
function EffectiveDateModeCard({ selected, title, subtitle, icon, onSelect }: {
    selected: boolean;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "text-left rounded-[12px] border-1 p-4 flex items-start gap-3 transition-colors bg-white",
                selected
                    ? "border-[#7ba08c]"
                    : "border-[#e4e7ec] hover:border-[#d0d5dd]",
            )}
        >
            <div className="shrink-0 w-9 h-9 rounded-[8px] bg-[#f5fffa] flex items-center justify-center">
                {icon}
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <div className={cn(
                "w-4 h-4 rounded-full border-1 flex items-center justify-center shrink-0 mt-0.5",
                selected ? "border-[#658774] bg-[#658774]" : "border-[#d0d5dd] bg-white",
            )}>
                {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
        </button>
    );
}

/** Toggle card for the Re-acceptance + Minors sections in Step 2. Same
 *  visual pattern as the Referral module's Eligibility toggle cards —
 *  sage border when on, gray when off, right-aligned pill switch. */
function ToggleCard({ title, subtitle, on, onChange, ariaLabel }: {
    title: string;
    subtitle: string;
    on: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
}) {
    return (
        <div className={cn(
            "rounded-[12px] border-1 px-4 py-3 flex items-start gap-4 bg-white transition-colors",
            on ? "border-[#7ba08c]" : "border-[#e4e7ec]",
        )}>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
                <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{title}</p>
                <p className="text-[14px] text-[#667085] leading-[20px]">{subtitle}</p>
            </div>
            <LargeToggle on={on} onChange={onChange} ariaLabel={ariaLabel} />
        </div>
    );
}

// ─── FilledCheckbox + MultiSelectCard pattern ───────────────────────────────
//
// Lifted from PromoFormPage's expandable multi-select pattern. Used by:
//   • "Multi-branch locations" → ON state (replaces a single-line picker)
//   • "Applicable services"   → always
//
// Both consume the same `MultiSelectCard` shape — title, subtitle,
// options[{id, label, sublabel?, group?}], selected[], onChange. The card
// expands inline (no portal), with Select all + filter dropdown +
// optional group headers + per-row checkbox grid.

function FilledCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button type="button" onClick={onChange}
            className={cn(
                "w-4 h-4 rounded-[4px] flex items-center justify-center shrink-0 transition-colors border",
                checked ? "bg-[#658774] border-[#658774]" : "bg-white border-[#d0d5dd] hover:border-[#658774]",
            )}>
            {checked && <Check className="w-[10px] h-[10px] text-white" />}
        </button>
    );
}

interface MultiOption { id: string; label: string; sublabel?: string; group?: string }
type RowFilter = "all" | "enabled" | "disabled";

function RowFilterDropdown({ active, onChange }: {
    active: RowFilter; onChange: (f: RowFilter) => void;
}) {
    const [open, setOpen] = useState(false);
    const OPTIONS: { value: RowFilter; label: string }[] = [
        { value: "all",      label: "All" },
        { value: "enabled",  label: "Only enabled" },
        { value: "disabled", label: "Only disabled" },
    ];
    const btnRef = useRef<HTMLButtonElement>(null);
    return (
        <div className="shrink-0">
            <button ref={btnRef} type="button" onClick={() => setOpen(p => !p)}
                className="flex items-center gap-1.5 h-9 px-3 border-1 border-[#d0d5dd] rounded-[8px] text-[14px] font-semibold text-[#344054] bg-white hover:bg-[#f9fafb] transition-colors shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                <div className="relative">
                    <FilterLines className="w-4 h-4" />
                    {active !== "all" && (
                        <span className="absolute -top-[3px] -right-[3px] w-[7px] h-[7px] rounded-full bg-[#47b881] border-1 border-white" />
                    )}
                </div>
                Filter
            </button>
            <FixedDropdown triggerRef={btnRef} open={open} onClose={() => setOpen(false)} minWidth={180}>
                {OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                        onClick={() => { onChange(opt.value); setOpen(false); }}
                        className={cn(
                            "flex items-center w-full px-3 py-2 text-[14px] font-medium transition-colors text-left",
                            active === opt.value ? "bg-[#f9fafb] text-[#101828]" : "text-[#344054] hover:bg-[#f9fafb]",
                        )}>
                        {opt.label}
                    </button>
                ))}
            </FixedDropdown>
        </div>
    );
}

function MultiSelectCard({ title, subtitle, options, selected, onChange }: {
    title: string; subtitle: string;
    options: MultiOption[];
    selected: string[];
    onChange: (ids: string[]) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const [filter, setFilter] = useState<RowFilter>("all");

    // "enabled" = checked rows, "disabled" = unchecked rows.
    const visibleOptions = options.filter(o => {
        if (filter === "enabled")  return selected.includes(o.id);
        if (filter === "disabled") return !selected.includes(o.id);
        return true;
    });
    const visibleIds = visibleOptions.map(o => o.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.includes(id));

    function toggleOne(id: string) {
        onChange(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id]);
    }
    function toggleAll() {
        if (allVisibleSelected) {
            onChange(selected.filter(id => !visibleIds.includes(id)));
        } else {
            const merged = selected.slice();
            for (const id of visibleIds) if (!merged.includes(id)) merged.push(id);
            onChange(merged);
        }
    }

    // Group rows under their `group` label (ungrouped rows render first).
    const groups = Array.from(new Set(visibleOptions.map(o => o.group ?? "")));

    return (
        <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
            <div className="flex items-center gap-4">
                <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-[#101828] leading-5">{title}</p>
                    <p className="text-[14px] text-[#6e776f] leading-5 truncate">{subtitle}</p>
                </div>
                <span className="inline-flex items-center px-2 py-[2px] rounded-full text-[12px] font-medium bg-[#f9fafb] border-1 border-[#e4e7ec] text-[#344054] shrink-0">
                    {selected.length} selected
                </span>
                <button type="button" onClick={() => setExpanded(p => !p)}
                    className="w-5 h-5 flex items-center justify-center text-[#667085] shrink-0">
                    {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
            </div>

            {expanded && (
                <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                        <FilledCheckbox checked={allVisibleSelected} onChange={toggleAll} />
                        <span className="flex-1 text-[14px] font-medium text-[#101828]">Select all</span>
                        <RowFilterDropdown active={filter} onChange={setFilter} />
                    </div>
                    <div className="h-px bg-[#e4e7ec]" />
                    {groups.map(g => (
                        <div key={g || "_"} className="flex flex-col gap-3">
                            {g && <p className="text-[12px] text-[#667085] leading-[18px]">{g}</p>}
                            {visibleOptions.filter(o => (o.group ?? "") === g).map(o => (
                                <div key={o.id} className="flex items-center gap-2">
                                    <FilledCheckbox checked={selected.includes(o.id)} onChange={() => toggleOne(o.id)} />
                                    <span className="text-[14px] font-medium text-[#101828] flex-1 truncate">{o.label}</span>
                                    {o.sublabel && <span className="text-[14px] text-[#667085] shrink-0">{o.sublabel}</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                    {visibleOptions.length === 0 && (
                        <p className="text-[14px] text-[#667085]">
                            {options.length === 0 ? "Nothing available yet."
                                : filter === "enabled" ? "No options selected yet."
                                    : "All options are selected."}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Step 3 — Content type chooser (Figma 5390:91195 / 5390:91156) ──────────
//
// Exported so the Phase-3 "Add new version" page can render the same
// chooser-card + upload-zone pair without re-inventing them.

export function ContentTypeCard({ title, selected, onSelect }: {
    title: string; selected: boolean; onSelect: () => void;
}) {
    return (
        <button type="button" onClick={onSelect}
            className={cn(
                "flex-1 flex items-center gap-3 p-4 rounded-[12px] bg-white transition-all text-left",
                selected
                    ? "border-2 border-[#7ba08c]"
                    : "border-1 border-[#e4e7ec] hover:bg-[#fafafa]",
            )}>
            <span className={cn(
                "flex-1 text-[14px] font-medium",
                selected ? "text-[#101828]" : "text-[#667085]",
            )}>{title}</span>
            <span className={cn(
                "w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors",
                selected ? "bg-[#658774]" : "border-1 border-[#d0d5dd] bg-white",
            )}>
                {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
            </span>
        </button>
    );
}

// ─── Upload zone + file pill (Figma 4984:116679) ────────────────────────────

export interface UploadedFile {
    fileName: string;
    sizeBytes: number;
    /** ObjectURL for preview/download in the prototype (revoked on swap). */
    fileUrl?: string;
    /** Extracted HTML — DOCX via mammoth, PDF via pdfjs-dist. Populated
     *  asynchronously after the user picks the file; the UploadZone shows
     *  a "Parsing…" progress state until this resolves. */
    extractedHtml?: string;
    /** Parse-state flag so the form footer can disable Submit while the
     *  extractor is still running. */
    parsing?: boolean;
}

export function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── File → HTML extractors ─────────────────────────────────────────────────
//
// Lazy-imported so the heavy parser bundles only ship when the user actually
// uploads a file. mammoth handles DOCX → semantic HTML (preserves <p>,
// <strong>, <em>, <h1>..<h4>, lists). pdfjs walks every page and emits one
// <p> per detected text line so the modal renders the document text as
// styled paragraphs rather than a download link or PDF viewer.

async function extractDocxHtml(file: File): Promise<string> {
    const mammoth = await import("mammoth");
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    return result.value || "<p><em>No readable text in this document.</em></p>";
}

async function extractPdfHtml(file: File): Promise<string> {
    // pdfjs-dist 6.x ships as `.mjs` with the legacy build under
    // `legacy/build/pdf.mjs`. Dynamic-imported so the heavy parser only
    // ships when a user actually uploads. Worker loads from the unpkg CDN
    // at the matching version for a cached, immutable URL.
    const pdfjsLib: typeof import("pdfjs-dist") =
        await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

    const escape = (s: string) =>
        s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const parts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        // Group items by their Y coordinate so we get one <p> per visual
        // line. pdfjs returns items in reading order with a transform
        // matrix; the Y is at index 5.
        const lines = new Map<number, string[]>();
        for (const item of content.items as Array<{ str: string; transform: number[] }>) {
            if (!item.str) continue;
            const y = Math.round((item.transform?.[5] ?? 0));
            const bucket = lines.get(y) ?? [];
            bucket.push(item.str);
            lines.set(y, bucket);
        }
        const sortedY = Array.from(lines.keys()).sort((a, b) => b - a);
        for (const y of sortedY) {
            const text = (lines.get(y) ?? []).join(" ").trim();
            if (text) parts.push(`<p>${escape(text)}</p>`);
        }
        if (pageNum < pdf.numPages) parts.push("<hr />");
    }
    return parts.join("") || "<p><em>No readable text in this PDF.</em></p>";
}

async function extractFileHtml(file: File): Promise<string> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) return extractPdfHtml(file);
    if (name.endsWith(".doc") || name.endsWith(".docx")) return extractDocxHtml(file);
    return "<p><em>Unsupported file type.</em></p>";
}

export function UploadZone({ value, onChange }: {
    value: UploadedFile | null;
    onChange: (next: UploadedFile | null) => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);

    function handleFiles(files: FileList | null) {
        if (!files || files.length === 0) return;
        const f = files[0];
        // Brief: PDF or DOC (max 1mb per Figma copy)
        const isPdfOrDoc = /\.pdf$/i.test(f.name) || /\.docx?$/i.test(f.name)
            || f.type === "application/pdf"
            || f.type === "application/msword"
            || f.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        if (!isPdfOrDoc) return;
        if (value?.fileUrl) URL.revokeObjectURL(value.fileUrl);
        const fileUrl = URL.createObjectURL(f);
        const fileName = f.name;
        const sizeBytes = f.size;
        // Immediately show the file pill with parsing=true; the modal will
        // then render the HTML once the async extractor resolves.
        onChange({ fileName, sizeBytes, fileUrl, parsing: true });
        extractFileHtml(f)
            .then(html => {
                onChange({ fileName, sizeBytes, fileUrl, extractedHtml: html, parsing: false });
            })
            .catch(err => {
                console.error("Agreement file parse failed:", err);
                onChange({
                    fileName, sizeBytes, fileUrl,
                    extractedHtml: "<p><em>Couldn't read this file's contents.</em></p>",
                    parsing: false,
                });
            });
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-1 border-[#e4e7ec] rounded-[12px] bg-white px-6 py-4 flex flex-col items-center gap-3 cursor-pointer hover:bg-[#fafafa] transition-colors">
                <div className="w-10 h-10 rounded-[8px] border-1 border-[#e4e7ec] bg-white flex items-center justify-center shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                    <UploadCloud02 className="w-5 h-5 text-[#475467]" />
                </div>
                <div className="flex flex-col items-center gap-1">
                    <p className="text-[14px] leading-[20px]">
                        <span className="font-semibold text-[#4f6e5d]">Click to upload</span>
                        <span className="text-[#475467]"> or drag and drop</span>
                    </p>
                    <p className="text-[12px] text-[#475467]">PDF or DOC (max. 1mb)</p>
                </div>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                />
            </div>

            {value && (
                <div className="border-1 border-[#e4e7ec] rounded-[12px] bg-white p-4 flex items-start gap-3 relative">
                    <div className="w-10 h-10 rounded-[6px] bg-white border-1 border-[#e4e7ec] flex items-center justify-center shrink-0">
                        <File02 className="w-5 h-5 text-[#475467]" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#344054] truncate">{value.fileName}</p>
                        <p className="text-[14px] text-[#475467]">{formatBytes(value.sizeBytes)}</p>
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-[#e4e7ec] overflow-hidden">
                                <div className={cn(
                                    "h-full bg-[#658774] rounded-full transition-all",
                                    value.parsing ? "w-[40%] animate-pulse" : "w-full",
                                )} />
                            </div>
                            <span className="text-[14px] font-medium text-[#344054]">
                                {value.parsing ? "Parsing…" : "100%"}
                            </span>
                        </div>
                    </div>
                    <button type="button"
                        onClick={() => {
                            if (value.fileUrl) URL.revokeObjectURL(value.fileUrl);
                            onChange(null);
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                        <Trash01 className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Page state shapes ──────────────────────────────────────────────────────

interface BasicState {
    name: string;
    description: string;
}

interface RulesState {
    /** Multi-branch toggle. OFF = single branch picker; ON = multi-select. */
    multiBranch: boolean;
    /** Single branch id when multiBranch is off. */
    branchId: string;
    /** Multi-branch state (mirrors the Agreement data model directly). */
    allLocations: boolean;
    locationIds: string[];
    /** Class-template (service) ids the agreement covers. Defaults to "all
     *  active services" — every template id pre-selected at first render. */
    applicableClassTemplateIds: string[];
    /** v24 — Effective dates mode radio (Figma 7703:13587 vs 13751).
     *  Ongoing hides the date pickers + persists empty strings; expiry
     *  requires both dates before Continue. */
    effectiveDatesMode: "ongoing" | "expiry";
    /** ISO YYYY-MM-DD. Empty string when `effectiveDatesMode` is
     *  "ongoing" — kept in state so switching back to "expiry"
     *  mid-edit doesn't lose the previously-typed dates. */
    effectiveFrom: string;
    effectiveUntil: string;
    /** v24 — Re-acceptance toggle (Step 2 "Re-acceptance" section). */
    requireReAcceptance: boolean;
    /** v24 — Guardian consent toggle (Step 2 "Minors & guardian
     *  consent" section). */
    requireGuardianConsent: boolean;
}

interface ContentState {
    contentType: AgreementContentType;
    text: string;
    file: UploadedFile | null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export interface AgreementFormPageProps {
    mode: "create" | "edit";
    /** Required when mode === "edit". */
    agreementId?: string;
}

const RETURN_ROUTE = "/admin/settings/agreements";

export function AgreementFormPage({ mode, agreementId }: AgreementFormPageProps) {
    const router = useRouter();
    const today = todayISO();
    const isEdit = mode === "edit";
    const STEPS = isEdit ? STEPS_EDIT : STEPS_CREATE;

    // Store reads
    const existing       = useAppStore(s => agreementId ? s.agreements.find(a => a.id === agreementId) : undefined);
    const allAgreements  = useAppStore(s => s.agreements);
    const branches       = useAppStore(s => s.branches);
    const classTemplates = useAppStore(s => s.classTemplates);
    const addAgreement   = useAppStore(s => s.addAgreement);
    const updateAgreement = useAppStore(s => s.updateAgreement);
    const addAgreementVersion = useAppStore(s => s.addAgreementVersion);
    const showToast      = useAppStore(s => s.showToast);

    // Step counter
    const [step, setStep] = useState(1);

    // Branch + service-template options. Services are grouped by branch in
    // the form — derived from classTemplates.branch_ids (each template
    // appears under every branch that offers it; templates with no
    // `branch_ids` set fall under an "All locations" group).
    const branchOptions = useMemo(
        () => branches.filter(b => b.status === "active").map(b => ({ id: b.id, name: b.name })),
        [branches],
    );
    const branchNameById = useMemo(
        () => new Map(branches.map(b => [b.id, b.name])),
        [branches],
    );
    const serviceOptions = useMemo<MultiOption[]>(() => {
        const opts: MultiOption[] = [];
        for (const t of classTemplates) {
            if (t.status !== "Active") continue;
            const tBranchIds = (t as { branch_ids?: string[] }).branch_ids;
            const branches = tBranchIds && tBranchIds.length > 0 ? tBranchIds : [""];
            for (const bid of branches) {
                // Render the same template under EACH offering branch — the
                // `selected[]` array dedupes naturally since both rows share
                // the same template id (clicking one toggles both).
                opts.push({
                    id: t.id,
                    label: t.name,
                    group: bid ? (branchNameById.get(bid) ?? "All locations") : "All locations",
                });
            }
        }
        return opts;
    }, [branchNameById, classTemplates]);
    const allServiceIds = useMemo(
        () => Array.from(new Set(serviceOptions.map(o => o.id))),
        [serviceOptions],
    );

    // Initial state seeding (create vs edit)
    const [basic, setBasic] = useState<BasicState>(() => ({
        name: existing?.name ?? "",
        description: existing?.description ?? "",
    }));

    const [rules, setRules] = useState<RulesState>(() => {
        if (existing) {
            const isMulti = existing.allLocations || existing.locationIds.length > 1;
            // Seed the multi-select with the persisted (allLocations | locationIds) pair.
            // When existing was "all locations", expand to every branch id for the card.
            const multiSelectIds = existing.allLocations
                ? branchOptions.map(b => b.id)
                : [...existing.locationIds];
            return {
                multiBranch: isMulti,
                branchId: !isMulti && existing.locationIds[0] ? existing.locationIds[0] : "",
                allLocations: existing.allLocations,
                locationIds: multiSelectIds,
                applicableClassTemplateIds: existing.applicableClassTemplateIds.length > 0
                    ? [...existing.applicableClassTemplateIds]
                    : allServiceIds,
                effectiveDatesMode:     existing.effectiveDatesMode,
                effectiveFrom:          existing.effectiveFrom.slice(0, 10),
                effectiveUntil:         existing.effectiveUntil.slice(0, 10),
                requireReAcceptance:    existing.requireReAcceptance,
                requireGuardianConsent: existing.requireGuardianConsent,
            };
        }
        // v24 create defaults per Figma:
        //   • Ongoing (no expiry) pre-selected — Figma 7703:13587 shows
        //     the Ongoing card highlighted green.
        //   • Re-acceptance + guardian consent toggles default ON —
        //     matches the Figma "recommended safe defaults" state.
        //   • effectiveFrom/Until stay empty; the admin picks them ONLY
        //     if they switch to "Set an expiry date".
        return {
            multiBranch: false,
            branchId: "",
            allLocations: false,
            locationIds: [],
            applicableClassTemplateIds: allServiceIds,
            effectiveDatesMode:     "ongoing",
            effectiveFrom:          "",
            effectiveUntil:         "",
            requireReAcceptance:    true,
            requireGuardianConsent: true,
        };
    });

    const [content, setContent] = useState<ContentState>(() => ({
        contentType: "text",
        text: "",
        file: null,
    }));

    // ─── Edit-mode guard: bounce to list if id is unknown (deleted, bad URL) ─
    useEffect(() => {
        if (isEdit && agreementId && !existing) {
            router.replace(RETURN_ROUTE);
        }
    }, [isEdit, agreementId, existing, router]);

    // ─── Validation per step ───────────────────────────────────────────────
    const nameTrimmed = basic.name.trim();
    const nameIsUnique = useMemo(() => {
        if (!nameTrimmed) return false;
        const lower = nameTrimmed.toLowerCase();
        return !allAgreements.some(a => a.id !== existing?.id && a.name.toLowerCase() === lower);
    }, [nameTrimmed, allAgreements, existing?.id]);

    const step1Valid = nameTrimmed.length > 0 && nameIsUnique;

    const step2HasLocation = rules.multiBranch
        ? (rules.allLocations || rules.locationIds.length > 0)
        : rules.branchId.length > 0;
    const step2HasCategories = rules.applicableClassTemplateIds.length > 0;
    // v24 — Ongoing mode has NO date requirements; "expiry" mode
    // requires both Issue + Expiry pickers (per user's answer to
    // "both need input" clarifier — no defaults; both empty → invalid).
    const step2DatesValid = rules.effectiveDatesMode === "ongoing"
        ? true
        : rules.effectiveFrom.length === 10
            && rules.effectiveUntil.length === 10
            && rules.effectiveUntil >= rules.effectiveFrom;
    const step2Valid = step2HasLocation && step2HasCategories && step2DatesValid;

    const step3Valid = isEdit
        ? true
        : content.contentType === "text"
            ? content.text.trim().length > 0
            // For uploads, also wait until the parser finishes so the
            // version row is persisted with the extracted HTML.
            : content.file !== null && !content.file.parsing;

    // ─── Submit ────────────────────────────────────────────────────────────
    function handleSubmit() {
        // Resolve the (allLocations, locationIds) pair from the form state.
        // In multi-branch mode, when every active branch is selected we
        // snap to allLocations:true (matches how memberships persist).
        const everyBranchPicked = rules.locationIds.length === branchOptions.length
            && branchOptions.length > 0;
        const allLoc = rules.multiBranch ? everyBranchPicked : false;
        const locIds = rules.multiBranch
            ? (everyBranchPicked ? [] : [...rules.locationIds])
            : [rules.branchId];

        // Services: if user picked every option, persist as empty (= all)
        const svcIds = rules.applicableClassTemplateIds.length === allServiceIds.length
            ? []
            : [...rules.applicableClassTemplateIds];

        if (isEdit && existing) {
            updateAgreement(existing.id, {
                name: nameTrimmed,
                description: basic.description.trim() || undefined,
                allLocations: allLoc,
                locationIds: locIds,
                applicableClassTemplateIds: svcIds,
                // v24 — new Step 2 fields. Dates persist as empty
                // strings when the admin switched to Ongoing so a
                // future edit round-trip cleanly restores the mode.
                effectiveDatesMode:     rules.effectiveDatesMode,
                effectiveFrom:          rules.effectiveDatesMode === "expiry" ? rules.effectiveFrom  : "",
                effectiveUntil:         rules.effectiveDatesMode === "expiry" ? rules.effectiveUntil : "",
                requireReAcceptance:    rules.requireReAcceptance,
                requireGuardianConsent: rules.requireGuardianConsent,
            });
            showToast(
                "Agreement updated",
                `${nameTrimmed} has been saved.`,
                "success", "check",
            );
            router.push(RETURN_ROUTE);
            return;
        }

        // Create
        const newId = addAgreement({
            name: nameTrimmed,
            type: "liability_waiver",
            description: basic.description.trim() || undefined,
            required: true,
            currentVersion: 1,
            allLocations: allLoc,
            locationIds: locIds,
            applicableClassTemplateIds: svcIds,
            // v24 — new Step 2 fields. `rules` gained
            // `effectiveDatesMode` + `requireReAcceptance` +
            // `requireGuardianConsent`; the wizard renders them in the
            // Effective dates / Re-acceptance / Minors & guardian
            // sections.
            effectiveDatesMode:     rules.effectiveDatesMode,
            effectiveFrom:          rules.effectiveDatesMode === "expiry" ? rules.effectiveFrom  : "",
            effectiveUntil:         rules.effectiveDatesMode === "expiry" ? rules.effectiveUntil : "",
            requireReAcceptance:    rules.requireReAcceptance,
            requireGuardianConsent: rules.requireGuardianConsent,
            status: "active",
        });

        addAgreementVersion({
            agreementId: newId,
            versionNumber: 1,
            contentType: content.contentType,
            contentText: content.contentType === "text" ? content.text : undefined,
            fileName: content.contentType === "upload" ? content.file?.fileName : undefined,
            fileUrl: content.contentType === "upload" ? content.file?.fileUrl : undefined,
            fileSizeBytes: content.contentType === "upload" ? content.file?.sizeBytes : undefined,
            extractedHtml: content.contentType === "upload" ? content.file?.extractedHtml : undefined,
            publishedBy: "user_alex_owen",
        });

        showToast(
            "Agreement created",
            `${nameTrimmed} is now active and ready to apply.`,
            "success", "check",
        );
        router.push(RETURN_ROUTE);
    }

    function handleClose() {
        router.push(RETURN_ROUTE);
    }

    // ─── Render ────────────────────────────────────────────────────────────
    const title = isEdit ? `Edit ${existing?.name ?? "agreement"}` : "Create new agreement";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header (72px) */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                        {title}
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* 2-column body */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">

                    {/* Left: progress steps */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        {STEPS.map((s, i) => (
                            <StepItem key={s.n} step={s} current={step} isLast={i === STEPS.length - 1} />
                        ))}
                    </div>

                    {/* Middle: form card */}
                    {step === 1 && (
                        <FormCard
                            title="Information"
                            footer={
                                <div className="flex items-center justify-end w-full">
                                    <Button variant="primary" size="md"
                                        disabled={!step1Valid}
                                        onClick={() => setStep(2)}>
                                        Continue
                                    </Button>
                                </div>
                            }>
                            <FormField label="Agreement name">
                                <TextInput
                                    value={basic.name}
                                    onChange={v => setBasic(p => ({ ...p, name: v }))}
                                    placeholder="Enter agreement name..."
                                />
                                {basic.name.trim().length > 0 && !nameIsUnique && (
                                    <p className="text-[14px] text-[#b42318]">
                                        An agreement with this name already exists.
                                    </p>
                                )}
                            </FormField>
                            <FormField label="Description">
                                <Textarea
                                    value={basic.description}
                                    onChange={v => setBasic(p => ({ ...p, description: v }))}
                                    placeholder="Enter description..."
                                />
                            </FormField>
                        </FormCard>
                    )}

                    {step === 2 && (
                        <FormCard
                            footer={
                                <div className="flex items-center justify-between w-full">
                                    <Button variant="secondary-gray" size="md"
                                        onClick={() => setStep(1)}>
                                        Back
                                    </Button>
                                    <Button variant="primary" size="md"
                                        disabled={!step2Valid}
                                        onClick={() => isEdit ? handleSubmit() : setStep(3)}>
                                        {isEdit ? "Save changes" : "Continue"}
                                    </Button>
                                </div>
                            }>
                            {/* Agreements applies to */}
                            <Section title="Agreements applies to">
                                {/* Multi-branch toggle card */}
                                <div className="bg-white border-1 border-[#e4e7ec] rounded-[12px] p-4">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <p className="text-[14px] font-medium text-[#101828]">Multi-branch locations</p>
                                            <p className="text-[14px] text-[#667085]">Agreement can be use on multiple branches</p>
                                        </div>
                                        <LargeToggle
                                            on={rules.multiBranch}
                                            onChange={next => setRules(p => ({
                                                ...p,
                                                multiBranch: next,
                                                // Reset the un-used side when flipping
                                                ...(next
                                                    ? { branchId: "" }
                                                    : { allLocations: false, locationIds: [] }),
                                            }))}
                                            ariaLabel="Multi-branch locations"
                                        />
                                    </div>
                                </div>

                                {/* Branch picker — single SelectInput (OFF) or expandable
                                    MultiSelectCard mirroring the membership creation flow (ON). */}
                                {rules.multiBranch ? (
                                    <MultiSelectCard
                                        title="Branches"
                                        subtitle="Agreement applies to these branches"
                                        options={branchOptions.map(b => ({ id: b.id, label: b.name }))}
                                        selected={rules.locationIds}
                                        onChange={ids => setRules(p => ({ ...p, locationIds: ids }))}
                                    />
                                ) : (
                                    <FormField label="Branch location">
                                        <SelectInput
                                            triggerIcon={<MarkerPin01 className="w-4 h-4" />}
                                            placeholder="Select location"
                                            options={branchOptions.map(b => ({ value: b.id, label: b.name }))}
                                            value={rules.branchId}
                                            onChange={v => setRules(p => ({ ...p, branchId: v }))}
                                            width="w-full"
                                        />
                                    </FormField>
                                )}
                            </Section>

                            {/* Applicable services — class templates grouped by branch
                                so each branch's services appear under its own subtext
                                header (matches the user-supplied reference image). */}
                            <Section title="Applicable services">
                                <MultiSelectCard
                                    title="Manage applicable service"
                                    subtitle="The agreement can be use on multiple services"
                                    options={serviceOptions}
                                    selected={rules.applicableClassTemplateIds}
                                    onChange={ids => setRules(p => ({ ...p, applicableClassTemplateIds: ids }))}
                                />
                            </Section>

                            {/* Effective dates — 2 radio cards (Ongoing /
                                Set an expiry date). When "expiry" is
                                selected, the Issue + Expiry pickers
                                appear below. Ongoing agreements persist
                                empty date strings (see the create/edit
                                submit paths — both branch on
                                `effectiveDatesMode`). */}
                            <Section title="Effective dates">
                                <FormField label="Effective dates">
                                    <div className="grid grid-cols-2 gap-3">
                                        <EffectiveDateModeCard
                                            selected={rules.effectiveDatesMode === "ongoing"}
                                            title="Ongoing (no expiry)"
                                            subtitle="The agreement stays in effect until it is updated."
                                            icon={<RefreshCcw01 className="w-5 h-5 text-[#658774]" />}
                                            onSelect={() => setRules(p => ({ ...p, effectiveDatesMode: "ongoing" }))}
                                        />
                                        <EffectiveDateModeCard
                                            selected={rules.effectiveDatesMode === "expiry"}
                                            title="Set an expiry date"
                                            subtitle="The agreement is valid until the selected expiry date."
                                            icon={<Calendar className="w-5 h-5 text-[#658774]" />}
                                            onSelect={() => setRules(p => ({ ...p, effectiveDatesMode: "expiry" }))}
                                        />
                                    </div>
                                </FormField>
                                {rules.effectiveDatesMode === "expiry" && (
                                    <div className="grid grid-cols-2 gap-4 mt-4">
                                        <FormField label="Issue Date">
                                            <DatePicker
                                                value={rules.effectiveFrom}
                                                onChange={v => setRules(p => ({
                                                    ...p,
                                                    effectiveFrom: v,
                                                    // Keep expiry ≥ issue
                                                    effectiveUntil: p.effectiveUntil && v && p.effectiveUntil < v ? "" : p.effectiveUntil,
                                                }))}
                                                placeholder="Select date"
                                                minDate={today}
                                            />
                                        </FormField>
                                        <FormField label="Expiry Date">
                                            <DatePicker
                                                value={rules.effectiveUntil}
                                                onChange={v => setRules(p => ({ ...p, effectiveUntil: v }))}
                                                placeholder="Select date"
                                                minDate={rules.effectiveFrom || today}
                                            />
                                        </FormField>
                                    </div>
                                )}
                            </Section>

                            {/* Re-acceptance — single toggle card. When ON,
                                a new version published later flips signed
                                customers to `re_accept_due` (drives the
                                Acceptance status "Needs re-acceptance"
                                sub-tab). */}
                            <Section title="Re-acceptance">
                                <ToggleCard
                                    title="Require existing customers to re-accept"
                                    subtitle="If a newer version is available, customers must accept it before they can complete their next booking."
                                    on={rules.requireReAcceptance}
                                    onChange={v => setRules(p => ({ ...p, requireReAcceptance: v }))}
                                    ariaLabel="Require existing customers to re-accept"
                                />
                            </Section>

                            {/* Minors & guardian consent — single toggle. */}
                            <Section title="Minors & guardian consent">
                                <ToggleCard
                                    title="Require guardian signature for minors"
                                    subtitle="Customers under 18 will be routed to a guardian-signature flow before they can book."
                                    on={rules.requireGuardianConsent}
                                    onChange={v => setRules(p => ({ ...p, requireGuardianConsent: v }))}
                                    ariaLabel="Require guardian signature for minors"
                                />
                            </Section>

                            {/* Info banner (Figma 5773:223106) */}
                            <div className="bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-start gap-4">
                                <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-0.5" />
                                <p className="text-[14px] text-[#475467] leading-[20px] flex-1">
                                    Agreements are sent automatically on a customer's first booking. You can also republish new agreement version manually.
                                </p>
                            </div>
                        </FormCard>
                    )}

                    {step === 3 && (
                        <FormCard
                            footer={
                                <div className="flex items-center justify-between w-full">
                                    <Button variant="secondary-gray" size="md"
                                        onClick={() => setStep(2)}>
                                        Back
                                    </Button>
                                    <Button variant="primary" size="md"
                                        disabled={!step3Valid}
                                        onClick={handleSubmit}>
                                        Create agreement
                                    </Button>
                                </div>
                            }>
                            <Section title="Agreement setup">
                                <div className="flex gap-4 w-full">
                                    <ContentTypeCard
                                        title="Write agreement manually"
                                        selected={content.contentType === "text"}
                                        onSelect={() => setContent(p => ({ ...p, contentType: "text" }))}
                                    />
                                    <ContentTypeCard
                                        title="Upload agreement file"
                                        selected={content.contentType === "upload"}
                                        onSelect={() => setContent(p => ({ ...p, contentType: "upload" }))}
                                    />
                                </div>

                                {content.contentType === "text" ? (
                                    <RichTextEditor
                                        value={content.text}
                                        onChange={v => setContent(p => ({ ...p, text: v }))}
                                        placeholder="Write the agreement text customers will see..."
                                        rows={10}
                                    />
                                ) : (
                                    <UploadZone
                                        value={content.file}
                                        onChange={f => setContent(p => ({ ...p, file: f }))}
                                    />
                                )}
                            </Section>
                        </FormCard>
                    )}
                </div>
            </div>
        </div>
    );
}
