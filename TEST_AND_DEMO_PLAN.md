# MEDNAV — Testing, Evaluation and Demo Plan

## What we can prove

We can test **software correctness in simulated scenarios**, not medical effectiveness in real astronaut crews. The central evaluation is whether MEDNAV respects missing information, equipment availability and safety-override requirements more reliably than a fixed-order checklist.

## Minimum scenario matrix

| Scenario | Expected behavior |
|---|---|
| Normal check-in | No invented diagnosis; ordinary record saved |
| Sleep below personal baseline | Explain observed change without disease claim |
| Missing blood pressure | Show `unknown`, never `normal` |
| BP monitor unavailable | Never suggest `measure_blood_pressure` |
| Equipment listed but unusable | Treat as unavailable |
| Earth connection offline | Same core investigation runs locally |
| Manual emergency override | `status=escalate`; skip ranking |
| No eligible next check | Return `insufficient_evidence` and request reviewed help |
| Contradictory measurements | Flag conflict, do not force a conclusion |
| Same case repeated | Exactly the same output under same rule version |
| Invalid field type | Return actionable validation error |
| Source provenance | All scenario outputs label `synthetic` |

## Suggested engineering metrics

- **Resource-feasibility violation count:** times an action requiring unavailable equipment is proposed (target on seeded tests: 0).
- **Missing-measurement recall:** fraction of deliberately removed fields flagged as unknown (target on seeded tests: 100%).
- **Emergency override compliance:** fraction of seeded override cases routed to escalation (target: 100%).
- **Determinism:** identical outputs on replay with identical versioned inputs (target: 100%).
- **Checks to synthetic evidence target:** compare against fixed-order baseline, report observed values rather than guessing.
- **False alerts in synthetic normals:** report actual observed count.

**Do not state accuracy percentages unless the tests were run and the denominators were recorded.** Seeded tests are not clinical validation.

## 90-second demo script

**0–15 s:** Why long-duration crews need health monitoring when ground communication is delayed and supplies are limited.

**15–30 s:** Open fictional Crew A profile; show historical health trends and a symptom check-in.

**30–45 s:** Reveal unknown blood-pressure measurement and limited inventory; show the real constraints.

**45–65 s:** Run `Investigate`; display review status, missing evidence, feasible next check and explanation.

**65–75 s:** Turn Wi-Fi off or show local-only environment; repeat investigation. Optional: voice-open the 3D heart information view.

**75–90 s:** Show reproducible evaluation metrics and caveat: no diagnosis or clinical claims.

## Demo readiness checklist

- [ ] Works without internet.
- [ ] 4 fictional profiles, seeded scenarios and inventory load.
- [ ] Core flow works with mouse/keyboard even if voice fails.
- [ ] 3D UI is an interface to records, not a diagnosis visualization.
- [ ] All data labels and provenance visible.
- [ ] Short screen recording captured; fallback video stored locally.
- [ ] README includes exact local run/test commands when code exists.
- [ ] NASA source links are verified in `docs/research_sources.md`.
- [ ] Scientific and clinical limitations stated plainly.

## Final deliverables

Working code repository, clear run instructions, API contract, data provenance, tests and measured evaluation, short demo, challenge-alignment paragraph, and limitations.
