"""Protected material photographs for the Phase 2 inventory API.

Uploads are validated and rewritten to metadata-free WEBP outside public assets.
A photograph is a user-supplied asset, never guessed from a material SKU.
Production requires object storage, migrations, quotas, scanning and retention policy.
"""
from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import hashlib
import os
import uuid

from fastapi import Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from PIL import Image, ImageOps, UnidentifiedImageError
from sqlalchemy import ForeignKey, String, DateTime, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .main import Base, audit, utcnow
from .operations import Material

MAX_UPLOAD_BYTES = 4 * 1024 * 1024
MAX_PIXELS = 12_000_000
MAX_DIMENSION = 1400
Image.MAX_IMAGE_PIXELS = MAX_PIXELS


class MaterialPhoto(Base):
    __tablename__ = "material_photos"
    __table_args__ = (UniqueConstraint("company_id", "material_id", name="uq_material_photo_tenant"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), nullable=False, index=True)
    material_id: Mapped[str] = mapped_column(ForeignKey("materials.id"), nullable=False, index=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


def clean_photo(blob: bytes) -> bytes:
    if not blob or len(blob) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Imagem vazia ou maior do que 4 MB.")
    try:
        with Image.open(BytesIO(blob)) as original:
            if original.format not in ("JPEG", "PNG", "WEBP"):
                raise HTTPException(415, "Apenas fotografias JPG, PNG ou WEBP.")
            width, height = original.size
            if width <= 0 or height <= 0 or width * height > MAX_PIXELS:
                raise HTTPException(413, "Imagem com resolução excessiva.")
            original.verify()
        with Image.open(BytesIO(blob)) as original:
            image = ImageOps.exif_transpose(original)
            image.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.Resampling.LANCZOS)
            if image.mode in ("RGBA", "LA") or "transparency" in image.info:
                rgba = image.convert("RGBA")
                clean = Image.new("RGB", rgba.size, "white")
                clean.paste(rgba, mask=rgba.getchannel("A"))
            else:
                clean = image.convert("RGB")
            out = BytesIO()
            clean.save(out, format="WEBP", quality=84, method=4)
            return out.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(415, "Imagem inválida ou formato não suportado.") from None


def root_dir() -> Path:
    return Path(os.environ.get("STOCKCONTROL_MEDIA_ROOT", "stockcontrol-media")).resolve()


def photo_path(company_id: str, material_id: str) -> Path:
    # IDs originate from UUIDs in the database, not arbitrary supplied paths.
    return root_dir() / str(uuid.UUID(company_id)) / (str(uuid.UUID(material_id)) + ".webp")


def install_media(app, db_session, get_context, require):
    def get_material(db: Session, company_id: str, material_id: str):
        material = db.scalar(select(Material).where(
            Material.company_id == company_id, Material.id == material_id))
        if material is None:
            raise HTTPException(404, "Material não encontrado nesta empresa.")
        return material

    @app.get("/api/v2/materials/{material_id}/photo")
    def get_photo(material_id: str, ctx=Depends(get_context),
                  db: Session = Depends(db_session)):
        company_id = ctx[1].id
        get_material(db, company_id, material_id)
        record = db.scalar(select(MaterialPhoto).where(
            MaterialPhoto.company_id == company_id, MaterialPhoto.material_id == material_id))
        if record is None:
            raise HTTPException(404, "Material ainda sem fotografia.")
        path = photo_path(company_id, material_id)
        if not path.is_file():
            raise HTTPException(404, "Ficheiro da fotografia indisponível.")
        return FileResponse(path, media_type="image/webp",
                            headers={"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"})

    @app.post("/api/v2/materials/{material_id}/photo")
    async def upload_photo(material_id: str, file: UploadFile = File(...),
                           ctx=Depends(require("Administrador", "Gestor")),
                           db: Session = Depends(db_session)):
        user, company, _ = ctx
        get_material(db, company.id, material_id)
        blob = await file.read(MAX_UPLOAD_BYTES + 1)
        await file.close()
        transformed = clean_photo(blob)
        path = photo_path(company.id, material_id)
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_name(path.stem + "." + uuid.uuid4().hex + ".tmp")
        try:
            with temp.open("wb") as output:
                output.write(transformed)
            os.replace(temp, path)
        finally:
            temp.unlink(missing_ok=True)
        record = db.scalar(select(MaterialPhoto).where(
            MaterialPhoto.company_id == company.id, MaterialPhoto.material_id == material_id))
        digest = hashlib.sha256(transformed).hexdigest()
        if record is None:
            record = MaterialPhoto(company_id=company.id, material_id=material_id, sha256=digest)
            db.add(record)
        else:
            record.sha256 = digest
            record.updated_at = utcnow()
        audit(db, company.id, user.id, "material.photo_uploaded", "material", material_id)
        db.commit()
        return {"material_id": material_id, "has_photo": True, "content_type": "image/webp"}

    @app.delete("/api/v2/materials/{material_id}/photo")
    def delete_photo(material_id: str, ctx=Depends(require("Administrador", "Gestor")),
                     db: Session = Depends(db_session)):
        user, company, _ = ctx
        get_material(db, company.id, material_id)
        record = db.scalar(select(MaterialPhoto).where(
            MaterialPhoto.company_id == company.id, MaterialPhoto.material_id == material_id))
        if record is None:
            raise HTTPException(404, "Material sem fotografia.")
        db.delete(record)
        audit(db, company.id, user.id, "material.photo_deleted", "material", material_id)
        db.commit()
        photo_path(company.id, material_id).unlink(missing_ok=True)
        return {"ok": True}
