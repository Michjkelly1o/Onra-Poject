"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customer data import flow (modal)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 6254:150783 (upload) · 6254:161439 (file uploaded) ·
//        6256:195678 (review & mapping) · 6254:189105 (checking) ·
//        6254:189307 / 6256:197405 (summary) · 6256:197264 (success toast).
//
// A four-step wizard:
//   1. Import file      — drag/drop or pick a CSV/XLSX, download templates
//   2. Review & mapping — map each file column to a customer field; a field
//                         already mapped can't be picked again on another row
//   3. Checking         — animated progress while rows are validated
//   4. Summary          — total / valid / invalid / imported counts; an
//                         invalid-rows report download appears when relevant
//
// Confirming the summary commits the valid rows through the store's
// `addCustomer` action and fires a success toast. A simulated processing
// failure fires the error toast instead.

import { useEffect, useRef, useState } from "react";
import { XClose, ChevronRight, UploadCloud02, Download01, Trash01, User01, Database01, CheckCircle, XCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { useAppStore } from "@/lib/store";

// ─── Constants ────────────────────────────────────────────────────────────────

type ImportStep = "upload" | "mapping" | "loading" | "summary";

/** Total rows in the simulated import file. */
const TOTAL_ROWS = 20;

/** Columns as they appear in the uploaded file (the "Fist name" typo is
 *  intentional — a messy real-world header the mapping step lets you fix). */
const FILE_COLUMNS: { id: string; label: string; defaultField: string }[] = [
    { id: "col_first", label: "Fist name", defaultField: "first_name" },
    { id: "col_last", label: "Last name", defaultField: "last_name" },
    { id: "col_phone", label: "Phone", defaultField: "phone" },
    { id: "col_email", label: "Email", defaultField: "email" },
    { id: "col_gender", label: "Gender", defaultField: "gender" },
    { id: "col_dob", label: "Date of birth", defaultField: "dob" },
    { id: "col_country", label: "Country", defaultField: "country" },
    { id: "col_state", label: "State", defaultField: "state" },
    { id: "col_city", label: "City", defaultField: "city" },
    { id: "col_postal", label: "Postal code", defaultField: "postal" },
    { id: "col_address", label: "Address", defaultField: "address" },
];

/** Customer fields the import can map onto (the app's customer data model). */
const CUSTOMER_FIELDS: { value: string; label: string }[] = [
    { value: "first_name", label: "First name" },
    { value: "last_name", label: "Last name" },
    { value: "phone", label: "Phone" },
    { value: "email", label: "Email" },
    { value: "gender", label: "Gender" },
    { value: "dob", label: "Date of birth" },
    { value: "country", label: "Country" },
    { value: "state", label: "State" },
    { value: "city", label: "City" },
    { value: "postal", label: "Postal code" },
    { value: "address", label: "Address" },
];

/** Sentinel mapping value — column is intentionally not imported. */
const SKIP = "__skip__";

const FIELD_LABEL: Record<string, string> = Object.fromEntries(
    CUSTOMER_FIELDS.map(f => [f.value, f.label]),
);

// ─── Simulated import rows ────────────────────────────────────────────────────
//
// The valid rows from this pool are what actually land in the `customers`
// store when the import is confirmed.

const IMPORT_FIRST = ["Liam", "Emma", "Noah", "Olivia", "Ethan", "Sophie", "Mason", "Isla", "Lucas", "Aria", "Adam", "Maya", "Omar", "Hana", "Yusuf", "Lina", "Karim", "Nora", "Sami", "Dina"];
const IMPORT_LAST = ["Carter", "Bennett", "Foster", "Hayes", "Reed", "Coleman", "Brooks", "Sharma", "Khan", "Mansour", "Haddad", "Nasser", "Saleh", "Rahman", "Aziz", "Farah", "Hassan", "Younis", "Darwish", "Kamal"];

interface ImportRow {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    gender: "Male" | "Female";
}

const IMPORTED_ROWS: ImportRow[] = IMPORT_FIRST.map((first, i) => {
    const last = IMPORT_LAST[i];
    return {
        firstName: first,
        lastName: last,
        email: `${first}.${last}@email.com`.toLowerCase(),
        phone: `+971 50 ${String(210 + i).padStart(3, "0")} ${String(1000 + (i * 617) % 8999).padStart(4, "0")}`,
        gender: i % 2 === 0 ? "Male" : "Female",
    };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Bytes → "1.2 MB" / "840 KB". */
function formatBytes(bytes: number): string {
    if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
    if (bytes >= 1000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
    return `${bytes} B`;
}

/** Trigger a client-side download of a text file. */
function downloadTextFile(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const TEMPLATE_CSV =
    "First name,Last name,Phone,Email,Gender,Date of birth,Country,State,City,Postal code,Address\n" +
    "Jane,Doe,+971 50 000 0000,jane.doe@email.com,Female,1995-04-12,United Arab Emirates,Dubai,Dubai,000000,1 Example Street\n";

// ─── File-type icon ───────────────────────────────────────────────────────────

function FileTypeIcon({ kind, size = 40 }: { kind: "CSV" | "XLSX"; size?: number }) {
    return (
        <div className="relative shrink-0" style={{ width: size * 0.8, height: size }}>
            <div className="absolute inset-0 rounded-[3px] border-1 border-[#d0d5dd] bg-white" />
            <div className="absolute left-[2px] bottom-[16%] bg-[#079455] rounded-[2px] px-[3px] py-[1px]">
                <span className="text-[7px] font-bold text-white leading-none tracking-tight">{kind}</span>
            </div>
        </div>
    );
}

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

function Breadcrumbs({ step }: { step: ImportStep }) {
    const crumbs: { key: ImportStep; label: string }[] = [
        { key: "upload", label: "Import file" },
        { key: "mapping", label: "Review & mapping" },
        { key: "summary", label: "Summary" },
    ];
    const activeKey: ImportStep = step === "loading" ? "mapping" : step;
    return (
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#e4e7ec] shrink-0">
            {crumbs.map((c, i) => (
                <div key={c.key} className="flex items-center gap-3">
                    <span className={cn("text-[14px] font-semibold whitespace-nowrap",
                        c.key === activeKey ? "text-[#4f6e5d]" : "text-[#475467]")}>
                        {c.label}
                    </span>
                    {i < crumbs.length - 1 && <ChevronRight className="w-4 h-4 text-[#667085]" />}
                </div>
            ))}
        </div>
    );
}

// ─── Template download card ───────────────────────────────────────────────────

function TemplateCard({ kind, name }: { kind: "CSV" | "XLSX"; name: string }) {
    return (
        <div className="flex-1 min-w-0 flex items-center gap-3 p-4 rounded-[12px] border-1 border-[#e4e7ec] bg-white">
            <FileTypeIcon kind={kind} size={32} />
            <div className="flex flex-col min-w-0 flex-1">
                <p className="text-[14px] font-medium text-[#344054] truncate">{name}</p>
                <p className="text-[14px] text-[#475467]">10 KB</p>
            </div>
            <button type="button"
                onClick={() => downloadTextFile("customer-data-template.csv", TEMPLATE_CSV)}
                className="w-9 h-9 flex items-center justify-center rounded-[8px] border-1 border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors shrink-0">
                <Download01 className="w-5 h-5 text-[#344054]" />
            </button>
        </div>
    );
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({ label, value, tone, icon }: {
    label: string; value: number; tone: "default" | "success" | "error"; icon: React.ReactNode;
}) {
    const valueColor = tone === "success" ? "text-[#079455]" : tone === "error" ? "text-[#d92d20]" : "text-[#101828]";
    return (
        <div className="flex items-center justify-between gap-4">
            <p className="text-[14px] text-[#667085]">{label}</p>
            <div className="flex items-center gap-1.5">
                <span className={cn("text-[14px] font-medium", valueColor)}>{value}</span>
                {icon}
            </div>
        </div>
    );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

export function CustomerImportModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    const addCustomer = useAppStore(s => s.addCustomer);
    const showToast = useAppStore(s => s.showToast);

    const [step, setStep] = useState<ImportStep>("upload");
    const [file, setFile] = useState<{ name: string; sizeLabel: string } | null>(null);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [result, setResult] = useState<{ total: number; valid: number; invalid: number } | null>(null);
    const [checkedRows, setCheckedRows] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Reset everything and close.
    function closeAndReset() {
        onClose();
        setStep("upload");
        setFile(null);
        setMapping({});
        setResult(null);
        setCheckedRows(0);
    }

    // Escape closes the modal — except mid-check, where it would orphan the run.
    useEffect(() => {
        if (!open) return;
        function h(e: KeyboardEvent) { if (e.key === "Escape" && step !== "loading") closeAndReset(); }
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [open, step]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Checking animation — runs while step === "loading" ─────────────────
    useEffect(() => {
        if (step !== "loading") return;
        setCheckedRows(0);
        const tick = setInterval(() => {
            setCheckedRows(c => (c < TOTAL_ROWS ? c + 1 : c));
        }, 110);
        const done = setTimeout(() => {
            clearInterval(tick);
            setCheckedRows(TOTAL_ROWS);
            // Simulated outcome: 15% processing failure, else clean / partial.
            const r = Math.random();
            if (r < 0.15) {
                closeAndReset();
                showToast(
                    "Import failed",
                    "We couldn't import your customer data. Please check the file and try again.",
                    "error", "slash",
                );
                return;
            }
            const invalid = r < 0.6 ? 0 : 4;
            setResult({ total: TOTAL_ROWS, valid: TOTAL_ROWS - invalid, invalid });
            setStep("summary");
        }, 2600);
        return () => { clearInterval(tick); clearTimeout(done); };
    }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!open) return null;

    // ─── File handling ──────────────────────────────────────────────────────
    function acceptFile(f: File | null | undefined) {
        if (!f) return;
        setFile({ name: f.name, sizeLabel: formatBytes(f.size) });
    }
    function onDrop(e: React.DragEvent) {
        e.preventDefault();
        acceptFile(e.dataTransfer.files?.[0]);
    }

    // ─── Step transitions ───────────────────────────────────────────────────
    function goToMapping() {
        // Seed the mapping with each file column's obvious default the first time.
        setMapping(prev => {
            if (Object.keys(prev).length > 0) return prev;
            return Object.fromEntries(FILE_COLUMNS.map(c => [c.id, c.defaultField]));
        });
        setStep("mapping");
    }
    function commitImport() {
        if (!result) return;
        IMPORTED_ROWS.slice(0, result.valid).forEach(row => {
            addCustomer({
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.phone,
                gender: row.gender,
                planKind: null,
            });
        });
        closeAndReset();
        showToast(
            "Successfully imported data",
            "Customer data has been successfully imported, check to review it.",
            "success", "check",
        );
    }

    // ─── Per-row mapping options (a field used elsewhere is hidden) ──────────
    function optionsFor(columnId: string): { value: string; label: string }[] {
        const current = mapping[columnId];
        const usedElsewhere = new Set(
            Object.entries(mapping)
                .filter(([id, val]) => id !== columnId && val !== SKIP)
                .map(([, val]) => val),
        );
        return [
            { value: SKIP, label: "Skip this column" },
            ...CUSTOMER_FIELDS.filter(f => f.value === current || !usedElsewhere.has(f.value)),
        ];
    }

    const headerSubtitle =
        step === "mapping" ? "Match the columns from your file to platform customer data columns."
            : step === "summary" ? "Review summary of your data import results"
                : "Import your customer data here to start managing it.";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => step !== "loading" && closeAndReset()} />
            <div className="relative bg-white rounded-[16px] w-[720px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden h-[80vh]">

                {step === "loading" ? (
                    // ─── Checking & importing ───────────────────────────────
                    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-20">
                        <div className="flex flex-col items-center">
                            {([
                                { w: 360, p: 10, op: "opacity-100", icon: 18 },
                                { w: 300, p: 8, op: "opacity-80", icon: 15 },
                                { w: 240, p: 6, op: "opacity-60", icon: 12 },
                            ] as const).map((s, i) => (
                                <div key={s.w} className={cn("bg-[#f9fafb] rounded-[16px] flex items-center gap-3 shadow-[0px_1px_1px_rgba(16,24,40,0.05)]", s.op)}
                                    style={{ width: s.w, padding: s.p, marginBottom: i < 2 ? -16 : 0 }}>
                                    <div className="bg-white rounded-[10px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]"
                                        style={{ width: s.w * 0.14, height: s.w * 0.14 }}>
                                        <div className="bg-[#f9fafb] rounded-[7px] flex items-center justify-center"
                                            style={{ width: s.w * 0.085, height: s.w * 0.085 }}>
                                            <User01 className="text-[#98a2b3]" style={{ width: s.icon, height: s.icon }} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 flex-1 min-w-0">
                                        <div className="bg-[#f2f4f7] h-[12px] w-[68px] rounded-full" />
                                        <div className="bg-[#f2f4f7] h-[12px] w-full rounded-full" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col items-center gap-1 text-center max-w-[352px]">
                            <p className="text-[16px] font-semibold text-[#101828] leading-[24px]">Checking &amp; importing data...</p>
                            <p className="text-[14px] text-[#475467] leading-[20px]">{checkedRows} of {TOTAL_ROWS} rows checked</p>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="relative shrink-0">
                            <button type="button" onClick={closeAndReset}
                                className="absolute right-3 top-3 w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                                <XClose className="w-6 h-6 text-[#667085]" />
                            </button>
                            <div className="flex flex-col gap-1 px-6 pt-6 pb-5 pr-14">
                                <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Import customer data</h3>
                                <p className="text-[14px] text-[#475467] leading-[20px]">{headerSubtitle}</p>
                            </div>
                            <div className="h-px w-full bg-[#e4e7ec]" />
                        </div>

                        <Breadcrumbs step={step} />

                        {/* Step content — the scroll region. NOT a flex column: a
                            plain block so children (incl. the mapping table) keep
                            their natural height and overflow → this div scrolls.
                            A `flex flex-col` here would shrink the table to fit and
                            clip its rows instead of letting it overflow. */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 space-y-4">
                            {step === "upload" && (
                                <>
                                    {/* Drop zone */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={onDrop}
                                        className="cursor-pointer border-1 border-[#e4e7ec] rounded-[12px] px-6 py-4 flex flex-col items-center gap-3 hover:bg-[#f9fafb] transition-colors">
                                        <div className="w-10 h-10 rounded-[8px] bg-white border-1 border-[#e4e7ec] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex items-center justify-center">
                                            <UploadCloud02 className="w-5 h-5 text-[#475467]" />
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <p className="text-[14px]">
                                                <span className="font-semibold text-[#4f6e5d]">Click to upload</span>
                                                <span className="text-[#475467]"> or drag and drop</span>
                                            </p>
                                            <p className="text-[12px] text-[#475467]">CSV, .xlsx, or .xls (max. 10 MB)</p>
                                        </div>
                                    </div>
                                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                                        onChange={e => acceptFile(e.target.files?.[0])} />

                                    {/* Uploaded file queue item */}
                                    {file && (
                                        <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-start gap-3">
                                            <FileTypeIcon kind="CSV" size={40} />
                                            <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                <p className="text-[14px] font-medium text-[#344054] truncate">{file.name}</p>
                                                <p className="text-[14px] text-[#475467]">{file.sizeLabel}</p>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <div className="flex-1 h-2 rounded-full bg-[#e4e7ec] overflow-hidden">
                                                        <div className="h-full rounded-full bg-[#658774] w-full" />
                                                    </div>
                                                    <span className="text-[14px] font-medium text-[#344054]">100%</span>
                                                </div>
                                            </div>
                                            <button type="button" onClick={() => setFile(null)}
                                                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                                                <Trash01 className="w-5 h-5 text-[#667085]" />
                                            </button>
                                        </div>
                                    )}

                                    {/* Templates */}
                                    <div className="flex flex-col gap-2">
                                        <p className="text-[14px] font-medium text-[#667085]">Download our data templates for mapping your data</p>
                                        <div className="flex gap-4">
                                            <TemplateCard kind="CSV" name="CSV data template.csv" />
                                            <TemplateCard kind="XLSX" name="Excel data template.xlsx" />
                                        </div>
                                    </div>
                                </>
                            )}

                            {step === "mapping" && (
                                <>
                                    {/* Uploaded file summary */}
                                    <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-center gap-3">
                                        <FileTypeIcon kind="CSV" size={40} />
                                        <div className="flex flex-col min-w-0">
                                            <p className="text-[14px] font-medium text-[#344054] truncate">{file?.name ?? "Customer file.csv"}</p>
                                            <p className="text-[14px] text-[#475467]">{file?.sizeLabel ?? "1 MB"} | {TOTAL_ROWS} rows</p>
                                        </div>
                                    </div>

                                    {/* Mapping table — full height (all rows shown); the
                                        modal's content area is the single scroll region. */}
                                    <div className="border-1 border-[#e4e7ec] rounded-[12px] overflow-hidden">
                                        <div className="flex bg-[#f9fafb] border-b border-[#e4e7ec]">
                                            <p className="flex-1 px-6 py-3 text-[12px] font-medium text-[#475467]">Your data column</p>
                                            <p className="w-[316px] px-6 py-3 text-[12px] font-medium text-[#475467]">Customer data column</p>
                                        </div>
                                        {FILE_COLUMNS.map((col, i) => (
                                            <div key={col.id}
                                                className={cn("flex items-center", i < FILE_COLUMNS.length - 1 && "border-b border-[#e4e7ec]")}>
                                                <p className="flex-1 px-6 py-4 text-[14px] text-[#475467]">{col.label}</p>
                                                <div className="w-[316px] px-6 py-3">
                                                    <SelectInput
                                                        value={mapping[col.id] ?? SKIP}
                                                        options={optionsFor(col.id)}
                                                        onChange={v => setMapping(m => ({ ...m, [col.id]: v }))}
                                                        width="w-full"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {step === "summary" && result && (
                                <>
                                    <div className="border-1 border-[#e4e7ec] rounded-[20px] p-6 flex flex-col gap-4 shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]">
                                        <p className="text-[18px] font-semibold text-[#101828] leading-[28px]">Summary</p>
                                        <div className="flex flex-col gap-3">
                                            <SummaryRow label="Total rows" value={result.total} tone="default"
                                                icon={<Database01 className="w-4 h-4 text-[#667085]" />} />
                                            <SummaryRow label="Valid rows" value={result.valid} tone="success"
                                                icon={<CheckCircle className="w-4 h-4 text-[#079455]" />} />
                                            <SummaryRow label="Invalid rows" value={result.invalid} tone="error"
                                                icon={<XCircle className="w-4 h-4 text-[#d92d20]" />} />
                                            <SummaryRow label="Imported rows" value={result.valid} tone="success"
                                                icon={<UploadCloud02 className="w-4 h-4 text-[#079455]" />} />
                                        </div>
                                    </div>

                                    {/* Invalid-rows report — only when some rows failed validation */}
                                    {result.invalid > 0 && (
                                        <div className="flex flex-col gap-2">
                                            <p className="text-[14px] font-medium text-[#667085]">Download the invalid rows data report</p>
                                            <div className="border-1 border-[#e4e7ec] rounded-[12px] p-4 flex items-center gap-3">
                                                <FileTypeIcon kind="XLSX" size={40} />
                                                <div className="flex flex-col min-w-0 flex-1">
                                                    <p className="text-[14px] font-medium text-[#344054] truncate">Invalid rows data report.xlsx</p>
                                                    <p className="text-[14px] text-[#475467]">20 KB</p>
                                                </div>
                                                <button type="button"
                                                    onClick={() => downloadTextFile(
                                                        "invalid-rows-report.csv",
                                                        "Row,Issue\n" + Array.from({ length: result.invalid },
                                                            (_, k) => `${result.valid + k + 1},Missing required field`).join("\n") + "\n",
                                                    )}
                                                    className="w-9 h-9 flex items-center justify-center rounded-[8px] border-1 border-[#d0d5dd] bg-white shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors shrink-0">
                                                    <Download01 className="w-5 h-5 text-[#344054]" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 border-t border-[#e4e7ec] px-6 pt-6 pb-6 flex gap-3">
                            {step === "upload" && (
                                <>
                                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={closeAndReset}>Cancel</Button>
                                    <Button variant="primary" size="lg" className="flex-1" disabled={!file} onClick={goToMapping}>Continue</Button>
                                </>
                            )}
                            {step === "mapping" && (
                                <>
                                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setStep("upload")}>Back</Button>
                                    <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep("loading")}>Import data</Button>
                                </>
                            )}
                            {step === "summary" && (
                                <>
                                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setStep("mapping")}>Back</Button>
                                    <Button variant="primary" size="lg" className="flex-1" onClick={commitImport}>Import file</Button>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
