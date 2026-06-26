Onra Instructor Prototype Update and Walkthrough
Overall modules done 3/5
This update covers these modules:
Earnings

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
New side for instructor: to navigate to instructor please change the link to "https://onra-poject.vercel.app/instructor/dashboard" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Earnings
The Earnings module is now fully developed, with a class detail page for every class status.
Capabilities:
Earnings list — A full list of every class you've taught, with the earnings amount per class. Filter by date range, status, or class type.
Class detail on every status — Click any class card to open its full-screen detail page. The detail adapts to the class status:
   • Upcoming / Ongoing — opens the live class detail with the roster and attendance marking.
   • Completed — opens the completed class detail with attendance, ratings, and your earnings for that session.
   • Cancelled — opens the cancelled class detail with the cancellation context.

General updates
Customer self-bookings show up on your roster instantly — When customers book a class on their side, the new booking appears immediately on your class detail roster and your dashboard upcoming card — and a "New booking" notification arrives. No refresh needed.
