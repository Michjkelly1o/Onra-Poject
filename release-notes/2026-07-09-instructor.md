Onra Instructor Prototype Update and Walkthrough
Overall modules done 4/5
This update covers these modules:
Notifications

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
New side for instructor: to navigate to instructor please change the link to "https://onra-poject.vercel.app/instructor/dashboard" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Notifications
The instructor's own notification feed — scoped to events that involve their own classes.
Capabilities:
Audience-filtered feed — Each instructor sees only events relevant to their own classes. Admin-only events are filtered out.
Grouped by date — Notifications are grouped Today / Yesterday / Earlier so recent events are easy to find.
Mark as read — Click any notification to open the related record; the unread count updates instantly. Or use "Mark all as read" to clear the badge at once.
Live sync with admin — When admin cancels a class, assigns a substitute, or a customer books or cancels, the notification appears in this feed on the same tick — no refresh needed.
