# Brief — Customer Authentication (Guest · Splash · Log in / Sign up)

> Surface: **customer** (mobile-only, `max-w-[500px]` centred column, no phone frame, `@untitledui/icons`, AED currency). Companion to `Brief-for-customer-home-module.md` / `Brief-for-customer-search-module.md` / `Brief-for-customer-profile-module.md`. Reuses the built customer shell + the profile **Emergency contact** form, the shared **processing loader**, and the DS `Button` / `Input` / bottom sheets (`DobSheet`, `OptionSheet`, `PhoneCountrySheet`).
>
> **Scope of this brief:** the **guest → authenticated** journey — **Guest mode** (explore without login), the **Splash + onboarding** intro, and the **Log in / Sign up** flow (email → OTP for returning, or email → sign-up form → OTP → emergency contact for new). This introduces the app's **auth session** (currently the app always resolves to the demo member `cust_ava_wright`; this brief replaces that with a real guest/authenticated session that every module reads). It also documents how guest mode **gates** the already-built Home, Search, Class Details, Products, and Profile.

---

## 1. Overview

Today the customer app has **no auth** — every screen resolves to the demo member `cust_ava_wright` via `CurrentCustomerProvider`'s default `memberId`. This module adds a real front door:

- **Guest mode (default).** The app **boots into guest mode** — no login required. A guest **explores** four tabs (**Home · Search · Products · Profile**; **no Bookings**), sees class + product detail, but **cannot act**: every data-writing affordance (book, join waitlist, purchase, save, cancel) is replaced by a **"Log in to …"** CTA that routes to the auth entry. Nothing personal renders (no metrics, no plan, no bookings, no saved cards).
- **Splash + onboarding.** On **first launch** the app shows a brief **Forma logo splash**, then a **3-slide onboarding carousel** ending in **"Get started"**, which drops the guest into the app.
- **Log in / Sign up.** Triggered by any gated action or the Profile **"Log in or sign up"** button: an **email entry** page. **Existing email → OTP → logged in** (returning member, full data). **New email → Sign-up form → OTP → Emergency contact → Home** (first-time member). A shared **loading screen** ("Taking you to homepage") bridges into the app.

The **auth session** (guest vs. authenticated + which `customers` id) becomes the single source every module reads. It **persists** (localStorage) so a refresh keeps the session. Everything is **self-scoped + read-only over the seed**; sign-up creates a new `customers` row via the live store (no seed edits). OTP + social sign-in are **simulated** (prototype).

---

## 2. Goals / Purpose

1. **Explore-first, gate-on-action.** Let anyone browse the studio (Home/Search/Products/Class detail/Product detail) with zero friction; only **prompt for login when an action needs customer data** (book, join, purchase, or anything personal).
2. **One coherent front door.** A single **Log in or sign up** entry that branches by email: **returning → OTP**, **new → sign-up**. No separate "login" vs "register" apps.
3. **A complete first-time journey.** New member: sign-up form → OTP → **Emergency contact** (reusing the built profile form) → **first-time Home**. Returning member: OTP → Home with their real data.
4. **One session, everywhere.** Replace the hard-coded demo member with a real **auth session** that Home, Search, Class Details, Products, Profile, Bookings, and Notifications all read — guest hides personal data + Bookings; authenticated shows the member's own data.
5. **Match the designs, reuse the shell.** Splash/onboarding/OTP/sign-up match Figma exactly; the **Emergency contact** step, the **processing loader**, and the profile bottom sheets (`DobSheet`/`OptionSheet`/`PhoneCountrySheet`) are **reused**, not rebuilt.

---

## 3. Module Structure

### 3.1 Routes / screens

