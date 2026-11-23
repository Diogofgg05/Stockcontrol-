"""Regression tests for Phase 1 API: sessions, RBAC, tenancy and audit."""
import hashlib
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.phase1.main import (
    AuthSession, AuditEvent, Base, Company, User, Warehouse,
    create_app, provision_company, utcnow,
)

PASSWORD = "ExamplePassword12345"
OTHER = "DifferentPassword9876"


@pytest.fixture
def scenario(tmp_path):
    app = create_app(database_url="sqlite:///" + str(tmp_path / "stockcontrol.db"),
                     setup_key="local-setup-secret-only-for-tests")
    with TestClient(app) as client:
        init = client.post("/api/v1/setup", headers={"X-Setup-Key": "local-setup-secret-only-for-tests"},
                           json={"company_code": "AECT", "company_name": "Fábrica A",
                                 "admin_name": "Admin A", "admin_email": "admin@a.example",
                                 "admin_password": PASSWORD})
        assert init.status_code == 201, init.text
        org_a = init.json()["company"]
        with app.state.SessionLocal() as db:
            org_b = provision_company(db, "BETA", "Fábrica B", "Indústria",
                                      "Admin B", "admin@b.example", OTHER)
            org_b_id = org_b.id
        def login(code="AECT", email="admin@a.example", password=PASSWORD):
            res = client.post("/api/v1/auth/login",
                              json={"company_code": code, "email": email, "password": password})
            assert res.status_code == 200, res.text
            return {"Authorization": "Bearer " + res.json()["access_token"]}
        yield client, app, org_a, org_b_id, login


def test_setup_is_not_open_and_can_only_be_run_once(tmp_path):
    app = create_app(database_url="sqlite:///" + str(tmp_path / "setup.db"), setup_key="secret")
    with TestClient(app) as c:
        payload = {"company_code": "AECT", "company_name": "AECT", "admin_name": "Admin",
                   "admin_email": "admin@a.example", "admin_password": PASSWORD}
        assert c.post("/api/v1/setup", json=payload).status_code == 403
        assert c.post("/api/v1/setup", headers={"X-Setup-Key": "bad"}, json=payload).status_code == 403
        assert c.post("/api/v1/setup", headers={"X-Setup-Key": "secret"}, json=payload).status_code == 201
        assert c.post("/api/v1/setup", headers={"X-Setup-Key": "secret"}, json=payload).status_code == 409


