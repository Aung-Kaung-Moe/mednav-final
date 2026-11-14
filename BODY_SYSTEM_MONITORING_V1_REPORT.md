# Body-System Health Monitoring v1

## Workspace and boundaries

Feature worktree: `C:\Users\ZL_sht_H\MEDNAV-body-monitoring-v1`, branch `feature/body-system-monitoring-v1`, based on published integration commit `0d3c8d27874e3a29a0a881f0a126c6caaacf2aa1`. No commit, push or merge was performed. The original integration worktree and its uncommitted work were preserved.

Tests run against a separately created `.demo-runtime/body-monitoring.sqlite3` containing synthetic records. The existing integration `backend/mednav.db` was not used for mutations. Original servers were stopped through their own launcher to free ports; feature servers run on the same localhost URLs. Dependencies were installed with `npm ci --offline`; backend testing reused the existing Python environment, while executing backend code from the feature worktree. This was an integration task, not another fresh-install certification.

No backend routes, database schema, API contract, original research data or decision rules changed. The Stable v1 engine remains vendored at 2297c6af99a402a2aab354ed82eacd7335ec6b06 / demo-2.

## Data flow and functionality

Selected crew -> existing profiles API plus paginated SQLite history -> complete typed `SavedCheckIn[]` -> selected-region panel. Records retain IDs, crew ID, nullable HR/sleep/BP, symptoms, ISO timestamps and provenance. All pages are fetched, validated for matching crew and valid timestamps, then sorted by actual instants with ID tie-breaking. Crew switches suppress other crew records immediately. No failed live request substitutes a fixture.

| Region | Actual data | Display and limitations |
| --- | --- | --- |
| Heart | `/api/v1/astronauts` baseline; `/api/v1/astronauts/{id}/history` HR/BP/timestamps/source | Latest check-in HR and BP; baseline; up to seven latest recorded observations; earlier known BP separately dated when latest BP is Unknown |
| Brain | Same profile/history routes; sleep, baseline and reported symptoms | Latest sleep and symptoms; recent observations; Unknown gaps; sleep is not a direct neurological measurement |
| Eyes, either side | Existing check-in symptom strings and report timestamps | Conservative visual-symptom text matching, latest relevant report plus expandable recorded reports, explicit Unknown ocular measurement and `Ocular assessment not recorded in the current backend.` |
| Other regions | Existing anatomy definitions/profile or illustrative display fixtures | Existing explanatory behavior retained, with illustrative/Unknown disclosure |

Charts show observation numbers with accessible timestamp/value/source details, not seven continuous days. Baseline is descriptive, never a threshold or risk score. Unknown values remain null and leave gaps. With fewer than two numeric readings, no trend is drawn. Empty history disables investigation and asks for a saved check-in. Ocular fixture values never become verified measurements in live monitoring.

`Open Investigation` retains the crew, refreshes its saved history and invokes existing `POST /api/v1/investigations/evaluate` with the actual saved ID and explicit communication/override context. The original styled Investigation cards render the unchanged engine response. The frontend makes no region-specific medical decisions.

Loading and history failures are explicit within the Selected Anatomy card. Dashboard anatomy remains available after profile initialization even when no evaluation result exists, so missing history/errors are visible rather than hiding the body panel. Existing global retry handles recovery.

## Files changed

- `frontend/src/api.ts`: retain full typed history, chronological ordering and scoped loading/error state; derive the legacy dashboard chart points separately.
- `frontend/src/data/bodyMonitoring.ts`: pure region selection, validated ordering, visual-symptom text selection.
- `frontend/src/components/BodySystemMonitoring.tsx`: region evidence, charts, accessible details and investigation action inside the existing card.
- `frontend/src/components/MissionConsole.tsx`: reuse existing Selected Anatomy card; pass through monitoring props; keep other anatomy behavior with truthful labeling.
- `frontend/src/data/anatomy.ts`: remove SANS-labelled eye selection text and describe actual available evidence; fixture ocular values explicitly illustrative.
- `frontend/src/main.tsx`: wire history and action; retain dashboard access during loading/no-result states.
- `frontend/audit/contract-unit.mjs`: complete timestamped fixture for pagination test; ordering/isolation/nulls and sparse/empty/ocular rendering regressions.
- `frontend/tests/body-monitoring.spec.ts`: actual HTTP/browser, persisted nullable check-in, cross-crew isolation, retry, mobile and original-canvas raycast tests.
- This report.

No CSS, BodyViewer, 3D scene, model asset, package dependency or backend source changed. Backend tests regenerate example HTTP JSON files; those test-only artifacts in this isolated worktree were restored to their initial tracked contents, not copied over the original worktree's changes.

## Visual evidence

Screenshots are local ignored artifacts under `qa-evidence/body-monitoring/`:

