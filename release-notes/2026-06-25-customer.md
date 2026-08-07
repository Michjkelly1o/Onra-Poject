Onra Customer Prototype Update and Walkthrough
Customer modules done: 3
This update covers these modules:
Home
Search & Class Booking
Bookings

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
This walkthrough follows an existing member who already holds an active plan — so buying a new plan and the appointments flow are not part of it yet (the products and checkout screens are already built, and the appointments screens are built and waiting on the studio's appointment data).
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Home
The member's home screen — their branch, a snapshot of their own activity, and quick ways into classes and instructors.
Capabilities:
- **Branch & notifications** — The header has a studio chip (location pin + branch name) on the left and a notification bell with an unread count on the right. Tapping the chip opens a Select Branch screen; choosing a branch switches the whole app — classes, instructors, and schedules — to that studio, and sticks across screens and refreshes.
- **Activity snapshot** — A personalised block at the top of Home:
  - Achievement highlight — a featured card (e.g. "16 in June — Most classes in a month") for the member's best month.
  - Quick stats — Total classes, Classes this month, Classes remaining on the plan, and a day-streak, all from the member's own history.
- **Next class** — The member's next booked class shows as a card that opens its booking details (the full list lives in Bookings).
- **What's on** — Up to three active studio promotions show in a carousel.
- **Instructors** — A row of the branch's instructors; tapping one opens their full profile (photo, bio, rating, and reviews) and a day-by-day class schedule that opens straight into booking.
- **Categories** — A 2-column grid of class categories below the instructors; tapping one opens Search → Classes already filtered to that category.

2 Search & Class Booking
Browse the class schedule by day, open a class, and complete a booking — or join the waitlist when a class is full.
Capabilities:
- **Two tabs** — Search opens on Classes (group sessions); an Appointments tab sits alongside (see the Note above).
- **Browse by day** —
  - Week strip — a draggable row of day chips (today selected, past days greyed out), capped at the studio's booking window; picking a day shows that day's classes for the active branch.
  - Month picker — a month/year wheel; Apply jumps the strip to the chosen month.
  - Timezone — a timezone picker shows all class times in the chosen city's time, without changing the schedule itself.
- **Filters** — A full-screen filter for Time (a start/end range), Instructor (multi-select, with a searchable "See all" screen when the list is long), and Category. The filters combine sensibly and stay applied as the member moves around Search, with a count badge on the filter button.
- **Class list** — Class cards show the cover, name, "with [instructor]", an availability badge (N spots left / waitlist / Full / Booked), room + branch, and time + duration, with a button that matches its status (Book now / Join waitlist / view only).
- **Class details** — A full screen with the cover, name, date and time, and availability; the description with See more; a quick-facts grid (duration, capacity, instructor — tappable to their profile, class type); equipment; arrival guidance; cancellation policy with a Show policy link; and the location with full address. A sticky button at the bottom matches the class's status.
- **Book a class** — A Review & Book screen with:
  - the class summary and location,
  - seat selection on a labelled seat map (with a Booked / Available / Selected key) where the class uses it, otherwise an "a spot will be auto-assigned" line,
  - the option to add a guest (name + email, and how they pay — drop-in, their own package, or an invite link), and
  - the plan and credits being used, showing "N credits left after this booking".
- **Waiver for first-timers** — First-time bookers read and agree to the waiver (the button stays off until they scroll to the end and tick the box); returning members skip it.
- **Booking confirmation** — A short progress sequence (Checking availability → Reserving your spot → Confirming your booking), then a confirmation screen; View bookings opens the new booking's details.
- **Join the waitlist** — When a class is full, the member joins the waitlist through the same screen (no seat selection, and no credit taken until a spot opens), ending on a "You're on the waitlist!" screen.

3 Bookings
The member's bookings — view details, cancel, leave a waitlist, and rate past classes.
Capabilities:
- **Upcoming & past** — Two tabs list the member's bookings with their status (Booked / Waitlisted #N / Attended / No-show / Cancelled), with the same filters as Search.
- **Booking details** — Tapping a booking opens its full details, showing its current status and only the actions that make sense for it.
- **Cancel a booking** — Cancelling early returns the class credit at no charge; a late cancellation forfeits the class, per the studio's policy. A clear summary and confirmation message explain the outcome.
- **Leave a waitlist** — A waitlisted member can leave the waitlist and free up their spot.
- **Rate a class** — After a class, the member leaves a star rating and comment, which show in the class's reviews.

General updates
- **Back keeps your place** — Going back returns the member to exactly where they were, at the same scroll position, not the top of the page.
