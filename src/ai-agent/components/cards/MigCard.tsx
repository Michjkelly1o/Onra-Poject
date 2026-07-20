// ─────────────────────────────────────────────────────────────────────────────
// Onra AI Agent · Migration card dispatcher (Phase 7)
// ─────────────────────────────────────────────────────────────────────────────
//
// The migration counterpart of Card.tsx. Renders one of the 5 migration
// card shapes returned by migrationTools:
//   • source_options    — Step 1: platform chips + Upload button
//   • branch_assignment — Step 2: file read-back + branch counts
//   • column_mapping    — Step 3: source → Onra field dropdown grid
//   • mapping_summary   — Step 4: dry-run counts + confirm buttons
//   • import_result     — Terminal: created / skipped / failed tiles
//
// Every action button calls back into the ChatThread via the `act`
// prop — sending a preset text message (which triggers the next tool)
// or opening the file picker. Same pattern as the POC's MigrationCards.tsx,
// styled in Tailwind against the Syncfit DS.

"use client";

import {
    Upload01,
    File04,
    Building01,
    CheckCircle,
    XCircle,
    AlertTriangle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import type { MigrationCard } from "@/ai-agent/migration/migration-cards";

/** Callbacks the cards trigger. `send(text)` pushes a user message into
 *  the thread (which drives the model's next tool call); `openUpload()`
 *  fires the hidden file input in the composer. */
export type MigActions = {
    send: (text: string) => void;
    openUpload: () => void;
};

function CardShell({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec] rounded-xl p-4",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "flex flex-col gap-3",
                className,
            )}
        >
            {children}
        </div>
    );
}

function StepBadge({ step }: { step: number }) {
    return (
        <div className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f9fafb] border border-[#eaecf0] text-[11px] font-medium text-[#475467]">
            Step {step} of 4
        </div>
    );
}

function CardTitle({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="text-[16px] font-semibold text-[#101828] leading-6">
            {children}
        </h4>
    );
}

function CardBody({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[13px] text-[#475467] leading-5">{children}</p>
    );
}

function PrimaryButton({
    onClick,
    children,
}: {
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-9 px-3 inline-flex items-center gap-2 rounded-md",
                "bg-[#c4edd6] text-[#0c2d34] text-[13px] font-medium border-1 border-white/[0.12]",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)]",
                "hover:bg-[#aad4bd] transition-colors",
            )}
        >
            {children}
        </button>
    );
}

function SecondaryButton({
    onClick,
    children,
}: {
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "h-9 px-3 inline-flex items-center gap-2 rounded-md",
                "bg-white text-[#344054] text-[13px] font-medium border border-[#d0d5dd]",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                "hover:bg-[#f9fafb] transition-colors",
            )}
        >
            {children}
        </button>
    );
}

// ─── Reusable count tile ────────────────────────────────────────────────────

type Tone = "green" | "red" | "amber" | undefined;
const TONE_COLOR: Record<NonNullable<Tone>, string> = {
    green: "#658774",
    red:   "#b42318",
    amber: "#b54708",
};

