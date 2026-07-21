Onra Prototype Update — Freeze Policy v2
Overall modules done 15/15
This update covers these modules across ALL three sides (admin, customer, instructor):
Settings → Booking rules → Freeze policy
Customer → My plan + booking flow
Admin → Customer detail → Plan tab
Notifications (customer bell + admin bell)

Note:
This push lands the full Freeze Policy v2 workflow — client feedback dated 2026-07-20. Studio owners now control every side of the freeze lifecycle from Settings: what happens to billing during a freeze, who can pause a plan, minimum/maximum duration, per-reason exceptions, and an approval mode where the studio reviews each request. The customer app + admin customer profile have been updated end-to-end to respect every setting. Existing bookings on a frozen plan stay valid; the new guardrails only block NEW activity while a freeze is in effect.
Live updates — Session persistence + cross-tab sync apply as usual. Any freeze / request / approval you fire on one side appears on the other in the same render cycle.
Session persistence — All new fields survive a page refresh + tab close.

1 Settings → Freeze policy (Booking rules)
Full v2 layout landed on the Freeze policy side panel.
Capabilities:
NEW "Billing during a freeze" section — Pick between two options that shift how the next charge works:
  • Pauses — The payment date and renewal date both shift by the freeze length. Members pay full price and skip nothing.
  • Stays on schedule — Members keep their usual payment date; the next charge is reduced by the frozen days.
NEW "Who can freeze" section — Pick between three modes:
  • Members & admins — Members freeze from their account within the limits below. Staff can always freeze from a customer profile.
  • Members request, admins approve — Members submit a freeze request; nothing changes until staff approve it.
  • Admins only — Freezes are applied by staff from the customer profile. Members don't see a freeze option.
Minimum freeze duration — New numeric input sits above the maximum. Defaults to 7 days. Every freeze (member OR admin) is validated against this floor.
Maximum freezes per calendar year — Renamed from the old "per membership" label. Same numeric input; counts reset every January 1st.
Per-reason exceptions — Each freeze reason now expands to reveal three optional bypass flags: No maximum duration / Doesn't count toward the limit / Waive the freeze fee. Medical ships with all three ON out of the box so members with a genuine medical need can freeze longer without eating into their annual count or paying the fee.
Renamed "Allow exceptions" → "Require a reason" — Same behaviour, clearer wording. Old saved settings are migrated silently.

2 Customer → My plan (freeze flow)
Rewrote the freeze bottom sheet to match the new admin controls.
Capabilities:
Date-range picker instead of duration + unit — The sheet now opens two date fields (Start / End). Tap either to pick from a calendar; the range validates against the policy's minimum, maximum, "not in the past" and "end ≥ start" rules on every change. Illegal picks are disabled at the calendar level.
Reason exception bypass — When the picked reason has "No maximum duration" enabled, the cap disappears and the helper line reads "This reason skips the 30-day cap." Members with genuine medical / injury / family reasons can freeze past the standard ceiling without asking.
"Billing during freeze" disclosure — Every valid range shows a preview line before the member confirms:
  • Pauses → "Your next charge shifts from Aug 15 to Sep 5."
  • Stays on schedule → "Your next charge on Aug 15 is reduced to AED 285 (saving AED 15)."
Eligibility gates — The Freeze CTA on the plan card is HIDDEN entirely when any of the following apply:
  • The studio's mode is set to Admins only
  • The customer's first charge hasn't landed yet (first billing cycle)
  • The customer's last membership payment failed
  • The plan is out of scope for the policy
  • The customer has already hit their yearly freeze cap
No dead affordance, no error toast — the member simply doesn't see the button until they're actually eligible.

3 Customer → Request freeze (approval mode)
End-to-end request flow lands when the studio picked "Members request, admins approve."
Capabilities:
CTA reads "Request freeze" — The primary button label swaps automatically based on the studio's mode.
Pending-approval card state — After a member requests a freeze, the plan card shows an amber "Freeze pending approval" pill + a summary of the requested dates. Freeze / Unfreeze buttons disappear (Cancel stays reachable if the member wants to bail on the plan altogether).
Bell notifications — Both the customer and the studio owner receive an in-app notification when the request lands, when it's approved, and when it's declined. If the admin adds a note to a rejection, the note travels back to the member verbatim.

4 Customer → Booking guardrails
Consistent block message across every booking entry point while a plan is frozen.
Capabilities:
Class booking — The Confirm booking / Join waitlist page shows a red banner ("Your Unlimited Monthly is frozen — you can book again on Aug 15.") and disables the CTA.
Appointment booking — Full-page block state with a Manage plan CTA back to /customer/profile/plan.
Waitlist claim — The "A spot is available 🎉" sheet still opens so the member sees the offer, but the Claim button is disabled with the same red banner. Decline stays available so the offer doesn't linger.
Admin walk-in booking — Staff who try to add a frozen customer to a class from the schedule detail get a red toast ("Sarah's Unlimited Monthly is frozen — they can book again on Aug 15."). Same clear message across every path.

5 Admin → Customer detail → Plan tab (approval surface)
New review modal + updated status handling.
Capabilities:
"Freeze requested" status pill — Amber (same convention as pending refund requests). Sorts alongside active plans in the Plan tab so admin doesn't miss them.
NEW Review freeze request modal — Row action menu → "Review freeze request" opens a read-only view of the requested window + reason + Approve / Decline pair. Decline opens a second view with an optional note textarea — anything typed there travels back to the customer's bell.
Approve triggers freeze — Approving hands off to the same freeze action a direct freeze uses, so all downstream propagation (audit, customer bell, admin bell, credit accounting, next-charge date) is identical.

6 Auto-resume + notifications
Freezes end themselves. Both sides find out.
Capabilities:
Auto-resume sweep — Every time the app loads, any plan whose freeze end date has passed flips back to active automatically. No manual unfreeze required.
Freeze reminder — Members receive a bell notification 3 days before their freeze ends ("Your Unlimited Monthly resumes on Aug 15."). Configurable in Settings → Customer notifications like every other event.
Freeze started / reactivated bell — Studio staff see a bell row every time a member self-freezes their plan and every time a freeze auto-resumes, so they know without checking every customer profile.

General updates
Persistence bump — Anything you tested with older cached state will reset on first load; no manual DevTools cleanup required. New fields default to safe values.
No admin regressions — Every existing freeze demo (Sarah's plan, other seeded members, admin-initiated freezes) still works end-to-end. The booking / attendance / payroll flows on already-frozen plans are unchanged.
Instructor side untouched — Freezes don't touch instructor state, so there's no new instructor UI in this push. Existing instructor surfaces render identically.
Small polish — Removed the "Recommended" badges from the freeze policy option cards (client ask).

Demo path per side
Owner / Branch Admin — Settings → Booking rules → Freeze policy shows every new section. Change Who can freeze between the three modes and open the customer app in a second tab to watch the plan page update live.
Operator / Front Desk — Customer detail → Plan tab → Freeze / Unfreeze / Review freeze request all reachable. Admin walk-in booking on /schedule/[classId] now blocks frozen customers with a clear toast.
Instructor — No new UI (verified — zero instructor touchpoints in this feature).
Customer (Members & admins mode) — /customer/profile/plan → Freeze → pick a date range, see the billing disclosure line, confirm. Plan card shows Frozen state; bookings blocked across the app.
Customer (Members request, admins approve mode) — Same entry point, button reads "Request freeze". After submit, plan card shows amber pending pill. Admin approves from customer detail → plan flips to Frozen.
Customer (Admins only mode) — Freeze CTA hidden entirely. Nothing to click.
