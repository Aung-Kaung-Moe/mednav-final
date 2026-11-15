# MEDNAV v2 — Confirmed QA Defect Fixes

## Scope and preservation

Worktree: `C:\Users\ZL_sht_H\MEDNAV-body-monitoring-v1`. Branch: `feature/body-system-monitoring-v1`. The existing uncommitted v1/v2 implementation was preserved; its tracked patch, untracked files and hashes were saved under ignored `.demo-runtime/qa-fixes/` before editing. No commit, push or merge.

This change addresses the three findings in `MEDNAV_V2_INDEPENDENT_QA_REPORT.md`. No FastAPI route, SQLite schema, medical decision rule, 3D geometry/model, BodyViewer control, dependency or shared API contract changed. New mutations used `.demo-runtime/qa-fixes/targeted.sqlite3` and a separate freshly seeded `regression.sqlite3`, never the original database.

## F1 / P1 — Stale Vital Signs

### Root cause

Dashboard/profile cards used cached profile readings while Timeline and Anatomy used newly fetched history. Crew switching refreshed the latter without refreshing profiles. Two separate asynchronous effects also made it possible for different snapshots to reach different components.

### Fix

- Profiles, inventory and complete typed history are fetched in one coordinated synchronization cycle on initial load, crew change, writes and explicit refresh.
- The selected crew's HR/sleep/BP/symptoms are projected from the **same latest validated history record** used by Timeline/Anatomy, rather than copied from an older profile response. Profile metadata/baselines still come from the real profile API.
- Null stays null, zero sleep stays zero and an empty/error history never inherits previous medical readings. A crew guard rejects mismatched records. Existing exact historical Investigation selection is retained separately from latest-record dashboard monitoring.
- Added `Refresh recorded data` to the existing dashboard action row and a `Last synchronized` timestamp in the existing Vital Signs card. Loading/failure state is explicit.
- Returning to Dashboard refreshes recorded data. Dashboard focus/visibility events are coalesced and throttled; there is **no interval polling**. Automatic focus revalidation is disabled on check-in/follow-up pages so it does not discard in-progress drafts there.
- Unchanged successful engine inputs reuse the last real response in memory during background synchronization. The key covers the immutable saved ID, explicit communication/override context, baselines and trusted inventory snapshot. Changed records/resources/context evaluate normally. Explicit Open Investigation and Retry force actual evaluation. There is no fixture substitute after a live failure.
- The focused test confirms an unchanged refresh produces **zero additional engine evaluations**.

Data propagation was checked for HR 111/sleep 2.25/BP null, a subsequent all-null record, and HR 99/sleep 4.75/BP 121 / 79. Vital Signs, Timeline and Anatomy agree after crew selection, refresh and focus-event handling. Crew switching and the existing exact-record workflows remain covered by regressions.

## F2 / P1 — False ocular measurement

### Root cause

`displayProfile()` merged unsupported fields from the frontend display fixture. Crew B's fixture contained `Optic sheath 5.1 mm (Recorded)`. The newer Eye panel correctly ignored it, but the original hazard card/report/coverage presentation still consumed it.

### Fix

- Live profile adaptation always makes `ocularCheck=null` under the current contract, even if a local fixture has a number. No backend ocular assessment exists and none was added.
- All Live hazard/report surfaces now display `Ocular assessment not recorded`; the existing Eye panel retains its fuller missing-assessment message. Visual symptom reports remain separate, actual saved strings with timestamps.
- Live Data Coverage counts only persisted HR/Sleep/BP slots, not illustrative radiation/microgravity/ocular fields. A short qualifier explains its scope inside the existing card.
- The report's source label now distinguishes the saved health record/real engine from other illustrative telemetry. Live JSON export retains a null ocular value in its illustrative section.
- The local fixture's string is explicitly `Illustrative optic sheath 5.1 mm (not recorded)`. Explicit fixture mode retains its demonstration capability without claiming an examination was recorded.
- Browser tests cover Crew A/B/C across Dashboard, Eye panel, Timeline, Incident Report and JSON export. Unit tests ensure every live crew adapter discards ocular fixture values.

No SANS finding, optic measurement, ocular endpoint or clinical interpretation was invented.

## F3 / P2 — Mobile Incident Report overflow

### Root cause

The nonwrapping `.subpage-top-bar` pushed the `LOCAL PREVIEW · NOT TRANSMITTED` status badge outside the report. Browser measurement identified that badge as the overflowing element. The document was 470 px wide at both 375 px and 390 px viewports.

### Fix

Added a report-specific class and a **max-width 600 px** media rule. Only the Incident Report header may wrap; the status badge gets its own flexible row and bounded width. Existing desktop selectors, typography, colors, navigation, columns and card rules were not changed.

Actual measurements:

| Viewport | Before document width | After document width | After overflowing report elements |
| --- | ---: | ---: | ---: |
| 375x844 | 470 | 375 | 0 |
| 390x844 | 470 | 390 | 0 |

At 1440x900, report column x-positions/widths match the captured pre-fix geometry exactly. Content and JSON download functionality remain tested.

## Files changed for these fixes

