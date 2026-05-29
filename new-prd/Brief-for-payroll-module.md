Payroll module, is the module for doin payroll management. we can run payroll, export data, filtering, search, see detail or earnings in instructor.

PUT ATTENTION TO THE DETAILS AND THE INFORMATIONS.

we will run based on phase:
1. create payroll module view + all action + filter + notifications + empty state
2. create run payroll module view + all action + filter + notifications + empty state + modal
3. create instructor details earnings view under payroll module + all action + filter + notifications + empty state
4. Create centralized mock data for payroll module, make sure all data is connected, sync, reflected to all module.

this is the payroll module view
1. we have metric to show the overview
2. we have tollbar to filter the branch location(use from the other module we already created), search, filter the period date(use it from the insights page where we can filter based on day, week, month, year, and custom range), export (use it from the customer where when we click it has dropdown with 3 option and make the csv is able to export like in the customer module), and run payroll.
3. we have table that list down the instructor and table action to see the instructor details earnings when we click it.

Note: run payroll and view details of instructor earning is in a new page.

This is the payroll module view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=2837-17872&m=dev 

this is the run payroll new page view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=3883-149504&m=dev
in run payroll new page we have:
1. metrics
2. toolbar branch location (same like in the payroll module), date period to run the payroll like 1st feb - 28th feb, 2026 (this date period should automatically set based on active month from 1st date to the last date of the month. but when we click it we can have date picker to set the date range custom. use the date picker we already create), export (use it from the customer where when we click it has dropdown with 3 option and make the csv is able to export like in the customer module), mini filter like in the payrate module (with status is: pending & paid), and button to process payroll.
3. in "run payroll new page" we have table that list down the instructor and table action to mark it as paid for the status pending.
4. this is the modal when we click to process the payroll button
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4067-90235&m=dev
and this is the another modal after we click "process payroll" inside that modal
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4085-35082&m=dev
5. if all instructor is already "paid" status paid, the button "process payroll" became disable.

this is the instructor details view in a new page, when we click the "view details" in table action dropdown in payroll module.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=2841-33871&m=dev

inside it we have side panel and we have action (change pay rate & export payout report is should be csv for now), and beside it container to hold the information about earning for a instructor (we will have tabs, metrics, toolbar to search bookings, filter the period date(use it from the insights page where we can filter based on day, week, month, year, and custom range), and mini filter button like in the pay rate to filtering based on class schedule status, cancelled, completed, ongoing, upcoming)
we will also have table to list all the classes/schedule that this instructors take and have table action dropdown to view details of the class/schedule and will will direct us to the class schedule details page.

when we click change pay rate action in side panel, we will show the modal with input dropdown to select all the payrate that we already have/create in the "pay rate module" make sure its conencted and reflected.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7093-347694&m=dev

this is the notifications or toast for success export 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=3883-142910&m=dev

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
4\. dont forget to use the empty state if data is empty.