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
                {/* UserLenz replay-testing bridge — ALL routes (admin +
                    instructor + customer). Per the vendor's install
                    instruction: "add this snippet right after your <head>
                    tag on every page to verify your domain and activate
                    live testing."

                    UserLenz's install check looks for a REAL
                    `<script src=".../bridge.min.js">` element in the
                    parsed DOM. `next/script` (beforeInteractive) doesn't
                    emit a real tag — it uses Next's `__next_s` queue + a
                    `<link rel="preload">`, which their parser doesn't
                    recognise; and a post-hydration `createElement` append
                    isn't in the initial HTML. So an inline `<script>`
                    runs synchronously during head parse and uses
                    `document.write` to insert the vendor tag directly
                    into the document stream — the browser processes it as
                    part of the original HTML, so the real `<script src>`
                    lands in the DOM immediately, on every page.

                    A second inline `<script>` polls for the bridge global
                    (the vendor script is `defer`, so it executes after
                    HTML parse) and calls `init(...)` once it's ready. No
                    pathname gate — every view is now testable. */}
                <script
                    src="https://api-en72htyjgq-uc.a.run.app/bridge.min.js"
                    defer
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var tries=0;function tryInit(){if(window.UserLenzBridge&&typeof window.UserLenzBridge.init==='function'){window.UserLenzBridge.init({source:'userlenz-replay-bridge',allowedOrigins:['https://userlenz-demo.web.app']});return true;}return false;}if(tryInit())return;var iv=setInterval(function(){tries++;if(tryInit()||tries>200)clearInterval(iv);},50);})();`,
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
