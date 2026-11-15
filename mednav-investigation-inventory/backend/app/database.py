from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, create_engine, event
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
