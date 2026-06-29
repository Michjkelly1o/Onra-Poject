"use client";

import { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { Toast } from "@/components/ui/Toast";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { account_profile } from "@/data/mock/account_profile";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sidebarCollapsed } = useAppStore();
    const currentRole = useAppStore(s => s.currentRole);
    const setCurrentUser = useAppStore(s => s.setCurrentUser);

    // URL-driven role reset — if the user came in from a previous
    // `/instructor/*` visit, flip `currentUser` back to the admin demo
    // persona so the welcome chip and avatar render the right identity.
    useEffect(() => {
        if (currentRole !== "admin") setCurrentUser(account_profile);
    }, [currentRole, setCurrentUser]);

    return (
        <>
            <div className="flex h-screen bg-[#f1f2ed]">
                {/* Sidebar wrapper — drives width so content area reflows naturally */}
                <div
                    className={cn(
                        "flex-shrink-0 transition-all duration-300",
                        sidebarCollapsed ? "w-[88px]" : "w-[280px]"
                    )}
                >
                    <Sidebar settingsHref="/admin/settings" />
                </div>

                {/* Content area */}
                <div className="flex-1 min-w-0 p-[12px]">
                    <div className="bg-white border border-[#dcded5] rounded-[20px] h-full flex flex-col overflow-hidden">
                        <Header />
                        <main className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col">{children}</main>
                    </div>
                </div>
            </div>
            <Toast />
        </>
    );
}
