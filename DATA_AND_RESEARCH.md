# MEDNAV — Data, Sources, and Provenance

## Why a hybrid data strategy

Public NASA repositories include relevant research and environmental measurements, but a complete, synchronized, publicly accessible astronaut record covering individual vital signs, symptoms, inventory and clinical decisions should **not** be assumed. We therefore use **separate data layers**:

1. **NASA research references:** support the domain problem and relevant constraints.
2. **Optional public environmental records:** support a standalone real-data visual or analysis if downloaded and verified.
3. **Synthetic astronaut check-ins, equipment lists and incidents:** power the reproducible demo and algorithm tests.

Never join unrelated real environmental readings to a fictional person and present it as an actual astronaut medical record.

## Official sources to investigate and verify

- NASA Space Apps challenge (source of requirements): `https://www.spaceappschallenge.org/2026/challenges/health-monitoring-software/?tab=resources`
- NASA Human Research Program hazards: `https://www.nasa.gov/hrp/hazards/`
- NASA Human Research Program risks: `https://www.nasa.gov/hrp/risks/`
- NASA Open Science Data Repository: `https://osdr.nasa.gov/`
- NASA Environmental Data Application: `https://visualization.osdr.nasa.gov/eda/`
- NASA Life Sciences Portal: `https://nlsp.nasa.gov/`

**Read the actual challenge resources and current license/access terms before claiming a specific dataset is required or downloadable.** Research pages are not automatically raw datasets, and restricted human data must not be bypassed.

## Required seeded synthetic files

```text
data/synthetic/astronauts.csv
  astronaut_id,display_name,dataset_type

data/synthetic/health_daily.csv
  astronaut_id,observed_at,resting_hr_bpm,sleep_hours,reported_symptoms,dataset_type

data/synthetic/inventory.csv
  equipment_id,label,quantity,usable,dataset_type

data/scenarios/scenarios.json
  scenario_id,title,investigation_request,expected_status,
  expected_missing_data,forbidden_equipment,notes
```

Each synthetic row must have `dataset_type=synthetic`. Include 4 fictional astronauts and >=30 days of records (variation for visual trends; not a clinical model).

## Scenario cases (minimum 12)

1. Normal-looking trend, no symptoms.
2. Individual fatigue and sleep decrease.
3. Headache and dizziness with missing BP measurement.
4. Same symptoms with BP equipment out of stock.
5. Sensor stops reporting for a day.
6. Multiple symptoms but conflicting records.
7. Checklist resource available.
8. Item listed but expired/unusable.
9. Earth communication offline.
10. Emergency override — ordinary ranking must stop.
11. Repeat identical request — deterministic response.
12. No feasible optional check — return `insufficient_evidence` or reviewed escalation route.

Optional environmental demonstration: real NASA EDA record with `dataset_type=real_nasa_environmental`, original file name, DOI/URL, collection dates, measurement units, and transformation notes.

## Provenance record

Store source as a string such as `synthetic:scenario_04`, `nasa_research:<URL>`, or `real_nasa_environmental:<record_identifier>`. Do **not** mark a synthetic reading `NASA data` just because its range resembles a study.

## Reporting caveats

- Any threshold not from a verified, applicable standard must be labeled a **demo rule**, never a safety limit.
- Human subjects in research may not represent active crew or specific conditions.
- Unknown BP, bone density, immune status or radiation effects must stay unknown without an appropriate measurement.
- Keep a file `docs/research_sources.md` recording link, date checked, claim supported and access conditions.
