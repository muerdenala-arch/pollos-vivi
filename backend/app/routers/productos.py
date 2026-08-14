from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload, selectinload

from ..database import get_db
from ..models import Producto, Presa, ProductoPresa, Categoria
from ..schemas import (
    ProductoCreate, ProductoUpdate, ProductoResponse, PresaCreate, PresaUpdate, PresaResponse
)
from ..services.auth_service import require_admin, require_cajero

router = APIRouter(prefix="/api/v1", tags=["Catálogo — Productos y Presas"])


# ─── Presas ───────────────────────────────────────────────────────────────────

@router.get("/presas", response_model=List[PresaResponse])
def listar_presas(solo_activas: bool = True, db: Session = Depends(get_db), _=Depends(require_cajero)):
    q = db.query(Presa)
    if solo_activas:
        q = q.filter(Presa.activo == True)
    return q.order_by(Presa.nombre).all()


@router.post("/presas", response_model=PresaResponse, status_code=status.HTTP_201_CREATED)
def crear_presa(data: PresaCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    presa = Presa(**data.model_dump())
    db.add(presa)
    db.commit()
    db.refresh(presa)
    return presa


@router.put("/presas/{presa_id}", response_model=PresaResponse)
def actualizar_presa(presa_id: int, data: PresaUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    presa = db.query(Presa).filter(Presa.id == presa_id).first()
    if not presa:
        raise HTTPException(status_code=404, detail="Presa no encontrada")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(presa, field, value)
    db.commit()
    db.refresh(presa)
    return presa


# ─── Productos ────────────────────────────────────────────────────────────────

@router.get("/productos", response_model=List[ProductoResponse])
def listar_productos(
    categoria_id: int = None,
    solo_activos: bool = True,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    q = db.query(Producto).options(
        joinedload(Producto.categoria),
        selectinload(Producto.presas_disponibles)
    )
    if solo_activos:
        q = q.filter(Producto.activo == True)
    if categoria_id:
        q = q.filter(Producto.categoria_id == categoria_id)
    return q.order_by(Producto.nombre).all()


@router.get("/productos/{producto_id}", response_model=ProductoResponse)
def obtener_producto(producto_id: int, db: Session = Depends(get_db), _=Depends(require_cajero)):
    producto = db.query(Producto).options(
        joinedload(Producto.categoria),
        selectinload(Producto.presas_disponibles)
    ).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.post("/productos", response_model=ProductoResponse, status_code=status.HTTP_201_CREATED)
def crear_producto(data: ProductoCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    categoria = db.query(Categoria).filter(Categoria.id == data.categoria_id, Categoria.activo == True).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada o inactiva")

    presa_ids = data.presa_ids
    producto_data = data.model_dump(exclude={"presa_ids"})
    producto = Producto(**producto_data)
    db.add(producto)
    db.flush()  # Obtener ID sin commit

    # Asociar presas
    if presa_ids:
        presas = db.query(Presa).filter(Presa.id.in_(presa_ids)).all()
        if len(presas) != len(presa_ids):
            raise HTTPException(status_code=400, detail="Una o más presas no existen")
        producto.presas_disponibles = presas

    db.commit()
    db.refresh(producto)
    return db.query(Producto).options(
        joinedload(Producto.categoria),
        selectinload(Producto.presas_disponibles)
    ).filter(Producto.id == producto.id).first()


@router.put("/productos/{producto_id}", response_model=ProductoResponse)
def actualizar_producto(
    producto_id: int,
    data: ProductoUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    update_data = data.model_dump(exclude_none=True, exclude={"presa_ids"})
    for field, value in update_data.items():
        setattr(producto, field, value)

    if data.presa_ids is not None:
        presas = db.query(Presa).filter(Presa.id.in_(data.presa_ids)).all()
        producto.presas_disponibles = presas

    db.commit()
    return db.query(Producto).options(
        joinedload(Producto.categoria),
        selectinload(Producto.presas_disponibles)
    ).filter(Producto.id == producto.id).first()


@router.delete("/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(producto_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    producto = db.query(Producto).filter(Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    producto.activo = False  # Soft delete
    db.commit()
