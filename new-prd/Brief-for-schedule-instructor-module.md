This is the schedule module where instructor can see their schedule, and managing their schedule and see the class details, this module will connect and sync to the admin side of schedule & customer module, everything that relate to schedule, class details, customer will sync to this module.

YOU NEED TO NOTE THIS, ALL THE COMPONENTS OR DESIGN IN INSTRUCTOR SIDE IS SAME LIKE THE ON IN ADMIN SIDE, SO YOU CAN REUSE FROM THE ADMIN SIDE AND ADJUST IT TO FITS THE INSTRUCTOR SIDE BASED ON FIGMA DESIGN, SO NO NEED TO CREATE NEW DESIGN, YOU CAN JUST REUSE.

We will work in 3 phase
1. Schedule module view + all tab + floating bar + action + toast + logic
2. Class schedule details for ongoing & upcoming status (for upcoming status we just make the button "present" to be disable) + all flow + actions + tabs + toast + logic
3. Create centralized mock data for schedule module so it will connect to all module, reflected, sync, to all module and the admin side too.

In schedule we will have:
1. search function
2. we wil have tab (Day, week, month) same like admin to see the schedule in different view.
- this is for the day view, and make sure you reuse from the admin
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6262-417106&m=dev
- This is for the week view, and make sure you reuse from the admin
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6262-416853&m=dev
- This is for the month view, and make sure you reuse from the admin
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6262-414703&m=dev
- this is the filter slide panel content, you can reuse the component from the earnings module in instructor
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6322-452917&m=dev
- In day, week, month, will have floating container like the one we have in the admin, just use from the admin side
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6338-455946&m=dev

3. We will have class details, its same like admin side on new page, and you can make it same like admin and instructor have different content.
- this is the class details for ongoing class 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6338-456387&m=dev
when we marked present it will turn to badge green "Present"
- this is the content on tab waitlisted, you can reuse from the admin or earnings module for class details
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6338-457388&m=dev
- this is the content on tab cancelled, you can reuse from the admin or earnings module for class details
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6338-457624&m=dev
- We can do BULK ACTION in the table so make sure you reuse the bulk action form the admin

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.