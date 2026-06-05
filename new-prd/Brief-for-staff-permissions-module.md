Staff & permissions module is one of the crucial module for Onra. In this module we can manage all about staff and permission. 

we will work with 4 phase:
1. create staff & permissions module view + all action + filter + notifications
2. create add new roles & add new staff creation view & flow + all action + edit + input + logic + notifications
3. create staff details based on roles (instructors role & other roles) & roles details based on roles + all action + notifications + empty state + logic
4. Create centralized mock data for staff & permissions module, make sure all data is connected, sync, reflected to all module.

FOR CREATION, EDIT, DETAILS PAGE IS ALWAYS ON NEW PAGE. PUT ATTENTION TO THIS CREATION OF MODULE.

1. change the instructors menu name to be "Staff & permissions" with the page name 

this is ALL ROLES PERMISSIONS & PUT ATTENTION TO IT, THIS IS THE PERMISSIONS THAT WILL WE USE FOR PREDEFINED ROLE (OWNER, BRANCH ADMIN, OPERATOR, FRONT-DESK, INSTRUCTOR)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6618-158420&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6618-158419&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6618-158418&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6618-158417&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6618-158416&m=dev


For staff & permissions module view we will have:
toolbar that include:
- the branch location input (use from the other module we already created) 
- search
- export (use it from the customer where when we click it has dropdown with 3 option and make the csv is able to export like in the customer module)
- add new button (with dropdown menu role / staff like in the customer module add new or import).

container that will hold the tab and table of roles & staff list
the container will be like "membership & package" where we have tabs for 2 tab and have filter in the right side.

1. Tab 1 roles
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6223-328106&m=dev
- we will have table with toogle switch in the table cell beside the table action dropdown, the table toogle switch is for deactivate/reactivate the roles. we will have also the table action dropdown for (view details, add staff, edit details, edit permissions, archive).
- for table roles we dont have empty states because it will directly count the roles as we sign up, for example if we sign up we will automatically have roles "owner" and staff "jack - that us example" that's automatically created when the 1st person/owner sign up.
- the logic is we can create roles and assign to branch location and we already have role type and the grant limits (add complimentary credit) and permissions. so after we create role we can assign staff to that role. so the role is already predefine.

2. Tab 2 Staff
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6223-378535&m=dev
- we will have table with the table action dropdown for (view details, edit details, change role, archive, deactivate or delete).
- for table staff we dont have empty states because it will directly count the roles and staff as we sign up, for example if we sign up we will automatically have roles "owner" and staff "jack - that us example" that's automatically created when the 1st person/owner sign up.
- the logic is we add new staff, we will put staff information and create temporary password for them to login, and we select the role that we already created for them. after we add staff it will set the status to be pending because when we add staff basically we send an invitation to them to login using their email and temporary password. in table action when the status of staff in pending, we will have table action dropdown (view details and resend invitations). when the staff is finnaly accept the invitation and login for the 1st time, we will set the status to be active.

Filter content for roles tab view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-352915&m=dev

filter content for staff tab view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-359613&m=dev

Creation phase for roles and staff
1. creation for roles
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6223-379708&m=dev
- we have 2 step (role details & permissions)
- role details will have input (role name, role description, and branch location).
- in step 2 (permissions)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6224-323441&m=dev
 we will have the inpu dropdown for selecting the predefinded role (branch admin, operator, instructor, front desk)
- under define role type, we will have section toogle like in the "membership & package step 4 purchase rule" where we can toogle this section to be on or off, the section is (grant limits) if we turn it on, we will have control to set the permissions and limit for the feature "add complimentary credit in the customer module" where we can set (grants per month, max grant value (AED), allow to remove unused grants) this is the optional, so the admin can set it on or off.
this is the view of section "grant limits" when we set/check it to unlimited 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6223-388450&m=dev
- under section grant limits, we will have section permissions, it is a long section and this section is the important things, because it will reflect the menu, permissions, view, based on each roles. for the 5 roles will have different permissions, when you create this section make sure you put attention to the details.
this is the notifications when we add role 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6224-328680&m=dev


2. creation for staff
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6236-395236&m=dev
- we have 1 step (staff details) the input is (staff image, first name, last name, email, temporary password, phone number, select role dropdown input, select default pay rate dropdown input.) when we add staff the status will be set to "pending"
this is the notification when we add staff
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-352875&m=dev

