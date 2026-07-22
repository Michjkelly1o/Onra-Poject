Onra Customer Prototype Update and Walkthrough
Customer modules touched: Home, Search, Products, Profile
This update covers these modules:
Home
Search
Products
Profile
Note:
This update focuses on the class booking experience — clearer credit information, a reworked guest step, a Detail payment summary, spot selection that now matches the studio's own room layout exactly, and a full waitlist flow that moves people into the class automatically (or asks them to claim the spot) the moment one opens up. Alongside that: every existing customer now has a password, referral rewards are class credits only, free credits appear in your plan, filters show how many results they return, and navigation is fixed so Back and Close always return to the right screen. In the prototype, you may still see a 404 on a page — that means the page/module/feature is still being developed. To navigate to the customer side use "https://onra-poject.vercel.app/customer"; for the admin side use "https://onra-poject.vercel.app/admin/dashboard".
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Home
A tidier studio picker on the home screen.
Capabilities:
- **Compact branch list** — Each branch now reads as one tight block: name, "Open • today's hours", and the address on a single line, with the studio mark sitting top-right.
- **Shorter branch sheet** — The picker opens at about half the screen instead of nearly full height. Only the branch list scrolls, and it now shows a scroll bar so it's obvious there are more branches below.
- **Time zone badge per branch** — Every branch still carries its own time-zone badge and a Details link that opens the exact address in Google Maps.

2 Search
The class booking experience, end to end — credits, guests, spots and the waitlist.
Capabilities:
- **Clearer credit information** — The class screen now leads with what the class costs ("1 credit") and shows your remaining balance underneath, instead of the other way round.
- **Detail payment summary** — Booking confirmation gains a Detail payment section listing the class, how many credits it uses, and the total — so two people booked on your credits reads clearly as 2 credits.
- **Guest step** — You're always booked yourself, and can bring one guest along. Your own account shows first with no toggle to tick, and the guest can pay a drop-in, use their own package, receive an invite link, or be covered by your class credits.
- **Spot layout matches the studio exactly** — The spots you see are the studio's real room layout: same rows, same columns, same number of spots. If the studio set up 8 spots, you see all 8 — a class with fewer places never hides any of them.
- **Only free spots are selectable** — Spots the studio has blocked, or that another customer already booked, appear in the layout but can't be picked. Everything else is open.
- **A spot each** — When you bring a guest, you choose a spot for yourself and a separate one for them; nothing is paired automatically and each can be changed on its own.
- **Clearer spot banner** — When a class assigns spots for you, the note now says exactly what will happen: "A spot will be auto assigned to you" when booking, or "A spot will be assigned automatically when you're moved off the waitlist" when joining a waitlist.
- **Waitlist joins skip spot picking** — Joining a waitlist no longer asks you to choose a spot, because the free one isn't known yet. One is assigned automatically the moment you're moved into the class.
- **Nothing charged until you're in** — The waitlist confirmation shows the same Detail payment summary with a note that your credit is only used once a spot opens and you're moved to booked.
- **Moved off the waitlist automatically** — When someone cancels, the studio's rules decide what happens: either the first person on the list is booked straight in and told "You're booked!", or they're sent "A spot is available" and asked to claim it.
- **Claim or decline a spot** — Tapping that notification opens the class with a simple choice: Claim spot, which books you in, or Decline spot, which passes it to the next person. Letting the offer lapse passes it on too.
- **Filter shows its result count** — The filter's button now reads "Show 12 results" and updates live as you change your selection, so you can see the effect before applying. A running total also sits above the list whenever a filter is active.
- **Time zone that follows your choice** — Class times and appointment slots now re-render in whichever zone you pick — the branch's or your own. The sheet appears once when you're outside the branch's zone, and again only if you switch to a branch in a different zone.

3 Products
A clearer storefront icon and a fixed route out of checkout.
Capabilities:
- **New Products icon** — The bottom navigation uses a cleaner shopping-bag icon for Products.
- **Back after buying goes to Profile** — Buying a plan and tapping "View plan" used to drop you back into the checkout screens when you pressed Back. It now returns you to your Profile, where the plan lives.
- **Account credit only when it applies** — The checkout's "Redeem credit" row only appears when you actually hold account credit and the studio's referral programme pays it out. With class-credit rewards it's hidden entirely instead of showing AED 0.

4 Profile
Passwords, address details, free credits and a clearer plan history.
Capabilities:
- **Every customer has a password** — All existing accounts now have one, so you can sign in with a password or with Google. Signing in with Google no longer removes the password from the account.
- **"Change password"** — Because every existing account has a password, Profile information now reads "Change password" rather than "Create password".
- **City in address details** — City and Postal code now appear independently, following exactly the same address rules the studio's own customer form uses, so the two sides never disagree about an address.
- **Free credit on the balance card** — The credit balance card now shows any complimentary credits the studio granted you under a "Free credit" heading, replacing the old expiry line, and it reports the same figure the studio sees.
- **Free credits in My plan** — Complimentary credits now appear in My plan as their own card, using the same layout as memberships and packages. They carry no Cancel or Freeze actions, since they're a gift rather than a subscription.
- **Referral rewards are class credits** — Referrals reward class credits only, and the number you see matches the studio's records exactly.
- **Upcoming bookings are genuinely upcoming** — Bookings now use the real current date, so a class that has already happened can no longer sit under Upcoming.
- **Booked or waitlisted at a glance** — A booked class card shows a "Booked" or "Waitlisted" pill next to the instructor, alongside how full the class is.

General updates
- **Sticky bottom navigation** — The bottom tab bar stays fixed to the screen and never scrolls away, on every page.
- **Sticky notification tabs** — All / Bookings / Payments now stay pinned to the header while the notification list scrolls, matching the Bookings tabs.
- **Push notifications appear as toasts** — With push notifications switched on in Profile, every new notification also appears briefly on screen instead of waiting silently behind the bell. Switch it off and only the bell updates.
- **Back returns to the right screen** — Across the app, Back leaves a finished flow properly: after a purchase it returns to Profile, after cancelling it returns to Past bookings, and it never reopens a screen for a booking that no longer exists.
- **Closing a screen returns you where you came from** — Closing a booking flow abandons it cleanly and returns to Search; closing a confirmation returns to the screen behind it.
- **One consistent set of times** — Whichever time zone you choose is used everywhere times appear — search, class details, appointment slots and booking confirmations.
