import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import select

from . import models  # noqa: F401
from .api import router
from .database import Base, SessionLocal, engine
from .models import User
from .security import hash_password


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if os.getenv("CPDESK_ADMIN_USERNAME") and os.getenv("CPDESK_ADMIN_PASSWORD"):
        with SessionLocal() as db:
            if not db.scalar(select(User.id).limit(1)):
                username = os.environ["CPDESK_ADMIN_USERNAME"]
                db.add(User(username=username, full_name=os.getenv("CPDESK_ADMIN_NAME", "Administrador"),
                    password_hash=hash_password(os.environ["CPDESK_ADMIN_PASSWORD"]), role="admin"))
                db.commit()
    yield


app = FastAPI(title="CPDesk API", version="0.1.0-beta", lifespan=lifespan)
origins = [value.strip() for value in os.getenv("CPDESK_CORS_ORIGINS", "http://localhost:5173").split(",") if value.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "cpdesk"}


frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def frontend(full_path: str):
        candidate = frontend_dist / full_path
        if candidate.is_file() and frontend_dist in candidate.resolve().parents:
            return FileResponse(candidate)
        return FileResponse(frontend_dist / "index.html")
