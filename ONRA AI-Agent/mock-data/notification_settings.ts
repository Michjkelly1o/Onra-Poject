// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `notification_settings` seed (PRD 11 §12 — v27 redesign)
// ─────────────────────────────────────────────────────────────────────────────
//
// One row per customer-facing notification event. Drives the per-event
// channel toggles, template editor, timing config, and approval-status
// pill on Settings → Customer notifications (Figma 7745:26872).
//
// v27 delta vs v26:
//   • push_enabled → sms_enabled (Push dropped; SMS added for real
//     UAE gyms that use it as a fallback when WhatsApp / email are
//     patchy).
//   • +sms_template (matching per-channel body pattern).
//   • +whatsapp_approval_status ("approved" | "pending" | "rejected").
//     Realistic distribution seeded — Class reminder pending (Meta
//     re-review after last edit), Special offers rejected (Meta
//     regularly bounces promotional templates), everything else
//     approved.
//   • +is_critical — true for every payment row so the UI blocks
//     disabling the LAST enabled channel + fires the "at least one
//     channel stays on" toast.
//   • +send_mode ("immediately" | "scheduled") + send_offsets[]:
//        - Class reminder     → scheduled 24h + 2h before class start
//        - No-show alert      → scheduled 30m after class start
//        - Package expiring…  → scheduled by name (7d / 24h)
//        - Membership renewal → scheduled 7d before renewal
//        - Rest               → immediately
//   • +sent_during_campaigns = true on every marketing row (renders
//     the "Sent during campaigns" pill in place of the send-time
//     summary on the landing).

import type { NotificationSettingSeed } from "./_types";

// ─── Cross-module join: marketing topics ↔ customer marketing prefs ─────
//
// The 4 marketing category rows below have `notification_type` values
// that must match the 4 `marketing_topic_*` fields on `customers` one-
// for-one. That join is the WHOLE contract between:
//
//   admin Customer notifications module   (this file — what CAN be sent)
//                     ↕
//   customer Details tab / customer-side prefs  (per-customer opt-in)
//                     ↕
//   dispatch layer (future)             (deliver only when both agree)
//
// The map is exported so any future consumer (marketing campaign
// dispatch, customer-side prefs page, analytics) can iterate the pairs
// without re-typing the keys. Renaming either side without updating
// this map breaks the marketing counter, the customer-side prefs page,
// and every future dispatch check.
export const MARKETING_TOPIC_TO_NS_ID = {
    marketing_topic_studio_announcements: "ns_studio_announcements",
    marketing_topic_new_class_launch:     "ns_new_class_launch",
    marketing_topic_special_offers:       "ns_special_offers",
    marketing_topic_promo_code_offers:    "ns_promo_code_offers",
} as const;
export type MarketingTopicKey = keyof typeof MARKETING_TOPIC_TO_NS_ID;

