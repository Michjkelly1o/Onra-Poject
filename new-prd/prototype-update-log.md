Onra Studio Prototype Update and Walkthrough
Overall modules done 18/25
This update covers
Payroll
Staff & Permissions
Tax
Agreements
Payments
Integrations
Referral
Below, you will find a breakdown of what each module is for, its key capabilities, and the improvements made in this specific build.

1. Payroll
Your dedicated workspace for processing instructor compensation, tracking earnings, and running payroll cycles.
Capabilities
Compensation Directory — View all instructors in a centralized table displaying avatar, name, assigned pay rate, branch, classes taught in the period, computed earnings, and last payroll status.
Search & Filter
Instructor Earnings Detail — Open any instructor to inspect the per-class breakdown: class name, date, attendees, pay rate applied, and computed earnings for the period.
Run Payroll — Guided multi-step flow for processing a pay cycle:
Select Period — Choose the pay period.
Review Earnings
Adjustments
Confirm — Lock the run with attribution and timestamp.
Payroll History
Export — One-click CSV export of any compensation view.
What's New
A comprehensive list view with sortable columns, period KPI cards, and CSV export.
A guided Run Payroll wizard with live earnings preview and per-instructor adjustment support.
Instructor earnings detail page with full per-class transparency and pay rate snapshot.
Centralized earnings math

2. Staff & Permissions
Your team management hub, covering staff records, role definitions, and granular permission control.
Capabilities
Staff Tab — Browse all team members with avatar, role, branch assignment, contact info, pay rate, and status.
Search & Filter
Add Staff — Onboard new team members via a dedicated form covering personal info, role assignment, branch scope, contact details, and starting pay rate.
Staff Profile — Open any staff member to access personal info, role + branch assignment, pay rate history, and lifecycle controls (Deactivate, Archive, Reactivate, Recover).
Roles Tab — Browse all defined roles with their member count, status, and quick actions. The Owner role is locked and cannot be edited or deactivated.
Role Detail
Edit Permissions — Inline editor to toggle granular permissions per module. Live preview of the affected member count.
Bulk Actions — Multi-select staff or roles for bulk Archive, Reactivate, Recover, Deactivate, Delete with a floating action bar.
What's New
A comprehensive list view for both Roles and Staff with sortable columns and bulk actions.
Dedicated permission matrix editor with per-module scoping and live member-count preview.
Add / Edit staff form with role + branch + pay rate assignment in one flow.
Lifecycle controls that preserve historical data appropriately (archived staff stay queryable for payroll history).

3. Tax
Your tax configuration library, defining rates once and applying them across product categories.
Capabilities
Tax Rates Tab — Browse all configured tax rates with name, percentage, inclusive / exclusive treatment, status, and usage count.
Add / Edit Tax Rate — Configure a rate with name, percentage, and inclusive vs. exclusive treatment.
Apply Tax Rates Tab — Map each product category (Membership, Credit package, Gift card, Pay rate) to one of your defined rates. One-click switch a category's rate without revisiting its individual products.
Studio-Wide Toggle — Flip the global "Prices include tax" setting that drives display behavior across the storefront and POS.
Lifecycle Control — Archive obsolete rates, recover them later, or bulk-delete unused ones.
What's New
A two-tab structure that cleanly separates rate definition from rate application.
Real-time usage tracking — see exactly which categories each rate is bound to.
Bulk actions with delete-only-when-unused safety constraints; tax rules referencing a deleted rate are gracefully cleared.

4. Agreements
Your library of waivers, terms, and policy documents version-controlled and assignable across the customer base.
Capabilities
Agreements Directory — Browse all documents with title, current version number, status (Active / Archived), last updated date, and signed / issued counts.
Agreement Detail — Open any agreement to view its full content, version history, and signature stats.
Create New Agreement — Author a new document with title, full body text, and effective date.
New Version — Publish a new revision of an existing agreement. Old versions are preserved for full audit trail.
Edit Mode — Inline edit the latest version's title or body before publishing.
Lifecycle Control — Archive old agreements when retired. The customer profile's Agreements tab respects status when surfacing what each member has signed.
What's New
Full version history with per-version stats (issued / signed counts).
Rich body editor for clean formatting.
Signature stats that pull from the customer agreements table in real time so the directory always reflects live data.

5. Payments
Your payment provider configuration center, managing Stripe, Apple Pay, Google Pay, and other gateway connections.
Capabilities
Provider Card Grid — Browse all available payment providers in a card layout showing the provider logo, connection status (Connected / Disconnected), and last sync timestamp.
Connection Flow — Connect a new provider via its standard OAuth or API key flow with a guided modal.
Disconnect — Sever a provider connection with confirmation.
Status at a Glance — Each card surfaces its real-time health (connection valid, last successful transaction, error state if any).
POS Sync — Connected providers propagate to the POS checkout payment-method picker automatically — no extra step.
What's New
Card-grid layout with connection status badges.
One-click connect / disconnect flows with toast confirmation.
Real-time provider state propagation to every dependent surface (POS, refund flows, payment history).

6. Integrations
Your third-party app marketplace, surfacing every integration your studio can wire up.
Capabilities
Integration Card Grid — Browse all available integrations with logo, short description, category, and current connection status.
Connection Flow — Connect each integration through its provider-specific authentication (OAuth, API key, webhook URL).
Disconnect — Sever an integration with confirmation. Per-integration configuration is preserved for next time.
Per-Integration Configuration — Some integrations expose additional settings (default calendar, channel selection, sync frequency, etc.) reachable from the card.
What's New
Newly designed card grid with category grouping and connection status badges.
Standardized connect / disconnect flow across all integrations.
Per-integration detail page that hosts provider-specific settings without leaving the studio admin.

7. Referral
Your customer referral program control center, setting rewards for both referrers and referred members.
Capabilities
Program Master Switch — Enable or disable the entire referral program with one toggle. The customer-facing referral CTA respects this flag.
Edit Referral Settings — Two-step wizard for benefit configuration:
New Customer Benefit — Define what a NEW (referred) customer receives: credit count and welcome message copy.
Existing Customer Benefit — Define what an EXISTING (referring) customer earns: trigger condition, minimum referred count, credit reward, and acknowledgement message.
Customize Referral Information — Edit the customer-facing description copy shown in the referral share UI.
Live Data Sync — Configured benefits propagate to the customer profile's Referrals tab the moment they're saved.
What's New
Two-step wizard for benefit configuration with field validation per step.
Customize referral information form to edit the customer-facing copy without code changes.
Master switch that respects every dependent surface (program off → customer-facing CTA hides studio-wide).

Important Notes on the Prototype
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.
Resetting to sample data — To return to the default seeded data:
Browser settings → Privacy → Clear browsing data for this site, OR
DevTools → Application → Local Storage → delete the onra-demo-state key.

