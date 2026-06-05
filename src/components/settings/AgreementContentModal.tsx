"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Agreement content view modal (Figma 4209-156334)
// ─────────────────────────────────────────────────────────────────────────────
//
// Shared modal that renders a single `AgreementVersion`'s content:
//   • content_type === "text"   → rich-text HTML rendered in the body
//   • content_type === "upload" → file embedded via <iframe> so PDFs preview
//     natively in modern browsers. DOC/DOCX fall back to the browser's
//     default handler (download or external viewer).
//
// Consumed by:
//   • AgreementDetailPage → "View" row action on the versions tab
//   • CustomerAgreementsTab → "View agreement" row action (Phase 4 wiring)

import { useEffect } from "react";
import { XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import type { AgreementVersion } from "@/lib/store";

export function AgreementContentModal({ version, agreementName, versionLabel, onClose }: {
    version: AgreementVersion | null;
    /** Optional agreement name shown as the modal title. Falls back to the
     *  generic "Agreement content" header when omitted. */
    agreementName?: string;
    /** Optional "Version N" label shown as subtitle next to the title. */
    versionLabel?: string;
    onClose: () => void;
}) {
    useEffect(() => {
        function h(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
        if (version) document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [version, onClose]);

    if (!version) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[600px] max-w-[90vw] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                <div className="pt-6 px-6 pb-5 border-b border-[#e4e7ec] relative">
                    {agreementName ? (
                        <div className="flex flex-col gap-1 pr-10">
                            <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828] truncate">{agreementName}</h3>
                            <p className="text-[14px] text-[#475467]">
                                {versionLabel ? `${versionLabel} · ` : ""}Agreement content
                            </p>
                        </div>
                    ) : (
                        <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Agreement content</h3>
                    )}
                    <button type="button" onClick={onClose}
                        className="absolute right-[12px] top-[12px] w-11 h-11 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors">
                        <XClose className="w-6 h-6 text-[#667085]" />
                    </button>
                </div>
                <div className="px-6 py-5">
                    {/* Single bordered panel — every content type renders as
                        styled prose. Uploads pass through the extracted HTML
                        produced at upload time by mammoth (DOCX) / pdfjs
                        (PDF) so the modal shows the document's actual
                        paragraphs / headings / lists, NOT a PDF viewer or a
                        download link. */}
                    <div className="border-1 border-[#e4e7ec] rounded-[12px] h-[360px] overflow-hidden bg-white">
                        <div
                            className="text-[16px] text-[#101828] leading-6 prose prose-headings:text-[#101828] prose-strong:text-[#101828] max-w-none h-full overflow-y-auto p-4"
                            dangerouslySetInnerHTML={{
                                __html: version.contentType === "upload"
                                    ? (version.extractedHtml ?? "<p><em>This file was uploaded before in-browser text extraction was wired. Re-upload via Add new version to render its contents.</em></p>")
                                    : (version.contentText ?? ""),
                            }}
                        />
                    </div>
                </div>
                <div className="border-t border-[#e4e7ec] px-6 py-5">
                    <Button variant="secondary-gray" size="lg" className="w-full" onClick={onClose}>Close</Button>
                </div>
            </div>
        </div>
    );
}
