from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import AuditLog, FuelRecord, Item, Maintenance, PurchaseSchedule, StockMovement, Vehicle

ZERO = Decimal("0")


def item_balance(db: Session, item_id: int) -> Decimal:
    return db.scalar(select(func.coalesce(func.sum(StockMovement.signed_quantity), 0)).where(StockMovement.item_id == item_id)) or ZERO


def item_balances(db: Session) -> dict[int, Decimal]:
    return {item_id: Decimal(balance or 0) for item_id, balance in db.execute(
        select(StockMovement.item_id, func.sum(StockMovement.signed_quantity)).group_by(StockMovement.item_id)
    )}


def stock_alerts(db: Session) -> list[dict]:
    balances = item_balances(db)
    items = db.scalars(select(Item).where(Item.is_active.is_(True)).order_by(Item.name)).all()
    return [{"id": item.id, "name": item.name, "sku": item.sku, "unit": item.unit,
             "balance": balances.get(item.id, ZERO), "minimum_stock": item.minimum_stock,
             "shortage": max(item.minimum_stock - balances.get(item.id, ZERO), ZERO)}
            for item in items if item.minimum_stock > 0 and balances.get(item.id, ZERO) <= item.minimum_stock]


def stock_consumption(db: Session, start: date | None = None, end: date | None = None) -> list[dict]:
    query = (select(StockMovement, Item,).join(Item).where(StockMovement.movement_type == "exit")
             .order_by(StockMovement.created_at.desc(), StockMovement.id.desc()))
    if start:
        query = query.where(StockMovement.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        query = query.where(StockMovement.created_at < datetime.combine(end + timedelta(days=1), datetime.min.time()))
    rows = []
    for movement, item in db.execute(query):
        sector_name = movement.sector.name if movement.sector else "Sem setor"
        quantity = movement.quantity
        unit_cost = movement.unit_cost or item.current_unit_cost or ZERO
        rows.append({"movement_id": movement.id, "date": movement.created_at.date(), "item_id": item.id,
                     "code": item.sku, "item": item.name, "sector_id": movement.sector_id,
                     "sector": sector_name, "responsible": movement.responsible.full_name if movement.responsible else "—",
                     "quantity": quantity, "unit": item.unit, "unit_cost": unit_cost,
                     "total_cost": quantity * unit_cost, "reason": movement.reason})
    return rows


def audit(db: Session, actor_id: int | None, action: str, entity_type: str, entity_id: int, details: str | None = None):
    db.add(AuditLog(actor_id=actor_id, action=action, entity_type=entity_type, entity_id=entity_id, details=details))


def validate_odometer(db: Session, vehicle: Vehicle, occurred_on: date, odometer: Decimal,
                      exclude_id: int | None = None):
    records = db.scalars(select(FuelRecord).where(FuelRecord.vehicle_id == vehicle.id,
        FuelRecord.cancelled_at.is_(None), FuelRecord.id != (exclude_id or -1)).order_by(FuelRecord.occurred_on, FuelRecord.odometer, FuelRecord.id)).all()
    previous = [record for record in records if record.occurred_on < occurred_on or
                (record.occurred_on == occurred_on and record.odometer <= odometer)]
    following = [record for record in records if record.occurred_on > occurred_on or
                 (record.occurred_on == occurred_on and record.odometer > odometer)]
    violations = []
    if odometer < vehicle.initial_odometer:
        violations.append(f"Hodômetro abaixo do inicial ({vehicle.initial_odometer} km)")
    if previous and odometer < previous[-1].odometer:
        violations.append(f"Hodômetro abaixo do lançamento anterior ({previous[-1].odometer} km)")
    if following and odometer > following[0].odometer:
        violations.append(f"Hodômetro acima do lançamento posterior ({following[0].odometer} km)")
    return violations


def fuel_efficiency(records: list[FuelRecord]) -> list[dict]:
    records = sorted(records, key=lambda record: (record.occurred_on, record.odometer, record.id))
    result = []
    last_full = None
    interval_liters = ZERO
    interval_invalid = False
    for record in records:
        interval_liters += record.liters
        interval_invalid = interval_invalid or bool(record.odometer_warning)
        km_per_liter = None
        if record.full_tank:
            if last_full is not None and not interval_invalid:
                distance = record.odometer - last_full.odometer
                if distance > 0 and interval_liters > 0:
                    km_per_liter = distance / interval_liters
            consumption_distance = distance if record.full_tank and last_full is not None and not interval_invalid and distance > 0 and interval_liters > 0 else None
            consumption_liters = interval_liters if consumption_distance is not None else None
            last_full = record if not record.odometer_warning else None
            interval_liters = ZERO
            interval_invalid = False
        else:
            consumption_distance = consumption_liters = None
        result.append({"id": record.id, "occurred_on": record.occurred_on, "liters": record.liters,
                       "amount": record.amount, "odometer": record.odometer, "km_per_liter": km_per_liter,
                       "odometer_warning": record.odometer_warning,
                       "consumption_distance": consumption_distance,
                       "consumption_liters": consumption_liters})
    return result


def dashboard_data(db: Session):
    today = date.today()
    alerts = stock_alerts(db)
    routines = db.scalars(select(PurchaseSchedule).where(PurchaseSchedule.is_active.is_(True),
        PurchaseSchedule.next_due_date <= today + timedelta(days=7)).order_by(PurchaseSchedule.next_due_date)).all()
    vehicles = db.scalars(select(Vehicle).where(Vehicle.is_active.is_(True))).all()
    return {"stock_alerts": alerts,
            "purchase_routines": [{"id": item.id, "supplier_name": item.supplier_name,
                "next_due_date": item.next_due_date, "recurrence_days": item.recurrence_days,
                "last_completed_date": item.last_completed_date} for item in routines],
            "active_vehicles": len(vehicles)}


def report_data(db: Session, start: date | None = None, end: date | None = None):
    vehicles = db.scalars(select(Vehicle).order_by(Vehicle.name)).all()
    rows = []
    for vehicle in vehicles:
        all_fuels = db.scalars(select(FuelRecord).where(FuelRecord.vehicle_id == vehicle.id,
            FuelRecord.cancelled_at.is_(None)).order_by(FuelRecord.occurred_on, FuelRecord.odometer)).all()
        fuels = [row for row in all_fuels if (start is None or row.occurred_on >= start) and (end is None or row.occurred_on <= end)]
        maintenance_query = select(Maintenance).where(Maintenance.vehicle_id == vehicle.id,
            Maintenance.is_cancelled.is_(False))
        if start:
            maintenance_query = maintenance_query.where(Maintenance.occurred_on >= start)
        if end:
            maintenance_query = maintenance_query.where(Maintenance.occurred_on <= end)
        maintenances = db.scalars(maintenance_query).all()
        selected_ids = {row.id for row in fuels}
        distance = sum((max(Decimal("0"), b.odometer - a.odometer) for a, b in zip(all_fuels, all_fuels[1:])
                        if b.id in selected_ids and not b.odometer_warning and not a.odometer_warning), ZERO)
        fuel_amount = sum((record.amount for record in fuels), ZERO)
        maintenance_cost = sum((row.amount for row in maintenances), ZERO)
        efficiency_rows = fuel_efficiency(all_fuels)
        selected_efficiency = [row for row in efficiency_rows if row["id"] in selected_ids]
        valid_distance = sum((row["consumption_distance"] or ZERO for row in selected_efficiency), ZERO)
        valid_liters = sum((row["consumption_liters"] or ZERO for row in selected_efficiency), ZERO)
        rows.append({"vehicle_id": vehicle.id, "vehicle": vehicle.name, "plate": vehicle.plate,
                     "fuel_amount": fuel_amount, "liters": sum((r.liters for r in fuels), ZERO),
                     "distance_km": distance, "maintenance_cost": maintenance_cost,
                     "total_cost": fuel_amount + maintenance_cost,
                     "km_per_liter": valid_distance / valid_liters if valid_distance and valid_liters else None,
                     "cost_per_km": (fuel_amount + maintenance_cost) / distance if distance else None,
                     "fuel_records": selected_efficiency})
    return rows
