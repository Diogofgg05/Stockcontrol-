"""Phase 2 real stock operations with tenant-scoped writes and auditable ledger.

Amounts stored as integer thousandths; prices as integer cents.
Development baseline only: SQLite thread lock is not multi-process safe.
PostgreSQL transactions use a company-row FOR UPDATE lock.
"""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
import re
import secrets
import threading
from typing import Literal
from uuid import uuid4

from fastapi import Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column
import qrcode
import qrcode.image.svg

from .main import Base, Company, Warehouse, audit, new_id, utcnow

SCALE=1000
MAX_AMOUNT=1_000_000_000 * SCALE
WRITE_ROLES=("Administrador","Gestor","Operador")
MANAGE_ROLES=("Administrador","Gestor")
SERIAL_UNITS={"un","pcs"}
SQLITE_LOCAL_LOCK=threading.RLock()


class Supplier(Base):
    __tablename__="suppliers"
    __table_args__=(UniqueConstraint("company_id","code",name="uq_supplier_company_code"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    code:Mapped[str]=mapped_column(String(30),nullable=False)
    name:Mapped[str]=mapped_column(String(100),nullable=False)
    email:Mapped[str | None]=mapped_column(String(254),nullable=True)
    active:Mapped[bool]=mapped_column(default=True,nullable=False)


class Material(Base):
    __tablename__="materials"
    __table_args__=(UniqueConstraint("company_id","sku",name="uq_material_company_sku"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    sku:Mapped[str]=mapped_column(String(36),nullable=False)
    name:Mapped[str]=mapped_column(String(100),nullable=False)
    category:Mapped[str]=mapped_column(String(50),nullable=False)
    unit:Mapped[str]=mapped_column(String(10),nullable=False)
    minimum_milli:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    unit_cost_cents:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    qr_code:Mapped[str]=mapped_column(String(64),unique=True,nullable=False,default=lambda:secrets.token_urlsafe(24))
    active:Mapped[bool]=mapped_column(default=True,nullable=False)


class StockBalance(Base):
    __tablename__="stock_balances"
    __table_args__=(
        UniqueConstraint("company_id","warehouse_id","material_id",name="uq_stock_location"),
        CheckConstraint("on_hand_milli >= 0 AND reserved_milli >= 0 AND reserved_milli <= on_hand_milli",name="ck_balance_nonnegative"),
    )
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    warehouse_id:Mapped[str]=mapped_column(ForeignKey("warehouses.id"),nullable=False)
    material_id:Mapped[str]=mapped_column(ForeignKey("materials.id"),nullable=False)
    on_hand_milli:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    reserved_milli:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    revision:Mapped[int]=mapped_column(Integer,nullable=False,default=0)


class StockOperation(Base):
    __tablename__="stock_operations"
    __table_args__=(UniqueConstraint("company_id","request_id",name="uq_stock_request_id"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    actor_id:Mapped[str]=mapped_column(ForeignKey("users.id"),nullable=False)
    request_id:Mapped[str]=mapped_column(String(80),nullable=False)
    kind:Mapped[str]=mapped_column(String(30),nullable=False)
    note:Mapped[str]=mapped_column(String(250),nullable=False,default="")
    created_at:Mapped[datetime]= mapped_column(DateTime(timezone=True),default=utcnow,nullable=False)


class StockMovement(Base):
    __tablename__="stock_movements"
    __table_args__=(CheckConstraint("delta_milli <> 0",name="ck_movement_nonzero"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    operation_id:Mapped[str]=mapped_column(ForeignKey("stock_operations.id"),nullable=False)
    material_id:Mapped[str]=mapped_column(ForeignKey("materials.id"),nullable=False)
    warehouse_id:Mapped[str]=mapped_column(ForeignKey("warehouses.id"),nullable=False)
    delta_milli:Mapped[int]=mapped_column(Integer,nullable=False)
    balance_after_milli:Mapped[int]=mapped_column(Integer,nullable=False)


class Reservation(Base):
    __tablename__="stock_reservations"
    __table_args__=(CheckConstraint("quantity_milli > 0 AND consumed_milli >= 0 AND consumed_milli <= quantity_milli",name="ck_reservation_quantity"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    warehouse_id:Mapped[str]=mapped_column(ForeignKey("warehouses.id"),nullable=False)
    material_id:Mapped[str]=mapped_column(ForeignKey("materials.id"),nullable=False)
    order_ref:Mapped[str]=mapped_column(String(50),nullable=False)
    quantity_milli:Mapped[int]=mapped_column(Integer,nullable=False)
    consumed_milli:Mapped[int]=mapped_column(Integer,nullable=False,default=0)
    state:Mapped[str]=mapped_column(String(20),nullable=False,default="Ativa")


class PurchaseOrder(Base):
    __tablename__="purchase_orders"
    __table_args__=(UniqueConstraint("company_id","code",name="uq_purchase_company_code"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    supplier_id:Mapped[str]=mapped_column(ForeignKey("suppliers.id"),nullable=False)
    warehouse_id:Mapped[str]=mapped_column(ForeignKey("warehouses.id"),nullable=False)
    code:Mapped[str]=mapped_column(String(40),nullable=False)
    state:Mapped[str]=mapped_column(String(20),nullable=False,default="Aberta")


class PurchaseLine(Base):
    __tablename__="purchase_lines"
    __table_args__=(CheckConstraint("ordered_milli > 0 AND received_milli >= 0 AND received_milli <= ordered_milli",name="ck_purchase_quantities"),)
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    order_id:Mapped[str]=mapped_column(ForeignKey("purchase_orders.id"),nullable=False)
    material_id:Mapped[str]=mapped_column(ForeignKey("materials.id"),nullable=False)
    ordered_milli:Mapped[int]=mapped_column(Integer,nullable=False)
    received_milli:Mapped[int]=mapped_column(Integer,nullable=False,default=0)


class InventoryCount(Base):
    __tablename__="inventory_counts"
    id:Mapped[str]=mapped_column(String(36),primary_key=True,default=new_id)
    company_id:Mapped[str]=mapped_column(ForeignKey("companies.id"),nullable=False,index=True)
    warehouse_id:Mapped[str]=mapped_column(ForeignKey("warehouses.id"),nullable=False)
    material_id:Mapped[str]=mapped_column(ForeignKey("materials.id"),nullable=False)
    expected_milli:Mapped[int]=mapped_column(Integer,nullable=False)
    counted_milli:Mapped[int]=mapped_column(Integer,nullable=False)
    revision:Mapped[int]=mapped_column(Integer,nullable=False)
    state:Mapped[str]=mapped_column(String(20),nullable=False,default="Pendente")


class MaterialIn(BaseModel):
    sku:str=Field(min_length=2,max_length=36,pattern=r"^[a-zA-Z0-9][a-zA-Z0-9._-]+$")
    name:str=Field(min_length=2,max_length=100)
    category:str=Field(min_length=2,max_length=50)
    unit:Literal["un","kg","m","L","pcs"]
    minimum:Decimal=Field(default=Decimal(0),ge=0,le=1_000_000_000)
    unit_cost:Decimal=Field(default=Decimal(0),ge=0,le=100_000_000)


class SupplierIn(BaseModel):
    code:str=Field(min_length=2,max_length=30,pattern=r"^[a-zA-Z0-9-]+$")
    name:str=Field(min_length=2,max_length=100)
    email:str|None=Field(default=None,max_length=254)


class OperationIn(BaseModel):
    warehouse_id:str
    material_id:str
    kind:Literal["Entrada","Saída","Devolução","Perda"]
    quantity:Decimal=Field(gt=0,le=1_000_000_000)
    request_id:str=Field(min_length=8,max_length=80)
    note:str=Field(default="",max_length=250)


class TransferIn(BaseModel):
    from_warehouse_id:str
    to_warehouse_id:str
    material_id:str
    quantity:Decimal=Field(gt=0,le=1_000_000_000)
    request_id:str=Field(min_length=8,max_length=80)
    note:str=Field(default="",max_length=250)


class ReserveIn(BaseModel):
    warehouse_id:str
    material_id:str
    order_ref:str=Field(min_length=2,max_length=50)
    quantity:Decimal=Field(gt=0,le=1_000_000_000)


class ConsumeIn(BaseModel):
    quantity:Decimal=Field(gt=0,le=1_000_000_000)
    request_id:str=Field(min_length=8,max_length=80)


class CountIn(BaseModel):
    warehouse_id:str
    material_id:str
    counted:Decimal=Field(ge=0,le=1_000_000_000)


class ConfirmCountIn(BaseModel):
    request_id:str=Field(min_length=8,max_length=80)


class PurchaseLineIn(BaseModel):
    material_id:str
    quantity:Decimal=Field(gt=0,le=1_000_000_000)


class PurchaseIn(BaseModel):
    code:str=Field(min_length=2,max_length=40,pattern=r"^[a-zA-Z0-9._-]+$")
    supplier_id:str
    warehouse_id:str
    items:list[PurchaseLineIn]=Field(min_length=1,max_length=60)


class ReceiptIn(BaseModel):
    line_id:str
    quantity:Decimal=Field(gt=0,le=1_000_000_000)
    request_id:str=Field(min_length=8,max_length=80)


def qty_milli(value, unit="kg", allow_zero=False):
    try:
        d=Decimal(str(value))
        mills=d*SCALE
        if not d.is_finite() or mills!=mills.to_integral_value() or (d<0 if allow_zero else d<=0) or mills>MAX_AMOUNT:
            raise ValueError
        if unit in SERIAL_UNITS and int(mills)%SCALE:
            raise ValueError
        return int(mills)
    except (InvalidOperation, ValueError, TypeError, OverflowError):
        raise HTTPException(422,"Quantidade inválida: máximo de três casas decimais; unidades inteiras para peças.")


def cost_cents(value):
    try:
        cents=Decimal(str(value))*100
        if not cents.is_finite() or cents!=cents.to_integral_value() or cents<0 or cents>10_000_000_000:
            raise ValueError
        return int(cents)
    except (InvalidOperation, ValueError, TypeError, OverflowError):
        raise HTTPException(422,"Custo inválido: máximo duas casas decimais.")


def display(q):
    return str(Decimal(q)/SCALE)


def strict_name(value,limit=100):
    name=value.strip()
    if len(name)<2 or len(name)>limit:
        raise HTTPException(422,"Nome inválido.")
    return name


def scoped(db,model,company_id,obj_id,active=False):
    query=select(model).where(model.id==obj_id,model.company_id==company_id)
    if active and hasattr(model,"active"):
        query=query.where(model.active.is_(True))
    value=db.scalar(query)
    if not value:
        raise HTTPException(404,"Registo inexistente nesta empresa.")
    return value


@contextmanager
def mutation(db,company_id):
    # SQLite requires a single-process local lock. PostgreSQL row locking provides
    # cross-process serialization; production must use PostgreSQL and migrations.
    with SQLITE_LOCAL_LOCK:
        db.execute(select(Company).where(Company.id==company_id).with_for_update()).scalar_one()
        yield


def stock_balance(db,company_id,warehouse_id,material_id):
    balance=db.scalar(select(StockBalance).where(
        StockBalance.company_id==company_id,
        StockBalance.warehouse_id==warehouse_id,
        StockBalance.material_id==material_id))
    if balance is None:
        balance=StockBalance(company_id=company_id,warehouse_id=warehouse_id,
                             material_id=material_id,on_hand_milli=0,reserved_milli=0,revision=0)
        db.add(balance)
        db.flush()
    return balance


def require_stock_room(balance,delta):
    final=balance.on_hand_milli+delta
    if final<balance.reserved_milli:
        raise HTTPException(409,"Stock disponível insuficiente ou unidades reservadas.")
    if final>MAX_AMOUNT:
        raise HTTPException(422,"Limite de quantidade ultrapassado.")
    return final


def add_operation(db,user,company_id,request_id,kind,note=""):
    if db.scalar(select(StockOperation.id).where(
        StockOperation.company_id==company_id,StockOperation.request_id==request_id)):
        raise HTTPException(409,"Pedido repetido: esta operação já foi processada.")
    op=StockOperation(company_id=company_id,actor_id=user.id,request_id=request_id,
                      kind=kind,note=note)
    db.add(op);db.flush()
    return op


def move(db,op,balance,delta):
    balance.on_hand_milli=require_stock_room(balance,delta)
    balance.revision+=1
    db.add(StockMovement(company_id=balance.company_id,operation_id=op.id,
                         warehouse_id=balance.warehouse_id,material_id=balance.material_id,
                         delta_milli=delta,balance_after_milli=balance.on_hand_milli))


def material_out(m,b=None):
    o={"id":m.id,"sku":m.sku,"name":m.name,"category":m.category,"unit":m.unit,
       "minimum":display(m.minimum_milli),"unit_cost":str(Decimal(m.unit_cost_cents)/100),
       "active":m.active,"qr_code":m.qr_code}
    if b is not None:
        o.update({"warehouse_id":b.warehouse_id,"on_hand":display(b.on_hand_milli),
                  "reserved":display(b.reserved_milli),"available":display(b.on_hand_milli-b.reserved_milli)})
    return o


def reservation_out(r):
    return {"id":r.id,"warehouse_id":r.warehouse_id,"material_id":r.material_id,
            "order_ref":r.order_ref,"quantity":display(r.quantity_milli),
            "consumed":display(r.consumed_milli),"remaining":display(
            r.quantity_milli-r.consumed_milli if r.state=="Ativa" else 0),
            "state":r.state}


def order_out(db,order):
    lines=db.scalars(select(PurchaseLine).where(
        PurchaseLine.order_id==order.id,PurchaseLine.company_id==order.company_id)).all()
    return {"id":order.id,"code":order.code,"supplier_id":order.supplier_id,
            "warehouse_id":order.warehouse_id,"state":order.state,
            "lines":[{"id":l.id,"material_id":l.material_id,
                      "ordered":display(l.ordered_milli),"received":display(l.received_milli)}
                     for l in lines]}


def install_operations(app,db_session,get_context,require,audit_func):
    @app.get("/api/v2/materials")
    def list_materials(warehouse_id:str|None=None,ctx=Depends(get_context),db:Session=Depends(db_session)):
        company_id=ctx[1].id
        if warehouse_id:
            scoped(db,Warehouse,company_id,warehouse_id)
        ms=db.scalars(select(Material).where(Material.company_id==company_id).order_by(Material.sku).limit(500)).all()
        if warehouse_id:
            balances=db.scalars(select(StockBalance).where(
                StockBalance.company_id==company_id,StockBalance.warehouse_id==warehouse_id)).all()
            lookup={b.material_id:b for b in balances}
            return [material_out(m,lookup.get(m.id) or StockBalance(warehouse_id=warehouse_id,
                           on_hand_milli=0,reserved_milli=0)) for m in ms]
        return [material_out(m) for m in ms]

    @app.post("/api/v2/materials",status_code=201)
    def create_material(payload:MaterialIn,ctx=Depends(require(*MANAGE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            sku=payload.sku.strip().upper()
            if db.scalar(select(Material.id).where(Material.company_id==company.id,Material.sku==sku)):
                raise HTTPException(409,"SKU já existente na empresa.")
            minimum=qty_milli(payload.minimum,payload.unit,True)
            cost=cost_cents(payload.unit_cost)
            m=Material(company_id=company.id,sku=sku,name=strict_name(payload.name),category=strict_name(payload.category,50),
                       unit=payload.unit,minimum_milli=minimum,unit_cost_cents=cost)
            db.add(m);db.flush()
            audit_func(db,company.id,user.id,"material.created","material",m.id,sku)
            db.commit()
        return material_out(m)

    @app.get("/api/v2/scan/{qr_code}")
    def scan_material(qr_code:str,ctx=Depends(get_context),db:Session=Depends(db_session)):
        m=db.scalar(select(Material).where(Material.company_id==ctx[1].id,Material.qr_code==qr_code))
        if not m:raise HTTPException(404,"Código QR não encontrado nesta empresa.")
        return material_out(m)

    @app.get("/api/v2/materials/{material_id}/qr.svg")
    def material_qr(material_id:str,ctx=Depends(get_context),db:Session=Depends(db_session)):
        m=scoped(db,Material,ctx[1].id,material_id)
        image=qrcode.make("stockcontrol:material:"+m.qr_code,image_factory=qrcode.image.svg.SvgPathImage,
                          box_size=8,border=3)
        buffer=BytesIO();image.save(buffer)
        return Response(content=buffer.getvalue(),media_type="image/svg+xml",
                        headers={"Content-Disposition":f'inline; filename="material-{m.sku}.svg"',
                                 "Cache-Control":"no-store"})

    @app.get("/api/v2/suppliers")
    def list_suppliers(ctx=Depends(get_context),db:Session=Depends(db_session)):
        rs=db.scalars(select(Supplier).where(Supplier.company_id==ctx[1].id).order_by(Supplier.name).limit(500)).all()
        return [{"id":s.id,"code":s.code,"name":s.name,"email":s.email,"active":s.active} for s in rs]

    @app.post("/api/v2/suppliers",status_code=201)
    def create_supplier(payload:SupplierIn,ctx=Depends(require(*MANAGE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            code=payload.code.strip().upper()
            if db.scalar(select(Supplier.id).where(Supplier.company_id==company.id,Supplier.code==code)):
                raise HTTPException(409,"Fornecedor com este código já existe.")
            s=Supplier(company_id=company.id,code=code,name=strict_name(payload.name),
                       email=payload.email.strip().lower() if payload.email else None)
            db.add(s);db.flush()
            audit_func(db,company.id,user.id,"supplier.created","supplier",s.id,code)
            db.commit()
        return {"id":s.id,"code":s.code,"name":s.name}

    @app.get("/api/v2/balances")
    def list_balances(warehouse_id:str|None=None,ctx=Depends(get_context),db:Session=Depends(db_session)):
        company_id=ctx[1].id
        if warehouse_id:scoped(db,Warehouse,company_id,warehouse_id)
        query=select(StockBalance).where(StockBalance.company_id==company_id)
        if warehouse_id:query=query.where(StockBalance.warehouse_id==warehouse_id)
        balances=db.scalars(query.order_by(StockBalance.warehouse_id).limit(1000)).all()
        return [{"material_id":b.material_id,"warehouse_id":b.warehouse_id,"on_hand":display(b.on_hand_milli),
                 "reserved":display(b.reserved_milli),"available":display(b.on_hand_milli-b.reserved_milli),
                 "revision":b.revision} for b in balances]

    @app.get("/api/v2/stock/summary")
    def stock_summary(ctx=Depends(get_context),db:Session=Depends(db_session)):
        company_id=ctx[1].id
        balances=db.scalars(select(StockBalance).where(StockBalance.company_id==company_id)).all()
        materials=db.scalars(select(Material).where(Material.company_id==company_id)).all()
        unit_lookup={m.id:m for m in materials}
        available_by_material={}
        for b in balances:
            available_by_material[b.material_id]=available_by_material.get(b.material_id,0)+b.on_hand_milli-b.reserved_milli
        low=sum(1 for m in materials if m.active and m.minimum_milli>0
                and available_by_material.get(m.id,0)<=m.minimum_milli)
        return {"materials":len(materials),"locations_with_stock":len(balances),
                "low_stock_materials":low,
                "active_reservations":len(db.scalars(select(Reservation).where(
                    Reservation.company_id==company_id,Reservation.state=="Ativa")).all())}

    @app.post("/api/v2/movements",status_code=201)
    def stock_movement(payload:OperationIn,ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            wh=scoped(db,Warehouse,company.id,payload.warehouse_id,True)
            m=scoped(db,Material,company.id,payload.material_id,True)
            qty=qty_milli(payload.quantity,m.unit)
            b=stock_balance(db,company.id,wh.id,m.id)
            delta=qty if payload.kind in ("Entrada","Devolução") else -qty
            require_stock_room(b,delta)
            op=add_operation(db,user,company.id,payload.request_id,payload.kind,payload.note)
            move(db,op,b,delta)
            audit_func(db,company.id,user.id,"stock."+payload.kind.lower(),"material",m.id,
                       f"warehouse={wh.code}; qty={display(qty)}")
            db.commit()
        return {"operation_id":op.id,"material_id":m.id,"warehouse_id":wh.id,
                "on_hand":display(b.on_hand_milli),"available":display(b.on_hand_milli-b.reserved_milli)}

    @app.post("/api/v2/transfers",status_code=201)
    def transfer(payload:TransferIn,ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        if payload.from_warehouse_id==payload.to_warehouse_id:
            raise HTTPException(422,"Armazém de origem e destino não podem ser iguais.")
        with mutation(db,company.id):
            src=scoped(db,Warehouse,company.id,payload.from_warehouse_id,True)
            dst=scoped(db,Warehouse,company.id,payload.to_warehouse_id,True)
            m=scoped(db,Material,company.id,payload.material_id,True)
            q=qty_milli(payload.quantity,m.unit)
            a=stock_balance(db,company.id,src.id,m.id)
            b=stock_balance(db,company.id,dst.id,m.id)
            require_stock_room(a,-q);require_stock_room(b,q)
            op=add_operation(db,user,company.id,payload.request_id,"Transferência",payload.note)
            move(db,op,a,-q);move(db,op,b,q)
            audit_func(db,company.id,user.id,"stock.transferred","material",m.id,
                       f"{src.code} -> {dst.code}; qty={display(q)}")
            db.commit()
        return {"operation_id":op.id,"source_available":display(a.on_hand_milli-a.reserved_milli),
                "destination_on_hand":display(b.on_hand_milli)}

    @app.get("/api/v2/movements")
    def movements(limit:int=Query(default=50,ge=1,le=100),
                  ctx=Depends(get_context),db:Session=Depends(db_session)):
        company_id=ctx[1].id
        entries=db.execute(select(StockMovement,StockOperation).join(
            StockOperation,StockMovement.operation_id==StockOperation.id).where(
            StockMovement.company_id==company_id,StockOperation.company_id==company_id
        ).order_by(StockOperation.created_at.desc(),StockMovement.id.desc()).limit(limit)).all()
        return [{"id":m.id,"kind":o.kind,"material_id":m.material_id,
                 "warehouse_id":m.warehouse_id,"delta":display(m.delta_milli),
                 "on_hand_after":display(m.balance_after_milli),"created_at":o.created_at.isoformat(),
                 "actor_id":o.actor_id} for m,o in entries]

    @app.get("/api/v2/reservations")
    def reservations(ctx=Depends(get_context),db:Session=Depends(db_session)):
        records=db.scalars(select(Reservation).where(
            Reservation.company_id==ctx[1].id).order_by(Reservation.id.desc()).limit(500)).all()
        return [reservation_out(r) for r in records]

    @app.post("/api/v2/reservations",status_code=201)
    def reserve(payload:ReserveIn,ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            scoped(db,Warehouse,company.id,payload.warehouse_id,True)
            m=scoped(db,Material,company.id,payload.material_id,True)
            qty=qty_milli(payload.quantity,m.unit)
            b=stock_balance(db,company.id,payload.warehouse_id,m.id)
            if qty>b.on_hand_milli-b.reserved_milli:
                raise HTTPException(409,"Stock disponível insuficiente para reserva.")
            r=Reservation(company_id=company.id,warehouse_id=payload.warehouse_id,
                          material_id=m.id,order_ref=strict_name(payload.order_ref,50),
                          quantity_milli=qty,consumed_milli=0,state="Ativa")
            b.reserved_milli+=qty;b.revision+=1
            db.add(r);db.flush()
            audit_func(db,company.id,user.id,"reservation.created","reservation",r.id)
            db.commit()
        return reservation_out(r)

    @app.post("/api/v2/reservations/{reservation_id}/consume")
    def consume(reservation_id:str,payload:ConsumeIn,
                ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            r=scoped(db,Reservation,company.id,reservation_id)
            if r.state!="Ativa":
                raise HTTPException(409,"Reserva já fechada.")
            m=scoped(db,Material,company.id,r.material_id)
            q=qty_milli(payload.quantity,m.unit)
            remaining=r.quantity_milli-r.consumed_milli
            if q>remaining:raise HTTPException(409,"Quantidade superior ao saldo reservado.")
            b=stock_balance(db,company.id,r.warehouse_id,m.id)
            if b.reserved_milli<q or b.on_hand_milli<q:
                raise HTTPException(409,"Inconsistência no stock reservado.")
            op=add_operation(db,user,company.id,payload.request_id,"Consumo",r.order_ref)
            b.on_hand_milli-=q;b.reserved_milli-=q;b.revision+=1
            r.consumed_milli+=q
            if r.consumed_milli==r.quantity_milli:r.state="Concluída"
            db.add(StockMovement(company_id=company.id,operation_id=op.id,
                                 warehouse_id=b.warehouse_id,material_id=m.id,
                                 delta_milli=-q,balance_after_milli=b.on_hand_milli))
            audit_func(db,company.id,user.id,"reservation.consumed","reservation",r.id,display(q))
            db.commit()
        return reservation_out(r)

    @app.post("/api/v2/reservations/{reservation_id}/cancel")
    def cancel_reservation(reservation_id:str,ctx=Depends(require(*WRITE_ROLES)),
                           db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            r=scoped(db,Reservation,company.id,reservation_id)
            if r.state!="Ativa":raise HTTPException(409,"Reserva já fechada.")
            b=stock_balance(db,company.id,r.warehouse_id,r.material_id)
            rest=r.quantity_milli-r.consumed_milli
            if rest>b.reserved_milli:raise HTTPException(409,"Inconsistência no saldo reservado.")
            b.reserved_milli-=rest;b.revision+=1;r.state="Cancelada"
            audit_func(db,company.id,user.id,"reservation.cancelled","reservation",r.id)
            db.commit()
        return reservation_out(r)

    @app.get("/api/v2/purchase-orders")
    def list_orders(ctx=Depends(get_context),db:Session=Depends(db_session)):
        orders=db.scalars(select(PurchaseOrder).where(
            PurchaseOrder.company_id==ctx[1].id).order_by(PurchaseOrder.code).limit(500)).all()
        return [order_out(db,o) for o in orders]

    @app.post("/api/v2/purchase-orders",status_code=201)
    def create_order(payload:PurchaseIn,ctx=Depends(require(*MANAGE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            supplier=scoped(db,Supplier,company.id,payload.supplier_id,True)
            wh=scoped(db,Warehouse,company.id,payload.warehouse_id,True)
            code=payload.code.strip().upper()
            if db.scalar(select(PurchaseOrder.id).where(
                PurchaseOrder.company_id==company.id,PurchaseOrder.code==code)):
                raise HTTPException(409,"Código de encomenda duplicado.")
            if len({i.material_id for i in payload.items})!=len(payload.items):
                raise HTTPException(422,"Não repetir material na mesma encomenda.")
            order=PurchaseOrder(company_id=company.id,supplier_id=supplier.id,
                                warehouse_id=wh.id,code=code,state="Aberta")
            db.add(order);db.flush()
            for item in payload.items:
                m=scoped(db,Material,company.id,item.material_id,True)
                db.add(PurchaseLine(company_id=company.id,order_id=order.id,
                                    material_id=m.id,ordered_milli=qty_milli(item.quantity,m.unit),
                                    received_milli=0))
            db.flush()
            audit_func(db,company.id,user.id,"purchase.created","purchase",order.id,code)
            db.commit()
        return order_out(db,order)

    @app.post("/api/v2/purchase-orders/{order_id}/receive")
    def receive_order(order_id:str,payload:ReceiptIn,
                      ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            order=scoped(db,PurchaseOrder,company.id,order_id)
            if order.state not in ("Aberta","Parcial"):
                raise HTTPException(409,"Encomenda fechada.")
            line=db.scalar(select(PurchaseLine).where(
                PurchaseLine.id==payload.line_id,PurchaseLine.order_id==order.id,
                PurchaseLine.company_id==company.id))
            if line is None:raise HTTPException(404,"Linha não encontrada.")
            m=scoped(db,Material,company.id,line.material_id)
            q=qty_milli(payload.quantity,m.unit)
            if q>line.ordered_milli-line.received_milli:
                raise HTTPException(409,"Receção superior à quantidade em falta.")
            b=stock_balance(db,company.id,order.warehouse_id,m.id)
            require_stock_room(b,q)
            op=add_operation(db,user,company.id,payload.request_id,"Receção",order.code)
            move(db,op,b,q)
            line.received_milli+=q
            db.flush()
            all_lines=db.scalars(select(PurchaseLine).where(
                PurchaseLine.company_id==company.id,PurchaseLine.order_id==order.id)).all()
            order.state="Concluída" if all(l.ordered_milli==l.received_milli for l in all_lines) else "Parcial"
            audit_func(db,company.id,user.id,"purchase.received","purchase",order.id,display(q))
            db.commit()
        return order_out(db,order)

    @app.post("/api/v2/counts",status_code=201)
    def open_count(payload:CountIn,ctx=Depends(require(*WRITE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            scoped(db,Warehouse,company.id,payload.warehouse_id,True)
            m=scoped(db,Material,company.id,payload.material_id,True)
            qty=qty_milli(payload.counted,m.unit,True)
            b=stock_balance(db,company.id,payload.warehouse_id,m.id)
            count=InventoryCount(company_id=company.id,warehouse_id=b.warehouse_id,
                                 material_id=m.id,expected_milli=b.on_hand_milli,
                                 counted_milli=qty,revision=b.revision,state="Pendente")
            db.add(count);db.flush()
            audit_func(db,company.id,user.id,"count.created","count",count.id)
            db.commit()
        return {"id":count.id,"state":count.state,"expected":display(count.expected_milli),
                "counted":display(count.counted_milli)}

    @app.get("/api/v2/counts")
    def list_counts(ctx=Depends(get_context),db:Session=Depends(db_session)):
        rows=db.scalars(select(InventoryCount).where(
            InventoryCount.company_id==ctx[1].id).order_by(InventoryCount.id.desc()).limit(500)).all()
        return [{"id":r.id,"warehouse_id":r.warehouse_id,"material_id":r.material_id,
                 "expected":display(r.expected_milli),"counted":display(r.counted_milli),
                 "state":r.state} for r in rows]

    @app.post("/api/v2/counts/{count_id}/approve")
    def approve_count(count_id:str,payload:ConfirmCountIn,
                      ctx=Depends(require(*MANAGE_ROLES)),db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            count=scoped(db,InventoryCount,company.id,count_id)
            if count.state!="Pendente":raise HTTPException(409,"Contagem já tratada.")
            b=stock_balance(db,company.id,count.warehouse_id,count.material_id)
            if b.revision!=count.revision or b.on_hand_milli!=count.expected_milli:
                raise HTTPException(409,"Stock alterado desde a contagem. Recontar.")
            if count.counted_milli<b.reserved_milli:
                raise HTTPException(409,"Contagem inferior às reservas ativas.")
            delta=count.counted_milli-b.on_hand_milli
            op=add_operation(db,user,company.id,payload.request_id,"Acerto",count.id)
            if delta:move(db,op,b,delta)
            count.state="Aplicada"
            audit_func(db,company.id,user.id,"count.approved","count",count.id,display(delta))
            db.commit()
        return {"id":count.id,"state":count.state,"adjustment":display(delta)}

    @app.post("/api/v2/counts/{count_id}/reject")
    def reject_count(count_id:str,ctx=Depends(require(*MANAGE_ROLES)),
                     db:Session=Depends(db_session)):
        user,company,_=ctx
        with mutation(db,company.id):
            count=scoped(db,InventoryCount,company.id,count_id)
            if count.state!="Pendente":raise HTTPException(409,"Contagem já tratada.")
            count.state="Rejeitada"
            audit_func(db,company.id,user.id,"count.rejected","count",count.id)
            db.commit()
        return {"id":count.id,"state":count.state}
