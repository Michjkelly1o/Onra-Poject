# Onra AI Agent — Design Reference (from Figma)

Source: Figma **"Onra — Studio Dashboard / Design Enhancement"**, file `ufz59sDQtSDoiWFV9G2CaO`.
- Migration flow — page *Migration & Imports*, node `196-100522` (28 frames).
- Insight flow — page *General chat - Business insight*, node `429-68580`.

This file pins the **design system, tokens, and component inventory** so the build matches the design 1:1. Pair it with `AI-AGENT-POC-PLAN.md` (architecture) — this file is the "what it looks like", that one is the "how it works".

---

## 1. Design system

- **Base:** Untitled UI token system (fg/bg/border/text scales, shadow-xs/xl, radius + spacing scales).
- **Font:** **DM Sans** (`font-family-body` and `font-family-display` both DM Sans; display = SemiBold).
- **Brand:** green. Primary button bg `#c4edd6` with **black** text; brand fg `#658774`; brand-50 surface `#e9fff3`; brand border `#7ba08c`.
- **Reference code came out as React + Tailwind with CSS-variable tokens** (e.g. `bg-[var(--colors/background/bg-primary,white)]`). Convert to the target project's styling system but keep the token values below exact.

---

## 2. Design tokens (exact values from Figma variables)

### Colors
| Token | Hex |
|---|---|
| Brand / fg-brand-primary (600) | `#658774` |
| Brand / border-brand | `#7ba08c` |
| Brand / 200 | `#c4edd6` |
| Brand / 300 | `#aad4bd` |
| Brand / utility-brand-50 | `#e9fff3` |
| Button primary bg / fg | `#c4edd6` / `#000000` |
| Button secondary bg / fg / border | `#ffffff` / `#344054` / `#d0d5dd` |
| Button tertiary fg | `#475467` |
| Text primary (900) | `#101828` |
| Text secondary (700) | `#344054` |
| Text quaternary (500) / placeholder | `#667085` |
| fg-quinary (400) | `#98a2b3` |
| Border primary / secondary | `#d0d5dd` / `#e4e7ec` |
| Bg primary / hover | `#ffffff` / `#f9fafb` |
| Error fg / text (700) | `#b42318` |
| Shadow-xs | `#1018280d` (0 1 2 drop) |
| Shadow-xl | `#10182814/08` (0 8 8 -4 ; 0 20 24 -4) |

### Spacing (px)
`none 0 · xs 4 · sm 6 · md 8 · lg 12 · xl 16 · 2xl 20 · 3xl 24 · 4xl 32`

### Radius (px)
`sm 6 · md 8 · xl 12 · 3xl 20 · 4xl 24`

### Typography (DM Sans)
| Style | Size / Line / Weight |
|---|---|
| text-xs / Medium | 12 / 18 / 500 |
| text-sm / Regular · Medium | 14 / 20 / 400 · 500 |
| text-md / Regular | 16 / 24 / 400 |
| text-lg / Semibold | 18 / 28 / 600 |
| display-xs / Semibold | 20 / 30 / 600 (metric numbers) |

---

## 3. Shell (shared by all threads)

- Modal titled **"AI Agent"** (Onra mark + ✕ close). Rounded container, soft green ambient background with a faint chevron watermark.
- **Left sidebar:** `Search chat…` field; thread list — **General chat**, **Studio setup**, **Migrate data** (each with icon); a **Recents** group (recent conversations with a ⋮ menu); **Archive** pinned at bottom.
- **Right pane:** conversation. Agent bubbles left-aligned with the Onra mark avatar; **user bubbles right-aligned green pills** (`#c4edd6`-ish). Bottom **composer**: paperclip (attach) + `Ask me anything` + send button; send becomes a **stop (square)** button while generating. **Suggestion / quick-reply chips** sit just above the composer.
- **Empty state (General chat):** centered green orb, **"How can I assist you today?"**, subtitle "Manage bookings, customers, and schedules with ease.", centered composer, and three **capability cards**: **Create** (set up classes, plans, packs, staff), **Insight** (quick insights to grow the studio), **Customer** (find customers, handle refunds/credits).

