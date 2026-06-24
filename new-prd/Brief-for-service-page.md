there is a new module called service, we put this module under the schedule module, service module is a module to create service where service is kinda same like schedule but its different, because service is have
1. open session without instructor
2. private with instructor
so in the admin side we configure the service and in the customer side later customer can book this service either it for open session or private.
And service is basically is like class template to create appoinment, where class template to create class schedule.

we will work with 4 phase:
1. create service module view + all action + filter + notifications toast
2. create add new service new page flow + all action + edit + input + logic + notifications toast
3. create details new page for service details with all the actions + notifications toast + and logic + all tab + all information
4. Create details new page for appoinment details with all the actions + STATUS + conditional based on the status + notifications toast + logic + all tab + all information
4. Create centralized mock data for service module, make sure all data is connected, sync, reflected to all module, like in the customer side later for the appoinment booking flow or in the class schedule for showing the card or list for appoinment in the schedule list, also in the customer side for appoinment that need the instructor.

1. in the service module there is a table and table actions and also the toolbar above it like other module we have.
this is the design
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7414-328584&m=dev
also you need to add 1 column for type (Open session or Private)
table action (view details, edit details, archive, deactivate or delete)

2. This is the filter content for the table
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7424-139522&m=dev

3. When we click add new, we will have new page with 3 step
this is the new page design same like other new page module
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7421-82433&m=dev
- step 1 service details
this is the content for step 1 IF THE SERVCE IS OPEN SESSION TOGGLE ON
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7460-16866&m=dev
This is the content for step 1 IF THE SERVICE IS OPEN SESSION TOGGLE OFF
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7460-16960&m=dev
- step 2 applicable memberships
this is the step 2 content, same like other module that have this applicable membership
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7421-107593&m=dev
- step 3 location
this is the content for step 3, where we can select 1 location
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7422-95427&m=dev
this is the toast after create service 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7422-129337&m=dev

4. For edit is same like creation but with predefined value

5. For the actions like archive, deactivate, delete, recover, reactivate, is same like other module for the logic, where we cant delete service if there is a data. but we can delete is there is no data, MAKE SURE THE LOGIC IS SAME LIKE OTHER MODULE. AND MAKE SURE ALL ACTIONS HAVE TOAST NOTIFICATIONS

6. Service details new page, where it has tab
Mostly it same like class template details, you can check on it and make sure its good.
- 1st tab is appointments and this is the design
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7423-120796&m=dev
in the table there table action dropdown and when we click it will direct us to the view details appoinments for the completed & cancelled status, but for the upcoming and ongoing we can view details, edit and cancel appoinment, same like class schedule.
there is a filter in the 1st tab and this is the filter content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7424-132998&m=dev
- 2nd tab is applicable membership and this is content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7422-129351&m=dev
in the table there table action dropdown and when we click it will direct us to the view details membership
- 3rd tab is the applicable package and this is the content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7423-28072&m=dev
in the table there table action dropdown and when we click it will direct us to the view details package

7. This is the appoinment details for the open session
OVERALL FOR THE APPOINMENT DETAILS WE JUST HAVE 2 TABS (BOOKED & CANCELLED) and overall its same like class schedule.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7424-177247&m=dev
and this is the appoinment details for the private session
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7427-179944&m=dev
This details is basically same like class details, which have status, completed, cancelled, upcoming more than 24hrs and under 24hrs, ongoing.
- For the open session appoinment details we can cancel and remove customer for upcoming class + bulk action
- For the open session appoinment details we can mark customer for the ongoing appointment status, like class schedule + bulk action
- for complete and cancelled we can do nothing.
- for the private session/no open session we cant do nothing since there only 1 customer, we cant remove or cancel customer. BUT WE CAN MARK CUSTOMER on the ongoing status.

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.