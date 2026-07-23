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

import { useEffect, useRef, useState } from "react";
import {
    Upload01,
    Building01,
    Check,
    CheckCircle,
    ChevronDown,
    ChevronUp,
    XCircle,
    AlertTriangle,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import type { MigrationCard } from "@/ai-agent/migration/migration-cards";
import { ENTITIES, type EntityKey } from "@/ai-agent/migration/entities";

/** Lookup the plural user-facing name ("customers", "memberships") for a
 *  card's entity string. Falls back to the raw key if the entity isn't
 *  in the registry (shouldn't happen but keeps rendering safe). */
function labelOf(entityKey: string): string {
    return (
        ENTITIES[entityKey as EntityKey]?.label ??
        entityKey.replace(/_/g, " ")
    );
}

/** Callbacks the cards trigger. `send(text)` pushes a user message into
 *  the thread (which drives the model's next tool call); `openUpload()`
 *  fires the hidden file input in the composer.
 *
 *  Phase 3 — the Step-3 column-mapping card needs to persist the user's
 *  dropdown picks so they survive back into the tool calls that follow.
 *  Picks live on `parsedFile.mapping` in ChatThread state; the card
 *  reads the current value via `mappingOverrides` and writes changes
 *  via `onMappingChange`. Both are optional so non-migration MigCards
 *  keep working unchanged. */
export type MigActions = {
    send: (text: string) => void;
    openUpload: () => void;
    mappingOverrides?: Record<string, string | null>;
    onMappingChange?: (source: string, target: string | null) => void;
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
    // Green pill per client 2026-07-23 migration UI review (Figma 214:260316).
    // utility-brand-50 bg / utility-brand-200 border / utility-brand-700 text.
    return (
        <div className="self-start inline-flex items-center px-2 py-0.5 rounded-full bg-[#e9fff3] border border-[#c4edd6] text-[12px] font-medium leading-[18px] text-[#4f6e5d]">
            {step} of 4 steps
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

// ─── Styled dropdown for the column-mapping grid ───────────────────────────
// Figma 214:259141 — replaces the native <select> with a DS-matching
// button + floating menu so we can (a) style it exactly, (b) show
// the warning border/text tokens when a row still needs review, and
// (c) actually fire an onChange (the native <select> in the previous
// build used defaultValue and never notified the parent, so user
// picks were silently thrown away).
const SKIP_KEY = "__skip";
type DropdownOption = { key: string; label: string };
function MappingDropdown({
    value,
    options,
    needsReview,
    onChange,
}: {
    /** Current target: an EntityDef field key, or null = "Skip this column".*/
    value: string | null;
    /** Every valid Onra field for this entity, from EntityDef.fields. */
    options: DropdownOption[];
    /** Renders the warning border + amber text when true (unmatched column). */
    needsReview: boolean;
    onChange: (next: string | null) => void;
}) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    // Close the menu when the user clicks anywhere outside its bounds.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: MouseEvent) => {
            if (!rootRef.current) return;
            if (!rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);
    // Close on Escape for keyboard users.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open]);
    const selectedLabel =
        value === null
            ? "Skip this column"
            : options.find((o) => o.key === value)?.label ?? value;
    const Chevron = open ? ChevronUp : ChevronDown;
    return (
        <div ref={rootRef} className="relative w-full max-w-[282px]">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                className={cn(
                    "flex w-full items-center gap-2 px-3.5 py-2.5 rounded-md bg-white",
                    "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    "text-left text-[16px] leading-6",
                    needsReview
                        ? "border border-[#fec84b] text-[#dc6803]"
                        : "border border-[#d0d5dd] text-[#101828]",
                )}
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="flex-1 min-w-0 truncate">{selectedLabel}</span>
                <Chevron className="size-5 shrink-0 text-[#667085]" />
            </button>
            {open && (
                <div
                    className={cn(
                        "absolute left-0 right-0 top-full mt-1 z-40",
                        "bg-white border border-[#e4e7ec] rounded-md py-1",
                        "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                        "max-h-[280px] overflow-y-auto",
                    )}
                    role="listbox"
                >
                    <DropdownItem
                        label="Skip this column"
                        selected={value === null}
                        onSelect={() => {
                            onChange(null);
                            setOpen(false);
                        }}
                    />
                    {options.map((o) => (
                        <DropdownItem
                            key={o.key}
                            label={o.label}
                            selected={value === o.key}
                            onSelect={() => {
                                onChange(o.key);
                                setOpen(false);
                            }}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
function DropdownItem({
    label,
    selected,
    onSelect,
}: {
    label: string;
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className="w-full flex items-center gap-2 px-1.5 py-px"
            role="option"
            aria-selected={selected}
        >
            <span
                className={cn(
                    "flex-1 flex items-center gap-2 rounded-md py-2.5 pl-2 pr-2.5",
                    selected ? "bg-[#f9fafb]" : "hover:bg-[#f9fafb]",
                )}
            >
                <span className="flex-1 text-left text-[14px] leading-5 font-medium text-[#344054]">
                    {label}
                </span>
                {selected && (
                    <Check className="size-5 shrink-0 text-[#344054]" />
                )}
            </span>
        </button>
    );
}

// ─── Chat-bubble variant used by the mapping intro (Step 3) ────────────────
// Figma 214:260316 — the friendly "Review & mapping" text that lands BEFORE
// the actual dropdown grid. Copy is derived from the propose_mapping result:
// mapped count, total column count, and the list of unmatched source
// headers get inlined into the sentence.
function MappingIntroBubble({
    step,
    mappedCount,
    totalCount,
    unmatchedSources,
}: {
    step: number;
    mappedCount: number;
    totalCount: number;
    unmatchedSources: string[];
}) {
    const needsReview = unmatchedSources.length;
    // Human-friendly enumeration: "a", "a and b", "a, b, and c".
    const enumerate = (items: string[]) => {
        if (items.length === 0) return "";
        if (items.length === 1) return items[0];
        if (items.length === 2) return `${items[0]} and ${items[1]}`;
        return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
    };
    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec]",
                "rounded-tl-[4px] rounded-tr-[20px] rounded-bl-[20px] rounded-br-[20px]",
                "p-4 flex flex-col gap-4 max-w-[612px] min-h-[56px]",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
            )}
        >
            <div className="flex flex-col gap-2 w-full">
                <StepBadge step={step} />
                <div className="flex flex-col gap-1 w-full">
                    <h4 className="text-[16px] font-semibold leading-6 text-[#101828]">
                        Review &amp; mapping
                    </h4>
                    <div className="flex flex-col gap-3 text-[14px] leading-5 text-[#344054]">
                        {needsReview > 0 ? (
                            <p>
                                I&rsquo;ve mapped {mappedCount} of {totalCount} columns automatically. What would you like to do with the {needsReview} unmatched column{needsReview === 1 ? "" : "s"} (
                                <span className="font-semibold">
                                    {enumerate(unmatchedSources)}
                                </span>
                                )?
                            </p>
                        ) : (
                            <p>
                                I&rsquo;ve mapped all {totalCount} column{totalCount === 1 ? "" : "s"} automatically.
                            </p>
                        )}
                        <p>
                            You can review and map them manually, or continue with the recommended mappings.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Chat-bubble variant used by the branch-detected step ──────────────────
// Figma 154:576479 — asymmetric-radius speech bubble with the greeting on
// top and a compact branch list below. No step badge, no file-preview
// block, no in-card action buttons per client 2026-07-23 review of the
// migration flow images.
function BranchDetectedBubble({
    rows,
}: {
    rows: { branch_name: string; count: number }[];
}) {
    return (
        <div
            className={cn(
                "bg-white border border-[#e4e7ec]",
                "rounded-tl-[4px] rounded-tr-[20px] rounded-bl-[20px] rounded-br-[20px]",
                "p-4 flex flex-col gap-4 max-w-[612px]",
                "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
            )}
        >
            <p className="text-[14px] leading-5 text-[#344054]">
                I found branch data in your file and assigned records automatically.
            </p>
            <div className="flex flex-col gap-1">
                {rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-px">
                        <Building01 className="size-4 text-[#344054] shrink-0" />
                        <span className="text-[14px] font-medium text-[#344054] leading-5">
                            {r.branch_name}
                        </span>
                        <span className="text-[14px] text-[#667085] leading-5 tabular-nums">
                            : {r.count.toLocaleString("en-US")} rows
                        </span>
                    </div>
                ))}
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
        // Detected path — chat-bubble rendition (Figma 154:576479).
        // Copy is deliberately static per Figma; the row-count/branch-list
        // below carries the dynamic detail. StepBadge, file preview and the
        // "Continue to mapping" button are removed — the AI auto-chains
        // propose_mapping on the same turn (see buildMigrationPrompt).
        if (data.rows.length > 0) {
            return (
                <BranchDetectedBubble rows={data.rows} />
            );
        }
        // status === "none" (branches exist, but no branch column was found)
        // — Flow B. Left in the legacy card shell until Phase 6 wires the
        // branch-picker chips.
        return (
            <CardShell>
                <StepBadge step={data.step} />
                {data.note && <CardBody>{data.note}</CardBody>}
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
        // Figma 214:260316 — the friendly "Review & mapping" intro bubble
        // renders ABOVE the dropdown grid so the user reads the situation
        // before being asked to review the rows.
        //
        // Figma 214:259141 — the grid itself uses the DS "Migrate data /
        // Column mapping" panel: title + counts on top, an internal
        // scrolling table below. Each row's dropdown is now backed by
        // parsedFile.mapping (via MigActions.mappingOverrides + onMappingChange)
        // so user picks actually persist and thread through to
        // preview_import / commit_import. Action buttons live above the
        // composer per the client's chip-panel pattern — see the pending
        // panel in ChatThread.
        const overrides = act.mappingOverrides ?? {};
        // Effective mapping = server auto-map overridden by user picks.
        // Rows are `needs_review` when the effective target is still null.
        const rowsWithEffective = data.mappings.map((m) => {
            const hasOverride = Object.prototype.hasOwnProperty.call(
                overrides,
                m.source,
            );
            const target = hasOverride ? overrides[m.source] : m.target;
            return {
                source: m.source,
                target,
                needsReview: target === null,
            };
        });
        const mappedCount = rowsWithEffective.filter((r) => !r.needsReview).length;
        const needsReviewCount = rowsWithEffective.length - mappedCount;
        const unmatchedSources = rowsWithEffective
            .filter((r) => r.needsReview)
            .map((r) => r.source);
        return (
            <div className="flex flex-col gap-4">
                <MappingIntroBubble
                    step={data.step}
                    mappedCount={mappedCount}
                    totalCount={rowsWithEffective.length}
                    unmatchedSources={unmatchedSources}
                />
                <div
                    className={cn(
                        "bg-white border border-[#e4e7ec] rounded-2xl p-4",
                        "flex flex-col gap-4 max-w-[720px] w-full",
                        "shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]",
                    )}
                >
                    <div className="flex items-center gap-4 w-full">
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[16px] font-semibold leading-6 text-[#101828]">
                                Column mapping
                            </h4>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#ecfdf3] border border-[#abefc6] text-[12px] font-medium leading-[18px] text-[#067647]">
                                {mappedCount} mapped
                            </span>
                            {needsReviewCount > 0 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fffaeb] border border-[#fedf89] text-[12px] font-medium leading-[18px] text-[#b54708]">
                                    {needsReviewCount} need review
                                </span>
                            )}
                        </div>
                    </div>
                    <div
                        className={cn(
                            "bg-white border border-[#e4e7ec] rounded-xl overflow-hidden",
                            "max-h-[428px] overflow-y-auto",
                        )}
                    >
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left bg-[#f9fafb] border-b border-[#e4e7ec] px-6 py-3 text-[12px] font-medium leading-[18px] text-[#475467]">
                                        Incoming fields
                                    </th>
                                    <th className="text-left bg-[#f9fafb] border-b border-[#e4e7ec] px-6 py-3 text-[12px] font-medium leading-[18px] text-[#475467]">
                                        Onra fields
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rowsWithEffective.map((r) => (
                                    <tr
                                        key={r.source}
                                        className="border-b border-[#e4e7ec] last:border-b-0"
                                    >
                                        <td className="px-6 py-4 text-[14px] leading-5 text-[#475467] align-middle whitespace-nowrap">
                                            {r.source}
                                        </td>
                                        <td className="px-6 py-4 align-middle">
                                            <MappingDropdown
                                                value={r.target}
                                                options={data.targetOptions}
                                                needsReview={r.needsReview}
                                                onChange={(next) =>
                                                    act.onMappingChange?.(
                                                        r.source,
                                                        next,
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Step 4: mapping_summary ──────────────────────────────────────────
    if (data.card === "mapping_summary") {
        const t = data.totals;
        return (
            <CardShell>
                <div className="flex items-center gap-2 flex-wrap">
                    <StepBadge step={data.step} />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#f9fafb] border border-[#eaecf0] text-[11px] font-medium text-[#475467] capitalize">
                        {labelOf(data.entity)}
                    </span>
                </div>
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
                        Nothing to import yet — upload your {labelOf(data.entity)}{" "}
                        export to begin.
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
