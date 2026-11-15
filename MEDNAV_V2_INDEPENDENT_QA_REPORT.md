# MEDNAV v2 — Independent Full-System QA

Audit completed 2026-11-14, Asia/Rangoon. Verification only: no application fixes, commit, push or merge.

## Verdict

**FAIL for unconditional full-system acceptance.** The primary manual-entry workflow works end to end, but two reproducible P1 presentation/consistency defects and one P2 mobile defect remain. Passing the existing regression suite does not cover these additional findings.

- **P1 / F1:** external API-saved observations refresh timeline/anatomy on crew selection while the original Vital Signs card keeps stale HR, sleep and BP.
- **P1 / F2:** Crew B's Live dashboard and Incident Report display the frontend-only `Optic sheath 5.1 mm (Recorded)` fixture. The actual backend has no such measurement; the selected Eye panel correctly says no assessment is recorded.
- **P2 / F3:** the mobile Incident Report produces a 470 px document at a 390 px viewport.

No P0, database corruption, cross-crew follow-up leak, real-engine substitution, unavailable-equipment selection or automatic medical diagnosis was observed in the executed scenarios. This is software verification of synthetic records, not clinical validation.

## Environment and isolation

- Worktree: `C:\Users\ZL_sht_H\MEDNAV-body-monitoring-v1`.
- Branch: `feature/body-system-monitoring-v1`.
- HEAD: `0d3c8d27874e3a29a0a881f0a126c6caaacf2aa1`, **with the pre-existing uncommitted v1/v2 implementation**. Testing HEAD alone would not reproduce this implementation. Pre-test file hashes identify the tested snapshot.
- Windows PowerShell; Python 3.13.1; Node 24.14.0; Vite 6.4.6; Microsoft Edge 157.0.4341.46 via real Playwright browser automation.
- Frontend: `http://127.0.0.1:5173/`; FastAPI: `http://127.0.0.1:8000/`.
- Interpreter dependencies were reused from the existing prepared environment. Application source was loaded from this v2 worktree, not the older integration checkout.
- The existing launcher stopped only its owned services. Independent mutations used **new** `.demo-runtime/independent-v2/audit.sqlite3`; the existing full browser regression suite used a second fresh `.demo-runtime/independent-v2/regression.sqlite3` so its starting data was independent of adversarial audit fixtures.
- Fresh seed was actually checked: Crew A/B/C, 21 synthetic health records and no follow-ups. The history/profiles, follow-up and evaluation routes were verified in actual OpenAPI.
- The legacy fixture endpoint/configuration remains available. That does not mean the new evaluation endpoint is a fixture: browser traffic called `/api/v1/investigations/evaluate`, and actual engine execution was traced independently.

Pre-existing source/untracked-file hashes, Git status and protected database hashes were saved before testing. Generated backend example JSON overwritten by the test suite was restored byte-for-byte from those snapshots. All pre-existing files remained unchanged. Protected v1/v2/integration databases retained their hashes. The pre-audit normal v2 services/database were restored after testing; disposable audit records remain only in their separate databases.

## Independent engine proof

A QA-only `sitecustomize.py` outside application source installed Python's profiling hook in the temporary server processes. It logged entry into the unchanged `evaluate_investigation()` function, its source filename, actual engine request and the calling adapter's check-in ID. It did not replace the function, alter a response or change a decision rule. Normal services were restored without this hook.

Evidence confirms calls from the actual HTTP flow into:

`C:/Users/ZL_sht_H/MEDNAV-body-monitoring-v1/backend/vendor/member3_stable/engine/next_check.py`

The complete 19-file vendored engine snapshot matches commit `2297c6af99a402a2aab354ed82eacd7335ec6b06` after normalizing Git/Windows text line endings. Rules provenance returned by HTTP includes `prototype:mednav_rules_demo-2`. Actual requests preserve null BP components, stored baselines, the selected record's values, synthetic dataset type, explicit communication state and manual override.

