# MEDNAV — Agent-Ready Project Pack

**Project:** MEDNAV — Offline, Resource-Aware Astronaut Health Decision Support
**Use case:** NASA Space Apps Challenge, “Create Health Monitoring Software for Astronauts on Space Missions”
**Prototype deadline:** 48-hour hackathon; this is NOT medical-grade software.
**Team:** 4 humans + separate coding agents; one shared Git repository.

## Start here

Every teammate and coding agent must read, in order:
1. [`AGENTS.md`](AGENTS.md) — universal operating instructions and safety constraints.
2. [`PROJECT_SPEC.md`](PROJECT_SPEC.md) — what we are building and what counts as done.
3. [`ARCHITECTURE.md`](ARCHITECTURE.md) — architecture and ownership boundaries.
4. [`API_CONTRACT.md`](API_CONTRACT.md) — shared request/response definitions; **do not invent field names**.
5. Your own role file in [`roles/`](roles/).

For scientific, safety and integration work also read:
- [`DATA_AND_RESEARCH.md`](DATA_AND_RESEARCH.md)
- [`SAFETY_AND_DECISION_ENGINE.md`](SAFETY_AND_DECISION_ENGINE.md)
- [`INTEGRATION_WORKFLOW.md`](INTEGRATION_WORKFLOW.md)
- [`TEST_AND_DEMO_PLAN.md`](TEST_AND_DEMO_PLAN.md)

## Role assignment

| Member | Primary ownership | Agent handoff |
|---|---|---|
| 1 | React dashboard, 3D, optional voice controls | [`roles/MEMBER_1_FRONTEND_3D.md`](roles/MEMBER_1_FRONTEND_3D.md) |
| 2 | FastAPI, SQLite, integration, running the app | [`roles/MEMBER_2_BACKEND_INTEGRATION.md`](roles/MEMBER_2_BACKEND_INTEGRATION.md) |
| 3 | Deterministic investigation engine, safety gates, unit tests | [`roles/MEMBER_3_DECISION_ENGINE.md`](roles/MEMBER_3_DECISION_ENGINE.md) |
| 4 | NASA source documentation, synthetic scenarios, evaluation, demo materials | [`roles/MEMBER_4_DATA_QA.md`](roles/MEMBER_4_DATA_QA.md) |

## Project in one sentence

MEDNAV gathers astronaut health indicators and, when health information is incomplete and onboard supplies are limited, helps the crew understand **what is known, what is missing, which approved check is feasible, and when medical review is required** — even while disconnected from Earth.

## MVP demonstration

1. Load fictional Astronaut A's health history.
2. Report headache and dizziness plus unusually short sleep.
3. Notice that blood-pressure data is missing.
4. Show that the blood-pressure monitor is unavailable.
5. Investigate with the **safe, approved, feasible** next step; never invent a medical diagnosis or treatment.
6. Explain the decision, show 3D health-navigation UI, and save a local incident report.

## Non-negotiables

- NASA/research data and fictional astronaut records are labeled separately.
- Missing data is **unknown**, never normal.
- Safety gates are checked before any optional ranking or optimization.
- No automatic disease diagnosis, prescription, medicine dosage, or spacecraft actuation.
- Only use reviewed, documented checklist entries; demonstration entries must say "prototype only".
- Basic end-to-end scenario must work without voice or 3D; those are progressive enhancements.

## Suggested project layout (created by the team)

```text
mednav/
  AGENTS.md
  frontend/            # Member 1
  backend/             # Member 2
  engine/              # Member 3
  data/                # Member 4
  tests/               # Members 3 & 4
  docs/                # Member 4
  contracts/           # shared, Member 2 maintains
  README.md
```

This documentation bundle is the team handoff specification; it does **not** claim that the application has been implemented or medically validated.
