Onra Customer Prototype Update and Walkthrough
Customer modules touched: Search, Products, Profile
This update covers these modules:
Search
Products
Profile
Note:
This update is a big pass on the Profile area — Bookings now lives under Profile as separate Upcoming and Past pages, plus new Payment history, Wallet and About pages — alongside cleaner class and appointment details, smarter filters, and receipts you can share or download. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Search
Browse classes and appointments and open their details.
Capabilities:
- **Clearer availability** — Class cards show how full a class is at a glance: a people icon with a count (e.g. 8/10), an hourglass for waitlist, and Full when there's no space. The same badge shows on the class banner.
- **Tidier class & appointment details** — The detail page now reads as one clean list — date & time, duration, spots (e.g. 2/8 spots), type and instructor — instead of a busy two-column grid.
- **Appointment type filter** — The Appointments tab can filter by Private or Recovery, one at a time.
- **One date field for ranges** — The date filter is a single field; open the calendar and pick a single day or drag out a range.
- **Sign the waiver once** — The booking waiver is a one-time agreement; you only sign again if your age crosses the 18 mark, which switches guardian consent on or off.
- **Live time slots** — Appointment time slots start empty (0 of the total booked) and fill as people book.

2 Products
The storefront and checkout, including the payment receipt.
Capabilities:
- **Itemized receipt** — After paying, the receipt lists each item you bought alongside the order and payment details.
- **Share your receipt** — Share a receipt through the same options used elsewhere in the app (Messages, WhatsApp, Email, Copy link).
- **Download as image** — Save any receipt to your device as a PNG.
- **One clear action** — The finished receipt keeps a single main button — View plan or Continue booking — next to the Share and Download shortcuts.

3 Profile
Your account hub — plans, bookings, payments, wallet, and settings.
Capabilities:
- **Bookings live here now** — Bookings moved into Profile as two dedicated pages, Upcoming and Past, each grouped by month; the profile Bookings card links straight to either.
- **Payment history** — A full history of your payments grouped by month; tap any one to open its receipt, which you can share or download.
- **Wallet** — A new Wallet page shows your account-credit balance on a branded card (tap the eye to hide it), with a running list of credits and spends.
- **My plan, grouped** — Your plans are split into an Active plan section on top and an Expired plan section below.
- **About** — A new About page shows the app version, your device details, and a privacy-policy link.
- **Cleaner menu** — Wallet, Payment history and other menu icons match the design; a new About row sits above Logout; the profile photo and section labels are tidied.

General updates
- **Clear all** — Every filter's reset button now reads "Clear all".
- **Grouped by month** — Bookings and payments are grouped under month headings, so long lists are easy to scan.
- **Cleaner inner pages** — The soft background pattern now shows only on the main tabs (Home, Search, Products, Profile); detail and settings pages sit on a clean, plain background.
