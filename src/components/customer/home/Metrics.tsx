// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Customer Metrics grid (PRD 13 §6.4)
// ─────────────────────────────────────────────────────────────────────────────
//
// Built from scratch. Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 4110-39606 ("Metrics").
// A 2-col grid of bordered, rounded, soft-green-gradient tiles. Three are a
// number + label; the streak tile is a 7-dot row (filled days green, rest gray)
// + label. Dot SVGs (gloss + shadow) live under /public/customer/achievement/.
//
// DOM order is row-major so the default grid auto-flow places them exactly as in
// Figma: col1 = Total / This-month, col2 = Streak / Remaining.

const TILE_BG =
    "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 165.5 87' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(-0.0000011111 10.825 -20.593 -0.0000021284 82.75 -21.252)'><stop stop-color='rgba(223,246,237,1)' offset='0'/><stop stop-color='rgba(255,255,255,1)' offset='1'/></radialGradient></defs></svg>\")";

const STREAK_DOTS = 7;

function tileStyle() {
    return { backgroundImage: TILE_BG, backgroundSize: "100% 100%" } as const;
}

const TILE_CLASS =
    "rounded-2xl border border-[var(--colors-border-secondary,#e4e7ec)] p-4";

function MetricTile({ value, label }: { value: string; label: string }) {
    return (
        <div className={`flex min-h-[87px] items-center justify-center ${TILE_CLASS}`} style={tileStyle()}>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <p className="whitespace-nowrap text-xl font-semibold leading-[30px] text-[#101828]">{value}</p>
                <p className="whitespace-nowrap text-xs font-normal leading-[18px] text-[#667085]">{label}</p>
            </div>
        </div>
    );
}

function StreakDot({ filled }: { filled: boolean }) {
    const src = filled ? "/customer/achievement/dot-green.svg" : "/customer/achievement/dot-gray.svg";
    return (
        <span className="relative block size-4 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="absolute left-1/2 top-1/2 size-6 max-w-none -translate-x-1/2 -translate-y-1/2" />
        </span>
    );
}

function StreakTile({ days }: { days: number }) {
    const filledCount = Math.max(0, Math.min(days, STREAK_DOTS));
    return (
        <div className={`flex min-h-[87px] items-start ${TILE_CLASS}`} style={tileStyle()}>
            <div className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2">
                <div className="flex w-full items-center justify-between">
                    {Array.from({ length: STREAK_DOTS }).map((_, i) => (
                        <StreakDot key={i} filled={i < filledCount} />
                    ))}
                </div>
                <p className="w-full text-sm font-semibold leading-5 text-[#101828]">{days}-Day Streak!</p>
            </div>
        </div>
    );
}

export interface MetricsProps {
    totalClasses: number;
    classesThisMonth: number;
    dayStreak: number;
    /** Display string for "Classes remaining" (e.g. "20", or "∞" for unlimited). */
    classesRemaining: string;
}

export function Metrics({ totalClasses, classesThisMonth, dayStreak, classesRemaining }: MetricsProps) {
    return (
        <div className="grid w-full grid-cols-2 gap-3">
            <MetricTile value={String(totalClasses)} label="Total classes" />
            <StreakTile days={dayStreak} />
            <MetricTile value={String(classesThisMonth)} label="Classes this month" />
            <MetricTile value={classesRemaining} label="Classes remaining" />
        </div>
    );
}
