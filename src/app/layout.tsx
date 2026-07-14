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
                {/* UserLenz replay-testing bridge — customer-only.

                    UserLenz's install check looks for a REAL
                    `<script src=".../bridge.min.js">` element in the
                    parsed DOM. Prior attempts failed because:
                      • `next/script` with `beforeInteractive` doesn't
                        output a real `<script src>` tag — it uses
                        Next.js's `__next_s` queue + a `<link rel="preload">`
                        which UserLenz's parser doesn't recognize.
                      • Dynamic `document.createElement + appendChild`
                        adds the tag only after hydration, so the raw
                        HTML never contains it.

                    Fix: an inline `<script>` runs synchronously during
                    head parse. On `/customer` or `/customer/*` it uses
                    `document.write` to insert the vendor's exact tag
                    (`<script src=".../bridge.min.js" defer>`) directly
                    into the document stream — the browser parses it as
                    if it was part of the original HTML, so the tag ends
                    up in the DOM the moment head parsing continues.
                    On admin + instructor + any other route: no write,
                    no vendor fetch, no bridge, no postMessage surface.

                    A second inline `<script>` polls for the bridge's
                    global (defer means the vendor script executes after
                    HTML parse) and calls `init(...)` once — again gated
                    on customer routes. */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var p=location.pathname;if(p!=='/customer'&&p.indexOf('/customer/')!==0)return;document.write('<script src="https://api-en72htyjgq-uc.a.run.app/bridge.min.js" defer><\\/script>');})();`,
                    }}
                />
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){var p=location.pathname;if(p!=='/customer'&&p.indexOf('/customer/')!==0)return;var tries=0;function tryInit(){if(window.UserLenzBridge&&typeof window.UserLenzBridge.init==='function'){window.UserLenzBridge.init({source:'userlenz-replay-bridge',allowedOrigins:['https://userlenz-demo.web.app']});return true;}return false;}if(tryInit())return;var iv=setInterval(function(){tries++;if(tryInit()||tries>200)clearInterval(iv);},50);})();`,
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