| # | Screen | Route | Type | Bottom nav |
|---|---|---|---|---|
| 1 | **Splash** (Forma logo) | `/customer/welcome` (initial state) | Full-screen intro (first launch) | Hidden |
| 2 | **Onboarding carousel** (3 slides) | `/customer/welcome` | Full-screen, swipeable | Hidden |
| 3 | **Log in or sign up** (email entry) | `/customer/auth` | Full-screen (Forma-logo header) | Hidden |
| 4 | **OTP verification** (Enter OTP) | `/customer/auth/otp` | Full-screen (reused by login + sign-up) | Hidden |
| 5 | **Create account** (sign-up form) | `/customer/auth/signup` | Full-screen | Hidden |
| 6 | **Emergency contact** (sign-up step) | `/customer/auth/emergency` | Full-screen (reuses profile form) | Hidden |
| 7 | **Loading** ("Taking you to homepage") | transient (in-flow) | Full-screen loader | Hidden |
| — | **Guest Home / Search / Products / Profile** | `/customer`, `/customer/search`, `/customer/products`, `/customer/profile` | Tab screens (guest variants) | Visible (4 tabs) |

> **Full-screen rule:** screens 1–7 hide the shared bottom nav — add `/customer/welcome` + `/customer/auth` prefixes to the layout's `isFullScreen` check **and** the route-transition template's `isFullScreenRoute` (it already lists `/customer/notifications`, `/customer/profile/`, etc.).
>
> **Guest nav:** the bottom nav renders **4 tabs** (Home · Search · Products · Profile) when unauthenticated — **Bookings is hidden**. Authenticated → the full **5 tabs**.

### 3.2 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| **Auth session store** | ⬜ new `src/lib/customer/auth.ts` (localStorage, `useSyncExternalStore`) | `CurrentCustomerProvider`, every module's guest gating, the bell/plan/bookings reads |
| **Forma-logo auth header** | ⬜ new tiny `AuthHeader` (logomark + wordmark, top-left) | Log in / Sign up / OTP pages |
| **OTP input** | ⬜ new `OtpInput` (4 boxes, auto-advance) | Login + Sign-up OTP (screen 4) |
| **Social buttons** | ⬜ new `SocialAuthButtons` (Google · Facebook · Apple — simulated) | Log in / Sign up email page |
| **Processing loader** | ✅ built (the 3-dot stepped loader used by booking/checkout processing) | Screen 7 ("Taking you to homepage") — copy override |
| **Emergency contact form** | ✅ built (`src/app/customer/profile/emergency/page.tsx` — reuse its form body) | Screen 6 (sign-up step) |
| `DobSheet` / `OptionSheet` / `PhoneCountrySheet` | ✅ built (`src/components/customer/profile/*`) | Sign-up (DOB, gender) + Emergency (relation, phone country) |
| `Button` (primary green + `secondary-gray`) | ✅ DS (`src/components/ui/button.tsx`) | throughout |
| **Gated CTA** ("Log in to book / join / purchase") | ⬜ small helper — swaps the action CTA when `!isAuthenticated` + routes to `/customer/auth` | Class Details, Product Details sheet, any write CTA |
| **Guest empty-profile card** | ⬜ new — "Hi guest" + "Log in or sign up" button | Profile tab (guest) |

### 3.3 Data consumed / written (see §14)

Reads: `customers` (email lookup for login; profile data on auth). Writes (via the live store, **no seed edits**): a **new `customers` row** on sign-up (name, DOB, gender, email, phone, referral code, marketing opt-out + emergency contact) and the **auth session** (localStorage). OTP + social sign-in are **simulated** (any 4-digit code passes; social buttons toast "coming soon" or simulate).

---

## 4. Entry Points

1. **First launch (never onboarded)** → Splash → Onboarding → **Get started** → **guest Home**. Onboarding is marked seen (localStorage) and never shown again.
2. **Gated action (guest)** — any **write** affordance routes to `/customer/auth`:
   - Class Details **"Log in to book"** / **"Log in to join"** (§Guest gating).
   - Product Details sheet **"Log in to purchase"**.
   - Any future save/cancel/apply that needs customer data.
3. **Profile tab → "Log in or sign up"** button (guest profile).
4. **(Optional) a "Log in" affordance** anywhere the design later adds one — all land on `/customer/auth`.

