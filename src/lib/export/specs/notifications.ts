// ─────────────────────────────────────────────────────────────────────────────
// Export spec — Notification settings  (Phase 2)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per notification event: id, category, notification_type, the three
// channel switches (+ templates), the WhatsApp approval state, send timing, the
// payment `is_critical` flag, and the optional per-branch scope (`branch_id`).
// `send_offsets` is JSON-encoded (structured array).

import type { NotificationSetting } from "@/lib/store";
import type { ExportColumn, ExportData } from "@/lib/export/export-data";

export function notificationSettingsExportData(rows: NotificationSetting[], branchName: (id: string) => string): ExportData<NotificationSetting> {
    const columns: ExportColumn<NotificationSetting>[] = [
        { key: "id", value: n => n.id },
        { key: "category", value: n => n.category },
        { key: "notification_type", value: n => n.notificationType },
        { key: "label", value: n => n.label },
        { key: "branch_id", value: n => n.branchId ?? "" },
        { key: "branch_name", value: n => (n.branchId ? branchName(n.branchId) : "") },
        { key: "email_enabled", value: n => (n.emailEnabled ? "true" : "false") },
        { key: "whatsapp_enabled", value: n => (n.whatsappEnabled ? "true" : "false") },
        { key: "sms_enabled", value: n => (n.smsEnabled ? "true" : "false") },
        { key: "whatsapp_approval_status", value: n => n.whatsappApprovalStatus },
        { key: "whatsapp_rejection_reason", value: n => n.whatsappRejectionReason ?? "" },
        { key: "is_critical", value: n => (n.isCritical ? "true" : "false") },
        { key: "send_mode", value: n => n.sendMode },
        { key: "send_offsets", value: n => JSON.stringify(n.sendOffsets) },
        { key: "sent_during_campaigns", value: n => (n.sentDuringCampaigns === undefined ? "" : n.sentDuringCampaigns ? "true" : "false") },
        { key: "recipient_source", value: n => n.recipientSource ?? "" },
        { key: "email_subject", value: n => n.emailSubject ?? "" },
        { key: "email_template", value: n => n.emailTemplate ?? "" },
        { key: "whatsapp_template", value: n => n.whatsappTemplate ?? "" },
        { key: "sms_template", value: n => n.smsTemplate ?? "" },
    ];
    return { entity: "notification-settings", columns, rows };
}
