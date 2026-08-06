Onra Customer Prototype Update and Walkthrough
Customer modules done: 6
This update covers these modules:
Authentication & Guest mode, Home, Search, Products, Bookings, Profile / My plan

Note:
This update pushes the customer front door (Authentication + Guest mode) plus a broad round of refinements across Home, Search, Products, Bookings, and My plan based on this week's review. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Authentication & Guest mode
The app's front door — it now boots into Guest mode and only asks the customer to sign in when an action needs their account.
Capabilities:
- **Splash & onboarding** — First launch shows the Forma splash, then a 3-slide onboarding carousel ending in "Get started", which drops the customer into the app as a guest.
- **Guest mode** — A guest can browse Home, Search, Products, class/appointment details, and instructor profiles freely. There is no Bookings tab, no personal metrics, and every action that needs an account (book, join waitlist, buy, save) shows a "Log in to …" prompt.
- **Log in or sign up** — Enter an email: an existing account goes to OTP; a new email goes to the sign-up form. Any 4-digit OTP verifies (simulated). Social buttons are simulated.
- **Sign up** — First/last name, date of birth, gender, phone, optional referral code (validated live against real codes), and Privacy/Terms — then an Emergency-contact step and into a first-time Home.
- **Session** — Log in / log out from Profile; the signed-in customer's data appears across every screen, and logging out returns to Guest mode.

2 Home
Refined the landing so it leads with the customer and their key numbers.
Capabilities:
- **Welcome header** — "Welcome back, [First name]!" sits above the quick stats, matching the section-header style and spacing.
- **Quick stats + next booking** — Total classes, streak, classes this month, and classes remaining, followed by the next upcoming booking and the "What's on" carousel. (Achievement highlight, Instructor, and Categories rows were removed from Home.)
- **Studio switcher** — The branch chip now opens a **bottom sheet** (search a branch, tap to set it as your main branch) instead of a separate page.
- **Notification bell** — One consistent bell + brand-green unread badge across Home and Search (hidden for guests).

3 Search
Faster class/appointment discovery.
Capabilities:
- **Always opens on Classes** — Search (and Home's "Book class") always lands on the Classes tab first.
- **Time-of-day filter** — The time picker is now three quick pills — Morning, Afternoon, Evening — reusing the same pill style as Categories.
- **Whole-card tap** — Tapping anywhere on a class or appointment card opens its detail / booking flow, not just the action button.
- **Appointment CTA** — Guests see "Log in to book" on appointment cards; the class detail shows "Log in to book / join".

4 Products
Reworked the catalog and product detail to be clearer and consistent.
Capabilities:
- **Credit tiles** — Every product (membership, credit package, gift card) shows a brand-green tile with its credit count / value ("10 / credits", "∞ / credits", value for gift cards).
- **Product Details is now a full page** — A 200px brand banner with the credit/value and a product-type badge (Membership / Credit package / Gift card), the description, and a per-type info list (credits amount · applicable branches · validity) read from the admin product data. A consistent bottom bar with a quantity stepper + Add to cart is used on every product type (memberships and gift cards stay at quantity 1).
- **One plan type at a time** — A customer holds one membership OR one-or-more credit packages, never both. Adding a membership hides the "+" on all packages, and vice-versa; re-buying a cancelled membership routes to the reactivate flow.
- **Receipt actions** — After a purchase, "View plan" opens My plan and "View gift card" opens the Gift card page.

5 Bookings
Cancellation is clearer and works for appointments too.
Capabilities:
- **Cancel any booking** — Cancel classes and appointments (private or open) up to the start time. Cancelling within 24 hours is a late cancellation with the appropriate penalty — classes forfeit the credit, appointments forfeit the amount in currency.
- **Refund details** — A cancelled class or appointment now shows a Refund-details section: whether a credit or money was returned (or not) and, for currency refunds, the "Refund via" method.
- **Banners** — Class, appointment, and instructor detail banners now use a responsive 4:3 image ratio.

6 Profile / My plan
The plan hub reflects the customer's real state.
Capabilities:
- **Credit-balance card** — Shows the active plan's type ("Membership" or "Credit package"), credits left with a progress bar, total credits, and the expiry date. With no active plan it shows "Browse plan", and tapping the card opens My plan.
- **My plan** — Shows the full plan history. The active plan's tile matches the Products credit tile; frozen and cancelled plans are shown in a muted (disabled) state.
- **Reactivate rules** — Only the most recently purchased plan can be reactivated, and only when it's a cancelled membership with no other active plan; older plans stay as history-only records. Credit packages never reactivate.
- **Gift cards** — A set of demo gift-card codes can be redeemed (WELCOME50, FORMA100, SPA200, GIFT2026, GIFT2027, FORMA500) and used as a payment method.

7 Navigation
- **Icon-only tab bar** — The bottom navigation now shows icons only (no labels), the Search tab uses a Calendar icon, and the bar is a comfortable height.
- **Adaptive background** — The tab bar is transparent when a page fits on screen and shows its white background only once the page scrolls.
