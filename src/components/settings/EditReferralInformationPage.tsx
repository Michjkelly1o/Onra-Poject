"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customize referral information (Figma 4627:153001 / 4627:153026)
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page editor. 3-column layout:
//
//   • Left rail — single-step stepper "Referral information" (kept as a
//     stepper instead of a static label because the original implementation
//     used the same chrome and other settings pages still ship the chrome
//     pattern; future steps can slot in without re-architecting the page).
//
//   • Center — Title input + Variables strip + Description rich-text
//     editor. The Variables strip has 4 chips ({{referrer}} / {{friend}} /
//     {{trigger}} / {{cap}}). Clicking a chip appends the token to the
//     description; admins can also type or paste any token directly.
//
//   • Right rail — Referral preview. A miniature of the customer-portal
//     referral card with the Title + the description AFTER variable
//     substitution. Reflects the LIVE local edits so admins see exactly
//     what the customer will read.
//
// Save commits both `infoTitle` + `infoDescription` (raw, with tokens
// intact so the editor can round-trip cleanly) via `updateReferralInformation`.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Copy01, HeartHand } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useAppStore } from "@/lib/store";
import { substituteReferralVariables } from "@/lib/referral-helpers";

export interface EditReferralInformationPageProps {
    returnTo?: string;
}

const VARIABLE_CHIPS: Array<{ token: string; label: string }> = [
    { token: "{{referrer}}", label: "{{referrer}}" },
    { token: "{{friend}}",   label: "{{friend}}"   },
    { token: "{{trigger}}",  label: "{{trigger}}"  },
    { token: "{{cap}}",      label: "{{cap}}"      },
];

