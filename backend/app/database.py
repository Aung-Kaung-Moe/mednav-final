from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, UniqueConstraint, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker
from sqlalchemy.pool import StaticPool


class Base(DeclarativeBase):
    pass


class AstronautRow(Base):
    __tablename__ = "astronauts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    role: Mapped[str]
    baseline: Mapped[float] = mapped_column(Float)
    sleepBaseline: Mapped[float] = mapped_column(Float)


class CheckInRow(Base):
    __tablename__ = "check_ins"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    hr: Mapped[float | None] = mapped_column(Float, nullable=True)
    sleep: Mapped[float | None] = mapped_column(Float, nullable=True)
    bp: Mapped[str | None] = mapped_column(String, nullable=True)
    symptoms: Mapped[list[str]] = mapped_column(JSON)
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)
    provenance: Mapped[str]


class InventoryRow(Base):
    __tablename__ = "inventory"
    name: Mapped[str] = mapped_column(String, primary_key=True)
    category: Mapped[str]
    quantity: Mapped[int] = mapped_column(Integer)
    available: Mapped[bool] = mapped_column(Boolean)


class FollowUpRow(Base):
    """User-recorded workflow documentation, never a treatment/outcome record."""
    __tablename__ = "follow_up_events"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    check_in_id: Mapped[str] = mapped_column(ForeignKey("check_ins.id"), index=True)
    event_type: Mapped[str] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    provenance: Mapped[str]
    synthetic: Mapped[bool] = mapped_column(Boolean, default=True)


class SeedVersion(Base):
    __tablename__ = "seed_versions"
    id: Mapped[str] = mapped_column(String, primary_key=True)


class MissionConfigRow(Base):
    """Synthetic mission context (crew count, remaining days, comms mode)."""

    __tablename__ = "mission_config"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    crew_count: Mapped[int] = mapped_column(Integer)
    remaining_days: Mapped[int] = mapped_column(Integer)
    communication_mode: Mapped[str] = mapped_column(String, default="online")
    mission_label: Mapped[str] = mapped_column(String, default="Orbital Demo · Synthetic Mission")


class MedicationStockRow(Base):
    """Synthetic onboard medication inventory for rationing calculations."""

    __tablename__ = "medication_stock"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str]
    category: Mapped[str]
    unit: Mapped[str]
    quantity: Mapped[int] = mapped_column(Integer)
    default_quantity: Mapped[int] = mapped_column(Integer)
    max_daily_dose: Mapped[int] = mapped_column(Integer)
    standard_course_days: Mapped[int] = mapped_column(Integer)
    reserve_per_crew_30d: Mapped[int] = mapped_column(Integer)
    contraindications: Mapped[str]
    protocol_ref: Mapped[str]


class InvestigationSessionRow(Base):
    """Persisted multi-turn iterative investigation session."""

    __tablename__ = "investigation_sessions"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    check_in_id: Mapped[str] = mapped_column(ForeignKey("check_ins.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String)
    communication_mode: Mapped[str] = mapped_column(String, default="online")
    answers: Mapped[dict] = mapped_column(JSON)
    turns: Mapped[list] = mapped_column(JSON)
    dispensed: Mapped[bool] = mapped_column(Boolean, default=False)
    dispensed_medication_id: Mapped[str | None] = mapped_column(String, nullable=True)
    dispensed_units: Mapped[int] = mapped_column(Integer, default=0)


class MedicalReportRow(Base):
    __tablename__ = "medical_reports"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    report_type: Mapped[str] = mapped_column(String, default="Weekly Summary")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    review_status: Mapped[str] = mapped_column(String, default="Pending Review")


class ReportVersionRow(Base):
    __tablename__ = "medical_report_versions"
    __table_args__ = (UniqueConstraint("report_id", "version"),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("medical_reports.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    snapshot: Mapped[dict] = mapped_column(JSON)
    pdf_path: Mapped[str] = mapped_column(String)
    pdf_name: Mapped[str] = mapped_column(String)
    pdf_size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String)


class MedicationAdministrationRow(Base):
    __tablename__ = "medication_administrations"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    astronaut_id: Mapped[str] = mapped_column(ForeignKey("astronauts.id"), index=True)
    medication_name: Mapped[str] = mapped_column(String)
    dose: Mapped[str | None] = mapped_column(String, nullable=True)
    route: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String)
    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    incident_id: Mapped[str | None] = mapped_column(String, nullable=True)
    recorded_by: Mapped[str] = mapped_column(String)


class MedicalReviewRow(Base):
    __tablename__ = "medical_officer_reviews"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("medical_reports.id"), index=True)
    reviewer: Mapped[str] = mapped_column(String)
    outcome: Mapped[str] = mapped_column(String)
    notes: Mapped[str] = mapped_column(String)
    requested_measurements: Mapped[str | None] = mapped_column(String, nullable=True)
    follow_up_tasks: Mapped[str | None] = mapped_column(String, nullable=True)
    checklist_reviewed: Mapped[bool] = mapped_column(Boolean)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EarthLinkRow(Base):
    __tablename__ = "earth_link_state"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    online: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReportTransmissionRow(Base):
    __tablename__ = "report_transmissions"
    __table_args__ = (UniqueConstraint("report_id", "version"),)
    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("medical_reports.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    idempotency_key: Mapped[str] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    queued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    receipt_id: Mapped[str | None] = mapped_column(String, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)


class GroundReceiptRow(Base):
    __tablename__ = "simulated_ground_receipts"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    idempotency_key: Mapped[str] = mapped_column(String, unique=True)
    report_id: Mapped[str] = mapped_column(String)
    version: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String)
    pdf_path: Mapped[str] = mapped_column(String)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ReportAuditRow(Base):
    __tablename__ = "medical_report_audit"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("medical_reports.id"), index=True)
    version: Mapped[int | None] = mapped_column(Integer, nullable=True)
    event: Mapped[str] = mapped_column(String)
    detail: Mapped[str] = mapped_column(String)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


def create_database(url: str):
    if not url.startswith("sqlite:"):
        raise ValueError("This foundation supports local SQLite only")
    options = {"connect_args": {"check_same_thread": False, "timeout": 15}}
    if url in ("sqlite://", "sqlite:///:memory:"):
        options["poolclass"] = StaticPool
    engine = create_engine(url, **options)

    @event.listens_for(engine, "connect")
    def configure_sqlite(connection, _):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    return engine, sessionmaker(bind=engine, expire_on_commit=False)
