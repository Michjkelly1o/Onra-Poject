"use client";

import { useRouter, usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Shield, GraduationCap, User } from "lucide-react";
import type { UserRole } from "@/types";

const roles: { role: UserRole; label: string; icon: typeof Shield; path: string }[] = [
    { role: "admin", label: "Admin", icon: Shield, path: "/admin/dashboard" },
    { role: "instructor", label: "Instructor", icon: GraduationCap, path: "/instructor/schedule" },
    { role: "member", label: "Customer", icon: User, path: "/customer" },
];

export default function DemoRoleSwitcher() {
    const router = useRouter();
    const { currentRole, setRole } = useAppStore();

    const handleSwitch = (role: UserRole, path: string) => {
        setRole(role);
        router.push(path);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
            {/* Label */}
            <div className="text-center mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-gray-200">
                    Demo Mode — Switch View
                </span>
            </div>

            {/* Switcher Pills */}
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl p-1.5 shadow-card">
                {roles.map(({ role, label, icon: Icon, path }) => (
                    <button
                        key={role}
                        onClick={() => handleSwitch(role, path)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                            currentRole === role
                                ? "gradient-bg-brand text-white shadow-glow"
                                : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
