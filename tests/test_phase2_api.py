"""Phase 2 regression: real tenant-scoped inventory, purchases, reservations, counts and QR."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.phase1.main import create_app, provision_company

PASSWORD="StrongAdminPassword123"
OP_PASSWORD="StrongOperatorPassword456"


@pytest.fixture()
def e(tmp_path):
    app=create_app(database_url="sqlite:///"+str(tmp_path/"phase2.db"),setup_key="test-secret")
    with TestClient(app) as client:
        c=client
        init=c.post("/api/v1/setup",headers={"X-Setup-Key":"test-secret"},json={
            "company_code":"AECT","company_name":"Fábrica AECT",
            "admin_name":"Admin AECT","admin_email":"admin@aect.example",
            "admin_password":PASSWORD})
        assert init.status_code==201,init.text
        with app.state.SessionLocal() as db:
            provision_company(db,"BETA","Fábrica Beta","Indústria",
                              "Admin Beta","admin@beta.example",PASSWORD)
        def auth(code="AECT",email="admin@aect.example",password=PASSWORD):
            response=c.post("/api/v1/auth/login",json={
                "company_code":code,"email":email,"password":password})
            assert response.status_code==200,response.text
            return {"Authorization":"Bearer "+response.json()["access_token"]}
        a=auth()
        b=auth("BETA","admin@beta.example")
        wa=c.get("/api/v1/warehouses",headers=a).json()[0]["id"]
        wb=c.get("/api/v1/warehouses",headers=b).json()[0]["id"]
        def post(path,data,headers=a,expected=201):
            r=c.post("/api/v2"+path,json=data,headers=headers)
            assert r.status_code==expected,(path,r.status_code,r.text)
            return r.json()
        m=post("/materials",{"sku":"CAB-01","name":"Cabo industrial","category":"Elétrico",
                             "unit":"m","minimum":"4.5","unit_cost":"1.35"})
        part=post("/materials",{"sku":"CON-01","name":"Conector 4 pinos","category":"Elétrico",
                                "unit":"un","minimum":"5","unit_cost":"3.25"})
        supplier=post("/suppliers",{"code":"FAPTECH","name":"Faptech Demo"})
        yield c,app,a,b,wa,wb,m,part,supplier,post,auth


def op(warehouse_id,material_id,kind,quantity,request_id):
    return {"warehouse_id":warehouse_id,"material_id":material_id,
            "kind":kind,"quantity":quantity,"request_id":request_id}


def test_create_materials_scoped_to_tenant_and_role(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    assert c.get("/api/v2/materials",headers=a).status_code==200
    assert len(c.get("/api/v2/materials",headers=b).json())==0
    assert c.post("/api/v2/materials",headers=a,json={
        "sku":"CAB-01","name":"Duplicado","category":"Elétrico","unit":"m"}).status_code==409
    assert c.get("/api/v2/materials?warehouse_id="+wb,headers=a).status_code==404
    assert c.post("/api/v2/movements",headers=b,json=op(wa,m["id"],"Entrada","2","OTHER-COMPANY-1")).status_code==404
    add=c.post("/api/v1/users",headers=a,json={
        "name":"Operador","email":"ops@aect.example","password":OP_PASSWORD,"role":"Operador"})
    assert add.status_code==201
    operator=auth(email="ops@aect.example",password=OP_PASSWORD)
    assert c.post("/api/v2/materials",headers=operator,json={
        "sku":"NEW","name":"Novo material","category":"Elétrico","unit":"un"}).status_code==403
    assert c.get("/api/v2/materials",headers=operator).status_code==200
    assert c.post("/api/v2/suppliers",headers=operator,json={"code":"X1","name":"Fornecedor"}).status_code==403


def test_integer_precision_and_not_negative(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    assert c.post("/api/v2/movements",headers=a,json=op(wa,part["id"],"Entrada","0.5","IN-PIECES-01")).status_code==422
    assert c.post("/api/v2/movements",headers=a,json=op(wa,m["id"],"Entrada","1.0001","IN-PRECISION-01")).status_code==422
    assert c.post("/api/v2/movements",headers=a,json=op(wa,m["id"],"Saída","1","IN-EMPTY-01")).status_code==409
    post("/movements",op(wa,m["id"],"Entrada","20.125","IN-00000001"))
    assert c.post("/api/v2/movements",headers=a,json=op(wa,m["id"],"Saída","20.126","OUT-OVER-01")).status_code==409
    post("/movements",op(wa,m["id"],"Saída","0.125","OUT-00000001"))
    state=c.get("/api/v2/balances",headers=a).json()
    assert state[0]["on_hand"]=="20"
    assert state[0]["available"]=="20"


def test_double_request_never_double_counts(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    payload=op(wa,m["id"],"Entrada","8","REQUEST-IDE-001")
    post("/movements",payload)
    assert c.post("/api/v2/movements",headers=a,json=payload).status_code==409
    balance=c.get("/api/v2/balances",headers=a).json()[0]
    assert balance["on_hand"]=="8"
    assert len(c.get("/api/v2/movements",headers=a).json())==1


def test_reservations_partial_consumption_cancel_and_no_oversell(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    post("/movements",op(wa,m["id"],"Entrada","10","RES-STOCK-0001"))
    r=post("/reservations",{"warehouse_id":wa,"material_id":m["id"],"order_ref":"OP-101","quantity":"7"})
    assert r["state"]=="Ativa"
    assert c.post("/api/v2/movements",headers=a,json=op(wa,m["id"],"Saída","4","RES-OUT-00001")).status_code==409
    consumed=c.post("/api/v2/reservations/"+r["id"]+"/consume",headers=a,json={
        "quantity":"2.5","request_id":"RES-CONSUME-01"})
    assert consumed.status_code==200,consumed.text
    assert consumed.json()["remaining"]=="4.5"
    assert c.post("/api/v2/reservations/"+r["id"]+"/consume",headers=a,json={
        "quantity":"5","request_id":"RES-CONSUME-02"}).status_code==409
    bal=c.get("/api/v2/balances",headers=a).json()[0]
    assert bal["on_hand"]=="7.5"
    assert bal["reserved"]=="4.5"
    cancel=c.post("/api/v2/reservations/"+r["id"]+"/cancel",headers=a)
    assert cancel.status_code==200
    assert cancel.json()["state"]=="Cancelada"
    bal=c.get("/api/v2/balances",headers=a).json()[0]
    assert bal["reserved"]=="0"
    assert bal["on_hand"]=="7.5"
    assert c.post("/api/v2/reservations/"+r["id"]+"/cancel",headers=a).status_code==409


def test_full_reserved_consumption_closes_and_logs(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    post("/movements",op(wa,part["id"],"Entrada","10","PART-START-01"))
    r=post("/reservations",{"warehouse_id":wa,"material_id":part["id"],"order_ref":"OP-102","quantity":"4"})
    result=c.post("/api/v2/reservations/"+r["id"]+"/consume",headers=a,json={
        "quantity":"4","request_id":"CONSUME-ALL-01"})
    assert result.status_code==200
    assert result.json()["state"]=="Concluída"
    assert result.json()["remaining"]=="0"
    assert any(v["kind"]=="Consumo" for v in c.get("/api/v2/movements",headers=a).json())


def test_transfer_two_sided_ledger_and_foreign_warehouse(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    second=c.post("/api/v1/warehouses",headers=a,json={
        "code":"SEC-02","name":"Armazém secundário","location":"Porto"}).json()["id"]
    post("/movements",op(wa,m["id"],"Entrada","9","MOVE-START-001"))
    p={"from_warehouse_id":wa,"to_warehouse_id":second,
       "material_id":m["id"],"quantity":"5","request_id":"TRANSFER-0001"}
    assert c.post("/api/v2/transfers",headers=a,json={**p,"to_warehouse_id":wb}).status_code==404
    res=c.post("/api/v2/transfers",headers=a,json=p)
    assert res.status_code==201,res.text
    balances=c.get("/api/v2/balances",headers=a).json()
    assert {v["warehouse_id"]:v["on_hand"] for v in balances}=={wa:"4",second:"5"}
    assert len(c.get("/api/v2/movements",headers=a).json())==3
    assert c.post("/api/v2/transfers",headers=a,json=p).status_code==409


def test_suppliers_orders_partial_receipts_and_validation(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    data={"code":"PO-001","supplier_id":sup["id"],"warehouse_id":wa,
          "items":[{"material_id":m["id"],"quantity":"5"},
                   {"material_id":part["id"],"quantity":"3"}]}
    po=post("/purchase-orders",data)
    assert po["state"]=="Aberta"
    assert c.post("/api/v2/purchase-orders",headers=a,json=data).status_code==409
    assert c.post("/api/v2/purchase-orders",headers=b,json={**data,"code":"PO-B"}).status_code==404
    first=po["lines"][0]
    partrec=c.post("/api/v2/purchase-orders/"+po["id"]+"/receive",headers=a,json={
        "line_id":first["id"],"quantity":"2","request_id":"RECEIVE-PART-01"})
    assert partrec.status_code==200,partrec.text
    assert partrec.json()["state"]=="Parcial"
    assert c.post("/api/v2/purchase-orders/"+po["id"]+"/receive",headers=a,json={
        "line_id":first["id"],"quantity":"4","request_id":"RECEIVE-OVER-01"}).status_code==409
    for line in partrec.json()["lines"]:
        missing=float(line["ordered"])-float(line["received"])
        if missing>0:
            receipt=c.post("/api/v2/purchase-orders/"+po["id"]+"/receive",headers=a,json={
                "line_id":line["id"],"quantity":str(missing),"request_id":"RECEIVE-"+line["id"]})
            assert receipt.status_code==200,receipt.text
    final=c.get("/api/v2/purchase-orders",headers=a).json()[0]
    assert final["state"]=="Concluída"
    assert c.get("/api/v2/balances",headers=a).status_code==200
    assert all(line["ordered"]==line["received"] for line in final["lines"])


def test_counts_stale_and_reservations_protected(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    post("/movements",op(wa,m["id"],"Entrada","12","COUNT-STOCK-0001"))
    r=post("/reservations",{"warehouse_id":wa,"material_id":m["id"],"order_ref":"OP-201","quantity":"9"})
    ct=post("/counts",{"warehouse_id":wa,"material_id":m["id"],"counted":"7"})
    assert c.post("/api/v2/counts/"+ct["id"]+"/approve",headers=a,json={
        "request_id":"COUNT-APPR-0001"}).status_code==409
    c.post("/api/v2/reservations/"+r["id"]+"/cancel",headers=a)
    assert c.post("/api/v2/counts/"+ct["id"]+"/approve",headers=a,json={
        "request_id":"COUNT-APPR-0002"}).status_code==409
    ct2=post("/counts",{"warehouse_id":wa,"material_id":m["id"],"counted":"7"})
    apply=c.post("/api/v2/counts/"+ct2["id"]+"/approve",headers=a,json={
        "request_id":"COUNT-APPR-0003"})
    assert apply.status_code==200,apply.text
    assert apply.json()["adjustment"]=="-5"
    assert c.get("/api/v2/balances",headers=a).json()[0]["on_hand"]=="7"
    assert c.post("/api/v2/counts/"+ct2["id"]+"/approve",headers=a,json={
        "request_id":"COUNT-APPR-0004"}).status_code==409


def test_qr_scoped_and_authenticated(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    svg=c.get("/api/v2/materials/"+m["id"]+"/qr.svg",headers=a)
    assert svg.status_code==200,svg.text[:300]
    assert "image/svg+xml" in svg.headers["content-type"]
    assert b"<svg" in svg.content
    assert c.get("/api/v2/materials/"+m["id"]+"/qr.svg",headers=b).status_code==404
    assert c.get("/api/v2/materials/"+m["id"]+"/qr.svg").status_code==401
    assert c.get("/api/v2/scan/"+m["qr_code"],headers=a).json()["sku"]=="CAB-01"
    assert c.get("/api/v2/scan/"+m["qr_code"],headers=b).status_code==404


def test_inventory_audit_and_supplier_tenant_isolation(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    post("/movements",op(wa,m["id"],"Entrada","3","AUDIT-STOCK-01"))
    history=c.get("/api/v1/audit",headers=a).json()
    assert any(row["action"]=="stock.entrada" for row in history)
    assert len(c.get("/api/v2/suppliers",headers=b).json())==0
    assert not any(x["target_id"]==m["id"] for x in c.get("/api/v1/audit",headers=b).json())


def test_cannot_disable_warehouse_with_stock_or_pending_order(e):
    c,app,a,b,wa,wb,m,part,sup,post,auth=e
    extra=c.post("/api/v1/warehouses",headers=a,json={
        "code":"AUX-002","name":"Armazém auxiliar","location":"Porto"})
    assert extra.status_code==201
    post("/movements",op(wa,m["id"],"Entrada","6","WH-INSIDE-001"))
    assert c.patch("/api/v1/warehouses/"+wa,headers=a,json={"active":False}).status_code==409
    transfer={"from_warehouse_id":wa,"to_warehouse_id":extra.json()["id"],
              "material_id":m["id"],"quantity":"6","request_id":"WH-TRANS-001"}
    assert c.post("/api/v2/transfers",headers=a,json=transfer).status_code==201
    po=post("/purchase-orders",{"code":"PO-PENDING-01","supplier_id":sup["id"],
        "warehouse_id":wa,"items":[{"material_id":part["id"],"quantity":"4"}]})
    assert po["state"]=="Aberta"
    assert c.patch("/api/v1/warehouses/"+wa,headers=a,json={"active":False}).status_code==409
    receipt=c.post("/api/v2/purchase-orders/"+po["id"]+"/receive",headers=a,json={
        "line_id":po["lines"][0]["id"],"quantity":"4","request_id":"WH-REC-001"})
    assert receipt.status_code==200
    assert c.patch("/api/v1/warehouses/"+wa,headers=a,json={"active":False}).status_code==409