> Note: the empty state reveals the agent's *full* intended scope — **Create** and **Customer** are write-capable capabilities beyond the POC's Insight+Migration. Out of POC scope but design-visible; keep the architecture open to them.

---

## 4. Component inventory → generative-UI cards

Every substantive agent response is a **card** (typed JSON → React component). Interactive controls post structured `{action}` messages back into the loop.

### 4.1 Insight (General chat) cards
| Card | Contents (from design) |
|---|---|
| `capability_menu` | 3 cards: Create / Insight / Customer (empty state) |
| `metric_group` | Row of **metric tiles** — label (text-sm, `#667085`) + value (display-xs 20/600, `#101828`). Observed: Today Revenue 2,000 · Bookings 84 · Attendance 3 · No-shows 78% |
| `line_chart` | Titled card ("Class bookings"), line series, x = dates (Feb 22–28), hover tooltip (date + Total booking 35), y-axis 0–50 |
| `ranked_list` | "Class by popularity": thumbnail + class name + instructor (avatar+name) on the left; **bookings** + **% occupancy** right-aligned. Rows: Reformer Pilates / Sara Al-Rashid — 142 · 89%; Mat Pilates / Liam Chen — 98 · 78%; Barre / Maya Johnson — 87 · 72%; Roller Release / Liam Chen — 45 · 65% |
| `deep_link` | Footer button **"↗ Go to insight"** — links to the full Reports/Insight page in the dashboard |
| `choice_prompt` | Numbered options with a pager, e.g. **"Which format would you like for the report?"** 1 PDF · 2 CSV · 3 XLSX ("2 of 3") |
| `data_table` | Header cells (250 / 330 wide) + rows (76 tall) — generic tabular answer |

### 4.2 Migration (Migrate data) cards — 4-step wizard, each badged "N of 4 steps"
| Card | Step | Contents |
|---|---|---|
| `source_options` | 1 | Intro + platform chips: Upload file · Mindbody · Glofox · ClassPass · Kenko · Momence · Mariana Tek |
| `upload_prompt` | 2 | "Upload your customer file (CSV or XLS)…" + attach affordance |
| `branch_assignment` | 2 | "I found branch data… South 200 · East 25 · West 25". Blocked variant: "no branch column & no branches → **+ Add new branch**" |
| `column_mapping` | 3 | Editable grid: source col → Onra-field dropdown (options incl. "Skip this column"); badges **"7 mapped / 5 need review"**; buttons **Accept all suggestion · Skip suggestion field · Done manual mapping** |
| `mapping_summary` | 4 | Badge "12 columns · 11 mapped"; tiles **Total / Valid / Invalid / Duplicate** (250·250·0·8); incoming→Onra field table (green field pills); **Download pre-import report**; buttons **Yes, start import · No, back to mapping** |
| `import_result` | 4→ | created / skipped / failed summary |

### 4.3 Interaction → action payloads (examples)
```
{ action: "pick_source", platform: "mindbody" }
{ action: "accept_all_mappings", entity: "customers" }
{ action: "edit_mapping", entity, source: "province", target: "state" }
{ action: "confirm_import", entity }          // "Yes, start import" — the ONLY commit trigger
{ action: "choose_report_format", value: "csv" }
{ action: "add_branch" }                        // no-branch guard CTA
```

---

## 5. How this feeds the build

- **Tokens** → seed the project's theme (CSS vars / Tailwind config) with §2 exactly. DM Sans, brand `#c4edd6`/`#658774`, Untitled UI grays.
- **Cards** → each `card` type in `AI-AGENT-POC-PLAN.md` §8.4 gets one React renderer; §4 above is the full list to implement (insight + migration).
- **Reference code** was React+Tailwind with `data-node-id` attributes — usable as a starting point per component; re-fetch any frame's code with Figma `get_design_context` when building that component.
- Both threads share the shell (§3); only the message-area cards differ by mode.
