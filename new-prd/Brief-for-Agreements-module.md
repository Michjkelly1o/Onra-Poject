This is the brief for the agreements module, agreements module is the place where we can configure the agreements and apply it to the customers.

we will work with 4 phase:
1. create agreements module view + all action + filter + notifications toast
2. create add new agreements new page flow + all action + edit + input + logic + notifications toast
3. create details new page for agreements details with all the actions + notifications toast + and logic + all tab
4. Create centralized mock data for agreements module, make sure all data is connected, sync, reflected to all module, like in the customer agreement tab or other module.

This is the view for agreements module
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4232-52279&m=dev
where on the toolbar we have:
    - select branch locatio make sure its same like another module, search, 
    - export its the dropdown menu like in the customer module where we can have 3 option export and for now make the csv is able for export, 
    - filter, and this is the filter content
    @https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4232-51994&m=dev
    - and add button to add new agreements.
the agreements module will be the table view where we have "bulk actions" and table actions dropdown for:
- view
- edit
- archive
in this module we dont have delete and deactivate.

This is the aggrement creation view
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4205-125208&m=dev
it has 3 step:
1. Basic information and this is the content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4205-125233&m=dev
2. Rule and this is the content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-152920&m=dev
make sure the logic of issued date and expiry date is working, like we only can set the issued date on live date and we cant set the past date for expiry date.
3. Agreement and this is the content
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4983-113037&m=dev
 (in this step we can write agreement manually or can upload PDF/doc file agreement and this is the view for upload
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4984-116659&m=dev)


this is the view for the agreement details
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-150012&m=dev
we have 2 tabs (agreements details and agreements version)
this is the content for agreements details tab
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-150030&m=dev
this is the content for the agreements version tab, its a table where we can search and on table have bulk action and have table action dropdown to see view the agreements in modal and republish the agreements (ONLY FOR THE NEW VERSION)
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-154039&m=dev
this is the modal for view the detail agreements inside the table agreement version
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-156334&m=dev

this is the page for add new version agreement from the agreement actions in agreements details.
@https://www.figma.com/design/nzV4uBZZ4MWQAKNs6lnW0O/Onra---Studio-Dashboard--Prototype-?node-id=4209-156753&m=dev

for the edit agreements is same like creation flow but we dont have the step 3 for agreement

Rules:  
1\. put attention to details
2\. in this app the customer only can have 1 membership/multiple packages.
3\. please use the design that we already create, dont invent new things if we already have it, for example like filter side panel, layout, flow, components, etc.  
4\. Dont broke the current UI, module, flow we already create.
5\. make sure also for every module data is connected so it sync, for example if we delete, deactivate, archive, or other actions in this module it will reflect the table and other module, and for edit too and added new data too, delete, archive, deactivate, or other actions.
6\. dont forget to use the empty state if data is empty.

---

## TODO — Customer-side enforcement (deferred until customer module is built)

When the customer-facing booking flow is implemented (the real one, not the legacy `/member/browse` mock at `src/app/member/browse/page.tsx` which uses an older `useDataStore`), wire agreement enforcement so customers must sign required outstanding agreements before booking.

**Where to add the hook (when customer flow exists):**

1. **Pre-confirm gate in the booking modal/page**
   - Before allowing the final "Confirm Booking" action, query `useAppStore(s => s.customerAgreements)` for the current customer:
     ```ts
     const pending = customerAgreements.filter(ca =>
         ca.customerId === currentCustomerId
         && ca.status === "unsigned"
         // optionally filter to agreements applicable to this class's
         // branch + class template (see `liveClassTemplateNames` in
         // `src/components/customers/CustomerAgreementsTab.tsx` for the
         // applicability logic — reuse it)
     );
     ```
   - If `pending.length > 0`, render a "Sign required agreements" section above the payment/confirm controls and disable Confirm until `pending.length === 0`.

2. **Sign UI per row**
   - Each pending row: agreement name + version + a "Read & Sign" button.
   - Tap → open `<AgreementContentModal>` (already shared at
     `src/components/settings/AgreementContentModal.tsx`).
   - Add an optional `onSign` prop to that modal that renders an
     "I agree" primary button next to Close. When pressed, it should
     call a new store action `signCustomerAgreement(customerAgreementId)`
     (also pending — see below) and close the modal.

3. **Store action needed**
   - Add to `src/lib/store.ts` (interface + impl):
     ```ts
     /** Flip a single customer_agreements row to "signed" and stamp
      *  signedAtISO with now. Called from the customer booking flow. */
     signCustomerAgreement: (customerAgreementId: string) => void;
     ```
     ```ts
     signCustomerAgreement: (id) => set(state => {
         const stamp = new Date().toISOString();
         return {
             customerAgreements: state.customerAgreements.map(ca =>
                 ca.id === id
                     ? { ...ca, status: "signed", signedAtISO: stamp }
                     : ca,
             ),
         };
     }),
     ```

4. **Lifecycle already wired (no extra work)**
   - `addAgreementVersion` already fans out unsigned rows to every existing
     customer who has prior rows for the agreement
     (`src/lib/store.ts` → `addAgreementVersion`).
   - `republishAgreementVersion` already flips signed → unsigned for the
     current version so customers have to re-sign.
   - The admin Customer Detail Agreements tab
     (`src/components/customers/CustomerAgreementsTab.tsx`) already
     reflects status changes live.

5. **Don't forget**
   - When the customer module gets a real auth/identity layer, drop the
     hardcoded demo customer mapping and use the logged-in customer's id.
   - Surface a notification dot/banner in the customer's home view when
     `pending.length > 0` so they see it before tapping into a class.