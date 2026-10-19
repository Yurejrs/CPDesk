from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(160))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(20), default="operator")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Sector(Base):
    __tablename__ = "sectors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Item(Base):
    __tablename__ = "items"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str | None] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(180), index=True)
    category: Mapped[str | None] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(32), default="un")
    minimum_stock: Mapped[Decimal] = mapped_column(Numeric(14, 3), default=Decimal("0"))
    current_unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    last_supplier: Mapped[str | None] = mapped_column(String(180))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    movements: Mapped[list["StockMovement"]] = relationship(back_populates="item")


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_movement_positive_quantity"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(20), index=True)  # entry, exit, adjustment
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    signed_quantity: Mapped[Decimal] = mapped_column(Numeric(14, 3))
    reason: Mapped[str] = mapped_column(String(500))
    unit_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    invoice_total: Mapped[Decimal | None] = mapped_column(Numeric(14, 2))
    supplier_name: Mapped[str | None] = mapped_column(String(180))
    invoice_number: Mapped[str | None] = mapped_column(String(80))
    sector_id: Mapped[int | None] = mapped_column(ForeignKey("sectors.id"))
    responsible_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reverses_id: Mapped[int | None] = mapped_column(ForeignKey("stock_movements.id"), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    item: Mapped[Item] = relationship(back_populates="movements")
    sector: Mapped[Sector | None] = relationship()
    responsible: Mapped[User | None] = relationship()


class PurchaseSchedule(Base):
    __tablename__ = "purchase_schedules"
    id: Mapped[int] = mapped_column(primary_key=True)
    supplier_name: Mapped[str] = mapped_column(String(180))
    recurrence_days: Mapped[int] = mapped_column(Integer)
    next_due_date: Mapped[date] = mapped_column(Date, index=True)
    last_completed_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Vehicle(Base):
    __tablename__ = "vehicles"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    plate: Mapped[str] = mapped_column(String(7), unique=True, index=True)
    model: Mapped[str | None] = mapped_column(String(120))
    fuel_type: Mapped[str | None] = mapped_column(String(40))
    initial_odometer: Mapped[Decimal] = mapped_column(Numeric(14, 1), default=Decimal("0"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    fuel_records: Mapped[list["FuelRecord"]] = relationship(back_populates="vehicle")
    maintenances: Mapped[list["Maintenance"]] = relationship(back_populates="vehicle")


class FuelRecord(Base):
    __tablename__ = "fuel_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    odometer: Mapped[Decimal] = mapped_column(Numeric(14, 1))
    liters: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2))
    full_tank: Mapped[bool] = mapped_column(Boolean, default=True)
    fuel_type: Mapped[str | None] = mapped_column(String(40))
    station: Mapped[str | None] = mapped_column(String(180))
    driver: Mapped[str | None] = mapped_column(String(160))
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime)
    cancellation_reason: Mapped[str | None] = mapped_column(String(500))
    odometer_warning: Mapped[str | None] = mapped_column(String(1000))
    vehicle: Mapped[Vehicle] = relationship(back_populates="fuel_records")


class Maintenance(Base):
    __tablename__ = "maintenances"
    id: Mapped[int] = mapped_column(primary_key=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    description: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(80), default="maintenance")
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    odometer: Mapped[Decimal | None] = mapped_column(Numeric(14, 1))
    next_due_date: Mapped[date | None] = mapped_column(Date)
    next_due_odometer: Mapped[Decimal | None] = mapped_column(Numeric(14, 1))
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    vehicle: Mapped[Vehicle] = relationship(back_populates="maintenances")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[int] = mapped_column(Integer)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
