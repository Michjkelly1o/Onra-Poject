This is the module for managing and customize business & locations, like we can add branch, add room inside the branch, edit studio profile.

We will work in 4 phase
1. create business and locations module view + all action + notifications toast
2. create the creation of room and branch in new page view + all action + edit page + input + logic + notifications toast
3. Create the details of branch in new page and room details in modal + all action + logic + notifications toast 
4. Create centralized mock data for business and locations module, make sure all data is connected, sync, reflected to all module and inside the module when create, edit, make sure everything is good and conencted to all module that use branch and locations, because all module almost use this branch and locations informations.

This is the view for the business & locations module view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-163482&m=dev
in this module we can, search locations, filter (use the filter dropdown with list of Active, Inactive, Archived), and add new location (use the dropdown because we can add branch or room and this is the dropdown
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=5630-101278&m=dev).

This is the view on new page for edit studio profile if we click edit button in the 1st container of studio details.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-128977&m=dev
and this is the content for the edit studio profile
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7186-144074&m=dev
this is the toast after success update profile
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-200442&m=dev

this is the view for add new branch in new page
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-201851&m=dev
and this is the content inside the add new branch 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7186-144295&m=dev
where we can define the details (image, branch name, email, phone number), we can define the location details (address, city, country), also we can define the working hours (disable and enable the day) because each branch can have different working hours.
and this is the toast after success add new branch
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-206289&m=dev

edit branch is same like the creation of add new branch but with predefined information inside.

In this module we have table to list down all the branch and room and also we have the toggle to deactivate and reactivate the branch or room in the table and also we have the table actions dropdown for (view details, edit branch/edit room, add room(only in the dropdown branch), archive branch or room).

this is the view for add new room in new page
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-211358&m=dev
and this is the toast
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4138-226672&m=dev

edit room is same like the createion of add new room but with predefined information inside.

this is for branch details view in new page
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4098-208603&m=dev
and inside it we have table to list down all the room inside this branch and have dropdown action table in room row to view details room, edit room, archive room.

this is the modal if we see the room details
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4148-231473&m=dev

we can deactiveate and reactivate room or branch, we can archive and recover room or branch, we can delete room or branch.

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.