// ─────────────────────────────────────────────────────────────────────────────
// Customer Home — Achievement Highlight card (PRD 13 §6.3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Built from scratch for the member surface. Figma: 9ByGNc4N7Vw3BLMHyaWJ1j
// node 4110-39606 ("Level"). A bordered, rounded card with a soft green radial
// gradient, a masked dotted-texture decoration in the top-right, and an
// iridescent diamond badge with a star. Decorative assets live under
// /public/customer/achievement/* (downloaded from Figma for durability); the card
// + diamond gradients are self-contained inline SVG/CSS from the design.

const CARD_BG =
    "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 343 88' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><rect x='0' y='0' height='100%' width='100%' fill='url(%23grad)' opacity='1'/><defs><radialGradient id='grad' gradientUnits='userSpaceOnUse' cx='0' cy='0' r='10' gradientTransform='matrix(-0.0000023028 10.95 -42.679 -0.0000021528 171.5 -21.497)'><stop stop-color='rgba(223,246,237,1)' offset='0'/><stop stop-color='rgba(255,255,255,1)' offset='1'/></radialGradient></defs></svg>\")";

const DIAMOND_BG =
    "linear-gradient(137.94824885074541deg, rgb(177, 231, 201) 2.2809%, rgb(234, 239, 243) 19.802%, rgb(216, 243, 228) 32.943%, rgb(255, 255, 255) 50.165%, rgb(196, 237, 214) 62.146%, rgb(216, 243, 228) 78.694%, rgb(216, 243, 228) 95.241%), linear-gradient(250.4077249751242deg, rgb(122, 150, 172) 16.984%, rgb(234, 239, 243) 31.292%, rgb(194, 212, 225) 42.023%, rgb(255, 255, 255) 56.087%, rgb(212, 222, 229) 65.87%, rgb(171, 189, 200) 79.383%, rgb(188, 202, 215) 92.896%), url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 42 42' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><g transform='matrix(2.9531 -1.4569 0.77129 1.5634 12.994 9.7125)' opacity='1'><rect height='314.35' width='112.15' fill='url(%23grad)' id='quad' shape-rendering='crispEdges'/><use href='%23quad' transform='scale(1 -1)'/><use href='%23quad' transform='scale(-1 1)'/><use href='%23quad' transform='scale(-1 -1)'/></g><defs><linearGradient id='grad' gradientUnits='userSpaceOnUse' x2='5' y2='5'><stop stop-color='rgba(255,159,234,1)' offset='0'/><stop stop-color='rgba(255,255,255,0)' offset='1'/></linearGradient></defs></svg>\"), url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 42 42' xmlns='http://www.w3.org/2000/svg' preserveAspectRatio='none'><g transform='matrix(6.5818 -2.0714 2.0714 6.5818 -6.825 30.8)' opacity='1'><rect height='72.373' width='60.345' fill='url(%23grad)' id='quad' shape-rendering='crispEdges'/><use href='%23quad' transform='scale(1 -1)'/><use href='%23quad' transform='scale(-1 1)'/><use href='%23quad' transform='scale(-1 -1)'/></g><defs><linearGradient id='grad' gradientUnits='userSpaceOnUse' x2='5' y2='5'><stop stop-color='rgba(163,73,239,1)' offset='0.42188'/><stop stop-color='rgba(209,87,235,1)' offset='0.71094'/><stop stop-color='rgba(255,101,230,1)' offset='1'/></linearGradient></defs></svg>\")";

/** Top-right masked dotted-texture decoration (Figma "pixels"). */
function PixelsDecoration() {
    return (
        <div
            aria-hidden
            className="pointer-events-none absolute size-[380.594px]"
            style={{
                right: "-150px",
                top: "50%",
                transform: "translateY(-50%)",
                WebkitMaskImage: "url(/customer/achievement/pixels-mask.svg)",
                maskImage: "url(/customer/achievement/pixels-mask.svg)",
                WebkitMaskSize: "202.328px 202.329px",
                maskSize: "202.328px 202.329px",
                WebkitMaskPosition: "89.133px 89.133px",
                maskPosition: "89.133px 89.133px",
                WebkitMaskRepeat: "no-repeat",
                maskRepeat: "no-repeat",
            }}
        >
            <div
                className="size-full"
                style={{
                    backgroundImage: "url(/customer/achievement/texture.png)",
                    backgroundSize: "240px 240px",
                    backgroundPosition: "top left",
                }}
            />
        </div>
    );
}

/** Iridescent diamond badge with a star (Figma "Diamond"). */
function DiamondBadge() {
    return (
        <div className="relative size-[56px] shrink-0">
            <div className="absolute left-[-1.39px] top-[-1.7px] flex size-[59.397px] items-center justify-center">
                <div className="-rotate-45">
                    <div className="relative size-[42px]">
                        <div className="absolute left-0 top-0 size-[42px] rounded-[9.373px] border-[0.744px] border-white shadow-[0px_1.317px_5.951px_0px_rgba(0,0,0,0.05),0px_1.317px_21.965px_0px_rgba(215,226,236,0.34)]">
                            <div aria-hidden className="absolute inset-0 rounded-[9.373px]" style={{ backgroundImage: DIAMOND_BG }} />
                            <div className="absolute inset-0 rounded-[inherit] shadow-[inset_0px_0px_9.631px_0px_white]" />
                        </div>
                        <div className="absolute left-[3.18px] top-[3.18px] size-[35.638px] rounded-[6.249px] bg-[rgba(123,160,140,0.16)]" />
                    </div>
                </div>
            </div>
            <div className="absolute left-[calc(50%+0.1px)] top-[calc(50%+0.06px)] size-[25.455px] -translate-x-1/2 -translate-y-1/2">
                <div className="absolute" style={{ inset: "-89.55% -92.91% -92.79% -92.91%" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/customer/achievement/star.svg" alt="" className="block size-full max-w-none" />
                </div>
            </div>
        </div>
    );
}

export interface AchievementHighlightProps {
    /** The achievement value, e.g. count of classes in the best month. */
    count: number;
    /** The month label, e.g. "January". */
    monthLabel: string;
}

export function AchievementHighlight({ count, monthLabel }: AchievementHighlightProps) {
    return (
        <div
            className="relative flex h-[88px] w-full items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[var(--colors-border-secondary,#e4e7ec)] p-4"
            style={{ backgroundImage: CARD_BG, backgroundSize: "100% 100%" }}
        >
            <PixelsDecoration />
            <div className="relative flex min-w-0 flex-1 items-start justify-center gap-2">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="truncate text-xl font-semibold leading-[30px] text-[#101828]">
                        {count} in {monthLabel}
                    </p>
                    <p className="w-full text-xs font-normal leading-[18px] text-[#667085]">Most classes in a month</p>
                </div>
                <DiamondBadge />
            </div>
        </div>
    );
}
