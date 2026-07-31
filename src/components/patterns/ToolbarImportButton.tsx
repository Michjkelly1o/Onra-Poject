"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Shared ToolbarImportButton
// ─────────────────────────────────────────────────────────────────────────────
//
// The icon-only "Import" button that opens the AI Agent's Migrate Data thread,
// scoped back to the caller via `returnTo`. Sits in the toolbar row.
//
// Placement rule (client feedback_toolbar_import_order, in memory) — this
// button MUST render IMMEDIATELY after the Filter icon button, before any
// primary "Add new" button. Never on the far right alone, never before Filter.
//
// Visibility rule (client 2026-07-31) — one of two policies at the call site:
//
//   1. `alwaysShow` — the Retail catalogue is bulk-imported often enough that
//      Import stays visible even when the table has data. This is the ONLY
//      list surface that ships with alwaysShow=true today.
//
//   2. Default (empty-state only) — every other list module shows Import ONLY
//      when the table is empty AND no active search / filter narrows it down.
//      Once real data lands, Import hides and "Add new" is the sole entry
//      point. Callers decide when the table is "genuinely empty" and pass
//      that boolean via `visible`.
//
// Wire: click routes to `/ai-agent?thread=migrate_data&returnTo=<pathname>`.
// The AI Agent then asks the user which entity they're importing — the same
// generic entry point the current Retail Import button uses. Nothing entity-
// specific in the URL; the wizard picks it up from the conversation.

import { useRouter, usePathname } from "next/navigation";
import { Upload01 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { IconTooltip } from "@/components/patterns/IconTooltip";

export interface ToolbarImportButtonProps {
    /** When false, the button renders `null` (empty-state gate for
     *  every module except Retail). Callers derive this from
     *  something like `rows.length === 0 && !hasSearch && !hasFilter`
     *  so a search hitting 0 rows does NOT re-surface Import — the
     *  hint would confuse admins into thinking their data was gone.
     *  Default `true` so pages that always want it (Retail) can omit. */
    visible?: boolean;
    /** Optional override for the AI Agent's back-link. Defaults to the
     *  current pathname so the agent's close (X) puts the user back on
     *  the list they came from. */
    returnTo?: string;
}

export function ToolbarImportButton({ visible = true, returnTo }: ToolbarImportButtonProps) {
    const router = useRouter();
    const pathname = usePathname();
    if (!visible) return null;
    const back = returnTo ?? pathname ?? "/admin/dashboard";
    return (
        <IconTooltip label="Import">
            <Button
                variant="secondary-gray"
                size="icon"
                aria-label="Import"
                onClick={() => router.push(
                    `/ai-agent?thread=migrate_data&returnTo=${encodeURIComponent(back)}`,
                )}
            >
                <Upload01 className="w-5 h-5" />
            </Button>
        </IconTooltip>
    );
}
