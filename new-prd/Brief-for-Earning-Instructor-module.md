This is the earnings module where we can see the earning in the instructor based on each classes that they teach with status completed and cancelled. this module in instructor side will connect to the class schedule, pay role module in admin, and other module that related with earning and class schedule of instructors in admin or instructor side.

MOSTLY THIS MODULE EARNINGS IS THE DUPLICATION OF THE MODULE IN ADMIN SIDE, SO YOU NEED TO PUT ATTENTION TO THIS SO WE WILL REUSE AND NOT INVENT NEW THINGS.

We will work in 3 phase
1. Earning module view + all flow + action + toast + logic
2. Class schedule details for cancelled and completed status + all flow + actions + toast + logic
3. Create centralized mock data for earnings module so it will connect to all module, reflected, sync, to all module and the admin side too.

1. This is the view of earnings module, the view is same like the one we have in the payroll module in admin for instructor details.
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-334226&m=dev
it has table action dropdown and if we click it will open the "view details" and if we click it will direct us to the "class details" list in the earnings list module.
- We can do search
- We can do filter
this is the filter content, side panel filter
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-334795&m=dev
- We can do filter "date period" this on is same like in the dashboard

2. We have class details view for completed and cancelled class, its actually same like the one we have in the admin side for completed and cancelled class details in class schedule module
- this is the view for tab booked for class with status cancelled
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333535&m=dev
- this is the view for tab waitlisted for class with status cancelled 
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333744&m=dev
- this is the view for tab cancelled for class with status cancelled
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333836&m=dev

For class details with status completed in class details we will have 4 tab booked, waitlist, cancelled, Reviews & Rating
- this is the view for tab booked for class with status completed
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333463&m=dev
- this is the view for tab waitlisted for class with status completed
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333695&m=dev
- this is the view for tab cancelled for class with status completed
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333793&m=dev
- this is the view for tab Reviews & Rating for class with status completed
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-333879&m=dev
- this is the filter content in tab reviews and rating 
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6616-334154&m=dev

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.