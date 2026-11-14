# MEDNAV — Safety Rules and Next-Best-Check Engine

## Objective

Produce transparent, safety-constrained **navigation to additional observations**, not a medical diagnosis. Inputs are synthetic health indicators, symptom records, personal baselines and an inventory of fictional resources. Outputs are observations, unknown measurements, constraints, a checked next action and an explicit evidence explanation.

## Priority order (non-negotiable)

1. **Safety override:** if `emergency_override=true` or an explicitly approved/versioned protocol flag is present, stop optional optimization; return `status="escalate"`, `next_check=null` and the applicable approved-protocol reference.
2. **Unknown awareness:** list missing measurements; never impute "normal" values or calculate misleading confidence.
3. **Eligibility filter:** select only actions on a predefined reviewed/demo checklist; require their needed equipment to be usable and available.
4. **Value ranking:** among permissible choices, prefer tests that are informative, quick and lower in resource cost, with deterministic tie-breaking.
5. **Explainability:** show why the check was chosen, what was missing, which options were excluded, and what cannot be concluded.

## Illustrative catalog (NOT medical instructions)

| Check ID | Purpose | Required equipment | Safety gate |
|---|---|---|---|
| `symptom_review_checklist` | Open a versioned, reviewed check-in form | none | Never a substitute for emergency protocol |
| `review_sleep_workload` | Review existing sleep/workload records | none | Informational only |
| `review_equipment_status` | Confirm instrument availability/calibration | none | Informational only |
| `measure_blood_pressure` | Navigate to a reviewed measurement workflow | `bp_monitor` | Only if approved and instrument usable |
| `contact_medical_officer` | Alert authorized crew member for review | none | When review indicated |

Avoid adding procedural instructions or drug recommendations. A checklist catalog is **not** an excuse to invent procedures. Clinical content must be independently reviewed before any real-world use.

## Suggested deterministic ranking (demo-only heuristic)

For each eligible non-emergency check:

```text
score(check) = informational_value - 0.5*time_cost - 0.5*resource_cost
```

All numerical components are **synthetic, scenario-specific utility units**, not clinical risk scores. Exclude checks that require unavailable/unusable resources **before** scoring. Use stable tie-breaking (e.g., alphabetical `check_id`).

This heuristic is a starting point for an engineering demonstration, **not** a validated medical decision rule. Modify coefficients only based on a documented evaluation objective and reviewed examples.

## Evaluation baseline

Compare against a naive fixed-order checklist **using the same pre-reviewed candidate catalog**. Do not create an intentionally broken baseline. Assess feasibility, missing-data awareness, repeatability and number of checks required to reach a predefined synthetic evidence target.

## Pseudocode

```python
def evaluate(request, candidate_checks, inventory, reviewed_rules):
    observations = describe_baseline_changes_without_diagnosing(request)
    missing = list_missing_measurements(request.measurements)
    if request.emergency_override:
        return escalation_result(observations, missing, protocol_ref=reviewed_rules.emergency_ref)
    permitted = [
        c for c in candidate_checks
        if c.reviewed_or_prototype_labeled
        and set(c.required_equipment).issubset(usable_equipment(inventory))
    ]
    if not permitted:
        return insufficient_evidence_result(observations, missing)
    chosen = sorted(permitted, key=lambda c: (-utility(c), c.check_id))[0]
    return explainable_review_result(chosen, observations, missing, inventory)
```

## Required tests

- `emergency_override` preempts ranking 100% of seeded emergency fixtures.
- A check never lists equipment that is absent, expired or unusable.
- Missing BP is never replaced with zero, normal or false diagnostic inference.
- All outputs contain provenance and a statement that no diagnosis is established.
- Same input + same rule version => same output.
- Engine can explicitly abstain if no feasible reviewed next check exists.

## Language that is allowed

- "Reading differs from this person's recorded baseline."
- "Measurement not available; the cause remains unknown."
- "Open the approved symptom-assessment checklist."
- "Crew medical officer review is required according to this demo scenario."

## Language that is not allowed

- "The astronaut has condition X."
- "Take medicine X, dose Y."
- "This model is 95% accurate for real astronauts" without real evaluation.
- "This organ is diseased" based on conceptual 3D color.

Always distinguish **algorithm verification in synthetic scenarios** from medical validation, which is outside hackathon scope.
