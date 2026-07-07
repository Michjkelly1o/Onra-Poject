Onra Customer Prototype Update and Walkthrough
Customer modules done: 5
This update covers these modules:
Profile settings

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
This update covers the first part of Profile settings — Promo, Gift card, and Invite friends are still being built.
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Profile settings
The customer's account hub — the Profile tab where a customer manages their details, plan, payments, and preferences.
Capabilities:
- **Profile information** — Update name, photo, date of birth, gender, email, and phone. Changing the photo opens a crop step, and date of birth uses a quick month-and-year picker. Saving confirms with a message.
- **Credit balance & plan** — The credit-balance card shows credits, membership, and expiry; opening it shows My plan with:
  - the membership or class package and its status (Active, Frozen, or Cancelled),
  - Freeze and Unfreeze (set a duration and reason to freeze),
  - Cancel with a reason (access stays until the end date), and
  - Reactivate on a cancelled plan.
- **Integrations** — Connect Google Calendar to sync the class schedule, and disconnect it again at any time.
- **Notification settings** — Turn notifications on or off by channel (email, WhatsApp, SMS, push) and by type (studio announcements, new class launch, special offers, promo codes).
- **Payment settings** — Manage saved cards and wallets, with:
  - Add new card by scanning it or entering the details,
  - Edit or remove a saved card, and
  - Apple Pay and Google Pay to connect or disconnect.
- **Emergency contact** — Add or update an emergency contact's name, phone, and relationship.
- **Timezone** — Pick a display timezone so class times show in the customer's local time.
