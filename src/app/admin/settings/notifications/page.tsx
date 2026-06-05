"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — Settings → Customer notifications (PRD 11 §12)
// ─────────────────────────────────────────────────────────────────────────────
//
// Layout (Figma 4467-35019):
//   • ONE bordered card hosts the whole table.
//   • Top row = column headers — "Notifications | Email | WhatsApp | Push".
//   • Five collapsible accordion sections (chevron + category icon + name):
//     Booking · Payment · Package & membership · Marketing & promotions ·
//     Referral. All five default open; toggling collapses one at a time.
//   • Each event row carries 3 independent channel toggles + an
//     "Edit template" button → opens a centered template editor.
//
// Template editor modal:
//   • Top half: 2-column grid — left = subject + body editor (with optional
//     Email / WhatsApp tab if both channels are supported), right = the
//     Variables reference list.
//   • Below both columns: full-width info alert ("Variables are
//     case-sensitive…").
//   • Below the alert: full-width preview (toggled by "Show preview").

import { useEffect, useMemo, useRef, useState } from "react";
import {
    Edit02, RefreshCcw01, XClose, Check, Lightbulb02,
    CalendarCheck01, BankNote01, CreditCard02, Announcement02, Users01,
    ChevronDown, SlashCircle01,
} from "@untitledui/icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import {
    useAppStore,
    type NotificationSetting,
    type NotificationCategory,
} from "@/lib/store";
import { notification_settings as SEED_NOTIFICATIONS } from "@/data/mock/notification_settings";

// ─── Static config — group meta ───────────────────────────────────────────

const CATEGORY_META: Record<NotificationCategory, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
    booking:            { label: "Booking notifications",   Icon: CalendarCheck01 },
    payment:            { label: "Payment notifications",   Icon: BankNote01      },
    package_membership: { label: "Package & membership",    Icon: CreditCard02    },
    marketing:          { label: "Marketing & promotions",  Icon: Announcement02  },
    referral:           { label: "Referral notifications",  Icon: Users01         },
};

const CATEGORY_ORDER: NotificationCategory[] = [
    "booking", "payment", "package_membership", "marketing", "referral",
];

const TEMPLATE_VARIABLES = [
    "{member_name}", "{class_name}", "{class_date}", "{class_time}",
    "{instructor_name}", "{branch_name}", "{credits_remaining}",
    "{expiry_date}", "{package_name}", "{booking_id}", "{studio_name}",
];

// Toggle column width — used both in the column header bar at the top of
// the card AND in each event row's toggle stack so they line up.
const TOGGLE_COL = "w-[110px]";
// The "Edit template" button column needs a fixed slot on the right so the
// toggle columns above don't drift when rows have / don't have a button.
const EDIT_COL = "w-[148px]";

// ─── Tiny atoms ────────────────────────────────────────────────────────────

function Toggle({ on, onChange, ariaLabel }: {
    on: boolean; onChange: (next: boolean) => void; ariaLabel: string;
}) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={ariaLabel}
            onClick={() => onChange(!on)}
            className={cn(
                "w-9 h-5 rounded-full p-0.5 flex items-center shrink-0 transition-colors",
                on ? "bg-[#658774]" : "bg-[#f2f4f7]",
            )}>
            <div className={cn(
                "w-4 h-4 rounded-full bg-white shadow-[0px_1px_3px_0px_rgba(16,24,40,0.1),0px_1px_2px_0px_rgba(16,24,40,0.06)] transition-transform",
                on ? "translate-x-4" : "translate-x-0",
            )} />
        </button>
    );
}

// ─── Event row ────────────────────────────────────────────────────────────