export const notification_settings: NotificationSettingSeed[] = [
    // ── Booking notifications (6) ──────────────────────────────────────────
    {
        id: "ns_booking_confirmation",
        category: "booking",
        notification_type: "booking_confirmation",
        label: "Booking confirmation",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Your booking for {class_name} is confirmed",
        email_template: "Hi {member_name},\n\nYour spot in {class_name} on {class_date} at {class_time} with {instructor_name} is confirmed. We'll send a reminder closer to the time.\n\nSee you at {branch_name}!\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! ✅ Your booking for {class_name} on {class_date} at {class_time} is confirmed. See you at {branch_name}!",
        sms_template: "{studio_name}: You're booked into {class_name} on {class_date} at {class_time}. See you there!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_class_reminder_24h",
        category: "booking",
        notification_type: "class_reminder",
        label: "Class reminder",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Reminder: {class_name} tomorrow at {class_time}",
        email_template: "Hi {member_name},\n\nA quick reminder that {class_name} is tomorrow at {class_time} with {instructor_name} at {branch_name}.\n\nNeed to cancel? Open the app any time before the cutoff.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! Reminder: {class_name} at {class_time} with {instructor_name} at {branch_name}. See you there! 🧘",
        sms_template: "{studio_name}: Reminder — {class_name} at {class_time}. See you at {branch_name}!",
        whatsapp_approval_status: "pending",
        is_critical: false,
        send_mode: "scheduled",
        send_offsets: [
            { value: 24, unit: "hours" },
            { value: 2,  unit: "hours" },
        ],
    },
    {
        id: "ns_no_show_alert",
        category: "booking",
        notification_type: "no_show_alert",
        label: "No-show alert",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "We missed you at {class_name}",
        email_template: "Hi {member_name},\n\nWe noticed you missed {class_name} on {class_date}. Per our policy, the credit has been forfeited. If you think this was a mistake, just reply to this email.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}, we missed you at {class_name} on {class_date}. Per our policy the credit has been forfeited.",
        sms_template: "{studio_name}: We missed you at {class_name}. Credit forfeited per policy.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "scheduled",
        send_offsets: [{ value: 30, unit: "minutes" }],
    },
    {
        id: "ns_waitlist_promotion",
        category: "booking",
        notification_type: "waitlist_promotion",
        label: "Waitlist promotion",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "You're in! {class_name} on {class_date}",
        email_template: "Good news {member_name}! A spot opened in {class_name} on {class_date} at {class_time} and we've moved you off the waitlist.\n\nSee you at {branch_name}!\n— {studio_name}",
        whatsapp_template: "🎉 You're in {member_name}! A spot opened in {class_name} on {class_date} at {class_time}. See you at {branch_name}!",
        sms_template: "{studio_name}: You're in! Spot opened in {class_name} on {class_date} at {class_time}.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_cancellation_confirm",
        category: "booking",
        notification_type: "cancellation_confirm",
        label: "Cancellation confirm",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Your booking for {class_name} was cancelled",
        email_template: "Hi {member_name},\n\nWe've cancelled your booking for {class_name} on {class_date} at {class_time}. If this was a mistake, you can rebook any time.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}, your booking for {class_name} on {class_date} has been cancelled. You can rebook any time.",
        sms_template: "{studio_name}: Cancelled — {class_name} on {class_date}. Rebook any time.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_class_updates",
        category: "booking",
        notification_type: "class_updates",
        label: "Class updates",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Update for {class_name} on {class_date}",
        email_template: "Hi {member_name},\n\nA quick heads-up about {class_name} on {class_date}: there's been a change. Open the app for the latest details. We're sorry for any disruption!\n— {studio_name}",
        whatsapp_template: "Hi {member_name}, {class_name} on {class_date} has been updated. Check the app for the latest details.",
        sms_template: "{studio_name}: {class_name} on {class_date} was updated. Check the app for details.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },

    // ── Payment notifications (4 — every row critical) ─────────────────────
    {
        id: "ns_payment_confirmation",
        category: "payment",
        notification_type: "payment_confirmation",
        label: "Payment confirmation",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Payment received — {studio_name}",
        email_template: "Hi {member_name},\n\nWe've received your payment for booking {booking_id}. Receipt to follow.\n\nThanks for choosing {studio_name}!",
        whatsapp_template: "Hi {member_name}! ✅ Payment received for booking {booking_id}. Receipt on its way.",
        sms_template: "{studio_name}: Payment received for booking {booking_id}.",
        whatsapp_approval_status: "approved",
        is_critical: true,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_payment_failed",
        category: "payment",
        notification_type: "payment_failed",
        label: "Payment failed",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Action needed — payment failed",
        email_template: "Hi {member_name},\n\nWe couldn't process your last payment. Please update your payment method in Account → Billing.\n— {studio_name}",
        whatsapp_template: "Hi {member_name} — your last payment failed. Please update your card in the app to keep your bookings active.",
        sms_template: "{studio_name}: Payment failed. Update your card in the app to keep bookings active.",
        whatsapp_approval_status: "approved",
        is_critical: true,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_refund_processed",
        category: "payment",
        notification_type: "refund_processed",
        label: "Refund processed",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Refund processed for booking {booking_id}",
        email_template: "Hi {member_name},\n\nWe've processed your refund for booking {booking_id}. Funds typically take 3–5 business days to appear, depending on your bank.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}, your refund for booking {booking_id} has been processed — 3–5 business days to land.",
        sms_template: "{studio_name}: Refund processed for booking {booking_id}. 3-5 business days to your account.",
        whatsapp_approval_status: "approved",
        is_critical: true,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_receipt",
        category: "payment",
        notification_type: "receipt",
        label: "Receipt",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Your {studio_name} receipt — booking {booking_id}",
        email_template: "Hi {member_name},\n\nHere's your receipt for booking {booking_id}.\n\nThanks for choosing {studio_name}!",
        whatsapp_template: "Hi {member_name}, your receipt for booking {booking_id} is in your email inbox.",
        sms_template: "{studio_name}: Receipt for booking {booking_id} is in your email inbox.",
        whatsapp_approval_status: "approved",
        is_critical: true,
        send_mode: "immediately",
        send_offsets: [],
    },
    // ── Gift card purchase (Jul 2026 client request) ──────────────────
    // Unlike every other payment row above, this notification is
    // dispatched to the RECIPIENT of the gift card (the person being
    // gifted the card), NOT the buyer. The recipient needs the
    // redemption code to spend the balance, so the template embeds
    // `{gift_card_code}` alongside the sender's name + amount. Set
    // `recipient_source: "gift_card_recipient"` so the future dispatch
    // layer resolves `to_email` / `to_phone` from
    // IssuedGiftCard.recipient_email / recipient_phone rather than
    // customers[buyer_id]. Marked critical — the recipient can't
    // redeem without the code.
    {
        id: "ns_gift_card_purchase",
        category: "payment",
        notification_type: "gift_card_purchase",
        label: "Gift card purchase",
        recipient_source: "gift_card_recipient",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "{sender_name} sent you a {studio_name} gift card",
        email_template: "Hi {recipient_name},\n\n{sender_name} has sent you a {studio_name} gift card worth AED {gift_card_amount}.\n\nRedeem it at checkout with this code:\n\n{gift_card_code}\n\n\"{gift_message}\"\n\nEnjoy!\n— {studio_name}",
        whatsapp_template: "Hi {recipient_name}! 🎁 {sender_name} sent you a {studio_name} gift card worth AED {gift_card_amount}. Redeem with code: {gift_card_code}",
        sms_template: "{studio_name}: {sender_name} sent you a gift card (AED {gift_card_amount}). Redeem with code {gift_card_code}.",
        whatsapp_approval_status: "approved",
        is_critical: true,
        send_mode: "immediately",
        send_offsets: [],
    },

    // ── Package & membership (7) ───────────────────────────────────────────
    {
        id: "ns_package_purchase",
        category: "package_membership",
        notification_type: "package_purchase",
        label: "Package purchase",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Thanks for your purchase, {member_name}",
        email_template: "Hi {member_name},\n\nThanks for your purchase! {package_name} is now active on your account, with {credits_remaining} credits valid until {expiry_date}.\n\nReceipt below. See you in class!\n— {studio_name}",
        whatsapp_template: "🎉 {package_name} is now active on your account, {member_name}! {credits_remaining} credits valid until {expiry_date}.",
        sms_template: "{studio_name}: {package_name} is now active — {credits_remaining} credits valid until {expiry_date}.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_package_expiring_7d",
        category: "package_membership",
        notification_type: "package_expiring_7d",
        label: "Package expiring (7d)",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "{credits_remaining} credits expiring on {expiry_date}",
        email_template: "Hi {member_name},\n\nA friendly heads-up: {credits_remaining} of your credits expire on {expiry_date}. Book a class soon so they don't go to waste!\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! Heads-up — {credits_remaining} credits expire on {expiry_date}. Book a class soon! 💚",
        sms_template: "{studio_name}: {credits_remaining} credits expire on {expiry_date}. Book a class soon!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "scheduled",
        send_offsets: [{ value: 7, unit: "days" }],
    },
    {
        id: "ns_package_expiring_24h",
        category: "package_membership",
        notification_type: "package_expiring_24h",
        label: "Package expiring (24h)",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Last day — {credits_remaining} credits expire today",
        email_template: "Hi {member_name},\n\nFinal reminder: {credits_remaining} credits expire today ({expiry_date}). Book a class before midnight to keep them!\n— {studio_name}",
        whatsapp_template: "⏰ Final reminder {member_name}! {credits_remaining} credits expire today. Book before midnight!",
        sms_template: "{studio_name}: Final reminder — {credits_remaining} credits expire today. Book before midnight!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "scheduled",
        send_offsets: [{ value: 24, unit: "hours" }],
    },
    {
        id: "ns_package_expired",
        category: "package_membership",
        notification_type: "package_expired",
        label: "Package expired",
        email_enabled: true,
        whatsapp_enabled: false,
        sms_enabled: false,
        email_subject: "Your {package_name} has expired",
        email_template: "Hi {member_name},\n\n{package_name} expired on {expiry_date}. We're sorry to see those credits go unused — chat with the front desk if you'd like to discuss options.\n— {studio_name}",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_package_frozen",
        category: "package_membership",
        notification_type: "package_frozen",
        label: "Package frozen",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Your {package_name} has been frozen",
        email_template: "Hi {member_name},\n\nYour {package_name} is now frozen. We'll resume it on {expiry_date}. Enjoy your break — we'll see you soon!\n— {studio_name}",
        whatsapp_template: "Hi {member_name}, your {package_name} is now frozen until {expiry_date}. Enjoy your break! ❄️",
        sms_template: "{studio_name}: {package_name} is frozen until {expiry_date}. Enjoy your break!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_package_unfrozen",
        category: "package_membership",
        notification_type: "package_unfrozen",
        label: "Package unfrozen",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Welcome back — your {package_name} is active again",
        email_template: "Hi {member_name},\n\nYour {package_name} is active again. {credits_remaining} credits are ready to book. Welcome back!\n— {studio_name}",
        whatsapp_template: "Welcome back {member_name}! Your {package_name} is active — {credits_remaining} credits ready to book. 🎯",
        sms_template: "{studio_name}: Welcome back — {package_name} is active again. {credits_remaining} credits ready.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_membership_renewal",
        category: "package_membership",
        notification_type: "membership_renewal",
        label: "Membership renewal",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: true,
        email_subject: "Your {package_name} renews on {expiry_date}",
        email_template: "Hi {member_name},\n\nThis is a heads-up that your {package_name} membership renews on {expiry_date}. The card on file will be charged automatically.\n\nNeed to change anything? Open Account → Membership in the app.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! Your {package_name} renews on {expiry_date}. Need to update payment or pause? Open the app.",
        sms_template: "{studio_name}: {package_name} renews {expiry_date}. Update payment in the app if needed.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "scheduled",
        send_offsets: [{ value: 7, unit: "days" }],
    },

    // ── Marketing & promotions (4 — sent_during_campaigns=true) ────────────
    {
        id: "ns_studio_announcements",
        category: "marketing",
        notification_type: "studio_announcements",
        label: "Studio announcements",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "A note from {studio_name}",
        email_template: "Hi {member_name},\n\nWe have an update from {studio_name} — read on for the details.\n\n— The {studio_name} team",
        whatsapp_template: "Hi {member_name}! A quick update from {studio_name} — check your email for the full note. 💛",
        sms_template: "{studio_name}: A quick update — check your email for the full note.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
        sent_during_campaigns: true,
    },
    {
        id: "ns_new_class_launch",
        category: "marketing",
        notification_type: "new_class_launch",
        label: "New class launch",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "New class — {class_name}",
        email_template: "Hi {member_name},\n\nWe're excited to announce {class_name} at {branch_name}! Book in early — spots tend to fill fast.\n— {studio_name}",
        whatsapp_template: "✨ New class alert: {class_name} at {branch_name}! Book early — spots tend to fill fast. — {studio_name}",
        sms_template: "{studio_name}: New class — {class_name} at {branch_name}. Book early!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
        sent_during_campaigns: true,
    },
    {
        id: "ns_special_offers",
        category: "marketing",
        notification_type: "special_offers",
        label: "Special offers",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Special offer — just for you",
        email_template: "Hi {member_name},\n\nWe've got a special offer with your name on it. Open the app for details and grab it before it's gone!\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! 🎁 We've got a special offer for you. Open the app to grab it before it's gone.",
        sms_template: "{studio_name}: Special offer for you. Open the app to grab it before it's gone.",
        // Meta commonly rejects promotional templates — realistic demo state.
        whatsapp_approval_status: "rejected",
        whatsapp_rejection_reason: "Promotional content — template exceeds Meta's marketing template guidelines. Reword the message to be transactional or resubmit under the Marketing category.",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
        sent_during_campaigns: true,
    },
    {
        id: "ns_promo_code_offers",
        category: "marketing",
        notification_type: "promo_code_offers",
        label: "Promo code offers",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Your promo code from {studio_name}",
        email_template: "Hi {member_name},\n\nUse code in the app at checkout for a special discount. Valid until {expiry_date}.\n— {studio_name}",
        whatsapp_template: "Hi {member_name}! 💸 Use the promo code we just emailed you at checkout. Valid until {expiry_date}.",
        sms_template: "{studio_name}: Promo code emailed to you. Valid until {expiry_date}.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
        sent_during_campaigns: true,
    },

    // ── Referral notifications (3) ─────────────────────────────────────────
    {
        id: "ns_referral_link_sent",
        category: "referral",
        notification_type: "referral_link_sent",
        label: "Referral link sent",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Share the love — your referral link is ready",
        email_template: "Hi {member_name},\n\nThanks for sharing! Your unique referral link is ready in the app. When a friend signs up and completes their first booking, you'll both get a reward.\n— {studio_name}",
        whatsapp_template: "Thanks for sharing {member_name}! Your referral link is in the app. Both you and your friend get a reward on their first booking. 🤝",
        sms_template: "{studio_name}: Your referral link is ready in the app. Share it!",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_friend_signed_up",
        category: "referral",
        notification_type: "friend_signed_up",
        label: "Friend signed up",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "Your friend signed up with your referral!",
        email_template: "Hi {member_name},\n\nGreat news — a friend just signed up using your referral! When they complete their first booking, your reward will land on your account.\n— {studio_name}",
        whatsapp_template: "🎉 {member_name}, your friend just signed up using your referral! Reward incoming once they book.",
        sms_template: "{studio_name}: A friend just signed up using your referral! Reward incoming when they book.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
    {
        id: "ns_reward_earned",
        category: "referral",
        notification_type: "reward_earned",
        label: "Reward earned",
        email_enabled: true,
        whatsapp_enabled: true,
        sms_enabled: false,
        email_subject: "You earned a reward 🎁",
        email_template: "Hi {member_name},\n\nYour referral reward has landed! Open Account → Wallet to see what you earned.\n— {studio_name}",
        whatsapp_template: "🎁 {member_name}! Your referral reward just landed. Check Account → Wallet in the app to see it.",
        sms_template: "{studio_name}: Your referral reward just landed! Check Account -> Wallet in the app.",
        whatsapp_approval_status: "approved",
        is_critical: false,
        send_mode: "immediately",
        send_offsets: [],
    },
];
