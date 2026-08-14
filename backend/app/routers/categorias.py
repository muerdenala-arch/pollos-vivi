from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Categoria
from ..schemas import CategoriaCreate, CategoriaUpdate, CategoriaResponse
from ..services.auth_service import require_admin, require_cajero

router = APIRouter(prefix="/api/v1/categorias", tags=["Catálogo — Categorías"])


@router.get("/", response_model=List[CategoriaResponse])
def listar_categorias(
    solo_activas: bool = True,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    q = db.query(Categoria)
    if solo_activas:
        q = q.filter(Categoria.activo == True)
    return q.order_by(Categoria.nombre).all()


@router.post("/", response_model=CategoriaResponse, status_code=status.HTTP_201_CREATED)
def crear_categoria(data: CategoriaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    existing = db.query(Categoria).filter(Categoria.nombre == data.nombre).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
    cat = Categoria(**data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{categoria_id}", response_model=CategoriaResponse)
def actualizar_categoria(
    categoria_id: int,
    data: CategoriaUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    cat = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(cat, field, value)
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(categoria_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    cat = db.query(Categoria).filter(Categoria.id == categoria_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    # Soft delete — no eliminamos físicamente para preservar historial
    cat.activo = False
    db.commit()