function Tile({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone?: Tone;
}) {
    const color = tone ? TONE_COLOR[tone] : "#101828";
    return (
        <div className="rounded-lg bg-[#f9fafb] border border-[#eaecf0] p-3 flex flex-col gap-1">
            <div className="text-[12px] text-[#667085] leading-4">{label}</div>
            <div
                className="text-[20px] font-semibold leading-7 tabular-nums"
                style={{ color }}
            >
                {value.toLocaleString("en-US")}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export function MigCard({
    data,
    act,
}: {
    data: MigrationCard;
    act: MigActions;
}) {
    if (!data || typeof data !== "object" || !("card" in data)) return null;

    // ─── Step 1: source_options ───────────────────────────────────────────
    if (data.card === "source_options") {
        return (
            <CardShell>
                <StepBadge step={data.step} />
                <CardTitle>{data.title}</CardTitle>
                <CardBody>{data.body}</CardBody>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                    {data.platforms.map((p) => {
                        const isUpload = p.slug === "upload";
                        return (
                            <button
                                key={p.slug}
                                type="button"
                                onClick={() =>
                                    isUpload
                                        ? act.openUpload()
                                        : act.send(
                                              `I'm migrating from ${p.name}. I'll upload my customer export.`,
                                          )
                                }
                                className={cn(
                                    "h-10 px-3 rounded-md inline-flex items-center justify-center gap-2 text-[13px] font-medium transition-colors",
                                    isUpload
                                        ? "bg-[#c4edd6] text-[#0c2d34] border-1 border-white/[0.12] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05),inset_0px_0px_0px_1px_rgba(16,24,40,0.18),inset_0px_-2px_0px_0px_rgba(16,24,40,0.05)] hover:bg-[#aad4bd]"
                                        : "bg-white text-[#344054] border border-[#d0d5dd] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb]",
                                )}
                            >
                                {isUpload && <Upload01 className="size-4" />}
                                {p.name}
                            </button>
                        );
                    })}
                </div>
                <div className="text-[12px] text-[#667085] leading-4 mt-1">
                    Choose your platform, then click{" "}
                    <span className="font-semibold text-[#344054]">
                        Upload file
                    </span>{" "}
                    (or the paperclip 📎) to add your CSV — I&apos;ll read
                    your actual data.
                </div>
            </CardShell>
        );
    }

    // ─── Step 2: branch_assignment ─────────────────────────────────────────
    if (data.card === "branch_assignment") {
        if (data.blocked?.reason === "no_branches") {
            return (
                <CardShell>
                    <StepBadge step={data.step} />
                    <div className="flex items-start gap-2">
                        <AlertTriangle className="size-5 text-[#b54708] shrink-0 mt-0.5" />
                        <CardBody>
                            I couldn&apos;t find a branch column, and no
                            studio branches exist yet. Create a branch first
                            to continue assigning imported records.
                        </CardBody>
                    </div>
                    <div className="mt-1">
                        <PrimaryButton
                            onClick={() => act.send("Add a new branch")}
                        >
                            + Add new branch
                        </PrimaryButton>
                    </div>
                </CardShell>
            );
        }
        return (
            <CardShell>
                <StepBadge step={data.step} />
                {data.filename && (
                    <div className="rounded-lg border border-[#eaecf0] bg-[#f9fafb] p-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <File04 className="size-4 text-[#667085]" />
                            <span className="text-[14px] font-medium text-[#101828] truncate flex-1">
                                {data.filename}
                            </span>
                            <span className="text-[12px] text-[#667085] tabular-nums shrink-0">
                                {data.rowCount} rows ·{" "}
                                {data.columns?.length ?? 0} columns
                            </span>
                        </div>
                        {data.columns && (
                            <div className="flex flex-wrap gap-1">
                                {data.columns.map((c) => (
                                    <span
                                        key={c}
                                        className="text-[11px] leading-4 px-2 py-0.5 rounded-full bg-white border border-[#eaecf0] text-[#475467]"
                                    >
                                        {c}
                                    </span>
                                ))}
                            </div>
                        )}
                        {data.sample && data.sample.length > 0 && (
                            <div className="overflow-x-auto rounded border border-[#eaecf0] bg-white">
                                <table className="w-full text-[12px] border-collapse">
                                    <thead>
                                        <tr>
                                            {data.columns
                                                ?.slice(0, 5)
                                                .map((c) => (
                                                    <th
                                                        key={c}
                                                        className="text-left font-medium text-[#667085] py-1.5 px-2 whitespace-nowrap border-b border-[#eaecf0]"
                                                    >
                                                        {c}
                                                    </th>
                                                ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.sample.map((row, i) => (
                                            <tr
                                                key={i}
                                                className="border-b border-[#f2f4f7] last:border-b-0"
                                            >
                                                {row.map((cell, j) => (
                                                    <td
                                                        key={j}
                                                        className="text-[#344054] py-1.5 px-2 whitespace-nowrap"
                                                    >
                                                        {cell}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
                {data.note && <CardBody>{data.note}</CardBody>}
                {data.rows.length > 0 && (
                    <div className="flex flex-col gap-1">
                        {data.rows.map((r, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-[#f9fafb] border border-[#eaecf0]"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Building01 className="size-4 text-[#667085] shrink-0" />
                                    <span className="text-[13px] font-medium text-[#101828] truncate">
                                        {r.branch_name}
                                    </span>
                                </div>
                                <span className="text-[13px] text-[#667085] tabular-nums shrink-0">
                                    {r.count} rows
                                </span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="mt-1">
                    <PrimaryButton
                        onClick={() =>
                            act.send("Looks good — map the columns.")
                        }
                    >
                        Continue to mapping
                    </PrimaryButton>
                </div>
            </CardShell>
        );
    }

    // ─── Step 3: column_mapping ───────────────────────────────────────────
    if (data.card === "column_mapping") {
        return (
            <CardShell>
                <StepBadge step={data.step} />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle>Column mapping</CardTitle>
                    <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[11px] font-medium text-[#067647]">
                            <CheckCircle className="size-3" />
                            {data.summary.mapped} mapped
                        </span>
                        {data.summary.needs_review > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fffaeb] border border-[#fedf89] text-[11px] font-medium text-[#b54708]">
                                <AlertTriangle className="size-3" />
                                {data.summary.needs_review} need review
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    {data.mappings.map((m, i) => (
                        <div
                            key={i}
                            className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1"
                        >
                            <div className="text-[13px] font-medium text-[#344054] truncate">
                                {m.source}
                            </div>
                            <div className="text-[#98a2b3] text-[12px]">→</div>
                            <select
                                defaultValue={m.target ?? "__skip"}
                                className={cn(
                                    "h-9 px-2 rounded-md text-[13px] bg-white border",
                                    m.status === "needs_review"
                                        ? "border-[#fedf89] text-[#b54708]"
                                        : "border-[#d0d5dd] text-[#344054]",
                                )}
                            >
                                <option value="__skip">
                                    Skip this column
                                </option>
                                {data.targetOptions.map((o) => (
                                    <option key={o.key} value={o.key}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 mt-1">
                    <PrimaryButton
                        onClick={() =>
                            act.send(
                                "Accept all suggested mappings and preview the import.",
                            )
                        }
                    >
                        <CheckCircle className="size-4" />
                        Accept all suggestions
                    </PrimaryButton>
                    <SecondaryButton
                        onClick={() =>
                            act.send(
                                "Skip the unmatched columns and preview the import.",
                            )
                        }
                    >
                        Skip unmatched
                    </SecondaryButton>
                </div>
            </CardShell>
        );
    }

    // ─── Step 4: mapping_summary ──────────────────────────────────────────
    if (data.card === "mapping_summary") {
        const t = data.totals;
        return (
            <CardShell>
                <StepBadge step={data.step} />
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle>Summary</CardTitle>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[11px] font-medium text-[#067647]">
                        {data.columnsNote}
                    </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Tile label="Total rows" value={t.total} />
                    <Tile label="Valid rows" value={t.valid} tone="green" />
                    <Tile
                        label="Invalid rows"
                        value={t.invalid}
                        tone={t.invalid ? "red" : undefined}
                    />
                    <Tile
                        label="Duplicate rows"
                        value={t.duplicate}
                        tone={t.duplicate ? "amber" : undefined}
                    />
                </div>
                {data.fields.length > 0 && (
                    <div className="overflow-x-auto rounded border border-[#eaecf0]">
                        <table className="w-full text-[13px] border-collapse">
                            <thead>
                                <tr className="bg-[#f9fafb]">
                                    <th className="text-left font-medium text-[#667085] py-2 px-3 border-b border-[#eaecf0]">
                                        Incoming field
                                    </th>
                                    <th className="text-left font-medium text-[#667085] py-2 px-3 border-b border-[#eaecf0]">
                                        Onra field
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.fields.map((f, i) => (
                                    <tr
                                        key={i}
                                        className="border-b border-[#f2f4f7] last:border-b-0"
                                    >
                                        <td className="text-[#344054] py-2 px-3">
                                            {f.source}
                                        </td>
                                        <td className="py-2 px-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[11px] font-medium text-[#067647]">
                                                {f.target}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex gap-2 mt-1">
                    <PrimaryButton
                        onClick={() => act.send("Yes, start the import.")}
                    >
                        <CheckCircle className="size-4" />
                        Yes, start import
                    </PrimaryButton>
                    <SecondaryButton
                        onClick={() =>
                            act.send("No, take me back to mapping.")
                        }
                    >
                        <XCircle className="size-4" />
                        No, back to mapping
                    </SecondaryButton>
                </div>
            </CardShell>
        );
    }

    // ─── Terminal: import_result ─────────────────────────────────────────
    if (data.card === "import_result") {
        if (data.created + data.skipped + data.failed === 0) {
            return (
                <CardShell>
                    <CardBody>
                        Nothing to import yet — upload your customer export
                        to begin.
                    </CardBody>
                </CardShell>
            );
        }
        return (
            <CardShell>
                <div className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfdf3] border border-[#abefc6]">
                    <CheckCircle className="size-3.5 text-[#067647]" />
                    <span className="text-[12px] font-medium text-[#067647]">
                        Import complete
                    </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <Tile
                        label="Created"
                        value={data.created}
                        tone="green"
                    />
                    <Tile
                        label="Skipped (dupes)"
                        value={data.skipped}
                        tone="amber"
                    />
                    <Tile
                        label="Failed"
                        value={data.failed}
                        tone={data.failed ? "red" : undefined}
                    />
                </div>
            </CardShell>
        );
    }

    return null;
}
