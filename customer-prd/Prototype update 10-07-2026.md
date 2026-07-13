Onra Customer Prototype Update and Walkthrough
Customer modules touched: Home, Search, Bookings, Profile / My plan
This update covers these areas:
Home discover rails, Class booking waiver (signature + minor consent), Class capacity display, Booking refund details, My plan states

Note:
This update adds a signature + guardian-consent step to the class booking waiver, fills the guest Home with two new discover rails, and refines class capacity, booking refund details, and My plan state labels based on today's review. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Home — Discover rails
Filled the guest Home so it never reads empty below "What's on".
Capabilities:
- **Trending today** — A horizontally scrollable rail of the branch's top upcoming classes, pulled from the real class schedule (deduped by class, ranked by rating then bookings). Tapping a card opens that class's detail screen.
- **Recommended services** — A matching rail of the branch's bookable services (the same appointment/service data as Search). Tapping a card opens the Search module on its Appointments tab.
- **Shown for everyone** — Both rails appear for guests and signed-in customers, directly below the "What's on" carousel, and hide automatically when the branch has no classes or services.
- **Live data** — The rails read from existing class and service data, so they stay in sync with admin changes and the selected branch — no separate sample content.

2 Class booking — Waiver with signature & guardian consent
The class booking waiver now captures a real signature and handles minors.
Capabilities:
- **Sign here** — The waiver adds a signature pad the customer signs with finger, stylus, or mouse, with a "Clear" option. "Agree & continue" stays disabled until the waiver is signed and the terms are acknowledged.
- **Under-18 consent** — A "The attendee is under 18 years old" toggle (auto-selected when the account's date of birth indicates a minor) reveals a parent / guardian consent block: guardian full name and relationship to the minor.
- **Guardian signature** — For a minor, the signature becomes the parent / guardian's signature and the acknowledgment reworks to guardian-consent wording; the guardian's name and relationship are required before continuing.
- **Waiver text** — The waiver adds a "Parent / Guardian consent (under 18)" clause alongside the existing Assumption of Risk, Health, Release of Liability, and Cancellation Policy sections.

3 Search — Class capacity display
Class availability now reads as a capacity count.
Capabilities:
- **Booked / total** — Class cards and the class detail now show capacity as "8 / 10" (booked out of total) instead of "spots left", filling up as people book.
- **State badges** — An available class shows its "booked / total" count in green; a full-but-waitlisted class shows "N waitlist"; a full class shows "FULL".

4 Bookings — Refund details
Small consistency fixes on the cancelled-booking detail.
Capabilities:
- **Divider** — The Refund-details section now has a divider above it, so it separates from the Location section like every other section on the page.
- **Refund via** — For a cancelled appointment, "Refund via" shows the actual payment method used at checkout (e.g. Apple pay, a saved card, or gift card), captured when the appointment was booked.

5 Profile / My plan — Plan states
My plan now labels every plan state correctly.
Capabilities:
- **Expired plans** — An expired (or removed) plan is now shown as "Expired" / "Removed" in a muted state, no longer mislabeled as "Active" — so only the genuinely active plan reads as active.
- **One active plan** — Combined with the "one membership OR one-or-more packages" rule, My plan shows a single active plan with older plans kept as history.

6 Checkout — Payment methods
- **Sourced from settings** — The checkout payment list is built from the Payment settings (accepted methods) plus the customer's connected wallets and saved cards, and the selected method drives the "Pay with …" label and the appointment refund method.
