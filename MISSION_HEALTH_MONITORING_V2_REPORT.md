# MEDNAV v2 — Mission Health Monitoring, Timeline & Follow-Up

## Workspace, preserved work and scope

Implemented locally in `C:\Users\ZL_sht_H\MEDNAV-body-monitoring-v1`, on the existing `feature/body-system-monitoring-v1` branch. No commit, push or merge. The previously uncommitted v1 implementation remains present; before editing, its tracked diff and untracked files were archived under ignored `.demo-runtime/v1-preservation/`. The published integration ancestor remains `0d3c8d2`.

The original integration worktree and database are preserved. v2 live testing uses a new disposable SQLite file `.demo-runtime/mission-v2.sqlite3`; the prior v1 disposable database was not reset or overwritten. Existing seeded data is left intact. Tests also create their own temporary databases.

## Features and data flow

Daily check-in -> existing SQLite history API -> typed chronological records -> mission summary/timeline -> unchanged 3D evidence panels -> explicitly selected saved check-in -> real Stable v1 engine -> user-recorded persisted follow-up event.

- The dashboard's existing health-history card now contains the live Mission Health Timeline when its existing Heart Rate view is selected. Sidebar, navigation, original dashboard cards, colors, CSS and 3D controls/model remain unchanged. Radiation/exercise tabs retain explicitly illustrative behavior.
- Mission summary displays latest recorded HR, sleep, BP, personal baselines, signed descriptive differences, missing measurements, timestamp, observation count and reported symptoms. Null is Unknown; sleep zero is a recorded zero. Baseline arithmetic uses rounding for presentation, not medical thresholds or a health score.
- Metric filters show HR, Sleep or Symptoms across the last 7 or 30 recorded observations. Records are sorted by actual timestamps with ID tie-breaking. Multiple same-date records remain separate. The metric filter does not drop Unknown entries. Charts use actual numeric readings, leave null gaps and display the recorded baseline. No dates are manufactured and no calendar-week claim is made. With fewer than two numeric readings, the UI displays `Insufficient recorded observations for trend comparison.`
- Each timeline entry can be inspected with complete HR/sleep/BP, symptoms, crew ID, saved ID, timestamp and provenance. Completeness counts the known HR/sleep/BP slots in the displayed window.
- Heart/Brain/Eye actions use the original selection state and viewer. Body panels still clearly show the crew's latest recorded evidence; the timeline inspector retains the chosen historical entry. Eyes show recorded visual symptom reports and missing ocular evidence, never a fabricated exam or ocular trend.
- `Investigate Selected Observation` evaluates that exact saved ID. The backend hook rejects unavailable selections rather than choosing another record. Investigation/What-If/report views use that record's measurements, while Dashboard remains latest-record monitoring. Inventory/context changes re-evaluate the selected record. Crew changes clear the previous selection and isolate records. A fresh check-in selects its returned saved ID.
- Investigation initializes its existing history scrubber on the evaluated record and explicitly identifies the saved ID/time. Moving the scrubber only inspects history; it does not silently select another engine input. The live accessibility label refers to recorded observations rather than a seven-calendar-day period.
- Follow-Up Record appears beneath the original styled Investigation UI. Users explicitly record a note, request review or record an action. History reloads from SQLite; a current-record/all-current-crew toggle controls scope. Loading, validation and API failures are visible. No event is created simply by viewing, evaluating or refreshing.

## APIs and database model

Existing routes are reused without incompatible changes:

- `GET /api/v1/astronauts`
- `GET /api/v1/astronauts/{id}/history` (paginated)
- `POST /api/v1/check-ins` (unchanged strict schema)
- `POST /api/v1/investigations/evaluate` (unchanged explicit context and canonical engine response)
- Existing inventory GET/PATCH and legacy fixture investigation endpoints.

New additive routes:

- **POST `/api/v1/follow-ups`**, HTTP 201. Required `astronaut_id`, `check_in_id`, `event_type`; optional `note` except a `note_recorded` event requires nonblank text. Types: `review_requested`, `note_recorded`, `action_recorded`. Extra fields are forbidden. Notes are trimmed and limited to 2000 characters.
- **GET `/api/v1/astronauts/{astronaut_id}/follow-ups`**, HTTP 200 array, optional `check_in_id`, `limit` (1–1000, default 100), `offset` (default 0). Ascending `(recorded_at,id)` order. Frontend retrieves all pages for the selected scope.

`follow_up_events`: server UUID `id`, indexed `astronaut_id` and `check_in_id` foreign keys, `event_type`, nullable `note`, indexed `recorded_at`, server `provenance`, `synthetic=true`. Existing startup creates the new table through `Base.metadata.create_all`; no destructive migration or change to existing tables is required. Existing-row preservation is tested.

