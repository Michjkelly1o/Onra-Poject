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
