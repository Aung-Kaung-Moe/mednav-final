"""Local synthetic medical reports, immutable PDFs, and simulated Earth store-and-forward."""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from pathlib import Path
from statistics import mean
from uuid import uuid4

from fastapi import Depends, Header, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import (
    AstronautRow, CheckInRow, EarthLinkRow, GroundReceiptRow, InvestigationSessionRow, MedicalReportRow,
    MedicalReviewRow, MedicationAdministrationRow, MissionConfigRow,
    MedicationStockRow, ReportAuditRow, ReportTransmissionRow, ReportVersionRow,
)
from .report_pdf import render_report_pdf

_pump_lock = threading.Lock()
_machine_id = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.I)


def readable_symptom(value):
    name = value.strip() if isinstance(value, str) else ""
    return bool(name and len(name) <= 100 and not name.lower().startswith("future-only fatigue marker")
                and not _machine_id.search(name) and name.isprintable())


def backfill_investigation_medicines(session):
    """Preserve older confirmed stock deductions without inventing an exact take time."""
    added = False
    for investigation in session.scalars(select(InvestigationSessionRow)):
        medicine_ids = []
        if investigation.dispensed and investigation.dispensed_medication_id:
            medicine_ids.append((investigation.dispensed_medication_id, investigation.dispensed_units))
        medicine_ids.extend((item, None) for item in (investigation.answers or {}).get("_dispensed_secondary", []))
        for medicine_id, units in medicine_ids:
            record_id = f"investigation:{investigation.id}:{medicine_id}"
            medicine = session.get(MedicationStockRow, medicine_id)
            if not medicine or session.get(MedicationAdministrationRow, record_id):
                continue
            session.add(MedicationAdministrationRow(
                id=record_id, astronaut_id=investigation.astronaut_id,
                medication_name=medicine.name,
                dose=f"{units} {medicine.unit}" if units else None,
                route=None, status="taken", taken_at=None,
                recorded_at=investigation.updated_at,
                source="Earlier Investigation Take confirmation",
                notes="Recovered from a confirmed inventory deduction. Exact take time was not saved."
                      if units else "Recovered from a confirmed inventory deduction. Amount and exact take time were not saved.",
                incident_id=investigation.id, recorded_by=investigation.astronaut_id,
            ))
            added = True
    if added:
        session.commit()


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


def audit(session, report_id, version, event, detail):
    session.add(ReportAuditRow(id=str(uuid4()), report_id=report_id, version=version,
                               event=event, detail=detail, recorded_at=utcnow()))


def require_local(request: Request):
    return 

def require_officer(key: str | None):
    expected = os.getenv("MEDNAV_OFFICER_KEY", "")
    if not expected or not key or not hmac.compare_digest(key, expected):
        raise HTTPException(403, "Medical officer authorization required; configure MEDNAV_OFFICER_KEY")


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ReportCreate(Strict):
    astronaut_id: str = Field(min_length=1, max_length=100)
    report_type: str = Field(default="Weekly Summary", pattern="^(Incident|Weekly Summary|Follow-up)$")


class MedicationCreate(Strict):
    astronaut_id: str = Field(min_length=1, max_length=100)
    medication_name: str = Field(min_length=1, max_length=150)
    dose: str | None = Field(default=None, max_length=100)
    route: str | None = Field(default=None, max_length=100)
    status: str = Field(pattern="^(taken|missed|unknown)$")
    taken_at: datetime | None = None
    source: str = Field(min_length=1, max_length=100)
    notes: str | None = Field(default=None, max_length=2000)
    incident_id: str | None = Field(default=None, max_length=100)
    recorded_by: str = Field(min_length=1, max_length=100)
    confirmed: bool


class ReviewCreate(Strict):
    reviewer: str = Field(min_length=1, max_length=100)
    outcome: str = Field(pattern="^(Under Review|Follow-up Required|Escalated|Reviewed / Closed)$")
    notes: str = Field(min_length=1, max_length=4000)
    requested_measurements: str | None = Field(default=None, max_length=1000)
    follow_up_tasks: str | None = Field(default=None, max_length=2000)
    checklist_reviewed: bool


class LinkUpdate(Strict):
    online: bool


