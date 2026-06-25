Onra Instructor Prototype Update and Walkthrough
Overall modules done 2/5
This update covers these modules:
Dashboard
Schedule

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
New side for instructor: to navigate to instructor please change the link to "https://onra-poject.vercel.app/instructor/dashboard" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Dashboard
Every KPI card on the dashboard now opens a detailed modal, and upcoming class cards surface booking status at a glance — matching the customer side.
Capabilities:
Clickable KPI cards — Each metric on the dashboard now opens a modal with the full list behind the number:
   • Classes — every class the instructor is teaching in the selected period.
   • Attendance rate — per-class breakdown showing attended vs. no-show counts for each of the instructor's classes.
   • Clients taught — every customer the instructor has taught at least once.
Sortable attendance table — Inside the Attendance rate modal, every column can now be sorted (class name, attendance rate, attended, no-show).
Cancellations "View details" link — Each cancellation row now opens the class schedule where the customer originally booked, so the instructor can see the full context of the cancelled booking in one click.
Status badge on upcoming classes — Upcoming class cards now show a status badge (Booked / Waitlisted with position number), matching the customer-side card style. The instructor sees their participation status at a glance.

2 Schedule
The schedule now stays entirely inside the instructor side. Class cards and detail pages no longer jump to the admin view.
Capabilities:
Everything stays on instructor side — Class cards, class detail pages, and all follow-up links stay within the instructor experience. Previously, clicking a class card from the instructor dashboard or schedule would jump to the admin class detail; now it opens the instructor's own class detail page on every status (Upcoming, Ongoing, Completed, Cancelled).

General updates
Global search removed on instructor side — The instructor side no longer shows the global search button. It's an admin-only tool now.
Back returns where you came from — Every detail page on the instructor side remembers where you opened it from. Closing it returns you to the previous page, not always the module list.
