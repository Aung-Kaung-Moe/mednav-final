# MEDNAV BodyGraph v3 implementation and verification

Verified locally on 15 November 2026 (Asia/Rangoon). Branch: `feature/body-system-monitoring-v1`; starting HEAD: `0d3c8d27874e3a29a0a881f0a126c6caaacf2aa1`. Results include uncommitted v1/v2 work preserved from the start of this task. No commit, push, merge, database reset, shared-contract change, or decision-rule change was performed.

## Delivered workflow

Selected crew → saved SQLite history → exact-record Mission Replay → eight-system evidence navigator → cross-system recorded observations → real Stable v1 investigation → existing persistent follow-up workflow.

The new controls are inside the existing Selected Anatomy card. The sidebar, navigation, investigation/What-If layouts, model assets and renderer remain in place. Existing fixture mode remains explicit; BodyGraph replay operates in Live Mode and never substitutes fixture evidence after a history failure.

## Regions and evidence

| Region | Recorded evidence shown | Explicitly unsupported or missing |
|---|---|---|
| Heart / Cardiovascular | HR, BP, recorded HR baseline, up to seven saved HR observations, relevant original symptom text | Null HR/BP remains Unknown; baseline difference is descriptive only |
| Brain / Sleep | Sleep duration, recorded sleep baseline, saved observations, original headache/dizziness/fatigue/sleep-related reports | Null sleep remains Unknown; sleep is not a neurological examination |
| Eyes / Ocular | Original visual-symptom reports, timestamps and source | Ocular assessment not recorded; no imaging, optic-nerve value, SANS finding or ocular trend is invented |
| Muscles / Exercise | Recorded fatigue/weakness/muscle/exercise-related symptom text | No persisted activity log or strength measurement; existing ARED fixtures excluded |
| Bones / Skeletal | Recorded skeletal/joint-related symptom text | No bone density or skeletal imaging |
| Vestibular / Balance | Recorded dizziness/vertigo/balance-related symptom text | No verified vestibular assessment |
| Lungs / Respiratory | Recorded cough/breathing-related symptom text | No respiratory rate, oxygen saturation or lung-function measurement |
| Skin / Immune | Recorded skin/rash/fever/immune-related symptom text | No verified skin assessment or immune laboratory measurement |

Text matching is navigation only: complete original strings, including negation, are displayed. A matching report is not a confirmed clinical finding. No new clinical thresholds, scores, associations, diagnoses, sensors or source records were introduced. NASA OSD-575 research remains separate and is not fed into these panels or investigations.

Each enhanced panel identifies the selected record and source, latest relevant recorded evidence through that point, missing measurements and a link to the existing investigation. Other body parts keep their explanatory behavior. Existing meshes are reused; eight accessible region labels provide selection even when a model has no corresponding mesh.

## Replay and coverage behavior

- The mission-time selector uses actual saved ISO timestamps and check-in IDs, including multiple observations on the same date. Return to latest restores current monitoring.
- Replay slices ordered history at the exact selected record. Later records cannot enter that replay's charts, symptom history or cross-system list. No interpolation or invented dates.
- The dashboard's current Vital Signs and main timeline summary deliberately remain latest-record views. The anatomy card clearly labels REPLAY, crew, timestamp and ID. This avoids representing an older observation as current.
- Switching crew immediately invalidates another crew's replay selection; malformed/mismatched evidence or missing selected IDs fail visibly. Null remains Unknown and recorded sleep zero remains zero.
- The cross-system disclosure compares HR/sleep with recorded baselines, BP and reported symptoms for the last seven recorded observations through the selected point. It does not infer causation.
- Evidence states may coexist: **Recorded evidence**, **Descriptive baseline change**, **Missing evidence**, **Review available**. Review available means a saved check-in can open the engine workflow, not that a medical officer reviewed it.
- Coverage glyphs annotate the viewer's original quick selectors and the accessible eight-region list. Organ materials are deliberately not recolored: this is an evidence annotation map, not a clinical heatmap. The text legend explains every state.
- Cross-system/follow-up lists have bounded scrolling so expanded history does not stretch the adjacent canvas without limit. Existing card and typography styles are reused.

