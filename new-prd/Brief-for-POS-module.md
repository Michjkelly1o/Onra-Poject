nice, we can move to the POS module now. before we already create POS module for the class schedule to add customer and but customer a plan, but that mini POS module is the simple version of POS module, but the logic is same with the POS modules itself. so we can reuse the flow, logic, and the components to create the POS module.

in design we have 3 products for now (membership, packages, gift cards) we also have checkout panel on the right side to add item in the cart, add customer to process the checkout, apply promo code, & custom discount. 

the design layout/view will be like class schedule, where we have tabs (all, membership, packages, gift cards) in the left side and the filter in the right side.

on the filter is simple we only have rage number filter (Credits range is for filtering how many credits membership & packages have) and (Price range is for filtering the range of price of a product). the filter will be dynamic following the products, in (all, membership, packages tab we can have that both filter, but on the tab gift card we can only have price range, because gift card doesnt have "credits range').

before we also already import the POS card with its variant and we will use it in this module too, same like create payment screen with 2 step (payment confirmation & receipt), same like the cart, but the cart will be a side panel in the right side.

Rules:  
1\. in this app the customer only can have 1 membership/multiple packages, so when we check out the membership make sure the "add button" in other membership product card or packages is hide or disabled. same like when we add packages the "add button" in the membership product card is hide or disabled.   
2\. in this POS module flow, the list of the product is not define based on "class template applicable membership/packages", so keep in mind that only in the POS mini version inside the class schedule, the POS product list is define by applicable membership/class package in class template.  
3\. only owner/branch admin role can be able to "apply custom discount" for now. later we when we create the module "staff & permissions" that module is where we can see the permission on each role.  
4\. gift card has 2 types (custom amount or fixed amount), when we add gift card to checkout panel we will have modal show up, to add "Recipient information" like (name, email, amount input only for custom amount gift card, add personal message) and the sender information section.  
5\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
6\. Dont broke the current UI, module, flow we already create.