export default function EditReferralInformationPage({ returnTo = "/admin/settings/referral" }: EditReferralInformationPageProps) {
    const router = useRouter();
    const settings                  = useAppStore(s => s.referralSettings);
    const updateReferralInformation = useAppStore(s => s.updateReferralInformation);
    const showToast                 = useAppStore(s => s.showToast);

    const [title,       setTitle]       = useState(settings.infoTitle);
    const [description, setDescription] = useState(settings.infoDescription);

    const valid = title.trim().length > 0 && description.trim().length > 0;

    function handleInsertVariable(token: string) {
        // Append at end + trailing space. Simpler than tracking the editor's
        // contentEditable cursor — keeps RichTextEditor untouched per the
        // user's "keep the editor like we have right now" directive.
        setDescription(prev => {
            // The editor stores HTML once edited; append the token as plain
            // text so the substitution helper picks it up at render time.
            const sep = prev.endsWith(" ") || prev.endsWith(">") || prev === "" ? "" : " ";
            return `${prev}${sep}${token} `;
        });
    }

    function handleSave() {
        if (!valid) return;
        updateReferralInformation({
            infoTitle:       title.trim(),
            infoDescription: description.trim(),
        });
        showToast(
            "Referral information updated",
            "Customers will see the new copy on their next visit.",
            "success", "check",
        );
        router.push(returnTo);
    }

    // Substituted body for the right-rail preview.
    const previewBody = substituteReferralVariables(stripHtmlForPreview(description), settings);

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
            <div className="flex-1 min-h-0 px-6 pb-8 flex gap-6 items-start overflow-hidden">
                {/* ── Left rail (single step) ────────────────────────── */}
                <div className="w-[220px] shrink-0">
                    <div className="flex items-center gap-4 h-[52px] p-4 rounded-[12px] bg-[#f5fffa]">
                        <div className="w-6 h-6 rounded-full bg-[#658774] text-white shadow-[0_0_0_2px_white,0_0_0_4px_#7ba08c] flex items-center justify-center text-[14px] font-medium">1</div>
                        <p className="flex-1 text-[14px] font-semibold text-[#3b5446] leading-[20px]">Referral information</p>
                    </div>
                </div>

                {/* ── Center card ───────────────────────────────────── */}
                <div className="flex-1 min-w-0 max-w-[640px] h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
                    <div className="flex-1 min-h-0 p-6 flex flex-col gap-5 overflow-y-auto scrollbar-hide">
                        {/* Title */}
                        <div className="flex flex-col gap-1.5 shrink-0">
                            <label className="text-[14px] font-medium text-[#344054]">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Refer friends, get free credits"
                                className="h-10 w-full px-[14px] border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] bg-white"
                            />
                        </div>

                        {/* Variables strip */}
                        <div className="flex flex-col gap-2 shrink-0">
                            <p className="text-[14px] font-medium text-[#344054]">Variables (click to insert into the description)</p>
                            <div className="flex flex-wrap gap-2 px-3 py-3 border-1 border-[#e4e7ec] rounded-[8px] bg-[#fafafa]">
                                {VARIABLE_CHIPS.map(chip => (
                                    <button
                                        key={chip.token}
                                        type="button"
                                        onClick={() => handleInsertVariable(chip.token)}
                                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border-1 border-[#e9d7fe] bg-[#f4ebff] text-[#6941c6] text-[12px] font-medium hover:bg-[#e9d7fe] transition-colors"
                                    >
                                        <Copy01 className="w-3 h-3" />
                                        <span>{chip.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="flex flex-col gap-1.5 flex-1 min-h-0">
                            <label className="text-[14px] font-medium text-[#344054] shrink-0">Referral information</label>
                            <RichTextEditor
                                value={description}
                                onChange={setDescription}
                                placeholder="Write the referral information... use the variables above to personalize per-member values."
                                rows={12}
                                className="flex-1 min-h-0"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end border-t border-[#e4e7ec]">
                        <Button variant="primary" size="md" disabled={!valid} onClick={handleSave}>
                            Save changes
                        </Button>
                    </div>
                </div>

                {/* ── Right preview rail ────────────────────────────── */}
                <div className="w-[320px] shrink-0 flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                        <p className="text-[16px] font-semibold text-[#101828]">Referral preview</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">This is how your referral will look like.</p>
                    </div>

                    {/* Mock customer-portal referral card */}
                    <div className="border-1 border-[#e4e7ec] rounded-[16px] bg-[#fafafa] p-5 flex flex-col items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-[#e9fff3] flex items-center justify-center">
                            <HeartHand className="w-7 h-7 text-[#658774]" />
                        </div>
                        <div className="flex flex-col items-center gap-2 text-center">
                            <p className="text-[18px] font-semibold text-[#101828] leading-[24px]">
                                {title || "Refer friends, get free credits"}
                            </p>
                            <p className="text-[13px] text-[#475467] leading-[18px]">
                                {previewBody || "Description preview shows once you start typing."}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 w-full mt-2">
                            <div className="flex-1 h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white flex items-center text-[14px] text-[#101828]">
                                Jtr.888
                            </div>
                            <button
                                type="button"
                                className="h-10 px-3 border-1 border-[#d0d5dd] rounded-[8px] bg-white flex items-center gap-1.5 text-[14px] text-[#344054]"
                            >
                                <Copy01 className="w-3.5 h-3.5" />
                                Copy
                            </button>
                        </div>
                        <button
                            type="button"
                            className="w-full h-10 rounded-[8px] bg-[#a9d4b9] text-[#1d3a2a] text-[14px] font-semibold"
                        >
                            Share
                        </button>
                    </div>
                </div>
            </div>

            <Toast />
        </div>
    );
}

/** Strip HTML tags so the right-rail preview shows the substituted body
 *  as plain text. Keeps the implementation lightweight — the customer
 *  portal renders the rich HTML; the admin preview just shows the prose
 *  for readability. */
function stripHtmlForPreview(html: string): string {
    return html
        .replace(/<\s*br\s*\/?\s*>/gi, "\n")
        .replace(/<\/p\s*>/gi, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