The profiler recorded 44 audit-engine calls across 9 saved IDs and 74 regression-engine calls across 16 IDs at the evidence snapshot. These are invocation evidence, **not additional passing test counts**. `diagnosis` remained null in inspected responses. Both `escalate` and valid `insufficient_evidence` responses had `next_check=null` as expected.

## Feature matrix

Evidence paths below are relative to `qa-evidence/independent-v2/` unless prefixed `.demo-runtime/`. The raw HTTP/HAR files contain synthetic test input and actual responses.

| Test ID | Feature | Expected | Actual | API | Database | Engine | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Q01 | Correct v2 source/live app | Correct worktree, fresh isolated seed, current routes | Profiler identifies v2 main.py and disposable DB; UI uses Live Backend | health 200; OpenAPI includes evaluate/follow-ups | 21 seed records, 0 events initially | Actual execution verified separately Q06 | PASS | `openapi.json`; `.demo-runtime/independent-v2/engine-trace.jsonl` |
| Q02 | Crew A/B/C dashboard summary | Current values, baselines, BP/missing state, timestamp/count match records | All three initial summaries matched API/SQLite; no other crew's saved IDs displayed | Profile/history GET 200 | Values, symptoms, UTC timestamps and baseline rows cross-checked | Per-crew startup evaluations traced | PASS | `01-overview.png`; `http.json`; `api-sql-crosscheck.json` in runtime |
| Q03 | Manual check-in | User input -> strict POST -> exact SQLite row | Crew A HR 91, sleep 5.25, BP null and symptoms saved; returned ID retrieved | POST check-ins 201; GET saved ID 200 | Read-only direct SQL matched entered values | Not required for saving | PASS | `http.json`; runtime `outcomes.json` Q03 |
| Q04 | Timeline 7/30 and filters | Actual chronological records, distinct same-date entries, source and null handling | 33 Crew A observations; exact last 7/30 timestamps; HR/Sleep/Symptoms views and fictional seed provenance verified | Actual paginated history GET | API IDs, values and timestamps cross-checked against SQL | None invented | PASS | `02-timeline.png`; `http.json`; Q04 |
| Q05 | Original canvas and monitoring | Click actual Heart/Brain/both Eyes; correct crew evidence | Real renderer/raycaster selected all four targets; HR/sleep/Unknown/source matched history; both eyes showed missing assessment | History/profile GET | Latest and seven recent saved IDs verified | No regional medical logic introduced | PASS | `03-heart.png`, `04-brain.png`, `05-eye-left.png`, `05-eye-right.png`, `08-mobile-dashboard.png` |
| Q06 | Exact historical investigation | Evaluate chosen old ID; render actual response | Request ID matched the chosen saved record; UI status, observations, missing data, constraints, flags, explanation, next check/review matched response | POST evaluate 200 | Used that saved row, not latest | Pinned function entry and actual input traced | PASS | `06-investigation.png`; `http.json`; engine trace; Q06 |
| Q07 | Follow-up persistence/isolation | Explicit POST, SQLite row, refresh retrieval, no cross-crew leak | Note and two explicit review requests persisted with distinct IDs and ordered timestamps; old record visible after refresh via all-current-crew history | POST 201; GET events 200 | Direct SQL verified note/crew/check-in ID | No treatment/approval/engine-output persistence asserted | PASS | `07-follow-up.png`; `http.json`; Q07 |
| Q08 | Invalid requests | Reject malformed readings and missing/mismatched references | Negative HR, sleep 25, malformed BP, absent/missing ID, blank note and wrong crew were rejected; no invalid event inserted | 404/422; redacted error shape | Event count unchanged after invalid writes | Invalid IDs not evaluated | PASS | `http.json`; Q08 |
| Q09 | Inventory/What-If/offline/override | Actual inventory drives eligibility; selected ID retained | UI PATCH changed SQLite availability; unavailable BP monitor never required by chosen check; manual override produced escalate/null | PATCH 200; evaluate 200 | Inventory checked and restored | Actual engine, explicit offline/override context | PASS | Q09 responses; HTTP/HAR; engine trace |
| Q10 | API failure/retry | Visible error, no silent fixtures, recover on retry | Aborted local API produced Backend unavailable and no engine result; retry restored Live Backend | Failed browser requests then real 200s | No fabricated row/result | No fixture substitute | PASS | `09-backend-error.png`; HTTP evidence |
| Q11 | Real local voice endpoint | Actual audio recognition and explicit audio errors | PocketSphinx transcribed known synthetic speech with heart-rate/headache words; empty WAV rejected | Transcribe 200; empty audio 422 | Transcription alone does not save a check-in | No cloud speech service | PASS, limited recognition case | `http.json`; Q11; existing browser voice tests |
| Q12 | Freshness after another API writer | All views show the same newly persisted observation | Timeline/body updated; Vital Signs retained old HR/sleep/BP; reproduced twice; refresh repaired it | POST 201; fresh history/profile GET correct | New row correct; no corruption | Engine uses current saved row | **FAIL — F1/P1** | `10-external-update-consistency.png`, `14-confirmed-stale-vitals.png`, `freshness-defect.json`, `Q12-failure.png` |
| Q13 | Complete one-browser journey | Manual save -> monitoring -> actual mesh -> exact engine -> follow-up -> refresh | Crew C HR 97/sleep 6.75/null BP propagated through all steps; follow-up note survived refresh; report export retained the same ID | Actual check-in/evaluate/follow-up requests | Direct SQL verified both rows | Exact saved Crew C ID evaluated | PASS | `11-new-record-heart.png`, `complete-journey-http.json`, `incident-preview.json`, `12-incident-preview.png` |
| Q14 | Frontend validation/inventory errors | Invalid values blocked visibly; invalid stock update rejected | Browser validity rejected negative HR/sleep 25; partial BP showed explicit message; no check-in POST; zero stock+available rejected | Inventory PATCH 422 | No invalid check-in inserted | No false medical result | PASS | `13-invalid-input.png`; supplement results |
| Q15 | Approved design comparison | Preserve original viewer/model/CSS | Original approved frontend rendered separately at 508b850; matched fixture/viewport captures and identical normalized viewer/scene/CSS hashes | Reference served on temporary 5179, then stopped | No reference DB used | No clinical comparison claimed | PASS | `visual-approved-*`, `visual-integrated-*`; runtime `reference-source.json` |
| Q16 | Persistence after server restart | Saved health/follow-up survive process stop/start | Actual audit server restarted; saved DTO and event matched original values | GET check-in/event 200 after restart | Same audit SQLite retained both | Normal engine availability restored | PASS | runtime `final-cases.json` Q16 |
| Q17 | All-Unknown/insufficient evidence | Unknown stays null; no false chart or ordinary next check | Seven null records produced 0/21 completeness, no numeric trend, explicit insufficient observations; insufficient_evidence/null rendered | Check-ins 201; evaluate 200 | Stored HR/sleep/BP all null | Real engine returned no permissible check | PASS | `15-insufficient-evidence.png`; runtime Q17 and engine trace |
| Q18 | Ocular source accuracy across screens | Unsupported eye exam must not appear as recorded backend evidence | Selected Eye panel says not recorded; hazard card/report display frontend `Optic sheath 5.1 mm (Recorded)`; report labels its source Saved synthetic record / Stable engine | Actual profile lacks ocularCheck; check-in schema has no ocular measurement | No ocular measurement column/row | Ocular fixture is not an engine input | **FAIL — F2/P1** | `16-ocular-contradiction.png`, `17-report-ocular-fixture.png`; runtime Q18 text/actual API response |
| Q19 | Mobile Incident Report | 390 px layout without horizontal overflow | Document/body width 470 px at viewport 390; report content clipped/overflowing | Actual live report | No persistence problem | Correct result still present | **FAIL — F3/P2** | `18-mobile-report-overflow.png`; runtime dimensions |
| Q20 | Detailed original model online | Load actual GLB and select real targets | CDN GLB HTTP 200, DETAILED ANATOMY visible; actual detailed-canvas Heart/Brain/Eye L/Eye R pointer clicks selected correct panels | CDN asset 200; local health data remains local | No scan/measurement inferred from model | Display geometry only | PASS | `19-online-model.png`, `20-detailed-canvas.png`; runtime `online-model.json`, `detailed-canvas.json` |
| B01 | Physical microphone/accent/noise validation | Live person speaks into the presentation microphone | No physical spoken session was available; fake microphone device and genuine audio bytes do not establish hardware/accent reliability | Actual WAV endpoint/browser transport tested | No automatic save | Not applicable | **BLOCKED — manual test required** | Explicit limitation; not counted as a software pass |

