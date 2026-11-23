"""StockControl Phase 1 admin API.

Development foundation: explicit organization scoping, RBAC, hashed passwords,
opaque revocable sessions and append-only audit records. Not production certified.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, VerificationError
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, event, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

ROLES = ("Administrador", "Gestor", "Operador", "Auditor")
UTC = timezone.utc
ph = PasswordHasher(time_cost=2, memory_cost=32768, parallelism=2)
bearer = HTTPBearer(auto_error=False)


def utcnow():
    return datetime.now(UTC)


def new_id():
    return str(uuid.uuid4())


def normalize_email(value):
    clean = str(value).strip().lower()
    if len(clean) > 254 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", clean):
        raise ValueError("Email inválido.")
    return clean


def clean_name(value, field, limit):
    cleaned = str(value).strip()
    if len(cleaned) < 2 or len(cleaned) > limit:
        raise ValueError(f"{field} deve ter entre 2 e {limit} caracteres.")
    return cleaned


def strong_password(value):
    if not isinstance(value, str) or len(value) < 12 or len(value) > 128:
        raise ValueError("A palavra-passe deve ter entre 12 e 128 caracteres.")
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("A palavra-passe deve conter letras e números.")
    return value


class Base(DeclarativeBase):
    pass


class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(24), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sector: Mapped[str] = mapped_column(String(100), nullable=False, default="Indústria")
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("company_id", "email", name="uq_company_email"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(300), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class Warehouse(Base):
    __tablename__ = "warehouses"
    __table_args__ = (UniqueConstraint("company_id", "code", name="uq_company_warehouse_code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(24), nullable=False)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    actor_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    target_type: Mapped[str] = mapped_column(String(40), nullable=False)
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    detail: Mapped[str] = mapped_column(String(250), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class SetupIn(BaseModel):
    company_code: str = Field(min_length=2, max_length=24, pattern=r"^[A-Za-z0-9-]+$")
    company_name: str = Field(min_length=2, max_length=100)
    admin_name: str = Field(min_length=2, max_length=80)
    admin_email: str
    admin_password: str


class LoginIn(BaseModel):
    company_code: str
    email: str
    password: str


class CompanyPatch(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    sector: str = Field(min_length=2, max_length=100)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str
    password: str
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        if value not in ROLES:
            raise ValueError("Papel inválido.")
        return value


class UserPatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    role: str | None = None
    active: bool | None = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, value):
        if value is not None and value not in ROLES:
            raise ValueError("Papel inválido.")
        return value


class PasswordPatch(BaseModel):
    password: str


class WarehouseCreate(BaseModel):
    code: str = Field(min_length=2, max_length=24, pattern=r"^[A-Za-z0-9-]+$")
    name: str = Field(min_length=2, max_length=80)
    location: str = Field(min_length=2, max_length=120)


class WarehousePatch(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=80)
    location: str | None = Field(default=None, min_length=2, max_length=120)
    active: bool | None = None


def company_public(c):
    return {"id": c.id, "code": c.code, "name": c.name, "sector": c.sector, "active": c.active}


def user_public(u):
    return {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "active": u.active}


def warehouse_public(w):
    return {"id": w.id, "code": w.code, "name": w.name, "location": w.location, "active": w.active}


def audit(db, company_id, actor_id, action, target_type, target_id, detail=""):
    db.add(AuditEvent(company_id=company_id, actor_id=actor_id, action=action,
                      target_type=target_type, target_id=target_id, detail=detail[:250]))


def account_count(db, company_id):
    return db.scalar(select(func.count()).select_from(User).where(
        User.company_id == company_id, User.role == "Administrador", User.active.is_(True))) or 0


def provision_company(db, code, name, sector, admin_name, admin_email, password):
    """Privileged CLI/bootstrap helper, not an unprotected public API endpoint."""
    code = code.strip().upper()
    if not re.fullmatch(r"[A-Z0-9-]{2,24}", code):
        raise ValueError("Código de empresa inválido.")
    email = normalize_email(admin_email)
    name = clean_name(name, "Empresa", 100)
    sector = clean_name(sector, "Setor", 100)
    admin_name = clean_name(admin_name, "Administrador", 80)
    strong_password(password)
    if db.scalar(select(Company.id).where(Company.code == code)):
        raise ValueError("Código de empresa já existe.")
    company = Company(code=code, name=name.strip(), sector=sector.strip())
    db.add(company)
    db.flush()
    user = User(company_id=company.id, name=admin_name.strip(), email=email,
                role="Administrador", password_hash=ph.hash(password))
    db.add(user)
    db.flush()
    db.add(Warehouse(company_id=company.id, code="ARM-01", name="Armazém principal",
                     location="Sede"))
    audit(db, company.id, user.id, "company.created", "company", company.id)
    db.commit()
    return company


def create_app(database_url=None, setup_key=None):
    database_url = database_url or os.environ.get("STOCKCONTROL_DATABASE_URL", "sqlite:///./stockcontrol-phase1.db")
    setup_key = setup_key if setup_key is not None else os.environ.get("STOCKCONTROL_SETUP_KEY")
    engine_args = {"pool_pre_ping": True}
    if database_url.startswith("sqlite:"):
        engine_args["connect_args"] = {"check_same_thread": False}
    engine = create_engine(database_url, **engine_args)
    if engine.dialect.name == "sqlite":
        @event.listens_for(engine, "connect")
        def enable_foreign_keys(connection, _record):
            cursor = connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()
    Base.metadata.create_all(bind=engine)  # Dev bootstrap only: migrations required in production.
    SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    app = FastAPI(title="StockControl · Administração Fase 1", version="0.1.0")
    app.state.engine = engine
    app.state.SessionLocal = SessionLocal
    app.state.attempts = {}
    app.state.attempt_lock = threading.Lock()

    def db_session():
        with SessionLocal() as db:
            yield db

    def get_context(credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
                    db: Session = Depends(db_session)):
        if credentials is None or credentials.scheme.lower() != "bearer":
            raise HTTPException(401, "Sessão necessária.", headers={"WWW-Authenticate": "Bearer"})
        hashed = hashlib.sha256(credentials.credentials.encode("utf-8")).hexdigest()
        session = db.get(AuthSession, hashed)
        if not session:
            raise HTTPException(401, "Sessão inválida.")
        expires = session.expires_at
        if (expires if expires.tzinfo else expires.replace(tzinfo=UTC)) <= utcnow():
            db.delete(session)
            db.commit()
            raise HTTPException(401, "Sessão expirada.")
        user = db.get(User, session.user_id)
        company = db.get(Company, session.company_id)
        if not user or not company or not user.active or not company.active or user.company_id != company.id:
            raise HTTPException(401, "Conta ou empresa inativa.")
        return user, company, session

    def require(*roles):
        def verify(ctx=Depends(get_context)):
            if ctx[0].role not in roles:
                raise HTTPException(403, "Sem permissão para esta operação.")
            return ctx
        return verify

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        if request.url.path.startswith("/admin"):
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; script-src 'self'; style-src 'self'; "
                "img-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'")
        return response

    assets = Path(__file__).resolve().parent / "static"
    app.mount("/admin-assets", StaticFiles(directory=assets), name="admin-assets")

    @app.get("/admin", include_in_schema=False)
    def admin_page():
        return FileResponse(assets / "index.html", media_type="text/html")

    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "component": "phase1-admin"}

    @app.post("/api/v1/setup", status_code=201)
    def setup(payload: SetupIn, x_setup_key: str | None = Header(default=None),
              db: Session = Depends(db_session)):
        if not setup_key:
            raise HTTPException(503, "Inicialização desativada: configura STOCKCONTROL_SETUP_KEY.")
        if not x_setup_key or not hmac.compare_digest(x_setup_key, setup_key):
            raise HTTPException(403, "Credencial de inicialização inválida.")
        if db.scalar(select(func.count()).select_from(Company)):
            raise HTTPException(409, "Sistema já inicializado.")
        try:
            company = provision_company(db, payload.company_code, payload.company_name,
                                        "Indústria", payload.admin_name,
                                        payload.admin_email, payload.admin_password)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        return {"company": company_public(company)}

    @app.post("/api/v1/auth/login")
    def login(payload: LoginIn, request: Request, db: Session = Depends(db_session)):
        code = payload.company_code.strip().upper()
        try:
            email = normalize_email(payload.email)
        except ValueError:
            raise HTTPException(401, "Credenciais inválidas.")
        key = (code, email, request.client.host if request.client else "unknown")
        with app.state.attempt_lock:
            recent = [t for t in app.state.attempts.get(key, []) if time.monotonic() - t < 900]
            if len(recent) >= 5:
                raise HTTPException(429, "Demasiadas tentativas. Tenta mais tarde.")
        company = db.scalar(select(Company).where(Company.code == code, Company.active.is_(True)))
        user = db.scalar(select(User).where(User.company_id == company.id, User.email == email)) if company else None
        ok = False
        if user and user.active:
            try:
                ok = ph.verify(user.password_hash, payload.password)
            except (VerifyMismatchError, VerificationError):
                ok = False
        if not ok:
            with app.state.attempt_lock:
                app.state.attempts[key] = recent + [time.monotonic()]
            raise HTTPException(401, "Credenciais inválidas.")
        with app.state.attempt_lock:
            app.state.attempts.pop(key, None)
        token = secrets.token_urlsafe(48)
        db.add(AuthSession(token_hash=hashlib.sha256(token.encode()).hexdigest(),
                           user_id=user.id, company_id=company.id,
                           expires_at=utcnow() + timedelta(hours=8)))
        audit(db, company.id, user.id, "auth.login", "user", user.id)
        db.commit()
        return {"access_token": token, "token_type": "bearer", "expires_in": 28800,
                "user": user_public(user), "company": company_public(company)}

    @app.post("/api/v1/auth/logout")
    def logout(ctx=Depends(get_context), db: Session = Depends(db_session)):
        user, company, session = ctx
        db.delete(session)
        audit(db, company.id, user.id, "auth.logout", "user", user.id)
        db.commit()
        return {"ok": True}

    @app.get("/api/v1/auth/me")
    def me(ctx=Depends(get_context)):
        user, company, _ = ctx
        return {"user": user_public(user), "company": company_public(company)}

    @app.get("/api/v1/company")
    def read_company(ctx=Depends(get_context)):
        return company_public(ctx[1])

    @app.patch("/api/v1/company")
    def update_company(payload: CompanyPatch, ctx=Depends(require("Administrador")),
                       db: Session = Depends(db_session)):
        user, company, _ = ctx
        try:
            name = clean_name(payload.name, "Empresa", 100)
            sector = clean_name(payload.sector, "Setor", 100)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        company.name = name
        company.sector = sector
        audit(db, company.id, user.id, "company.updated", "company", company.id)
        db.commit()
        return company_public(company)

    @app.get("/api/v1/users")
    def list_users(ctx=Depends(require("Administrador", "Gestor", "Auditor")),
                   db: Session = Depends(db_session)):
        company_id = ctx[1].id
        users = db.scalars(select(User).where(User.company_id == company_id).order_by(User.name)).all()
        return [user_public(u) for u in users]

    @app.post("/api/v1/users", status_code=201)
    def create_user(payload: UserCreate, ctx=Depends(require("Administrador")),
                    db: Session = Depends(db_session)):
        actor, company, _ = ctx
        try:
            email = normalize_email(payload.email)
            strong_password(payload.password)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if db.scalar(select(User.id).where(User.company_id == company.id, User.email == email)):
            raise HTTPException(409, "Este email já está registado nesta empresa.")
        try:
            name = clean_name(payload.name, "Utilizador", 80)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        user = User(company_id=company.id, name=name, email=email,
                    role=payload.role, password_hash=ph.hash(payload.password))
        db.add(user)
        db.flush()
        audit(db, company.id, actor.id, "user.created", "user", user.id, payload.role)
        db.commit()
        return user_public(user)

    @app.patch("/api/v1/users/{user_id}")
    def update_user(user_id: str, payload: UserPatch, ctx=Depends(require("Administrador")),
                    db: Session = Depends(db_session)):
        actor, company, _ = ctx
        # Lock parent company row to serialize 'last administrator' transitions on PostgreSQL.
        db.execute(select(Company).where(Company.id == company.id).with_for_update()).scalar_one()
        user = db.scalar(select(User).where(User.id == user_id, User.company_id == company.id))
        if not user:
            raise HTTPException(404, "Utilizador não encontrado.")
        new_role = payload.role if payload.role is not None else user.role
        new_active = payload.active if payload.active is not None else user.active
        if user.role == "Administrador" and user.active and (new_role != "Administrador" or not new_active):
            if account_count(db, company.id) <= 1:
                raise HTTPException(409, "A empresa precisa de um administrador ativo.")
        if payload.name is not None:
            try:
                user.name = clean_name(payload.name, "Utilizador", 80)
            except ValueError as exc:
                raise HTTPException(422, str(exc)) from exc
        user.role = new_role
        user.active = new_active
        if not new_active:
            db.query(AuthSession).filter(AuthSession.company_id == company.id,
                                         AuthSession.user_id == user.id).delete(synchronize_session=False)
        audit(db, company.id, actor.id, "user.updated", "user", user.id,
              f"role={new_role}, active={new_active}")
        db.commit()
        return user_public(user)

    @app.post("/api/v1/users/{user_id}/reset-password")
    def reset_password(user_id: str, payload: PasswordPatch,
                       ctx=Depends(require("Administrador")), db: Session = Depends(db_session)):
        actor, company, _ = ctx
        try:
            strong_password(payload.password)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        user = db.scalar(select(User).where(User.id == user_id, User.company_id == company.id))
        if not user:
            raise HTTPException(404, "Utilizador não encontrado.")
        user.password_hash = ph.hash(payload.password)
        db.query(AuthSession).filter(AuthSession.company_id == company.id,
                                     AuthSession.user_id == user.id).delete(synchronize_session=False)
        audit(db, company.id, actor.id, "user.password_reset", "user", user.id)
        db.commit()
        return {"ok": True}

    @app.get("/api/v1/warehouses")
    def list_warehouses(ctx=Depends(get_context), db: Session = Depends(db_session)):
        warehouses = db.scalars(select(Warehouse).where(
            Warehouse.company_id == ctx[1].id).order_by(Warehouse.code)).all()
        return [warehouse_public(w) for w in warehouses]

    @app.post("/api/v1/warehouses", status_code=201)
    def create_warehouse(payload: WarehouseCreate,
                         ctx=Depends(require("Administrador", "Gestor")),
                         db: Session = Depends(db_session)):
        actor, company, _ = ctx
        code = payload.code.strip().upper()
        if db.scalar(select(Warehouse.id).where(Warehouse.company_id == company.id, Warehouse.code == code)):
            raise HTTPException(409, "Este código já existe na empresa.")
        try:
            name = clean_name(payload.name, "Armazém", 80)
            location = clean_name(payload.location, "Localização", 120)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        warehouse = Warehouse(company_id=company.id, code=code,
                              name=name, location=location)
        db.add(warehouse)
        db.flush()
        audit(db, company.id, actor.id, "warehouse.created", "warehouse", warehouse.id, code)
        db.commit()
        return warehouse_public(warehouse)

    @app.patch("/api/v1/warehouses/{warehouse_id}")
    def update_warehouse(warehouse_id: str, payload: WarehousePatch,
                         ctx=Depends(require("Administrador", "Gestor")),
                         db: Session = Depends(db_session)):
        actor, company, _ = ctx
        db.execute(select(Company).where(Company.id == company.id).with_for_update()).scalar_one()
        warehouse = db.scalar(select(Warehouse).where(
            Warehouse.company_id == company.id, Warehouse.id == warehouse_id))
        if not warehouse:
            raise HTTPException(404, "Armazém não encontrado.")
        if payload.active is False and warehouse.active:
            n = db.scalar(select(func.count()).select_from(Warehouse).where(
                Warehouse.company_id == company.id, Warehouse.active.is_(True))) or 0
            if n <= 1:
                raise HTTPException(409, "É obrigatório manter um armazém ativo.")
        try:
            if payload.name is not None:
                warehouse.name = clean_name(payload.name, "Armazém", 80)
            if payload.location is not None:
                warehouse.location = clean_name(payload.location, "Localização", 120)
        except ValueError as exc:
            raise HTTPException(422, str(exc)) from exc
        if payload.active is not None:
            warehouse.active = payload.active
        audit(db, company.id, actor.id, "warehouse.updated", "warehouse", warehouse.id)
        db.commit()
        return warehouse_public(warehouse)

    @app.get("/api/v1/audit")
    def list_audit(limit: int = 50, offset: int = 0,
                   ctx=Depends(require("Administrador", "Gestor", "Auditor")),
                   db: Session = Depends(db_session)):
        if not 1 <= limit <= 100 or offset < 0 or offset > 100000:
            raise HTTPException(422, "Paginação inválida.")
        events = db.scalars(select(AuditEvent).where(
            AuditEvent.company_id == ctx[1].id
        ).order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).offset(offset).limit(limit)).all()
        return [{"id": e.id, "action": e.action, "target_type": e.target_type,
                 "target_id": e.target_id, "detail": e.detail, "actor_id": e.actor_id,
                 "created_at": e.created_at.isoformat()} for e in events]

    return app


app = create_app()