Details of page roles & staff
1. roles page details
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6224-328812&m=dev
this is for staff list tab content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6223-391881&m=dev
- we will have side panel to cover information of roles and have role actions like (add staff, edit roles, edit permissions, archive, deactivate or delete).
- we will have 2 tab (permissions & staff list) in permissions tab we will have the metrics of "grant limits" if it turn on, if not we will not have it. and under it we will have table of permissions based on role. in tab staff list we will have list of staff that use this role. abot the table staff list we will have toolbar to search and filter (simple filter dropdown to filter the status active, inactive, archived). in the table we will have table action dropdown that will list down the same like in the staff module tab view (view details, the staff, edit details, change role, archive, deactivate or delete).
- for edit it will be separate and in a new page (edit for role details and edit for permissions).
- when we click edit role details this is the page view (same like in the role details tabs when we create role)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-364459&m=dev
- when we click edit permissions this is the page view (same like in the permissions tab when we create role)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-363775&m=dev
this is the notifications for update role
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-440391&m=dev


2. staff page details
- ONYL FOR INSTRUCTOR WE HAVE MORE THAN 1 TAB, in the instructor staff page details, we will have side panel and all staff actions (edit staff details, change staff role, archive staff, deactivate/delete).
- we will have 2 tab (overview & permissions) in tab overview we will have metrics of instructor and some charts under it and on the right side we will have internal link, to access the earning of the instructor in the (pay roll details for its instructor), pay rate details that its instructor used, schedule class module that automatically already filtered based on its intructor.
- in tab 2 (permission) it will list down all the permission that this instructor have.
- in the other staff with roles like (branch admin, operator, front desk) we will only have 1 tab (permissions) it will have sidepanel and all the staff actions same like instructor, we will have metrics of grant limits if we turn it on when create the roll we will have it, if not we will not have it. and under it we will have table for see all the permissions that staff have.
- this figma link for the staff details for roles (branch admin, front desk, operator) if its on status pending, the staff action will be resend invitation only, and if we click it will show the notification. 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype?node-id=6237-68806&m=dev

- this figma link for the staff details for role instructor only (tab 1 overview). if its on status pending, the staff action will be resend invitation only, and if we click it will show the notification. 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6711-186175&m=dev
this is for the tab 2 content on tab (permissions)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6711-186391&m=dev
this is for the tab 1 (overview) for the empty state 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6718-175441&m=dev
- if we click edit staff details under staff details page this is the figma link
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-362448&m=dev 
and this is the notifications
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6229-363757&m=dev
- if we click change staff role button we will show the modal
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6247-223715&m=dev
and this is the notifications
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=6247-257026&m=dev


Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
4\. dont forget to use the empty state if data is empty.


---

## DEFERRED — Role-gated UI (do AFTER every Owner-role module is finished)

These two tasks intentionally come LAST, after every module is fully built
for the Owner role. The other roles (Branch Admin, Operator, Front Desk,
Instructor) reuse the same Owner pages — only the visible menu and the
allowed actions differ. Doing this last is the safest order: once all the
Owner pages are stable, gating is a thin pass on top, not a redesign.

### A. Role-gated sidebar / navigation
- Read the current role from the demo role switcher.
- Filter [src/config/navigation.ts](../src/config/navigation.ts) entries so
  Branch Admin / Operator / Front Desk / Instructor only see the menu items
  their `role.type` permits. Owner = sees everything (no change).
- Map the demo switcher's role string to the 5 predefined types
  (owner / branch_admin / operator / front_desk / instructor) BEFORE
  gating, so the mapping is deterministic.

### B. Action-level UI gating (scoped — NOT every button on every page)
- Read `role.permissions[section][module][action]` from the assigned role.
- Gate only **high-signal actions**, not every button:
    1. Delete customer
    2. Refund (POS + customer payments tab)
    3. Add complimentary credit (already gated by Grant Limits — see Phase 4
       below — but ALSO hide entirely when `customers.complimentary_credit.create`
       is false on the role).
    4. Edit pay rate / Run payroll
- Owner ALWAYS bypasses these checks.
- Defer full per-page gating to a later release — don't try to gate every
  CRUD button in every module at this stage.

### Why deferred
- Every module is currently built **Owner-first**, which is the simplest path
  to coverage. Trying to layer role-gating in parallel doubles the surface
  area to test and is the easiest way to silently break the Owner view.
- Once all modules ship for Owner, the gating pass is a single sweep over
  navigation + a handful of action buttons — much smaller blast radius.

---

## PHASE 4 PROGRESS — Cross-module sync

Phase 4 has TWO active workstreams (the rest is deferred above):

1. **Grant Limits enforcement** — the `role.grantLimits` config on each
   role caps the customer module's "Add complimentary credit" feature.
   Status: implemented (this commit).
2. **Single source of truth for instructors** — the legacy `instructors`
   slice now stays in sync with the `staff` slice whenever staff actions
   fire (status flips, role changes, pay rate assignment, delete).
   Status: implemented (this commit).