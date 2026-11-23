# Stage 01 — architecture baseline (review required)
Canonical runtime: backend.phase1.main:app, /admin, /api/v1 and /api/v2. V3–V9 under portal_php/public/assets are offline prototypes, not deployment artifacts. Never import browser demo data automatically. Preserve existing API contracts and database records.
## Inventory and traceability
| Area | Evidence | Status |
|---|---|---|
| Authentication, company, users, warehouses, audit | backend/phase1/main.py; tests/test_phase1_api.py | implemented, execution pending |
| Materials, balances, QR, movements, transfers, reservations, purchases, counts | backend/phase1/operations.py; tests/test_phase2_api.py | implemented, execution pending |
| Private photos | backend/phase1/media.py; tests/test_phase2_media.py | local storage, production hardening pending |
| Authenticated UI | backend/phase1/static; tests/test_phase2_browser.py | integration validation pending |
| Offline UI | portal_php/public/assets/design-v3 through design-v9 (where present) | reference only |
| Platform admin, granular permissions, billing | future stages | not implemented |
## Risks
P0: no verified production migration path; no real PostgreSQL concurrency evidence; process-local login throttling; no MFA; no tested encrypted restore.
P1: conflicting historical README claims; integer columns may overflow PostgreSQL INTEGER for quantities/costs allowed by API; photo filesystem and DB writes not atomic; bounded client-side collections.
## Deployment contract
PostgreSQL is production target; SQLite remains development only. Private media must not be served as public static assets. No production deployment until migration, security and recovery gates pass. Preserve existing data and rehearse upgrades on a copy. Do not stamp an existing database without schema equivalence checks.
## Stage gate
Full branch/PR inventory, dependency audit, explicit versioned migrations, existing-data upgrade rehearsal, PostgreSQL concurrency tests and browser execution remain pending. This document is not evidence that those checks passed.
