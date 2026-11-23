"""Frozen legacy schema as of 2026-11-23; do not import runtime models here."""
from __future__ import annotations
from datetime import datetime, timezone
import secrets
import uuid
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

def new_id():
    return str(uuid.uuid4())

def utcnow():
    return datetime.now(timezone.utc)

class Base(DeclarativeBase):
    pass

class Company(Base):
    __tablename__ = "companies"

class User(Base):
    __tablename__ = "users"

class Warehouse(Base):
    __tablename__ = "warehouses"

class AuthSession(Base):
    __tablename__ = "auth_sessions"

class AuditEvent(Base):
    __tablename__ = "audit_events"

class Supplier(Base):
    __tablename__="suppliers"

class Material(Base):
    __tablename__="materials"

class StockBalance(Base):
    __tablename__="stock_balances"

class StockOperation(Base):
    __tablename__="stock_operations"

class StockMovement(Base):
    __tablename__="stock_movements"

class Reservation(Base):
    __tablename__="stock_reservations"

class PurchaseOrder(Base):
    __tablename__="purchase_orders"

class PurchaseLine(Base):
    __tablename__="purchase_lines"

class InventoryCount(Base):
    __tablename__="inventory_counts"

class MaterialPhoto(Base):
    __tablename__ = "material_photos"
