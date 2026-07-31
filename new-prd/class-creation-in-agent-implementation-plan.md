# Class creation in the AI Agent — implementation plan

> **Status:** Phase 0 (this doc). No code written yet.
> **Source:** [`new-prd/class-creation-in-agent-.md`](./class-creation-in-agent-.md) — 36 Figma frames.
> **Figma file:** `ufz59sDQtSDoiWFV9G2CaO` (Onra — Studio Dashboard, Design Enhancement)

---

## 1. What this actually is

The 36 frames are **states of a 3-step guided wizard**, not 36 screens. The wizard
runs **inside General chat** — the admin types "Create a class schedule" and the
AI switches into wizard mode. Same chat surface, same composer; the wizard drives
what appears above it.

Three surfaces cooperate on every turn:

| Surface | Role |
|---|---|
| **AI chat bubble** | Step announcement — a `N of 3 step` badge + heading + one-line intro |
| **Live preview card** | Persistent, in-thread. Fills in as answers land; unanswered fields read `Awaiting your answer` in amber |
| **Question panel** | Floats above the composer. One question at a time, with its own pager (`2 of 5`) |

The user's answers echo back as a green `Q: … / A: …` bubble — the pattern the
migration wizard already uses.

---

## 2. Verified flow

The step numbering in the source doc is a frame ORDER, not a flow order. Verified
arc from the frames:

### Step 1 — Class details (`1 of 3 step`)
| # | Question | Widget |
|---|---|---|
| 1.1 | Which class template do you want to use? | Rich card list — thumbnail, name, description, attribute chips (category · type · duration · capacity). First row is **Create from scratch** |
| 1.2 | Who can book this class? | Numbered radio — All gender / Female only / Male only |

→ **Class preview** card renders, partially filled.

### Step 2 — Location & instructor (`2 of 3 steps`) — **5 questions**
| # | Question | Widget | Pager |
|---|---|---|---|
| 2.1 | Which room should it use? | Grouped list by branch. Per-room capacity, `Over capacity` amber badge, `Used by other class` disabled rows, `+ Add room` per branch | 1 of 5 |
| 2.2 | What equipment will be used? | Checkbox multi-select, options **AI-suggested from the picked template**, + `Something else` free-text (comma-separated). Joins to one comma-separated string — see §7 | 2 of 5 |
| 2.3 | Would you like to activate spots selection? | Yes / No with check + X icons | 3 of 5 |
| 2.3b | *(if yes)* Spot layout | Standard / Custom → **Customize area** editor: instructor block, spot grid (A1–A4 / B1–B4), column + row number inputs, click-to-block spots, `Use default` / `Customize spot` | — |
| 2.4 | Who's teaching it? | Searchable list — avatar, name, rating | 4 of 5 |
| **2.5** | **Which pay rate should apply to this instructor for this class?** | Numbered list — `Standard` / `Class Tiers` / `Split Rate` / `Senior Rate` / `Monthly Rate` | **5 of 5** |

**2.5 was missed in the first pass** (frame 382-124222). Sources from the
`payRates` slice, filtered to rates assigned to the chosen instructor
(`staffPayRateAssignments`). This is what makes the created class payroll-correct
— without it, commission/payroll can't attribute the session.

### Step 3 — Date & time (`3 of 3 steps`)

Question 3.1 branches. **Both branches are fully specified in Figma.**

| # | Question | Widget | Frame |
|---|---|---|---|
| 3.1 | Does this class repeat? | `Does not repeat (single class)` / recurring | 387-124675 |

**Branch A — single class** (pager `N of 3`)
| # | Question | Widget | Frame |
|---|---|---|---|
| A.2 | When is the session? | Date list + `Pick a custom date` + Next | 387-124675 |
| A.3 | When does the class start? | Time picker | 387-129597 |

**Branch B — recurring** — much bigger than the single path. **Most of the frame
set (22–35) is this branch**, not private/recovery as first assumed.

