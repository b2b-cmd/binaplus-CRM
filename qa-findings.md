# QA Findings — בינה+ CRM

| # | Layer | Severity | Screen/Area | Finding | Fix | Status |
|---|-------|----------|-------------|---------|-----|--------|
| F1 | Backend/RLS | HIGH | people/tickets | `FOR ALL using(true)` write policy also governs SELECT → per-rep read restriction bypassed; non-manager sees other reps' records | migration 007: split write into INSERT/UPDATE/DELETE so SELECT obeys the read policy | ✅ fixed (RLS 20/20) |
| F2 | Frontend | LOW | useColumns.js | dead-code `k !== t ? true : true` in dropOn | simplify | ✅ fixed |
| F3 | Frontend | MED | Tasks/ActivityFeed | hardcoded light colors (#fff8e6/#fdecec) break dark theme | use CSS vars + dark overrides | ✅ fixed |
| F4 | Frontend | HIGH | PersonDetail/Opportunities/Orders | RecordLayout refactor dropped add-order/add-opportunity → **no way to create orders/opps in UI** | quick-add 🎯/📄 actions on person card (linked+navigate) | ✅ fixed |

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