Q09's optional helper lookup for a button literally called Original did not execute because that label is absent. No repeated-preset PASS is attributed to that branch. The actual `Needs Review (Monitor Blocked)` repeated/rapid-preset/error-recovery case **did execute and pass** in the full browser suite, including ten repeated selections. The blocked initial detailed-eye helper attempt used the wrong hover label; only the QA helper was adjusted to recognize the detailed model's Eye L/Eye R names, then real pointer clicks passed for both eyes. No React handlers were called directly.

## Fresh regression results

| Suite | Passed | Failed | Skipped | Blocked |
| --- | ---: | ---: | ---: | ---: |
| Complete backend pytest | 141 | 0 | 0 | 0 |
| Standalone pinned engine tests | 35 | 0 | 0 | 0 |
| Frontend unit/contracts | 12 | 0 | 0 | 0 |
| Existing full Playwright suite | 24 | 0 | 0 | 0 |
| Independent executed workflow cases Q01–Q20 | 17 | 3 | 0 | 0 |
| Physical-microphone case B01 | 0 | 0 | 0 | 1 |

The 20 follow-up API tests and persistence/offline/API cases are **included in 141**. The three body tests, three timeline/follow-up tests, inventory tests, cross-crew tests, three voice tests and P1 preset regressions are **included in 24**. They are not counted again. Q12's successful reproduction of the defect is confirmation of the same failure, not an additional passing feature. Independent workflow cases are separate scenarios; do not add assertions or engine invocations to suite totals.

