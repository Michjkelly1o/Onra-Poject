Onra Customer Prototype Update and Walkthrough
Customer modules done: 3
This update covers these modules:
Search & Class Booking
Bookings

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
This update is a round of fixes — no new screens, just smoother behaviour across Search and Bookings.
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Search & Class Booking
Browse the class schedule by day, open a class, and book — this update smooths out the day picker, filters, and availability.
Fixes:
- **Selected day stays put** — Fixed the chosen day sometimes jumping back to today after opening a class and coming back.
- **Filters hold across tabs** — Fixed filters occasionally clearing themselves when switching between Classes and Appointments.
- **Correct class times** — Fixed class times briefly showing in the wrong city's time right after changing the timezone.
- **Accurate availability** — Fixed a full class sometimes showing "Book now" instead of "Join waitlist".
- **Seat map accuracy** — Fixed a rare case where a taken spot looked open on the seat map.

2 Bookings
Your upcoming and past bookings — this update fixes how statuses, credits, and the waitlist refresh.
Fixes:
- **One place per booking** — Fixed a booking briefly appearing under both Upcoming and Past.
- **Credits refresh on cancel** — Fixed the class-credit count not updating right after an early cancellation.
- **Waitlist updates** — Fixed your waitlist position not refreshing after leaving a waitlist.
- **Ratings appear right away** — Fixed a submitted rating not showing immediately in the class's reviews.
- **Correct status after class** — Fixed an attended class briefly showing as "Booked" once it had finished.

General updates
- **Back keeps your place** — Fixed the occasional jump to the top when going back; you return to the exact spot you left.
- **Smoother first load** — Fixed a brief flicker when class and booking lists first appear.
