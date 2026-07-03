"use client";

import { useEffect } from "react";
import { XClose, Check, Trash01, Archive, SlashCircle01, RefreshCcw01, AlertCircle } from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { useAppStore, type ToastData } from "@/lib/store";

/** Warning ring color matches Figma 7739:175065 (warning/500 = #dc6803). */
function ringFor(type: ToastData["type"]): string {
    if (type === "error")   return "#d92d20";
    if (type === "warning") return "#dc6803";
    return "#658774";
}

function ToastIcon({ icon, type }: { icon?: ToastData["icon"]; type: ToastData["type"] }) {
    const ringColor = ringFor(type);
    // Icon defaults follow the tone: alert-circle for warnings, check
    // for success, matching the Figma reference for the payment lock
    // toast. Callers can still override via the `icon` prop.
    const IconComp =
        icon === "trash"   ? Trash01 :
        icon === "archive" ? Archive :
        icon === "slash"   ? SlashCircle01 :
        icon === "refresh" ? RefreshCcw01 :
        icon === "alert"   ? AlertCircle :
        type === "warning" ? AlertCircle :
        Check;

    return (
        <div className="relative shrink-0 w-5 h-5 mt-[2px]">
            <div className="absolute inset-[-45%] rounded-full border-2 opacity-10" style={{ borderColor: ringColor }} />
            <div className="absolute inset-[-20%] rounded-full border-2 opacity-30" style={{ borderColor: ringColor }} />
            <div
                className="absolute inset-0 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: ringColor, color: ringColor }}
            >
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

    const containerCls =
        toast.type === "error"   ? "bg-[#fef3f2] border-[#fecdca]"
      : toast.type === "warning" ? "bg-[#fffaeb] border-[#fedf89]"
      :                            "bg-[#fbfffd] border-[#7ba08c]";

    return (
        <div className="fixed top-4 right-4 z-[200] w-[380px]">
            <div className={cn(
                "relative rounded-[16px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] p-4 flex gap-4 items-start border",
                containerCls,
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
