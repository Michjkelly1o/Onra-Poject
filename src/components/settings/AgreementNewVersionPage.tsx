"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Add new version agreement (Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma reference: 4209-156753 (full-page modal, 1-step wizard).
//
// Same chrome as the Phase-2 wizard (72px header + 300px step sidebar +
// 720px form card), but with only ONE step ("Agreement") because we're
// just publishing a new version's content — the agreement's
// name / rules / dates already exist on the parent.
//
// On Create:
//   • addAgreementVersion bumps the parent's `currentVersion`
//     automatically (store action handles the sync).
//   • Toast + router.push back to the detail page so the user can see
//     the new version listed under the "Agreement version" tab.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { XClose } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
    ContentTypeCard, UploadZone, type UploadedFile,
} from "./AgreementFormPage";
import {
    useAppStore,
    type AgreementContentType,
} from "@/lib/store";

const RETURN_ROUTE = "/admin/settings/agreements";

export function AgreementNewVersionPage({ agreementId }: { agreementId: string }) {
    const router = useRouter();

    const agreement = useAppStore(s => s.agreements.find(a => a.id === agreementId));
    const addAgreementVersion = useAppStore(s => s.addAgreementVersion);
    const showToast = useAppStore(s => s.showToast);

    const [contentType, setContentType] = useState<AgreementContentType>("text");
    const [text, setText] = useState("");
    const [file, setFile] = useState<UploadedFile | null>(null);

    // Guard: bounce if id is unknown.
    useEffect(() => {
        if (!agreement) router.replace(RETURN_ROUTE);
    }, [agreement, router]);

    const canCreate = contentType === "text"
        ? text.trim().length > 0
        : file !== null && !file.parsing;

    function handleClose() {
        router.push(`/settings/agreements/${agreementId}`);
    }

    function handleCreate() {
        if (!agreement) return;
        const nextVersionNumber = agreement.currentVersion + 1;
        addAgreementVersion({
            agreementId,
            versionNumber: nextVersionNumber,
            contentType,
            contentText: contentType === "text" ? text : undefined,
            fileName: contentType === "upload" ? file?.fileName : undefined,
            fileUrl: contentType === "upload" ? file?.fileUrl : undefined,
            fileSizeBytes: contentType === "upload" ? file?.sizeBytes : undefined,
            extractedHtml: contentType === "upload" ? file?.extractedHtml : undefined,
            publishedBy: "user_alex_owen",
        });
        showToast(
            "New version published",
            `${agreement.name} is now on Version ${nextVersionNumber}.`,
            "success", "check",
        );
        router.push(`/settings/agreements/${agreementId}`);
    }

    if (!agreement) return null;

    return (
        <div className="h-screen bg-white flex flex-col overflow-hidden">
            {/* Top header (72px) */}
            <div className="flex items-center gap-3 px-6 h-[72px] shrink-0">
                <button type="button" onClick={handleClose} aria-label="Close"
                    className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0">
                    <XClose className="w-5 h-5 text-[#667085]" />
                </button>
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h1 className="font-semibold text-[20px] leading-[30px] text-[#101828]">
                        Add new version agreement
                    </h1>
                    <Breadcrumbs className="p-0 text-[12px]" />
                </div>
            </div>

            {/* 2-column body */}
            <div className="flex-1 overflow-hidden">
                <div className="flex gap-8 px-6 pb-6 h-full items-stretch">
                    {/* Left: progress steps (single step, always active) */}
                    <div className="w-[300px] shrink-0 flex flex-col">
                        <div className="flex gap-4 h-[52px] items-center p-4 rounded-[12px] w-full bg-[#f5fffa]">
                            <div className="relative flex flex-col items-center shrink-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-medium bg-[#658774] text-white shadow-[0px_0px_0px_2px_white,0px_0px_0px_4px_#7ba08c]">
                                    1
                                </div>
                            </div>
                            <span className="text-[14px] font-semibold text-[#3b5446]">Agreement</span>
                        </div>
                    </div>

                    {/* Middle: form card */}
                    <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] flex flex-col flex-1 min-w-0 max-w-[720px] w-[628px] h-full overflow-hidden">
                        <div className="flex-1 overflow-y-auto scrollbar-hide p-6 flex flex-col gap-6">
                            <h2 className="font-semibold text-[18px] leading-[28px] text-[#101828]">
                                Agreement setup
                            </h2>

                            <div className="flex gap-4 w-full">
                                <ContentTypeCard
                                    title="Write agreement manually"
                                    selected={contentType === "text"}
                                    onSelect={() => setContentType("text")}
                                />
                                <ContentTypeCard
                                    title="Upload agreement file"
                                    selected={contentType === "upload"}
                                    onSelect={() => setContentType("upload")}
                                />
                            </div>

                            {contentType === "text" ? (
                                <RichTextEditor
                                    value={text}
                                    onChange={setText}
                                    placeholder="Write the new version's agreement text..."
                                    rows={10}
                                />
                            ) : (
                                <UploadZone value={file} onChange={setFile} />
                            )}
                        </div>

                        <div className="shrink-0 px-6 pb-6 pt-6 flex items-center justify-end w-full">
                            <Button variant="primary" size="md" disabled={!canCreate} onClick={handleCreate}>
                                Create
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
