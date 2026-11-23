"""End-to-end desktop/mobile proof for Phase 2 authenticated inventory workflows."""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
CAPTURES=ROOT/"tests"/"phase2-previews"
PASSWORD="StrongExample123456"


def wait_backend(url):
    for _ in range(100):
        try:
            if httpx.get(url+"/api/v1/health",timeout=0.4).status_code==200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.12)
    raise AssertionError("API failed to start")


def login(page,origin):
    page.goto(origin+"/admin",wait_until="networkidle")
    page.locator('#login-form [name="company_code"]').fill("AECT")
    page.locator('#login-form [name="email"]').fill("admin@aect.example")
    page.locator('#login-form [name="password"]').fill(PASSWORD)
    page.locator('#login-form button[type="submit"]').click()
    page.locator("#dashboard-loaded-never").count()  # benign non-blocking readiness call
    page.locator(".grid-metrics .metric").first.wait_for(timeout=15000)


def test_phase2_browser_and_screenshots(tmp_path):
    CAPTURES.mkdir(parents=True,exist_ok=True)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0))
        port=sock.getsockname()[1]
    origin=f"http://127.0.0.1:{port}"
    env=os.environ.copy()
    env["STOCKCONTROL_DATABASE_URL"]="sqlite:///"+str(tmp_path/"phase2-browser.db")
    env["STOCKCONTROL_SETUP_KEY"]="test-internal"
    proc=subprocess.Popen([
        sys.executable,"-m","uvicorn","backend.phase1.main:app",
        "--host","127.0.0.1","--port",str(port)
    ],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
    try:
        wait_backend(origin)
        with httpx.Client(base_url=origin,timeout=10) as api:
            r=api.post("/api/v1/setup",headers={"X-Setup-Key":"test-internal"},json={
                "company_code":"AECT","company_name":"Fábrica AECT",
                "admin_name":"Administrador","admin_email":"admin@aect.example",
                "admin_password":PASSWORD})
            assert r.status_code==201,r.text
        with sync_playwright() as pw:
            browser=pw.chromium.launch(headless=True)
            context=browser.new_context(viewport={"width":1440,"height":900},device_scale_factor=1)
            page=context.new_page()
            errors=[]
            page.on("pageerror",lambda e: errors.append(str(e)))
            login(page,origin)
            page.screenshot(path=str(CAPTURES/"dashboard-desktop.png"))
            page.locator('[data-page="inventory"]').click()
            page.get_by_role("heading",name="Inventário real").wait_for()
            page.screenshot(path=str(CAPTURES/"inventory-empty-desktop.png"))
            form=page.locator('.edit-form').last
            form.locator('[name="sku"]').fill("CAB-001")
            form.locator('[name="name"]').fill("Cabo industrial 4 pinos")
            form.locator('[name="category"]').fill("Elétrico")
            form.locator('[name="minimum"]').fill("5")
            form.locator('[name="unit_cost"]').fill("2.15")
            form.locator('button[type="submit"]').click()
            page.get_by_text("CAB-001").first.wait_for()
            page.screenshot(path=str(CAPTURES/"inventory-desktop.png"))
            page.locator('[data-page="stockMovements"]').click()
            page.get_by_role("heading",name="Movimentos de stock").wait_for()
            form=page.locator('.edit-form').first
            form.locator('[name="quantity"]').fill("20")
            form.locator('button[type="submit"]').click()
            page.locator('.table-scroll tbody tr').first.wait_for()
            page.screenshot(path=str(CAPTURES/"movements-desktop.png"))
            page.locator('[data-page="suppliers"]').click()
            form=page.locator('.edit-form').first
            form.locator('[name="code"]').fill("FAP-001")
            form.locator('[name="name"]').fill("Fornecedor industrial")
            form.locator('button[type="submit"]').click()
            page.get_by_text("FAP-001").first.wait_for()
            page.screenshot(path=str(CAPTURES/"suppliers-desktop.png"))
            page.locator('[data-page="purchases"]').click()
            page.get_by_role("heading",name="Encomendas").wait_for()
            form=page.locator('.edit-form').first
            form.locator('[name="code"]').fill("PO-100")
            form.locator('[name="quantity"]').fill("12")
            form.locator('button[type="submit"]').click()
            page.get_by_text("PO-100").first.wait_for()
            page.screenshot(path=str(CAPTURES/"purchases-desktop.png"))
            page.locator('[data-page="reservations"]').click()
            page.get_by_role("heading",name="Reservas de produção").wait_for()
            form=page.locator('.edit-form').first
            form.locator('[name="order_ref"]').fill("OP-101")
            form.locator('[name="quantity"]').fill("4")
            form.locator('button[type="submit"]').click()
            page.get_by_text("OP-101").first.wait_for()
            page.screenshot(path=str(CAPTURES/"reservations-desktop.png"))
            page.locator('[data-page="counts"]').click()
            page.get_by_role("heading",name="Inventário físico").wait_for()
            form=page.locator('.edit-form').first
            form.locator('[name="counted"]').fill("20")
            form.locator('button[type="submit"]').click()
            page.get_by_text("Pendente").first.wait_for()
            page.screenshot(path=str(CAPTURES/"counts-desktop.png"))
            page.locator('[data-page="scanner"]').click()
            page.get_by_role("heading",name="Leitor de materiais").wait_for()
            page.screenshot(path=str(CAPTURES/"scanner-desktop.png"))
            assert errors==[],errors
            context.close()

            mobile_ctx=browser.new_context(viewport={"width":390,"height":844},
                                           device_scale_factor=1,is_mobile=True,has_touch=True)
            mobile=mobile_ctx.new_page()
            mobile_errors=[]
            mobile.on("pageerror",lambda e:mobile_errors.append(str(e)))
            login(mobile,origin)
            mobile.screenshot(path=str(CAPTURES/"dashboard-mobile.png"))
            mobile.locator('#menu-toggle').click()
            mobile.locator('[data-page="inventory"]').click()
            mobile.get_by_role("heading",name="Inventário real").wait_for()
            mobile.screenshot(path=str(CAPTURES/"inventory-mobile.png"))
            assert mobile.evaluate(
                "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"
            )
            assert mobile_errors==[],mobile_errors
            mobile_ctx.close()
            browser.close()
    finally:
        proc.terminate()
        try:proc.wait(timeout=5)
        except subprocess.TimeoutExpired:proc.kill()
