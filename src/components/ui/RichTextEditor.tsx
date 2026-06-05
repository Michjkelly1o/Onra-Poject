"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Rich text editor (functional)
// ─────────────────────────────────────────────────────────────────────────────
//
// Toolbar matches the Figma — Paragraph / heading dropdown, Bold, Italic,
// Image (file upload), Link (modal), Align L/C/R/Justify, Bulleted list,
// Numbered list.
//
// Behaviours:
//   • Bold / Italic / Lists / Align buttons reflect the ACTIVE state of
//     the current selection (sage background when on).
//   • Paragraph dropdown trigger shows the current block tag ("Heading 1"
//     / "Heading 2" / "Heading 3" / "Heading 4" / "Paragraph").
//   • Image button opens the OS file picker; the selected image is read as
//     a data URL and inserted into the editor.
//   • Link button opens a small modal — URL input + Cancel / Apply. The
//     editor's selection is captured when the modal opens and restored on
//     Apply so the URL wraps the originally-selected text.
//
// Implementation: `contentEditable` + the legacy `document.execCommand` API.
// Lightweight, no dependencies. State is the editor's HTML.

import { useEffect, useRef, useState } from "react";
import {
    ChevronDown, Bold01, Italic01, Image01, Link01,
    AlignLeft, AlignCenter, AlignRight, AlignJustify,
    List, Dotpoints02, XClose,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface RichTextEditorProps {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
    rows?: number;
    className?: string;
}

const PARAGRAPH_OPTIONS: { value: "h1" | "h2" | "h3" | "h4" | "p"; label: string }[] = [
    { value: "h1", label: "Heading 1" },
    { value: "h2", label: "Heading 2" },
    { value: "h3", label: "Heading 3" },
    { value: "h4", label: "Heading 4" },
    { value: "p",  label: "Paragraph" },
];

const BLOCK_LABEL: Record<string, string> = {
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    h4: "Heading 4",
    p:  "Paragraph",
};

interface ActiveState {
    bold: boolean;
    italic: boolean;
    ul: boolean;
    ol: boolean;
    alignLeft: boolean;
    alignCenter: boolean;
    alignRight: boolean;
    alignJustify: boolean;
    block: string;
}

const INITIAL_ACTIVE: ActiveState = {
    bold: false, italic: false, ul: false, ol: false,
    alignLeft: false, alignCenter: false, alignRight: false, alignJustify: false,
    block: "p",
};

function ToolbarBtn({ onClick, ariaLabel, active = false, children }: {
    onClick: () => void; ariaLabel: string; active?: boolean; children: React.ReactNode;
}) {
    return (
        <button type="button"
            aria-label={ariaLabel}
            aria-pressed={active}
            // Prevent default mouse-down so the editor's selection isn't lost
            // before `execCommand` runs.
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            className={cn(
                "w-7 h-7 flex items-center justify-center rounded-[6px] transition-colors duration-75",
                active
                    ? "bg-[#f2f4f7] text-[#344054]"
                    : "text-[#475467] hover:bg-[#f9fafb]",
            )}>
            {children}
        </button>
    );
}

function ToolbarDivider() {
    return <span className="w-px h-5 bg-[#e4e7ec] shrink-0" />;
}

export function RichTextEditor({ value, onChange, placeholder, rows = 6, className }: RichTextEditorProps) {
    const editorRef    = useRef<HTMLDivElement>(null);
    const dropdownRef  = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // Selection saved when the Link modal opens, restored on Apply so the
    // URL wraps the originally-selected text rather than the modal's input.
    const savedRangeRef = useRef<Range | null>(null);

    const [paragraphOpen, setParagraphOpen] = useState(false);
    const [isEmpty, setIsEmpty]             = useState(() => !stripHtml(value));
    const [active, setActive]               = useState<ActiveState>(INITIAL_ACTIVE);

    // Link modal state.
    const [linkModalOpen, setLinkModalOpen] = useState(false);
    const [linkUrl, setLinkUrl]             = useState("");

    // Initial mount — seed the editor's innerHTML from the value prop.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (el.innerHTML !== value) {
            el.innerHTML = value;
            setIsEmpty(!stripHtml(value));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // External value changes — only resync when the editor is NOT focused so
    // we don't blow away the user's caret mid-typing.
    useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        if (document.activeElement === el) return;
        if (el.innerHTML !== value) {
            el.innerHTML = value;
            setIsEmpty(!stripHtml(value));
        }
    }, [value]);

    // Snapshot the current selection's formatting flags. Called by both the
    // selectionchange listener AND directly after every `exec()` so the
    // button visuals flip the instant the user clicks — they don't wait on
    // the browser to fire `selectionchange` (which can be lazy).
    function refreshActive() {
        const sel = window.getSelection();
        const editor = editorRef.current;
        if (!sel || !editor) return;
        const anchor = sel.anchorNode;
        if (!anchor || !editor.contains(anchor)) return;
        const block = String(document.queryCommandValue("formatBlock") || "p").toLowerCase();
        setActive({
            bold:         document.queryCommandState("bold"),
            italic:       document.queryCommandState("italic"),
            ul:           document.queryCommandState("insertUnorderedList"),
            ol:           document.queryCommandState("insertOrderedList"),
            alignLeft:    document.queryCommandState("justifyLeft"),
            alignCenter:  document.queryCommandState("justifyCenter"),
            alignRight:   document.queryCommandState("justifyRight"),
            alignJustify: document.queryCommandState("justifyFull"),
            block:        BLOCK_LABEL[block] ? block : "p",
        });
    }

    // Track active formatting states on every selection change while the
    // editor is focused. The listener is the global fallback; `exec()` also
    // calls `refreshActive()` directly for immediate visual feedback.
    useEffect(() => {
        document.addEventListener("selectionchange", refreshActive);
        return () => document.removeEventListener("selectionchange", refreshActive);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close the Paragraph dropdown on outside click.
    useEffect(() => {
        function onDocClick(e: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setParagraphOpen(false);
            }
        }
        if (paragraphOpen) document.addEventListener("mousedown", onDocClick);
        return () => document.removeEventListener("mousedown", onDocClick);
    }, [paragraphOpen]);

    function emitChange() {
        const html = editorRef.current?.innerHTML ?? "";
        onChange(html);
        setIsEmpty(!stripHtml(html));
    }

    function exec(command: string, arg?: string) {
        editorRef.current?.focus();
        document.execCommand(command, false, arg);
        emitChange();
        // Synchronous active-state refresh so the button visuals flip on
        // the very same frame as the click — no waiting on selectionchange.
        refreshActive();
    }

    function setBlock(tag: "p" | "h1" | "h2" | "h3" | "h4") {
        exec("formatBlock", `<${tag}>`);
        setParagraphOpen(false);
    }

    // ── Image: open the OS file picker, read selected file as a data URL,
    //          insert into the editor at the current caret. ──
    function handleImageClick() {
        fileInputRef.current?.click();
    }
    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file later
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = String(reader.result ?? "");
            if (!dataUrl) return;
            exec("insertImage", dataUrl);
        };
        reader.readAsDataURL(file);
    }

    // ── Link: open modal. Save the current selection so Apply can wrap it. ──
    function handleLinkClick() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
            savedRangeRef.current = sel.getRangeAt(0).cloneRange();
        } else {
            savedRangeRef.current = null;
        }
        setLinkUrl("");
        setLinkModalOpen(true);
    }
    function applyLink() {
        const url = linkUrl.trim();
        if (!url) return;
        editorRef.current?.focus();
        // Restore the editor's pre-modal selection so `createLink` wraps the
        // originally-selected text instead of the modal's text input.
        const saved = savedRangeRef.current;
        if (saved) {
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(saved);
        }
        document.execCommand("createLink", false, url);
        emitChange();
        setLinkModalOpen(false);
        setLinkUrl("");
    }

    const minHeight = rows * 22 + 24;
    const currentBlockLabel = BLOCK_LABEL[active.block] ?? "Paragraph";

    return (
        <div className={cn(
            "w-full bg-white border-1 border-[#d0d5dd] rounded-[8px] shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)] overflow-hidden flex flex-col",
            className,
        )}>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#e4e7ec]">
                {/* Paragraph / heading dropdown */}
                <div ref={dropdownRef} className="relative">
                    <button type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => setParagraphOpen(p => !p)}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-[6px] border-1 border-[#d0d5dd] bg-white text-[14px] text-[#344054] hover:bg-[#f9fafb] transition-colors min-w-[140px] justify-between">
                        <span>{currentBlockLabel}</span>
                        <ChevronDown className="w-4 h-4 text-[#667085]" />
                    </button>
                    {paragraphOpen && (
                        <div className="absolute left-0 top-[calc(100%+4px)] z-50 bg-white border-1 border-[#e4e7ec] rounded-[8px] shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.08),0px_4px_6px_-2px_rgba(16,24,40,0.03)] py-1 min-w-[160px]">
                            {PARAGRAPH_OPTIONS.map(opt => (
                                <button key={opt.value} type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => setBlock(opt.value)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-[14px] transition-colors duration-75",
                                        active.block === opt.value
                                            ? "bg-[#f2f4f7] text-[#344054] font-semibold"
                                            : "text-[#344054] hover:bg-[#f9fafb]",
                                    )}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <ToolbarDivider />
                <ToolbarBtn ariaLabel="Bold"   active={active.bold}   onClick={() => exec("bold")}>   <Bold01   className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Italic" active={active.italic} onClick={() => exec("italic")}> <Italic01 className="w-4 h-4" /></ToolbarBtn>
                <ToolbarDivider />
                <ToolbarBtn ariaLabel="Insert image" onClick={handleImageClick}><Image01 className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Insert link"  onClick={handleLinkClick}> <Link01  className="w-4 h-4" /></ToolbarBtn>
                <ToolbarDivider />
                <ToolbarBtn ariaLabel="Align left"   active={active.alignLeft}    onClick={() => exec("justifyLeft")}>  <AlignLeft    className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Align center" active={active.alignCenter}  onClick={() => exec("justifyCenter")}><AlignCenter  className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Align right"  active={active.alignRight}   onClick={() => exec("justifyRight")}> <AlignRight   className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Justify"      active={active.alignJustify} onClick={() => exec("justifyFull")}>  <AlignJustify className="w-4 h-4" /></ToolbarBtn>
                <ToolbarDivider />
                <ToolbarBtn ariaLabel="Bulleted list" active={active.ul} onClick={() => exec("insertUnorderedList")}><List       className="w-4 h-4" /></ToolbarBtn>
                <ToolbarBtn ariaLabel="Numbered list" active={active.ol} onClick={() => exec("insertOrderedList")}>  <Dotpoints02 className="w-4 h-4" /></ToolbarBtn>

                {/* Hidden file input — invoked by the Image button. */}
                <input ref={fileInputRef} type="file" accept="image/*"
                    onChange={handleFileChange} className="hidden" />
            </div>

            {/* Editor body — `flex-1 min-h-0` so when the outer container has
                `flex-1` from the caller (e.g. on the Customize referral
                information page), the editor stretches to fill instead of
                sitting at a fixed `minHeight`. The `minHeight` style still
                guarantees a comfortable size when the container hugs its
                content. */}
            <div className="relative flex-1 min-h-0 flex flex-col">
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={emitChange}
                    style={{ minHeight }}
                    className={cn(
                        "flex-1 min-h-0 w-full px-4 py-3 text-[14px] text-[#101828] focus:outline-none leading-[20px] overflow-y-auto",
                        "[&_h1]:text-[28px] [&_h1]:font-bold     [&_h1]:leading-[36px] [&_h1]:my-2",
                        "[&_h2]:text-[24px] [&_h2]:font-bold     [&_h2]:leading-[32px] [&_h2]:my-2",
                        "[&_h3]:text-[20px] [&_h3]:font-semibold [&_h3]:leading-[28px] [&_h3]:my-2",
                        "[&_h4]:text-[16px] [&_h4]:font-semibold [&_h4]:leading-[24px] [&_h4]:my-2",
                        "[&_ul]:list-disc    [&_ul]:pl-6",
                        "[&_ol]:list-decimal [&_ol]:pl-6",
                        "[&_a]:text-[#3538cd] [&_a]:underline",
                        "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-[6px] [&_img]:my-2",
                    )}
                />
                {isEmpty && placeholder && (
                    <span className="absolute top-3 left-4 text-[14px] text-[#667085] pointer-events-none select-none">
                        {placeholder}
                    </span>
                )}
            </div>

            {/* Insert link modal — same chrome as the app's confirm modals. */}
            {linkModalOpen && (
                <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#0c111d]/60" onClick={() => setLinkModalOpen(false)} />
                    <div className="relative bg-white rounded-[12px] w-[440px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                        <div className="px-6 pt-6 pb-4 flex items-start gap-4">
                            <div className="flex-1 flex flex-col gap-1">
                                <h3 className="font-semibold text-[18px] leading-[28px] text-[#101828]">Insert link</h3>
                                <p className="text-[14px] text-[#475467] leading-[20px]">Enter the URL to link to your selected text.</p>
                            </div>
                            <button type="button" onClick={() => setLinkModalOpen(false)}
                                aria-label="Close"
                                className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0 -mt-1 -mr-2">
                                <XClose className="w-5 h-5 text-[#667085]" />
                            </button>
                        </div>
                        <div className="px-6 pb-5 flex flex-col gap-1.5">
                            <p className="text-[14px] font-medium text-[#344054]">URL</p>
                            <input type="url"
                                value={linkUrl}
                                onChange={e => setLinkUrl(e.target.value)}
                                onKeyDown={e => { if (e.key === "Enter" && linkUrl.trim()) applyLink(); }}
                                placeholder="https://"
                                autoFocus
                                className="h-10 w-full px-[14px] bg-white border-1 border-[#d0d5dd] rounded-[8px] text-[16px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] focus:border-[#7ba08c] transition-all shadow-[0px_1px_2px_0px_rgba(16,24,40,0.05)]"
                            />
                        </div>
                        <div className="flex gap-3 px-6 pt-4 pb-6 border-t border-[#e4e7ec]">
                            <Button variant="secondary-gray" size="lg" className="flex-1" onClick={() => setLinkModalOpen(false)}>Cancel</Button>
                            <Button variant="primary" size="lg" className="flex-1" disabled={!linkUrl.trim()} onClick={applyLink}>Apply</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/** Strip tags + nbsp so we can detect a truly-empty editor (which often
 *  contains a stray `<br>` or `<div><br></div>` after user clears it). */
function stripHtml(html: string): string {
    return html
        .replace(/<br\s*\/?>/gi, "")
        .replace(/<\/?(div|p|span)[^>]*>/gi, "")
        .replace(/&nbsp;/g, " ")
        .trim();
}
