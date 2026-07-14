// ─────────────────────────────────────────────────────────────────────────────
// UserLenz replay-testing bridge
// ─────────────────────────────────────────────────────────────────────────────
//
// Reusable component (per the UserLenz developer's install instruction) that
// loads the vendor bridge via `next/script` and initialises the postMessage
// channel to the UserLenz hosts. Drop <UserLenzBridge /> once in a layout.
//
//   • Vendor script — loaded with strategy="afterInteractive" so Next injects
//     a real <script src> into the DOM after hydration.
//   • Init — polls for `window.UserLenzBridge` (the vendor script sets it once
//     loaded) and calls `.init(...)` with the studio's source + allowedOrigins.
//     Polling means script order doesn't matter; it stops after ~10s.
//
// Bump the src / origins here in ONE place if the UserLenz endpoint changes.

import Script from "next/script";

const BRIDGE_SRC = "https://demo.userlenz.ai/bridge.min.js";

const ALLOWED_ORIGINS = [
    "https://userlenz-demo.web.app",
    "http://localhost:3000",
    "https://demo.userlenz.ai",
];

const INIT_SNIPPET = `(function(){var tries=0;function tryInit(){if(window.UserLenzBridge&&typeof window.UserLenzBridge.init==='function'){window.UserLenzBridge.init({source:'userlenz-replay-bridge',allowedOrigins:${JSON.stringify(ALLOWED_ORIGINS)}});return true;}return false;}if(tryInit())return;var iv=setInterval(function(){tries++;if(tryInit()||tries>200)clearInterval(iv);},50);})();`;

export function UserLenzBridge() {
    return (
        <>
            <Script src={BRIDGE_SRC} strategy="afterInteractive" />
            <Script id="userlenz-bridge-init" strategy="afterInteractive">
                {INIT_SNIPPET}
            </Script>
        </>
    );
}
