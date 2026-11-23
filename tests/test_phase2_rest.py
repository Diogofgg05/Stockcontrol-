"""Regression coverage for the Phase 2.2 operational administration UX APIs."""
from test_phase2_api import e, op


def test_supplier_edit_status_and_tenant_isolation(e):
    c, app, a, b, wa, wb, m, part, supplier, post, auth = e
    sid = supplier["id"]
    updated = c.patch("/api/v2/suppliers/"+sid, headers=a,
        json={"name":"Faptech Industrial", "email":"compras@faptech.pt"})
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "Faptech Industrial"
    assert updated.json()["email"] == "compras@faptech.pt"
    assert c.patch("/api/v2/suppliers/"+sid, headers=a,
        json={"email":"invalid address"}).status_code == 422
    assert c.patch("/api/v2/suppliers/"+sid, headers=a,
        json={"name":"    "}).status_code == 422
    assert c.patch("/api/v2/suppliers/"+sid, headers=b,
        json={"name":"Access from B"}).status_code == 404
    assert c.get("/api/v2/suppliers", headers=b).json() == []
    assert c.patch("/api/v2/suppliers/"+sid, headers=a,
        json={"active": False}).status_code == 200
    assert c.post("/api/v2/purchase-orders",headers=a,json={
        "code":"PO-INACTIVE","supplier_id":sid,"warehouse_id":wa,
        "items":[{"material_id":m["id"],"quantity":"2"}]}).status_code == 404
    assert c.patch("/api/v2/suppliers/"+sid, headers=a,
        json={"active": True}).status_code == 200
    assert any(ev["action"]=="supplier.updated" for ev in c.get("/api/v1/audit", headers=a).json())


def test_supplier_cannot_be_disabled_with_pending_purchase(e):
    c, app, a, b, wa, wb, m, part, supplier, post, auth = e
    order=post("/purchase-orders",{
        "code":"PO-SUPPLIER-01","supplier_id":supplier["id"],"warehouse_id":wa,
        "items":[{"material_id":m["id"],"quantity":"4"},{"material_id":part["id"],"quantity":"2"}]})
    sid=supplier["id"]
    assert c.patch("/api/v2/suppliers/"+sid,headers=a,json={"active":False}).status_code==409
    for i,line in enumerate(order["lines"]):
        resp=c.post("/api/v2/purchase-orders/"+order["id"]+"/receive",headers=a,json={
            "line_id":line["id"],"quantity":line["ordered"],
            "request_id":"SUP-RECEIVE-000"+str(i+1)})
        assert resp.status_code==200, resp.text
    assert c.patch("/api/v2/suppliers/"+sid,headers=a,json={"active":False}).status_code==200


def test_supplier_edit_forbidden_to_operator(e):
    c, app, a, b, wa, wb, m, part, supplier, post, auth = e
    u=c.post("/api/v1/users",headers=a,json={
        "name":"Operador", "email":"op@test.example","password":"StrongOperatorPassword456",
        "role":"Operador"})
    assert u.status_code==201
    token=auth(email="op@test.example",password="StrongOperatorPassword456")
    assert c.patch("/api/v2/suppliers/"+supplier["id"],headers=token,
        json={"name":"Forbidden change"}).status_code==403


def test_audit_action_entity_pagination_scoped(e):
    c, app, a, b, wa, wb, m, part, supplier, post, auth = e
    post("/movements",op(wa,m["id"],"Entrada","5","AUDIT-OP-22222"))
    c.patch("/api/v2/suppliers/"+supplier["id"],headers=a,json={"name":"New Name"})
    res=c.get("/api/v1/audit?action=supplier.updated&target_type=supplier",headers=a)
    assert res.status_code==200,res.text
    assert len(res.json())==1
    assert res.json()[0]["target_id"]==supplier["id"]
    assert c.get("/api/v1/audit?action=supplier.updated&target_type=material",headers=a).json()==[]
    assert c.get("/api/v1/audit?action=supplier.updated&target_type=supplier",headers=b).json()==[]
    assert c.get("/api/v1/audit?action=supplier.updated&target_type=supplier&offset=1",headers=a).json()==[]
    assert c.get("/api/v1/audit?action=invalid!",headers=a).status_code==422
    assert c.get("/api/v1/audit?target_type=bad%2Fvalue",headers=a).status_code==422


def test_warehouse_edits_preserve_inventory_and_scope(e):
    c, app, a, b, wa, wb, m, part, supplier, post, auth = e
    post("/movements",op(wa,m["id"],"Entrada","3","WH-RENAME-STOCK-001"))
    resp=c.patch("/api/v1/warehouses/"+wa,headers=a,json={
        "name":"Armazém reorganizado", "location":"Aveiro - Zona B"})
    assert resp.status_code==200,resp.text
    assert resp.json()["name"]=="Armazém reorganizado"
    assert c.get("/api/v2/balances",headers=a).json()[0]["on_hand"]=="3"
    assert c.patch("/api/v1/warehouses/"+wb,headers=a,json={"name":"Forbidden"}).status_code==404
