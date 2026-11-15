"""Iterative multi-turn investigation and mission-aware medication rationing engine.

Uses synthetic/test mission parameters (crew count, remaining mission days, and
onboard medication stock) together with daily check-in observations to:
1. Iteratively ask simple, plain-language questions to narrow down the cause
   of an astronaut's symptoms or unusual readings.
2. Compute a medication recommendation and exact dosage cap based on onboard
   medication stock, total astronauts onboard, and remaining mission days.
3. Deduct medication units from the onboard inventory when taken.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
import json
from math import ceil
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import (
    AstronautRow,
    CheckInRow,
    InventoryRow,
    InvestigationSessionRow,
    MedicationStockRow,
    MissionConfigRow,
    SeedVersion,
)
from .nasa_medical_formulary import (
    CONDITION_PROTOCOLS,
    FALLBACK_CHAIN,
    ISS_FORMULARY_SEEDS,
)

MISSION_SEED_ID = "iterative-investigation-v1"

DEFAULT_MISSION_CONFIG = {
    "id": "default",
    "crew_count": 4,
    "remaining_days": 45,
    "communication_mode": "online",
    "mission_label": "Orbital Demo · Synthetic Mission",
}

DEFAULT_MEDICATIONS = ISS_FORMULARY_SEEDS
HEALTH_CARE_DIR = Path(__file__).resolve().parents[2] / "health_care"


@lru_cache(maxsize=1)
def _load_health_care_library() -> tuple[dict[str, Any], dict[str, Any]]:
    """Load local offline medical references saved under health_care/ (no network needed)."""
    conditions: dict[str, Any] = {}
    medications: dict[str, Any] = {}
    cond_path = HEALTH_CARE_DIR / "conditions_and_symptoms.json"
    med_path = HEALTH_CARE_DIR / "medications_formulary.json"
    try:
        if cond_path.is_file():
            conditions = json.loads(cond_path.read_text(encoding="utf-8")).get("conditions", {})
    except Exception:
        conditions = {}
    try:
        if med_path.is_file():
            medications = json.loads(med_path.read_text(encoding="utf-8")).get("medications", {})
    except Exception:
        medications = {}
    return conditions, medications


@lru_cache(maxsize=1)
def _load_preflight_baseline() -> dict[str, Any]:
    """Load pre-flight astronaut normal vital-sign baseline reference saved under health_care/."""
    path = HEALTH_CARE_DIR / "astronaut_preflight_baseline.json"
    try:
        if path.is_file():
            return json.loads(path.read_text(encoding="utf-8")).get("preflight_normal_baselines", {})
    except Exception:
        pass
    return {}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True, allow_inf_nan=False)


class MedicationStockDTO(StrictModel):
    id: str
    name: str
    category: str
    unit: str
    quantity: int = Field(ge=0)
    default_quantity: int = Field(ge=0)
    max_daily_dose: int = Field(ge=1)
    standard_course_days: int = Field(ge=1)
    reserve_per_crew_30d: int = Field(ge=0)
    contraindications: str
    protocol_ref: str


class MissionContextDTO(StrictModel):
    crew_count: int = Field(ge=1, le=30)
    remaining_days: int = Field(ge=1, le=1825)
    mission_label: str
    medications: list[MedicationStockDTO]
    synthetic: Literal[True] = True


class MedicationQuantityPatch(StrictModel):
    id: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=0, le=5000, strict=True)


class MissionContextUpdate(StrictModel):
    crew_count: int | None = Field(default=None, ge=1, le=30, strict=True)
    remaining_days: int | None = Field(default=None, ge=1, le=1825, strict=True)
    medications: list[MedicationQuantityPatch] | None = None


class StartSessionRequest(StrictModel):
    astronaut_id: str = Field(min_length=1, max_length=100)
    check_in_id: str | None = Field(default=None, min_length=1, max_length=200)


class SubmitAnswerRequest(StrictModel):
    question_id: str = Field(min_length=1, max_length=100)
    answer_value: str = Field(min_length=1, max_length=100)
    numeric_value: float | None = Field(default=None, gt=0, lt=500)


class DispenseRequest(StrictModel):
    medication_id: str | None = Field(default=None, min_length=1, max_length=100)


class QuestionOptionDTO(StrictModel):
    value: str
    label: str
    tone: Literal["neutral", "confirm", "warn"] = "neutral"


class InvestigationQuestionDTO(StrictModel):
    id: str
    prompt: str
    rationale: str
    required_equipment: str | None = None
    equipment_usable: bool | None = None
    supports_numeric_input: bool = False
    numeric_label: str | None = None
    numeric_unit: str | None = None
    options: list[QuestionOptionDTO]


class HypothesisDTO(StrictModel):
    id: str
    label: str
    status: Literal["leading", "active", "ruled_out"]
    score: int = Field(ge=0, le=100)
    reason: str


class TurnRecordDTO(StrictModel):
    turn: int
    question_id: str
    question_prompt: str
    answer_value: str
    answer_label: str
    numeric_value: float | None = None
    recorded_at: str


class MedicationAllocationDTO(StrictModel):
    rationing_mode: Literal["standard", "rationed", "depleted", "non_pharmacologic"]
    medication_id: str | None = None
    medication_name: str | None = None
    unit: str | None = None
    stock_available: int = 0
    crew_count: int
    remaining_days: int
    crew_safety_reserve: int = 0
    allocatable_pool: int = 0
    standard_total_units: int = 0
    recommended_total_units: int = 0
    recommended_daily_dose: int = 0
    recommended_days: int = 0
    remaining_stock_after: int = 0
    instruction_headline: str
    dosage_schedule: str
    rationing_rationale: str


class CheckInSnapshotDTO(StrictModel):
    id: str
    astronaut_id: str
    recorded_at: str
    hr: float | None
    baseline_hr: float
    sleep: float | None
    baseline_sleep: float
    bp: str | None
    symptoms: list[str]
    anomalies: list[str]
    missing_fields: list[str]


class InvestigationSessionDTO(StrictModel):
    id: str
    astronaut_id: str
    check_in_id: str
    status: Literal["in_progress", "completed"]
    turn_count: int
    max_turns: int
    summary_headline: str
    assessment_title: str
    assessment_summary: str
    confidence_pct: int = Field(ge=0, le=100)
    check_in_snapshot: CheckInSnapshotDTO
    mission_context: MissionContextDTO
    hypotheses: list[HypothesisDTO]
    current_question: InvestigationQuestionDTO | None
    turns: list[TurnRecordDTO]
    medication_allocation: MedicationAllocationDTO | None
    secondary_allocations: list[MedicationAllocationDTO] = Field(default_factory=list)
    clinical_basis: list[str] = Field(default_factory=list)
    dispensed: bool
    dispensed_medication_id: str | None = None
    dispensed_units: int = 0
    dispensed_secondary_ids: list[str] = Field(default_factory=list)
    condition_id: str | None = None
    proactive_alert: str | None = None
    synthetic: Literal[True] = True


class CrewProactiveAlertDTO(StrictModel):
    astronaut_id: str
    deviation_count: int
    summary_tags: list[str]
    urgent: bool
    needs_investigation: bool
    session_status: str | None = None


def _sync_formulary_medications(session: Session) -> bool:
    """Keep MedicationStockRow aligned to the curated 6-item ISS formulary without resetting counts."""
    dirty = False
    active_ids = {med["id"] for med in DEFAULT_MEDICATIONS}
    for existing in list(session.scalars(select(MedicationStockRow))):
        if existing.id not in active_ids:
            session.delete(existing)
            dirty = True
    for med in DEFAULT_MEDICATIONS:
        if not session.get(MedicationStockRow, med["id"]):
            session.add(MedicationStockRow(**med))
            dirty = True
    return dirty


def seed_mission_medications(session: Session) -> None:
    """Idempotently seed synthetic mission context and medication test stock."""
    if not session.get(MissionConfigRow, "default"):
        session.add(MissionConfigRow(**DEFAULT_MISSION_CONFIG))
    added = _sync_formulary_medications(session)
    if not session.get(SeedVersion, MISSION_SEED_ID):
        session.add(SeedVersion(id=MISSION_SEED_ID))
        added = True
    if added:
        session.commit()


def ensure_mission_defaults(session: Session) -> MissionConfigRow:
    """Return the active mission config, initializing synthetic defaults if empty."""
    cfg = session.get(MissionConfigRow, "default")
    dirty = False
    if cfg is None:
        cfg = MissionConfigRow(**DEFAULT_MISSION_CONFIG)
        session.add(cfg)
        dirty = True
    if _sync_formulary_medications(session):
        dirty = True
    if not session.get(SeedVersion, MISSION_SEED_ID):
        session.add(SeedVersion(id=MISSION_SEED_ID))
        dirty = True
    if dirty:
        session.commit()
    return cfg


def build_mission_context_dto(session: Session) -> MissionContextDTO:
    cfg = ensure_mission_defaults(session)
    meds = list(session.scalars(select(MedicationStockRow).order_by(MedicationStockRow.name)))
    return MissionContextDTO(
        crew_count=cfg.crew_count,
        remaining_days=cfg.remaining_days,
        mission_label=cfg.mission_label,
        medications=[MedicationStockDTO.model_validate(m) for m in meds],
    )


def update_mission_context(session: Session, patch: MissionContextUpdate) -> MissionContextDTO:
    cfg = ensure_mission_defaults(session)
    if patch.crew_count is not None:
        cfg.crew_count = patch.crew_count
    if patch.remaining_days is not None:
        cfg.remaining_days = patch.remaining_days
    if patch.medications:
        for item in patch.medications:
            row = session.get(MedicationStockRow, item.id)
            if row is None:
                raise LookupError(f"Medication '{item.id}' not found")
            row.quantity = item.quantity
    session.commit()
    return build_mission_context_dto(session)


def reset_mission_context(session: Session) -> MissionContextDTO:
    cfg = ensure_mission_defaults(session)
    cfg.crew_count = DEFAULT_MISSION_CONFIG["crew_count"]
    cfg.remaining_days = DEFAULT_MISSION_CONFIG["remaining_days"]
    for med in DEFAULT_MEDICATIONS:
        row = session.get(MedicationStockRow, med["id"])
        if row is None:
            session.add(MedicationStockRow(**med))
        else:
            row.quantity = med["default_quantity"]
    session.commit()
    return build_mission_context_dto(session)


@dataclass(frozen=True)
class QuestionSpec:
    id: str
    prompt: str
    rationale: str
    options: tuple[tuple[str, str, Literal["neutral", "confirm", "warn"]], ...]
    required_equipment: str | None = None
    supports_numeric_input: bool = False
    numeric_label: str | None = None
    numeric_unit: str | None = None


QUESTIONS: dict[str, QuestionSpec] = {
    "mission_duration_check": QuestionSpec(
        id="mission_duration_check",
        prompt="How long will your crew remain in space on this mission?",
        rationale="Balances your medication dose against supplies reserved for the remaining mission days.",
        supports_numeric_input=True,
        numeric_label="Or enter exact remaining days",
        numeric_unit="days",
        options=(
            ("15", "~15 days (Short mission)", "neutral"),
            ("45", "~45 days (Medium mission)", "neutral"),
            ("90", "~90 days (Extended mission)", "neutral"),
            ("180", "~180 days (Long duration)", "neutral"),
        ),
    ),
    "recent_exercise": QuestionSpec(
        id="recent_exercise",
        prompt="Did you work out or do heavy physical activity in the last 45 minutes?",
        rationale="Exercise naturally raises your heart rate, so checking this first helps tell normal recovery apart from illness.",
        options=(
            ("yes", "Yes, I just worked out", "confirm"),
            ("no", "No, I have been resting", "neutral"),
            ("unknown", "Not sure", "warn"),
        ),
    ),
    "sweating_autonomic_check": QuestionSpec(
        id="sweating_autonomic_check",
        prompt="Are you having cold sweats, clammy skin, chest tightness, or shortness of breath right now?",
        rationale="Because your heart rate rose sharply above your resting baseline, checking for cold sweats or chest discomfort screens for urgent autonomic stress or dehydration.",
        options=(
            ("yes", "Yes — Cold sweats, clammy skin, or chest tightness", "warn"),
            ("no", "No — No cold sweats or chest discomfort", "confirm"),
            ("unknown", "Not sure", "neutral"),
        ),
    ),
    "hydration_intake": QuestionSpec(
        id="hydration_intake",
        prompt="Have you drunk enough water today, or do you feel thirsty or dry?",
        rationale="Not drinking enough fluids can raise your heart rate and cause headaches or dizziness.",
        options=(
            ("low", "Not enough water / Feel thirsty", "warn"),
            ("adequate", "Yes, I drank enough water", "confirm"),
            ("unknown", "Not sure", "neutral"),
        ),
    ),
    "temperature_check": QuestionSpec(
        id="temperature_check",
        prompt="Does your body feel hot or feverish? (Optional: enter your temperature below)",
        rationale="Checking for a fever helps tell if you have an infection or just tiredness or dehydration.",
        required_equipment="Digital thermometer",
        supports_numeric_input=True,
        numeric_label="Temperature (°C)",
        numeric_unit="°C",
        options=(
            ("normal", "Normal — No fever (< 37.5 °C)", "confirm"),
            ("elevated", "Hot / Feverish (>= 38.0 °C)", "warn"),
            ("unavailable", "Cannot check right now", "neutral"),
        ),
    ),
    "orthostatic_bp_check": QuestionSpec(
        id="orthostatic_bp_check",
        prompt="Do you feel lightheaded or dizzy when you stand up or change position?",
        rationale="Feeling dizzy when moving often means your body needs fluids or blood pressure is low.",
        required_equipment="Blood-pressure monitor",
        options=(
            ("orthostatic", "Yes, dizzy when standing or moving", "warn"),
            ("stable", "No, I feel steady", "confirm"),
            ("cannot_measure", "Not sure", "neutral"),
        ),
    ),
    "vestibular_trigger": QuestionSpec(
        id="vestibular_trigger",
        prompt="Does the dizziness or upset stomach get worse when you turn your head or float around?",
        rationale="This helps check if your balance system is causing space motion sickness.",
        options=(
            ("yes", "Yes, movement makes it worse", "warn"),
            ("no", "No, movement makes no difference", "confirm"),
        ),
    ),
    "sleep_environment": QuestionSpec(
        id="sleep_environment",
        prompt="Have you been sleeping poorly over the last couple of nights?",
        rationale="Lack of good sleep over a few days easily causes tiredness, headaches, and higher heart rate.",
        options=(
            ("disrupted", "Yes, poor or broken sleep", "warn"),
            ("normal", "No, I have been sleeping fine", "confirm"),
        ),
    ),
    "symptom_severity": QuestionSpec(
        id="symptom_severity",
        prompt="How uncomfortable do you feel right now?",
        rationale="Helps decide whether simple rest and water are enough, or if medication should be used.",
        options=(
            ("mild", "Mild — I can rest without medicine", "confirm"),
            ("moderate", "Bothersome — I need relief", "warn"),
        ),
    ),
}


def _extract_snapshot(
    check_in: CheckInRow,
    astronaut: AstronautRow,
) -> tuple[CheckInSnapshotDTO, dict[str, Any]]:
    symptoms = list(check_in.symptoms or [])
    sym_lower = {s.lower() for s in symptoms}
    hr = check_in.hr
    sleep = check_in.sleep
    bp = check_in.bp

    anomalies: list[str] = []
    missing: list[str] = []

    hr_elevated = hr is not None and (hr >= astronaut.baseline + 12 or hr >= 92)
    hr_critical = hr is not None and (hr >= 120 or hr >= astronaut.baseline + 45)
    sleep_low = sleep is not None and sleep <= max(4.5, astronaut.sleepBaseline - 1.5)

    if hr is None:
        missing.append("Heart rate")
    elif hr_elevated:
        anomalies.append(f"High heart rate: {hr:g} bpm (normal {astronaut.baseline:g} bpm)")

    if sleep is None:
        missing.append("Sleep duration")
    elif sleep_low:
        anomalies.append(f"Low sleep: {sleep:g} hrs (normal {astronaut.sleepBaseline:g} hrs)")

    if bp is None:
        missing.append("Blood pressure")

    if symptoms:
        anomalies.append("Symptoms: " + ", ".join(symptoms))

    recorded = check_in.recorded_at
    if recorded.tzinfo is None:
        recorded = recorded.replace(tzinfo=timezone.utc)

    snapshot = CheckInSnapshotDTO(
        id=check_in.id,
        astronaut_id=astronaut.id,
        recorded_at=recorded.isoformat(),
        hr=hr,
        baseline_hr=astronaut.baseline,
        sleep=sleep,
        baseline_sleep=astronaut.sleepBaseline,
        bp=bp,
        symptoms=symptoms,
        anomalies=anomalies,
        missing_fields=missing,
    )
    signals = {
        "hr": hr,
        "hr_elevated": hr_elevated,
        "hr_critical": hr_critical,
        "sleep": sleep,
        "sleep_low": sleep_low,
        "bp_missing": bp is None,
        "symptoms": symptoms,
        "sym_lower": sym_lower,
        "has_headache": any("headache" in s or "fluid" in s for s in sym_lower),
        "has_dizziness": "dizziness" in sym_lower,
        "has_nausea": "nausea" in sym_lower,
        "has_fatigue": "fatigue" in sym_lower,
        "has_muscle": "muscle discomfort" in sym_lower,
        "has_sweating": any("sweat" in s or "clammy" in s or "diaphores" in s for s in sym_lower),
        "has_visual": any("visual" in s or "vision" in s for s in sym_lower),
    }
    return snapshot, signals


def _score_hypotheses(
    signals: dict[str, Any],
    answers: dict[str, Any],
) -> list[HypothesisDTO]:
    """Compute plain-language condition possibilities from readings and answers."""
    # 1. Recent Workout / Exercise Recovery
    ex_score = 38 if signals["hr_elevated"] else 15
    if signals["has_muscle"]:
        ex_score += 20
    ex_reason = "Heart rate may just be up from a recent workout."
    ex_status: Literal["leading", "active", "ruled_out"] = "active"
    if answers.get("recent_exercise") == "yes":
        ex_score = 90
        ex_reason = "You exercised recently, which explains the higher heart rate."
    elif answers.get("recent_exercise") == "no":
        ex_score = 5
        ex_status = "ruled_out"
        ex_reason = "Ruled out because you have been resting."
    if answers.get("temperature_check") == "elevated":
        ex_score = 5
        ex_status = "ruled_out"
        ex_reason = "Ruled out because you have a fever."

    # 2. Dehydration / Low Fluids
    hyd_score = 32
    if signals["hr_elevated"]:
        hyd_score += 18
    if signals["has_dizziness"]:
        hyd_score += 20
    if signals["has_headache"] or signals["has_fatigue"]:
        hyd_score += 12
    hyd_reason = "Low water intake can raise heart rate and cause tiredness or dizziness."
    hyd_status: Literal["leading", "active", "ruled_out"] = "active"
    if answers.get("hydration_intake") == "low":
        hyd_score += 25
        hyd_reason = "Low water intake strongly points to dehydration."
    elif answers.get("hydration_intake") == "adequate":
        hyd_score -= 22
        hyd_reason = "Less likely because you drank enough water."
    if answers.get("orthostatic_bp_check") == "orthostatic":
        hyd_score += 18
        hyd_reason = "Dizziness when standing + low fluids points to dehydration."
    elif answers.get("orthostatic_bp_check") == "stable" and answers.get("hydration_intake") == "adequate":
        hyd_status = "ruled_out"
        hyd_score = 12
        hyd_reason = "Ruled out: hydration is fine and you feel steady."

    # 3. Tension / Space Headache
    head_score = 62 if signals["has_headache"] else 10
    if signals["sleep_low"]:
        head_score += 12
    head_reason = (
        "Headache is common in space from body fluid shifts or stress."
        if signals["has_headache"]
        else "No headache reported."
    )
    head_status: Literal["leading", "active", "ruled_out"] = (
        "active" if signals["has_headache"] else "ruled_out"
    )
    if answers.get("temperature_check") == "normal" and signals["has_headache"]:
        head_score += 18
        head_reason = "Headache with normal temperature points to a tension/space headache."
    if answers.get("temperature_check") == "elevated":
        head_score = max(15, head_score - 30)

    # 4. Motion Sickness / Balance Discomfort
    ves_score = 56 if (signals["has_dizziness"] or signals["has_nausea"]) else 8
    ves_status: Literal["leading", "active", "ruled_out"] = (
        "active" if (signals["has_dizziness"] or signals["has_nausea"]) else "ruled_out"
    )
    ves_reason = (
        "Dizziness or upset stomach may be space motion sickness."
        if ves_status == "active"
        else "No dizziness or upset stomach reported."
    )
    if answers.get("vestibular_trigger") == "yes":
        ves_score = 88
        ves_reason = "Symptoms get worse with movement, pointing to motion sickness."
    elif answers.get("vestibular_trigger") == "no":
        ves_score = 10
        ves_status = "ruled_out"
        ves_reason = "Ruled out because movement does not trigger symptoms."

    # 5. Lack of Sleep / Tiredness
    slp_score = 52 if (signals["sleep_low"] or signals["has_fatigue"]) else 12
    slp_status: Literal["leading", "active", "ruled_out"] = (
        "active" if (signals["sleep_low"] or signals["has_fatigue"]) else "ruled_out"
    )
    slp_reason = (
        f"Sleep was {signals['sleep']}h, which is lower than normal."
        if signals["sleep_low"]
        else "Tiredness may come from poor sleep."
    )
    if answers.get("sleep_environment") == "disrupted":
        slp_score = max(slp_score, 84)
        slp_reason = "Poor sleep over multiple nights explains your tiredness."
    elif answers.get("sleep_environment") == "normal" and not signals["sleep_low"]:
        slp_status = "ruled_out"
        slp_score = 10
        slp_reason = "Ruled out because sleep schedule has been normal."

    # 6. Fever / Possible Infection
    feb_score = 22 if (signals["hr_elevated"] or signals["has_fatigue"] or signals["has_headache"]) else 8
    feb_status: Literal["leading", "active", "ruled_out"] = "active"
    feb_reason = "Checking temperature helps see if there is a fever or infection."
    if answers.get("temperature_check") == "elevated":
        feb_score = 90
        feb_reason = "High temperature indicates a fever or infection."
    elif answers.get("temperature_check") == "normal":
        feb_score = 8
        feb_status = "ruled_out"
        feb_reason = "Ruled out because temperature is normal."

    # 7. Urgent Autonomic Stress / Acute Tachycardia + Cold Sweats
    auto_active = bool(signals["hr_critical"] or signals["has_sweating"] or answers.get("sweating_autonomic_check") == "yes")
    auto_score = 45 if signals["hr_critical"] else (68 if signals["has_sweating"] else 6)
    auto_status: Literal["leading", "active", "ruled_out"] = "active" if auto_active else "ruled_out"
    auto_reason = (
        "Sharp resting heart rate spike warrants screening for cold sweats, dizziness, or autonomic stress."
        if auto_active
        else "No critical tachycardia or cold sweat warning signs reported."
    )
    if answers.get("sweating_autonomic_check") == "yes" or signals["has_sweating"]:
        auto_score = 95
        auto_status = "active"
        auto_reason = "High heart rate with cold sweats or chest discomfort indicates urgent autonomic/volume stress — CMO consult advised."
    elif answers.get("sweating_autonomic_check") == "no" and not signals["has_sweating"]:
        auto_score = 12
        auto_status = "ruled_out"
        auto_reason = "Ruled out: no cold sweats, clammy skin, or chest tightness reported."

    # 8. Neuro-ocular / SANS visual fluid shift screening (Mader et al. 2011 / NASA HRP SANS)
    sans_score = 92 if signals["has_visual"] else 5
    sans_status: Literal["leading", "active", "ruled_out"] = "active" if signals["has_visual"] else "ruled_out"
    sans_reason = (
        "Visual acuity change in microgravity warrants neuro-ocular (SANS) review and Flight Surgeon consultation."
        if signals["has_visual"]
        else "No visual acuity change reported."
    )

    # 9. Musculoskeletal / ARED Strain
    mus_active = bool(signals["has_muscle"] and answers.get("recent_exercise") != "yes")
    mus_score = 78 if mus_active else (30 if signals["has_muscle"] else 6)
    mus_status: Literal["leading", "active", "ruled_out"] = "active" if mus_active else "ruled_out"
    mus_reason = (
        "Localized muscle soreness without acute post-workout recovery points to ARED/musculoskeletal strain."
        if mus_active
        else "No non-exercise musculoskeletal strain indicated."
    )

    # 10. Acute Nausea / GI Support
    nau_active = bool(signals["has_nausea"] and answers.get("vestibular_trigger") != "yes")
    nau_score = 76 if nau_active else (35 if signals["has_nausea"] else 6)
    nau_status: Literal["leading", "active", "ruled_out"] = "active" if nau_active else "ruled_out"
    nau_reason = (
        "Reported nausea without fever or clear vestibular trigger points to non-sedating anti-emetic support."
        if nau_active
        else "No isolated gastrointestinal nausea active."
    )

    items = [
        ("autonomic_tachycardia_diaphoresis", "Acute Tachycardia / Autonomic Stress", auto_status, min(100, max(0, auto_score)), auto_reason),
        ("sans_ocular_shift", "Ocular / Visual Fluid-Shift Check (SANS)", sans_status, min(100, max(0, sans_score)), sans_reason),
        ("post_exercise_tachycardia", "Recent Workout / Exercise Recovery", ex_status, min(100, max(0, ex_score)), ex_reason),
        ("dehydration_orthostatic", "Dehydration / Need More Fluids", hyd_status, min(100, max(0, hyd_score)), hyd_reason),
        ("cephalad_tension_headache", "Tension / Space Headache", head_status, min(100, max(0, head_score)), head_reason),
        ("space_motion_vestibular", "Space Motion Sickness", ves_status, min(100, max(0, ves_score)), ves_reason),
        ("nausea_gi_support", "Acute Nausea / Gastrointestinal Discomfort", nau_status, min(100, max(0, nau_score)), nau_reason),
        ("musculoskeletal_strain", "Musculoskeletal / ARED Strain", mus_status, min(100, max(0, mus_score)), mus_reason),
        ("circadian_sleep_deficit", "Lack of Sleep / Tiredness", slp_status, min(100, max(0, slp_score)), slp_reason),
        ("febrile_infectious_illness", "Fever / Possible Infection", feb_status, min(100, max(0, feb_score)), feb_reason),
    ]
    items.sort(key=lambda x: (-x[3], x[0]))

    result: list[HypothesisDTO] = []
    leading_assigned = False
    for hid, label, status, score, reason in items:
        final_status = status
        if status == "active" and not leading_assigned:
            final_status = "leading"
            leading_assigned = True
        result.append(HypothesisDTO(id=hid, label=label, status=final_status, score=score, reason=reason))
    return result


def _select_next_question(
    signals: dict[str, Any],
    answers: dict[str, Any],
) -> QuestionSpec | None:
    """Pick 1 to 4 targeted questions only when vitals/symptoms deviate from baseline."""
    if not signals["hr_elevated"] and not signals["sleep_low"] and not signals["symptoms"]:
        return None

    if (signals["hr_critical"] or signals["has_sweating"]) and "sweating_autonomic_check" not in answers:
        return QUESTIONS["sweating_autonomic_check"]

    if (
        (signals["hr_elevated"] or signals["has_muscle"])
        and not (signals["has_dizziness"] and signals["has_nausea"])
        and "recent_exercise" not in answers
    ):
        return QUESTIONS["recent_exercise"]

    if "mission_duration_check" not in answers:
        return QUESTIONS["mission_duration_check"]

    # If recent exercise clearly explains isolated HR elevation without other symptoms, finish in 2 steps!
    if (
        answers.get("recent_exercise") == "yes"
        and not signals["has_headache"]
        and not signals["has_dizziness"]
        and not signals["has_nausea"]
        and not signals["has_sweating"]
        and not signals["has_visual"]
    ):
        return None

    if "temperature_check" not in answers and (
        signals["hr_elevated"] or signals["has_headache"] or signals["has_fatigue"] or signals["has_nausea"] or signals["has_muscle"] or signals["has_visual"]
    ):
        return QUESTIONS["temperature_check"]

    if "vestibular_trigger" not in answers and (signals["has_dizziness"] or signals["has_nausea"]):
        return QUESTIONS["vestibular_trigger"]

    # When headache, muscle strain, or visual change is present without dizziness/critical HR, check severity within the 4-question cap
    if (
        (signals["has_headache"] or signals["has_muscle"] or signals["has_visual"])
        and not signals["has_dizziness"]
        and not signals["hr_critical"]
        and "symptom_severity" not in answers
    ):
        return QUESTIONS["symptom_severity"]

    if "hydration_intake" not in answers and (
        signals["hr_elevated"] or signals["has_headache"] or signals["has_dizziness"] or signals["has_fatigue"] or signals["has_sweating"] or signals["has_muscle"] or signals["has_nausea"]
    ):
        return QUESTIONS["hydration_intake"]

    if "orthostatic_bp_check" not in answers and signals["has_dizziness"]:
        return QUESTIONS["orthostatic_bp_check"]

    if "sleep_environment" not in answers and (signals["sleep_low"] or signals["has_fatigue"]):
        return QUESTIONS["sleep_environment"]

    if "symptom_severity" not in answers and (
        signals["symptoms"] or signals["hr_elevated"] or signals["sleep_low"]
    ):
        return QUESTIONS["symptom_severity"]

    return None


def _pick_leading_outcome(
    signals: dict[str, Any],
    answers: dict[str, Any],
    hypotheses: list[HypothesisDTO],
) -> tuple[str, str, str, int, str | None]:
    """Determine (outcome_id, title, summary, confidence_pct, medication_id)."""
    if answers.get("sweating_autonomic_check") == "yes" or (
        signals["has_sweating"] and answers.get("recent_exercise") != "yes"
    ):
        if answers.get("temperature_check") == "elevated":
            return (
                "autonomic_tachycardia_diaphoresis",
                "Urgent Autonomic / Febrile Tachycardia Alert",
                "Your heart rate spiked well above baseline with cold sweats and fever. Rest immediately, start fever reduction and oral rehydration below, and alert the Crew Medical Officer / Flight Surgeon urgently.",
                94,
                "acetaminophen_500mg",
            )
        return (
            "autonomic_tachycardia_diaphoresis",
            "Urgent Autonomic Stress / Acute Tachycardia Alert",
            "Your heart rate spiked sharply above your resting baseline with cold sweats or chest discomfort. Stop exertion, rest flat/seated, start Oral Rehydration Salts slowly, check blood pressure, and alert the Crew Medical Officer / Flight Surgeon urgently.",
            94,
            "oral_rehydration_salts",
        )

    if answers.get("recent_exercise") == "yes" and answers.get("temperature_check") != "elevated":
        med_id = "oral_rehydration_salts" if signals["has_muscle"] else None
        return (
            "post_exercise_tachycardia",
            "Recent Workout / Exercise Recovery",
            "Your heart rate is elevated because you exercised recently. Rest for 15 minutes and drink water — no illness found.",
            90,
            med_id,
        )

    if answers.get("temperature_check") == "elevated":
        return (
            "febrile_infectious_illness",
            "Fever / Possible Infection",
            "Your temperature is high with active symptoms. Use fever-reducing medication as guided below and keep monitoring.",
            85,
            "acetaminophen_500mg",
        )

    if signals["has_visual"]:
        relief_med = "acetaminophen_500mg" if (signals["has_headache"] and answers.get("symptom_severity") != "mild") else None
        return (
            "sans_ocular_shift",
            "Ocular / Visual Fluid-Shift Check (SANS)",
            "Visual acuity shifts in microgravity require ocular ultrasound / Amsler grid evaluation and Flight Surgeon review for Spaceflight Associated Neuro-ocular Syndrome (SANS).",
            91,
            relief_med,
        )

    if answers.get("vestibular_trigger") == "yes":
        ves_med = "ondansetron_8mg" if signals["has_nausea"] else "meclizine_25mg"
        return (
            "space_motion_vestibular",
            "Space Motion Sickness",
            "Movement makes your dizziness or nausea worse, which fits space motion sickness.",
            86,
            ves_med,
        )

    if answers.get("hydration_intake") == "low" or answers.get("orthostatic_bp_check") == "orthostatic":
        return (
            "dehydration_orthostatic",
            "Dehydration / Need More Fluids",
            "Low fluid intake and dizziness/elevated heart rate point to dehydration. Rehydration salts are recommended.",
            87,
            "oral_rehydration_salts",
        )

    if signals["has_nausea"]:
        return (
            "nausea_gi_support",
            "Acute Nausea / Gastrointestinal Discomfort",
            "Ongoing nausea without fever or clear motion trigger calls for non-sedating oral disintegrating anti-emetic support and gentle fluid sips.",
            83,
            "ondansetron_8mg",
        )

    if signals["has_headache"]:
        if answers.get("symptom_severity") == "mild":
            return (
                "cephalad_tension_headache",
                "Mild Tension / Space Headache",
                "Your headache is mild without fever. Rest and drink water first to save onboard medication.",
                82,
                None,
            )
        return (
            "cephalad_tension_headache",
            "Tension / Space Headache",
            "Headache without fever points to a tension or space fluid-shift headache.",
            82,
            "acetaminophen_500mg",
        )

    if signals["has_muscle"]:
        if answers.get("symptom_severity") == "mild":
            return (
                "musculoskeletal_strain",
                "Mild Musculoskeletal / ARED Strain",
                "Mild localized muscle soreness without fever recovers best with rest and water first to conserve supplies.",
                80,
                None,
            )
        return (
            "musculoskeletal_strain",
            "Musculoskeletal / ARED Strain",
            "Localized muscle discomfort without fever fits musculoskeletal or ARED strain.",
            82,
            "ibuprofen_400mg",
        )

    if signals["sleep_low"] or answers.get("sleep_environment") == "disrupted" or signals["has_fatigue"]:
        if answers.get("symptom_severity") == "mild":
            return (
                "circadian_sleep_deficit",
                "Mild Lack of Sleep / Tiredness",
                "Reduced sleep explains your tiredness. Rest on your next sleep cycle — no medication needed.",
                80,
                None,
            )
        return (
            "circadian_sleep_deficit",
            "Lack of Sleep / Tiredness",
            "Poor sleep over recent cycles explains your fatigue. Low-dose sleep support can help reset your rest cycle.",
            80,
            "melatonin_3mg",
        )

    top = hypotheses[0]
    return (
        "routine_observation",
        "Normal Readings — All Clear",
        f"Your readings look steady (top check: {top.label}). No medication is needed right now.",
        88,
        None,
    )


def compute_medication_allocation(
    *,
    medication: MedicationStockRow | None,
    crew_count: int,
    remaining_days: int,
    outcome_title: str,
    urgency: Literal["low", "moderate", "high"] = "moderate",
    fallback_note: str | None = None,
) -> MedicationAllocationDTO:
    """Compute medication recommendation using crew count, remaining days, and inventory stock.

    For acute moderate/high-urgency conditions (such as Fever >= 38.0 C, Space Motion Sickness,
    or Dehydration), an immediate stabilization floor is preserved whenever stock > 0 so an
    acutely symptomatic astronaut is never left with 0 doses while inventory exists.
    """
    if medication is None:
        return MedicationAllocationDTO(
            rationing_mode="non_pharmacologic",
            crew_count=crew_count,
            remaining_days=remaining_days,
            instruction_headline="No Medication Needed — Rest & Hydrate",
            dosage_schedule="Drink water and rest for 15–20 minutes. Keep saving onboard supplies.",
            rationing_rationale=f"For '{outcome_title}', no medicine is required, preserving 100% of supplies for {crew_count} astronauts across {remaining_days} remaining days.",
        )

    stock = medication.quantity
    standard_total = medication.max_daily_dose * medication.standard_course_days
    other_crew = max(0, crew_count - 1)
    duration_factor = max(1.0, min(2.5, remaining_days / 30.0))
    crew_safety_reserve = min(stock, int(round(other_crew * medication.reserve_per_crew_30d * duration_factor)))
    allocatable_pool = max(0, stock - crew_safety_reserve)
    recommended_total = min(standard_total, allocatable_pool)

    # Acute stabilization override: never withhold ALL units for an acute moderate/high condition while stock > 0
    acute_floor_used = False
    if stock > 0 and recommended_total == 0 and urgency in ("moderate", "high"):
        acute_units = min(stock, medication.max_daily_dose if urgency == "high" else min(2, medication.max_daily_dose))
        recommended_total = acute_units
        allocatable_pool = acute_units
        crew_safety_reserve = max(0, stock - acute_units)
        acute_floor_used = True

    if stock == 0 or recommended_total == 0:
        return MedicationAllocationDTO(
            rationing_mode="depleted",
            medication_id=medication.id,
            medication_name=medication.name,
            unit=medication.unit,
            stock_available=stock,
            crew_count=crew_count,
            remaining_days=remaining_days,
            crew_safety_reserve=crew_safety_reserve,
            allocatable_pool=allocatable_pool,
            standard_total_units=standard_total,
            recommended_total_units=0,
            recommended_daily_dose=0,
            recommended_days=0,
            remaining_stock_after=stock,
            instruction_headline=f"Supply Exhausted — 0 {medication.unit} of {medication.name} Left",
            dosage_schedule=(
                f"No {medication.unit} of {medication.name} remain in Medical Inventory. "
                "Restock or rely on supportive fluids and cooling."
            ),
            rationing_rationale=(
                f"Inventory has 0 {medication.unit} left across {crew_count} astronauts for {remaining_days} remaining days."
            ),
        )

    is_rationed = recommended_total < standard_total
    if recommended_total <= medication.standard_course_days:
        rec_daily = 1
        rec_days = recommended_total
    else:
        rec_days = medication.standard_course_days
        rec_daily = min(medication.max_daily_dose, ceil(recommended_total / rec_days))

    remaining_after = stock - recommended_total
    unit_singular = medication.unit[:-1] if rec_daily == 1 and medication.unit.endswith("s") else medication.unit
    prefix = f"{fallback_note} " if fallback_note else ""
    if acute_floor_used:
        headline = f"Take Acute Stabilization Dose — {recommended_total} {medication.unit} of {medication.name}"
        schedule = (
            f"Take {rec_daily} {unit_singular} as needed over {rec_days} day(s) "
            f"(acute stabilization dose of {recommended_total} {medication.unit} while reserving {crew_safety_reserve} for crew)."
        )
        rationale = (
            f"{prefix}Crew reserve is tight for {crew_count} astronauts across {remaining_days} days ({stock} {medication.unit} onboard). "
            f"Releasing {recommended_total} {medication.unit} for immediate symptom relief and reserving {crew_safety_reserve} {medication.unit}. "
            f"Caution: {medication.contraindications}"
        )
        mode: Literal["standard", "rationed"] = "rationed"
    elif is_rationed:
        headline = f"Take Limited Dose — Max {recommended_total} {medication.unit} of {medication.name}"
        schedule = (
            f"Take only {rec_daily} {unit_singular} per day for {rec_days} day(s) "
            f"(capped at {recommended_total} {medication.unit} instead of {standard_total} to save stock)."
        )
        rationale = (
            f"{prefix}Inventory has {stock} {medication.unit}. Reserving {crew_safety_reserve} {medication.unit} for {other_crew} other astronaut(s) "
            f"over {remaining_days} remaining days leaves {allocatable_pool} {medication.unit} for you. {medication.contraindications}"
        )
        mode = "rationed"
    else:
        headline = f"Take {recommended_total} {medication.unit} of {medication.name}"
        schedule = (
            f"Take {rec_daily} {unit_singular} per day for {rec_days} day(s). "
            "Stop early if you feel better."
        )
        rationale = (
            f"{prefix}Inventory has {stock} {medication.unit}. After reserving {crew_safety_reserve} {medication.unit} for {crew_count} astronauts "
            f"across {remaining_days} remaining days, {allocatable_pool} {medication.unit} are available. {medication.contraindications}"
        )
        mode = "standard"

    return MedicationAllocationDTO(
        rationing_mode=mode,
        medication_id=medication.id,
        medication_name=medication.name,
        unit=medication.unit,
        stock_available=stock,
        crew_count=crew_count,
        remaining_days=remaining_days,
        crew_safety_reserve=crew_safety_reserve,
        allocatable_pool=allocatable_pool,
        standard_total_units=standard_total,
        recommended_total_units=recommended_total,
        recommended_daily_dose=rec_daily,
        recommended_days=rec_days,
        remaining_stock_after=remaining_after,
        instruction_headline=headline,
        dosage_schedule=schedule,
        rationing_rationale=rationale,
    )


def _resolve_med_with_fallback(
    session: Session,
    preferred_id: str | None,
    signals: dict[str, Any],
    answers: dict[str, Any],
) -> tuple[MedicationStockRow | None, str | None]:
    """Return preferred onboard medication if stock > 0, else first non-contraindicated fallback."""
    if not preferred_id:
        return None, None
    dehydrated_or_nausea = (
        answers.get("hydration_intake") == "low"
        or signals["has_nausea"]
        or answers.get("orthostatic_bp_check") == "orthostatic"
        or answers.get("sweating_autonomic_check") == "yes"
        or signals["has_sweating"]
    )
    primary = session.get(MedicationStockRow, preferred_id)
    if primary is not None and primary.quantity > 0 and not (preferred_id == "ibuprofen_400mg" and dehydrated_or_nausea):
        return primary, None

    for alt_id in FALLBACK_CHAIN.get(preferred_id, ()):
        if alt_id == "ibuprofen_400mg" and dehydrated_or_nausea:
            continue
        alt = session.get(MedicationStockRow, alt_id)
        if alt is not None and alt.quantity > 0:
            prim_name = primary.name if primary is not None else preferred_id
            reason = "dehydration/nausea precaution (Eyal et al. 2019)" if (preferred_id == "ibuprofen_400mg" and dehydrated_or_nausea) else "depleted stock"
            return alt, f"Switched from {prim_name} ({reason}) to NASA ISS fallback {alt.name}."
    return primary, None


def _with_cotreatment_guidance(
    alloc: MedicationAllocationDTO,
    condition_phrase: str,
) -> MedicationAllocationDTO:
    """State which co-occurring condition requires this medication and add stop-when-better guidance."""
    if alloc.recommended_total_units <= 0:
        return alloc
    clean_schedule = alloc.dosage_schedule.replace(" Stop early if you feel better.", "").rstrip(".")
    alloc.dosage_schedule = (
        f"If you have {condition_phrase}: take together — {clean_schedule}. "
        "Stop if you feel better."
    )
    return alloc


def _build_co_treatments_and_basis(
    session: Session,
    *,
    outcome_id: str,
    primary_med_id: str | None,
    signals: dict[str, Any],
    answers: dict[str, Any],
    crew_count: int,
    remaining_days: int,
) -> tuple[list[MedicationAllocationDTO], list[str]]:
    """Select supportive co-medications for simultaneous symptoms + human-readable protocol basis."""
    basis: list[str] = []
    guideline = CONDITION_PROTOCOLS.get(outcome_id)
    if guideline:
        basis.append(f"Primary Guideline ({guideline.reference}): {guideline.non_drug_countermeasure}")

    secondary: list[MedicationAllocationDTO] = []
    used_ids = {primary_med_id} if primary_med_id else set()

    # Co-symptom 1: Dehydration / Orthostatic dizziness / Autonomic cold sweats alongside another leading condition (e.g. fever)
    if (
        (
            answers.get("hydration_intake") == "low"
            or answers.get("orthostatic_bp_check") == "orthostatic"
            or answers.get("sweating_autonomic_check") == "yes"
            or signals["has_sweating"]
        )
        and "oral_rehydration_salts" not in used_ids
    ):
        ors_row, note = _resolve_med_with_fallback(session, "oral_rehydration_salts", signals, answers)
        if ors_row is not None and ors_row.quantity > 0:
            used_ids.add(ors_row.id)
            secondary.append(
                _with_cotreatment_guidance(
                    compute_medication_allocation(
                        medication=ors_row,
                        crew_count=crew_count,
                        remaining_days=remaining_days,
                        outcome_title="Dehydration / Orthostatic Support",
                        urgency="high",
                        fallback_note=note,
                    ),
                    "dehydration, orthostatic dizziness, or cold sweats",
                )
            )
            basis.append(
                "Co-Symptom Match (ISS Fluid-Shift Protocol): Low hydration or dizziness when moving triggers Oral Rehydration Salts (ORS), and NSAIDs (Ibuprofen) are avoided while dehydrated."
            )

    # Co-symptom 2: Vestibular dizziness / nausea triggered by movement alongside fever/headache
    if answers.get("vestibular_trigger") == "yes" and "meclizine_25mg" not in used_ids and "ondansetron_8mg" not in used_ids:
        prefer_ondansetron = signals["has_nausea"] or answers.get("hydration_intake") == "low"
        first_choice = "ondansetron_8mg" if prefer_ondansetron else "meclizine_25mg"
        vest_row, note = _resolve_med_with_fallback(session, first_choice, signals, answers)
        if vest_row is not None and vest_row.quantity > 0:
            used_ids.add(vest_row.id)
            secondary.append(
                _with_cotreatment_guidance(
                    compute_medication_allocation(
                        medication=vest_row,
                        crew_count=crew_count,
                        remaining_days=remaining_days,
                        outcome_title="Movement-Triggered Dizziness / Nausea",
                        urgency="moderate",
                        fallback_note=note,
                    ),
                    "movement-triggered dizziness or nausea",
                )
            )
            basis.append(
                f"Co-Symptom Match (NASA ExMC SMS Protocol): Movement-worsened dizziness matched to {vest_row.name} from the ISS Oral Medication Pack."
            )

    # Co-symptom 2b: Non-vestibular acute nausea alongside fever/tachycardia
    if signals["has_nausea"] and "ondansetron_8mg" not in used_ids and "meclizine_25mg" not in used_ids and len(secondary) < 2:
        nau_row, note = _resolve_med_with_fallback(session, "ondansetron_8mg", signals, answers)
        if nau_row is not None and nau_row.quantity > 0:
            used_ids.add(nau_row.id)
            secondary.append(
                _with_cotreatment_guidance(
                    compute_medication_allocation(
                        medication=nau_row,
                        crew_count=crew_count,
                        remaining_days=remaining_days,
                        outcome_title="Acute Nausea Support",
                        urgency="moderate",
                        fallback_note=note,
                    ),
                    "nausea or upset stomach",
                )
            )
            basis.append(
                "Co-Symptom Match (ISS Oral Pack Protocol): Active nausea alongside primary complaint matched to non-sedating Ondansetron 8 mg ODT."
            )

    # Co-symptom 3: Significant sleep disruption paired with another acute complaint
    if (
        (signals["sleep_low"] or answers.get("sleep_environment") == "disrupted")
        and outcome_id != "circadian_sleep_deficit"
        and outcome_id != "post_exercise_tachycardia"
        and answers.get("symptom_severity") != "mild"
        and "melatonin_3mg" not in used_ids
        and len(secondary) < 2
    ):
        slp_row, note = _resolve_med_with_fallback(session, "melatonin_3mg", signals, answers)
        if slp_row is not None and slp_row.quantity > 0:
            used_ids.add(slp_row.id)
            secondary.append(
                _with_cotreatment_guidance(
                    compute_medication_allocation(
                        medication=slp_row,
                        crew_count=crew_count,
                        remaining_days=remaining_days,
                        outcome_title="Sleep Recovery Support",
                        urgency="moderate",
                        fallback_note=note,
                    ),
                    "poor sleep or sleep disruption",
                )
            )
            basis.append(
                "Co-Symptom Match (NASA Circadian Protocol): Low sleep alongside active symptoms supports timed Melatonin 3 mg before the next rest window."
            )

    if answers.get("temperature_check") == "elevated":
        basis.append(
            "Antipyretic Guardrail: Fever >= 38.0 C unlocks acute stabilization dosing even under tight crew reserve so fever is never untreated while inventory remains."
        )
    elif answers.get("symptom_severity") == "mild" and primary_med_id is None:
        basis.append(
            "Conservation Guardrail: Mild self-limiting symptoms are managed with rest/hydration first to preserve finite onboard medications."
        )

    hc_conditions, hc_meds = _load_health_care_library()
    hc_cond = hc_conditions.get(outcome_id)
    if hc_cond:
        basis.append(f"Offline Health Care Reference (health_care/): {hc_cond.get('plain_summary', '')}")
    if primary_med_id and primary_med_id in hc_meds:
        med_ref = hc_meds[primary_med_id]
        basis.append(f"Offline Drug Guide ({med_ref.get('name', primary_med_id)}): {med_ref.get('adult_dosage', '')} {med_ref.get('warnings', '')}".strip())
    return secondary[:2], basis


def evaluate_session_state(session: Session, row: InvestigationSessionRow) -> InvestigationSessionDTO:
    """Compute the full live DTO for an InvestigationSessionRow."""
    astronaut = session.get(AstronautRow, row.astronaut_id)
    check_in = session.get(CheckInRow, row.check_in_id)
    if astronaut is None or check_in is None:
        raise LookupError("Referenced astronaut or check-in not found")

    mission = build_mission_context_dto(session)
    equipment_rows = list(session.scalars(select(InventoryRow)))
    equipment_map = {item.name: bool(item.available and item.quantity > 0) for item in equipment_rows}

    snapshot, signals = _extract_snapshot(check_in, astronaut)
    answers = dict(row.answers or {})
    turns = [TurnRecordDTO.model_validate(t) for t in (row.turns or [])]
    hypotheses = _score_hypotheses(signals, answers)

    max_turns = 4
    next_spec = None if len(turns) >= max_turns else _select_next_question(signals, answers)

    if next_spec is not None:
        outcome_id = hypotheses[0].id if hypotheses else None
        status: Literal["in_progress", "completed"] = "in_progress"
        top = hypotheses[0]
        assessment_title = f"Checking: {top.label}"
        assessment_summary = (
            f"Narrowing down {sum(1 for h in hypotheses if h.status != 'ruled_out')} possibilities based on your answers."
        )
        confidence_pct = min(74, top.score)
        med_alloc = None
        summary_headline = f"STEP {len(turns) + 1} · Quick Check"
        usable = equipment_map.get(next_spec.required_equipment, True) if next_spec.required_equipment else None
        current_q = InvestigationQuestionDTO(
            id=next_spec.id,
            prompt=next_spec.prompt,
            rationale=next_spec.rationale,
            required_equipment=next_spec.required_equipment,
            equipment_usable=usable,
            supports_numeric_input=next_spec.supports_numeric_input,
            numeric_label=next_spec.numeric_label,
            numeric_unit=next_spec.numeric_unit,
            options=[
                QuestionOptionDTO(value=val, label=lbl, tone=tone)
                for val, lbl, tone in next_spec.options
            ],
        )
    else:
        status = "completed"
        outcome_id, assessment_title, assessment_summary, confidence_pct, med_id = _pick_leading_outcome(
            signals, answers, hypotheses
        )
        guideline = CONDITION_PROTOCOLS.get(outcome_id)
        urgency = guideline.urgency if guideline else "moderate"
        med_row, fb_note = _resolve_med_with_fallback(session, med_id, signals, answers)
        resolved_primary_id = med_row.id if med_row is not None else med_id
        med_alloc = compute_medication_allocation(
            medication=med_row,
            crew_count=mission.crew_count,
            remaining_days=mission.remaining_days,
            outcome_title=assessment_title,
            urgency=urgency,
            fallback_note=fb_note,
        )
        secondary_allocations, clinical_basis = _build_co_treatments_and_basis(
            session,
            outcome_id=outcome_id,
            primary_med_id=resolved_primary_id,
            signals=signals,
            answers=answers,
            crew_count=mission.crew_count,
            remaining_days=mission.remaining_days,
        )
        summary_headline = f"RESULT · {assessment_title}"
        current_q = None

    if next_spec is not None:
        secondary_allocations = []
        clinical_basis = []

    dispensed_secondary_ids = list(answers.get("_dispensed_secondary", []))
    deviation_count = (1 if signals["hr_elevated"] else 0) + (1 if signals["sleep_low"] else 0) + len(signals["symptoms"])
    proactive_alert: str | None = None
    if deviation_count >= 2 or signals["hr_critical"] or signals["has_sweating"]:
        tags: list[str] = []
        if signals["hr_elevated"] and check_in.hr is not None:
            tags.append(f"HR {check_in.hr:.0f} bpm")
        if signals["sleep_low"] and check_in.sleep is not None:
            tags.append(f"Sleep {check_in.sleep:.1f}h")
        if signals["symptoms"]:
            tags.append(", ".join(signals["symptoms"]))
        label = "Urgent check" if (signals["hr_critical"] or signals["has_sweating"]) else "Health check"
        proactive_alert = f"{label} ({astronaut.id}: {' · '.join(tags)}) — answer these questions so MEDNAV can advise care and medication."

    row.status = status
    session.commit()

    return InvestigationSessionDTO(
        id=row.id,
        astronaut_id=row.astronaut_id,
        check_in_id=row.check_in_id,
        status=status,
        turn_count=len(turns),
        max_turns=max_turns,
        summary_headline=summary_headline,
        assessment_title=assessment_title,
        assessment_summary=assessment_summary,
        confidence_pct=confidence_pct,
        check_in_snapshot=snapshot,
        mission_context=mission,
        hypotheses=hypotheses,
        current_question=current_q,
        turns=turns,
        medication_allocation=med_alloc,
        secondary_allocations=secondary_allocations,
        clinical_basis=clinical_basis,
        dispensed=row.dispensed,
        dispensed_medication_id=row.dispensed_medication_id,
        dispensed_units=row.dispensed_units,
        dispensed_secondary_ids=dispensed_secondary_ids,
        condition_id=outcome_id,
        proactive_alert=proactive_alert,
    )


def start_investigation_session(session: Session, body: StartSessionRequest) -> InvestigationSessionDTO:
    astronaut = session.get(AstronautRow, body.astronaut_id)
    if astronaut is None:
        raise LookupError("Astronaut not found")

    if body.check_in_id:
        check_in = session.get(CheckInRow, body.check_in_id)
        if check_in is None or check_in.astronaut_id != astronaut.id:
            raise LookupError("Check-in not found for astronaut")
    else:
        check_in = session.scalar(
            select(CheckInRow)
            .where(CheckInRow.astronaut_id == astronaut.id)
            .order_by(CheckInRow.recorded_at.desc(), CheckInRow.id.desc())
            .limit(1)
        )
        if check_in is None:
            raise LookupError("No check-in found for astronaut")

    ensure_mission_defaults(session)
    now = datetime.now(timezone.utc)
    row = InvestigationSessionRow(
        id=str(uuid4()),
        astronaut_id=astronaut.id,
        check_in_id=check_in.id,
        created_at=now,
        updated_at=now,
        status="in_progress",
        communication_mode="online",
        answers={},
        turns=[],
        dispensed=False,
        dispensed_medication_id=None,
        dispensed_units=0,
    )
    session.add(row)
    session.commit()
    return evaluate_session_state(session, row)


def get_latest_session(session: Session, astronaut_id: str) -> InvestigationSessionDTO:
    astronaut = session.get(AstronautRow, astronaut_id)
    if astronaut is None:
        raise LookupError("Astronaut not found")
    row = session.scalar(
        select(InvestigationSessionRow)
        .where(InvestigationSessionRow.astronaut_id == astronaut_id)
        .order_by(InvestigationSessionRow.created_at.desc(), InvestigationSessionRow.id.desc())
        .limit(1)
    )
    if row is None:
        return start_investigation_session(session, StartSessionRequest(astronaut_id=astronaut_id))
    latest_ci = session.scalar(
        select(CheckInRow)
        .where(CheckInRow.astronaut_id == astronaut_id)
        .order_by(CheckInRow.recorded_at.desc(), CheckInRow.id.desc())
        .limit(1)
    )
    if latest_ci and row.check_in_id != latest_ci.id:
        return start_investigation_session(
            session, StartSessionRequest(astronaut_id=astronaut_id, check_in_id=latest_ci.id)
        )
    has_legacy_turn = any(t.get("question_id") not in QUESTIONS for t in (row.turns or []))
    if row.status not in ("in_progress", "completed") or has_legacy_turn:
        return start_investigation_session(
            session, StartSessionRequest(astronaut_id=astronaut_id, check_in_id=row.check_in_id)
        )
    return evaluate_session_state(session, row)


def submit_session_answer(
    session: Session,
    session_id: str,
    body: SubmitAnswerRequest,
) -> InvestigationSessionDTO:
    row = session.get(InvestigationSessionRow, session_id)
    if row is None:
        raise LookupError("Investigation session not found")
    if row.status != "in_progress":
        raise ValueError("Investigation session is already finalized")

    spec = QUESTIONS.get(body.question_id)
    if spec is None:
        raise ValueError(f"Unknown question_id '{body.question_id}'")
    option_map = {val: lbl for val, lbl, _ in spec.options}
    if body.answer_value not in option_map:
        raise ValueError(f"Invalid answer_value '{body.answer_value}' for question '{body.question_id}'")

    answers = dict(row.answers or {})
    answers[body.question_id] = body.answer_value
    if body.question_id == "mission_duration_check":
        try:
            chosen_days = (
                int(round(body.numeric_value))
                if body.numeric_value is not None
                else int(body.answer_value)
            )
            chosen_days = max(1, min(3650, chosen_days))
            cfg = ensure_mission_defaults(session)
            cfg.remaining_days = chosen_days
        except (TypeError, ValueError):
            pass
    if body.numeric_value is not None:
        answers[f"{body.question_id}_numeric"] = body.numeric_value
        if body.question_id == "temperature_check":
            answers[body.question_id] = "elevated" if body.numeric_value >= 38.0 else "normal"

    turns = list(row.turns or [])
    answer_lbl = option_map.get(answers[body.question_id], body.answer_value)
    if body.question_id == "mission_duration_check" and body.numeric_value is not None:
        answer_lbl = f"{max(1, min(3650, int(round(body.numeric_value))))} days"
    turns.append(
        TurnRecordDTO(
            turn=len(turns) + 1,
            question_id=spec.id,
            question_prompt=spec.prompt,
            answer_value=answers[body.question_id],
            answer_label=answer_lbl,
            numeric_value=body.numeric_value,
            recorded_at=datetime.now(timezone.utc).isoformat(),
        ).model_dump()
    )
    row.answers = answers
    row.turns = turns
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    return evaluate_session_state(session, row)


def get_all_crew_proactive_alerts(session: Session) -> list[CrewProactiveAlertDTO]:
    """Scan every crew member's latest daily check-in against pre-flight baseline."""
    _load_preflight_baseline()
    alerts: list[CrewProactiveAlertDTO] = []
    astronauts = list(session.scalars(select(AstronautRow).order_by(AstronautRow.id)))
    for astronaut in astronauts:
        latest_ci = session.scalar(
            select(CheckInRow)
            .where(CheckInRow.astronaut_id == astronaut.id)
            .order_by(CheckInRow.recorded_at.desc(), CheckInRow.id.desc())
            .limit(1)
        )
        if latest_ci is None:
            continue
        _snapshot, signals = _extract_snapshot(latest_ci, astronaut)
        deviation_count = (
            (1 if signals["hr_elevated"] else 0)
            + (1 if signals["sleep_low"] else 0)
            + len(signals["symptoms"])
        )
        urgent = bool(signals["hr_critical"] or signals["has_sweating"] or signals["has_visual"])
        if deviation_count < 2 and not urgent:
            continue

        tags: list[str] = []
        if signals["hr_elevated"] and latest_ci.hr is not None:
            tags.append(f"HR {latest_ci.hr:.0f} bpm")
        if signals["sleep_low"] and latest_ci.sleep is not None:
            tags.append(f"Sleep {latest_ci.sleep:.1f}h")
        if signals["symptoms"]:
            tags.append(", ".join(signals["symptoms"]))

        latest_sess = session.scalar(
            select(InvestigationSessionRow)
            .where(
                InvestigationSessionRow.astronaut_id == astronaut.id,
                InvestigationSessionRow.check_in_id == latest_ci.id,
            )
            .order_by(InvestigationSessionRow.created_at.desc(), InvestigationSessionRow.id.desc())
            .limit(1)
        )
        session_status = latest_sess.status if latest_sess is not None else None
        needs_investigation = latest_sess is None or latest_sess.status != "completed"
        alerts.append(
            CrewProactiveAlertDTO(
                astronaut_id=astronaut.id,
                deviation_count=deviation_count,
                summary_tags=tags,
                urgent=urgent,
                needs_investigation=needs_investigation,
                session_status=session_status,
            )
        )
    return alerts


