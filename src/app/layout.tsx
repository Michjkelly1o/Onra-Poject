import type { Metadata } from "next";
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
            <head>
                {/* UserLenz replay-testing bridge — customer-scoped.
                    Rendered in `<head>` so it lives in the SSR HTML at
                    initial page load (UserLenz's tooling checks the raw
                    HTML for the snippet; a useEffect-based injection
                    fires after hydration and gets flagged as
                    "bridge snapshot timeout"). The inline gate runs
                    synchronously during head parse:
                      • On `/customer` and `/customer/*` → dynamically
                        appends the vendor bridge script + inits the
                        postMessage channel.
                      • On admin (`/admin/*`) + instructor
                        (`/instructor/*`) + any other route → does
                        nothing. No vendor fetch. No bridge. No
                        postMessage surface.
                    `defer=true` keeps the vendor script off the critical
                    path; the guarded init call no-ops if the CDN is
                    unreachable so nothing about the app breaks either
                    way. `allowedOrigins` restricts the postMessage side
                    of the bridge to UserLenz's demo host. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var p=location.pathname;if(p!=='/customer'&&p.indexOf('/customer/')!==0)return;var s=document.createElement('script');s.src='https://api-en72htyjgq-uc.a.run.app/bridge.min.js';s.defer=true;s.onload=function(){if(window.UserLenzBridge&&typeof window.UserLenzBridge.init==='function'){window.UserLenzBridge.init({source:'userlenz-replay-bridge',allowedOrigins:['https://userlenz-demo.web.app']});}};document.head.appendChild(s);})();`,
                    }}
                />
            </head>
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
