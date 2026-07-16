Onra Customer Prototype Update and Walkthrough
Customer modules touched: Login & Sign Up, Home, Search, Products, Class & Appointment Details, Bookings & Profile
This update covers these modules:
Login & Sign Up
Home
Search
Products
Class & Appointment Details
Bookings & Profile
Note:
This update adds passwords to sign up and log in, makes every What's on promotion clickable, brings your device time zone in automatically (so you see both branch time and your time), and fixes back navigation across the app so Back always returns to the right screen. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Login & Sign Up
Create an account or log in with a password, then land where you left off.
Capabilities:
- **Set a password on sign up** — After entering your email, you now create a password before filling in your details, so new accounts are secured from the start.
- **Log in with your password** — Existing accounts enter their password, then confirm with a one-time code.
- **Google & Apple stay one-tap** — Social sign-in skips the password step and fills your profile automatically; you can add a password later from Profile.
- **Create or change your password** — Profile shows "Create password" if you signed in socially, or "Change password" once you have one — both use the same simple screen.
- **Back to where you were** — Browse as a guest, open a class, tap Log in, and after signing in you return straight to that same class — not the home screen.

2 Home
The What's on promotions are now live and clickable.
Capabilities:
- **Active promotions only** — What's on shows only promotions that are currently running; expired or paused ones no longer appear.
- **Smart carousel** — A single active promotion shows on its own with no paging dots; when there's more than one, they rotate automatically.
- **Tap to open a campaign** — Every What's on banner opens its full details, with the exact action set on the admin side — for example "Book now" opens the specific class chosen for that campaign.
- **Image-only banners** — Promotion banners now show the full artwork with no text on top, and are sized so the image never gets cropped on any phone.
- **New Home icon** — The bottom navigation has a cleaner house icon that matches the other tabs.

3 Search
Small touches that make the class filters clearer.
Capabilities:
- **Time-of-day icons** — The Morning, Afternoon and Evening filter options now show a sunrise, sun and sunset icon alongside their times.
- **Your time zone, detected** — Times can be shown in your own time zone; the app detects it from your device automatically.

4 Products
The storefront voucher banners get the same clean treatment.
Capabilities:
- **Image-only voucher banners** — Promotion and voucher banners now show the full artwork only, matching the What's on style, on both the customer and admin sides.

5 Class & Appointment Details
Richer location info and clearer time handling.
Capabilities:
- **Branch location with hours & time zone** — The map card now shows the branch's opening hours and its time zone, the same details as the branch picker.
- **Open in Google Maps** — The expand button on the map opens the exact branch address in Google Maps.
- **Your time vs branch time** — When you're outside the branch's time zone, the details show both the branch time and "Your time" so there's no confusion — for example a class in Abu Dhabi also shows the time in Jakarta.
- **Tidier instructor details** — The instructor page reads as one clean vertical list — introduction, contact, experience and disciplines — matching the class details layout.

6 Bookings & Profile
Reliable back navigation and a few new pages.
Capabilities:
- **Back always returns correctly** — Opening a booking from Upcoming and tapping Back now returns you to the right screen every time — fixing a loop that could trap you on the bookings pages.
- **Personal pages ask you to log in** — Your info, plans, referrals, gift cards and payment methods now prompt a log in first if opened without an account.
- **Privacy policy** — A new Privacy policy page opens from About.

General updates
- **Consistent selection highlight** — Every selected option — filters, pickers, the branch selector, time-of-day and reasons — now uses the same green 2px highlight.
- **Device time zone as default** — The app uses your device's time zone by default, and you can switch it any time from the time-zone sheet, which lists both the branch zone and your local zone.
- **Cleaner back navigation everywhere** — Across the app, the back button returns you to the exact previous screen rather than jumping to a fixed page.
