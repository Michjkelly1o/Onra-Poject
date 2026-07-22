# Brief — AI Agent General Chat UI (`/ai-agent`)

> Surface: **admin** (full-viewport route at `/ai-agent`, DM Sans via `--font-brand-dm-sans`, `@untitledui/icons`, admin-only via `isAiAgentEnabled`). This brief covers the **UI redesign** of the AI Agent's **General Chat** experience against the new Figma file **"Onra — Studio Dashboard — Design Enhancement"** (`ufz59sDQtSDoiWFV9G2CaO`). The AI **functionality** (streaming, tools, generative cards, migration) already exists — see `ai-agent-phase-1-done.md` and `ai-agent-implementation-plan.md` (source of truth for behaviour/data). This brief documents only the **visual/interaction redesign** and the flow changes layered on top.
>
> **Golden rule (inherited):** no existing AI-agent file is deleted or restructured beyond what these phases require; every phase ends with `npm run build` green + a manual smoke test at `/ai-agent`. **Build the UI first, then wire behaviour.**
>
> **Reference always:** the attached screenshots **and** the Figma MCP node links per section. Match spacing, typography, sizing, interaction states, and transitions to ~99%.

---

## 1. Overview

The **AI Agent** is a full-viewport admin assistant at `/ai-agent`. Its shell is a **72px header** (close X + Onra logomark + "AI Agent") over a two-pane body: a **288px sidebar** (search + three entry threads + Recents + Archive footer) and a **fill-width chat surface** (mint-gradient + concentric-chevron background) that hosts the active `ChatThread`.

The redesign reshapes the **General Chat** experience:

1. **Outer Chat (empty state)** — a centred hero (orb → gradient heading → subtext → **centred AI input** → three entry cards) over a bottom-anchored decorative background.
2. **Entry-card dropdowns** — clicking **Create / Insight / Customer** opens a suggested-prompt dropdown and focuses the input.
3. **Insight conversation** — on first prompt the layout flips to a message list with the input **docked at the bottom**; responses render inside **structured containers**, followed by an **AI follow-up** with **Export / Send-to-email** actions attached to the input.
4. **Recent Chat History** — started conversations move into a Recents list in the sidebar, each with a **⋮ menu** (Rename / Pin / Archive / Delete).