def report_storage(app):
    path = app.state.report_dir
    path.mkdir(parents=True, exist_ok=True)
    (path / "ground").mkdir(exist_ok=True)
    return path


def report_row(session, report_id):
    row = session.get(MedicalReportRow, report_id)
    if row is None:
        raise HTTPException(404, "Report not found")
    return row


def version_row(session, report, version=None):
    selected = report.current_version if version is None else version
    row = session.scalar(select(ReportVersionRow).where(ReportVersionRow.report_id == report.id,
                                                       ReportVersionRow.version == selected))
    if row is None:
        raise HTTPException(404, "Report PDF version not found")
    return row


def latest_review(session, report_id):
    return session.scalar(select(MedicalReviewRow).where(MedicalReviewRow.report_id == report_id)
                          .order_by(MedicalReviewRow.recorded_at.desc(), MedicalReviewRow.id.desc()).limit(1))


def report_dto(session, report):
    version = version_row(session, report)
    transmission = session.scalar(select(ReportTransmissionRow).where(ReportTransmissionRow.report_id == report.id,
                                                                        ReportTransmissionRow.version == version.version))
    status = transmission.status if transmission else ("PDF_GENERATED" if report.review_status == "Reviewed / Closed" else "AWAITING_APPROVAL")
    return {"id": report.id, "astronaut_id": report.astronaut_id, "report_type": report.report_type,
            "created_at": iso(report.created_at), "updated_at": iso(report.updated_at),
            "version": version.version, "review_status": report.review_status,
            "status": status, "pdf_name": version.pdf_name, "pdf_size": version.pdf_size,
            "sha256": version.sha256, "snapshot": version.snapshot,
            "attempts": transmission.attempts if transmission else 0,
            "queued_at": iso(transmission.queued_at) if transmission else None,
            "last_attempt_at": iso(transmission.last_attempt_at) if transmission else None,
            "acknowledged_at": iso(transmission.acknowledged_at) if transmission else None,
            "receipt_id": transmission.receipt_id if transmission else None,
            "error": transmission.error if transmission else None}


def build_snapshot(session, report, version):
    now = utcnow()
    start = datetime.combine((now - timedelta(days=6)).date(), datetime.min.time(), tzinfo=timezone.utc)
    astronaut = session.get(AstronautRow, report.astronaut_id)
    rows = list(session.scalars(select(CheckInRow).where(CheckInRow.astronaut_id == report.astronaut_id,
                                                       CheckInRow.recorded_at >= start, CheckInRow.recorded_at <= now)
                                .order_by(CheckInRow.recorded_at, CheckInRow.id)))
    readings = [{"id": r.id, "recorded_at": iso(r.recorded_at), "hr": r.hr, "sleep": r.sleep,
                 "bp": r.bp, "symptoms": r.symptoms, "provenance": r.provenance} for r in rows]
    symptoms = [{"name": symptom.strip(), "recorded_at": iso(r.recorded_at), "source": r.provenance,
                 "check_in_id": r.id, "status": "Unknown", "onset": None, "severity": None}
                for r in rows for symptom in r.symptoms if readable_symptom(symptom)]
    medication_rows = list(session.scalars(select(MedicationAdministrationRow).where(
        MedicationAdministrationRow.astronaut_id == report.astronaut_id,
        MedicationAdministrationRow.recorded_at >= start,
        MedicationAdministrationRow.recorded_at <= now).order_by(MedicationAdministrationRow.recorded_at)))
    medications = [{"id": m.id, "astronaut_id": m.astronaut_id,
                    "medication_name": m.medication_name, "dose": m.dose, "route": m.route,
                    "status": m.status, "taken_at": iso(m.taken_at), "recorded_at": iso(m.recorded_at),
                    "source": m.source, "notes": m.notes, "incident_id": m.incident_id,
                    "recorded_by": m.recorded_by} for m in medication_rows]
    days = [(start + timedelta(days=i)).date().isoformat() for i in range(7)]
    daily = {k: [] for k in ("hr", "sleep", "systolic", "diastolic")}
    for day in days:
        day_rows = [r for r in rows if r.recorded_at.date().isoformat() == day]
        for key in ("hr", "sleep"):
            values = [getattr(r, key) for r in day_rows if getattr(r, key) is not None]
            daily[key].append(mean(values) if values else None)
        bp_values = [tuple(map(int, r.bp.split(" / "))) for r in day_rows if r.bp]
        for index, key in enumerate(("systolic", "diastolic")):
            daily[key].append(mean(b[index] for b in bp_values) if bp_values else None)
    mission = session.get(MissionConfigRow, "default")
    review = latest_review(session, report.id)
    review_data = None if review is None else {"reviewer": review.reviewer, "outcome": review.outcome,
        "notes": review.notes, "requested_measurements": review.requested_measurements,
        "follow_up_tasks": review.follow_up_tasks, "checklist_reviewed": review.checklist_reviewed,
        "recorded_at": iso(review.recorded_at)}
    investigation = None
    if rows:
        try:
            from .real_engine import RealEngineService, SimulationContext
            result = RealEngineService().evaluate(session, rows[-1].id,
                SimulationContext(communication_status="offline", emergency_override=False))
            investigation = result.model_dump(mode="json")
        except (ImportError, FileNotFoundError, ValueError, RuntimeError):
            investigation = None
    overview = (f"{len(readings)} saved check-in(s), {len(symptoms)} reported symptom observation(s), "
                f"{len(medications)} documented medication administration record(s) in the selected UTC period.")
    return {"schema_version": 1, "report_id": report.id, "version": version,
            "astronaut_id": report.astronaut_id, "astronaut_role": astronaut.role,
            "mission_label": mission.mission_label if mission else "Synthetic mission - not recorded",
            "report_type": report.report_type, "generated_at": iso(now), "period_start": iso(start),
            "period_end": iso(now), "timezone": "UTC", "measurements": readings,
            "days": days, "daily": daily,
            "baselines": {"hr": astronaut.baseline, "sleep": astronaut.sleepBaseline},
            "symptoms": symptoms, "medications": medications, "investigation": investigation,
            "review": review_data, "review_status": report.review_status,
            "transmission_status": "Not transmitted at generation", "overview": overview,
            "synthetic": True}


