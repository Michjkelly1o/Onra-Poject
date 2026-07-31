next task is in AI AGENT

Make the AI Agent can create class schedule directly in AI Agent only for Class schedule, private, and recovery for now.

i will show you the UI (SO FAR WE ONLY HAVE FOR THE CLASS SCHEDULE THE NORMAL ONE, BUT WE CAN REUSE IT FOR THE PRIVATE AND RECOVERY), BUT KEEP IT RELEVANT FROM THE ADMIN SIDE OKAY. 

NOTE: MAYBE THE STEP IS NOT CORRECT BELOW, SO I NEED YOU TO DO CHECK FIRST OKAY SO YOU CAN UNDERSTAND THE CORRECT FLOW.

---

## ⚠️ READ THIS FIRST — flow map (added 2026-07-31 after reviewing every frame)

**The numbered "steps" below are FRAME ORDER, not flow order.** The real product
is a **3-step wizard**; the 36 frames are its states.

Full analysis + phased build plan:
**[`class-creation-in-agent-implementation-plan.md`](./class-creation-in-agent-implementation-plan.md)**

Quick map of which frame belongs to which part of the flow:

| Flow position | Frames (step # below) |
|---|---|
| Step 1 · Class details — template picker | 1, 2 |
| Step 1 · gender access | 3 |
| Class preview card (persistent, live) | 4, 14, 15 |
| Step 2 · room picker | 5 |
| Step 2 · equipment | 6 |
| Step 2 · spot selection yes/no | 7 |
| Step 2 · spot layout editor | 9, 10, 11 |
| Step 2 · instructor picker | 8 |
| Step 3 · repeat? + single-class date | 12, 13 |
| Step 3 · single-class start time | 14 |
| Publish confirm / edit-a-field | 16, 17, 18 |
| **Step 3 · RECURRING — start date** | **19** (387-135510) |
| **Step 3 · RECURRING — end rule (Never/On/After)** | **20** (389-136165) |
| **Step 3 · RECURRING — repeat interval** | **21** (389-136815) |
| **RECURRING · `Never` branch** | 21, 22 + `391-138124` † |
| **RECURRING · `On` branch** | 24, 25, 26 + `391-156601` † |
| **RECURRING · `After` branch** | 29, 30, 31 + `394-171364` †, `394-171779` † |
| **RECURRING · per-day time slots** | 23 (391-148046) |
| **RECURRING · session-list preview + publish** | 32–35 |
| Validating loader | 36 |

† **Four frames are NOT in the numbered list below** — the real set is ~40, not 36.

### Two corrections to the first reading
1. **Frames 22–35 are the RECURRENCE branches, not private/recovery.** They cover
   the Never / On / After end rules, the per-day time-slot editor, and the
   session-list preview.
2. **Private + Recovery have NO frames at all** — consistent with the note at the
   top of this doc. We reuse the class wizard and swap the data source.

### Recurring is bigger than a single extra question
Start date → end rule (with a follow-up for `On` and `After`) → repeat interval →
**per-day time slots** (multiple start/end pairs per day, deletable, `Confirm`) →
preview grows a **`Preview of scheduled classes · N classes ▾`** expandable row.

### Client decisions (2026-07-31)
- **`+ Add room`** → opens its OWN nested question flow in the panel (same
  pattern as this wizard), fields mirroring Settings → Business & locations.
  NOT a plain modal, NOT a deep-link.
- **`Used by other class`** → hard block, not selectable.
- **Over-capacity** → auto-trim the capacity and say so in the AI's reply.
- **Equipment** → options are **AI-suggested per class** (personalised from the
  template), multi-select, custom entries comma-separated. Stays the same
  free-text comma-separated string the admin form already uses — no new schema.
- **Intent detection** → **General chat only**. Asking the AI to create a class
  schedule / private / recovery runs the wizard **inline in that thread**. It is
  NOT a 4th chat type, and Migration/Setup modes don't get it.
- **RBAC** → gated on the **permission matrix** (`classes.schedule.create`), not
  the coarse nav strings. Front Desk can view the schedule but not create one, so
  they're declined at the wizard entry; only Owner gets `+ Add room`. Developer
  spec: [`docs/ai-agent-rbac.md`](../docs/ai-agent-rbac.md).
- **Private + Recovery** → reuse the class-schedule components, but the LOGIC
  follows the admin private/recovery creation modules (they write `Appointment`,
  not `ClassSchedule` — audited in §3 of the plan).

### Frame coverage
**All frames read (2026-07-31).** The four unnumbered ones — `391-138124`,
`391-156601`, `394-171364`, `394-171779` — are included. Nothing is inferred.

---

Step 1
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=364-189373&m=dev

step 2 (AI ask about class templates)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=365-139753&m=dev

step 3 (ask about the gender)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=368-130883&m=dev

step 4 (class preview)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=368-131855&m=dev

step 5 
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=369-119753&m=dev

step 6
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=369-125854&m=dev

step 7
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=370-127764&m=dev

step 8
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=380-125323&m=dev

step 9
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=382-124222&m=dev

step 10
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=370-129436&m=dev

step 11
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=382-125437&m=dev

step 12
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-124675&m=dev

step 13
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-125948&m=dev

step 14
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-129597&m=dev

step 15
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-131806&m=dev

step 16 (if we click publish schedule)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-134733&m=dev

step 17 (if we choose edit the field)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-138833&m=dev

step 18
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-140961&m=dev

Step 19 (still on step date & time)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=387-135510&m=dev

step 20
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=389-136165&m=dev

step 21
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=389-136815&m=dev

step 22
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-143357&m=dev

step 23
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-148046&m=dev

step 24
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-137469&m=dev

step 25
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-141688&m=dev

step 26
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-157016&m=dev

step 27
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-158059&m=dev

step 28 
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=391-158338&m=dev

step 29
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-184280&m=dev

step 30
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-174501&m=dev

step 31
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-174707&m=dev

step 32
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-171571&m=dev

step 33
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-172822&m=dev

step 34
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-173101&m=dev

step 35
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-173941&m=dev

step 36 (FINAL LOADING)
Implement this design from Figma.
@https://www.figma.com/design/ufz59sDQtSDoiWFV9G2CaO/Onra---Studio-Dashboard--Design-Enhancement-?node-id=394-174915&m=dev