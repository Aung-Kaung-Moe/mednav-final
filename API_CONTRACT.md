# MEDNAV — API and Data Contract v1

**Contract owner:** Member 2. **Freeze target:** Hour 3. All agents use snake_case field names and ISO-8601 timestamps. Fields may only change after team-wide agreement.

## Primary endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/v1/astronauts` | List fictional crew profiles |
| `GET` | `/api/v1/astronauts/{astronaut_id}/health` | Trends and baselines |
| `POST` | `/api/v1/checkins` | Add symptom/measurement report |
| `GET` | `/api/v1/inventory` | Available and unavailable equipment |
| `POST` | `/api/v1/investigations` | Evaluate safety-gated next-check flow |
| `GET` | `/api/v1/reports/{incident_id}` | Retrieve saved incident evidence |
| `GET` | `/api/v1/healthz` | Local server readiness |

Use a JSON error envelope: `{"error":{"code":"validation_error","message":"..."}}`. Validation errors should not be silently swallowed.

## POST `/api/v1/investigations` — request (fictional)

```json
{
  "astronaut_id": "A01",
  "observed_at": "2026-11-14T09:00:00+06:30",
  "symptoms": ["headache", "dizziness"],
  "measurements": {
    "resting_hr_bpm": 88,
    "sleep_hours": 4.2,
    "systolic_bp_mm_hg": null,
    "diastolic_bp_mm_hg": null
  },
  "personal_baseline": {
    "resting_hr_bpm": 70,
    "sleep_hours": 7.3
  },
  "available_equipment": ["thermometer"],
  "communication_status": "offline",
  "emergency_override": false,
  "dataset_type": "synthetic"
}
```

- `null` means **unknown**; never substitute zero or normal.
- `available_equipment` is a sanitized list computed from usable inventory (not merely listed stock).
- `emergency_override` is a fictional scenario/test flag or a reviewed protocol trigger; the engine must not infer an unvalidated emergency classification from arbitrary text.
- For MVP, `dataset_type` must be `synthetic`. Historical research visualizations use separate records with a documented provenance label.

## Example response (expected shape, not a clinical assessment)

```json
{
  "status": "needs_review",
  "observations": [
    "Headache and dizziness were reported",
    "Resting heart rate differs from the recorded personal baseline",
    "Sleep duration is below the recorded personal baseline"
  ],
  "missing_data": ["systolic_bp_mm_hg", "diastolic_bp_mm_hg"],
  "resource_constraints": ["bp_monitor unavailable"],
  "safety_flags": [],
  "next_check": {
    "id": "symptom_review_checklist",
    "label": "Open the reviewed symptom-assessment checklist",
    "requires_equipment": [],
    "prototype_only": true
  },
  "requires_medical_officer_review": true,
  "explanation": "Blood-pressure readings are missing; the recorded inventory has no usable monitor. Cause remains unknown.",
  "evidence_sources": ["synthetic:mission_day_180"],
  "diagnosis": null
}
```

## Safety override response

When `emergency_override=true`: `status="escalate"`, `next_check=null`, `requires_medical_officer_review=true`, `safety_flags` contains `"approved_emergency_protocol_required"`. The explanation must instruct the user to follow the **mission-approved** emergency workflow, with no invented steps or treatments.

## Other endpoint shapes (minimum)

- `GET /astronauts`: `[{"astronaut_id":"A01","display_name":"Crew A","dataset_type":"synthetic"}]`
- `GET /astronauts/A01/health`: `{"astronaut_id":"A01","baseline":{},"series":[{"observed_at":"...","resting_hr_bpm":72,"sleep_hours":7.5}],"dataset_type":"synthetic"}`
- `POST /checkins`: uses `astronaut_id`, `observed_at`, `symptoms`, `measurements`, `dataset_type`; returns `{"checkin_id":"...","saved":true}`.
- `GET /inventory`: `[{"equipment_id":"bp_monitor","label":"Blood-pressure monitor","quantity":0,"usable":false,"dataset_type":"synthetic"}]`
- `GET /reports/{incident_id}`: returns saved investigation response with `incident_id` and timestamps.

## Contract test requirements

1. Missing BP stays `null` and appears in `missing_data`.
2. Any selected `next_check.requires_equipment` is a subset of `available_equipment`.
3. Safety override returns `escalate` and no ranked next check.
4. `diagnosis` is always `null` in MVP.
5. Identical requests + rule version produce identical responses.

**No new endpoints or field names without a short pull request updating this document.**