## API, engine and persistence

No application endpoint, SQLite model, migration or approved public contract was added or changed for v3.

Reused APIs:

- `GET /api/v1/astronauts` and `GET /api/v1/astronauts/{id}/history` for recorded profiles, baselines and full typed history.
- `POST /api/v1/investigations/evaluate` with the exact selected saved `check_in_id` and existing explicit communication/emergency context.
- Existing inventory APIs and existing real-engine adapter remain authoritative for resource availability.
- `GET /api/v1/astronauts/{id}/follow-ups?check_in_id=...` for the new read-only replay disclosure; existing investigation follow-up actions explicitly create events through `POST /api/v1/follow-ups`.

Opening or replaying an observation does not create a follow-up event. The read-only disclosure retrieves the last five events; Investigation retains full history and explicit note/review/action recording. Browser verification saved a note, refreshed, selected the same historical ID and retrieved the exact persisted event without creating another event.

Pinned engine remains `2297c6af99a402a2aab354ed82eacd7335ec6b06`, rules `demo-2`. The adapter's current inventory and explicit context are used when investigating a historical check-in; replay does **not** reconstruct historical inventory, communications, baseline versions or a past engine result. Unsupported system measurements do not extend the engine's approved input fields or rules.

## Files changed during this task

Existing files extended, preserving their pre-task changes:

- `frontend/src/components/BodyViewer.tsx`: evidence annotations only; original stage mounting, model, camera and controls preserved.
- `frontend/src/components/MissionConsole.tsx`: crew-scoped replay state, evidence propagation and exact-ID investigation connection.
- `frontend/src/components/BodySystemMonitoring.tsx`: replay-aware original panels and five additional honest evidence/missing-data panels.
- `frontend/src/components/MissionHealthTimeline.tsx`: selected-record replay and Heart/Brain/Eye navigation bridge.
- `frontend/src/data/bodyMonitoring.ts`: shared region mapping and fractional-timestamp ordering so records within the same millisecond are not incorrectly ordered by UUID.
- `frontend/src/console.css`: scoped evidence glyph/list styles and bounded disclosure lists.
- `frontend/audit/contract-unit.mjs`: two new BodyGraph unit tests.

New files:

- `frontend/src/data/bodyGraph.ts`: typed region registry, evidence states, symptom navigation and replay adapter.
- `frontend/src/components/BodyGraphNavigator.tsx`: replay selector, coverage legend, cross-system disclosure and recorded follow-ups.
- `frontend/tests/bodygraph.spec.ts`: three real-browser BodyGraph workflows.
- `backend/evaluation/bodygraph_cases.json`: ten predeclared synthetic evaluation cases.
- `backend/evaluation/bodygraph_v3.py`: isolated real-API/engine software evaluation.
- `backend/tests/test_bodygraph_evaluation.py`: repeatability and invariant verification.
- This report.

Backend application code, Member 3 engine source, original Member 4 data, original anatomy renderer and existing reports were not edited by this task. Backend tests regenerate two tracked HTTP example files; their exact pre-task bytes were restored afterward.

## Verification environment and actual results

Windows, Python 3.13, Node 24.14, Edge/Playwright. The existing environment from `../MEDNAV-first-live-demo/backend/.venv/Scripts/python.exe` was reused. No environment or model was downloaded. These results do not constitute a fresh-install test.

Mutation testing used new disposable databases under `.demo-runtime/bodygraph-v3/`, including a fresh `regression.sqlite3` for the full browser suite. Python evaluation uses its own temporary SQLite database and removes it afterward. SHA-256 checks confirmed all three protected pre-existing databases remained byte-identical, including after the normal services were restored.

