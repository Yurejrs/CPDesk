import os
import tempfile
from io import BytesIO
from pathlib import Path

os.environ["CPDESK_DATABASE_URL"] = f"sqlite:///{Path(tempfile.mkdtemp()) / 'test-cpdesk.db'}"
os.environ["CPDESK_SECRET_KEY"] = "test-secret-key-that-is-long-enough"

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.main import app


@pytest.fixture
def client():
    import tempfile
    from pathlib import Path
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from app.database import Base, get_db

    db_path = Path(tempfile.mkdtemp()) / "isolated-cpdesk.db"
    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()


def test_stock_purchase_routine_fleet_and_reports_workflow(client):
        setup = client.post("/api/v1/auth/setup", json={
            "username": "admin", "full_name": "Administradora", "password": "senha-forte-123", "role": "admin"
        })
        assert setup.status_code == 201, setup.text

        sector = client.post("/api/v1/sectors", json={"name": "Suporte"})
        operator = client.post("/api/v1/users", json={
            "username": "operador", "full_name": "Pessoa Responsável", "password": "senha-forte-456", "role": "operator"
        })
        assert sector.status_code == operator.status_code == 201
        item = client.post("/api/v1/items", json={
            "sku": "CAB-01", "name": "Cabo de rede", "unit": "m", "minimum_stock": 5
        })
        assert item.status_code == 201, item.text
        item_id = item.json()["id"]

        entry = client.post(f"/api/v1/items/{item_id}/movements", json={
            "movement_type": "entry", "quantity": 10, "reason": "Saldo inicial",
            "unit_cost": 2.5, "invoice_total": 25, "supplier_name": "Fornecedor CPDesk", "invoice_number": "NF-123"
        })
        assert entry.status_code == 201, entry.text
        assert client.get("/api/v1/items").json()[0]["balance"] == 10

        denied = client.post(f"/api/v1/items/{item_id}/movements", json={
            "movement_type": "exit", "quantity": 11, "reason": "Consumo",
            "sector_id": sector.json()["id"], "responsible_id": operator.json()["id"]
        })
        assert denied.status_code == 409

        exit_row = client.post(f"/api/v1/items/{item_id}/movements", json={
            "movement_type": "exit", "quantity": 3, "reason": "Uso operacional",
            "sector_id": sector.json()["id"], "responsible_id": operator.json()["id"]
        })
        assert exit_row.status_code == 201, exit_row.text
        assert client.get("/api/v1/items").json()[0]["balance"] == 7
        consumption = client.get("/api/v1/reports/stock-consumption").json()
        assert consumption[0]["sector"] == "Suporte"
        assert consumption[0]["responsible"] == "Pessoa Responsável"
        assert consumption[0]["total_cost"] == 7.5

        reversal = client.post(f"/api/v1/stock/movements/{entry.json()['id']}/reverse", json={"reason": "Conferência corrigida"})
        assert reversal.status_code == 409  # saída já consumiu parte da entrada
        stock_adjustment = client.post(f"/api/v1/items/{item_id}/movements", json={
            "movement_type": "adjustment", "quantity": 3, "signed_quantity": -3,
            "reason": "Contagem física"
        })
        assert stock_adjustment.status_code == 201
        assert client.get("/api/v1/items").json()[0]["balance"] == 4
        assert len(client.get("/api/v1/stock/alerts").json()) == 1

        routine = client.post("/api/v1/purchases", json={
            "supplier_name": "Fornecedor CPDesk", "recurrence_days": 30, "next_due_date": "2026-10-20",
            "notes": "Material de escritório"
        })
        assert routine.status_code == 201, routine.text
        schedule_id = routine.json()["id"]
        assert client.get("/api/v1/purchases").json()[0]["supplier_name"] == "Fornecedor CPDesk"
        completed = client.post(f"/api/v1/purchases/{schedule_id}/complete", json={"completed_on": "2026-10-20"})
        assert completed.status_code == 200
        assert completed.json()["next_due_date"] == "2026-11-19"
        assert client.post(f"/api/v1/purchases/{schedule_id}/receipts", json={}).status_code == 405

        vehicle = client.post("/api/v1/vehicles", json={"name": "Van CPD", "plate": "abc1d23", "initial_odometer": 1000})
        assert vehicle.status_code == 201, vehicle.text
        vehicle_id = vehicle.json()["id"]
        first = client.post(f"/api/v1/vehicles/{vehicle_id}/fuel", json={
            "occurred_on": "2026-10-01", "odometer": 1000, "liters": 40, "amount": 240, "full_tank": True
        })
        assert first.status_code == 201, first.text
        client.post(f"/api/v1/vehicles/{vehicle_id}/fuel", json={
            "occurred_on": "2026-10-05", "odometer": 1200, "liters": 20, "amount": 120, "full_tank": False
        })
        third = client.post(f"/api/v1/vehicles/{vehicle_id}/fuel", json={
            "occurred_on": "2026-10-10", "odometer": 1400, "liters": 40, "amount": 240, "full_tank": True
        })
        assert third.status_code == 201
        history = client.get(f"/api/v1/vehicles/{vehicle_id}/fuel").json()
        assert history[-1]["km_per_liter"] == 400 / 60
        inconsistent = client.post(f"/api/v1/vehicles/{vehicle_id}/fuel", json={
            "occurred_on": "2026-10-11", "odometer": 1300, "liters": 10, "amount": 60
        })
        assert inconsistent.status_code == 201
        assert "Hodômetro" in inconsistent.json()["odometer_warning"]
        maintenance = client.post(f"/api/v1/vehicles/{vehicle_id}/maintenance", json={
            "description": "Revisão", "occurred_on": "2026-10-10", "amount": 400, "next_due_date": "2026-11-10"
        })
        assert maintenance.status_code == 201
        dashboard = client.get("/api/v1/dashboard").json()
        assert len(dashboard["stock_alerts"]) == 1
        assert "maintenance_due" not in dashboard
        assert len(client.get("/api/v1/reports/fleet").json()) == 1
        assert client.get("/api/v1/reports/fleet.csv").headers["content-type"].startswith("text/csv")
        assert client.get("/api/v1/reports/fleet.xlsx").headers["content-type"].startswith("application/vnd.openxmlformats")
        assert client.get("/api/v1/reports/fleet.pdf").headers["content-type"].startswith("application/pdf")
        assert client.get("/api/v1/reports/stock-consumption.xlsx").headers["content-type"].startswith("application/vnd.openxmlformats")
        assert client.get("/api/v1/reports/stock-consumption.pdf").headers["content-type"].startswith("application/pdf")


def test_item_excel_import_creates_opening_movement(client):
        setup = client.post("/api/v1/auth/setup", json={
            "username": "admin", "full_name": "Administradora", "password": "senha-forte-123", "role": "admin"
        })
        assert setup.status_code == 201
        workbook = Workbook()
        sheet = workbook.active
        sheet.append(["Código", "Descrição", "Unidade", "Estoque mínimo", "Saldo inicial", "Valor unitário", "Fornecedor"])
        sheet.append(["PAP-01", "Papel A4", "pct", 2, 8, 12.5, "Papelaria Central"])
        file = BytesIO()
        workbook.save(file)
        response = client.post("/api/v1/items/import", files={
            "file": ("itens.xlsx", file.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        })
        assert response.status_code == 201, response.text
        assert response.json()["imported"] == 1
        item = client.get("/api/v1/items?q=PAP-01").json()[0]
        assert item["balance"] == 8
        assert item["last_supplier"] == "Papelaria Central"