| # | Question | Widget | Frame |
|---|---|---|---|
| B.2 | When should the recurring schedule start? | Date list, first row badged `Tomorrow`, + `Pick a custom date` | 387-135510 |
| B.3 | How should this recurring schedule end? | `Never` / `On` / `After` | 389-136165 |
| B.3a | *(if `On`)* When should this recurring schedule end? | Date list + custom date | 391-137469, 391-141688, **391-156601**, 391-157016 |
| B.3b | *(if `After`)* After how many occurrences? | Count | 394-184280, 394-174501, 394-174707, **394-171364**, **394-171779** |
| B.3c | *(if `Never`)* — | goes straight to B.4 | 389-136815, **391-138124**, 391-143357 |
| B.4 | Repeat every X week? | `1 week` (badged `Default`) / 2 / 3 / 4 + `Custom X` free-text | 389-136815 |
| B.5 | **Select days + per-day time slots** | See below | **391-157099**, 391-148046 |

Bold frames are **NOT in the original 36-item list** — the real set is ~40.

#### B.3b — `After` occurrence count
Preset list + `Custom` free-text row, same shape as every other question
(394-184280).

#### B.5 — Select days (391-157099)
> **Select days** — *Pick the days, then set a start time for each one. You can
> add multiple slots per day.*

- **Day pills**: `Mon Tue Wed Thu Fri Sat Sun` — **multi-select**, selected pill
  goes mint/green.
- **General schedule** section below. One card per SELECTED day:
  - Header: day name + *"Set schedule for this day."*
  - `Start time` / `End time` **dropdowns** + a delete (trash) button per slot
  - `+ Add time slot` — multiple slots per day
- `Confirm` button, bottom-right. User's echo reads `Days confirmed`.

**This is the admin schedule form's recurrence editor.** Client: *"the logic is
same like the admin side."* Reuse its day-select + time-slot components and its
expansion logic rather than rebuilding.

### Preview gains a session list when recurring (401-161117)
Once a recurrence is defined the preview card grows an expandable row:

> **Preview of scheduled classes** — Review all upcoming scheduled dates and time
> slots. · `11 classes` ⌄

Expanded, it is **read-only** and grouped by month:
- Month heading (`February 2025`, `March 2025`)
- Each date = a circular badge with the day number
- Under each date, mint time-slot chips (`09:00 – 10:00 AM`, `03:30 – 04:30 PM`)
- A date with two slots shows two chips

Same presentation as the admin form's schedule preview — reuse it.

### Publish
1. Preview card fully populated
2. `Are you ready to publish this schedule?` → **Publish schedule** \| **Edit a field** (chevron → field submenu)
3. Loading: *"Validating your class schedule data. Moving to the next step…"* + sparkle
4. Success: *"Your class schedule has been published."* + check icon

**Edit-a-field is FREE TEXT, not a submenu** (frame 391-140961). Choosing it
replies:

> *"Sure! tell me what to change below (e.g. "make it 45 minutes") and I'll update
> just that field."*

The admin then types a natural-language correction into the normal composer and
the AI patches **that one field**, then returns to the publish prompt. This is an
LLM comprehension step, not a picker — no field list is ever rendered.

---

## 3. Private sessions + Recovery

**There are NO Figma frames for these.** Every frame in the set is the class
flow — confirmed by the source doc's own opening note ("SO FAR WE ONLY HAVE FOR
THE CLASS SCHEDULE THE NORMAL ONE, BUT WE CAN REUSE IT FOR THE PRIVATE AND
RECOVERY"). We reuse the class wizard verbatim and swap the data source.

Reuse the class wizard's COMPONENTS, but the LOGIC follows the existing
private/recovery creation path. Client: *"the logic is same like when we create
the private/recovery — you must see the recovery and private creation module."*

### `Appointment` field audit (done — was previously unaudited)
32 fields. Materially different from `ClassSchedule` in four ways:

| Difference | Detail |
|---|---|
| **Creation action** | `addCustomerAppointment` (`store.ts:6355`) — appointments are created **customer-first**, not schedule-first. A class exists with `booked: 0`; an appointment is born from a booking |
| **Service, not template** | `serviceId` · `serviceName` · `serviceCategory` replace `templateId` / `name` / `category` |
| **`openSession: boolean`** | Recovery-only concept — a multi-customer recovery session. No `ClassSchedule` equivalent |
| **Branch is denormalised** | Carries `branchName` as well as `branchId` (class carries `location`) |

Fields `ClassSchedule` has that `Appointment` does NOT — these questions must be
**skipped** on the private/recovery path:
`equipment` · `spotSelectionEnabled` · `spotLayout` · `waitlistEnabled` ·
`genderAccess` · `applicableMembershipIds` · `applicablePackageIds` ·
`recurrenceGroupId`

**Consequence:** Step 2 drops from 5 questions to 3 (room · instructor · pay
rate) and Step 3 has no recurring branch. The wizard is genuinely shorter, not
just re-sourced.

| | Class | Private | Recovery |
|---|---|---|---|
| Step 1.1 source | `classTemplates` | `services` (`type: "private"`) | `services` (`type: "recovery"`) |
| Capacity | template capacity | 1 | service capacity / `openSession` |
| Step 2 questions | 5 | 3 | 3 |
| Equipment / spots / gender | asked | **skipped** | **skipped** |
| Recurring | yes | **no** | **no** |
| Terminal write | `addClassSchedules` | `addCustomerAppointment` | `addCustomerAppointment` |

**Open for Phase 8:** `addCustomerAppointment` requires a customer. The wizard
creates a *slot*, not a booking. Either an "open" appointment row is needed, or
the wizard must also ask which customer it's for — read `ServiceDetailPage` +
`AppointmentDetailPage` at the start of Phase 8 to see how the admin does it.

---

## 4. What we reuse vs build

### Reuse as-is
| Asset | Why it fits |
|---|---|
| `AiQuestionPrompt` | Already has the header, the `1 of N` pager with chevrons, and `compact` mode that floats above the composer and auto-advances on click. **This IS the Figma widget.** |
| Migration wizard architecture | Mode-scoped tools + typed cards + a card renderer + a client-side applier. Exact precedent — mirror it. |
| `Q: / A:` echo bubble | Already built for the migration flow |
| `ScheduleFormPage` validation | Owns instructor↔category gating, room↔branch resolution, recurrence expansion. **Extract, don't reimplement.** |
| `addClassSchedules` / `addAppointment` | Terminal write actions already exist |

### Extend
| Asset | Change |
|---|---|
| `AiQuestionOption` | Add optional `thumbnailUrl`, `attributes[]`, `avatarUrl`, `rating`, `badge`, `disabled`, `groupLabel` |
| `AiQuestionSpec` | Add `kind: "radio" \| "checkbox" \| "grouped" \| "searchable"` + `searchPlaceholder` |

### Build new
| Component | Notes |
|---|---|
| `SchedulePreviewCard` | Live 2-col field grid, amber `Awaiting your answer` placeholders |
| `SpotLayoutEditor` | The heaviest new piece — grid canvas, row/col inputs, click-to-block. Check whether `/schedule/new/customize-spot` can be reused |
| `schedule-tools.ts` | Zod-validated tool surface, mirrors `migration-tools.ts` |
| `schedule-cards.ts` | Typed card contracts |
| `schedule-wizard.ts` | The state machine — step/question order, edit-field jumps, validation gates |
| Validating-loader | Sparkle + copy between steps |

---

## 5. Phases

Each phase ends green (tsc + build) and independently demoable.

### Phase 1 — Widget foundation
Extend `AiQuestionPrompt` with the four question kinds and the richer option
shape. Ship a storybook-ish demo page. **No agent wiring.**
*Exit:* every Figma question widget renders with mock data.

### Phase 2 — Preview card
`SchedulePreviewCard` with all 10 fields + amber awaiting states. Driven by a
plain props object.
*Exit:* matches frames 4 / 14 / 16 at every fill level.