- `baseline-desktop.png`, `baseline-mobile.png`: published integration UI before feature startup, fixture Crew A/Heart.
- `integrated-fixture-desktop.png`, `integrated-fixture-mobile.png`: same fixture/selection and 1440x900 / 390x844 viewport settings.
- `heart-desktop.png`, `brain-desktop.png`, `eyes-desktop.png`: live SQLite-backed monitoring.
- `brain-mobile.png`: actual saved null measurements at 390x844.
- `canvas-eye-selection.png`: original canvas selection after testing both eyes.
- `http-evidence.json`: actual profiles/history, saved Crew B record, evaluation request and engine response.

Visual review preserves the original three-column grid, typography tokens, colors, navigation, viewer controls and model. The new evidence naturally increases Selected Anatomy content height; full timestamp/source details are collapsed by default. Existing grid stretching can change model canvas height when details expand; no viewer sizing rules were redesigned. Eye text and the added evidence/status/disclosure content are intentional differences. This is not a pixel-identical claim for dynamic live data.

External assets were blocked for deterministic screenshots/canvas tests, using the original schematic fallback. The detailed CDN model's source and loading code are untouched but were not re-certified by these offline screenshots. Physical model selection uses the actual renderer/raycaster, not a mocked selection handler: Heart, Brain, left eye and right eye all passed.

## Executed verification

| Suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Backend pytest, final correctly invoked run | 121 | 0 | 0 |
| Standalone pinned engine | 35 | 0 | 0 |
| Frontend unit/contracts | 10 | 0 | 0 |
| Full browser suite | 21 | 0 | 0 |
| Targeted body monitoring browser suite (overlaps full suite) | 3 | 0 | 0 |

TypeScript/Vite build passed. The existing large-bundle warning and Starlette/AnyIO deprecation warning remain. `git diff --check` passed. Model/viewer/styles/backend/vendor paths have no source diff against the baseline. The full browser run includes actual voice transcription this time; this does not invalidate its documented recognition limitations. The final eye-report expansion was followed by another build, unit and targeted browser run; targeted tests overlap the full suite and are not additional unique cases.

Earlier execution issues were corrected, not counted as passes: a test helper waited for ready content during an intentional history failure; the helper now asserts the actual error. An initial backend run skipped one speech test because its WAV was not yet generated. A root-directory pytest invocation produced six import/collection errors; the documented backend-directory invocation then passed all 121. A newly added SSR unit import was initially placed after test registration, causing a Vite teardown race; imports now complete before registering tests and all 10 pass. The intermediate full browser run passed 20/20 before adding the final canvas test. Final suites supersede those attempts; overlapping tests must not be summed.

## Manual demo

Current preview: http://127.0.0.1:5173/ ; health: http://127.0.0.1:8000/api/v1/healthz . It uses the feature worktree and disposable synthetic database.

1. Select Crew A on Dashboard. Click Heart on the model or its existing quick selector. Inspect HR/BP/baseline and expand timestamp/source details.
2. Select Brain for saved sleep and symptoms. Select either eye for recorded visual symptoms and missing ocular evidence.
3. Switch Crew B/C: observe that history, identifiers and baselines switch together. No ocular exam is manufactured.
4. Health Check-In: manually enter or leave readings Unknown, review and save. Return to Dashboard: the monitoring panel reloads the saved record. Refresh and reselect the crew to confirm SQLite persistence.
5. From Selected Anatomy, Open Investigation. It evaluates that crew's latest saved record and displays the real engine result in the existing UI. What-If and manual override retain their existing behavior.

To restart with the existing prepared Python, from this feature worktree in PowerShell:

```powershell
$env:MEDNAV_DATABASE_URL='sqlite:///C:/Users/ZL_sht_H/MEDNAV-body-monitoring-v1/.demo-runtime/body-monitoring.sqlite3'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-mednav-demo.ps1 -PythonPath C:/Users/ZL_sht_H/MEDNAV-first-live-demo/backend/.venv/Scripts/python.exe
```

Stop this checkout with the same script's `-Stop` flag. To use a self-contained environment, follow `TEAM_SETUP_GUIDE.md` to create `backend/.venv`; no source path depends on the example above. Stop feature services before restoring the original checkout's servers. Do not delete either database.

## Remaining limitations

- All competition health readings are synthetic; no organ-health score, diagnosis, clinical validation or NASA endorsement.
- No independent ocular imaging/optic-nerve persistence or assessment endpoint exists. Adding those requires a separate agreed data contract.
- Visual symptoms are free-text reports matched conservatively; this is not a complete medical terminology recognizer or a clinical finding. The timestamp identifies the report, not symptom onset or persistence.
- Empty/sparse-history rendering is covered by unit/server rendering; the saved-null and normal flows are verified in a real browser.
- Refresh reselects default Crew A; saved records persist, while temporary region/context selection remains session UI state.
- PocketSphinx phrase accuracy and the pre-existing mobile Incident Report overflow remain outside this scoped feature.