| Suite / command | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Backend: `python -m pytest -q` from `backend/` | 142 | 0 | 0 |
| Pinned engine: `python -m pytest vendor/member3_stable/engine/tests -q` with `PYTHONPATH=vendor/member3_stable` | 35 | 0 | 0 |
| Frontend: `npm.cmd run test:unit` | 16 | 0 | 0 |
| Full browser: `npx.cmd playwright test --workers=1 --reporter=list,json` | 30 | 1 | 0 |
| Frontend: `npm.cmd run build` (`tsc --noEmit && vite build`) | Build succeeded | — | — |

Counts are separate suites, not cumulative totals of repeated focused runs. The new evaluation test is included in the 142 backend tests; the three new BodyGraph cases are included in the full browser suite. Focused BodyGraph verification separately completed 3/3. Initial focused runs exposed a duplicate history-error announcement and test assertions affected by capitalization/reused test text; these were corrected, not counted as final passes. The complete browser run subsequently passed all six BodyGraph/body-monitoring tests.

Final review additionally corrected fractional timestamp ordering: SQLite microseconds must not be discarded before sorting same-millisecond observations. After that change, unit tests again passed 16/16, the TypeScript/Vite build succeeded, and the affected browser suites were rerun on another new disposable database: **9 passed, 0 failed, 0 skipped** (`bodygraph.spec.ts`, `body-monitoring.spec.ts`, `mission-monitoring.spec.ts`). These overlap the full suite and must not be added to its totals. Final targeted logs: `.demo-runtime/bodygraph-v3/final-monitoring-browser.{json,txt}`. The entire 31-test browser suite was not repeated after this targeted correction; its 30/1 result above is the actual earlier complete run.

Full browser coverage passed: eight region labels; exact replay without future leakage; crew switching; null/zero readings; real canvas Heart/Brain/both Eyes raycasts; historical-ID real-engine evaluation; follow-up refresh/isolation; timeline ordering; check-in persistence; inventory/What-If changes; manual escalation with no routine next check; repeated/rapid presets; API failures/retry; ocular provenance; mobile overflow; local evaluation with external requests blocked.

**Known failure:** `voice.spec.ts:14`, real offline speech accuracy. The actual service returned HTTP 200 and transcript `are greedy be a sleep for hours i have a headache heartbreaking`; the expected phrase `heart rate` was not recognized. The separate actual PCM16/16-kHz/mono WAV capture/transcription test and voice-unavailable error test passed. This is not counted as successful voice-derived field recognition. Physical microphone accuracy was not tested. No speech changes were made.

Warnings: existing Vite chunk-size warning (~1.44 MB primary bundle) and Starlette/AnyIO deprecation warning remain. No TypeScript failure. `git diff --check` passed. Final build was rerun after the bounded-list presentation adjustment; subsequent real screenshot capture confirmed mobile has no horizontal overflow.

Machine-readable logs: `.demo-runtime/bodygraph-v3/{backend-tests.txt,engine-tests.txt,frontend-unit.txt,frontend-build-final.txt,full-browser.json,full-browser.txt,preservation-check.json}`.

## Non-clinical innovation evaluation

Run from `backend/`:

```powershell
.\.venv\Scripts\python.exe -m evaluation.bodygraph_v3 --output ../qa-evidence/bodygraph-v3/evaluation.json
```

The evaluation uses real FastAPI requests, temporary persisted check-ins, real inventory, the pinned real engine and actual stored follow-up notes. Each case also inserts a later sentinel record: both retrieval methods must return the named historical check-in rather than the latest. The HTTP result is checked against the engine's real structured trace.

The comparator reuses Member 3's existing catalog-order checklist and eligibility gates. Both methods have equal access to history and identical manual-escalation, missing-data and equipment constraints. Targets are predeclared navigation probes, not medically preferred actions. No unsafe straw-man checklist was introduced.

| Executed metric | Fixed eligible checklist | MEDNAV engine ordering |
|---|---:|---:|
| Missing numeric fields detected | 17/17 | 17/17 |
| False-positive missing fields | 0 | 0 |
| Equipment-feasibility violations in permitted paths | 0 | 0 |
| Explicit escalation overrides handled | 2/2 | 2/2 |
| Exact historical records retrieved | 10/10 | 10/10 |
| Predeclared reachable navigation targets reached | 7/7 | 7/7 |
| Permitted form openings across those seven paired targets | 17 | 13 |
| Protocol steps including one actual documentation POST per target | 24 | 20 |
| Explicit synthetic documentation events saved | 10 | 10 |

