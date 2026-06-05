"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customize referral information (Figma 4627-153028)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single-step full-page editor. The section heading INSIDE the card is
// "Referral information" but the page header (top bar) is "Customize
// referral information". One field: a rich text editor for the description.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppStore } from "@/lib/store";

export interface EditReferralInformationPageProps {
    returnTo?: string;
}

export default function EditReferralInformationPage({ returnTo = "/admin/settings/referral" }: EditReferralInformationPageProps) {
    const router = useRouter();
    const settings                  = useAppStore(s => s.referralSettings);
    const updateReferralInformation = useAppStore(s => s.updateReferralInformation);
    const showToast                 = useAppStore(s => s.showToast);

    const [description, setDescription] = useState(settings.infoDescription);

    const valid = description.trim().length > 0;

    function handleSave() {
        if (!valid) return;
        updateReferralInformation({ infoDescription: description.trim() });
        showToast(
            "Referral information updated",
            "Customers will see the new copy on their next visit.",
            "success", "check",
        );
        router.push(returnTo);
    }

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Customize referral information</h1>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-8 items-start overflow-hidden">
                {/* Left rail */}
                <div className="w-[260px] shrink-0">
                    <div className="flex items-center gap-4 h-[52px] p-4 rounded-[12px] bg-[#f5fffa]">
                        <div className="w-6 h-6 rounded-full bg-[#658774] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#7ba08c] flex items-center justify-center text-[14px] font-medium">1</div>
                        <p className="flex-1 text-[14px] font-semibold text-[#3b5446] leading-[20px]">Referral information</p>
                    </div>
                </div>

                {/* Center card */}
                <div className="flex-1 min-w-0 max-w-[680px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 p-6 flex flex-col gap-5">
                        <p className="font-semibold text-[18px] leading-[28px] text-[#101828] shrink-0">Referral information</p>

                        <RichTextEditor
                            value={description}
                            onChange={setDescription}
                            placeholder="Write the referral information..."
                            rows={14}
                            className="flex-1 min-h-0"
                        />
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                        <Button variant="primary" size="md" disabled={!valid} onClick={handleSave}>
                            Save changes
                        </Button>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}