### Phase 3 — Wizard state machine (headless)
`schedule-wizard.ts` — step order, question order, conditional branches, and the
**sub-flow stack** (push a nested flow, return to the parent with a result).
That stack serves BOTH `Edit a field` and `+ Add room`, so it's designed once
here. Recurring branch included. Pure + unit-testable, no UI.
*Exit:* a scripted answer sequence produces a valid `ClassSchedule` draft, for
both single and recurring.

### Phase 4 — Agent wiring, single class only
`schedule-tools.ts` + `schedule-cards.ts` + intent detection in General chat.
Renders Phase 1–2 components from Phase 3 state. Single-class path only —
recurring is asked but routed to a stub.
*Exit:* "Create a class schedule" → full single-class flow → real row in
`/admin/schedule`.

### Phase 5 — Spot layout editor
`SpotLayoutEditor` + the Standard/Custom branch.
*Exit:* frames 9–11 work; layout persists onto the schedule.

### Phase 5b — Create-room sub-flow
The `+ Add room` nested question flow, using the sub-flow stack from Phase 3.
Fields mirror Settings → Business & locations.
*Exit:* admin creates a room mid-wizard and it's auto-selected on return.

### Phase 6 — Recurring branch
Questions B.2–B.4 (start date, end rule, repeat interval) + recurrence expansion
into multiple `ClassSchedule` rows. Reuses the admin form's expansion logic.
*Exit:* frames 387-135510 / 389-136165 / 389-136815 work; a recurring series
creates the right number of rows.

### Phase 7 — Publish, edit-field loop, loaders
Publish confirmation, edit-a-field submenu + return (uses the Phase 3 stack),
validating loader, success state.
*Exit:* frames 16–19 work end to end.

### Phase 8 — Private sessions + Recovery
Swap the step-1.1 source to `services`, skip spot selection, write appointments.
*Exit:* all three types create correctly.

### Phase 9 — Polish + audit
Cross-check every frame, edge cases (no templates, no rooms, no instructors,
over-capacity), RBAC, mobile.

---

## 6. Decisions (client, 2026-07-31)

### `+ Add room` → a NESTED question sub-flow
Not a modal, and not a deep-link. It opens **its own guided question flow in the
same panel**, exactly like the class wizard itself — the admin answers a short
series of questions and the room is created without leaving the chat.

Fields come from the real create-room form in **Settings → Business & locations**
(read that form and mirror its required fields — at minimum: name, branch,
capacity; confirm the full list during Phase 5b).

Mechanically this means the wizard state machine must support **pushing a
sub-flow onto a stack and returning to the parent question with the new room
pre-selected**. Same requirement the `Edit a field` loop has, so both share one
mechanism.

### `Used by other class` → HARD BLOCK
Rows render disabled and are not selectable. Matches the Figma and the admin
schedule form's own double-booking prevention.

### Over-capacity → AUTO-TRIM + tell them
Picking a 6-max room for an 8-capacity template sets capacity to 6 automatically,
and the AI's next message states it plainly ("Capacity trimmed to 6 to fit
Reformer Studio"). No extra question.

### Recurring → FULLY SPECIFIED, build it
See Step 3 Branch B. All three end-rule branches (`Never` / `On` / `After`) have
their own frames, plus a per-day time-slot editor and a session-list preview.

### Instructor ratings → REAL aggregate
Compute average score + review count per instructor from the live `class_ratings`
slice. Instructors with no ratings render without stars rather than a fake 5.0.

### Custom date → INLINE calendar, and BACK must work
The panel swaps its option list for a calendar. **Critical:** the panel's
top-right `‹ N of M ›` pager must let the admin go BACK out of the calendar to
re-pick a listed option. Back/next navigation is a first-class requirement of the
question panel, not just a decoration — it applies to every question, not only the
calendar.

### Create-room sub-flow → MIRROR Settings exactly
Ask for every field the real create-room form in Settings → Business & locations
requires, so a room made here is indistinguishable from one made there. No
half-configured rooms.

---

## 6b. Data-contract audit — wizard answers → `ClassSchedule`

`ClassSchedule` has 38 fields. Mapping what the wizard actually produces:

### Derived from the picked TEMPLATE (no question needed)
`templateId` · `name` · `description` · `category` · `type` · `classType` ·
`capacity` · `coverColor` · `coverImage` · `applicableMembershipIds` ·
`applicablePackageIds`

### Answered by a wizard question
| Field | Question |
|---|---|
| `genderAccess` | 1.2 Who can book this class? |
| `roomId` · `room` · `branchId` · `location` | 2.1 Which room? |
| `equipment` | 2.2 What equipment? |
| `spotSelectionEnabled` · `spotLayout` | 2.3 / 2.3b |
| `instructorId` · `instructorName` · `instructorInitials` · `instructorColor` | 2.4 Who's teaching? |
| `date` · `dateISO` · `dayOfWeek` · `startTime` · `endTime` · `displayTime` | Step 3 |
| `recurrenceGroupId` | Step 3 recurring branch |

### Defaulted, never asked — MUST be set explicitly
| Field | Value | Source of truth |
|---|---|---|
| `booked` | `0` | new class |
| `rating` · `ratingCount` | `0` | new class |
| `status` | `Upcoming` (derive vs today, like the seed adapter) | |
| **`waitlistEnabled`** | **`true`** | `ScheduleFormPage:2083` hard-codes `true`. Match it — do NOT leave undefined |
| `flexible` | omit | optional |

**Gap closed:** `waitlistEnabled` is never asked in any frame. The admin form
always sets `true`. The wizard must do the same or waitlist behaviour silently
diverges between the two creation paths.

---

## 6c. Cross-module sync — what a created class must trigger

`addClassSchedules` already fans out; the wizard gets this free **only if it
calls that action** rather than writing to the slice directly.

| Downstream | Behaviour |
|---|---|
| **Instructor notification** | `addClassSchedules` groups by instructor and sends ONE summary notification per instructor, not N. Recurring series depends on this — do not call the action once per generated row |
| Admin schedule grid | Subscribes to `classSchedules`; appears same render |
| Instructor `/my-schedule` | Same slice, branch + instructor scoped |
| Customer app class list | Same slice, gated on `status` + `genderAccess` |
| Dashboard "Classes today" | Derived count |
| Reports (class attendance / utilization) | Derived from `classSchedules` + `classBookings` |
| Room availability | The "used by other class" gate reads the same slice — a created class must immediately block that room for that slot |

**Rule for Phase 4:** the wizard's terminal write is `addClassSchedules(rows[])`
— ONE call with the whole array. Never a loop.

---

## 6d. "Create from scratch" — mirrors the admin form

**Resolved** (client 2026-07-31): *"the logic is same like when we create it from
scratch in admin side class schedule creation."* Read `ScheduleFormPage` and
mirror it — no new design needed.

### What the admin form does on the scratch path
`ScheduleFormPage:2243` sets `isScratch = templateId === SCRATCH_TEMPLATE_ID`,
which changes the flow in three ways:

**1. Four core fields become required** (`:2257` — `canProceedDetails`)
```
isScratch → name.trim() && category && duration > 0 && capacity > 0
```
So the wizard's Step 1 gains **four extra questions** on this path only:

| Field | Widget |
|---|---|
| Class name | free text |
| Category | class-category picker — reuse the same list + the `+ Create class category` inline flow already shipped |
| Duration | preset minutes list + custom |
| Capacity | number |

**2. An extra step is inserted** (`:2246`)
```
if (isScratch || isEditing) out.push("applicable")
```
→ **Applicable memberships & packages** slots in right after Class details.
Not required — an empty list is a meaningful "no plans" state
(`canProceedApplicable = true`), so the question is skippable.

**3. Template-derived fields are persisted differently** (`:2042`–`:2055`)
```
persistedTemplateId  = isScratch ? "" : templateId
persistedMemberships = isScratch ? <admin's picks> : <template's>
persistedPackages    = isScratch ? <admin's picks> : <template's>
```
`templateId` is stored as an **empty string**, not the scratch sentinel. The
sentinel is UI-only and must never reach the store.

