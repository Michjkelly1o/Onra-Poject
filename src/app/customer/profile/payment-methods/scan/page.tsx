"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Zap } from "@untitledui/icons";
import { markScanned } from "@/lib/customer/payment-methods";
import { ProcessingLoader } from "@/components/customer/shell/ProcessingLoader";

export default function ScanCardPage() {
    const router = useRouter();
    const [scanning, setScanning] = useState(false);

    function shoot() {
        setScanning(true);
        window.setTimeout(() => {
            markScanned();
            router.replace("/customer/profile/payment-methods/new");
        }, 1600);
    }

    if (scanning) {
        return <ProcessingLoader label="Scanning card" fill />;
    }

    return (
        <div className="flex min-h-full flex-col bg-[#1d2939]">
            <div className="flex items-center justify-between px-4 pt-4">
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Close"
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors active:bg-white/20"
                >
                    <XClose className="size-5" aria-hidden />
                </button>
                <button
                    type="button"
                    aria-label="Flash"
                    className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white"
                >
                    <Zap className="size-5" aria-hidden />
                </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8">
                <div className="flex aspect-[1.6] w-full max-w-[320px] flex-col justify-end rounded-2xl border-2 border-white/80 bg-white/5 p-4">
                    <p className="font-mono text-base tracking-[0.2em] text-white/90">1234 5678 9000 0000</p>
                    <div className="mt-2 flex items-center justify-between text-sm text-white/70">
                        <span>Kelly M</span>
                        <span>VISA</span>
                    </div>
                </div>
                <p className="text-center text-sm leading-5 text-white/80">
                    Place your card inside the frame and make sure all details are visible.
                </p>
            </div>
            <div className="flex justify-center pb-12">
                <button
                    type="button"
                    onClick={shoot}
                    aria-label="Capture"
                    className="size-16 rounded-full border-4 border-white/40 bg-white transition-transform active:scale-95"
                />
            </div>
        </div>
    );
}