def dispense_session_allocation(
    session: Session,
    session_id: str,
    medication_id: str | None = None,
) -> InvestigationSessionDTO:
    """Confirm and deduct the advised medication quantity (primary or co-treatment) from onboard inventory."""
    row = session.get(InvestigationSessionRow, session_id)
    if row is None:
        raise LookupError("Investigation session not found")
    dto = evaluate_session_state(session, row)
    if dto.status != "completed":
        raise ValueError("Investigation must be completed before taking medication")

    alloc = dto.medication_allocation
    is_secondary = False
    if medication_id is not None and (alloc is None or medication_id != alloc.medication_id):
        sec_match = next(
            (item for item in dto.secondary_allocations if item.medication_id == medication_id),
            None,
        )
        if sec_match is None:
            raise LookupError("Requested medication is not part of this session's recommendations")
        alloc = sec_match
        is_secondary = True

    if is_secondary:
        answers = dict(row.answers or {})
        taken_sec = list(answers.get("_dispensed_secondary", []))
        if medication_id in taken_sec:
            return dto
        if alloc is None or alloc.medication_id is None or alloc.recommended_total_units <= 0:
            raise ValueError("No allocatable units available for this co-treatment")
        med = session.get(MedicationStockRow, alloc.medication_id)
        if med is None:
            raise LookupError("Medication stock item not found")
        if med.quantity < alloc.recommended_total_units:
            raise ValueError("Insufficient stock remaining in inventory")
        med.quantity -= alloc.recommended_total_units
        taken_sec.append(med.id)
        answers["_dispensed_secondary"] = taken_sec
        row.answers = answers
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        return evaluate_session_state(session, row)

    if row.dispensed:
        return dto
    if alloc is None or alloc.medication_id is None or alloc.recommended_total_units <= 0:
        raise ValueError("No allocatable medication available to take for this session")

    med = session.get(MedicationStockRow, alloc.medication_id)
    if med is None:
        raise LookupError("Medication stock item not found")
    if med.quantity < alloc.recommended_total_units:
        raise ValueError("Insufficient stock remaining in inventory")

    med.quantity -= alloc.recommended_total_units
    row.dispensed = True
    row.dispensed_medication_id = med.id
    row.dispensed_units = alloc.recommended_total_units
    row.updated_at = datetime.now(timezone.utc)
    session.commit()
    return evaluate_session_state(session, row)
