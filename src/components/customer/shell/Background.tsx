// ─────────────────────────────────────────────────────────────────────────────
// Customer experience — shared app background (PRD 13 §3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma: 9ByGNc4N7Vw3BLMHyaWJ1j node 4107-37979 ("Background"). A near-white base
// with two heavily-blurred decorative blobs and a faint film grain, the whole
// decorative group at ~16% opacity. The Figma rotates the group 180°, which lands
// the blobs in the UPPER region of the screen (a soft teal/green wash at the top
// fading to white below).
//
// Rendered ONCE in the member layout, BEHIND the app column. It is purely
// decorative: `pointer-events-none` (never blocks interaction), `overflow-hidden`
// (never causes horizontal scroll), and fixed within the column (does not scroll
// with content). The blobs are the exported Figma SVGs (they carry their own
// Gaussian blur); the grain is an inline feTurbulence (replaces the design's
// 2.26 MB noise PNG at visually-identical low opacity).

const noiseSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'>" +
    "<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter>" +
    "<rect width='100%' height='100%' filter='url(#n)'/></svg>";

const NOISE_URL = `data:image/svg+xml;utf8,${encodeURIComponent(noiseSvg)}`;

export function CustomerBackground() {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* Decorative blobs — design group opacity ≈ 0.16 over the white column. */}
            <div className="absolute inset-0 opacity-[0.16]">
                {/* blob-2: #C4EDD6 → #92D1DE gradient, broad, upper area (rotated 180° per Figma). */}
                <img
                    src="/customer/background/blob-2.svg"
                    alt=""
                    className="absolute -left-[34%] -top-[12%] w-[168%] max-w-none rotate-180 select-none"
                />
                {/* blob-1: #92D1DE teal, narrower, upper area. */}
                <img
                    src="/customer/background/blob-1.svg"
                    alt=""
                    className="absolute -top-[24%] left-[1%] w-[92%] max-w-none rotate-180 select-none"
                />
            </div>

            {/* Film grain (Figma "Noise & Texture", kept very subtle). */}
            <div
                className="absolute inset-0 opacity-[0.10] mix-blend-multiply"
                style={{ backgroundImage: `url("${NOISE_URL}")`, backgroundSize: "120px 120px" }}
            />
        </div>
    );
}
