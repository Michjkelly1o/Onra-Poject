The Memberships & Packages module is one of the core modules for building the product catalog, and these products will be available throughout the system, including POS.

The product creation flow itself is quite complex, as it includes many configurations and rules, so please focus closely on that.

Also, please take note of the modals and notifications that appear for every action throughout the flow.

The membership & packages have 2 view using tab component (Membership & Credit package) to differentiate between products.

For the membership tab, this is recurring plans for monthly class access
\- list view is a table and we have column such as membership name, price, branch location, duration, status (active, inactive, archive), and three-dot (⋮) action menu (view, edit, archive, deactivate)

For the credit package basically same as membership tab, we can reuse the table but change the membership name column to credit package name
\- list view is a table and we have column such as credit package name, price, branch location, duration, status (active, inactive, archive), and three-dot (⋮) action menu (view, edit, archive, deactivate)

When we add new product, it will open a full page modal with 5 steps
\- product details, in the creation phase we have Select product, Basic information, Product configuration, Duration & renewal, & Purchase rules steps.

The first one is
* Select product, there are 2 options of product that we can select like membership or credit package. FYI membership is Recurring plans for monthly class access, while credit package is Pre-paid credit for flexible class bookings. After we select one of it we can continue to next step.

* Basic information, in basic information step we provide information such as membership name for membership or credit package name for credit package, description, welcome message, & pricing.

* Product configuration, in product configuration we have to set up number of the credit amount and location access, there are few conditions like unlimited credit amount, if we turn it on so the product will be unlimited. and then for the multi - location access when we turn it on, the product can applicable on multiple branches, not just one location.

* Duration & renewal, in this step we set the duration of the product. The duration have options from day until year that we can input the amout of it. And then we have renewal too, but the renewal show only in membership product, it doen’t show in credit package. We can turn the renewal condition, if we want the membership to automatically renew and charge the customer at the end of its duration.

and then the last step is
* Purchase rules, in this step we can set up the purchase rules for each product

   For membership we have
     * Time bond rules, to control when this membership can be purchased (purchase window, day of week restrictions, activation delay).  We can turn it on or off each of them.
          * Purchase window, is we can set up the available from until the end available until date, it use the date component.
          * Day of week restrictions is we can select the days from mon - sun
          * Activation delay is we can set up the delay from when the membership is purchased until the activation date, it use the date component.
     * Elibility rules, to control who can purchase this membership (New customers only, existing customers only, spesific location or region).  We can turn it on or off each of them.
          * New customers only, if we turn it on we can define the "new customer" in the definition such as "never purchase any paid package" or "account created with last x days" or both.
          * Existing customers only, if we turn it on we have to define the condition, "must purchase at least X packages before this membership".
          * spesific location or region, if we turn it on the customer can only purchase this membership if they are in the specific location or region.
     * Usage cap rules, to control Limit total availability across all customers (Total redemptions cap, Per-location cap, Per-day cap).  We can turn it on or off each of them.
          * Total redemptions cap, if we turn it on we can define the maximum number of total purchases accross all customers.
          * Per-location cap, if we turn it on we can define the maximum number of total purchases accross each location.
          * Per-day cap, if we turn it on we can define the maximum number of total purchases accross each day.
    After we done set up the purchase rules, the product is ready to publish, it just same like in the class template if the content in the step is filled the Create button gonna activate.

   For credit package we have
     * Purchase limit rules, to control how often a customer can buy this package (Lifetime limit or Rolling window or calendar period limit). We can choose one not both, we cant use it together.
          * Lifetime limit, if we select this the default number of total purchases accross all customers is 1 maximum per customer.
          * Rolling window or calendar period limit, if we select this we can define the number of period limit and the limit period will be day or week or month.   
     * Time bond rules, to control when this membership can be purchased (purchase window, day of week restrictions, activation delay).  We can turn it on or off each of them.
          * Purchase window, is we can set up the available from until the end available until date, it use the date component.
          * Day of week restrictions is we can select the days from mon - sun
          * Activation delay is we can set up the delay from when the membership is purchased until the activation date, it use the date component. 
    * Elibility rules, to control who can purchase this membership (New customers only, existing customers only, spesific location or region).  We can turn it on or off each of them.
          * New customers only, if we turn it on we can define the "new customer" in the definition such as "never purchase any paid package" or "account created with last x days" or both.
          * Existing customers only, if we turn it on we have to define the condition, "must purchase at least X packages before this membership".
          * spesific location or region, if we turn it on the customer can only purchase this membership if they are in the specific location or region.
     * Usage cap rules, to control Limit total availability across all customers (Total redemptions cap, Per-location cap, Per-day cap).  We can turn it on or off each of them.
          * Total redemptions cap, if we turn it on we can define the maximum number of total purchases accross all customers.
          * Per-location cap, if we turn it on we can define the maximum number of total purchases accross each location.
          * Per-day cap, if we turn it on we can define the maximum number of total purchases accross each day.
    After we done set up the purchase rules, the product is ready to publish, it just same like in the class template if the content in the step is filled the Create button gonna activate.



* after we create create product, we wil have some logic/state 
  * **Active membership/credit package details \- With data (for this we can edit, archive, deactivate)**  
  * **Active membership/credit package details \- Without data (for this we can edit, archive, delete)**  
  * **Archived membership/credit package details \- With & without data (for this we can only recover)**  
  * **Inactive membership/credit package details \- With & without data (for this we can archive & reactivate)**  
* In membership or credit package details we have 2 tabs (membership or credit package detail & active customers)
     * in the product details "membership details" or "credit package details" we have some sections called:
      For membership:
         * Basic information (Description, Welcome message, Price, Credit amount, Applicable branches)
         * Duration & renewal (Duration, Renewal, Active on first use)
         * Purchase Rules (Time bond rules, Eligibility rules, Usage cap rules)

      For credit package:
         * Basic information (Description, Welcome message, Pricing, Credit amount, Applicable branches)
         * Duration & renewal (Duration, Renewal, Active on first use)
         * Purchase Rules (Time bond rules, Eligibility rules, Usage cap rules)
    * in the tab active customer we just show the customer table, the column are customer name, contact like email & phone, Expire or renewal date. the action button here is just a three-dot (⋮) to view the customer details only.
* we also have membership or credit package details preview side panel. the action button inside the side panel will be different based on the state/logic of the product.
* when edit product, it will use the same modal but it will use the data from the product we trying to edit so we can edit it. but we need to make sure the data we edit should be in the same state or logic. we can only edit the active product only.
* when we delete the data in table, we need to make sure the data is not connected to any other data, for example if the product is connected to any other data, we cant delete it directly we need to make sure the data is not connected to any other data first then we can delete it.
* make sure the modal and notifications show up for every actions we do.

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages.
2\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
3\. Dont broke the current UI, module, flow we already create.
4\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