def create_version(session, app, report):
    version = report.current_version + 1
    snapshot = build_snapshot(session, report, version)
    pdf = render_report_pdf(snapshot)
    digest = hashlib.sha256(pdf).hexdigest()
    filename = f"MEDNAV_{report.astronaut_id.replace(' ', '_')}_{report.id}_v{version}.pdf"
    directory = report_storage(app) / report.id
    directory.mkdir(exist_ok=True)
    target = directory / filename
    if target.exists():
        raise HTTPException(409, "PDF version already exists")
    temp = target.with_suffix(".tmp")
    temp.write_bytes(pdf)
    temp.replace(target)
    row = ReportVersionRow(id=str(uuid4()), report_id=report.id, version=version,
                           created_at=utcnow(), snapshot=snapshot, pdf_path=str(target),
                           pdf_name=filename, pdf_size=len(pdf), sha256=digest)
    session.add(row)
    report.current_version = version
    report.updated_at = utcnow()
    audit(session, report.id, version, "pdf_generated", digest)
    session.commit()
    return row


def verified_file(version):
    path = Path(version.pdf_path)
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != version.sha256:
        raise ValueError("Archived PDF missing or checksum mismatch")
    return path


def ground_receive(session, app, transmission, version):
    existing = session.scalar(select(GroundReceiptRow).where(GroundReceiptRow.idempotency_key == transmission.idempotency_key))
    if existing:
        if existing.report_id != transmission.report_id or existing.version != transmission.version or existing.sha256 != version.sha256:
            raise ValueError("Ground duplicate conflicts with archived PDF")
        return existing
    source = verified_file(version)
    destination = report_storage(app) / "ground" / version.pdf_name
    if destination.exists() and hashlib.sha256(destination.read_bytes()).hexdigest() != version.sha256:
        raise ValueError("Ground filename conflicts with a different PDF")
    temp = destination.with_suffix(".tmp")
    temp.write_bytes(source.read_bytes())
    temp.replace(destination)
    receipt = GroundReceiptRow(id=str(uuid4()), idempotency_key=transmission.idempotency_key,
        report_id=transmission.report_id, version=transmission.version, sha256=version.sha256,
        pdf_path=str(destination), received_at=utcnow())
    session.add(receipt)
    session.flush()
    return receipt


