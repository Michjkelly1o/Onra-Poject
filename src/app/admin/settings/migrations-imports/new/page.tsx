"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings · Operations · Migration & imports · New
// ─────────────────────────────────────────────────────────────────────────────
//
// Placeholder page reached by the `+ Import` button on the migrations-imports
// list. When the ONRA AI Agent integration ships (sibling project at
// `/ONRA AI-Agent`), this route will be replaced by / redirect into the
// agent's source → upload → mapping → preview → commit flow. Every
// successful commit will then write one row into the store's
// `importHistory` slice and route the admin back to the list.
//
// For now the page is deliberately minimal: title, one-line explainer, and
// a Cancel button back to the list. Same "coming-soon" tone the
// AddWidgetModal uses on the still-empty Private sessions + Recovery tabs.

import { useRouter } from "next/navigation";
import { Stars02, ArrowLeft } from "@untitledui/icons";
import { Button } from "@/components/ui/button";

export default function MigrationsImportsNewPage() {
    const router = useRouter();
    const backHref = "/admin/settings/migrations-imports";

    return (
        <div className="flex flex-col gap-6">
            <div className="bg-white border-1 border-[#e4e7ec] rounded-[20px] min-h-[760px] flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-6 max-w-[520px] text-center">
                    {/* Placeholder illustration — same "stacked white tile
                        with a subtle inner card" pattern the EmptyState
                        component uses so this feels part of the family. */}
                    <div className="bg-[#f9fafb] rounded-[16px] p-[10px] w-[240px] flex items-center justify-center shadow-[0px_1px_1px_rgba(16,24,40,0.05)]">
                        <div className="bg-white rounded-[10px] w-[52px] h-[52px] flex items-center justify-center shrink-0 shadow-[0px_1.5px_3.8px_rgba(0,0,0,0.02)]">
                            <div className="bg-[#f9fafb] rounded-[7px] w-[32px] h-[32px] flex items-center justify-center">
                                <Stars02 className="w-[18px] h-[18px] text-[#7ba08c]" />
                            </div>
                        </div>
                        <div className="flex-1 ml-3 flex flex-col gap-2">
                            <div className="h-[10px] rounded-full bg-[#f2f4f7] w-[80px]" />
                            <div className="h-[10px] rounded-full bg-[#f2f4f7] w-full" />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-[18px] font-semibold text-[#101828]">
                            AI Agent import — coming soon
                        </p>
                        <p className="text-[14px] text-[#475467]">
                            The ONRA AI Agent will guide you through source pick, file
                            upload, column mapping, preview, and commit. Every completed
                            import lands back in Migration &amp; imports as an audit row.
                        </p>
                    </div>

                    <Button
                        variant="secondary-gray"
                        size="md"
                        leftIcon={<ArrowLeft className="w-4 h-4" />}
                        onClick={() => router.push(backHref)}
                    >
                        Back to Migration &amp; imports
                    </Button>
                </div>
            </div>
        </div>
    );
}