function EventRow({ ns, onEdit, onChannelToggle }: {
    ns: NotificationSetting;
    onEdit: () => void;
    onChannelToggle: (channel: "email" | "whatsapp" | "push", next: boolean) => void;
}) {
    return (
        <div className="px-6 py-3 flex items-center gap-6 border-t border-[#f2f4f7]">
            {/* Label sits indented under the section header so the visual
                hierarchy "section → events" reads cleanly. */}
            <p className="flex-1 min-w-0 text-[14px] text-[#344054] pl-7">{ns.label}</p>

            {/* Three channel toggles — aligned with the column headers at
                the top of the card. Toggles stage a confirm modal up at the
                page level instead of mutating state directly. */}
            <div className="flex items-center shrink-0">
                <div className={cn(TOGGLE_COL, "flex items-center justify-center")}>
                    <Toggle on={ns.emailEnabled}
                        onChange={v => onChannelToggle("email", v)}
                        ariaLabel={`${ns.label} — Email`} />
                </div>
                <div className={cn(TOGGLE_COL, "flex items-center justify-center")}>
                    <Toggle on={ns.whatsappEnabled}
                        onChange={v => onChannelToggle("whatsapp", v)}
                        ariaLabel={`${ns.label} — WhatsApp`} />
                </div>
                <div className={cn(TOGGLE_COL, "flex items-center justify-center")}>
                    <Toggle on={ns.pushEnabled}
                        onChange={v => onChannelToggle("push", v)}
                        ariaLabel={`${ns.label} — Push`} />
                </div>
            </div>

            {/* Edit template button — fixed-width slot so the toggle columns
                line up perfectly with the column headers. */}
            <div className={cn(EDIT_COL, "flex items-center justify-end shrink-0")}>
                <button type="button" onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 h-8 rounded-[8px] border-1 border-[#d0d5dd] bg-white text-[14px] font-medium text-[#344054] hover:bg-[#f9fafb] transition-colors whitespace-nowrap">
                    <Edit02 className="w-4 h-4 text-[#667085]" />
                    Edit template
                </button>
            </div>
        </div>
    );
}

// ─── Accordion section ───────────────────────────────────────────────────

function AccordionSection({ category, items, open, onToggle, onEdit, onChannelToggle }: {
    category: NotificationCategory;
    items: NotificationSetting[];
    open: boolean;
    onToggle: () => void;
    onEdit: (ns: NotificationSetting) => void;
    onChannelToggle: (ns: NotificationSetting, channel: "email" | "whatsapp" | "push", next: boolean) => void;
}) {
    const meta = CATEGORY_META[category];
    const { Icon } = meta;
    return (
        <>
            <button type="button" onClick={onToggle}
                className="w-full px-6 py-3 flex items-center gap-3 hover:bg-[#f9fafb] transition-colors text-left">
                <ChevronDown
                    className={cn(
                        "w-4 h-4 text-[#667085] shrink-0 transition-transform",
                        !open && "-rotate-90",
                    )}
                />
                <Icon className="w-5 h-5 text-[#475467] shrink-0" />
                <p className="flex-1 text-[14px] font-semibold text-[#101828]">{meta.label}</p>
            </button>

            {open && (items.length === 0 ? (
                <div className="px-6 py-4 border-t border-[#f2f4f7]">
                    <p className="text-[14px] text-[#667085] pl-7">No events configured in this group.</p>
                </div>
            ) : (
                items.map(ns => (
                    <EventRow
                        key={ns.id}
                        ns={ns}
                        onEdit={() => onEdit(ns)}
                        onChannelToggle={(channel, next) => onChannelToggle(ns, channel, next)}
                    />
                ))
            ))}
        </>
    );
}

// ─── Template editor modal ────────────────────────────────────────────────

function TemplateEditor({ ns, onClose }: { ns: NotificationSetting; onClose: () => void }) {
    const updateTemplate = useAppStore(s => s.updateNotificationTemplate);
    const showToast      = useAppStore(s => s.showToast);
    // Phase 3 cross-module sync — `{studio_name}` in the live preview now
    // substitutes the centralized Branding `displayName`, so editing the
    // studio name through Settings → Branding flips the preview here too.
    const studioName     = useAppStore(s => s.brandingSettings.displayName);
    const seed = useMemo(() => SEED_NOTIFICATIONS.find(s => s.id === ns.id), [ns.id]);

    const supportsEmail    = !!seed?.email_template;
    const supportsWhatsapp = !!seed?.whatsapp_template;

    const [subject, setSubject]         = useState(ns.emailSubject ?? "");
    const [emailBody, setEmailBody]     = useState(ns.emailTemplate ?? "");
    const [waBody, setWaBody]           = useState(ns.whatsappTemplate ?? "");
    const [activeTab, setActiveTab]     = useState<"email" | "whatsapp">(supportsEmail ? "email" : "whatsapp");

    // Drag-and-drop wiring — the variable chips on the right rail can be
    // dragged into any of the three editable fields. Refs let us focus the
    // dropped-on field and restore the cursor position after the variable
    // is inserted.
    const subjectRef   = useRef<HTMLInputElement | null>(null);
    const emailBodyRef = useRef<HTMLTextAreaElement | null>(null);
    const waBodyRef    = useRef<HTMLTextAreaElement | null>(null);
    const [dragHover, setDragHover] = useState<"subject" | "email" | "whatsapp" | null>(null);

    /** Insert `variable` at the field's current selection (drop position).
     *  Falls back to appending at the end when the selection API is
     *  unavailable. After the state update lands, the caret is moved to
     *  sit right after the inserted variable so the user can keep typing. */
    function dropVariable(
        variable: string,
        current: string,
        setter: (next: string) => void,
        el: HTMLInputElement | HTMLTextAreaElement | null,
    ) {
        const cursor = el?.selectionStart ?? current.length;
        const end    = el?.selectionEnd   ?? cursor;
        const next   = current.slice(0, cursor) + variable + current.slice(end);
        setter(next);
        // Defer cursor placement to the frame after the state-driven render.
        requestAnimationFrame(() => {
            if (!el) return;
            const pos = cursor + variable.length;
            el.focus();
            el.setSelectionRange(pos, pos);
        });
    }

    // Browser default for drop on a text field is to insert the dragged
    // string at the drop point. We preventDefault so React state stays the
    // single source of truth — otherwise the field would render the
    // browser-inserted text and the state would skip a beat.
    function allowDrop(e: React.DragEvent) {
        if (e.dataTransfer.types.includes("application/x-onra-variable")) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
        }
    }

    function handleSave() {
        const patch: Partial<NotificationSetting> = {};
        if (supportsEmail) {
            patch.emailSubject = subject;
            patch.emailTemplate = emailBody;
        }
        if (supportsWhatsapp) {
            patch.whatsappTemplate = waBody;
        }
        updateTemplate(ns.id, patch);
        showToast("Template saved", `${ns.label} template updated.`, "success", "check");
        onClose();
    }

    function handleReset() {
        setSubject(seed?.email_subject ?? "");
        setEmailBody(seed?.email_template ?? "");
        setWaBody(seed?.whatsapp_template ?? "");
        showToast("Template reset", `Restored the system default for ${ns.label}.`, "success", "refresh");
    }

    // Live preview substitutes the most common variables with sample text.
    function renderPreview(text: string): string {
        return text
            .replace(/{member_name}/g,     "Aliah Lane")
            .replace(/{class_name}/g,      "Reformer Pilates")
            .replace(/{class_date}/g,      "Mar 14")
            .replace(/{class_time}/g,      "9:00 AM")
            .replace(/{instructor_name}/g, "Maya Johnson")
            .replace(/{branch_name}/g,     "Forma Studio (South)")
            .replace(/{credits_remaining}/g, "4")
            .replace(/{expiry_date}/g,     "Apr 28")
            .replace(/{package_name}/g,    "10-Class Package")
            .replace(/{booking_id}/g,      "BK-00482")
            .replace(/{studio_name}/g,     studioName);
    }

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#0c111d]/60" onClick={onClose} />
            <div className="relative bg-white rounded-[16px] w-[880px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-5 pb-4 flex items-start gap-4 border-b border-[#e4e7ec]">
                    <div className="flex-1 flex flex-col gap-1">
                        <p className="text-[18px] font-semibold text-[#101828]">Edit template — {ns.label}</p>
                        <p className="text-[14px] text-[#667085] leading-[20px]">Customise the copy sent to members for this event. Variables in <code className="font-mono text-[13px] text-[#3538cd]">{`{curly_braces}`}</code> are replaced at send time.</p>
                    </div>
                    <button type="button" onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors shrink-0"
                        aria-label="Close">
                        <XClose className="w-5 h-5 text-[#667085]" />
                    </button>
                </div>

                {/* Channel tabs */}
                {supportsEmail && supportsWhatsapp && (
                    <div className="border-b border-[#e4e7ec] px-6">
                        <div className="flex gap-1">
                            <TabBtn label="Email"    active={activeTab === "email"}    onClick={() => setActiveTab("email")} />
                            <TabBtn label="WhatsApp" active={activeTab === "whatsapp"} onClick={() => setActiveTab("whatsapp")} />
                        </div>
                    </div>
                )}

                {/* Body — top half: editor + variables side-by-side (heights
                    equalised by stretching both grid items + a flex-1 on the
                    "fill" element inside each). Middle: full-width alert.
                    Bottom: full-width preview (always visible). */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 flex flex-col gap-4">
                    {/* `items-stretch` (grid default) makes both columns the
                        same height. No `min-h` or nested scrolls — the row's
                        natural height is the taller of the two columns, so
                        chips render fully inside their card and don't leak
                        into the alert below. The textarea uses `flex-1` so
                        it fills whatever height the variables column needs. */}
                    <div className="grid grid-cols-3 gap-6 items-stretch">
                        {/* Editor (left + center) */}
                        <div className="col-span-2 flex flex-col gap-4">
                            {activeTab === "email" && supportsEmail && (
                                <>
                                    <div className="flex flex-col gap-1.5 shrink-0">
                                        <p className="text-[14px] font-medium text-[#344054]">Subject line</p>
                                        <input ref={subjectRef} type="text" value={subject} onChange={e => setSubject(e.target.value)}
                                            placeholder="Subject..."
                                            onDragOver={allowDrop}
                                            onDragEnter={e => { if (e.dataTransfer.types.includes("application/x-onra-variable")) setDragHover("subject"); }}
                                            onDragLeave={() => setDragHover(null)}
                                            onDrop={e => {
                                                if (!e.dataTransfer.types.includes("application/x-onra-variable")) return;
                                                e.preventDefault();
                                                const v = e.dataTransfer.getData("application/x-onra-variable");
                                                dropVariable(v, subject, setSubject, subjectRef.current);
                                                setDragHover(null);
                                            }}
                                            className={cn(
                                                "h-10 w-full px-3 bg-white border-1 rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] transition-colors",
                                                dragHover === "subject" ? "border-[#7ba08c] bg-[#f5fffa]" : "border-[#d0d5dd]",
                                            )} />
                                    </div>
                                    <div className="flex-1 min-h-[200px] flex flex-col gap-1.5">
                                        <p className="text-[14px] font-medium text-[#344054] shrink-0">Email body</p>
                                        <textarea ref={emailBodyRef} value={emailBody} onChange={e => setEmailBody(e.target.value)}
                                            onDragOver={allowDrop}
                                            onDragEnter={e => { if (e.dataTransfer.types.includes("application/x-onra-variable")) setDragHover("email"); }}
                                            onDragLeave={() => setDragHover(null)}
                                            onDrop={e => {
                                                if (!e.dataTransfer.types.includes("application/x-onra-variable")) return;
                                                e.preventDefault();
                                                const v = e.dataTransfer.getData("application/x-onra-variable");
                                                dropVariable(v, emailBody, setEmailBody, emailBodyRef.current);
                                                setDragHover(null);
                                            }}
                                            className={cn(
                                                "flex-1 w-full px-3 py-2 bg-white border-1 rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] font-mono resize-none transition-colors",
                                                dragHover === "email" ? "border-[#7ba08c] bg-[#f5fffa]" : "border-[#d0d5dd]",
                                            )} />
                                    </div>
                                </>
                            )}
                            {activeTab === "whatsapp" && supportsWhatsapp && (
                                <div className="flex-1 min-h-[280px] flex flex-col gap-1.5">
                                    <p className="text-[14px] font-medium text-[#344054] shrink-0">WhatsApp message</p>
                                    <textarea ref={waBodyRef} value={waBody} onChange={e => setWaBody(e.target.value)}
                                        onDragOver={allowDrop}
                                        onDragEnter={e => { if (e.dataTransfer.types.includes("application/x-onra-variable")) setDragHover("whatsapp"); }}
                                        onDragLeave={() => setDragHover(null)}
                                        onDrop={e => {
                                            if (!e.dataTransfer.types.includes("application/x-onra-variable")) return;
                                            e.preventDefault();
                                            const v = e.dataTransfer.getData("application/x-onra-variable");
                                            dropVariable(v, waBody, setWaBody, waBodyRef.current);
                                            setDragHover(null);
                                        }}
                                        className={cn(
                                            "flex-1 w-full px-3 py-2 bg-white border-1 rounded-[8px] text-[14px] text-[#101828] placeholder:text-[#667085] focus:outline-none focus:ring-2 focus:ring-[#aad4bd] font-mono resize-none transition-colors",
                                            dragHover === "whatsapp" ? "border-[#7ba08c] bg-[#f5fffa]" : "border-[#d0d5dd]",
                                        )} />
                                    <p className="text-[13px] text-[#667085] shrink-0">WhatsApp templates are plain text — emojis are allowed but rich formatting isn&apos;t.</p>
                                </div>
                            )}
                        </div>

                        {/* Variables (right rail) — natural height. The chips
                            list flows top-to-bottom; the column's overall
                            height becomes the row's reference height. Each
                            chip is draggable into the editable fields on the
                            left — the `application/x-onra-variable` MIME
                            keeps the drop handlers focused on our chips and
                            not arbitrary text from elsewhere on the page. */}
                        <div className="col-span-1 flex flex-col gap-2">
                            <p className="text-[14px] font-medium text-[#344054] shrink-0">Variables — drag into the field</p>
                            <div className="flex-1 border-1 border-[#e4e7ec] rounded-[12px] p-3 flex flex-col gap-1">
                                {TEMPLATE_VARIABLES.map(v => (
                                    <code
                                        key={v}
                                        draggable
                                        onDragStart={e => {
                                            e.dataTransfer.setData("application/x-onra-variable", v);
                                            e.dataTransfer.setData("text/plain", v); // back-up so non-React drops still get text
                                            e.dataTransfer.effectAllowed = "copy";
                                        }}
                                        onDragEnd={() => setDragHover(null)}
                                        className="font-mono text-[12px] text-[#3538cd] bg-[#f4f3ff] border-1 border-[#d9d6fe] rounded-[6px] px-2 py-1 self-start cursor-grab active:cursor-grabbing select-none hover:bg-[#ebe9fe] transition-colors"
                                    >
                                        {v}
                                    </code>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Full-width info alert — sits under BOTH columns. */}
                    <div className="flex gap-3 items-start bg-[#f1f2ed] border-1 border-[#e4e7ec] rounded-[12px] px-4 py-3">
                        <Lightbulb02 className="w-5 h-5 text-[#475467] shrink-0 mt-[2px]" />
                        <p className="text-[13px] text-[#475467] leading-[18px]">
                            Variables are case-sensitive. Anything that doesn&apos;t match a known variable is left in the message as-is.
                        </p>
                    </div>

                    {/* Full-width preview — always visible (no toggle). */}
                    <div className="border-1 border-[#e4e7ec] rounded-[12px] bg-[#f9fafb] p-4 flex flex-col gap-2">
                        <p className="text-[13px] font-medium text-[#475467]">Preview (with sample data)</p>
                        {activeTab === "email" && supportsEmail && (
                            <>
                                <p className="text-[14px] font-semibold text-[#101828]">{renderPreview(subject)}</p>
                                <p className="text-[14px] text-[#475467] whitespace-pre-wrap">{renderPreview(emailBody)}</p>
                            </>
                        )}
                        {activeTab === "whatsapp" && supportsWhatsapp && (
                            <p className="text-[14px] text-[#475467] whitespace-pre-wrap">{renderPreview(waBody)}</p>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#e4e7ec] px-6 py-4 flex items-center justify-between gap-3">
                    <Button variant="secondary-gray" size="md"
                        leftIcon={<RefreshCcw01 className="w-4 h-4" />}
                        onClick={handleReset}>
                        Reset to default
                    </Button>
                    <div className="flex items-center gap-3">
                        <Button variant="secondary-gray" size="md" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" size="md" leftIcon={<Check className="w-4 h-4" />} onClick={handleSave}>
                            Save template
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick}
            className={cn(
                "h-[44px] px-3 text-[14px] font-semibold transition-colors whitespace-nowrap",
                active ? "border-b-2 border-[#101828] text-[#101828]" : "text-[#667085] hover:text-[#344054]",
            )}>
            {label}
        </button>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<"email" | "whatsapp" | "push", string> = {
    email: "Email",
    whatsapp: "WhatsApp",
    push: "Push",
};

type PendingChannelToggle = {
    eventId: string;
    channel: "email" | "whatsapp" | "push";
    next: boolean;
    label: string;
};

export default function CustomerNotificationsPage() {
    const settings        = useAppStore(s => s.notificationSettings);
    const setEventChannel = useAppStore(s => s.setNotificationEventChannel);
    const showToast       = useAppStore(s => s.showToast);

    const [editing, setEditing] = useState<NotificationSetting | null>(null);
    // Confirm-before-flip — per-channel toggle stages here, the modal
    // commits it. Matches Branches / Rooms / Staff convention.
    const [pendingToggle, setPendingToggle] = useState<PendingChannelToggle | null>(null);
    // Sections default OPEN — toggle to collapse.
    const [openCats, setOpenCats] = useState<Set<NotificationCategory>>(
        () => new Set(CATEGORY_ORDER),
    );
    function toggleCat(cat: NotificationCategory) {
        setOpenCats(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat); else next.add(cat);
            return next;
        });
    }

    function handleChannelToggle(ns: NotificationSetting, channel: "email" | "whatsapp" | "push", next: boolean) {
        setPendingToggle({ eventId: ns.id, channel, next, label: ns.label });
    }

    function handleConfirmChannelToggle() {
        if (!pendingToggle) return;
        const { eventId, channel, next, label } = pendingToggle;
        setEventChannel(eventId, channel, next);
        showToast(
            next
                ? `${CHANNEL_LABEL[channel]} enabled for ${label}`
                : `${CHANNEL_LABEL[channel]} disabled for ${label}`,
            next
                ? `Customers will receive ${channel} notifications for this event.`
                : `Customers will stop receiving ${channel} notifications for this event.`,
            next ? "success" : "error",
            next ? "check" : "slash",
        );
        setPendingToggle(null);
    }

    const grouped = useMemo(() => {
        const out: Record<NotificationCategory, NotificationSetting[]> = {
            booking: [],
            payment: [],
            package_membership: [],
            marketing: [],
            referral: [],
        };
        for (const ns of settings) out[ns.category].push(ns);
        return out;
    }, [settings]);

    if (settings.length === 0) {
        return (
            <div className="relative" style={{ minHeight: 320 }}>
                <EmptyState
                    title="No notifications configured"
                    subtitle="Notifications appear here once they're seeded for your studio."
                />
                <Toast />
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Naked table — no outer border, no rounded corners, no header bg.
                Just the column-header bottom divider + per-section dividers. */}
            <div>
                {/* Column header row — Notifications | Email | WhatsApp | Push */}
                <div className="px-6 py-3 flex items-center gap-6 border-b border-[#e4e7ec]">
                    <p className="flex-1 text-[12px] font-medium text-[#475467] uppercase tracking-wide">Notifications</p>
                    <div className="flex items-center shrink-0">
                        <div className={cn(TOGGLE_COL, "text-center text-[12px] font-medium text-[#475467] uppercase tracking-wide")}>Email</div>
                        <div className={cn(TOGGLE_COL, "text-center text-[12px] font-medium text-[#475467] uppercase tracking-wide")}>WhatsApp</div>
                        <div className={cn(TOGGLE_COL, "text-center text-[12px] font-medium text-[#475467] uppercase tracking-wide")}>Push</div>
                    </div>
                    <div className={cn(EDIT_COL, "shrink-0")} />
                </div>

                {/* Accordion sections — each section has its own divider above
                    so the boundaries between groups read clearly. */}
                {CATEGORY_ORDER.map((cat, i) => (
                    <div key={cat} className={cn(i > 0 && "border-t border-[#e4e7ec]")}>
                        <AccordionSection
                            category={cat}
                            items={grouped[cat]}
                            open={openCats.has(cat)}
                            onToggle={() => toggleCat(cat)}
                            onEdit={ns => setEditing(ns)}
                            onChannelToggle={handleChannelToggle}
                        />
                    </div>
                ))}
            </div>

            {editing && <TemplateEditor ns={editing} onClose={() => setEditing(null)} />}

            {pendingToggle && (
                <ChannelToggleConfirmModal
                    channel={pendingToggle.channel}
                    next={pendingToggle.next}
                    label={pendingToggle.label}
                    onCancel={() => setPendingToggle(null)}
                    onConfirm={handleConfirmChannelToggle}
                />
            )}

            <Toast />
        </div>
    );
}

// ─── Channel toggle confirm modal ───────────────────────────────────────────
//
// Mirrors the shape of ToggleConfirmModal in /admin/settings/page.tsx.
// `next` controls copy + CTA tone — destructive for disable, primary for
// enable.
function ChannelToggleConfirmModal({ channel, next, label, onCancel, onConfirm }: {
    channel: "email" | "whatsapp" | "push";
    next: boolean;
    label: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onCancel();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);

    const isEnable = next;
    const channelLabel = CHANNEL_LABEL[channel];
    const title = isEnable
        ? `Enable ${channelLabel} for ${label}?`
        : `Disable ${channelLabel} for ${label}?`;
    const supporting = isEnable
        ? `Customers will receive ${channel} notifications for this event.`
        : `Customers will stop receiving ${channel} notifications for this event.`;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center">
            <div className="absolute inset-0 bg-[#0c111d]/40" onClick={onCancel} />
            <div className="relative bg-white rounded-[12px] shadow-[0px_20px_24px_-4px_rgba(16,24,40,0.08),0px_8px_8px_-4px_rgba(16,24,40,0.03)] w-[400px] flex flex-col">
                <button
                    type="button"
                    onClick={onCancel}
                    aria-label="Close"
                    className="absolute top-[16px] right-[16px] w-[44px] h-[44px] flex items-center justify-center rounded-[8px] hover:bg-[#f9fafb] transition-colors z-[1]"
                >
                    <XClose className="w-6 h-6 text-[#98a2b3]" />
                </button>
                <div className="pt-6 px-6 flex flex-col items-center gap-4">
                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                        isEnable ? "bg-[#e9fff3]" : "bg-[#fee4e2]",
                    )}>
                        {isEnable
                            ? <Check className="w-6 h-6 text-[#658774]" />
                            : <SlashCircle01 className="w-6 h-6 text-[#d92d20]" />
                        }
                    </div>
                    <div className="flex flex-col gap-1 items-center text-center w-full">
                        <p className="text-[18px] font-semibold text-[#101828] leading-7 w-full">{title}</p>
                        <p className="text-[14px] text-[#475467] leading-5 w-full">{supporting}</p>
                    </div>
                </div>
                <div className="flex gap-3 items-start p-6 pt-6 w-full">
                    <Button variant="secondary-gray" size="lg" className="flex-1" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant={isEnable ? "primary" : "destructive"}
                        size="lg"
                        className="flex-1"
                        onClick={onConfirm}
                    >
                        {isEnable ? "Enable" : "Disable"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