### Net effect on the wizard
| | Template path | Scratch path |
|---|---|---|
| Step 1 questions | 2 (template, gender) | **6** (name, category, duration, capacity, gender, + applicable plans) |
| `templateId` written | real id | `""` |
| Applicable plans | inherited from template | asked, skippable |
| Steps 2 + 3 | identical | identical |

**Phase 4 ships BOTH paths.** No longer blocked, and the scratch row stays
visible in the template picker.

---

## 7. Verification status — read before starting

Being precise about what is **verified in code** vs **inferred from pattern**, so
nobody treats an inference as fact mid-build.

### Verified against code
- All 38 `ClassSchedule` fields + which wizard answer supplies each
- `spotLayout` shape → `{ cols: number; rows: number; blockedSpots: string[] }`
- `waitlistEnabled` → admin hard-codes `true` (`ScheduleFormPage:2083`)
- Scratch path → `isScratch` gate, inserted `applicable` step, `templateId: ""`
- `addClassSchedules` groups by instructor → one summary notification, not N
- `AiQuestionPrompt` already has header + `1 of N` pager + compact mode

### Read in Figma — ALL frames now read (2026-07-31)
Every frame in the source doc has been opened, plus the four that were never in
the numbered list (`391-138124`, `391-156601`, `394-171364`, `394-171779`).
No frame remains inferred.

**The first reading was wrong once** — frames 22–35 were mapped as
private/recovery and are actually the recurrence branches. Corrected.

Findings from the final sweep that were not in the earlier reading:

| Frame | Finding |
|---|---|
| `382-124222` (9) | **Pay rate question exists** — *"Which pay rate should apply to this instructor for this class?"* → `Standard` / `Class Tiers` / `Split Rate` / `Senior Rate` / `Monthly Rate`, pager **5 of 5**. This is why Step 2 has 5 questions, not 4. |
| `391-140961` (18) | Edit-a-field is **FREE TEXT**, not a submenu: *"Sure! tell me what to change below (e.g. \"make it 45 minutes\") and I'll update just that field."* |
| `387-131806` (15) | Single-class preview — **no** `Preview of scheduled classes` row. That row is recurring-only. |
| `391-143357` (22), `394-171779` | `Select days` panel is **identical** in the `Never` and `After` branches — same component, no branch-specific variant. |
| `391-158338` (28), `394-172822` (33), `394-173101` (34) | Recurring preview is the single-class preview **plus** one expandable row: `Preview of scheduled classes` / *"Review all upcoming scheduled dates and time slots."* / `11 classes` pill / chevron. |
| `394-171364` | Spot layout panel = `Column number` + `Row number` steppers with `Use default` / `Customize spot`; picking `Use default` posts the bubble **"Use as default"**. Step 3 opens with a `3 of 3 steps` badge and *"Last step! Set when this class runs, a single class session or a recurring class."* |
| `394-171779` | Confirms the `After` branch Q order: repeat? → start date → end rule → **after how many sessions** → repeat every X week → select days. |

Select-days panel spec (confirmed on both branches): 7 day chips, multi-select,
selected chip = green outline + tint. Each selected day renders its own card
(`Friday` / *"Set schedule for this day."*) with a `Start time` + `End time`
select pair, a trash button per row, and `+ Add time slot`. A bottom-right
`Confirm` stays disabled until every selected day has at least one complete
slot. Confirming posts the bubble **"Days confirmed"**.

### RESOLVED — equipment
`ClassSchedule.equipment` stays a **plain comma-separated string** — same as the
admin form (`ScheduleFormPage:1291`, free text). No schema change, no new slice,
no seed.

The wizard's option list is **AI-suggested and personalised to the class**: the
model proposes equipment from the picked template's name / category /
description (a Reformer Pilates class suggests different kit than a Barre class).
The Figma's four options are one such example, not a fixed list.

Rules:
- Options are **multi-select** checkboxes.
- A `Something else` option opens free-text entry. Custom entries are
  **comma-separated**, exactly like the admin field.
- On submit the selections join to one comma-separated string
  (`"Mat, resistance bands"`, matching the preview) before hitting
  `ClassSchedule.equipment`.
