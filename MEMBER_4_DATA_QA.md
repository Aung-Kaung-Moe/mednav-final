# Member 4 — Research, Synthetic Data, QA and Submission Coordinator

## Your mission

Own `data/`, `docs/`, evaluation tests and the final demo narrative. Make the project scientifically honest and reproducible. You do not need to design medical treatment rules.

## Read before coding

`AGENTS.md` → `DATA_AND_RESEARCH.md` → `TEST_AND_DEMO_PLAN.md` → `API_CONTRACT.md` → this file.

## Build in this order

1. Read the **actual** 2026 challenge resource tab; record source links, titles, what each supports and access restrictions.
2. Prepare 4 fictional astronauts, >=30 days of synthetic check-ins, equipment list and at least 12 scenario fixtures.
3. Record source provenance in `docs/research_sources.md`; never assert synthetic data is NASA astronaut telemetry.
4. Define expected statuses and forbidden equipment per scenario in a testable fixture format matching API v1.
5. Coordinate with Member 3 to run engine tests and compare against a simple, fair fixed-order baseline.
6. Test full UI workflow, disconnected local operation, and voice/3D fallback if implemented.
7. Document actual engineering metrics, known failures and limitations.
8. Prepare 90-second demo script, screenshots and README instructions.

## Evaluation honesty

- Test outputs must come from code execution, not invented performance percentages.
- Do not claim synthetic test results predict clinical outcomes.
- Verify every cited NASA claim and link before submission.
- If a relevant public NASA dataset cannot be accessed quickly, document the limitation and use validated research references plus explicitly fictional scenarios; do not invent a NASA data download.

## Acceptance criteria

- At least 12 reproducible scenarios including normal, missing, out-of-stock, emergency override, invalid and offline cases.
- Clear `synthetic` labels in all crew/inventory data files and UI samples.
- Evaluation notebook or script emits counts with denominators.
- Research sources table includes URL, accessed date, supported claim and dataset/license caveats.
- Final demo shows end-to-end working app, not static screenshots.
- Documentation clearly says "hackathon prototype, not clinically validated".

## Handoff to Members 2 & 3

Send first seed JSON/CSV sample by Hour 3 and full scenario matrix by Hour 12. Share expected outcomes before the testing phase. Do not silently change schema.

## Copy-to-agent task

> You own MEDNAV's `data/`, `docs/` and scenario-based evaluation. Read AGENTS.md, PROJECT_SPEC.md, API_CONTRACT.md, DATA_AND_RESEARCH.md and TEST_AND_DEMO_PLAN.md. Create transparent synthetic astronaut/medical inventory data and at least 12 seed scenarios matching the API. Verify NASA research links, document provenance and clinical limitations, implement reproducible tests, and prepare evaluation metrics and a 90-second demo script. Never label fictional readings as real NASA crew data. Coordinate assumptions with Members 2 and 3.