Three cases have no routine target (two overrides and one insufficient-evidence case), and are excluded from step totals rather than assigned zero-cost successful actions. Both methods still record an explicit evaluator note for those states. Reproducibility test ran the full evaluation twice and matched all cases/aggregate results.

Limitations: equality on shared safety gates is expected, not independent proof of clinical safety. Missing-data scoring covers only the engine's four approved numeric fields. Step counts are protocol form openings plus documentation, **not** timed usability tests, observed crew clicks or evidence of clinical effectiveness. No medical recommendations are added by the benchmark. Ten deliberately small synthetic cases cannot establish general performance improvements. UUIDs/timestamps vary; case definitions and aggregate results reproduce.

## Screenshots and evidence

Actual Edge captures, with external requests blocked to exercise the existing offline schematic model:

- [Desktop console](qa-evidence/bodygraph-v3/console-desktop.png)
- [Evidence navigator](qa-evidence/bodygraph-v3/evidence-map.png)
- [Bounded cross-system replay window](qa-evidence/bodygraph-v3/cross-system-window.png)
- [Mobile console, 390 × 844](qa-evidence/bodygraph-v3/console-mobile.png)
- [Persisted follow-up replay](qa-evidence/bodygraph-v3/follow-up-replay.png)
- [Actual saved record, real engine result and follow-up response](qa-evidence/bodygraph-v3/engine-follow-up.json)
- [Evaluation output](qa-evidence/bodygraph-v3/evaluation.json)

Artifacts are local ignored QA evidence, not automatically committed. Screenshots were inspected. The earlier expanded-list screenshot exposed adjacent canvas stretching; the scoped bounded-list fix addresses that. The original anatomy renderer is byte-identical to pre-task. New controls necessarily add content inside the existing card, so this is not a claim of pixel-identical page height. Downloaded external anatomy assets and physical microphone hardware were not independently tested in this run.

## Demo instructions and limitations

1. Start the existing application with `powershell -ExecutionPolicy Bypass -File scripts/start-mednav-demo.ps1` using the documented backend environment (or the script's `-PythonPath` override).
2. Open `http://127.0.0.1:5173/`. Backend remains `http://127.0.0.1:8000`.
3. Confirm Live FastAPI mode in the discreet developer controls. Choose a crew; use the original 3D selectors or the eight BodyGraph region labels.
4. In Selected Anatomy choose a saved timestamp/ID. Read the REPLAY label; expand cross-system observations. Latest dashboard measurements remain separately labelled latest.
5. Inspect Heart/Brain charts, then Eyes and unsupported regions. Observe honest Unknown/missing-assessment messages. Return to latest when finished.
6. Choose Investigate replay observation. Existing styled engine results use that exact ID and current trusted inventory/explicit simulation context.
7. Record a follow-up explicitly in Investigation. Refresh, reselect the historical record and open its recorded follow-up disclosure to retrieve it.
8. Use the existing What-If and manual emergency controls. Inventory changes still affect shared persisted demo inventory; replay itself does not change readings, inventory or follow-ups.

Normal local services were restored after verification, using the original `.demo-runtime/mission-v2.sqlite3`; health check succeeds. Test databases were retained separately as disposable evidence. Stop only launcher-owned services with `scripts/start-mednav-demo.ps1 -Stop`.

Core BodyGraph is ready for a guided synthetic demonstration. Voice recognition accuracy remains a known limitation; prefer manual check-in and review any transcript. Replay selection is temporary UI state and returns to latest after a fresh page load, while check-ins and follow-ups remain persisted. Baselines have no historical versioning. Incident reports remain session previews. No unsupported organ measurements, durable report sync, new medical interpretation or clinical validity is claimed.