- `frontend/src/api.ts` — coordinated synchronization, event-driven revalidation, last-real-response reuse, explicit refresh/forced evaluation and scoped synchronization state.
- `frontend/src/types/api.ts` — live ocular masking and `recordedProfile()` history projection.
- `frontend/src/main.tsx` — Dashboard-only focus refresh, return-to-dashboard refresh and synchronization props.
- `frontend/src/components/MissionConsole.tsx` — existing-card refresh/status UI, truthful ocular/report text, persisted-only coverage and report-specific class.
- `frontend/src/data/fixtures.ts` — explicitly illustrative ocular wording, not a change to original Member 4 data.
- `frontend/src/console.css` — narrowly scoped mobile report wrapping only.
- `frontend/audit/contract-unit.mjs` — null/zero/crew projection and ocular provenance regressions.
- `frontend/tests/qa-fixes.spec.ts` — four focused real-HTTP browser regressions, before/after measurements and screenshots.
- This report.

Pre-existing backend/model/schema/test changes from earlier v2 work remain untouched by this task. No other team member's engine/data folders were modified.

Preservation verification found exactly the seven intended existing frontend files changed (the new regression file/report are additions). All protected database hashes matched their pre-task snapshots, including the original integration database SHA-256 `F19235B27E139A1281A5FD755B2F4F92C102BC76DC364D2CCB3AC876F9880147`. Generated backend test-example JSON was restored to its pre-task bytes. The normal v2 services/database were restored after testing and remain available at http://127.0.0.1:5173/ .

## Verification

The four new browser regressions were executed **before fixes**: 0 passed / 4 failed. They reproduced stale readings, ocular presentation in Live/fixture contexts and report overflow. After the fixes, **4 passed / 0 failed / 0 skipped** before starting the full suite.

The first post-fix attempt passed the ocular and layout checks but did not get a native focus event from headless Edge's `bringToFront()`. The browser test now dispatches actual DOM focus/visibility events to exercise the installed lifecycle listeners; it does not call React handlers or mock medical/API responses. Physical OS Alt-Tab behavior is not claimed as a separately executed manual test. The visible refresh control is independently tested against real HTTP data.

| Final suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend pytest | 141 | 0 | 0 |
| Pinned standalone engine | 35 | 0 | 0 |
| Frontend unit/contracts | 14 | 0 | 0 |
| Full Playwright browser suite | 27 | 1 | 0 |

TypeScript/Vite build passed. The existing large-bundle warning and Starlette/AnyIO deprecation warning remain. The 4 focused cases are part of the full browser suite, not additional unique test counts. Follow-up API/persistence cases are included in backend 141 and browser monitoring/integration suites; do not count them twice.

All **25 non-voice browser cases passed**, including the four new fixes, original canvas interactions, exact historical evaluation, What-If, emergency override, follow-up refresh persistence, crew isolation and error recovery. Two voice cases passed (error handling and actual WAV recorder/endpoint compatibility). The remaining `voice.spec.ts:14` phrase-accuracy case failed: expected `heart rate`, received `are greedy be a sleep for hours i have a headache heartbreaking`. This reproduces the previously documented recognition issue; speech code was not changed, assertions were not relaxed, and the full suite was not repeatedly rerun to obtain a green voice result.

Commands executed from the documented backend/frontend working directories with the existing prepared environment:

```text
python -m pytest -q --junitxml=../.demo-runtime/qa-fixes/backend.xml
python -m pytest vendor/member3_stable/engine/tests -o pythonpath=vendor/member3_stable -q --junitxml=../.demo-runtime/qa-fixes/engine.xml
npm.cmd run build
npm.cmd run test:unit
npx.cmd playwright test tests/qa-fixes.spec.ts --workers=1 --reporter=list,json
npm.cmd test -- --workers=1 --reporter=list,json
```

## Before/after evidence

Local ignored artifacts in `qa-evidence/qa-fixes/`:

- `before-vitals.png` / `after-vitals.png` — the original stale card versus matching saved readings.
- `before-ocular-dashboard.png` / `after-ocular-dashboard.png` — old Recorded fixture versus missing assessment in Live Mode.
- `before-report-desktop.png` / `after-report-desktop.png` — preserved desktop report composition.
- `before-report-375.png` / `after-report-375.png` and `before-report-390.png` / `after-report-390.png`.
- `before-report-widths.json` / `after-report-widths.json` — actual widths/offending elements.
- `after-sync.json` — real saved records, request count evidence and focus-test method.

Runtime test artifacts are in `.demo-runtime/qa-fixes/`: before-browser JSON, targeted-after JSON, full-browser JSON, backend/engine JUnit and the original desktop geometry snapshot. Test database/environment files and evidence were not staged or committed.

## Design preservation, limitations and readiness

The original 3D viewer/model, controls and animations remain untouched. Dashboard composition, existing components, navigation and desktop styling remain in place. Intentional additions are one existing-style refresh button, synchronization/provenance qualifiers and corrected data values. The only layout-rule change is the report-only mobile media block.

There is no continuous polling or cross-computer push stream. On Dashboard, crew selection, returning to the dashboard, explicit refresh and visible focus events synchronize data. Other pages retain their intentional selected-record/draft context; refresh from Dashboard when new external observations are expected. The displayed synchronization time is a fetch time, not a medical observation timestamp.

Physical microphone verification was not performed. PocketSphinx remains experimental and transcript review/explicit save is required. Ocular measurements, radiation/microgravity persistence, durable incident reports, clinical validity and officer approval are not supplied by these fixes.

**Readiness:** all three confirmed defects are resolved in the executed regression scenarios. The core monitoring application is ready for a guided team/local-competition demonstration with synthetic data and manual check-in as the reliable entry path. The full automated suite is not entirely green because voice phrase recognition remains unreliable; do not promise dependable voice entry or claim physical microphone validation. Perform a short presentation-machine smoke check and use explicit transcript review/manual entry. No approval, diagnosis, treatment outcome or NASA endorsement is implied by successful software tests.
