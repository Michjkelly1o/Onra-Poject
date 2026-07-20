Onra Customer Prototype Update and Walkthrough
Customer modules done: 4
This update covers these modules:
Products

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/customer" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

1 Products
The customer storefront — browse memberships, class packages, and gift cards for the selected branch, then check out and pay in one flow.
Capabilities:
- **Three tabs** — All, Packages, and Gift card, so the customer can browse everything or jump straight to packages or gift cards. Switching branch updates the whole catalogue to that studio.
- **Your current plan up top** — A customer who already holds a plan sees an Active plan card above the list, summarising what they have.
- **Product details** — Tapping "+" on any product opens a details sheet with the name, what's included (credits and duration, or the validity date for a gift card), the price, and a quantity selector before adding to cart.
- **Smart cart rules** — A membership takes the customer straight to checkout; class packages add up and keep them on the list with a floating cart; a gift card opens a quick gift step first, then sits in the cart alongside a plan.
- **Gift card details** — When buying a gift card, the customer fills in the recipient's name and email, the amount (for custom-value cards, with a min and max guide), and an optional personal message with a 120-character limit.
- **Floating cart** — After adding a package or gift card, a cart bar floats above the bottom menu showing the item count and total, with a tap to open checkout.
- **Checkout** — One screen with the items, the payment method (Apple Pay, Visa, Credit Card, and Gift Card when there's a balance), an Apply promo row, and a clear breakdown of subtotal, 10% tax, any promo discount, and the total.
- **Promo and vouchers** — Apply a voucher from the list or type a code by hand. A valid promo shows as a discount badge on checkout and the total updates straight away; tapping the promo again lets the customer remove it. Expired or unknown codes show a clear message, and expired vouchers appear greyed out.
- **Pay and confirm** — A sticky Total with a Pay now button runs a short processing screen, then a Payment success screen with the order summary and a shortcut to View plan or View gift card.
- **Everything connects** — A completed purchase creates the membership, package credits, or gift card right away and shows it in the customer's Profile.
