"""Real Chromium E2E checks for the independent Phase 1 admin console.

Runs only in CI/browser-enabled environments; test uses exclusively synthetic accounts.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
CAPTURES = ROOT / "tests" / "phase1-previews"
PASSWORD = "ExamplePassword12345"
WORKER_PASSWORD = "WorkerPassword987654"


def test_phase1_admin_browser(tmp_path):
    CAPTURES.mkdir(exist_ok=True)
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    env = os.environ.copy()
    env["STOCKCONTROL_DATABASE_URL"] = "sqlite:///" + str(tmp_path / "admin-browser.db")
    env["STOCKCONTROL_SETUP_KEY"] = "ci-only-phase1-setup"
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.phase1.main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.STDOUT,
    )
    try:
        for _ in range(100):
            try:
                if httpx.get(origin + "/api/v1/health", timeout=0.5).status_code == 200:
                    break
            except httpx.HTTPError:
                pass
            time.sleep(0.15)
        else:
            raise AssertionError("Backend failed to start")
        r = httpx.post(origin + "/api/v1/setup",
            headers={"X-Setup-Key": "ci-only-phase1-setup"},
            json={"company_code": "AECT", "company_name": "Fábrica AECT",
                  "admin_name": "Admin Demo", "admin_email": "admin@aect.example",
                  "admin_password": PASSWORD}, timeout=15)
        assert r.status_code == 201, r.text
        with sync_playwright() as pw:
            browser = pw.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1440, "height": 900})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda e: errors.append(str(e)))
            page.goto(origin + "/admin", wait_until="networkidle")
            page.screenshot(path=str(CAPTURES / "login-desktop.png"))
            page.locator('[name="company_code"]').fill("AECT")
            page.locator('[name="email"]').fill("admin@aect.example")
            page.locator('[name="password"]').fill(PASSWORD)
            page.locator("#login-form button[type=submit]").click()
            page.locator(".grid-metrics .metric").first.wait_for()
            page.screenshot(path=str(CAPTURES / "dashboard-desktop.png"))
            page.locator('[data-page="users"]').click()
            page.get_by_text("Equipa (1)").wait_for()
            page.screenshot(path=str(CAPTURES / "users-desktop.png"))
            page.locator('.edit-form [name="name"]').fill("Operador Demo")
            page.locator('.edit-form [name="email"]').fill("ops@aect.example")
            page.locator('.edit-form [name="password"]').fill(WORKER_PASSWORD)
            page.locator('.edit-form button[type="submit"]').click()
            page.get_by_text("Equipa (2)").wait_for()
            page.locator('[data-page="warehouses"]').click()
            page.get_by_text("Armazéns (1)").wait_for()
            page.locator('.edit-form [name="code"]').fill("ARM-02")
            page.locator('.edit-form [name="name"]').fill("Armazém secundário")
            page.locator('.edit-form [name="location"]').fill("Porto")
            page.locator('.edit-form button[type="submit"]').click()
            page.get_by_text("Armazéns (2)").wait_for()
            page.screenshot(path=str(CAPTURES / "warehouses-desktop.png"))
            page.locator('[data-page="audit"]').click()
            page.locator(".panel table tbody tr").first.wait_for()
            page.screenshot(path=str(CAPTURES / "audit-desktop.png"))
            assert errors == [], errors
            context.close()

            context = browser.new_context(viewport={"width": 390, "height": 844},
                                          device_scale_factor=1, is_mobile=True, has_touch=True)
            mobile = context.new_page()
            mobile.on("pageerror", lambda e: errors.append(str(e)))
            mobile.goto(origin + "/admin", wait_until="networkidle")
            mobile.screenshot(path=str(CAPTURES / "login-mobile.png"))
            mobile.locator('[name="company_code"]').fill("AECT")
            mobile.locator('[name="email"]').fill("admin@aect.example")
            mobile.locator('[name="password"]').fill(PASSWORD)
            mobile.locator('#login-form button[type=submit]').click()
            mobile.locator(".grid-metrics .metric").first.wait_for()
            mobile.screenshot(path=str(CAPTURES / "dashboard-mobile.png"))
            mobile.locator("#menu-toggle").click()
            mobile.locator('[data-page="users"]').click()
            mobile.get_by_text("Equipa (2)").wait_for()
            mobile.screenshot(path=str(CAPTURES / "users-mobile.png"))
            assert errors == [], errors
            assert mobile.evaluate(
                "() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1"
            ), "Mobile document has horizontal overflow"
            context.close()
            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