The API validates the crew/check-in pair and synthetic restriction before committing in the same session; SQLite foreign keys additionally reject nonexistent references. Pair validation is at the API boundary, not a new composite database constraint. Unsupported direct SQL that bypasses the API is outside the workflow contract.

Unknown crew/check-in: 404 string `detail`. Mismatched pair: 422 string `detail`. Schema/enum/blank or oversized note/extra-field/pagination errors: existing redacted 422 detail array. Errors do not echo note contents. Full contract: [backend/integration/FOLLOW_UP_API_V1.md](backend/integration/FOLLOW_UP_API_V1.md). OpenAPI remains `/openapi.json`; `/docs` remains disabled.

## Provenance and safety

Health measurements and historical January 2026 mission records remain synthetic. Exact source strings from each saved record are displayed. Baselines come from SQLite astronaut profiles; no normal ranges or severity classes are invented. Event timestamps identify recording time, not treatment time or symptom onset. Event provenance states that a user recorded workflow documentation and no medical approval is implied.

NASA OSD-575 remains isolated research data and is not linked to these synthetic decisions. The engine remains unchanged at vendored commit `2297c6af99a402a2aab354ed82eacd7335ec6b06`, rules `demo-2`. Radiation, microgravity, mass and unsupported anatomy telemetry remain illustrative. Voice retains explicit review/apply/save. Incident Reports and downloads remain session previews; investigation outputs and reports are not automatically persisted or synchronized with Earth.

## v2 files added/changed

Backend:

- `backend/app/database.py` — additive FollowUpRow.
- `backend/app/schemas.py` — strict create/read event models.
- `backend/app/follow_ups.py` — create/history routes, reference checks, UTC serialization.
- `backend/app/main.py` — register additive routes.
- `backend/tests/test_follow_ups.py` — validation, persistence/restart, isolation, pagination, rollback/FK and old-table preservation checks.
- `backend/integration/FOLLOW_UP_API_V1.md` — exact contract.

Frontend:

- `frontend/src/components/MissionHealthTimeline.tsx` — existing-card timeline, summary, charts, record inspection and actions.
- `frontend/src/data/missionMonitoring.ts` — descriptive arithmetic and completeness only.
- `frontend/src/components/FollowUpPanel.tsx` — explicit event creation/history using existing styled inputs/buttons/card.
- `frontend/src/api.ts` — exact-record investigation state and paginated follow-up client.
- `frontend/src/types/api.ts` — follow-up DTOs.
- `frontend/src/main.tsx` — selected-record context and follow-up integration.
- `frontend/src/components/MissionConsole.tsx` — live history card content and body selection wiring.
- `frontend/audit/contract-unit.mjs` — arithmetic/Unknown/zero/completeness tests.
- `frontend/tests/mission-monitoring.spec.ts` — actual-browser timeline/follow-up flows.
- `frontend/tests/compatibility.spec.ts` — compare the real status for pre-existing saved records instead of assuming every record is needs_review.
- This report. The v1 report/components/data/tests remain preserved separately.

## Executed verification

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend pytest, including new follow-up cases | 141 | 0 | 0 |
| Standalone pinned engine | 35 | 0 | 0 |
| Frontend unit/contracts, final | 12 | 0 | 0 |
| Full browser suite | 24 | 0 | 0 |
| Final timeline/cross-screen targeted browser regression (overlaps full suite) | 6 | 0 | 0 |

TypeScript/Vite build passes. Existing large-bundle and Starlette/AnyIO deprecation warnings remain. The 20 follow-up backend cases are included in 141, not an additional independent suite. Targeted browser runs overlap the full suite and must not be summed.

The full browser run passed before the final scrubber saved-ID/readout clarification. After that small display change, build and unit tests passed again, and the six affected timeline/follow-up/cross-screen cases passed, including an assertion that the scrubber starts at the selected historical record. Empty/sparse timeline behavior is additionally verified by rendered-component unit tests. All three existing voice browser cases passed this run; recognition reliability limitations still apply.

Verified real browser flows include three-crew monitoring, same-day duplicate-date records, baseline arithmetic, Unknown readings, timeline metric/window controls, actual canvas clicks, exact historical engine request/response, inventory/What-If/override regressions, explicit follow-up POST 201, retrieval after refresh, all three event types, mismatch/unknown-reference rejection, API failure/retry and no mock fallback. New timeline/follow-up browser tests block external traffic while allowing localhost; no medical responses are mocked.

Intermediate failures were investigated rather than hidden: expanding the investigation callback signature initially forwarded a click event as a saved ID; an explicit wrapper fixes that and the v1 body-to-engine test passes. A validation test incorrectly searched for the word `input` in error messages; it now checks that no raw `input` field is echoed. An old cross-crew test assumed needs_review for an all-Unknown check-in; its assertion now compares the actual real-engine response for that exact saved ID, preserving the valid insufficient_evidence state.

