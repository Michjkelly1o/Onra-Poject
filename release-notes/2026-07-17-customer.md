Onra Customer Prototype Update and Walkthrough
Customer modules touched: Login & Sign Up, Home, Search, Class Booking, Bookings, Products & Checkout, Profile
This update covers these modules:
Login & Sign Up
Home
Search
Class Booking
Bookings
Products & Checkout
Profile
Note:
This update focuses on class booking — book for yourself and bring one guest along, choose each person's spot separately, and cover a guest with your own class credits. Waivers now appear only for under-18s, cancelling a class is a one-tap confirmation, the time-zone prompt shows only once, and the bottom navigation stays fixed on every screen. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Login & Sign Up
Browse freely, then log in only when you need your own data — and land back where you were.
Capabilities:
- **Log in only when needed** — Opening your info, plans, referrals, gift cards or payment methods without an account now prompts a log in first.
- **Back to where you were** — After logging in from a class, checkout or a personal page, you return to that exact screen — not the home page.

2 Home
A tidier Trending and Recommended feed on the home screen.
Capabilities:
- **Instructor on every trending card** — Trending today cards now show the instructor's photo next to their name, so you know who's teaching at a glance.
- **Right-sized cards** — Trending and Recommended cards use a consistent, smaller image, so more fit on screen and nothing gets cropped.
- **Refined Home icon** — The bottom-navigation house icon is redrawn to match the size and weight of the other tabs.

3 Search
A cleaner time filter and a time-zone prompt that stays out of your way.
Capabilities:
- **Time-of-day cards** — Morning, Afternoon and Evening now sit side by side as three cards, each with its own illustration on top — a sunrise, a sun and a sunset — and its time range underneath; the selected one highlights in green.
- **Time zone asked once** — When you're outside the branch's time zone, the time-zone sheet appears only the first time you open Search; opening a class and going back won't ask again.

4 Class Booking
Book a spot for yourself and, if you like, bring one guest along — with a separate spot for each person.
Capabilities:
- **Bring a guest along** — You're always booked; you can add one guest to join you. Your own account shows first, with no toggle to tick.
- **Pick each person's spot** — For classes with a spot map (for example Reformer Pilates), choose a spot for yourself and a different spot for your guest — nothing is paired automatically, and each spot is changeable on its own.
- **Cover a guest with your credits** — At the guest step you can pay the guest's place with your own class credits; booking the two of you then uses two credits — one per person. Other options let the guest pay a drop-in, use their own package, or receive an invite link to book themselves.
- **Waiver only for under-18** — Adults never see a waiver. A member or guest under 18 signs a one-time guardian consent on their first booking and is never asked again.

5 Bookings
Clearer class cards and a quicker way to cancel.
Capabilities:
- **Booked status at a glance** — A booked class card shows a "Booked" (or "Waitlisted") pill next to the instructor, alongside its capacity — so you see both your status and how full the class is.
- **Cancel in one step** — Cancelling a class or appointment now opens a simple confirmation from the bottom of the screen, with an on-time note when a credit or amount is refunded — no separate page.
- **Back returns correctly** — After cancelling, Back takes you to the right screen instead of looping between the booking pages.

6 Products & Checkout
A layout fix so the storefront sits correctly on the phone.
Capabilities:
- **Storefront fits the screen** — The products page now fills the phone cleanly, with the bottom navigation always in place.

7 Profile
Simpler referrals and a cleaner Profile menu.
Capabilities:
- **Referrals are class-credit only** — Referrals show the class credits you've earned and your total referrals with a progress bar; the studio rewards referrals with class credits, so the separate account-credit figure is gone.
- **Time zone lives in the picker** — The standalone Timezone page is removed from Profile; you switch time zone from the time-zone sheet wherever times appear.
- **Clearer menu labels** — Profile menu items use a slightly larger, easier-to-read label.

General updates
- **Bottom navigation stays put** — The bottom tab bar is now fixed to the screen, so it never scrolls away on any page on mobile.
- **Your device time zone by default** — Times default to your device's time zone; the time-zone sheet lists both the branch zone and your local zone if you want to switch.
- **Consistent selection highlight** — Selected options across filters, pickers and reasons use the same green highlight.