TypeScript/Vite production build passed. It still warns about the approximately 1.43 MB JavaScript chunk. Backend emits the existing Starlette/AnyIO deprecation warning. `git diff --check` passed. These warnings are not the three functional findings.

Commands actually run:

```text
# From backend/, using the existing prepared Python executable
python -m pytest -q --junitxml=../.demo-runtime/independent-v2/backend.xml
python -m pytest vendor/member3_stable/engine/tests -o pythonpath=vendor/member3_stable -q --junitxml=../.demo-runtime/independent-v2/engine.xml
# From frontend/
npm.cmd run build
npm.cmd run test:unit
npm.cmd test -- --workers=1 --reporter=list,json
# From worktree root: independent real-browser/API/SQL scripts
node .demo-runtime/independent-v2/audit.mjs
node .demo-runtime/independent-v2/supplement.mjs
node .demo-runtime/independent-v2/final-cases.mjs
node .demo-runtime/independent-v2/online-model.mjs
node .demo-runtime/independent-v2/detailed-canvas.mjs
```

The main independent audit intentionally exits nonzero for Q12; final-cases exits nonzero for Q18/Q19. Those are real acceptance failures, not installation errors. Re-running these scripts requires a newly seeded disposable audit DB because their test preconditions deliberately check seed counts; do not run them against an existing user's database or erase the current evidence to rerun them.

## Database and data-source findings

