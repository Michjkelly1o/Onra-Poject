// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `notification_delivery_settings` seed (v27 redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// Single studio-wide record. Drives:
//   • The "Quiet hours 21:00-07:00" info pill on the customer
//     notifications landing (Figma 7745:26872)
//   • The Delivery hours side-panel (Figma 7733:51010 / 7739:171247)
//
// Boot values match the Figma demo state:
//   • Only-send-during-set-hours: ON  (window enforced)
//   • Quiet window: 21:00 → 07:00
//   • Critical bypass: ON (payment failures / confirmations / refunds
//     dispatch regardless of the window)
//
// The window is expressed with 24-hour clock strings. When start > end
// (the seeded 21:00 → 07:00 case) the range wraps midnight — every
// consumer must handle that; the UI's compact "21:00-07:00" summary
// uses the seeded strings verbatim.

import type { NotificationDeliverySettingsSeed } from "./_types";

export const notification_delivery_settings: NotificationDeliverySettingsSeed = {
    id: "notification_delivery_default",
    only_send_during_set_hours:    true,
    quiet_hours_start:             "21:00",
    quiet_hours_end:               "07:00",
    critical_bypasses_quiet_hours: true,
};
