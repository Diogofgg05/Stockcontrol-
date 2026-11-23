"""Regression contract for the canonical authenticated application."""
from backend.phase1.main import create_app

def test_canonical_routes(tmp_path):
    app = create_app(database_url=f"sqlite:///{tmp_path / 'contract.db'}")
    routes = {(route.path, method) for route in app.routes
              for method in (getattr(route, "methods", None) or [])}
    required = {
        ("/admin", "GET"),
        ("/api/v1/auth/login", "POST"),
        ("/api/v1/auth/logout", "POST"),
        ("/api/v1/company", "GET"),
        ("/api/v1/users", "GET"),
        ("/api/v1/audit", "GET"),
        ("/api/v2/materials", "GET"),
        ("/api/v2/balances", "GET"),
        ("/api/v2/movements", "POST"),
        ("/api/v2/transfers", "POST"),
        ("/api/v2/reservations", "POST"),
        ("/api/v2/purchase-orders", "POST"),
        ("/api/v2/counts", "POST"),
        ("/api/v2/materials/{material_id}/photo", "GET"),
    }
    assert required <= routes
    app.state.engine.dispose()
