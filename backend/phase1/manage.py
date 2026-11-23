"""Trusted terminal provisioning: passwords are never provided via CLI arguments."""
from __future__ import annotations

import argparse
import getpass
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from .main import Base, provision_company


def main():
    parser = argparse.ArgumentParser(description="StockControl Phase 1 administration")
    commands = parser.add_subparsers(dest="command", required=True)
    provision = commands.add_parser("provision", help="Create a company with first administrator")
    provision.add_argument("--code", required=True)
    provision.add_argument("--name", required=True)
    provision.add_argument("--sector", default="Indústria")
    provision.add_argument("--admin-name", required=True)
    provision.add_argument("--admin-email", required=True)
    args = parser.parse_args()
    if args.command == "provision":
        password = getpass.getpass("Nova palavra-passe administrativa (12+ caracteres): ")
        confirmation = getpass.getpass("Confirmar palavra-passe: ")
        if password != confirmation:
            raise SystemExit("As palavras-passe não coincidem.")
        url = os.environ.get("STOCKCONTROL_DATABASE_URL", "sqlite:///./stockcontrol-phase1.db")
        engine = create_engine(url)
        Base.metadata.create_all(engine)  # Development only; migration tooling not shipped.
        with Session(engine) as db:
            try:
                company = provision_company(db, args.code, args.name, args.sector,
                                            args.admin_name, args.admin_email, password)
            except ValueError as exc:
                raise SystemExit(str(exc)) from exc
            print("Empresa criada:", company.code, "ID:", company.id)


if __name__ == "__main__":
    main()
