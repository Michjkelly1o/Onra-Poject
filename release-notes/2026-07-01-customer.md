Onra Customer Prototype Update and Walkthrough
Customer modules done: 4
This update covers these modules:
Products

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
This update is a round of fixes — no new screens, just smoother behaviour across the Products storefront and checkout.
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Products
The customer storefront — browse memberships, class packages, and gift cards, then check out and pay. This update tightens the cart, promo, and checkout behaviour.
Fixes:
- **Cart total stays in sync** — Fixed the total not always updating right after a package quantity changes.
- **One plan at a time** — Fixed a rare case where a class package could stay in the cart after adding a membership.
- **Promo badge clears** — Fixed the applied-promo badge sometimes not disappearing after the promo is removed.
- **Correct tax line** — Fixed the 10% tax line briefly showing the previous amount before the total settled.
- **Gift card amount check** — Fixed custom gift-card amounts outside the allowed range not always being flagged.
- **Floating cart count** — Fixed the floating cart count not refreshing straight away after removing an item.
- **Gift Card payment option** — Fixed the Gift Card payment method appearing at checkout when there was no balance to use.
- **Branch switch** — Fixed products from the previous studio briefly showing after switching branch.
