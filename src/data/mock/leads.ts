// ─────────────────────────────────────────────────────────────────────────────
// Onra Studio — `leads` seed
// ─────────────────────────────────────────────────────────────────────────────
//
// 20 leads seeded so Lead Data + Lead Conversion + Acquisition Efficiency
// reports render with realistic funnel data.
//
// Distribution intentional:
//   • 5 by source (Instagram / Referral / Walk-in / Website / Google · 4 each)
//   • Stage funnel: 6 new · 4 contacted · 4 trial-booked · 4 trial-attended ·
//                   2 paid. So Lead Conversion % surfaces the two "trial"
//                   and "paid" rates non-trivially.
//   • Engagement mix: 5 cold · 6 warm · 5 hot · 2 converted · 2 lost
//   • Assigned across 3 staff members so the "assigned to" dim has variety
//   • 2 branches (South + East) so location filter works
//
// FKs match existing seeds — cross-check `staff_profiles.ts` + `branches.ts`.

import type { Lead } from "./_types";

export const leads: Lead[] = [
    // ── New (funnel top) ───────────────────────────────────────────────────
    { id: "lead_001", added_at: "2026-06-01T09:15:00Z", contact_name: "Priya Sharma", contact_email: "priya.sharma@example.com", phone: "+971 55 111 0001", gender: "Female", source: "Instagram", stage: "new", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "cold", branch_id: "branch_forma_south" },
    { id: "lead_002", added_at: "2026-06-03T14:20:00Z", contact_name: "Marcus Chen",  contact_email: "marcus.chen@example.com",  phone: "+971 55 111 0002", gender: "Male",   source: "Google",    stage: "new", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "cold", branch_id: "branch_forma_east" },
    { id: "lead_003", added_at: "2026-06-05T11:00:00Z", contact_name: "Layla Hassan", contact_email: "layla.hassan@example.com", phone: "+971 55 111 0003", gender: "Female", source: "Website",   stage: "new", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "warm", branch_id: "branch_forma_south" },
    { id: "lead_004", added_at: "2026-06-07T16:45:00Z", contact_name: "Rafael Silva", contact_email: "rafael.silva@example.com", phone: "+971 55 111 0004", gender: "Male",   source: "Walk-in",   stage: "new", engagement_status: "warm",                                                          branch_id: "branch_forma_east" },
    { id: "lead_005", added_at: "2026-06-10T10:30:00Z", contact_name: "Nadia Aziz",   contact_email: "nadia.aziz@example.com",   phone: "+971 55 111 0005", gender: "Female", source: "Referral",  stage: "new", assigned_to_staff_id: "staff_lucy_hale",      engagement_status: "cold", branch_id: "branch_forma_south" },
    { id: "lead_006", added_at: "2026-06-11T12:00:00Z", contact_name: "Jonas Berger", contact_email: "jonas.berger@example.com", phone: "+971 55 111 0006", gender: "Male",   source: "WhatsApp",  stage: "new", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "cold", branch_id: "branch_forma_south" },
    // ── Contacted ──────────────────────────────────────────────────────────
    { id: "lead_007", added_at: "2026-05-25T09:00:00Z", contact_name: "Sara Ibrahim", contact_email: "sara.ibrahim@example.com", phone: "+971 55 111 0007", gender: "Female", source: "Instagram", stage: "contacted", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "warm", first_contact_at: "2026-05-27T10:00:00Z", branch_id: "branch_forma_south" },
    { id: "lead_008", added_at: "2026-05-26T15:30:00Z", contact_name: "Michael Ross", contact_email: "michael.ross@example.com", phone: "+971 55 111 0008", gender: "Male",   source: "Google",    stage: "contacted", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "hot",  first_contact_at: "2026-05-28T11:00:00Z", branch_id: "branch_forma_east" },
    { id: "lead_009", added_at: "2026-05-28T13:00:00Z", contact_name: "Zara Malik",   contact_email: "zara.malik@example.com",   phone: "+971 55 111 0009", gender: "Female", source: "Referral",  stage: "contacted", assigned_to_staff_id: "staff_lucy_hale",      engagement_status: "warm", first_contact_at: "2026-05-30T12:30:00Z", branch_id: "branch_forma_south" },
    { id: "lead_010", added_at: "2026-05-30T14:20:00Z", contact_name: "Adrian Wolf",  contact_email: "adrian.wolf@example.com",  phone: "+971 55 111 0010", gender: "Male",   source: "Website",   stage: "contacted", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "warm", first_contact_at: "2026-06-01T09:00:00Z", branch_id: "branch_forma_east" },
    // ── Trial booked ───────────────────────────────────────────────────────
    { id: "lead_011", added_at: "2026-05-20T10:00:00Z", contact_name: "Emma Watson",  contact_email: "emma.watson@example.com",  phone: "+971 55 111 0011", gender: "Female", source: "Instagram", stage: "trial-booked", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "hot",  first_contact_at: "2026-05-21T10:00:00Z", first_purchase_name: "3-Class Trial", first_purchase_at: "2026-06-01T09:00:00Z", first_purchase_amount_aed: 450, branch_id: "branch_forma_south" },
    { id: "lead_012", added_at: "2026-05-22T11:30:00Z", contact_name: "David Park",   contact_email: "david.park@example.com",   phone: "+971 55 111 0012", gender: "Male",   source: "Google",    stage: "trial-booked", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "hot",  first_contact_at: "2026-05-23T14:00:00Z", first_purchase_name: "1-Class Intro", first_purchase_at: "2026-05-30T18:00:00Z", first_purchase_amount_aed: 170, branch_id: "branch_forma_east" },
    { id: "lead_013", added_at: "2026-05-24T16:00:00Z", contact_name: "Farah Nasir",  contact_email: "farah.nasir@example.com",  phone: "+971 55 111 0013", gender: "Female", source: "Walk-in",   stage: "trial-booked", assigned_to_staff_id: "staff_lucy_hale",      engagement_status: "warm", first_contact_at: "2026-05-24T16:00:00Z", first_purchase_name: "3-Class Trial", first_purchase_at: "2026-06-02T10:00:00Z", first_purchase_amount_aed: 450, branch_id: "branch_forma_south" },
    { id: "lead_014", added_at: "2026-05-27T12:00:00Z", contact_name: "Karim Fadel",  contact_email: "karim.fadel@example.com",  phone: "+971 55 111 0014", gender: "Male",   source: "Referral",  stage: "trial-booked", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "hot",  first_contact_at: "2026-05-28T09:30:00Z", first_purchase_name: "1-Class Intro", first_purchase_at: "2026-06-05T19:00:00Z", first_purchase_amount_aed: 170, branch_id: "branch_forma_east" },
    // ── Trial attended ─────────────────────────────────────────────────────
    { id: "lead_015", added_at: "2026-05-15T09:00:00Z", contact_name: "Ines Costa",   contact_email: "ines.costa@example.com",   phone: "+971 55 111 0015", gender: "Female", source: "Instagram", stage: "trial-attended", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "hot",  first_contact_at: "2026-05-16T10:00:00Z", first_purchase_name: "3-Class Trial", first_purchase_at: "2026-05-25T09:00:00Z", first_purchase_amount_aed: 450, branch_id: "branch_forma_south" },
    { id: "lead_016", added_at: "2026-05-18T14:00:00Z", contact_name: "Omar Youssef", contact_email: "omar.youssef@example.com", phone: "+971 55 111 0016", gender: "Male",   source: "Website",   stage: "trial-attended", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "hot",  first_contact_at: "2026-05-19T11:30:00Z", first_purchase_name: "1-Class Intro", first_purchase_at: "2026-05-27T18:00:00Z", first_purchase_amount_aed: 170, branch_id: "branch_forma_east" },
    // ── Paid (converted) ───────────────────────────────────────────────────
    { id: "lead_017", added_at: "2026-04-20T09:00:00Z", contact_name: "Ahmed Zayn",   contact_email: "ahmed.zayn@example.com",   phone: "+971 55 111 0017", gender: "Male",   source: "Instagram", stage: "paid", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "converted", first_contact_at: "2026-04-21T10:00:00Z", first_purchase_name: "Unlimited Monthly Membership", first_purchase_at: "2026-05-05T10:00:00Z", first_purchase_amount_aed: 2800, branch_id: "branch_forma_south" },
    { id: "lead_018", added_at: "2026-04-25T15:00:00Z", contact_name: "Fatima Al-Sayed", contact_email: "fatima.al-sayed@example.com", phone: "+971 55 111 0018", gender: "Female", source: "Referral", stage: "paid", assigned_to_staff_id: "staff_maya_johnson",   engagement_status: "converted", first_contact_at: "2026-04-26T12:00:00Z", first_purchase_name: "Beginner Monthly Membership", first_purchase_at: "2026-05-10T14:00:00Z", first_purchase_amount_aed: 1200, branch_id: "branch_forma_south" },
    // ── Lost ───────────────────────────────────────────────────────────────
    { id: "lead_019", added_at: "2026-04-15T11:00:00Z", contact_name: "Ben Turner",   contact_email: "ben.turner@example.com",   phone: "+971 55 111 0019", gender: "Male",   source: "Google",    stage: "lost", assigned_to_staff_id: "staff_lucy_hale",      engagement_status: "lost", first_contact_at: "2026-04-17T13:00:00Z", branch_id: "branch_forma_east" },
    { id: "lead_020", added_at: "2026-04-10T10:00:00Z", contact_name: "Aisha Al-Rashid", contact_email: "aisha.alrashid@example.com", phone: "+971 55 111 0020", gender: "Female", source: "Walk-in", stage: "lost", assigned_to_staff_id: "staff_sara_al_rashid", engagement_status: "lost", first_contact_at: "2026-04-10T10:00:00Z", branch_id: "branch_forma_south" },
];
