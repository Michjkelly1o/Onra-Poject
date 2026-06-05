This is the branding module for admin to customize the design settings and portal preference.

We will work in 3 phase
1. create branding module view + all action + notifications toast
2. create all setting update in new page view + all action + input + logic + notifications toast
3. Create centralized mock data for branding module, make sure all data is connected, sync, reflected to all module.

this is the view for branding module
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-21332&m=dev

this is the customize design settings new page, we only have 1 step
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-23149&m=dev
in this view, we can change the display name, primary color, background color, and text color. and this feature of colors will apply to the customer side interface / customer portal which is we dont create it yet, but for display name it should apply to the dashboard too.
and this is the toast after success update
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-22826&m=dev

this is the view for customize portal preference and we have 2 step (porta link & embed website)
this link below for the view portal link
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-24398&m=dev
we can see the live portal of customer portal/customer side view. and for the menu bar in customer porta is we can show it or not.

this is for the view for step 2 embed website
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-24852&m=dev
where we can embed URL/code and links
and this is the toast after update customize portal preferences.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4468-22327&m=dev

For this module its integrate with the customer side/customer portal which is we not created yet. for now we can create the toast to inform customer side is not created yet if we click like link to see the customer side/portal. and in the future if we already create all customer side we can connect this module to the customer side for customize and see from the link.

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.