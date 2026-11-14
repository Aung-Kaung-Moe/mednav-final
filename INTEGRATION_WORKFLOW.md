# MEDNAV — Team Workflow, Branches and Integration

## Roles and owners

- **Member 1:** `frontend/` — dashboard, visualizations, optional 3D and voice controls.
- **Member 2:** `backend/`, `contracts/`, repository setup — API/database/integration lead.
- **Member 3:** `engine/`, engine unit tests — ranking and safety logic.
- **Member 4:** `data/`, `docs/`, evaluation tests — science, quality and presentation coordinator.

Shared `README.md` and root `AGENTS.md` changes require explicit review; no silent changes to other people's files.

## Git rules

- Feature branches: `feature/frontend-3d`, `feature/backend-api`, `feature/decision-engine`, `feature/data-testing`.
- Protect `main`; use pull requests. No direct commits to `main`.
- Member 2 coordinates merges; another teammate reviews Member 2's own PR.
- Small PRs every 4–6 hours; include what changed, how tested, blockers, contract impact.
- Pull/rebase frequently to avoid diverging contract assumptions.
- If a blocker exists, use mock fixtures that match `API_CONTRACT.md`, not guessed schemas.

## Integration milestone schedule (48 hours)

| Elapsed time | Shared output | Owner(s) |
|---|---|---|
| 0–3h | Repo, frozen API v1, seed schema, basic UI mock | All; Member 2 integrates |
| 3–12h | Four modules usable alone | Each owner |
| 12–20h | **First end-to-end incident** through UI → API → engine → UI | Members 1, 2, 3 |
| 20–32h | Evidence explanations, inventory gating, optional 3D/voice | All |
| 32–40h | Repeatable offline tests + baseline comparison | Members 3, 4; all fix |
| 40–48h | Feature freeze, docs, video, final project submission | Member 4 coordinates |

These are *timeboxes*, not guaranteed speed. Cut voice first if behind schedule.

## Contract change protocol

1. Open a short change request with problem and proposed JSON example.
2. Member 2 checks backend impact; Member 1 checks UI; Member 3 checks engine; Member 4 checks fixtures.
3. Update `API_CONTRACT.md` and typed models in the same approved PR.
4. Broadcast schema version and regenerate mocks before other agents proceed.

## Local integration sequence

1. Member 4 adds synthetic fixtures to `data/`.
2. Member 3 implements `evaluate_investigation(...)` and tests it with fixtures.
3. Member 2 exposes `/api/v1/investigations`, persists incident report and writes contract tests.
4. Member 1 uses live endpoints to render input, missing evidence, next check and explanation.
5. Member 4 executes the same scenario through the UI, logs results and captures video proof.

## Short standup every ~6 hours

Each person answers in one message: **Done / Next / Blocker / Branch+PR / Test result**. No more than 10 minutes unless addressing a high-severity integration issue.

## Definition of "ready to merge"

- Tests pass; no conflicts; consistent contract; offline path works; no mislabeled NASA/synthetic records; no unreviewed medical instructions.
