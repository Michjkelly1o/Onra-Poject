i want to create for the payment module and its also same like integrations module

we will work with 3 phase:
1. create integrations module view + all action notifications toast
2. create integrations all modal view to connect, view, and disconnect + action + notifications toast
3. create centralizde mock data and connect this payment to the POS payment method

this is the view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-87030&m=dev

this is the modal if i click connect
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-87633&m=dev

this is this modal after i click continue
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-87842&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-119779&m=dev

this is the success toast
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-120051&m=dev

this is the card for connected
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5360-60337&m=dev

this is the modal to view information
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-119070&m=dev

idk if the flow is correct but i ask on claude that the apple pay and google pay is inside the Stripe, so if we connect stripe 1st it can enable the apple pay and the google pay, is that correct?

this is the action modal for enable apply pay and goggle pay 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4108-132536&m=dev

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.