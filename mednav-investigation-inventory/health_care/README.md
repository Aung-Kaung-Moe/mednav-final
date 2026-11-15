# MEDNAV Offline Healthcare Reference Library (`health_care/`)

This folder stores verified offline clinical condition summaries, red-flag screening rules, and adult spaceflight medication references so astronauts and mission medical tools operate **100% without internet or Wi-Fi** during orbital or deep-space missions.

## Files
- `astronaut_preflight_baseline.json` — Pre-flight resting astronaut vital-sign reference ranges (heart rate, respiratory rate, blood pressure, core temperature, and sleep) per NASA-STD-3001 / OCHMO-STD-100.1A and MedlinePlus/NIH.
- `conditions_and_symptoms.json` — Symptom clusters, abnormal vital-sign triggers (such as resting heart rate well above baseline with dizziness, headache, or cold sweats), non-drug care steps, red-flag escalation thresholds, and first-line onboard medication guidance.
- `medications_formulary.json` — Detailed adult indications, standard dosing, 24-hour limits, contraindications, and spaceflight precautions for all medications carried in the MEDNAV Medical Inventory.

## Reference Sources Saved Offline
- Mayo Clinic: Dehydration, Orthostatic Hypotension, POTS / Tachycardia & Cold Sweats Emergency Red Flags
- MedlinePlus / NIH: Acetaminophen, Ibuprofen, Oral Rehydration Salts (ORS), Meclizine, Ondansetron, Melatonin Drug References
- NASA-STD-3001 Vol. 1 & 2 / ISS In-Flight Medical Checklist (IFMC) & Wotring (2015) *FASEB J* (`PMC4621588`)
