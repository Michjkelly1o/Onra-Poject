This is the brief for the Tax module, tax module is the place where we can configure the tax settings and apply tax rates to each product in this project, like apply tax to membership/package, pay rate, gift card, and etc.

we will work with 4 phase:
1. create tax module view + all action + filter + notifications toast
2. create add new tax modal & flow + all action + edit + input + logic + notifications toast
3. create tab for apply tax rates with all the actions + notifications toast + and logic
4. Create centralized mock data for tax module, make sure all data is connected, sync, reflected to all module, like in the pay rate using tax or other module.

This is the view for tax module
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5006-73920&m=dev
we have 2 container in this module
1. Prices include tax
Tax rates can be exclusive or inclusive. This affects how prices are displayed to customer and calculated in invoices.
2. tab for see the "tax rates list" and "apply tax rates"
    1. tax rates list whill have this content
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5006-73991&m=dev
    where in this tab we can, export (use export dropdown like in customer module, we can download the csv file), we have filter dropdown for filtering the status like in gift card module (Active, Inactive, Archvied), and button to create new tax rate, and this is the modal for creatin tax rate
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5006-106235&m=dev
    and this is the notifications after creating tax rate
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype?node-id=5006-107638&m=dev 
    tax rate list will be in table with "bulk action" and table action dropdown for (edit, archive, and deactivate/delete), make sure the action logic is correct same like other module, where the delete is show up and change the deactivate if the tax rate is being apply. we cant edit when the tax rate is on archived or inactive. for edit is same like when we create new tax rate, its on modal with predefined information.
    2. for apply tax rates tab we will have this content
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5041-99787&m=dev
    for this tab we already have predefined categories (Membership, Credit package, Gift card "redeemed tax", pay rate) on each categories we can apply tax rate, by add another tax rule, and for the tax rule we can also deactivate and delete it.
    this is the modal for delete tax rule
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5041-105464&m=dev
    in each tax rule, we have select tax rate input dropdown and the select location input dropdown, make sure for select tax rate its from the tax rate that we already created and for locations is the list of location branch. this is the dropdown for select tax rate "
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5041-102560&m=dev"
    and also this is the dropdown for the select locations 
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5041-102561&m=dev
    

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.