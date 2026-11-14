# Fresh checkout verification

Date: 2026-11-14. Branch: `integration/first-live-demo`. See [TEAM_SETUP_GUIDE.md](TEAM_SETUP_GUIDE.md) for teammate commands.

## Method and isolation

The previous HEAD did not contain essential uncommitted integration files. Before committing, the reviewed Git index was exported with `git archive` over a separate `git clone --no-local` checkout in a temporary Windows directory whose name includes spaces. Only candidate tracked files were exported. No existing venv, node_modules, SQLite database, cache or speech model was copied. This tests the reviewed candidate source, not the previous HEAD or an already-published remote branch.

Environment: Windows PowerShell, Python 3.13.1, Node 24.14.0, npm 11.9.0 and installed Microsoft Edge. Other supported versions were not independently tested. Backend requirements and optional PocketSphinx were downloaded from PyPI with pip `--no-cache-dir` into a new venv with system-site-packages disabled. `npm ci` used the tracked lockfile and a new empty cache. The approximately 29 MB PocketSphinx Windows wheel supplied the English model inside the new venv; no runtime model download or copied installation was used.

## Executed results

| Check | Actual result |
| --- | --- |
| Backend base and voice installation | PASS, exit 0 |
| npm ci | PASS; 72 packages added; audit reported 0 vulnerabilities |
| Fresh SQLite automatic seed | PASS: 3 fictional crew, 21 health records, 6 inventory entries |
| Pinned engine | PASS: vendored commit 2297c6af99a402a2aab354ed82eacd7335ec6b06 / demo-2 |
| Backend pytest | 121 passed, 0 failed, 0 skipped |
| Standalone engine tests | 35 passed, 0 failed, 0 skipped |
| TypeScript/Vite build | PASS |
| Frontend contract/unit tests | 8 passed, 0 failed, 0 skipped |
| Core browser suite | 15 passed, 0 failed, 0 skipped |
| Full browser suite, including voice | 18 passed, 0 failed, 0 skipped |
| Startup / health / frontend | PASS after ownership fix |
| Repeat launcher invocation | PASS: no duplicate services |
| Stop / restart | PASS: both owned listeners removed; seed records retained |

The core browser suite is a subset of the full suite: do not add 15 and 18 together. Backend collection excludes the 35 vendor tests. Actual browser HTTP tests cover check-in save/retrieval, real engine evaluation, unknown BP, inventory/What-If mutations, manual escalation with null next_check, refresh persistence, multi-crew isolation, API failure/recovery and repeated presets. External-request blocking is also exercised. HTTP journey assertions are not another independent suite.

## Safe packaging corrections

- The first launch reused the old checkout's frontend; that mixed-checkout run was rejected as evidence. The launcher now flattens legacy process-state entries and refuses foreign/unverifiable port owners without killing them. Both server command lines were subsequently verified under the clean directory.
- Browser global setup creates ignored runtime/evidence directories, removing a previously hidden fresh-checkout dependency.
- Added explicit core, voice and unit commands. The full browser assertions remain intact; core mode excludes three voice/recorder cases rather than pretending they passed.
- Added runtime ignore rules and teammate documentation. Original datasets, engine rules and visual styles were not changed.

## Voice and UI limitations

All three voice browser tests passed this run using newly generated synthetic speech and the actual local recognizer. Prior runs failed recognition phrase assertions: accuracy is not guaranteed. Backend speech tests also executed successfully. Transcript review/correction and explicit save are mandatory. Physical microphone/noise/accent performance remains manual verification, not a claimed PASS. Missing optional voice dependencies must not prevent the manual core demo.

Known P2: Incident Report overflow around 390 px. Radiation/microgravity remain illustrative; reports are session previews, not durable ground-transmitted records. NASA research remains separate from synthetic decisions with no public research visualization endpoint. External font/anatomy assets may fall back offline. No clinical validity or NASA endorsement is claimed.

## Local evidence

The temporary checkout contains `.demo-runtime/backend-junit.xml`, `engine-junit.xml`, `core-browser-results.json`, `full-browser-results.json`, installation logs and `qa-evidence/` screenshots. The original checkout's `.demo-runtime/fresh-clone/` records installation/launcher evidence and its original database hash. These generated artifacts are deliberately excluded from Git and are not setup dependencies. The original application database is not used by the clean tests.
