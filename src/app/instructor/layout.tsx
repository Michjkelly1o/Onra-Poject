"use client";

import { useAppStore } from "@/lib/store";
import { cn, getInitials } from "@/lib/utils";
import { CalendarDays, Home, Users, Dumbbell, ChevronLeft, ChevronRight, DollarSign } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

const navItems = [
    { label: "My Schedule", href: "/instructor/schedule", icon: CalendarDays },
    { label: "Attendance", href: "/instructor/attendance", icon: Users },
    { label: "My Earnings", href: "/instructor/earnings", icon: DollarSign },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { sidebarCollapsed, toggleSidebar } = useAppStore();

    return (
        <div className="min-h-screen bg-surface-secondary">
            {/* Sidebar */}
            <aside className={cn("fixed left-0 top-0 z-40 h-screen bg-white border-r border-gray-100 flex flex-col transition-all duration-300", sidebarCollapsed ? "w-[72px]" : "w-[260px]")}>
                <div className="h-16 flex items-center px-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                            <Dumbbell className="w-5 h-5 text-white" />
                        </div>
                        {!sidebarCollapsed && (
                            <div className="animate-fade-in">
                                <h1 className="font-bold text-lg text-gray-900 leading-none">SyncFit</h1>
                                <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-widest">Instructor</p>
                            </div>
                        )}
                    </div>
                </div>
                <nav className="flex-1 py-4 px-3 space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
                        return (
                            <Link key={item.href} href={item.href}
                                className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                                    isActive ? "bg-emerald-50 text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                )}>
                                <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-emerald-600" : "text-gray-400")} />
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>
                <div className="p-3 border-t border-gray-100">
                    <button onClick={toggleSidebar} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
                    </button>
                </div>
            </aside>

            {/* Main */}
            <div className={cn("transition-all duration-300", sidebarCollapsed ? "ml-[72px]" : "ml-[260px]")}>
                <header className="h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
                    <h2 className="text-sm font-semibold text-gray-700">Instructor Portal</h2>
                    <div className="flex items-center gap-3">
                        <NotificationBell />
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <span className="text-xs font-semibold text-emerald-700">SJ</span>
                        </div>
                        <span className="text-sm font-medium text-gray-700">Sara Johnson</span>
                    </div>
                </header>
                <main className="p-6 pb-24">{children}</main>
            </div>
        </div>
    );
}
