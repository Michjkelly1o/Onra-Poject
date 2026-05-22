The Gift Card module is one of the most important module for building the product catalog, and these products will be available in POS. Gift card are pre-paid monetary value cards that can be purchased in-studio (via POS) and redeemed against future purchases. They have their own balance in AED.

Also, please take note of the modals and notifications that appear for every action throughout the flow.

The gift card list view
\- list view is a table and we have column such as gift card name, price, active customers,valid until, status (active, inactive, archive), and three-dot (⋮) action menu (view, edit, archive, deactivate).

When we add new gift card, it will open a full page with 3 steps
\- gift card details, in the creation phase we have Basic information, Product configuration, & Duration configuration steps.

The first one is
* Basic information, in this step we input the gift card name,description, & gift card price. after we fill in the basic information step we can continue to next step.

* Product configuration, in this step we have to set up the gift card number, custom amount condition, & gift card amount. after we fill in the product configuration step we can continue to next step.
     * Gift card number, the gift card number manually entered by the admin. It must be unique across all gift cards.
     * Custom amount condition, if we turn on the custom amount condition, it will automatically show 2 input for minimal and maximal amount of gift card and switch the gift card amount input to be 2 input minimal and maximal. custom amount is when we can set the minimal amount and maximal amount of gift card.
     * Gift card amount or custom amount condition, if custom amount condition is off, then we can input the gift card amount. else if we turn on the custom amount condition, we can set the minimum amount and maximum amount.

* Duration, in this step we have to set up the expiration date. Theres no expiration condition, the default state is no expiration date off, if we turn on the no-expire date, it will automatically turn off the expiration date. else if we turn off the no-expire date, it will automatically turn on the expiration date.
     * if we turn off the no-expire date, it will show the expiration date input field (2 input issue date & expiry date). 
     * if we turn on the no-expire date, the expiration date input field will be removed.

After we done set up the gift card, the gift card is ready to publish, it just same like in the membership and credit package if the content in the step is filled the Create button gonna activate.

* after we create create gift card, we wil have some logic/state 
  * **Active gift card details \- With data (for this we can edit, archive, deactivate)**  
  * **Active gift card details \- Without data (for this we can edit, archive, delete)**  
  * **Archived gift card details \- With & without data (for this we can only recover)**  
  * **Inactive gift card details \- With & without data (for this we can archive & reactivate)**  

* In gift card details we have 2 tabs (gift card details & active customers)
     * in the gift card details we have some sections called:
         * Basic information (Description, Gift card price, Date created)
         * Product configuration (Gift card number, Custom amount condition, Gift card amount)
         * Duration configuration (Expiry gift card & Valid until)
    * in the tab active customer we just show the customer table, the column are customer name, contact like email & phone, amount left & expire on. the action button here is just a three-dot (⋮) to view the customer details only.

* we also have gift card details preview side panel. the action button inside the side panel will be different based on the state/logic of the product.
* when edit product, it will use the same screen as the creation but it will use the data from the product we trying to edit so we can edit it. but we need to make sure the data we edit should be in the same state or logic. we can only edit the active product only.
* when we delete the data in table, we need to make sure the data doesnt have any record inside of it or connected to any other data, for example if the product is have data inside of it, we cant delete but we can archive and deactivate it. but if the data/product is empty we can delete it directly.
* make sure the modal and notifications show up for every actions we do.    

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.




          

