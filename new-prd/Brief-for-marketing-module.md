Marketing module

marketing module is the module to set a marketing campaign for business, we have 2 type of marketing campaign
1. New class
2. Announcement
3. Event

marketing module view is same like promo module, because we use card to show the marketing.

Also, please take note of the modals and notifications that appear for every action throughout the flow.

after we create create marketing, we wil have some logic/state 
Active marketing details - With data (for this we can edit, archive, deactivate)  
Active marketing details - Without data (for this we can edit, archive, delete) 
Archived marketing details - With & without data (for this we can only recover)  
Inactive marketing details - With & without data (for this we can archive & reactivate)

When we create marketing we will have 2 step
1. Marketing configuration
    1. in this step we can set the 
        1. marketing details section (input banner image, display name, marketing type short description)
        -  if we select marketing type new class, link or action will only have (book a class) with duration section (start date - start time and end date - end time and he count down switch toogle)
        - if we select marketing type announcement, link or action will be external link or no action. if we select external link it will have input for put the external link. if we select no action the there is no input. with duration section (start date - start time and end date - end time and he count down switch toogle)
        - if we select marketing type event, link of action will be book an event, buy a ticket, external link. if we select book an event there is no input. if we select buy a ticker there will be an input about the ticket price. if we select the external link the input will be external link. with duration section (start date - start time and end date - end time and he count down switch toogle)
2. Visibility settings
    1. applicable branch section (we can set this marketing is multi location access or not by switch the toogle, this behaviour is same like in membership/package for multi location access)
    2. applies to section (Packages - The marketing can be use on multiple packages, Classes - The marketing can be use on multiple classes, Customer - The marketing can be configured to target specific eligible users.)
3. publish to add new marketing

we also have the marketing details page, is same like details page in the membership/package, but for the marketing we dont have tabs, we just have 1 page details with all information based on things we set in the creation of marketing. for this section (make sure the icon is same like figma design, and the logic is match and reflect when we add marketing or edit.)

make sure when we add marketing or edit, the information in marketing details is based creation page. this logic is same like in the membership or package creation so when we create it or edit the details is reflect based on the informaiton we input.

for the edit page is same like creation page with predefined information based on data that we want to edit.

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.