- Round-trips cleanly: a class created in the wizard opens in the admin form as
  ordinary text, and a class created in admin previews correctly in the agent.

### RESOLVED — RBAC
Full spec: **[`docs/ai-agent-rbac.md`](../docs/ai-agent-rbac.md)** — written for
the implementing developer.

Summary: the agent has two existing gates (`AI_AGENT_UI_VISIBLE`,
`isAiAgentEnabled(role)`), and both are persona-level (`admin` yes, instructor
and customer no). Neither distinguishes the five studio roles, which was fine
while the agent was read-only and stops being fine now that it writes.

Governing rule: **the agent may never exceed the sidebar.** An action is allowed
iff the same user could do it through admin. Schedule creation therefore gates on
`manage_schedule` — the same key `Sidebar.tsx:65`/`:108` uses. Enforcement is at
tool registration in `/api/ai-agent/route.ts` (an unregistered tool can't be
prompt-coaxed into firing); prompt and client render are UX layers on top.
Missing permissions **degrade** the flow (hide `+ Add room`, skip the pay-rate
question and use the instructor's default rate) rather than dead-ending it. A
user with no `manage_schedule` is declined up front, never mid-wizard.

### RESOLVED — intent detection lives in General chat
Not a 4th chat type. In **General chat only**, the user can say *"create a class
schedule"* / *"book a private session"* / *"schedule a recovery session"* and the
wizard runs **inline in that same thread** — the question panels render as
ordinary assistant messages in the general conversation.

Implications:
- Schedule tools merge into `insightTools`, the General-chat tool set.
- Migration and Setup modes are untouched — they keep their own scoped tools and
  do **not** get schedule creation.
- The detected intent (class / private / recovery) selects the data source and
  the Step-2 question set; the wizard shell is the same component either way.
- Risk to watch: tool-count and prompt length on an already-large insight tool
  set. Measure at the start of Phase 4. Escape hatch if general chat degrades:
  keep the surface in General chat but lazy-register the schedule tools once the
  intent is detected, rather than on every request.

### Appointment contract — audited (see §3)
Private + recovery write `Appointment`, not `ClassSchedule`. The full field audit
is in §3. One Phase-8 question remains open there:
`addCustomerAppointment` is **customer-first** and requires a customer, while the
wizard is schedule-first.

---

## 8. Summary

**Phase 0 is complete.** All ~40 frames read, the data contract mapped, both
creation paths (template + scratch) covered, cross-module sync enumerated, and
every previously-open item resolved:

| Was open | Now |
|---|---|
| Equipment option source | AI-suggested per class, multi-select + comma-separated custom, joins to the existing free-text string |
| Intent detection | General chat only, inline in-thread; tools merge into `insightTools` |
| RBAC gate | `manage_schedule`, enforced at tool registration — [`docs/ai-agent-rbac.md`](../docs/ai-agent-rbac.md) |
| Unread frames | All read; findings folded into §2 and the table above |
| `Appointment` contract | Audited in §3 |

One question stays open and is scoped to **Phase 8**, not Phase 1:
`addCustomerAppointment` requires a customer while the wizard is schedule-first.

### Recurring — reuse the admin form, don't rebuild
The client was explicit that the recurrence editor and the session preview follow
the admin schedule form's logic. Before writing anything in Phase 6, extract from
`ScheduleFormPage`:
- the day multi-select + per-day time-slot editor
- the recurrence → `ClassSchedule[]` expansion
- the month-grouped session preview

Phase 6 should be mostly re-wiring existing pieces into the panel, not new logic.

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Spot editor is a mini-app on its own | Phase 5 isolates it; check `/schedule/new/customize-spot` for reuse first |
| Intent detection inside General chat could mis-fire on unrelated messages | Narrow trigger phrases; require an explicit confirm before entering the wizard |
| Wizard state lost on refresh | Chat history persists per conversation — store the draft on the thread, same as `parsedFile` in migration |
| Field-level validation drift vs the admin form | Phase 3 extracts shared validators rather than duplicating them |