def test_login_logout_and_revocation(scenario):
    c, app, company, other_id, login = scenario
    assert c.get("/api/v1/auth/me").status_code == 401
    assert c.post("/api/v1/auth/login", json={
        "company_code": "AECT", "email": "admin@a.example", "password": "wrong"}).status_code == 401
    auth = login()
    me = c.get("/api/v1/auth/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["company"]["id"] == company["id"]
    assert "password_hash" not in str(me.json())
    assert c.post("/api/v1/auth/logout", headers=auth).status_code == 200
    assert c.get("/api/v1/auth/me", headers=auth).status_code == 401


def test_user_role_enforcement_and_self_demote_last_admin(scenario):
    c, app, company, other_id, login = scenario
    admin = login()
    user = c.post("/api/v1/users", headers=admin, json={
        "name": "Operador 1", "email": "ops@a.example", "role": "Operador",
        "password": OTHER})
    assert user.status_code == 201, user.text
    uid = user.json()["id"]
    operator = login(email="ops@a.example", password=OTHER)
    assert c.get("/api/v1/users", headers=operator).status_code == 403
    assert c.get("/api/v1/audit", headers=operator).status_code == 403
    assert c.get("/api/v1/warehouses", headers=operator).status_code == 200
    assert c.post("/api/v1/warehouses", headers=operator, json={
        "code": "ARM-02", "name": "Secundário", "location": "Aveiro"}).status_code == 403
    assert c.patch("/api/v1/users/" + uid, headers=operator, json={"role":"Administrador"}).status_code == 403
    own_id = c.get("/api/v1/auth/me", headers=admin).json()["user"]["id"]
    assert c.patch("/api/v1/users/"+own_id,headers=admin,json={"role":"Auditor"}).status_code == 409
    assert c.patch("/api/v1/users/"+own_id,headers=admin,json={"active":False}).status_code == 409
    # Grant a second administrator, then demote the first; new role enforced on next call.
    assert c.patch("/api/v1/users/"+uid,headers=admin,json={"role":"Administrador"}).status_code == 200
    assert c.patch("/api/v1/users/"+own_id,headers=admin,json={"role":"Auditor"}).status_code == 200
    assert c.post("/api/v1/users", headers=admin, json={
        "name":"Not allowed", "email":"no@a.example", "role":"Operador","password":OTHER}).status_code == 403


def test_tenant_isolation_for_users_warehouses_and_audit(scenario):
    c, app, company, other_id, login = scenario
    a=login();b=login("BETA","admin@b.example",OTHER)
    buser=c.get("/api/v1/auth/me",headers=b).json()["user"]["id"]
    bw=c.get("/api/v1/warehouses",headers=b).json()[0]["id"]
    assert c.patch("/api/v1/users/"+buser,headers=a,json={"role":"Operador"}).status_code == 404
    assert c.patch("/api/v1/warehouses/"+bw,headers=a,json={"active":False}).status_code == 404
    assert all(user["id"] != buser for user in c.get("/api/v1/users",headers=a).json())
    # Company B actions must not appear in company A audit logs.
    created=c.post("/api/v1/warehouses",headers=b,json={
        "code":"B-WH-02", "name":"B sec", "location":"Leiria"})
    assert created.status_code == 201
    audit_a=c.get("/api/v1/audit",headers=a).json()
    audit_b=c.get("/api/v1/audit",headers=b).json()
    assert all(ev["target_id"]!=created.json()["id"] for ev in audit_a)
    assert any(ev["target_id"]==created.json()["id"] for ev in audit_b)


def test_warehouses_unique_per_tenant_last_active_and_manager(scenario):
    c, app, company, other_id, login=scenario
    a=login()
    wh=c.get("/api/v1/warehouses",headers=a).json()
    assert len(wh)==1
    assert c.patch("/api/v1/warehouses/"+wh[0]["id"],headers=a,json={"active":False}).status_code==409
    new=c.post("/api/v1/warehouses",headers=a,json={
        "code":"ARM-02","name":"Secundário","location":"Porto"})
    assert new.status_code==201
    assert c.post("/api/v1/warehouses",headers=a,json={
        "code":"ARM-02","name":"Duplicado","location":"Porto"}).status_code==409
    assert c.patch("/api/v1/warehouses/"+wh[0]["id"],headers=a,json={"active":False}).status_code==200
    manager=c.post("/api/v1/users",headers=a,json={
        "name":"Gestor A", "email":"manager@a.example","password":OTHER,"role":"Gestor"})
    assert manager.status_code==201
    g=login(email="manager@a.example",password=OTHER)
    assert c.post("/api/v1/warehouses",headers=g,json={
        "code":"ARM-03","name":"Outros","location":"Porto"}).status_code==201
    assert c.patch("/api/v1/company",headers=g,json={
        "name":"Não pode","sector":"Indústria"}).status_code==403


def test_reset_password_invalidates_sessions_and_never_leaks_secret(scenario):
    c, app, company, other_id, login=scenario
    a=login()
    user=c.post("/api/v1/users",headers=a,json={
        "name":"Pessoa", "email":"pessoa@a.example","role":"Auditor","password":OTHER}).json()
    aud=login(email="pessoa@a.example",password=OTHER)
    assert c.get("/api/v1/audit",headers=aud).status_code==200
    resp=c.post("/api/v1/users/"+user["id"]+"/reset-password",headers=a,json={
        "password":"NewLongPassword1234"})
    assert resp.status_code==200
    assert c.get("/api/v1/auth/me",headers=aud).status_code==401
    assert c.post("/api/v1/auth/login",json={
        "company_code":"AECT","email":"pessoa@a.example","password":OTHER}).status_code==401
    assert c.post("/api/v1/auth/login",json={
        "company_code":"AECT","email":"pessoa@a.example","password":"NewLongPassword1234"}).status_code==200
    audit=c.get("/api/v1/audit",headers=a).json()
    assert any(ev["action"]=="user.password_reset" for ev in audit)
    assert "NewLongPassword1234" not in str(audit)
    assert OTHER not in str(audit)


def test_sessions_expire_and_inactive_account_is_blocked(scenario):
    c,app,company,other_id,login=scenario
    a=login()
    token=a["Authorization"].split(" ",1)[1]
    with app.state.SessionLocal() as db:
        sess=db.get(AuthSession, hashlib.sha256(token.encode()).hexdigest())
        sess.expires_at=utcnow()-timedelta(seconds=10)
        db.commit()
    assert c.get("/api/v1/auth/me",headers=a).status_code==401


def test_hardening_headers_and_payload_validation(scenario):
    c,app,company,other_id,login=scenario
    a=login()
    assert c.get("/admin").status_code==200
    assert "default-src 'none'" in c.get("/admin").headers["content-security-policy"]
    assert c.get("/api/v1/users",headers=a).headers["cache-control"]=="no-store"
    assert c.post("/api/v1/users",headers=a,json={
        "name":"abc", "email":"invalid-email", "role":"Administrador",
        "password":"longEnough123"}).status_code==422
    assert c.post("/api/v1/users",headers=a,json={
        "name":"abc", "email":"x@example.com", "role":"root",
        "password":"longEnough123"}).status_code==422
    assert c.get("/api/v1/audit?limit=200",headers=a).status_code==422


def test_rate_limit_failed_logins(scenario):
    c,app,company,other_id,login=scenario
    payload={"company_code":"AECT","email":"admin@a.example","password":"WrongPassword123"}
    for _ in range(5):
        assert c.post("/api/v1/auth/login",json=payload).status_code==401
    assert c.post("/api/v1/auth/login",json=payload).status_code==429
