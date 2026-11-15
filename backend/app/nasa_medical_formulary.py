"""Local NASA-STD-3001 / ISS Spaceflight Medical Kit Clinical Formulary & Protocol Rules.

Grounds MEDNAV's offline-capable medication selection, contraindication filtering,
and mission-rationed dosing in published NASA Exploration Medical Capability (ExMC),
ISS In-Flight Medical Checklist (IFMC), and NASA-STD-3001 Level of Care guidelines.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# Fixed pre-flight screened onboard medications seeded into Medical Inventory.
# Pack assignments reflect NASA ISS Convenience Pack (White), Oral Medication Pack
# (Purple), and Fluid/Circadian Countermeasure Kits.
ISS_FORMULARY_SEEDS: list[dict] = [
    {
        "id": "acetaminophen_500mg",
        "name": "Acetaminophen 500 mg",
        "category": "Medication",
        "unit": "tablets",
        "quantity": 24,
        "default_quantity": 24,
        "max_daily_dose": 3,
        "standard_course_days": 2,
        "reserve_per_crew_30d": 3,
        "contraindications": "Avoid exceeding 3,000 mg/24h; preferred antipyretic when dehydrated or nauseated (gentle on stomach).",
        "protocol_ref": "ISS Convenience Pack · Headache & Fever Care (IFMC)",
    },
    {
        "id": "ibuprofen_400mg",
        "name": "Ibuprofen 400 mg",
        "category": "Medication",
        "unit": "tablets",
        "quantity": 24,
        "default_quantity": 24,
        "max_daily_dose": 3,
        "standard_course_days": 2,
        "reserve_per_crew_30d": 3,
        "contraindications": "Take with food; avoid if dehydrated, orthostatic, or having stomach upset/nausea.",
        "protocol_ref": "ISS Convenience Pack · Pain, Inflammation & ARED Strain (IFMC)",
    },
    {
        "id": "oral_rehydration_salts",
        "name": "Oral Rehydration Salts (ORS)",
        "category": "Medication",
        "unit": "packets",
        "quantity": 18,
        "default_quantity": 18,
        "max_daily_dose": 2,
        "standard_course_days": 2,
        "reserve_per_crew_30d": 2,
        "contraindications": "Mix 1 packet with 500 mL potable water; sip slowly if dizzy or nauseated.",
        "protocol_ref": "ISS Fluid Shift & Post-EVA Rehydration Protocol",
    },
    {
        "id": "meclizine_25mg",
        "name": "Meclizine 25 mg",
        "category": "Medication",
        "unit": "tablets",
        "quantity": 14,
        "default_quantity": 14,
        "max_daily_dose": 2,
        "standard_course_days": 2,
        "reserve_per_crew_30d": 2,
        "contraindications": "May cause drowsiness; avoid safety-critical EVA or docking duties right after dosing.",
        "protocol_ref": "ISS Oral Pack · Space Motion Sickness (SMS) Protocol",
    },
    {
        "id": "ondansetron_8mg",
        "name": "Ondansetron 8 mg ODT",
        "category": "Medication",
        "unit": "tablets",
        "quantity": 12,
        "default_quantity": 12,
        "max_daily_dose": 2,
        "standard_course_days": 2,
        "reserve_per_crew_30d": 2,
        "contraindications": "Dissolve on tongue (no water needed); non-sedating option for nausea or SMS.",
        "protocol_ref": "ISS Oral Pack (Purple) · Non-Sedating Anti-Emetic Protocol",
    },
    {
        "id": "melatonin_3mg",
        "name": "Melatonin 3 mg",
        "category": "Medication",
        "unit": "tablets",
        "quantity": 16,
        "default_quantity": 16,
        "max_daily_dose": 1,
        "standard_course_days": 3,
        "reserve_per_crew_30d": 2,
        "contraindications": "Take 30-60 min before scheduled sleep period alongside dark/quiet sleep station.",
        "protocol_ref": "NASA Circadian Entrainment & Sleep Support Protocol",
    },
]

# Ordered therapeutic fallback chains when first-line onboard stock reaches 0.
FALLBACK_CHAIN: dict[str, tuple[str, ...]] = {
    "acetaminophen_500mg": ("ibuprofen_400mg",),
    "ibuprofen_400mg": ("acetaminophen_500mg",),
    "meclizine_25mg": ("ondansetron_8mg",),
    "ondansetron_8mg": ("meclizine_25mg",),
}


@dataclass(frozen=True)
class ProtocolGuideline:
    condition_id: str
    reference: str
    urgency: Literal["low", "moderate", "high"]
    non_drug_countermeasure: str


CONDITION_PROTOCOLS: dict[str, ProtocolGuideline] = {
    "febrile_infectious_illness": ProtocolGuideline(
        condition_id="febrile_infectious_illness",
        reference="NASA-STD-3001 / ISS IFMC · Antipyretic & Infection Screening",
        urgency="high",
        non_drug_countermeasure="Track temperature every 4h via Medical Diagnostic Pack and schedule a Flight Surgeon PMC if fever stays >=38.5 C over 24h.",
    ),
    "space_motion_vestibular": ProtocolGuideline(
        condition_id="space_motion_vestibular",
        reference="NASA ExMC · Space Motion Sickness (SMS) Vestibular Countermeasure",
        urgency="moderate",
        non_drug_countermeasure="Minimize rapid head movements, anchor body position, and sip fluids slowly.",
    ),
    "dehydration_orthostatic": ProtocolGuideline(
        condition_id="dehydration_orthostatic",
        reference="NASA Fluid Shift & Orthostatic Intolerance Protocol",
        urgency="high",
        non_drug_countermeasure="Hydrate with 500 mL electrolyte fluid and avoid sudden standing maneuvers until dizziness resolves.",
    ),
    "cephalad_tension_headache": ProtocolGuideline(
        condition_id="cephalad_tension_headache",
        reference="ISS IFMC · Cephalad Fluid-Shift & Cabin CO2 Headache Protocol",
        urgency="moderate",
        non_drug_countermeasure="Check cabin CO2 airflow ventilation, rest eyes, and maintain steady water intake.",
    ),
    "circadian_sleep_deficit": ProtocolGuideline(
        condition_id="circadian_sleep_deficit",
        reference="NASA Operational Circadian Alignment & Sleep Hygiene Guideline",
        urgency="moderate",
        non_drug_countermeasure="Dim workstation lighting 60 min before sleep station rest and avoid stimulants before sleep window.",
    ),
    "post_exercise_tachycardia": ProtocolGuideline(
        condition_id="post_exercise_tachycardia",
        reference="ISS Countermeasure · Post-ARED / EVA Physiological Recovery",
        urgency="low",
        non_drug_countermeasure="Cool down 15-20 min, hydrate, and avoid unnecessary medication to conserve crew formulary.",
    ),
}
