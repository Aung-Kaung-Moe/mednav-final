# AGENTS.md — Shared Instructions for All MEDNAV Coding Agents

You are working on **MEDNAV**, a 48-hour astronaut-health-monitoring hackathon prototype. Read `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `API_CONTRACT.md`, and your assigned `roles/MEMBER_*.md` before writing code. Other agents are working simultaneously.

## Mission and quality bar

Implement an **offline-capable research demonstration** of astronaut self-monitoring, missing-data awareness, resource-aware next-check navigation, and evidence summaries. Output must be functional, testable, understandable, and reproducible, not just a polished mockup.

## Strict boundaries

1. **Do not present the software as a doctor.** No diagnoses, treatment plans, prescriptions, medicine dosages, clinical clearance or risk probabilities invented from synthetic data.
2. **Safety first.** A curated/manual `emergency_override` or an explicitly reviewed, versioned rule must bypass ordinary check-ranking and direct the crew to its approved emergency protocol/medical officer. Do not create new medical thresholds from guesswork.
3. **Never equate a missing measurement with a normal measurement.** Missing is represented by `null`/"unknown" and visibly flagged.
4. **No false sources.** Research citations must be authentic and tied to actual claims. Clearly distinguish NASA research, public data, synthetic data and assumptions.
5. **No fabricated measurements.** Frontend must display a source label for every dataset; simulated scenario values must stay labeled `synthetic`.
6. **No unchecked medical text generation.** Decision advice comes only from pre-reviewed checklist records or deterministic rule output. Natural-language AI, if added, may paraphrase approved observations but may not add new instructions.
7. **No hidden network dependencies.** Offline MVP runs with local frontend, local API, local SQLite and bundled assets. Cloud speech and cloud AI are optional only and not required for the demo.
8. **Preserve contracts.** Use the shared API schemas in `API_CONTRACT.md`. Proposed changes must be approved by Member 2 and communicated to all teammates first.
9. **Stay in your file ownership area.** Cross-area edits require a small, explicit coordination request; do not rewrite other agents' changes.
10. **Test your work.** Implement tests for happy path, missing data, unavailable resources and safety override as applicable.

## Working method

- Before coding: state files to change, dependencies, and acceptance criteria in your work log or pull request.
- Prefer small, self-contained commits; pull/rebase frequently; never commit directly to `main`.
- Use descriptive, stable identifiers and typed request/response models.
- Build from mock response fixtures if a dependency is not ready. Clearly mark mock data.
- Do not claim tests pass until executed; provide commands and output in PR notes.
- Deliver code, unit tests, a usage note, known gaps and a demonstration path.
- If blocked, stub **interfaces, not medical outputs**. Return explicit `unavailable` or `insufficient_evidence` states.

## Engineering defaults

- Frontend: TypeScript, React, Vite; Recharts; optional React Three Fiber for 3D.
- Backend: Python 3.11+, FastAPI, Pydantic, SQLite; explicit versioned endpoints under `/api/v1/`.
- Decision engine: deterministic Python library with no frontend imports.
- Tests: pytest for engine/backend; Vitest/React Testing Library for frontend when practical.
- Seeded local scenarios: no personal or protected health information.

## Shared handoff checklist

- [ ] Uses the agreed field names and API paths.
- [ ] No impossible equipment suggested.
- [ ] Unknown/missing data clearly shown.
- [ ] Appropriate safety escalation never replaced by convenience scoring.
- [ ] Can run offline for the primary flow.
- [ ] Real versus simulated evidence is explicit.
- [ ] Tests and run instructions are included.

When in doubt, prioritize a small working and safe demonstration over adding features.
