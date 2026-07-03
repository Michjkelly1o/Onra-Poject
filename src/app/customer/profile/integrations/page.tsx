"use client";

// Customer — Integrations (`/customer/profile/integrations`). Calendar sync with a
// simulated connect flow (sheet → connected), reflected as Connect/Disconnect.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Link01 } from "@untitledui/icons";
import { useAppStore } from "@/lib/store";
import { connectCalendar, disconnectCalendar, useCalendarIntegration } from "@/lib/customer/integrations";
import { useCurrentCustomer } from "@/lib/customer/context";
import { CustomerHeader } from "@/components/customer/shell/CustomerHeader";
import { CustomerSheet } from "@/components/customer/shell/CustomerSheet";
import { SheetToolbar } from "@/components/customer/shell/SheetToolbar";
import { Button } from "@/components/ui/button";

export default function IntegrationsPage() {
    const router = useRouter();
    const member = useCurrentCustomer();
    const calendar = useCalendarIntegration();
    const showToast = useAppStore((s) => s.showToast);
    const [connectOpen, setConnectOpen] = useState(false);

    function connect() {
        setConnectOpen(false);
        connectCalendar(member?.email ?? "kate@untitled.com");
        showToast("Calendar connected", "Your class schedule now syncs to Google Calendar.", "success");
    }
    function disconnect() {
        disconnectCalendar();
        showToast("Calendar disconnected", "Your class schedule no longer syncs.", "success");
    }

    return (
        <div className="flex min-h-full flex-col">
            <CustomerHeader>
                <button
                    type="button"
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#e4e7ec] bg-white transition-colors active:bg-gray-50"
                >
                    <ChevronLeft className="size-5 text-[#344054]" aria-hidden />
                </button>
                <h1 className="min-w-0 flex-1 text-center text-lg font-semibold leading-7 text-[#101828]">Integrations</h1>
                <span aria-hidden className="size-10 shrink-0" />
            </CustomerHeader>

            <div className="flex flex-1 flex-col px-4 pt-[80px]">
                <div className="flex items-center gap-3 rounded-2xl border border-[#eaecf0] bg-white p-4">
                    <div className="flex size-10 shrink-0 items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/customer/pay/google-calendar.svg" alt="" className="size-8" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold leading-6 text-[#101828]">Calendar</p>
                        <p className="text-sm leading-5 text-[#475467]">Sync your schedule events</p>
                    </div>
                    {calendar.connected ? (
                        <Button
                            variant="secondary-gray"
                            size="sm"
                            className="rounded-full font-semibold text-[#d92d20]"
                            onClick={disconnect}
                        >
                            Disconnect
                        </Button>
                    ) : (
                        <Button variant="secondary-gray" size="sm" className="rounded-full" onClick={() => setConnectOpen(true)}>
                            Connect
                        </Button>
                    )}
                </div>
            </div>

            <CustomerSheet open={connectOpen} onClose={() => setConnectOpen(false)}>
                <SheetToolbar title="" onClose={() => setConnectOpen(false)} />
                <div className="flex flex-col items-center gap-4 pt-2 text-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-[#e9fff3]">
                        <Link01 className="size-6 text-[#658774]" aria-hidden />
                    </div>
                    <div>
                        <p className="text-lg font-semibold leading-7 text-[#101828]">Connect to your calendar</p>
                        <p className="mt-1 text-sm leading-5 text-[#475467]">
                            Allow Onra to integrate with Google Calendar to view and sync your class schedule.
                        </p>
                    </div>
                    <Button variant="primary" size="xl" className="mt-1 w-full rounded-full" onClick={connect}>
                        Connect
                    </Button>
                </div>
            </CustomerSheet>
        </div>
    );
}