Read-only direct SQL inspection confirmed every current audit health record's ID, crew, HR, sleep, BP, symptom JSON array, provenance, synthetic flag and UTC timestamp against API history. All three recorded baselines matched SQLite. No null-to-zero conversion was found; sleep zero remained a legitimate recorded zero. The UI's January seed dates are labelled fictional/synthetic, and observation windows are not presented as calendar weeks.

At final audit:

| Disposable DB | Check-ins | Follow-ups | Unchanged original seed rows | Mismatched event pairs |
| --- | ---: | ---: | ---: | ---: |
| audit.sqlite3 | 57 | 4 | 21/21 | 0 |
| regression.sqlite3 | 35 | 3 | 21/21 | 0 |

Seed contents were compared against a fresh in-memory seed, not only counted. None changed. Follow-up notes were verified in SQLite and after browser refresh and server restart. Explicit repeated review requests create distinct append-only events; there is no idempotency or duplicate-action suppression contract. This was observed and is not a claim that treatment occurred twice. Blank notes/missing references/mismatched references did not insert invalid events.

Cross-crew IDs and event isolation passed; F1 is stale data **within the same crew**, not another crew's data. F2 is an illustrative fixture leaking into recorded-looking presentation, not a persisted ocular exam or engine-generated diagnosis.

Supported/live:

- Profiles, HR/sleep/BP/symptoms/baselines/history: synthetic SQLite records.
- Investigation status, observations, missing data, constraints, flags, next check, explanation/review: actual Stable v1 engine response.
- Inventory/What-If: trusted shared SQLite inventory, explicit communication/manual-override context. Availability changes persist; audit mutations were restored in their disposable DB.
- Follow-ups: user-recorded SQLite events; no officer identity or approval assertion.
- Voice: actual installed local PocketSphinx model; no cloud transcription in tested paths.

Not implemented or illustrative:

| Capability | Actual state |
| --- | --- |
| Independent ocular imaging/optic-nerve measurement storage | **NOT IMPLEMENTED**; Eye panel correctly Unknown, but F2 must be fixed elsewhere |
| Radiation/microgravity/ARED/body-mass telemetry persistence | **NOT IMPLEMENTED**; frontend fixtures, not health-history API measurements |
| NASA OSD-575 research visualization or engine input | **NOT IMPLEMENTED in this UI**; separate backend research loader/tests, not used by the synthetic engine |
| Durable incident-report/engine-result persistence | **NOT IMPLEMENTED**; session preview/export, not ground transmission |
| Medical approval, treatment verification or clinical outcome tracking | **NOT IMPLEMENTED**; follow-up enum/note does not supply these capabilities |

API requests and exported JSON correctly exclude unsupported telemetry from the strict check-in body. JSON report export separates `illustrative_telemetry`; the on-screen report fails to communicate that separation adequately, as F2 shows.

## Confirmed defects and recommended fixes

### F1 — P1: stale Vital Signs after an external check-in

Responsible component: frontend state/data integration (`frontend/src/api.ts`, dashboard/profile rendering). Backend storage/history and engine input were correct.

Reproduction:

1. Load Dashboard for Crew A in Live Mode, so the profile collection is cached.
2. Through the real API, append a synthetic Crew B record with HR 111, sleep 2.25 and BP null.
3. Select Crew B without reloading the browser.
4. Timeline and anatomy panel use the new saved history, but Vital Signs still shows HR 72, sleep 7.1 and BP 118 / 76, including 3/3 Recorded.
5. Repeated with a later HR 115/sleep 2.75/BP null record: summary/body updated while Vital Signs retained the previous values. Reloading then showed 115/2.75/Unknown correctly.

Root cause: history reloads on `crewId`, while profile reload depends on `live`, `revision` and `pendingWrites`, not crew selection or external changes. The original cards read `profiles`; timeline/body read `historyState.rows`. This splits the source of truth. The same single-browser UI save path increments revision, which explains why that workflow passes.

