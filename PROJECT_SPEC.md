# MEDNAV — Product Requirements and Scope

## Problem statement

On long-duration missions, crew members may need to assess their own health while Earth-based medical support is delayed or unavailable. Medical observations can be incomplete, and onboard equipment and supplies are finite. A generic dashboard highlights measurements but may not help a crew member identify **which verified check is feasible and useful next**.

## Proposed solution

**MEDNAV** is an offline-first, evidence-aware health-monitoring and investigation **prototype**. It gathers observations, compares them with personal historical baselines, highlights missing information, checks onboard resource availability, and navigates to reviewed checklists or medical-officer review. It does not diagnose or treat disease.

## Primary users

- **Astronaut:** views trends, logs symptoms, sees unknown measurements and approved next actions.
- **Crew medical officer:** reviews flagged incidents, evidence summaries and check feasibility.
- **Researcher/judge (demo):** changes a fictional incident and evaluates reproducible software behavior.

## Required MVP features (ship these first)

1. Select one of 4 fictional astronaut profiles.
2. Input symptoms and health readings; view sleep/resting-heart-rate trends and personal baseline comparisons.
3. Detect missing measurements and document measurement provenance.
4. Display onboard inventory with equipment availability (and optionally quantity/expiry).
5. Run deterministic resource-aware, safety-gated next-check engine; explain results and uncertainty.
6. Save and reopen an incident record locally without internet.
7. Show source-labeled demo datasets and tests proving behavior on multiple scenarios.

## High-impact but optional after MVP

- Interactive 3D body as an **information navigation interface** (not spatial pathology mapping).
- 3–5 offline voice commands for navigation and symptom entry with confirmation.
- Export/share a locally generated incident summary for later ground review; real transmission is not included in MVP.
- Optional NASA environmental data explorer, maintained separately from fictional crew histories.

## Out of scope

- Clinical-grade diagnosis/treatment, autonomous therapy or spacecraft control.
- Reading live astronaut wearable devices without access/consent.
- Inferring bone density, immune function or radiation-induced disease from unrelated vital signs.
- Claiming that synthetic model evaluation proves real-world medical safety.
- Full 3D anatomy, conversational AI physician, real mission sync, radiation risk prediction.

## Unique research question

> In constrained, fictional mission scenarios, can a system that tracks unknown measurements and equipment availability identify a permissible next health check more consistently than a fixed, equipment-agnostic checklist?

## Demonstration claim (truthful version)

"MEDNAV improves **resource feasibility and missing-information handling in simulated scenarios** compared with a basic checklist." Do not assert improvement until measured. Never claim medical outcome improvement or clinical accuracy.

## Definition of done

- Four fake astronauts; >=30 simulated mission days for trends; >=12 scenarios including missing data and safety overrides.
- End-to-end journey from check-in to evidence summary works locally without internet.
- Every investigation returns an explicit `status`, `observations`, `missing_data`, `resource_constraints`, `safety_flags`, `next_check` (or `null`) and `evidence_sources`.
- No output recommends equipment not in usable inventory.
- Safety override path bypasses ordinary ranking.
- Unit/integration tests and a written method for evaluating baseline vs MEDNAV exist.
- A reproducible 90-second demo and a limitations slide/readme are provided.

## Success hierarchy

**Scientific honesty and safety > functioning engine and data flow > reproducibility > usability > 3D/voice polish.**
