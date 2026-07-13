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
                {/* UserLenz live-testing bridge — verifies the domain and
                    opens a postMessage channel to their demo host so replay
                    + in-app prompts can drive the prototype. Rendered as a
                    single inline script that dynamically appends the vendor
                    src (this is a server component; passing an `onLoad`
                    handler to `<Script>` would cross the client boundary).
                    `defer=true` keeps it off the critical path; the
                    handler no-ops if the CDN is unreachable, so nothing
                    breaks. `allowedOrigins` restricts the postMessage side
                    of the bridge to UserLenz's demo host. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var s=document.createElement('script');s.src='https://api-en72htyjgq-uc.a.run.app/bridge.min.js';s.defer=true;s.onload=function(){if(window.UserLenzBridge&&typeof window.UserLenzBridge.init==='function'){window.UserLenzBridge.init({source:'userlenz-replay-bridge',allowedOrigins:['https://userlenz-demo.web.app']});}};document.head.appendChild(s);})();`,
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
