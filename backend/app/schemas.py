from datetime import date
from decimal import Decimal
from pydantic import BaseModel, ConfigDict, Field, field_validator


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginInput(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=80)
    full_name: str = Field(min_length=1, max_length=160)
    password: str = Field(min_length=10, max_length=200)
    role: str = "operator"

    @field_validator("role")
    @classmethod
    def role_allowed(cls, value):
        if value not in {"admin", "operator"}:
            raise ValueError("Perfil inválido")
        return value


class UserOut(ORMModel):
    id: int
    username: str
    full_name: str
    role: str
    is_active: bool


class SectorInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class SectorOut(ORMModel):
    id: int
    name: str
    is_active: bool


class ItemInput(BaseModel):
    sku: str | None = Field(default=None, max_length=80)
    name: str = Field(min_length=1, max_length=180)
    category: str | None = None
    unit: str = "un"
    minimum_stock: Decimal = Field(default=Decimal("0"), ge=0)
    current_unit_cost: Decimal | None = Field(default=None, ge=0)


class ItemOut(ORMModel):
    id: int
    sku: str | None
    name: str
    category: str | None
    unit: str
    minimum_stock: Decimal
    current_unit_cost: Decimal | None
    is_active: bool
    balance: Decimal = Decimal("0")
    low_stock: bool = False


class MovementInput(BaseModel):
    movement_type: str
    quantity: Decimal = Field(gt=0)
    reason: str = Field(min_length=2, max_length=500)
    unit_cost: Decimal | None = Field(default=None, ge=0)
    invoice_total: Decimal | None = Field(default=None, ge=0)
    supplier_name: str | None = Field(default=None, max_length=180)
    invoice_number: str | None = Field(default=None, max_length=80)
    sector_id: int | None = None
    responsible_id: int | None = None
    signed_quantity: Decimal | None = None


class MovementOut(ORMModel):
    id: int
    item_id: int
    movement_type: str
    quantity: Decimal
    signed_quantity: Decimal
    reason: str
    sector_id: int | None
    responsible_id: int | None
    reverses_id: int | None
    created_at: object


class ReasonInput(BaseModel):
    reason: str = Field(min_length=3, max_length=500)


class ScheduleInput(BaseModel):
    supplier_name: str = Field(min_length=1, max_length=180)
    recurrence_days: int = Field(gt=0, le=366)
    next_due_date: date
    notes: str | None = Field(default=None, max_length=2000)


class ScheduleCompleteInput(BaseModel):
    completed_on: date = Field(default_factory=date.today)


class VehicleInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    plate: str = Field(min_length=7, max_length=10)
    model: str | None = None
    fuel_type: str | None = None
    initial_odometer: Decimal = Field(default=Decimal("0"), ge=0)


class FuelInput(BaseModel):
    occurred_on: date
    odometer: Decimal = Field(ge=0)
    liters: Decimal = Field(gt=0)
    amount: Decimal = Field(gt=0)
    full_tank: bool = True
    fuel_type: str | None = None
    station: str | None = None
    driver: str | None = None


class MaintenanceInput(BaseModel):
    description: str = Field(min_length=2, max_length=500)
    category: str = "maintenance"
    occurred_on: date
    amount: Decimal = Field(default=Decimal("0"), ge=0)
    odometer: Decimal | None = Field(default=None, ge=0)
    next_due_date: date | None = None
    next_due_odometer: Decimal | None = Field(default=None, ge=0)
