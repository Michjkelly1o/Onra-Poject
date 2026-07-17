"use client";

import { useRef } from "react";
import { HelpCircle, Image01, UploadCloud01 } from "@untitledui/icons";
import { cn } from "@/lib/utils";

/** Two-column image banner uploader — 4:3 tile on the left, label + copy +
 *  secondary "Upload image" button on the right. Matches Figma 7781:220725.
 *
 *  Shared across Class templates, Class schedule, Promotions, Campaigns and
 *  Services form pages so the create + edit flows all render the same shape.
 *  The tile itself is NOT clickable — the CTA is the button — but drop-target
 *  behaviour is preserved on the tile so drag-and-drop still works. */
export function ImageBannerUpload({
    preview,
    onChange,
    title = "Image banner",
    subtitle = "PNG or JPEG · Up to 2 MB",
    accept = "image/png,image/jpeg",
    tileClassName,
    sizeGuide,
}: {
    preview: string | null;
    onChange: (url: string | null, file: File | null) => void;
    /** Right-column title. Defaults to "Image banner". */
    title?: string;
    /** Right-column supporting copy. Defaults to "PNG or JPEG · Up to 2 MB". */
    subtitle?: string;
    /** Accepted MIME types. Defaults to PNG + JPEG. */
    accept?: string;
    /** Extra classes for the tile (e.g. override the width cap). */
    tileClassName?: string;
    /** Optional recommendation text shown on hover of the "Image size guide"
     *  label. Only rendered when set — consumers whose customer-side render
     *  ratio isn't specified (e.g. class templates) can leave it undefined. */
    sizeGuide?: string;
}) {
    const ref = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        const url = URL.createObjectURL(file);
        onChange(url, file);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) handleFile(file);
    }

    return (
        <div className="flex gap-4 items-center">
            {/* Left tile — 4:3, gray fill, subtle contrast border. Empty-state
                shows the picture-mountain icon centered per Figma. */}
            <div
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className={cn(
                    "w-[282px] aspect-[4/3] shrink-0 bg-[#f2f4f7] border border-black/[0.08] rounded-[11px] overflow-hidden flex items-center justify-center",
                    tileClassName,
                )}
            >
                {preview
                    ? <img src={preview} alt="Banner" className="w-full h-full object-cover" />
                    : <Image01 className="w-13 h-13 text-[#98a2b3]" style={{ width: 52, height: 52 }} />}
            </div>

            {/* Right column — label / copy / size-guide / button stack. */}
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] leading-[24px] font-medium text-[#101828]">{title}</p>
                    <p className="text-[14px] leading-[20px] text-[#475467]">{subtitle}</p>
                    {/* Size guide — opt-in via `sizeGuide` prop. Semibold
                        label draws the admin's eye; the HelpCircle icon
                        opens a dark floating tooltip on hover / focus with
                        the exact recommended dimensions so the uploaded
                        thumbnail lands crisp on the customer side. Uses
                        the same tooltip pattern as InsightMetricCard. */}
                    {sizeGuide ? (
                        <div className="relative inline-flex items-center gap-1.5 self-start group/tip">
                            <span className="text-[14px] leading-[20px] font-semibold text-[#344054]">
                                Image size guide
                            </span>
                            <button
                                type="button"
                                aria-label="Image size guide"
                                className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#aad4bd]"
                            >
                                <HelpCircle className="w-4 h-4 text-[#98a2b3]" />
                            </button>
                            <div
                                role="tooltip"
                                className={cn(
                                    "pointer-events-none absolute z-20 left-0 top-full mt-2 w-[280px]",
                                    "rounded-[8px] bg-[#101828] px-3 py-2 text-[12px] leading-[18px] text-white",
                                    "shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)]",
                                    "opacity-0 translate-y-[-2px] transition-all duration-150",
                                    "group-hover/tip:opacity-100 group-hover/tip:translate-y-0",
                                    "group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0",
                                )}
                            >
                                {sizeGuide}
                            </div>
                        </div>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => ref.current?.click()}
                    className="inline-flex items-center gap-1 self-start h-9 px-3 py-2 bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[14px] leading-[20px] font-semibold text-[#344054] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] hover:bg-[#f9fafb] transition-colors"
                >
                    <UploadCloud01 className="w-5 h-5" />
                    Upload image
                </button>
            </div>

            <input
                ref={ref}
                type="file"
                accept={accept}
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
        </div>
    );
}
