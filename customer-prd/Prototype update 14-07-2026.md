Onra Customer Prototype Update and Walkthrough
Customer modules touched: Classes, Booking, Plans, Class & Appointment details, Timezone, Waiver, Profile
This update covers these areas:
Class capacity display, Purchase product in booking, Out-of-credit & expired plans, Date & time with your timezone, Timezone picker, Waiver guardian consent, Profile payments & referrals

Note:
This update tidies the booking-and-plans flow — buying a plan mid-booking now uses the same full product page as the store, out-of-credit and expired plans behave like a fresh customer, and class and appointment times now show in your own timezone as well as the studio's. It also adds an automatic guardian-consent waiver for under-18s. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Classes — Capacity at a glance
Class cards now show how full a class is, not just how many spots are left.
Capabilities:
- **Booked out of total** — A class shows its spots as "8/10" (booked out of total capacity) instead of "8 spots left".
- **Clear status** — Each card reads the right state: open for booking, join waitlist when full, or full.

2 Booking — Purchase product
When a class needs a plan you don't have, buying one now uses the same full product page as the store.
Capabilities:
- **Same product page** — Tapping a plan in "Select plan" opens the full-page product details — the same screen used in the store — instead of a small pop-up sheet.
- **Only relevant plans** — The plan list shows only the memberships and packages available for that class's studio.
- **Pay now works end-to-end** — Paying for the plan shows the payment-successful receipt, then a "Continue booking" button that takes you straight back to confirm the class with your new plan.
- **No progress bar** — The purchase step inside booking drops the step-progress bar, since it's a quick side task, not a stage of the booking.

3 Plans — Out-of-credit & expired plans
A plan with no credits left or past its expiry now behaves exactly like having no plan at all.
Capabilities:
- **Buy any plan again** — When your plan is used up or expired, you can buy any plan type again — membership or credit package — just like a customer with no active plan.
- **Credit balance clears** — The credit balance card on your profile switches to the "No active plan" view with a Browse plan action once credits run out.
- **History only, no actions** — A used-up or expired plan moves to your plan history and no longer offers Cancel or Freeze.
- **Membership-only actions** — Cancel and Freeze now appear on memberships only; credit packages no longer show those options.

4 Class & appointment details — Date & time
Class and appointment detail pages now present the date and time in a clearer, consistent place.
Capabilities:
- **Date & time cell** — The banner image drops the date-and-time line; instead there's a dedicated "Date & time" row in the details below.
- **Your timezone too** — The time shows in the studio's local time and, when it differs from your location, in your own time as well — so a class abroad reads correctly.
- **Time kept for closed classes** — Closed classes still show their start time and duration.
- **Matching icons** — Duration now uses a fast-forward clock icon, and both cards share the same rounded badge style.

5 Timezone — Your time vs branch time
The timezone picker makes it obvious which zone is yours and which is the studio's.
Capabilities:
- **Auto-detect your zone** — On first visit the app detects your device's timezone automatically, so times are right without setup.
- **Clear badges** — Your detected city carries a "Your time" badge; the studio's city carries a "Branch time" badge, sitting right beside the city name.
- **More regions** — Added Indonesian timezones (Bali / Denpasar and Jayapura) to the picker.

6 Waiver — Guardian consent for minors
Under-18 customers now get the correct guardian-consent waiver automatically.
Capabilities:
- **Age-driven** — When the customer's date of birth makes them under 18, a parent / guardian consent section appears on the waiver on its own — no checkbox to tick.
- **Guardian signs** — The signature pad captures the parent or guardian's signature, with their name and relationship to the minor.
- **Relationship picker** — Relationship to the minor opens the same bottom-sheet picker used elsewhere (like gender), rather than a plain dropdown.
- **Re-sign when age changes** — If a birth date is edited so an adult becomes under 18, a fresh guardian waiver is required before booking.

7 Profile — Payments & referrals
A few tidy-ups across Profile payments, referrals, and menu.
Capabilities:
- **Apple / Google Pay at checkout** — Removed the Apple Pay / Google Pay section from Payment methods settings; both remain available as options at checkout.
- **Referral reflects the studio** — The referral rewards and how they're earned now read from the studio's own referral settings, so the customer sees the real program.
- **Promotion removed** — Removed the Promotion item from the Profile menu.

General updates
- **Consistent selected colour** — Selected checkboxes, radio buttons, and highlighted badges now share the same soft brand-green background, so selections read the same everywhere.
