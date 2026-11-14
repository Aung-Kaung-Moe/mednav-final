# Member 3 — Decision Engine and Algorithm Evaluation

## Your mission

Own `engine/` and engine unit tests. This is MEDNAV's technical centerpiece: deterministic, safety-gated investigation of **missing evidence and available resources**.

## Read before coding

`AGENTS.md` → `SAFETY_AND_DECISION_ENGINE.md` → `API_CONTRACT.md` → `PROJECT_SPEC.md` → this file.

## Build in this order

1. Typed `InvestigationRequest` and `InvestigationResponse` matching API v1 (coordinate actual model ownership with Member 2).
2. Baseline-comparison observations with caveat; never infer diagnosis.
3. Missing-data detection, preserving `null`.
4. Explicit emergency override before any ranking; route to approved-protocol/medical-officer handoff without treatment instructions.
5. Check catalog with version/source tags, equipment requirements and `prototype_only` flag.
6. Resource eligibility filtering (quantity, expiry/usable state provided by backend).
7. Deterministic ranking among **permitted** next checks; reproducible scores and explanations.
8. No-feasible-check abstention: `insufficient_evidence`.
9. Unit tests with fixtures supplied by Member 4.

## Safety requirements

No AI-generated diagnoses, treatments or medical thresholds. Decision output is checked-list navigation, not clinical judgment. An emergency rule must never lose to a higher information score. Do not recommend tests requiring equipment that is missing or unusable.

## Minimal tests

- Emergency override => `escalate`, `next_check=null`.
- Missing BP => BP remains unknown, explained.
- Unavailable BP monitor => no BP measurement recommendation.
- Two eligible checks => deterministic ranking.
- No eligible checks => clear abstention.
- Same input => same output.
- `diagnosis=null` always.

## Handoff to Member 2 / 4

Deliver importable function signature `evaluate_investigation(request, candidate_checks, inventory, rules) -> response`, seeded deterministic test fixtures, package path and examples. Provide a plain-language rationale for every ranking coefficient (not a medical validity claim).

## Copy-to-agent task

> You own MEDNAV's `engine/`. Read AGENTS.md, API_CONTRACT.md and SAFETY_AND_DECISION_ENGINE.md. Create an offline deterministic Python investigation engine with explicit safety override, unknown-field detection, equipment eligibility, ranked allowed checks, abstention and evidence explanations. Never prescribe treatment or diagnose. Use a versioned nonclinical utility heuristic and clear caveats. Add robust pytest tests and a stable importable API for Member 2. Confine your changes to owned files and request contract approval before altering fields.
