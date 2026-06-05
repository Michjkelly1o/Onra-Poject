This is the integrations module, where we can set the integrations inside this app.

we will work with 4 phase:
1. create integrations module view + all action notifications toast
2. create integrations all modal view to connect, view, and disconnect + action + notifications toast
3. Since we just have prototype for the integrations, does it need centralized mock data? and how its after we click and success integrate, does it will integrate like real integrate or how we handle it for prototype?

This is the view of integrations module
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22091&m=dev
it using card and has button inside of it

When we click "conenct" we will show the modal
and this is the modal for each integrations we have for now:
1. Google calendar
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22869&m=dev
2. WhatsApp business
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22960&m=dev
3. Apple calendar
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-23052&m=dev
4. Google analytics
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-23144&m=dev

this is the loading modal after we click "continue [integration tool name]"
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22530&m=dev
make sure you adjust the loading modal copies and logo to fits to each integrations tools we have.

and this is the notification toast after integratinos is success
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22222&m=dev

and this is the card view after integration is success
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5335-98795&m=dev
it has button to view and disconnect

if we click view it will show us the modal information
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-22433&m=dev

if we click disconnect it will show us the modal confirmation to disconnect.

and this is the notifications toast after we disconnect the integration tool.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4457-23238&m=dev

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.