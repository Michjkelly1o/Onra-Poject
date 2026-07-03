Onra Customer Prototype Update and Walkthrough
Customer modules done: 4
This update covers these modules:
Products

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
This update is another round of Products fixes — no new screens, just smoother browsing, gift-card, and checkout behaviour.
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Products
The customer storefront — browse memberships, class packages, and gift cards, then check out and pay. This update cleans up the product details, gift-card, and promo steps.
Fixes:
- **Quantity stepper** — Fixed the minus button letting a package quantity drop below one.
- **Product details** — Fixed the details sheet briefly showing the previous product's price when reopened quickly.
- **Promo code casing** — Fixed a valid promo code being rejected when it is typed in lowercase.
- **Voucher selection** — Fixed an applied voucher not appearing as selected when the voucher list is reopened.
- **Gift card recipient** — Fixed the Confirm button staying disabled after a valid recipient email was entered.
- **Message counter** — Fixed the gift-card message counter not resetting after the note is cleared.
- **Tab memory** — Fixed the catalogue jumping back to the All tab after opening a product and going back.
- **Payment success link** — Fixed the success screen occasionally opening the wrong page after a mixed cart of a plan and a gift card.
