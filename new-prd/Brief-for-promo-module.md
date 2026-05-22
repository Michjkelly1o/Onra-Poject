Promo module

promo module is the module to set a promo in business products, it can be use by admin/customer while checkout their products, promo module will have percentage or fixed amount to apply.

promo module view is same like class template, because we use card to show the promo.

Also, please take note of the modals and notifications that appear for every action throughout the flow.

after we create create promo, we wil have some logic/state 
Active promo details - With data (for this we can edit, archive, deactivate)  
Active promo details - Without data (for this we can edit, archive, delete) 
Archived promo details - With & without data (for this we can only recover)  
Inactive promo details - With & without data (for this we can archive & reactivate)

When we create promo we will have 2 step
1. Promo configuration
    1. in this step we can set the 
        1. promo details section (input banner image, display name, short description, link or action (book a class / buy a package)) 
        2. duration section (start date - start time and end date - end time, we have the switch container to “Countdown - Show the timer to highlight limited-time offers”)
        3. promo configuration (discount value free class its only for book a class selection, when we select buy a package we will have percentage or fixed amount discount value, promo code)
        4. usage limit section (First-time users only - Only customer who have never purchased before with input number of user and This promo has usage limit - Turn this on if the promo has a limit with input Usage limit per customer).
2. Visibility settings
    1. applicable branch section (we can set this promo is multi location access or not by switch the toogle, this behaviour is same like in membership/package for multi location access)
    2. applies to section (Packages - The promo can be use on multiple packages, Classes - The promo can be use on multiple classes, Customer - The promo can be configured to target specific eligible users.)
3. publish to add new promo

the promo must have the promo code

we also have the promo details page, is same like details page in the membership/package, but for the promo we dont have tabs, we just have 1 page details with all information based on things we set in the creation of promo. for this section (make sure the icon is same like figma design, and the logic is match and reflect when we add promo or edit.)

make sure when we add promo or edit, the information in promo details is based creation page. this logic is same like in the membership or package creation so when we create it or edit the details is reflect based on the informaiton we input.

for the edit page is same like creation page with predefined information based on data that we want to edit.

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.