Everything is **admin-scoped** and persists to `localStorage` (chat history per conversation, Recents metadata) — never to seed files. The three entry threads (**General chat / Studio setup / Migrate data**) always open **empty**; a refresh returns to the empty landing (see `ai-agent-general-chat`'s Recents flow, already built).

---

## 2. Goals / Purpose

1. **Match the new Figma exactly.** UI structure, copy, spacing, states, and transitions follow the "Design Enhancement" frames; no behaviour added beyond what they show.
2. **Reuse, don't reinvent.** One `Composer` (answer field) rendered centred in the empty hero and docked in a conversation; one `ChatThread` per active view; the existing generative-UI cards, charts, and tools stay.
3. **Entry points always start empty.** General chat / Studio setup / Migrate data are empty launchers; the actual conversation lives in **Recent Chat History** the moment the user interacts. (This flow already ships — this brief layers the visual redesign on top.)
4. **Build UI before behaviour.** Each phase lands the static/interactive UI first; the AI wiring (tools, export, email) is layered after the UI is signed off.

---

## 3. Module Structure

### 3.1 Screens / views

The route is a single page (`/ai-agent`); "screens" here are **view states** of the chat surface, driven by `AgentView` (`AiAgentPage.tsx`).

| # | View | State | Sidebar |
|---|---|---|---|
| 0 | **Outer Chat (empty)** | entry thread, no messages — centred hero + input + cards | entry thread highlighted |
| 0a | **Entry-card dropdown** | one of Create/Insight/Customer expanded → suggested-prompt list under a focused input | entry thread highlighted |
| 1 | **Insight conversation** | ≥1 message — message list + **bottom-docked** input | Recents item highlighted |
| 1a | **AI loading** | model generating — typing indicator; Send → **Stop** | — |
| 1b | **AI response container** | insight chart / overview / default answer inside a structured card | — |
| 1c | **AI follow-up** | question + attached **Export report** / **Send report to email** actions | — |
| 1d | **Export → format** | pager step: PDF / CSV / XLSX | — |
| 1e | **Downloadable report** | file card + **Download** | — |
| 1f | **Send email → address** | pager step: pick / type email → **success** message | — |
| 2 | **Recents ⋮ menu** | Rename / Pin / Archive / Delete on the selected Recents item | Recents item selected |

### 3.2 Figma references (Design Enhancement — `ufz59sDQtSDoiWFV9G2CaO`)

| Section | Node | Screenshot |
|---|---|---|
| **Outer Chat** (General Chat empty state) | `413-460177`, `405-455839` | image 1 / 2 |
| **AI input / Answer field** (all states: default, generating→Stop, focused, typed) | `405-455839` (answer-field states) | "Answer field" grid |
| **Background** (gradient + concentric chevrons) | `405-455839` (Background sub-node) | image 2 |
| **Suggested-prompt dropdown** | `413-460754` | images 3 / 4 / 5 |
| **Insight conversation layout** (input docked bottom) | `413-461307` | image 6 |
| **User chat bubble** | `413-461047` | image 7 |
| **AI loading state** | `420-461452` | image 8 |
| **Insight response container** (chart / overview) | (Insight card frames) | image 9 |
| **AI follow-up + attached actions** | (follow-up frame) | image 10 |
| **Export → format pager** | (export flow) | image 11 |
| **AI-question / user-answer flow** | (Q&A bubble) | image 12 |
| **Downloadable report card** | (report card) | image 13 |
| **Send-to-email → address** | (email step) | image 14 |
| **Email sent success** | (success) | image 15 |
| **Recents ⋮ menu** (Rename / Pin / Archive / Delete) | `364-188835` | image 16 |

### 3.3 Reusable components (build-once, reuse everywhere)

| Component | Source / status | Reused by |
|---|---|---|
| **Shell** (header + 288px sidebar + fill-width surface) | ✅ built (`AiAgentPage.tsx`) | every view |
| **Composer** (answer field) | ✅ rebuilt to Figma `405-455839` (skeuomorphic buttons, focus-green border, Send↔Stop) | empty hero (centred) + conversation (docked) |
| **Background** (mint gradient + concentric chevrons) | ✅ rebuilt to Figma geometry (`ConcentricSquaresDecoration`) | surface |
| **ParticleOrb** (Three.js) | ✅ built | empty hero |
| **Entry card** (`SuggestionCard`) | ✅ built (icon + title + subtitle) | empty hero (Create / Insight / Customer) |
| **ChatThread** | ✅ built (per-view, `storageKey`-keyed persistence, `onFirstUserMessage` adoption) | conversation surface |
| **Recents sidebar list** | ✅ built (basic list) | sidebar |
| **Generative-UI cards + charts** (metric group, bar / line / donut, table, ExportCard) | ✅ built | AI responses |
| **Suggested-prompt dropdown** | ⬜ new `PromptDropdown` (per-menu prompt list, parent icon, hover state) | Phase 2 |
| **User chat bubble** | ⬜ new / restyle `MessageRow` user variant (mint bubble, `413-461047`) | Phase 3 |
| **AI loading indicator** | ⬜ restyle `TypingDots` to `420-461452` | Phase 3 |
| **Response container** | ⬜ new `ResponseCard` wrapper (every AI answer sits inside it) | Phase 3 |
| **Follow-up + attached actions** | ⬜ new `FollowUpActions` (docked to the input; Export / Send email) | Phase 3 |
| **Report pager** (format / email steps + `1 of N` pager) | ⬜ new `ReportStepCard` | Phase 3 |
| **Q&A bubble** (AI-question / user-answer stack) | ⬜ new user-bubble variant | Phase 3 |
| **Downloadable report card** | ⬜ new `ReportFileCard` (PDF/CSV/XLSX icon + Download) | Phase 3 |
| **Recents ⋮ menu** | ⬜ new `RecentItemMenu` (Rename / Pin / Archive / Delete, `364-188835`) | Phase 4 |

### 3.4 Data / persistence (client-only)

- **Chat history** — one `localStorage` key per conversation (`onra-ai-agent-conv-<id>`), owned by `ChatThread` via its `storageKey`.
- **Recents metadata** — `onra-ai-agent-conversations-v1` (`{ id, mode, thread, title, createdAtISO }[]`), owned by `AiAgentPage`.
- **AI requests** — every message carries a fresh Zustand store snapshot (see `ai-agent-phase-1-done.md`); export/email are simulated client-side.
- **No new tables, no seed edits.** Recents Pin/Archive/Rename/Delete (Phase 4) extend the Recents metadata shape only.

---

## 4. Entry Points

1. **Floating AI button** (admin, feature-flagged) / direct `/ai-agent` — opens the shell on the **General chat** empty state.
2. **Sidebar threads** — General chat / Studio setup / Migrate data each open their **empty** entry (a fresh, unsaved conversation).
3. **`?thread=` deep link** — lands on a specific entry (e.g. Migration & imports "+ Import" → `thread=migrate_data`).
4. **Recents item** — reopens a saved conversation.
5. Entry-card **Create / Insight / Customer** — open the suggested-prompt dropdown (Phase 2).

---

## 5. Flows / Phases — detailed breakdown

### Phase 1 — Outer Chat (empty state) · ✅ DONE
**Figma `413-460177` / `405-455839`. Screenshots: image 1 (target), image 2 (render).**

Fill-width surface (no fixed cap). Centred hero, `max-w-[720px]`, top-to-bottom:

1. **ParticleOrb** (72px) → **heading** "How can I assist you today?" (36px semibold, gradient `#658774 → #7ba08c`, `-0.72px` tracking) → **subtext** "Manage bookings, customers, and schedules with ease." (16px, `#667085`). Gap **16px**.
2. **32px** gap → **AI input block** (gap **20px**): the **centred Composer**, then the **entry cards row** (gap **16px**): **Create** (pencil-line), **Insight** (stars-02), **Customer** (user-01) — each a white `rounded-12`, `p-16`, shadow-lg card with a 32px featured icon + title (14px medium `#344054`) + subtitle (14px regular `#475467`).
3. **Composer / answer field** (`405-455839`): white, `p-10`, `rounded-12`, border `#d0d5dd`, shadow-xl. Left: attach button (`rounded-8`, skeuomorphic) + input (placeholder "Ask me anything", 16px `#667085`). Right: green send button (`#c4edd6`, `rounded-8`, `border-2`, skeuomorphic). **Focus** → green border + soft ring. **Generating** → Send becomes a **Stop** (rounded-square). *(Composer is shared: centred here, docked in a conversation.)*
4. **Background** (`405-455839`): mint gradient `1392×428px`, centred, rising from the foot (transparent → `#e9fff3`); concentric rounded-squares (sizes `228.571 … 800`, `2.381px` border `#7ba08c`, `28.571px` radius, wrapper `-32.1°`, each square `-12.5°`), anchored low so only the upper arcs read as rising chevrons.

> **Open item for Phase 1 polish:** the Figma masks the chevrons with a bespoke swirl raster (`imgContent` in node `405-455839`). It is currently approximated with a CSS radial mask. For pixel-perfect parity, **download that mask asset into `/public`** and apply it as the `maskImage` (adds one committed binary).

### Phase 2 — Entry-card dropdowns · ⬜ PENDING
**Figma `413-460754`. Screenshots: images 3 (Create) / 4 (Insight) / 5 (Customer).**

Clicking **Create / Insight / Customer** in the empty hero:

1. **Focuses the AI input** (green focus state, typeable) and swaps its placeholder to the menu's prompt (e.g. Create → "Create classes, memberships, promos, and more…"; Insight → "Ask me about your business performance…"; Customer → "Ask me about your customers…").
2. Opens a **suggested-prompt dropdown** directly under the input (`PromptDropdown`, `413-460754`): a white `rounded` card, shadow, list rows. **Each prompt row uses its parent menu's icon** (Create → pencil-line, Insight → stars-02, Customer → user-01) + label. **Hover state on every row.**
3. **Selecting a prompt** submits it (→ Phase 3 conversation). The user may **ignore the dropdown and type a custom prompt** instead.

**Prompt lists (reuse exactly — screenshots 3/4/5):**
- **Create:** Create a class schedule · Create a membership or credit package · Create a promo code · Create a marketing · Create a gift card
- **Insight:** How did this week go? · Most popular classes · Revenue this month vs last month · No-show & cancellation rate · Memberships expiring soon
- **Customer:** Find inactive customer · Book a customer into a class · Grant free access to a customer · Look up booking history · Add a new customer

### Phase 3 — Insight conversation · ⬜ PENDING (focus of this iteration = **Insight** only)
**Figma `413-461307` (layout), `413-461047` (user bubble), `420-461452` (loading). Screenshots: images 6–15.**

On the first submitted / selected prompt, the conversation is **adopted into Recents** (already wired) and the surface flips:

1. **Layout change (`413-461307`, image 6)** — the centred input **moves to the bottom** (docked); the message list scrolls above it.
2. **User message bubble (`413-461047`, image 7)** — right-aligned mint bubble (`#c4edd6`-family), `#0c2d34` text, rounded (larger radius, one squared corner per design).
3. **Generating** — Send button → **Stop** (already built); **AI loading** shows the `420-461452` indicator (image 8) — Onra logomark avatar + stars avatar + animated dots.
4. **AI response — always inside a structured container** (`ResponseCard`, image 9). No plain-text answers. Two content types for Insight:
   - **Insight chart / overview** — the "This week at …" card: KPI tiles (Revenue / Bookings / Attendance / No-shows) + a **line chart** ("Class bookings" with hover tooltip) + a **"Class by popularity"** list (class thumb, name, instructor, bookings, occupancy). Reuse the existing metric-group + line-chart + list cards, wrapped in the container.
5. **AI follow-up (image 10)** — after the insight, the AI auto-asks **"Anything you'd like to do with this?"** with two actions **attached to the input area**: **Export report** · **Send report to email**. The user can ignore them and type freely.
6. **Export report flow (image 11 → 13):**
   - Pager step **"Which format would you like for the report?"** — **PDF / CSV / XLSX** (numbered rows, `1 of N` pager).
   - The user's choice renders as a **Q&A bubble** (image 12): `Q: Anything you'd like to do with this? / A: Export report` then `Q: Which format… / A: PDF`.
   - Final: a **downloadable report card** (image 13) — file icon (PDF/CSV/XLSX) + name ("Business insight (May 2026).pdf") + **Download**.
7. **Send report to email flow (image 14 → 15):**
   - Select report **type** → select **email address** (image 14: pick `jonathan@untitled.ui` / `forma.south@…` / `forma.west@…`, or **type email**).
   - **Success** (image 15): "Your report has been sent to jonathan@untitled.ui".

> **Studio setup / Migrate data** conversation redesign is **out of scope** for this iteration (Insight only). Their empty states keep the current treatment until a later phase.

### Phase 4 — Recent Chat History · ⬜ PENDING
**Figma `364-188835`. Screenshot: image 16.**

1. **Reuse the AI navigation component** already used for the three entry threads (same row style) for Recents items.
2. Each Recents row supports a **⋮ action menu** — **Rename**, **Pin**, **Archive**, **Delete** (`RecentItemMenu`, `364-188835`): white `rounded` menu, shadow; Rename (pencil), Pin (pin), Archive (archive), **Delete (red, trash)**.
3. The **⋮ trigger appears only when that Recents item is selected/active** (hover/selected reveals it — hidden otherwise).
4. **Behaviour (build UI first):** Rename edits the title; Pin sorts pinned items to the top; Archive moves it out of Recents (into the existing Archive footer's list); Delete removes the conversation (+ its `localStorage` history). Extend the Recents metadata shape (`pinned`, `archived`, `title`) — no new tables.

---

## 6. States & conditional rendering

- **Surface** — empty hero (centred input + cards) vs conversation (message list + docked input), by `messages.length === 0`.
- **Composer** — default / **focus** (green border + ring) / **generating** (Send → Stop) / disabled-send (empty input).
- **Entry card** — resting vs **dropdown-open** (focused input + prompt list, hover per row).
- **AI response** — always wrapped in `ResponseCard`; content = insight chart/overview vs (later) default answer.
- **Follow-up** — actions attached to the input; the report pager advances (`1 of N`) format → (export) download / (email) address → success.
- **Recents row** — resting vs **selected** (⋮ visible); Pinned float to top; Archived leave the list.
- **Sidebar** — entry thread highlighted (empty view) vs Recents item highlighted (adopted / opened conversation).

## 7. Empty states

| Surface | Condition | Empty state |
|---|---|---|
| Chat surface | No messages (entry thread) | Outer Chat hero (orb + heading + subtext + centred input + 3 cards) |
| Recents | No saved conversations | Recents section hidden (sidebar shows threads + Archive only) |
| Recents ⋮ actions | Item not selected | ⋮ trigger hidden |

## 8. Copy & messages

| Surface | Copy |
|---|---|
| Heading / subtext | "How can I assist you today?" / "Manage bookings, customers, and schedules with ease." |
| Input placeholder (default) | "Ask me anything" |
| Input placeholder (Create / Insight / Customer) | "Create classes, memberships, promos, and more…" / "Ask me about your business performance…" / "Ask me about your customers…" |
| AI follow-up | "Anything you'd like to do with this?" → Export report · Send report to email |
| Export format step | "Which format would you like for the report?" → PDF / CSV / XLSX |
| Email address step | "Which email address should I send the report to?" |
| Email sent | "Your report has been sent to [email]" |

## 9. Cross-module / behaviour notes

- **AI answers** read the live Zustand store snapshot (unchanged) — see `ai-agent-phase-1-done.md`.
- **Adoption to Recents** is already wired (`onFirstUserMessage`); Phase 3's layout change hangs off the same first-message event.
- **Export / email** are simulated client-side (no backend send); the existing `ExportCard` / SheetJS / jsPDF plumbing can back the report card.
- **Persistence** stays in `localStorage`; a refresh always returns to the empty General-chat landing (Recents preserved).

---

## 10. Rules footer

1. **Build UI first, then behaviour** — land the static/interactive Figma UI per phase; wire tools/export/email after sign-off.
2. **Reuse, don't reinvent** — one `Composer` (centred + docked), one `ChatThread` per view, existing generative cards/charts, existing Recents flow. Every button is `<Button>`/skeuomorphic per the answer-field spec; destructive actions (Delete) red.
3. **Match the designs to ~99%** — reference both the screenshots and the Figma MCP node per section; document/build only what they show. Watch spacing, typography, sizing, interaction states, and transitions.
4. **No existing AI-agent file deleted or restructured** beyond the phase's needs; every phase ends `npm run build` green + a manual smoke test at `/ai-agent`.
5. **Client-only persistence, no seed edits** — chat history + Recents metadata in `localStorage`; Phase 4 extends the Recents shape only (`pinned` / `archived` / `title`). No new tables.
6. **Phase order:** 1 (Outer Chat) ✅ → 2 (dropdowns) → 3 (Insight conversation) → 4 (Recents ⋮). Studio setup / Migrate data conversation redesign is a later phase.

---

## 11. Status snapshot (2026-07-22)

| Phase | Scope | Status |
|---|---|---|
| **1** | Outer Chat empty state (surface fill-width, hero, centred Composer w/ focus + Stop, background) | ✅ **Done** — pending Phase-1 polish: exact swirl-mask raster for the background |
| **2** | Create / Insight / Customer suggested-prompt dropdowns | ⬜ Pending |
| **3** | Insight conversation (docked input, user bubble, loading, response container, follow-up, export/email) | ⬜ Pending |
| **4** | Recents ⋮ menu (Rename / Pin / Archive / Delete) | ⬜ Pending |

**Key files:** `src/ai-agent/components/AiAgentPage.tsx` (shell, views, Recents, background), `src/ai-agent/components/ChatThread.tsx` (hero, Composer, message list, empty states), `src/ai-agent/components/ParticleOrb.tsx`, `src/ai-agent/flags.ts` (`isAiAgentEnabled`, feature flag). Behaviour/data source of truth: `new-prd/ai-agent-phase-1-done.md` + `new-prd/ai-agent-implementation-plan.md`.
