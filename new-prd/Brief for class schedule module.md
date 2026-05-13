so the class template is done sofar, and we can continue to schedule module under the class template menu.  
The schedule is quite complex because its has many state, logic, and screens. so i need you to take notes about it. And remember for filter view, add, edit, schedule details, is same like the class template so please dont reinvent the different one, you can just duplicate maybe and change the content to fits the "schedule module context" because last time we implement filter and etc you build like modal and different.  
and also take note for the modal and notifications show up for every actions we do.  
the schedule have 4 view using tab component (List view, Day view, Week view, Month view)  
\- list view is a table and we can use it from the class template detail "classes table" because the class template is the parent and the schedule is the list of "classes" create using that class template, in this module is connected to the class template module, you need to take attention for it. because when we cancelled the class in schedule for mat pilated, it should reflect in class template mat pilates for example.  
when we add shedule, there are 3 step  
\- class detail, we can select the class template we gonna use, after we select the class template, the class template input field is gonna show up fill the container, is actually same input when we add new class template in class template module.

* location & instructor, is when we select the room location under studio branch. if we have schedule with 10 capacity but the room only have 8, it will show warning to tell “its over capacity, so change to another room, for example”. we can set the equipement its an input field. we can turn on the spot selection (the default is off) spot selection is where we can customize the spot for customer who take this class, like block spot. we can also select the instructor that is gonna take the class schedule.  
* date & time, is where we set the repeat and date, we can repeat the schedule input dropdown (Does not repeat, Repeat weekly, Repeat every X week). date input is calendar use the calendar we already create in this project like in the dashboard period input but this one doesnt have start date & end date, just select date.  
  * logic for repeat dropdown selection: if we select does not repeat it will who the input to select the start time & end time  
  * if we select the repeat weekly, it will show how many repeat for weekly like 2 week, we have recurring ends (end condition dropdown will have no end date( the date input will be disable), end on date (end on specific date we can select it in date calendar), end after (date input will change/switch to number of classes, so its gonna end after how many number of classes) & date input), after it we can select multiple days from mon-sun, if we select the days it will show the “general schedule” section where we can set the start time and end time on that days and we can add time slot in that days and also can delete the added time slot, but the default start time and end time the delete is disable, only if we add new time slots it can be delete the new one. and then under the general schedule section we have “Preview of scheduled classes” section. and then we can publish the class.  
* we can also edit the class/schedule  
* after we create schedule/class we wil have some logic/state  
  * **Upcoming class details \- Over 24 hours (for this we can cancel & remove customer from this class and if we cancel / remove there will be a modal for refund class credit to user and its optional switch)**  
  * **Upcoming class details \- Under 24 hours (for this we can cancel & remove customer from this class and if we cancel / remove there will be a modal for refund class credit to user and its optional switch)**  
  * **Ongoing class details \- During class or Post the class (max 12 hours after class) (for this we can select the “present” for each customer who present in this class)**  
  * **Completed class details \- 12 hours after class (super admin) (for this we cant do action to this class)**  
  * **Cancelled class details \- 12 hours after class (super admin) (for this we cant do action to this class)**  
  * **Active class details \- Class Actions \-  Have Booked Customer**  
  * **Active class details \- Class Actions \- No One Booked (empty state all the table)**

	

* Class details will have 3 tabs (booked, waitlisted, cancelled) it will be a table view, you can use the table from the class template and change the information and data to match the figma design.  
* we also have class details preview side panel, where we have actions (acc customer will be modal, edit class, cancel class) except for the completed class cancelled class.  
* completed and cancelled class doesnt have table action dropdown, for this “Ongoing class details \- During class or Post the class (max 12 hours after class)” will have table action dropdown for present the customer, the rest of all state will have cancel/remove customer  
* waitlist and cancelled tab doesnt have table action dropdown  
* only for this state “**Completed class details \- 12 hours after class (super admin)” we have 1 more tabs called ‘reviews & rating” where we can see all the review and rating the customer give to this class, for owner/branch admin can delete the review and under the tab “ratings and review” have the tab to see “ratings and review & deletion log” but for other roles we cant delte the review and doesnt have inner tab to see deletion log under the tab “reviews & ratings”**  
* **for every tab (booked, waitlisted, cancelled, reviews and rating we will have search & filter above the table, same like class template details.)**  
* when we add a customer to class schedule (modal view), we will have 2 state/logic

	1\. 1st is when customer is have plan (membership/package) but the membership and package must fits the class template applicable membership and package, for example if class template mat pilate doesnt select the membership beginer, so in the list customer we dont show the customer who has membersip beginer, we only show customer who has membership/package that is the class. template select the applicable membership & package, but if the customer is have plan wich class template selected we can add customer to the booked table

1. 2nd is when the customer doesnt have any plan, we will prompt the admin and show the modal to select the membership/package and continue to proced the payment, its like shortcut POS

Note in this project. customer only can have 1 membership or multiple packages. cant have membership & package in the same time, so 1 membership only or 1 package/multiple packages.  
make sure when we create a new module/we use the things we have done and do not need to reinvent new one, for example like, table, filter, view, modal, notifications, etc. we just need to change the content inside it.  
make sure also for every module data is connected so it sync, for example if we cancel the class in schedule it will reflect the table inside class template and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.

 make sure each module is work in terms of functionality and logic  