Recommended correction, not applied: derive all selected-crew recorded readings from one validated latest-history snapshot, or coordinate profile/history refresh so cards cannot present older readings as current. Preserve null BP when the latest check-in is null. Add the Q12 external-writer/switch/refresh regression before accepting the fix. No engine change is needed.

### F2 — P1: unpersisted ocular fixture presented as Recorded

Responsible component: frontend display adapter/fixture blending and report/hazard presentation (`frontend/src/types/api.ts`, `frontend/src/data/fixtures.ts`, `MissionConsole.tsx`). Backend contract intentionally has no ocular-measurement fields.

Reproduction:

1. In Live Mode select Crew B.
2. Click either eye: the Selected Anatomy panel correctly says ocular assessment is not recorded.
3. Inspect Space Radiation & microgravity: it shows `Optic sheath 5.1 mm (Recorded)`.
4. Open Incident Report: the same number appears under Microgravity ocular check (SANS), while Data Source says Saved synthetic record / Stable engine.
5. Actual profile/check-in APIs have no ocular field or saved optic measurement.

Root cause: `displayProfile()` deliberately merges unsupported display fields from the same crew's local fixture. That fixture contains the Recorded-labelled optic value. The newer Eye component bypasses it, but older hazard/report paths still use it. Global synthetic labels do not distinguish persisted synthetic evidence from a frontend-only illustrative exam. The export JSON is better separated, but the UI is contradictory.

Recommended correction, not applied: render unsupported ocular assessments as Unknown/Not Recorded throughout Live Mode; keep any demonstration number only behind explicit illustrative-fixture labeling. Separate persisted readings and illustrative fields in report source labels and coverage counts. Reuse existing visual components; do not add a clinical interpretation, ocular endpoint or engine rule to mask this presentation defect. Add a Crew B dashboard/report regression, not only Eye-panel assertions.

### F3 — P2: mobile Incident Report overflow

Responsible component: frontend report layout. At 390x844, `document.documentElement.scrollWidth` and body width are 470; report container itself is 358. Header/status content extends outside the intended viewport. Existing `.subpage-top-bar` uses a nonwrapping flex layout; it is a likely contributor, but the complete CSS root cause was not modified/instrumented in this verification task.

Recommended correction, not applied: scope wrapping/min-width handling to the report's mobile header/status content while preserving the approved desktop design. Verify scrollWidth <= viewport and inspect all report content after the change. Dashboard, body/timeline and follow-up mobile checks passed; this report-specific failure does not imply all mobile screens failed.

## Voice, offline behavior and visual preservation

All three existing voice browser cases passed freshly, including actual WAV-backed recording, real transcription and service-failure UI. A separate direct WAV request returned a real recognized phrase and rejected empty audio. These are limited recognition samples, not a speech-accuracy benchmark. No physical microphone/noise/accent test occurred (B01). Transcript review/apply/save remains mandatory; recognition alone did not persist medical observations.

Independent browser flows blocked all external hosts except localhost; local check-in, monitoring, follow-ups, inventory and evaluation remained functional. Existing socket-blocked backend/engine/voice tests passed. Earth-offline was supplied explicitly and was not confused with API disconnection. Optional remote fonts and detailed GLB need network/cache for that exact appearance; the original local schematic fallback worked offline. An additional unblocked browser check loaded the actual GLB with HTTP 200 and selected all four detailed targets by real pointer/raycast interactions.

Approved reference: local reachable `origin/feature/frontend-mission-console`, commit `508b850eb4566425a81aadebc2152c385a4f1e54`. Its tracked frontend was extracted to an ignored temporary reference directory and served separately; no teammate branch was changed. Identical Crew A fixture/Heart states at 1440x900 and 390x844 were captured for approved and integrated versions. BodyViewer, anatomyScene, styles.css and console.css are identical after CRLF/LF normalization. Eye label wording and new evidence content are intentional integration differences; animated particles and dynamic content mean screenshots are not claimed pixel-identical.

