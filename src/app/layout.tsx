import type { Metadata } from "next";
import "./globals.css";
import DemoRoleSwitcher from "@/components/demo/DemoRoleSwitcher";

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
            <body className="min-h-screen bg-surface-secondary antialiased">
                {children}
                <DemoRoleSwitcher />
            </body>
        </html>
    );
}
