"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — Time Zone bottom sheet (Search / Appointments)
// ─────────────────────────────────────────────────────────────────────────────
//
// Opened from the schedule/slot timezone pill. Shows the BRANCH's time zone and —
// only when the customer's device zone is OUTSIDE the branch's — their local zone
// with a "Your time" badge + a compact out-of-zone alert. Selecting a row sets the
// display timezone. When in the same zone, only the branch row is shown.

import { Lightbulb02 } from "@untitledui/icons";
import type { Branch } from "@/data/mock/_types";
import { branchTimezone } from "@/lib/branch-time";
import { cityForZone, offsetLabel, offsetForCity } from "@/lib/customer/timezones";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { RadioDot } from "@/components/customer/shell/SelectIndicators";
import { Button } from "@/components/ui/button";

function ZoneRow({
    city,
    offset,
    yourTime,
    selected,
    onClick,
}: {
    city: string;
    offset: string;
    yourTime?: boolean;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button type="button" onClick={onClick} aria-pressed={selected} className="flex w-full items-center gap-3 py-4 text-left">
            <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-base font-medium leading-6 text-[var(--brand-text)]">{city}</span>
                {yourTime && (
                    <span className="shrink-0 rounded-md border border-[#e4e7ec] bg-[#f9fafb] px-2 py-0.5 text-xs font-medium leading-[18px] text-[#344054]">
                        Your time
                    </span>
                )}
            </span>
            <span className="shrink-0 text-base font-normal leading-6 text-[#475467]">{offset}</span>
            <RadioDot checked={selected} />
        </button>
    );
}

export function TimeZoneSheet({
    open,
    onClose,
    branch,
    localCity,
    value,
    onSelect,
    onConfirm,
    confirmLabel = "Confirm",
}: {
    open: boolean;
    onClose: () => void;
    branch: Pick<Branch, "timezone" | "country" | "state" | "city"> | null | undefined;
    /** Device-detected local timezone city. */
    localCity: string;
    /** Current display timezone city. */
    value: string;
    onSelect: (city: string) => void;
    /** When set, a Confirm button is shown; tapping it runs this then closes. */
    onConfirm?: () => void;
    confirmLabel?: string;
}) {
    const branchZone = branchTimezone(branch);
    const branchCity = cityForZone(branchZone) ?? "Branch";
    const branchOffset = offsetLabel(branchZone);
    const localOffset = offsetForCity(localCity);
    const outOfZone = branchOffset !== localOffset;

    return (
        <CustomerSheet open={open} onClose={onClose}>
            <SheetToolbar title="Time zone" onClose={onClose} />
            <div className="flex flex-col">
                <ZoneRow
                    city={branchCity}
                    offset={branchOffset}
                    selected={!outOfZone || value === branchCity}
                    onClick={() => onSelect(branchCity)}
                />
                {outOfZone && (
                    <>
                        <ZoneRow
                            city={localCity}
                            offset={localOffset}
                            yourTime
                            selected={value !== branchCity}
                            onClick={() => onSelect(localCity)}
                        />
                        <div className="mt-2 flex items-start gap-3 rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-tertiary)] p-4">
                            <Lightbulb02 className="size-5 shrink-0 text-[var(--brand-primary)]" aria-hidden />
                            <p className="text-sm font-normal leading-5 text-[#475467]">
                                You&apos;re outside the branch&apos;s time zone — times show in your local time.
                            </p>
                        </div>
                    </>
                )}
            </div>
            {onConfirm && (
                <Button
                    variant="primary"
                    size="xl"
                    className="mt-5 w-full rounded-full"
                    onClick={() => {
                        onConfirm();
                        onClose();
                    }}
                >
                    {confirmLabel}
                </Button>
            )}
        </CustomerSheet>
    );
}
