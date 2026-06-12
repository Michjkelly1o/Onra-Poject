This module booking rules, is a module where we can define and set the rules for booking and class related. We can:
1. customize the classes settings, this module section will connect to the class schedule module, customer module, class or booking related modules, and it will also connect to customer side (for now we dont create customer side yet).
2. Create cancellation & no show policy and edit it. This module section will connect to the rule or policy of no show and cancellation in the class schedule and customer module of cancellation things or no show penalty like the credit is reduce from plan. and it will also connect to customer side (for now we dont create customer side yet).
3. create service category, where this category will connect to the class template, for now we have 3 class template on mock data right, so in this section we should put the same 3 class template category in here, because this service category will connect to the class template & class schedule, if we add class/service category in this module it will reflected to the category selection in class template and class schedule

Mostly this module will connect with class template, schedule, customer module, class or booking related modules, customer side/customer portal. so make sure for all data is connected, sync, reflected to all module related.

we will work with 4 phase:
1. create booking rules module view + all action + logic + notifications toast + customize new page for classes
2. create cancellation & no-show policies new page flow + all action + edit + input + logic + notifications toast
3. create service category modal flow + all action + edit + input + logic + notifications toast
4. Create centralized mock data for booking rules module, make sure all data is connected, sync, reflected to all module and inside this module.

Let's breakdown the module
1. We have the main module view, where we have 3 container section (classes, Cancellation & no-show policies, Service categories)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-29847&m=dev

2. For classes container we also have information inside of it and make sure its same like figma design and we also have button to "customize", if we click the button it will open the new page and this is the design view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-28480&m=devfor "Customize classes settings" with 3 steps:
- Booking window
this is the figma design content if we select "Inform everyone on the waitlist when a spot becomes free." 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-47871&m=dev
but if we select "Automatically book the first person on the waitlist until." this is the design where "notify the wait list input became enable to input"
Implement this design from Figma.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-47894&m=dev
- SMS cutoff window
this is the figma design content for step 2
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-47925&m=dev
- Overbooking
this is the figma design content for step 3
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-47933&m=dev
and this is the notifications toast after update 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-30293&m=dev

3. This module section will connect to the rule or policy of no show and cancellation in the class schedule and customer module of cancellation things or no show penalty like the credit is reduce from plan. and it will also connect to customer side (for now we dont create customer side yet). For "Cancellation & no-show policies" container we have button to "add new" policy and if we click it we will have new page to add new policy and this is the design view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-30598&m=dev
and this add new have 1 step "Policy details"
- if we click policy type "cancellation" and cancellation policy "Customer can cancel anytime without any charge" this is the content from figma
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-48682&m=dev
- if we click policy type "cancellation" and cancellation policy "Customer will be charged a fee if they cancel late" this is the content from figma
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-48699&m=dev
- if we click policy type "no-show" and No-show policy "A member won't be charged anything if they don’t show up for a class." this is the content from figma
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-48717&m=dev
- if we click policy type "no-show" and No-show policy "A member would be charged accordingly if they don't show up for a class." this is the content from figma, where we have 1 new input "charge class session"
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=7228-48734&m=dev
this is the toast after we create, make sure the copies inside toast to adjust to fit the cancellation or no-show policy.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-35831&m=dev
and this is the container view of "Cancellation & no-show policies" after we add some policy
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-34127&m=dev
we can Delete and edit policy and this is the toast after edit
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-35336&m=dev

4. For this we have serview category container and have "add new service category" button, if we click it will open the modal to add new category and this is the modal.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-40094&m=dev
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-40351&m=dev
and this is the toast after we add new category 
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-38075&m=dev
and this is the view of the container of "service category" after we add some category
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-38009&m=dev
we can delete and edit category
and this is the toast after we update the category
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4580-38827&m=dev

Make sure if the container is empty we use the empty state that we already create to all module before.

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.