def transmit_pending(session, app, *, force=False):
    with _pump_lock:
        _transmit_pending(session, app, force=force)


def _transmit_pending(session, app, *, force=False):
    link = session.get(EarthLinkRow, "simulated")
    if not link or not link.online:
        return
    now = utcnow()
    pending = list(session.scalars(select(ReportTransmissionRow).where(
        ReportTransmissionRow.status.in_(["PENDING_TRANSMISSION", "RETRY_PENDING", "SENDING", "AWAITING_ACKNOWLEDGEMENT"]))
        .order_by(ReportTransmissionRow.queued_at)))
    for tx in pending:
        if tx.attempts >= 5 or (tx.next_attempt_at and tx.next_attempt_at > now and not force):
            continue
        report = session.get(MedicalReportRow, tx.report_id)
        review = latest_review(session, tx.report_id)
        if not report or not review or review.outcome != "Reviewed / Closed" or not review.checklist_reviewed:
            tx.status = "TRANSMISSION_BLOCKED"
            tx.error = "Authorized medical officer sign-off required"
            audit(session, tx.report_id, tx.version, "transmission_blocked", tx.error)
            continue
        version = version_row(session, report, tx.version)
        tx.attempts += 1
        tx.last_attempt_at = utcnow()
        tx.status = "SENDING"
        session.flush()
        try:
            receipt = ground_receive(session, app, tx, version)
            if receipt.sha256 != version.sha256 or receipt.report_id != report.id or receipt.version != tx.version:
                raise ValueError("Ground acknowledgement did not match PDF version")
            tx.status = "DELIVERED"
            tx.receipt_id = receipt.id
            tx.acknowledged_at = receipt.received_at
            tx.next_attempt_at = None
            tx.error = None
            audit(session, tx.report_id, tx.version, "delivered_to_simulated_ground", receipt.id)
        except (OSError, ValueError) as exc:
            tx.error = str(exc)
            tx.status = "TRANSMISSION_FAILED" if tx.attempts >= 5 else "RETRY_PENDING"
            tx.next_attempt_at = utcnow() + timedelta(seconds=min(300, 2 ** tx.attempts)) if tx.attempts < 5 else None
            audit(session, tx.report_id, tx.version, "transmission_failed", tx.error)
    session.commit()


