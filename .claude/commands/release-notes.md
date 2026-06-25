# /release-notes

> **Purpose:** Draft a client-facing release note for one of the three Onra Studio prototypes (Admin, Instructor, Customer) using the exact template the user pastes into Google Docs. Pulls from recent git history, but writes in plain client-friendly language — never technical jargon.

---

## When to use

Run this skill any time the user says things like:
- "draft release notes", "release note for today", "/release-notes"
- "write up what we shipped this week"
- "make a client update for the [admin/instructor/customer] side"

Do NOT run it for internal changelogs, PR descriptions, or commit message summaries — those have different audiences and conventions. This skill is for the **client demo update doc** only.

---

## Step 1 — Gather the inputs (always ask)

Ask the user up front, in one combined question if possible:

1. **Which surface?** Admin / Instructor / Customer (pick one — separate docs per the user's Google Docs setup).
2. **Cutoff date or "since last release"** — what date range does this update cover? Default to "since the previous release note" if a `release-notes/` folder exists in the repo; otherwise ask.
3. **Overall modules count** — "X of Y modules done" (the headline number at the top). Ask the user for this number; don't guess.
4. **Modules covered in THIS release** — list of module names (e.g., Dashboard, Schedule, Customer, Products). User picks from what they actually want to highlight.
5. **General updates** — cross-module changes worth mentioning (e.g., "every table row now clickable", "bulk action bars made consistent", "navigation polish"). Ask the user what general work they want surfaced — do NOT auto-list every commit.

Use `AskUserQuestion` for this whenever possible to keep it quick.

---

## Step 2 — Pull context from git (optional, smart-default)

After confirming the surface + date range, run a quick `git log --oneline --since="<date>"` to see what was committed. Use this as a **memory aid for the user**, NOT as the source of truth. Show them a condensed list and ask which items belong in the release note.

Example:

> Since 2026-06-18, you have these commits — which ones do you want in the release note? (skip the ones that are pure infra / refactor / fixes nobody will notice)
> - feat: categories module
> - fix: appointment status column matches class schedule
> - fix: 6 tables row-clickable with returnTo
> - chore: feature-flags update
> - …

This avoids dumping the full git log into the client doc.

---

## Step 3 — Write in client-friendly language

The audience is a non-technical studio owner reviewing a demo. **Never write technical terms in the release note.** Translate as you draft:

| Don't write | Write instead |
|---|---|
| Zustand store | (no mention — describe behavior only) |
| State / render cycle / re-render | "updates instantly", "syncs across screens" |
| Component / props / route | "screen", "page", "card" |
| RBAC / role-gated | "based on the user's role" |
| Edge case / null check | (skip — only describe positive flows) |
| Refactor / migration | "polish", "tidy-up" (only mention if user-visible) |
| TypeScript / Tailwind / Next.js / Figma | (never mention — implementation detail) |
| Bug fix / regression | "smoother", "fixed an issue with X" |
| Pixel-perfect / DS / tokens | "matches the design exactly" |
| Returns / promotes / hooks into | "shows", "opens", "goes to" |

**Use the in-app names the client already knows.** If a section is called "Classes today" in the UI, write "Classes today" — not "today's class count metric." Read the relevant module's code/CLAUDE.md if unsure of the exact UI name.

**Voice rules:**
- Active voice, present tense ("The dashboard shows…" not "It will be displaying…")
- Short sentences. One idea per bullet.
- Lead with the **value** ("at a glance", "no need to refresh") then the mechanic.
- No filler: avoid "Users can now…", "We've added the ability to…". Just say what it does.
- No emojis unless the user explicitly asks.

---

## Step 4 — Produce the document

Use this exact template structure (matches the user's Google Docs). Replace bracketed values with real content.

```
Onra [Surface] Prototype Update and Walkthrough
Overall modules done [X]/[Y]
This update covers these modules:
[Module 1]
[Module 2]
[Module 3]

Note:
Today's feedback from the meeting/docs is not tackled yet and pushed to the Vercel version today, we only push what we have done this week and the previous week. In the prototype, maybe you will see some 404 pages; that means the page/module/feature is still being developed.
[Surface-specific URL line — see URL block below]
Interactive experience — This is a fully interactive prototype. Feel free to click, create, edit, and delete items to test the workflows.
Live updates — The prototype uses realistic sample data. Any changes you make apply live as you navigate between different screens.
Session persistence — Any data you create, edit, or cancel survives a page refresh and tab close. Your demo session sticks until you explicitly reset.

[NUMBERED MODULE SECTIONS — one per module covered]

1 [Module Name]
[One-sentence purpose — what this screen is for and who it's scoped to.]
Capabilities:
[Capability 1 — short name — one-line description.]
[Capability 2 — short name — one-line description.]
[Capability 3 — short name — one-line description.]

2 [Next Module Name]
[Purpose…]
Capabilities:
[…]

[GENERAL UPDATES SECTION — only if there are cross-module changes worth mentioning]

General updates
[Bullet 1 — short title — one-line description of the cross-cutting improvement.]
[Bullet 2 — short title — one-line description.]
[Bullet 3 — short title — one-line description.]
```

### URL block (pick one based on surface)

- **Admin** →  
  `New side for admin: to navigate to admin please change the link to "https://onra-poject.vercel.app/admin/dashboard" and for the instructor side, please change it back to "https://onra-poject.vercel.app/instructor/dashboard"`

- **Instructor** →  
  `New side for instructor: to navigate to instructor please change the link to "https://onra-poject.vercel.app/instructor/dashboard" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"`

- **Customer** →  
  `New side for customer: to navigate to customer please change the link to "https://onra-poject.vercel.app/member/home" and for the admin side, please change it back to "https://onra-poject.vercel.app/admin/dashboard"`

  > Note: the deployed URL is literally `onra-poject` (one missing letter) — keep that spelling. Customer surface uses `/member/*` routes per the project setup.

### Per-module section — writing pattern

Each module gets a numbered section. The **opening line** describes the purpose + who sees what (one sentence). Then "**Capabilities:**" with 3–6 bullets.

Each capability bullet follows this shape:
> **Short Title** — One-sentence description, written in present tense, focused on what the user sees or does.

Examples (good):
- **KPI Cards** — Classes today, classes this week, total attendance count, average rating across the instructor's classes.
- **Live Sync With Admin Side** — Counters and the upcoming card update right away when admin assigns, cancels, or reschedules a class. No refresh needed.
- **Audience-filtered Feed** — Each instructor only sees events relevant to their own classes — admin events are filtered out.

Examples (bad — fix before delivering):
- ❌ "Implemented Zustand-backed KPI cards with derived selectors" → too technical
- ❌ "Refactored the schedule grid to use a virtualized list" → client doesn't care
- ❌ "Added new feature for class display" → vague, no specifics

### General updates section — writing pattern

Render this section ONLY when the release has cross-cutting changes (table-row clickability sweep, bulk-action bar consistency, navigation tidy-up, etc.). Bullets follow the same shape as capabilities — short title + one sentence.

Examples:
- **Click any table row** — Every list in admin (customers, products, agreements, branches, instructors) now opens the detail page on row click — no need to find the kebab menu first.
- **Consistent bulk-action bar** — When selecting multiple rows for bulk action (archive, deactivate, etc.), the floating action bar now matches across every admin screen.
- **Back / close returns to where you came from** — Closing a detail page now takes you back to the exact list/tab you opened it from, not always the module root.

If there are no cross-cutting changes, OMIT the General updates section entirely — don't leave a placeholder.

---

## Step 5 — Save & deliver

Save the finished release note as a Markdown file under `release-notes/` at the repo root. Naming convention:

- `release-notes/YYYY-MM-DD-[surface].md` (e.g., `release-notes/2026-06-25-instructor.md`)

If the `release-notes/` folder doesn't exist, create it on first run.

After saving, **print the full content in the chat** in a fenced code block so the user can copy-paste it directly into their Google Doc. Do not summarize — paste the whole thing. The Google Docs target means the user wants raw text they can drop in.

---

## Tone & taste guardrails

- **Brevity wins.** A client reads release notes in 60 seconds. Cut anything that doesn't survive a "would the studio owner care?" test.
- **Show value, not effort.** "Classes scroll smoothly on phone" beats "We rewrote the schedule grid layout."
- **Don't oversell.** No "exciting", "amazing", "powerful", or marketing fluff. Plain confident language.
- **Don't undersell either.** If a release is genuinely small, say so and ship a 3-line note. No padding.
- **Speak to one persona at a time.** Admin notes never reference instructor-only screens. Instructor notes never reference owner-only settings. Customer notes never reference internal admin tools.
- **Future-proof phrasing.** Avoid dates and version numbers inside the body (the filename has the date already). Avoid "this week" — say "in this update" instead, since clients may read it later.

---

## Quick checklist before handing off

- [ ] Surface is correct (Admin / Instructor / Customer)
- [ ] URL block matches the surface
- [ ] Module count matches what the user said (don't invent the number)
- [ ] No technical terms remain (search for: state, props, hook, store, refactor, component, route, render, TypeScript, Tailwind, Next, Figma, RBAC)
- [ ] Every capability bullet has a short title + one-sentence description
- [ ] General updates section is present only if there are cross-cutting items
- [ ] No emojis, no marketing fluff
- [ ] Saved to `release-notes/YYYY-MM-DD-[surface].md`
- [ ] Full content printed in chat for copy-paste