## Screenshots and evidence

Local ignored artifacts in `qa-evidence/mission-v2/`:

- `timeline-desktop.png`, `timeline-mobile.png`
- `follow-up-desktop.png`, `follow-up-mobile.png`

v1 body-model evidence remains in `qa-evidence/body-monitoring/`. The original BodyViewer, 3D scene, models and CSS have no source changes. New content reuses original card/button/form styling; only added functional content changes card height. No pixel-identical claim is made for dynamic records. Offline screenshots use the original schematic fallback; detailed CDN asset loading was not re-certified. Existing mobile Incident Report overflow is separate from the tested new panels.

JUnit/browser artifacts: `.demo-runtime/v2-backend-junit.xml`, `v2-engine-junit.xml`, `v2-final-browser.json`, `v2-final-targeted-browser.json`, `timeline-verified-browser.json`, `v2-targeted-browser.json`. Generated outputs are not source dependencies and are not committed. The original integration database SHA-256 remains `F19235B27E139A1281A5FD755B2F4F92C102BC76DC364D2CCB3AC876F9880147`.

Final screenshot-only regression: 3/3 mission browser cases passed after adding a wait for the original mobile sidebar transition to finish before capture. This removes mid-animation screenshot occlusion without changing UI code. A direct SQLite audit of the disposable database at completion found 61 check-ins, 15 follow-up events and zero mismatched crew/check-in event pairs; these are test-run snapshot counts, not fixed seed counts.

Commands executed from backend/ with the existing prepared Python: `python -m pytest -q --junitxml=../.demo-runtime/v2-backend-junit.xml` and `python -m pytest vendor/member3_stable/engine/tests -o pythonpath=vendor/member3_stable -q --junitxml=../.demo-runtime/v2-engine-junit.xml`. Frontend commands: `npm.cmd run build`, `npm.cmd run test:unit`, `npm.cmd test -- --workers=1 --reporter=list,json`; final targeted command: `npx.cmd playwright test tests/mission-monitoring.spec.ts tests/compatibility.spec.ts --workers=1 --reporter=list,json`.

## Run and manual demo

Preview: http://127.0.0.1:5173/ ; FastAPI: http://127.0.0.1:8000/api/v1 . Current servers use the new disposable v2 DB. From this worktree, using the already prepared environment:

```powershell
$env:MEDNAV_DATABASE_URL='sqlite:///C:/Users/ZL_sht_H/MEDNAV-body-monitoring-v1/.demo-runtime/mission-v2.sqlite3'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-mednav-demo.ps1 -PythonPath C:/Users/ZL_sht_H/MEDNAV-first-live-demo/backend/.venv/Scripts/python.exe
```

For an independent environment, follow TEAM_SETUP_GUIDE.md; new routes require no added dependencies. Start a new backend process after code changes; the launcher does not hot-reload an already-running backend. Do not reset an existing DB. Stop this checkout with `scripts/start-mednav-demo.ps1 -Stop` before starting another checkout on the same ports.

1. Dashboard -> select Crew A/B/C -> inspect latest vitals and scroll to Mission Health Timeline under the existing Heart Rate history tab.
2. Choose HR, Sleep or Symptoms; select Last 7/30 Recorded Observations. Inspect a timestamped row; Unknown remains Unknown.
3. Open Heart/Brain/Eye evidence from that entry. Body panels show the crew's latest evidence; the timeline inspector explicitly retains the historical entry.
4. Investigate Selected Observation -> check the saved ID and actual engine result. What-If/override evaluate the same selected ID.
5. Below Investigation, type a note and Record Follow-Up Note, or explicitly Mark Review Requested/Record Action. View Follow-Up History or select all events for the current crew.
6. Refresh, reselect the crew and reopen Investigation. For older-record events, use all-crew follow-up history or reselect that timeline entry. Events remain stored even though temporary UI selection resets.

## Remaining limitations

- Refresh resets temporary crew/region/historical selection; the default latest check-in is evaluated. Old-record events are still persisted and available via all-current-crew history.
- Follow-ups are user assertions; no authentication, medical-officer approval, treatment verification, task completion or ground sync exists.
- No independent ocular measurements, clinical prediction, automated treatment or new medical rules.
- Notes are plain text, limited to 2000 characters; no attachments, edits, deletes or automatic report snapshots in v2.
- Completeness measures available HR/sleep/BP slots, not data quality, clinical sufficiency or organ health.
- Existing experimental voice recognition, external font/detailed-model assets and unrelated mobile report issues remain documented.