def register_reporting(app, db):
    @app.get("/api/v1/reports/preview")
    def preview_report(request: Request, astronaut_id: str, session: Session = Depends(db)):
        require_local(request)
        if session.get(AstronautRow, astronaut_id) is None:
            raise HTTPException(404, "Astronaut not found")
        draft = MedicalReportRow(id="preview", astronaut_id=astronaut_id,
            report_type="Weekly Summary", current_version=0, review_status="Pending Review")
        return build_snapshot(session, draft, 0)

    @app.get("/api/v1/reports")
    def list_reports(request: Request, astronaut_id: str | None = None, session: Session = Depends(db)):
        require_local(request)
        q = select(MedicalReportRow).order_by(MedicalReportRow.created_at.desc())
        if astronaut_id:
            q = q.where(MedicalReportRow.astronaut_id == astronaut_id)
        return [report_dto(session, r) for r in session.scalars(q)]

    @app.post("/api/v1/reports", status_code=201)
    def create_report(body: ReportCreate, request: Request, session: Session = Depends(db)):
        require_local(request)
        if session.get(AstronautRow, body.astronaut_id) is None:
            raise HTTPException(404, "Astronaut not found")
        report = MedicalReportRow(id=str(uuid4()), astronaut_id=body.astronaut_id,
            report_type=body.report_type, created_at=utcnow(), updated_at=utcnow(),
            current_version=0, review_status="Pending Review")
        session.add(report)
        session.flush()
        create_version(session, request.app, report)
        return report_dto(session, report)

    @app.get("/api/v1/reports/{report_id}")
    def get_report(report_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        return report_dto(session, report_row(session, report_id))

    @app.get("/api/v1/reports/{report_id}/versions")
    def report_versions(report_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        report_row(session, report_id)
        return [{"version": v.version, "created_at": iso(v.created_at), "pdf_name": v.pdf_name,
                 "pdf_size": v.pdf_size, "sha256": v.sha256} for v in session.scalars(select(ReportVersionRow)
                 .where(ReportVersionRow.report_id == report_id).order_by(ReportVersionRow.version.desc()))]

    @app.post("/api/v1/reports/{report_id}/versions", status_code=201)
    def regenerate_report(report_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        report = report_row(session, report_id)
        create_version(session, request.app, report)
        return report_dto(session, report)

    @app.get("/api/v1/reports/{report_id}/pdf")
    def get_pdf(report_id: str, request: Request, version: int | None = None, download: bool = False, session: Session = Depends(db)):
        require_local(request)
        report = report_row(session, report_id)
        item = version_row(session, report, version)
        try:
            path = verified_file(item)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        return FileResponse(path, media_type="application/pdf", filename=item.pdf_name,
            content_disposition_type="attachment" if download else "inline")

    @app.get("/api/v1/reports/{report_id}/audit")
    def get_audit(report_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        report_row(session, report_id)
        return [{"event": a.event, "detail": a.detail, "version": a.version,
                 "recorded_at": iso(a.recorded_at)} for a in session.scalars(select(ReportAuditRow)
                 .where(ReportAuditRow.report_id == report_id).order_by(ReportAuditRow.recorded_at))]

    @app.get("/api/v1/reports/{report_id}/reviews")
    def get_reviews(report_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        report_row(session, report_id)
        return [{"reviewer": r.reviewer, "outcome": r.outcome, "notes": r.notes,
                 "requested_measurements": r.requested_measurements, "follow_up_tasks": r.follow_up_tasks,
                 "checklist_reviewed": r.checklist_reviewed, "recorded_at": iso(r.recorded_at)}
                for r in session.scalars(select(MedicalReviewRow).where(MedicalReviewRow.report_id == report_id)
                .order_by(MedicalReviewRow.recorded_at))]

    @app.post("/api/v1/reports/{report_id}/reviews", status_code=201)
    def add_review(report_id: str, body: ReviewCreate, request: Request,
                   x_mednav_officer_key: str | None = Header(default=None), session: Session = Depends(db)):
        require_local(request)
        require_officer(x_mednav_officer_key)
        report = report_row(session, report_id)
        if body.outcome == "Reviewed / Closed" and not body.checklist_reviewed:
            raise HTTPException(422, "Checklist review required before closure")
        session.add(MedicalReviewRow(id=str(uuid4()), report_id=report.id, reviewer=body.reviewer,
            outcome=body.outcome, notes=body.notes, requested_measurements=body.requested_measurements,
            follow_up_tasks=body.follow_up_tasks, checklist_reviewed=body.checklist_reviewed, recorded_at=utcnow()))
        report.review_status = body.outcome
        audit(session, report.id, report.current_version, "medical_review", body.outcome)
        session.flush()
        create_version(session, request.app, report)
        return report_dto(session, report)

    @app.get("/api/v1/astronauts/{astronaut_id}/medication-administrations")
    def medications(astronaut_id: str, request: Request, session: Session = Depends(db)):
        require_local(request)
        if session.get(AstronautRow, astronaut_id) is None:
            raise HTTPException(404, "Astronaut not found")
        rows = session.scalars(select(MedicationAdministrationRow).where(
            MedicationAdministrationRow.astronaut_id == astronaut_id).order_by(MedicationAdministrationRow.recorded_at.desc()))
        return [{"id": m.id, "medication_name": m.medication_name, "dose": m.dose,
                 "route": m.route, "status": m.status, "taken_at": iso(m.taken_at),
                 "recorded_at": iso(m.recorded_at), "source": m.source,
                 "notes": m.notes, "incident_id": m.incident_id, "recorded_by": m.recorded_by} for m in rows]

    @app.post("/api/v1/medication-administrations", status_code=201)
    def add_medication(body: MedicationCreate, request: Request,
                       x_mednav_officer_key: str | None = Header(default=None), session: Session = Depends(db)):
        require_local(request)
        require_officer(x_mednav_officer_key)
        if not body.confirmed:
            raise HTTPException(422, "Explicit confirmation required")
        if body.status == "taken" and (not body.dose or not body.taken_at):
            raise HTTPException(422, "Taken dose and time must be documented")
        if session.get(AstronautRow, body.astronaut_id) is None:
            raise HTTPException(404, "Astronaut not found")
        row = MedicationAdministrationRow(id=str(uuid4()), astronaut_id=body.astronaut_id,
            medication_name=body.medication_name, dose=body.dose, route=body.route,
            status=body.status, taken_at=body.taken_at, recorded_at=utcnow(),
            source=body.source, notes=body.notes, incident_id=body.incident_id,
            recorded_by=body.recorded_by)
        session.add(row)
        session.commit()
        return {"id": row.id, "recorded_at": iso(row.recorded_at)}

    @app.get("/api/v1/earth/status")
    def earth_status(request: Request, session: Session = Depends(db)):
        require_local(request)
        link = session.get(EarthLinkRow, "simulated")
        pending = list(session.scalars(select(ReportTransmissionRow).where(ReportTransmissionRow.status != "DELIVERED")))
        return {"simulated": True, "online": bool(link and link.online), "updated_at": iso(link.updated_at) if link else None,
                "pending_count": len(pending)}

    @app.post("/api/v1/earth/status")
    def change_earth_status(body: LinkUpdate, request: Request,
                            x_mednav_officer_key: str | None = Header(default=None), session: Session = Depends(db)):
        require_local(request)
        require_officer(x_mednav_officer_key)
        link = session.get(EarthLinkRow, "simulated")
        if link is None:
            link = EarthLinkRow(id="simulated", online=body.online, updated_at=utcnow())
            session.add(link)
        else:
            link.online = body.online
            link.updated_at = utcnow()
        session.commit()
        if body.online:
            transmit_pending(session, request.app, force=True)
        return earth_status(request, session)

    @app.post("/api/v1/reports/{report_id}/queue")
    def queue_report(report_id: str, request: Request,
                     x_mednav_officer_key: str | None = Header(default=None), session: Session = Depends(db)):
        require_local(request)
        require_officer(x_mednav_officer_key)
        report = report_row(session, report_id)
        review = latest_review(session, report_id)
        if not review or review.outcome != "Reviewed / Closed" or not review.checklist_reviewed:
            raise HTTPException(409, "Medical officer sign-off required before transmission")
        version = version_row(session, report)
        try:
            verified_file(version)
        except ValueError as exc:
            raise HTTPException(409, str(exc)) from None
        existing = session.scalar(select(ReportTransmissionRow).where(
            ReportTransmissionRow.report_id == report_id, ReportTransmissionRow.version == version.version))
        if existing:
            return report_dto(session, report)
        tx = ReportTransmissionRow(id=str(uuid4()), report_id=report_id, version=version.version,
            idempotency_key=f"{report_id}:v{version.version}:{version.sha256}",
            status="PENDING_TRANSMISSION", attempts=0, queued_at=utcnow())
        session.add(tx)
        audit(session, report_id, version.version, "pdf_queued", version.sha256)
        session.commit()
        transmit_pending(session, request.app)
        return report_dto(session, report)

    @app.post("/api/v1/reports/{report_id}/retry")
    def retry_report(report_id: str, request: Request,
                     x_mednav_officer_key: str | None = Header(default=None), session: Session = Depends(db)):
        require_local(request)
        require_officer(x_mednav_officer_key)
        report = report_row(session, report_id)
        tx = session.scalar(select(ReportTransmissionRow).where(
            ReportTransmissionRow.report_id == report_id, ReportTransmissionRow.version == report.current_version))
        if not tx or tx.status not in {"RETRY_PENDING", "TRANSMISSION_FAILED"}:
            raise HTTPException(409, "No failed transmission to retry")
        if tx.attempts >= 5:
            raise HTTPException(409, "Maximum automatic retry attempts reached")
        tx.next_attempt_at = None
        session.commit()
        transmit_pending(session, request.app, force=True)
        return report_dto(session, report)

    @app.get("/api/v1/earth/received")
    def ground_history(request: Request, session: Session = Depends(db)):
        require_local(request)
        return [{"id": r.id, "report_id": r.report_id, "version": r.version,
                 "sha256": r.sha256, "received_at": iso(r.received_at)} for r in session.scalars(
            select(GroundReceiptRow).order_by(GroundReceiptRow.received_at.desc()))]
