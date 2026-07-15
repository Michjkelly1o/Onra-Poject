"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Customer — About (`/customer/profile/about`) — Figma 4496-151720
// ─────────────────────────────────────────────────────────────────────────────
//
// App icon + name + version, a device/app info card (OS version · device model ·
// app developer — read from the device), and a Privacy policy link. A level-2
// profile page (back → Profile). The privacy link is a placeholder (404) for now.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, FileShield02 } from "@untitledui/icons";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";

const APP_VERSION = "7.70";
const APP_DEVELOPER = "Onra Studio";

/** Best-effort OS + device model from the browser (client-only). */
function readDevice(): { os: string; model: string } {
    if (typeof navigator === "undefined") return { os: "—", model: "—" };
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
        const m = ua.match(/OS (\d+)[._](\d+)/);
        return {
            os: m ? `iOS ${m[1]}.${m[2]}` : "iOS",
            model: /iPad/.test(ua) ? "iPad" : /iPod/.test(ua) ? "iPod touch" : "iPhone",
        };
    }
    if (/Android/.test(ua)) {
        const v = ua.match(/Android (\d+(?:\.\d+)?)/);
        const mm = ua.match(/;\s?([^;)]+)\s+Build\//);
        return { os: v ? `Android ${v[1]}` : "Android", model: mm ? mm[1].trim() : "Android device" };
    }
    if (/Mac OS X/.test(ua)) {
        const m = ua.match(/Mac OS X (\d+)[._](\d+)/);
        return { os: m ? `macOS ${m[1]}.${m[2]}` : "macOS", model: "Mac" };
    }
    if (/Windows NT/.test(ua)) return { os: "Windows", model: "PC" };
    return { os: "Web", model: "Browser" };
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-3 text-sm leading-5">
            <span className="font-normal text-[#475467]">{label}</span>
            <span className="font-medium text-[var(--brand-text)]">{value}</span>
        </div>
    );
}

export default function AboutPage() {
    const router = useRouter();
    // Read the device after mount to avoid an SSR/CSR mismatch.
    const [device, setDevice] = useState<{ os: string; model: string }>({ os: "—", model: "—" });
    useEffect(() => setDevice(readDevice()), []);

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile")}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[var(--brand-text)]">About</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col items-center gap-6 px-4 pb-8 pt-[96px]">
                {/* App icon + name + version */}
                <div className="flex flex-col items-center gap-4">
                    <div
                        className="flex size-[100px] items-center justify-center rounded-[24px]"
                        style={{ backgroundImage: "linear-gradient(180deg, #f5fcf8 43%, #d9f3e5 100%)" }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/customer/auth/forma-logomark.svg" alt="" className="size-[60px]" />
                    </div>
                    <div className="flex flex-col items-center gap-1">
                        <p className="text-base font-semibold leading-6 text-[var(--brand-text)]">Onra</p>
                        <p className="text-sm font-normal leading-5 text-[#667085]">Version {APP_VERSION}</p>
                    </div>
                </div>

                {/* Device / app info */}
                <div className="flex w-full flex-col gap-4 rounded-2xl border border-[#e4e7ec] bg-white p-4">
                    <InfoRow label="OS version" value={device.os} />
                    <div className="h-px w-full bg-[#f2f4f7]" />
                    <InfoRow label="Device model" value={device.model} />
                    <div className="h-px w-full bg-[#f2f4f7]" />
                    <InfoRow label="App developer" value={APP_DEVELOPER} />
                </div>

                {/* Privacy policy — placeholder link (404 for now) */}
                <button
                    type="button"
                    onClick={() => router.push("/customer/profile/privacy-policy")}
                    className="flex w-full items-center gap-4 rounded-xl border border-[#e4e7ec] bg-white px-4 py-4 text-left transition-colors active:bg-gray-50"
                >
                    <FileShield02 className="size-5 shrink-0 text-[#344054]" aria-hidden />
                    <span className="flex-1 text-sm font-semibold leading-5 text-[var(--brand-text)]">Privacy policy</span>
                    <ChevronRight className="size-5 shrink-0 text-[#98a2b3]" aria-hidden />
                </button>
            </div>
        </div>
    );
}