**Exits:** successful **login** → **Home** (returning member data). Successful **sign-up** → **Emergency contact** → **Home** (first-time). **Logout** (Profile, authenticated) → clears session → **guest Home**.

---

## 5. Flows / Phases — detailed screen breakdown

### Phase 1 — Splash (Forma logo) · Figma `3669-34057`

Full-screen, shown **once** on first launch (before onboarding). A soft light-green → white **gradient** background (grain/noise texture like the other customer backgrounds), the **Forma logomark + "Forma" wordmark** centred, and **"powered by Onra"** (logomark + text, muted) pinned near the bottom. Purely presentational — **auto-advances** to the onboarding carousel after a brief beat (~1.2s) or on tap. No controls.

### Phase 2 — Onboarding carousel · Figma `3669-34085`

Full-screen, **3 swipeable slides**. Each slide (Figma structure confirmed):
- **Full-bleed image** with a **bottom dark gradient** (`rgba(28,28,28,0)` → `0.8`, `backdrop-blur` on the lower ~264px) so the copy reads over it.
- **Pagination dots** (3) — active = a **24×6 rounded bar** in `secondary/200 #c4edd6`; inactive = 6px `#e4e7ec` dots.
- **Headline** (`display-xs` 24px semibold, white) + **subtitle** (`text-md` 16px regular `#d0d5dd`).
  - **Slide 1** — "Elevate your routine" / "Discover classes that fit seamlessly into your lifestyle." (grounded from Figma)
  - **Slides 2–3** — same layout, their own image + one-line headline/subtitle (builder pulls each frame's copy from the carousel; keep the value-prop tone: discovery → booking → membership).
- **"Get started"** — primary green (`#c4edd6` bg, black text, skeuomorphic, full-width, XL, pill) at the bottom of **every** slide (so the user can start from any slide).

Swiping advances slides (dots follow); **Get started → guest Home** (marks onboarding seen). *(No "skip" in the design — Get started IS the skip-into-guest.)*

### Phase 3 — Log in or sign up (email entry) · Figma `3228-22614`

Full-screen, **AuthHeader** (Forma logomark + wordmark, top-left). Top → bottom:
- **Title** "Log in or sign up" (`display`/`text-xl`+ bold) + **subtitle** "Create an account or log in to book and manage your appointments." (`text-md` `#475467`).
- **Email** — label "Email" + a text input ("Enter email address"). Keyboard = email.
- **Continue** — primary green, **disabled until a valid email** is entered (basic format check); enabled = filled green.
- **"or"** divider.
- **Social** — **Continue with Google**, **Continue with Facebook**, **Continue with Apple** (secondary-gray, brand glyph + label). **Simulated** — for the prototype, tapping either signs the user in as a demo member (or toasts "coming soon"); recommended: simulate a **returning login** as the demo member for Google/Apple.

**Continue (email lookup)** — resolve the entered email against the `customers` store:
- **Existing** (matches a `customers.email`) → **OTP** (screen 4), mode = **login**, carrying the matched customer id.
- **New** (valid, unregistered) → **Sign up** (screen 5), **email prefilled** (read-only).
- **Invalid format / empty** → inline field error ("Enter a valid email address"); Continue stays disabled.

*(Resolution of the prompt's "else error the email doesn't exist": a well-formed **unregistered** email is treated as **new → Sign up**, not an error — sign-up is the register path. Only malformed input errors.)*

### Phase 4 — OTP verification (Enter OTP) · Figma `3228-22791`

Full-screen, AuthHeader. **Reused by login AND sign-up.**
- **Title** "Enter OTP" + subtitle "Enter the 4 digit OTP code we just sent to start using Onra."
- **`OtpInput`** — **4 large square boxes** (each shows one digit; auto-advance on type, backspace to previous; active box = brand-green border). Paste-fills all four.
- **Verify** — primary green, **disabled until all 4 digits** entered.
- **"Didn't receive the code? Resend code"** — `Resend code` is a green text link → toast "Code resent." + restarts a short cooldown (optional).

**Verify (simulated):** any 4-digit code passes (prototype). On success:
- **Login mode** → **Loading** ("Taking you to homepage") → set session authenticated as the matched customer → **Home** (returning).
- **Sign-up mode** → **Loading** → **Emergency contact** (screen 6). *(The new `customers` row is created here / on Verify.)*

### Phase 5 — Create account (sign-up form) · Figma `3228-22480`

Full-screen, AuthHeader, scrollable. **Title** "Create an account" + subtitle "Fill in your details to complete your account setup." Fields (top → bottom):
- **First name** / **Last name** — text inputs (required).
- **Date of birth** — read-only field ("Enter date of birth" + calendar icon) → opens the reused **`DobSheet`** (required).
- **Gender** — select field ("Select gender" + chevron) → reused **`OptionSheet`** (Female / Male / Prefer not to say / …) (required).
- **Email** — **prefilled + read-only** (from Phase 3), muted.
- **Phone number** — reused **`PhoneCountrySheet`** country picker (default **+971 🇦🇪**) + a number input (required).
- **Referral code (optional)** — text input ("Enter referral code"); validated against `customers.referral_code` on submit (invalid = ignored or a gentle inline note; valid = attributes the referral).
- **Checkbox — Privacy & Terms** (required): "I agree to the **Privacy Policy** and **Terms and Conditions**" (links are non-functional/toast in the prototype).
- **Checkbox — marketing opt-out** (optional): "I do not wish to receive marketing notifications with offers and news." (When checked → the new customer's marketing prefs default OFF.)
- **Create account** — primary green, **disabled until** all required fields + the Privacy/Terms checkbox are satisfied.

**Create account →** OTP (screen 4, sign-up mode). *(Or create the `customers` row now and OTP just confirms — see §15 #4.)*

### Phase 6 — Emergency contact (sign-up step) · reuse `src/app/customer/profile/emergency`

Full-screen, AuthHeader (or the reused header). **Reuses the already-built Emergency contact form body** (First name, Last name, Phone `+971` via `PhoneCountrySheet`, **Relation** via `OptionSheet` — Siblings / Parent / Spouse / Child / Friend / Other), differing only in chrome + CTA:
- **Title** "Emergency contact" + subtitle "Provide a contact person we can reach in case of an emergency."
- **Confirm** — primary green, **disabled until** first name + phone + relation are provided (match the profile form's enable rule).
- **Confirm →** write the emergency-contact fields onto the new `customers` row → **Loading** (optional) → **Home** (first-time member).

*(Reachable **only** from sign-up. In Profile it stays the standalone editable page.)*

### Phase 7 — Loading ("Taking you to homepage")

Reuse the built **processing loader** (the 3-dot bouncing indicator) with a **single centred line** "Taking you to homepage" (`text-md` brand-green). Transient (~1–1.5s), no nav/back. Bridges: login-OTP → Home, and (optionally) emergency → Home. Purely presentational over the synchronous session write.

### Phase 8 — First-time / returning Home (post-auth)

- **Returning login** → the standard **authenticated Home** with the member's real data (metrics, upcoming bookings, plan, etc.).
- **First-time sign-up** → the **first-time authenticated Home**: metrics render (all **zero/empty** — 0 upcoming, 0 credits), "What's on", instructors, categories — a clean, logged-in-but-empty state (empty-state copy where a section has no data). The customer is now authenticated (full 5-tab nav; Bookings shows the empty "No upcoming bookings").

---

## 6. Guest mode — states & gating (mandatory)

Guest = **not authenticated** (`auth.status !== "authenticated"`, `member = null`). The four explorable tabs adapt:

| Surface | Guest behaviour |
|---|---|
| **Bottom nav** | **4 tabs** only — Home · Search · Products · Profile. **Bookings hidden.** |
| **Home** | **No overview metrics** (the personal KPI row is omitted). The page **starts from "What's on"** → Instructor → Categories. The bell + studio chip still show; the bell (if shown) opens nothing personal (or is hidden for guests). |
| **Search (Classes + Appointments)** | Fully browsable — date strip, filters, class + appointment cards all work. Card CTAs still open **Class/Appointment Details** (read-only). |
| **Class Details** | Fully visible. The sticky action zone changes: **Available →** `Log in to book`; **Waitlist →** `Log in to join`. Tapping → `/customer/auth`. The "N credits left" coverage line is **hidden** (no plan). |
| **Products** | Catalog + the **Product Details bottom sheet** fully visible. The sheet's CTA becomes **`Log in to purchase`** (memberships, packages, gift cards → all show "Log in to purchase"; the `+` add-to-cart on list rows is likewise gated). Tapping → `/customer/auth`. No **Active plan** card. |
| **Profile** | **Empty guest state:** a profile card reading **"Hi guest"** (generic avatar), then a card **"Hey there! Log in or sign up to access your profile, bookings, and memberships."** + a single primary **"Log in or sign up"** button → `/customer/auth`. **No menu items** (no plan/gift-card/referral/settings rows), **no logout**. |
| **Bookings** | **Not reachable** (tab hidden; direct nav to `/customer/bookings` → redirect to `/customer/auth` or Home). |
| **Any write action** | Booking, join, purchase, save card, cancel, apply promo, redeem, freeze, add credit, share-referral → all replaced by a **"Log in …"** CTA or intercepted → `/customer/auth`. |

**Rule:** a guest can **read** everything public (studio, classes, services, products, instructors) but **write** nothing. Every write CTA is either relabelled **"Log in to …"** or intercepted before it mutates.

---

## 7. Navigation paths (map)

```
First launch ─► /customer/welcome  (Splash logo ─auto─► Onboarding carousel)
                     └─ Get started ─► guest Home  (onboarding marked seen)

Guest (Home/Search/Products/Class detail/Product sheet)
     └─ gated action / Profile "Log in or sign up" ─► /customer/auth  (email)
              │
              ├─ existing email ─► /customer/auth/otp (login) ─► Loading ─► Home (returning)
              │
              └─ new email ─► /customer/auth/signup ─► /customer/auth/otp (signup)
                                   ─► Loading ─► /customer/auth/emergency ─► Home (first-time)

Authenticated Profile ─ Logout ─► clears session ─► guest Home
```

---

## 8. Auth session / state model

A new **`src/lib/customer/auth.ts`** — a `localStorage`-backed, `useSyncExternalStore` session (same pattern as the appointment-bookings / notifications feeds):

```ts
type AuthStatus = "guest" | "authenticated";
interface AuthSession {
  status: AuthStatus;
  customerId: string | null;   // FK → customers.id when authenticated
  onboardedAt?: string;        // set once "Get started" is tapped (skip splash next time)
}
```

- **Default:** `{ status: "guest", customerId: null }` (first ever load → also show splash/onboarding until `onboardedAt` set).
- **`login(customerId)`** → `{ status: "authenticated", customerId }`.
- **`signup(newCustomer)`** → create the `customers` row (store) → `login(newId)`.
- **`logout()`** → back to `guest` (keeps `onboardedAt` so onboarding isn't re-shown).
- **Persisted** (its own key, e.g. `onra-customer-auth`) so refresh keeps the session; **excluded from `onra-demo-state`** (it's per-device auth, not business data). Version-guard to reset.

**Integration (foundational):** `CurrentCustomerProvider` stops defaulting `memberId` to `DEMO_MEMBER_ID` — instead it reads `auth.customerId` (guest → `null` → `member = null`). Every module already reads `member`; guest simply gets `null` and renders its guest variant. `DEMO_MEMBER_ID` remains only as the **seed login target** for the demo (entering Ava's email logs in as her).

---

## 9. Conditional rendering rules (summary)

- **Splash/onboarding** render only on **first launch** (`!onboardedAt`); after Get started, never again.
- **Bottom nav** = 4 tabs (guest) / 5 tabs (auth). Bookings tab present iff authenticated.
- **Home metrics** render iff authenticated; guest Home starts at "What's on".
- **Class action zone**: `Book/Join` (auth) ↔ `Log in to book / join` (guest).
- **Product sheet CTA**: `Add to cart` / `Log in to purchase`.
- **Profile**: full menu + data (auth) ↔ "Hi guest" + "Log in or sign up" (guest).
- **Continue** (email) disabled until valid email; **Verify** disabled until 4 digits; **Create account** disabled until required + Privacy/Terms; **Confirm** (emergency) disabled until required.
- **Sign-up email** field is read-only (prefilled from Phase 3).
- **Marketing opt-out** checkbox → new customer's marketing prefs default OFF when checked.
- **First-time Home** shows empty-state copy where a section has no data (0 bookings, 0 credits).

---

## 10. Empty / loading states

| Surface | State |
|---|---|
| Splash | Brief logo hold (auto-advance) — no spinner. |
| OTP resend | "Code resent." toast; optional cooldown on `Resend code`. |
| Login/Sign-up submit | The **processing loader** ("Taking you to homepage"). |
| First-time Home | Metrics render as **0/empty**; each data section shows its own empty copy ("No upcoming bookings", etc.). |
| Guest Profile | The "Hi guest" empty state (not a spinner). |
| Guest Bookings (direct nav) | Redirect to `/customer/auth` (never a broken empty tab). |

---

## 11. Edge cases

| Edge case | Behavior |
|---|---|
| **Already onboarded, guest** | Skip splash/onboarding on launch → straight to guest Home. |
| **Already authenticated on launch** | Session hydrates → straight to authenticated Home (no splash). |
| **Invalid / empty email** | Inline error; Continue disabled. |
| **Existing email** | → OTP (login) as that customer. |
| **New (unregistered) email** | → Sign up (prefilled email) — not an error. |
| **Wrong OTP** (prototype) | Any 4 digits pass; if you want a failure demo, a specific reserved code can show "Incorrect code" — otherwise always succeeds. |
| **Referral code invalid** | Ignored (or gentle inline note); does not block sign-up. |
| **Privacy/Terms unchecked** | Create account stays disabled. |
| **Back from OTP** | Returns to email (login) or sign-up (signup); session unchanged (still guest). |
| **Guest taps a gated action** | Relabelled "Log in to …" CTA → `/customer/auth`; no mutation occurs. |
| **Guest deep-links `/customer/bookings`** | Redirect → `/customer/auth` (or Home). |
| **Logout** | Session → guest; nav drops to 4 tabs; personal data disappears; onboarding not re-shown. |
| **Social sign-in** | Simulated (logs in as the demo member or toasts "coming soon"); never a real OAuth. |
| **Refresh mid-flow** | Guest stays guest; a half-filled sign-up form resets (flow state is per-session, not persisted). |

---

## 12. Cross-module integration (how auth gates the built app)

| Module | Guest change | Authenticated |
|---|---|---|
| **Layout / bottom nav** | 4 tabs (hide Bookings); add `/customer/welcome` + `/customer/auth` to `isFullScreen` | 5 tabs |
| **`CurrentCustomerProvider`** | `member = null` (reads `auth.customerId`) | resolves the member row |
| **Home** | hide metrics; start at "What's on" | full metrics |
| **Search / Class Details** | browse only; `Log in to book / join`; hide credits line | Book / Join |
| **Products / Product sheet** | `Log in to purchase`; hide Active plan | Add to cart / purchase |
| **Profile** | "Hi guest" + Log in or sign up; no menu/logout | full profile + Logout |
| **Bookings / Notifications** | hidden / redirect | shown |

All of this reads the **single** `auth` session — no module keeps its own login flag.

---

## 13. Notifications & toasts

- **Toasts** (`showToast`): **Login success** → "Welcome back!" · **Sign-up success** → "Account created — welcome to Forma." · **OTP resent** → "Code resent." · **Logout** → "You've been logged out." · **Invalid email** → inline (no toast). · Social "coming soon" → toast if not simulated.
- **No** notifications are written here (the Notifications feed belongs to bookings/payments); a first-time member simply starts with an **empty** feed. (Optionally a "Welcome to Forma" notification could seed the feed — out of scope unless requested.)

---

## 14. Data model

| Table / store | Used for |
|---|---|
| `customers` | **Email lookup** (login: match `email`); **referral code** validation (`referral_code`); **new row on sign-up** (first/last name, DOB, gender, email, phone, referral, marketing prefs, emergency contact). Self only. |
| **`auth` session** (new, localStorage) | `status` + `customerId` + `onboardedAt` — the app-wide login state. |
| **notification-prefs / marketing** | New customer's marketing opt-out sets default channel/marketing prefs OFF. |

FKs by id; the authenticated member's profile/plan/bookings resolve from the store exactly as they do today for `cust_ava_wright`.

---

## 15. Resolved decisions & data grounding

1. **Guest is the default; the app never force-logs-in.** Boot = guest; onboarding once; login is on-demand (gated action or Profile button). `CurrentCustomerProvider` reads the `auth` session instead of hard-coding `DEMO_MEMBER_ID`.
2. **Email branch (grounded):** Continue looks the email up in `customers`. **Match → OTP (login)** as that customer; **no match (valid) → Sign up** (prefilled). Malformed → inline error. For the demo, entering a **seeded customer's email** (e.g. Ava's) logs in as them with full data.
3. **OTP + social are simulated.** Any 4-digit code verifies; Google/Facebook/Apple simulate a login (or toast). No real backend.
4. **Sign-up creates a real `customers` row (store, not seed).** Persist via the live store (`addCustomer` or equivalent) so the new member has profile/bookings/plan surfaces that work; first-time = empty data. The emergency-contact step writes onto that same row.
5. **Reuse, don't rebuild:** the **Emergency contact** form (profile), the **processing loader** (booking/checkout), and the `DobSheet` / `OptionSheet` / `PhoneCountrySheet` bottom sheets are reused verbatim; only chrome + CTA differ.
6. **Bookings is auth-only.** Guest nav hides Bookings; direct nav redirects to `/customer/auth`. (Guest has "4 modules": Home, Search, Products, Profile.)
7. **Onboarding copy:** slide 1 is grounded from Figma ("Elevate your routine" / "Discover classes…"); slides 2–3 keep the same layout with their own image + one-liner (builder pulls each frame). "Get started" appears on every slide and enters guest mode.
8. **Loading copy = "Taking you to homepage"** (the built loader with a copy override), matching the Figma loading frame.

---

## 16. Rules footer

1. **Reuse, don't reinvent.** Emergency contact form, processing loader, `DobSheet`/`OptionSheet`/`PhoneCountrySheet`, DS `Button`/`Input`. Build only the new: `auth` store, `AuthHeader`, `OtpInput`, social buttons, guest empty-profile, the gated-CTA helper.
2. **Mobile-only, full-screen auth hides the bottom nav** (add `/customer/welcome` + `/customer/auth` to `isFullScreen` **and** the transition template). 375px / `max-w-[500px]`, no phone frame, ≥44px tap targets, `@untitledui/icons` only, AED currency.
3. **Explore-first, gate-on-action.** Guests read everything public; every write CTA is "Log in …" and routes to `/customer/auth`. No personal data (metrics, plan, bookings, cards) renders for guests.
4. **One session, read everywhere.** A single `auth` store; `CurrentCustomerProvider` derives `member` from it; no module keeps its own login flag.
5. **Simulated auth.** OTP + social are prototype simulations; sign-up writes a real `customers` row via the store — **never a seed edit**.
6. **Match the designs** — Splash `3669-34057`, Onboarding `3669-34085`, Log in/sign up `3228-22614`, OTP `3228-22791`, Sign up `3228-22480`; Emergency reuses the profile form; Loading reuses the loader with "Taking you to homepage".
7. **Every mutating action emits a toast**; auth success/logout toasts fire from here.
