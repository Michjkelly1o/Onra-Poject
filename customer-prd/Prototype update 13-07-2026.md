Onra Customer Prototype Update and Walkthrough
Customer modules touched: Bookings, Profile, Search, Home, Navigation
This update covers these areas:
Bookings moved into Profile, Booking date filter, Simpler cancellation, Profile address details, Profile menu & payment tidy-up, Branch selector, Navigation & display polish

Note:
This update moves Bookings under Profile, adds a date filter and a one-step cancellation to Bookings, and introduces a country-aware address section on the profile, plus a round of navigation and display polish based on this week's review. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Bookings — Now under Profile
Bookings is now part of the Profile area instead of a standalone tab.
Capabilities:
- **New Profile menu item** — "Bookings" sits at the top of the Profile settings list (above Integrations), so account activity lives in one place.
- **Back to Profile** — Bookings now has a back button that returns to the Profile page, and the bottom navigation is hidden here — it behaves like the other Profile sub-pages.

2 Bookings — Filter by date
The Bookings filter can now narrow the list to a date range.
Capabilities:
- **Date range** — Add a From / To date to show only bookings within that range; it applies to whichever tab you're on (Upcoming or Past) and to both classes and appointments.
- **Calendar picker** — Tapping From or To opens the same branded calendar used for date of birth, with the two dates kept in order so the range can't invert.

3 Bookings — Simpler cancellation
Cancelling a booking is now a single step.
Capabilities:
- **One-step cancel** — The cancellation review page cancels directly when you tap "Cancel booking" / "Cancel appointment" — the extra confirmation pop-up has been removed.

4 Profile — Address details
The profile now captures a full address that adapts to the selected country.
Capabilities:
- **New fields** — After the phone number: Country, Emirate / State / Region, City, Postal code, and Street address.
- **Country-aware label** — The state field renames itself to match the country — Emirate for the UAE, State for the US, Province for Canada, Region elsewhere.
- **UAE simplified** — For the UAE, the City and Postal code fields are hidden, matching how UAE addresses work.
- **Country & region pickers** — The Country field opens a searchable list with flags; countries with a known list (UAE, US, Canada, Saudi Arabia) offer their emirates / states / regions to pick, others accept free text.
- **Matches the admin side** — The country list, labels, and rules are the same ones the studio's admin uses, so a customer's address reads consistently on both sides.

5 Profile — Menu & payment tidy-up
Small clarity fixes across the Profile menu and payments.
Capabilities:
- **Clearer menu names** — "Notification settings" is now "Notifications" and "Payment settings" is now "Payment methods".
- **Removing a card** — After removing a saved card you land straight on the updated card list, and Back goes to Profile — no more passing through a "card no longer available" screen.
- **Consistent title** — The saved-cards page is titled "Payment methods" to match its menu item.

6 Branch selector — Consistent sheet
The branch picker now opens at a consistent size.
Capabilities:
- **Fixed height** — The Select-branch sheet keeps the same height whether one or many branches are listed, showing the header above it with a small gap, so it no longer grows and shrinks with the list.

General updates
- **Bottom bar always visible** — The main bottom navigation always shows its white background, so it reads clearly on every screen, not only after scrolling.
- **Home rails for guests** — The "Trending today" and "Recommended services" rails now show for guests only; signed-in customers keep their personal overview and next booking at the top instead.
- **Class time always shown** — Class cards keep their start time and duration even when a class is Closed.
