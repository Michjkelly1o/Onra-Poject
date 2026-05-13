"use client";

import { useEffect } from "react";
import { XClose, Check, Trash01, Archive, SlashCircle01, RefreshCcw01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

function ToastIcon({ icon, type }: { icon?: string; type: "success" | "error" }) {
    const isError = type === "error";
    const ringColor  = isError ? "#d92d20" : "#658774";
    const IconComp =
        icon === "trash"   ? Trash01 :
        icon === "archive" ? Archive :
        icon === "slash"   ? SlashCircle01 :
        icon === "refresh" ? RefreshCcw01 :
        Check;

    return (
        <div className="relative shrink-0 w-5 h-5 mt-[2px]">
            <div className="absolute inset-[-45%] rounded-full border-2 opacity-10" style={{ borderColor: ringColor }} />
            <div className="absolute inset-[-20%] rounded-full border-2 opacity-30" style={{ borderColor: ringColor }} />
            <div className={cn(
                "absolute inset-0 rounded-full border-2 flex items-center justify-center",
                isError ? "border-[#d92d20] text-[#d92d20]" : "border-[#658774] text-[#658774]",
            )}>
                <IconComp className="w-[10px] h-[10px]" />
            </div>
        </div>
    );
}

export function Toast() {
    const { toast, clearToast } = useAppStore();

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(clearToast, 4500);
        return () => clearTimeout(t);
    }, [toast?.id, clearToast]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!toast) return null;

    const isError = toast.type === "error";

    return (
        <div className="fixed top-4 right-4 z-[200] w-[380px]">
            <div className={cn(
                "relative rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] p-4 flex gap-4 items-start border",
                isError
                    ? "bg-[#fef3f2] border-[#fecdca]"
                    : "bg-[#fbfffd] border-[#7ba08c]",
            )}>
                <button
                    type="button"
                    onClick={clearToast}
                    className="absolute top-[7px] right-[7px] w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-black/5 transition-colors"
                >
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>

                <ToastIcon icon={toast.icon} type={toast.type} />

                <div className="flex flex-col gap-1 pr-8 flex-1 min-w-0 pt-[2px]">
                    <p className="text-[14px] font-semibold text-[#101828] leading-[20px]">{toast.title}</p>
                    <p className="text-[14px] font-normal text-[#344054] leading-[20px]">{toast.message}</p>
                </div>
            </div>
        </div>
    );
}
