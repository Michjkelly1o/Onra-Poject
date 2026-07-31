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

### Step 2 — Location & instructor (`2 of 3 steps`)
| # | Question | Widget |
|---|---|---|
| 2.1 | Which room should it use? | Grouped list by branch. Per-room capacity, `Over capacity` amber badge, `Used by other class` disabled rows, `+ Add room` per branch |
| 2.2 | What equipment will be used? | Checkbox multi-select + `Something else` free-text row |
| 2.3 | Would you like to activate spots selection? | Yes / No with check + X icons |
| 2.3b | *(if yes)* Spot layout | Standard / Custom → **Customize area** editor: instructor block, spot grid (A1–A4 / B1–B4), column + row number inputs, click-to-block spots, `Use default` / `Customize spot` |
| 2.4 | Who's teaching it? | Searchable list — avatar, name, rating |

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

**Branch B — recurring** (pager `N of 4` — one extra question)
| # | Question | Widget | Frame |
|---|---|---|---|
| B.2 | When should the recurring schedule start? | Date list, first row badged `Tomorrow`, + `Pick a custom date` | **387-135510** |
| B.3 | How should this recurring schedule end? | `Never` / `On` / `After` | **389-136165** |
| B.4 | Repeat every X week? | `1 week` (badged `Default`) / 2 / 3 / 4 + `Custom X` free-text | **389-136815** |

`On` → date picker for the end date. `After` → occurrence count. Both follow the
same free-text/secondary-input pattern as `Custom X`.

### Publish
1. Preview card fully populated
2. `Are you ready to publish this schedule?` → **Publish schedule** \| **Edit a field** (chevron → field submenu)
3. Loading: *"Validating your class schedule data. Moving to the next step…"* + sparkle
4. Success: *"Your class schedule has been published."* + check icon

**Edit-a-field is a loop, not a back button.** It jumps to any single field, re-asks
it, and returns to the publish prompt — frames 17–19 confirm this.

---

## 3. Private sessions + Recovery

Same wizard, one substitution: **step 1.1 picks a SERVICE, not a class template.**

| | Class | Private | Recovery |
|---|---|---|---|
| Step 1.1 source | `classTemplates` | `services` (`type: "private"`) | `services` (`type: "recovery"`) |
| Capacity | template capacity | 1 | service capacity |
| Spot selection | offered | skipped | skipped |
| Writes to | `addClassSchedules` | `addAppointment` | `addAppointment` |

Steps 2 and 3 are identical across all three.

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
See Step 3 Branch B above. Frames 387-135510, 389-136165, 389-136815.

---

## 7. Still open

1. **Instructor ratings** (frame 8) — real aggregate from `class_ratings`, or
   display-only? Data exists; confirm whether a per-instructor average is wanted.
2. **Custom date picker** — inline calendar in the panel, or the existing
   `DatePicker` in a popover?
3. **`On` / `After` recurrence end** (frame 389-136165) — confirm the secondary
   input for each: `On` → date picker, `After` → occurrence count?
4. **Create-room sub-flow fields** — mirror Settings → Business & locations
   exactly, or a trimmed set for speed?

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Spot editor is a mini-app on its own | Phase 5 isolates it; check `/schedule/new/customize-spot` for reuse first |
| Intent detection inside General chat could mis-fire on unrelated messages | Narrow trigger phrases; require an explicit confirm before entering the wizard |
| Wizard state lost on refresh | Chat history persists per conversation — store the draft on the thread, same as `parsedFile` in migration |
| Field-level validation drift vs the admin form | Phase 3 extracts shared validators rather than duplicating them |
