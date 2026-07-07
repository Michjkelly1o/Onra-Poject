"use client";

import { useRef } from "react";
import { Image01, UploadCloud01 } from "@untitledui/icons";
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

            {/* Right column — label / copy / button stack. */}
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <p className="text-[16px] leading-[24px] font-medium text-[#101828]">{title}</p>
                    <p className="text-[14px] leading-[20px] text-[#475467]">{subtitle}</p>
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
