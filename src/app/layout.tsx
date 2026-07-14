import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { BRAND_FONT_VARIABLES } from "./branding-fonts";

export const metadata: Metadata = {
    title: "Onra Studio — Admin Dashboard",
    description: "Onra Studio fitness studio management platform.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            {/* UserLenz replay-testing bridge.
                ── Why two <Script> tags instead of a dynamic injector ──
                UserLenz's install check parses the initial HTML response
                looking for the vendor `<script src=".../bridge.min.js">`
                tag. A dynamic append (createElement + appendChild) runs
                AFTER hydration, so the raw HTML doesn't contain the tag
                and their check fires "bridge snapshot timed out" even
                though the script loaded fine. Rendering via `next/script`
                with `strategy="beforeInteractive"` puts a real `<script
                src>` element in the SSR HTML — the install check passes.
                ── Customer-only bridge init ──
                The second <Script> runs a synchronous pathname check.
                The vendor's bridge FILE loads on every route (~few KB,
                cached after first hit), but the postMessage listener /
                init only happens on `/customer` and `/customer/*`. Admin
                + instructor routes never open the bridge, so they can't
                be recorded or replayed even if UserLenz tried to snapshot
                them. `beforeInteractive` MUST live in the root layout —
                that's a Next.js constraint. */}
            <Script
                id="userlenz-bridge"
                src="https://api-en72htyjgq-uc.a.run.app/bridge.min.js"
                strategy="beforeInteractive"
            />
            <Script id="userlenz-init" strategy="afterInteractive">{`
                (function(){
                    var p = window.location.pathname;
                    if (p !== '/customer' && p.indexOf('/customer/') !== 0) return;
                    if (window.UserLenzBridge && typeof window.UserLenzBridge.init === 'function') {
                        window.UserLenzBridge.init({
                            source: 'userlenz-replay-bridge',
                            allowedOrigins: ['https://userlenz-demo.web.app']
                        });
                    }
                })();
            `}</Script>
            {/* `BRAND_FONT_VARIABLES` injects the 6 brand typeface CSS
                variables (--font-brand-dm-sans, --font-brand-inter, etc.)
                so the Customize Design Settings preview can apply the
                live-selected font via `style={{ fontFamily: var(...) }}`
                without disturbing the rest of the admin shell, which
                continues to render in Tailwind's default sans stack. */}
            <body className={`min-h-screen bg-surface-secondary antialiased ${BRAND_FONT_VARIABLES}`}>
                {children}
            </body>
        </html>
    );
}
