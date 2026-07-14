import type { Metadata } from "next";
import "./globals.css";
import { BRAND_FONT_VARIABLES } from "./branding-fonts";
import { UserLenzBridge } from "@/components/UserLenzBridge";

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
            {/* `BRAND_FONT_VARIABLES` injects the 6 brand typeface CSS
                variables (--font-brand-dm-sans, --font-brand-inter, etc.)
                so the Customize Design Settings preview can apply the
                live-selected font via `style={{ fontFamily: var(...) }}`
                without disturbing the rest of the admin shell, which
                continues to render in Tailwind's default sans stack. */}
            <body className={`min-h-screen bg-surface-secondary antialiased ${BRAND_FONT_VARIABLES}`}>
                {/* UserLenz replay-testing bridge — loaded via next/script
                    (reusable component). Applies to every route. */}
                <UserLenzBridge />
                {children}
            </body>
        </html>
    );
}
