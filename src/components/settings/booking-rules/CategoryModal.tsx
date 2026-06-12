"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Service category modal (Booking Rules Phase 3)
// ─────────────────────────────────────────────────────────────────────────────
//
// Figma 4580:40094 (create — no image) + 4580:40351 (create — image
// uploaded) used for ADD mode. Same modal shell drives EDIT mode (title
// switches to "Edit service category" + button reads "Save changes").
//
// Single 400px modal shell:
//   • Header: title + close X (top-right)
//   • Body:
//       Row: 96×96 avatar (image-01 placeholder OR uploaded preview)
//            + "Upload image" / "Change image" secondary-gray button
//            + "Remove" tertiary-error link (only when an image exists)
//       Field: "Category name" — TextInput with placeholder
//   • Footer: Cancel + primary submit (disabled until name has content)
//
// Image upload is simulated — the file's data-URL is persisted on the
// category record so the avatar shows the picked image until the row is
// reloaded from seed.

import { useRef, useState } from "react";
import { XClose, Image01, UploadCloud02 } from "@untitledui/icons";
import { Button } from "@/components/ui/button";
import {
    Field, TextInput,
} from "@/components/settings/business/StudioProfileFormPage";
import type { ClassCategory } from "@/lib/store";

export interface CategoryModalProps {
    /** When provided, the modal opens in EDIT mode pre-filled with this
     *  category. Omit for CREATE mode. */
    existing?: ClassCategory;
    onClose: () => void;
    onSubmit: (patch: { name: string; image_url: string }) => void;
}

export function CategoryModal({ existing, onClose, onSubmit }: CategoryModalProps) {
    const isEditing = !!existing;
    const [name,     setName]     = useState<string>(existing?.name ?? "");
    const [imageUrl, setImageUrl] = useState<string>(existing?.image_url ?? "");
    const fileRef = useRef<HTMLInputElement>(null);

    const canSubmit = name.trim().length > 0;

    function handleUploadClick() { fileRef.current?.click(); }
    function handleFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setImageUrl(String(reader.result || ""));
        reader.readAsDataURL(file);
    }
    function handleRemoveImage() {
        setImageUrl("");
        if (fileRef.current) fileRef.current.value = "";
    }
    function handleSubmit() {
        if (!canSubmit) return;
        onSubmit({ name: name.trim(), image_url: imageUrl });
    }

    const title       = isEditing ? "Edit service category" : "Create new service category";
    const submitLabel = isEditing ? "Save changes"          : "Add category";

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[440px] flex flex-col">
                {/* ── Header ─────────────────────────────────────────── */}
                <div className="relative px-6 pt-6 pb-5">
                    <p className="text-[18px] font-semibold text-[#101828] leading-7 pr-12">
                        {title}
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors"
                    >
                        <XClose className="w-6 h-6 text-[#98a2b3]" />
                    </button>
                </div>

                {/* ── Body ───────────────────────────────────────────── */}
                <div className="px-6 flex flex-col gap-4">
                    {/* Image picker row */}
                    <div className="flex items-center gap-4">
                        <CategoryAvatar src={imageUrl} />
                        <Button
                            variant="secondary-gray"
                            size="md"
                            leftIcon={<UploadCloud02 className="w-5 h-5" />}
                            onClick={handleUploadClick}
                        >
                            {imageUrl ? "Change image" : "Upload image"}
                        </Button>
                        {imageUrl && (
                            <button
                                type="button"
                                onClick={handleRemoveImage}
                                className="text-[14px] font-semibold text-[#b42318] hover:text-[#912018] transition-colors px-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fda29b] rounded-[4px]"
                            >
                                Remove
                            </button>
                        )}
                        <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleFilePicked}
                        />
                    </div>

                    <Field label="Category name">
                        <TextInput
                            value={name}
                            onChange={setName}
                            placeholder="Enter category name"
                        />
                    </Field>
                </div>

                {/* ── Footer ─────────────────────────────────────────── */}
                <div className="flex gap-3 items-center p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        size="lg"
                        className="flex-1"
                        disabled={!canSubmit}
                        onClick={handleSubmit}
                    >
                        {submitLabel}
                    </Button>
                </div>
            </div>
        </div>
    );
}

// ─── Avatar primitive ───────────────────────────────────────────────────────

/** 96×96 round avatar. Uses the uploaded image when present; falls back to
 *  the gray image-01 placeholder that mirrors Figma 4580:40112. */
function CategoryAvatar({ src }: { src: string }) {
    return (
        <div
            className="relative w-[96px] h-[96px] rounded-full bg-[#f2f4f7] shrink-0 overflow-hidden flex items-center justify-center"
        >
            {src
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={src} alt="" className="w-full h-full object-cover rounded-full" />
                : <Image01 className="w-12 h-12 text-[#475467]" />
            }
            <div className="absolute inset-0 rounded-full border-1 border-[rgba(0,0,0,0.08)] pointer-events-none" />
        </div>
    );
}
