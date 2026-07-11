# QA Findings — בינה+ CRM

| # | Layer | Severity | Screen/Area | Finding | Fix | Status |
|---|-------|----------|-------------|---------|-----|--------|
| F1 | Backend/RLS | HIGH | people/tickets | `FOR ALL using(true)` write policy also governs SELECT → per-rep read restriction bypassed; non-manager sees other reps' records | migration 007: split write into INSERT/UPDATE/DELETE so SELECT obeys the read policy | ✅ fixed (RLS 20/20) |
| F2 | Frontend | LOW | useColumns.js | dead-code `k !== t ? true : true` in dropOn | simplify | ✅ fixed |
| F3 | Frontend | MED | Tasks/ActivityFeed | hardcoded light colors (#fff8e6/#fdecec) break dark theme | use CSS vars + dark overrides | ✅ fixed |
| F4 | Frontend | HIGH | PersonDetail/Opportunities/Orders | RecordLayout refactor dropped add-order/add-opportunity → **no way to create orders/opps in UI** | quick-add 🎯/📄 actions on person card (linked+navigate) | ✅ fixed |

## Phase 1 batch (9 fixes) — branch `fix/phase-1`, 2026-07-11

| # | Area | Finding / Task | Fix | Status |
|---|------|----------------|-----|--------|
| P1 | records CSS | attendance matrix inflated its `.rec-grid` column and pushed the activity feed off-screen (grid children default `min-width:auto`) | `.rec-grid > * { min-width: 0 }` so `.table-wrap` scrolls internally | ✅ (feed present + table-wraps scroll; no console errors) |
| P7 | reps | `/reps` was `1fr 320px` sticky form, no record screen | rewrote to full-width list (search+filters+`+נציג חדש` modal) + new `RepDetail` (KPIs, editable fields, related chips) + `reps/:id` route + `rep` schema (deactivate, no hard-delete) | ✅ (list, nav, RepDetail, deactivate button all verified live) |
| P8 | products | products got static `badge mp`, no per-product color | reuse `chipColor(name)` across Products/People/Cycles/Lessons/Dashboard; palette 9→15 | ✅ (distinct inline colors verified in DOM) |
| P2/3/4/5 | fields (light) | couldn't edit an existing custom field's label or dropdown options (only delete+recreate) | inline edit (pencil) for label + select options on the record screen; standard fields stay code-driven (chosen light scope) | ✅ (build; component renders) |
| P6 | activity feed | composer/note/task/email read as raw HTML boxes | token-only premium restyle (cards, `var(--r)`+`var(--sh1)`, 34–36px targets, focus-within, gradient active preset) — dark-safe | ✅ (renders, no errors; pixel look not measurable headless) |
| P9 | lessons | `lecturer` was free-text; should be M2M to users | migration **014** `lesson_lecturers` (applied to live DB) + `מרצים מקושרים` toggle-chip block + Lessons/ModuleDetail show linked names | ✅ (toggle→DB persistence verified end-to-end) |
| P9-data | lessons | migration seeded **0** links: DB has 2 users but 36 lessons carry informal free-text lecturers (מור, אליאל, משותף) that aren't users | kept free-text `מרצה (שם חופשי)` alongside the M2M block (hybrid) so no info is lost | ✅ documented |

**QA env note:** DOM/accessibility snapshots, interactions, and live-DB checks all passed with **zero console errors** across Dashboard/Reps/RepDetail/Lessons/LessonDetail/Cycles/CycleDetail. Pixel-level visual verification (screenshot, `innerWidth`) was **not possible** — the headless preview reports `innerWidth:0` and screenshots time out; visual polish (P1 feed position under wide tables, P6 composer look, P8 colors) is verified by DOM structure + code, not by a rendered image.

**Concurrency note:** a second Claude session worked the same worktree/branch during this batch and swept the P7 changes into its unrelated commit `da07170` (per user direction to continue on the shared branch).

**Not yet done:** global click-through of every route; deploy to production (both pending your approval).

## Follow-up batch — scheduled emails + public API (2026-07-11)

| # | Area | Change | Verification |
|---|------|--------|--------------|
| S1 | email | Scheduled-email sending **hidden** behind `SCHEDULED_SEND_ENABLED=false` (ReplyComposer) — buggy/deprioritized. Backend (outbox + dispatch-outbox) left intact = restorable. TicketDetail hint updated. | ✅ live: no "תזמון" button, send="שלח", no scheduling hint, 0 console errors |
| S1-data | email | 1 pending test scheduled email (`Re: בדיקה` → sahar@, due 07-12 06:00) marked `canceled` in `outbox` so it won't fire | ✅ |
| S2 | public-api | Edge Function extended: **DELETE** (soft-delete via `deleted_at`; `?hard=true` permanent) + **GET filters** (`q`, exact-match cols, `from`/`to`, `limit`, `include_deleted`); list excludes soft-deleted. Deployed to prod. | ✅ live CRUD+filters verified for leads & tickets; prod 401+remediation on missing key |
| S3 | docs UI | New `ApiDocs` component (Settings → API): Swagger-like per-resource operation cards (search/get/create/update/delete) with method badges, field + filter tables, cURL, and a live "try it" console | ✅ renders (4 methods, 2 resources); in-UI "try it" GET → HTTP 200 + real data |

Deployed to prod `bina-plus.co.il/app` (build `index-C0Nf7EqF.js`) + `public-api` Edge Function.

## Verified working (frontend sweep — zero console errors on all 14 routes)
- All routes render; dark theme readable (dark bg + light text verified).
- Person card: related chips (expand+open), stage bar, section tabs, editable fields, custom fields render.
- Create order/opportunity from person → appears in Kanban ✓ (F4 fix).
- Modules M2M product+lecturer toggles persist to link tables ✓.
- Tickets: 16 rows, column menu, bulk select (2 → bar) ✓.
- Custom field added in Settings → renders on record ✓.
- Global search returns results ✓.

## Known limitations (documented, non-blocking — not bugs)
- **Kanban drag** is desktop HTML5-drag; on mobile use list view + detail stage-bar to change status.
- **Order/Opportunity person link** is read-only on the detail (creation/link is from the person card).
- **CloudChat iframe** may be blocked by their X-Frame-Options; the "open in CloudChat" link always works.
- **Field-level hiding** (e.g., commission from service reps) is not enforced yet (future).
- **Backup restore** is upsert-merge (recovers changed/deleted rows; doesn't delete rows created after the snapshot).

## Passed (backend)
- Finance: ERN 12→9%, 8→6%; credit 6→3%, 12→6%; other 0; edge 0 ✓ (9/9)
- public-api: read/write scopes, 403+remediation, 400/401, POST/PATCH, api_logs ✓ (8/8)
- RLS: non-manager cannot edit users ✓; sees unassigned ✓
