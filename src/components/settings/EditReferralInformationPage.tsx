"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Customize referral information (Figma 4627:153001 / 4627:153026)
// ─────────────────────────────────────────────────────────────────────────────
//
// Full-page editor. 3-column layout:
//
//   • Left rail — single-step stepper "Referral information".
//
//   • Center — Title input + Variables strip + Description rich-text
//     editor.
//     Variables ({{referrer}} / {{friend}} / {{trigger}} / {{cap}}) are
//     draggable AND clickable:
//       – Click       → inserts the token at the current cursor position
//                       (restores the last-known caret if the editor lost
//                       focus from the chip click).
//       – Drag & drop → inserts the token at the caret position closest
//                       to the drop point — visual feedback while
//                       dragging follows the cursor.
//
//   • Right rail — Referral preview. Uses the same Template-preview chrome
//     as the Membership / Package create flow (`TemplatePreviewCard` in
//     ProductFormPage): outer card with header + subtitle + divider, then
//     a `#f6f6f3` stage, with the mock customer card inside. The mock
//     card uses a `DecorativeBanner` (sage palette to match the brand)
//     and renders the Title + the description AFTER variable
//     substitution so admins see exactly what the customer will read.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose, Copy01, HeartHand } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/RichTextEditor";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { DecorativeBanner, BANNER_TINTS } from "@/components/products/DecorativeBanner";
import { useAppStore } from "@/lib/store";
import { substituteReferralVariables } from "@/lib/referral-helpers";
import { cn } from "@/lib/utils";

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
    /** Currently dragged variable token — drives the floating
     *  "Drop to insert" indicator pill that follows the cursor. */
    const [draggingToken, setDraggingToken] = useState<string | null>(null);

    const editorRef = useRef<RichTextEditorHandle>(null);

    const valid = title.trim().length > 0 && description.trim().length > 0;

    function handleChipClick(token: string) {
        editorRef.current?.insertTextAtCursor(token);
    }

    function handleChipDragStart(e: React.DragEvent<HTMLButtonElement>, token: string) {
        e.dataTransfer.setData("text/plain", token);
        e.dataTransfer.effectAllowed = "copy";
        setDraggingToken(token);
    }
    function handleChipDragEnd() {
        setDraggingToken(null);
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

    // Plain-text preview body for the right-rail mock card.
    const previewBody = substituteReferralVariables(stripHtmlForPreview(description), settings);
    const previewTitle = title.trim() || "Refer friends, get free credits";

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={() => router.push(returnTo)}
                    aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">Customize referral information</h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
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

                {/* ── Center card — fills the remaining width between
                       the left stepper rail and the right preview rail,
                       no max-width clamp so the editor stretches as the
                       window grows. ─────────────────────────────────── */}
                <div className="flex-1 min-w-0 h-full bg-white border-1 border-[#e4e7ec] rounded-[20px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] flex flex-col overflow-hidden">
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
                            <p className="text-[14px] font-medium text-[#344054]">Variables (drag or click into the description)</p>
                            <div className="flex flex-wrap gap-2 px-3 py-3 border-1 border-[#e4e7ec] rounded-[8px] bg-[#fafafa]">
                                {VARIABLE_CHIPS.map(chip => (
                                    <button
                                        key={chip.token}
                                        type="button"
                                        draggable
                                        onClick={() => handleChipClick(chip.token)}
                                        onDragStart={e => handleChipDragStart(e, chip.token)}
                                        onDragEnd={handleChipDragEnd}
                                        title="Drag to place anywhere in the description, or click to insert at the cursor."
                                        className={cn(
                                            "cursor-grab active:cursor-grabbing flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] border-1 border-[#e9d7fe] bg-[#f4ebff] text-[#6941c6] text-[12px] font-medium hover:bg-[#e9d7fe] transition-colors select-none",
                                            draggingToken === chip.token && "opacity-50",
                                        )}
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
                                ref={editorRef}
                                value={description}
                                onChange={setDescription}
                                placeholder="Write the referral information... drag a variable chip above into this field to personalize per-member values."
                                rows={12}
                                className="flex-1 min-h-0"
                            />
                        </div>
                    </div>

                    {/* Footer — no top divider per the user's preference;
                        the Save button sits flush against the editor
                        body padding. */}
                    <div className="shrink-0 px-6 py-4 flex items-center justify-end">
                        <Button variant="primary" size="md" disabled={!valid} onClick={handleSave}>
                            Save changes
                        </Button>
                    </div>
                </div>

                {/* ── Right preview rail — matches Membership create
                       Template-preview chrome (header + divider + #f6f6f3
                       stage + inner mock card with DecorativeBanner). ── */}
                <div className="w-[400px] shrink-0 self-start bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="flex flex-col">
                        <div className="pt-6 px-6 flex flex-col gap-1">
                            <p className="font-semibold text-[18px] leading-[28px] text-[#101828]">Referral preview</p>
                            <p className="text-[14px] text-[#6e776f] leading-5">This is how your referral will look like.</p>
                        </div>
                        <div className="h-5" />
                        <div className="h-px bg-[#e4e7ec]" />
                    </div>
                    {/* Stage */}
                    <div className="bg-[#f6f6f3] px-6 py-10">
                        <div className="bg-white border-1 border-[#e4e7ec] rounded-[16px] overflow-hidden flex flex-col gap-4 pb-5 w-[352px] mx-auto">
                            <DecorativeBanner bannerHeight={120} iconBox={56} icon={HeartHand} {...BANNER_TINTS.package} />
                            <div className="flex flex-col gap-4 px-5">
                                <div className="flex flex-col gap-2 text-center">
                                    <p className="text-[18px] leading-[24px] font-semibold text-[#101828]">
                                        {previewTitle}
                                    </p>
                                    <p className="text-[13px] text-[#475467] leading-[18px]">
                                        {previewBody || "Description preview shows once you start typing."}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 w-full">
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
                </div>
            </div>

            <Toast />
        </div>
    );
}

/** Strip HTML tags so the right-rail preview shows the substituted body
 *  as plain text. The customer portal renders the rich HTML; the admin
 *  preview just shows the prose for readability. */
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
