# Member 2 — Backend, Database, Shared Contracts and Integration Lead

## Your mission

Own `backend/`, `contracts/`, repository setup, local app startup and the final integration. You are responsible for keeping everyone's work interoperable, not for writing the decision logic yourself.

## Read before coding

`AGENTS.md` → `PROJECT_SPEC.md` → `API_CONTRACT.md` → `ARCHITECTURE.md` → `INTEGRATION_WORKFLOW.md` → this file.

## Build in this order

1. Repo structure, Python environment, FastAPI starter, healthz endpoint, SQLite models.
2. Pydantic models **exactly** matching `API_CONTRACT.md`, then contract tests.
3. Seed loading from Member 4's fixture format; no hardcoded actual NASA crew records.
4. GET astronauts, GET health trends, POST check-in, GET inventory.
5. `POST /api/v1/investigations` adapter calling Member 3's `evaluate_investigation(...)` as a pure function.
6. Persist/retrieve incident report locally; stable error responses.
7. Bundle local running instructions and ensure internet-off behavior.

## Integration policy

- Freeze JSON v1 by Hour 3, then communicate any change across all four members.
- Maintain mock fixtures while other modules are incomplete.
- Do not override Member 3's safety decisions in the backend.
- Normalize only valid data units, datetime types and equipment IDs; unknown measurements stay null.
- Keep secrets out of commits. No cloud dependencies in core flow.
- Review all PRs with another teammate; do not self-approve your own changes.

## Acceptance criteria

- All endpoints answer with validated JSON and clear errors.
- The same investigation request gives the same result under the same rule version.
- Availability comes from usable inventory, including quantity and usability (not just catalog membership).
- Reports persist across local backend restarts.
- One script or concise commands start frontend and backend locally.
- Integration tests cover normal, missing-data, inventory shortage and emergency override cases.

## Handoff to other members

Send Member 1 API base URL + sample fixtures, Member 3 input/output typed model, Member 4 seed import schema + test execution command. Create short PR notes for every merge.

## Copy-to-agent task

> You own `backend/` and `contracts/` for MEDNAV. Read AGENTS.md, PROJECT_SPEC.md, API_CONTRACT.md and ARCHITECTURE.md. Implement FastAPI + SQLite + typed request/response models with the agreed endpoints. Add seed loading, local reports, validation and tests. Integrate the pure Python engine from Member 3 without rewriting its medical logic. Maintain contract stability and offline operation. Coordinate PR merges and run full integration tests; never commit directly to main.