## Evidence index and preservation

Primary screenshots: [Overview](qa-evidence/independent-v2/01-overview.png), [Timeline](qa-evidence/independent-v2/02-timeline.png), [Heart](qa-evidence/independent-v2/03-heart.png), [Brain](qa-evidence/independent-v2/04-brain.png), [Eyes](qa-evidence/independent-v2/05-eye-left.png), [Investigation](qa-evidence/independent-v2/06-investigation.png), [Follow-up](qa-evidence/independent-v2/07-follow-up.png), [Mobile Dashboard](qa-evidence/independent-v2/08-mobile-dashboard.png).

Failure evidence: [Stale vitals](qa-evidence/independent-v2/14-confirmed-stale-vitals.png), [Ocular contradiction](qa-evidence/independent-v2/16-ocular-contradiction.png), [Report ocular fixture](qa-evidence/independent-v2/17-report-ocular-fixture.png), [Mobile overflow](qa-evidence/independent-v2/18-mobile-report-overflow.png).

Raw evidence is intentionally local and ignored:

- `qa-evidence/independent-v2/http.json`, `browser-api.har`, `complete-journey-http.json`, `freshness-defect.json`, `incident-preview.json`, `openapi.json`.
- `.demo-runtime/independent-v2/audit-index.json`, `outcomes.json`, `supplement-results.json`, `final-cases.json`, detailed-canvas/online-model results and script logs.
- `backend.xml`, `engine.xml`, `existing-browser.json` under that runtime directory.
- `api-sql-crosscheck.json`, `database-audit.json`, `reference-source.json`, `engine-snapshot-comparison.json`, engine trace JSONL and summary.
- `source-before.json`, `databases-before.json`, `preservation-result.json` prove pre-existing work/data preservation.

The protected original integration database retained SHA-256 `F19235B27E139A1281A5FD755B2F4F92C102BC76DC364D2CCB3AC876F9880147`. The prior v1 and v2 disposable databases also matched their pre-audit hashes before services were restored. Existing generated example artifacts were restored to their original bytes; no application source or existing test file was changed. The only new non-ignored deliverable is this report. No changes were committed or published.

## Readiness and next priorities

1. Frontend -> FastAPI -> SQLite works: **YES**, actual browser requests and direct SQL proved it.
2. Heart/Brain monitoring uses real saved synthetic records: **YES**. Eye symptom evidence is linked correctly; ocular measurements are unavailable. **F2 fails source accuracy on other screens.**
3. Timeline 7/30, same-day entries, timestamps, nulls and baseline arithmetic: **PASS in executed cases**.
4. Exact selected check-in reaches real Member 3 engine: **YES**, traced independently; no Member 3 correctness bug found in this audit.
5. Follow-up SQLite persistence after refresh/restart and crew isolation: **YES**.
6. Existing manual/inventory/What-If/override/error/preview/voice paths: fresh suite **24/24 passed**, with physical voice validation blocked and recognition accuracy still experimental.
7. Entire system consistent: **NO**, F1 and F2 need correction.
8. Internal guided team demonstration: **conditionally ready**, with known defects declared, a single controlled writer/refresh discipline, and no presentation of the ocular fixture as saved evidence.
9. Unqualified local competition demo readiness: **NOT YET**. Fix both P1 issues, rerun these independent acceptance cases and address or explicitly constrain the mobile report before claiming a fully integrated monitoring platform.

Priority order: fix F2's unsupported Recorded ocular presentation and F1's split-source freshness, then F3's report-only mobile overflow; separately run the actual presentation microphone manually. Preserve the existing model/design and engine rules during those fixes.

The implemented monitoring, history, missing-evidence, resource-aware explanation and offline workflow conceptually align with the health-monitoring objective supplied in the project brief. Official 2026 challenge wording, submission eligibility, judging criteria and NASA endorsement were not verified by this software audit. No software test here establishes clinical or mission-use validity.
