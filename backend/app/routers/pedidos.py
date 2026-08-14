"""
Router de Pedidos — Core del POS.
Incluye creación con cálculo de precios desde BD (congelados en detalle),
listado con filtros y actualización de estado.

OPTIMIZADO:
- Creación de pedido sin consultas N+1 (se traen todos los productos/presas
  en 2 consultas en bloque en lugar de 2 por cada ítem del carrito).
- selectinload en colecciones (detalles) en lugar de joinedload, para evitar
  multiplicación de filas y resultados incorrectos al combinar con .limit().
"""
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Pedido, DetallePedido, Producto, Presa, EstadoPedido
from ..schemas import PedidoCreate, PedidoResponse, PedidoEstadoUpdate
from ..services.auth_service import require_cajero, require_admin, get_current_user
from ..models import Usuario

router = APIRouter(prefix="/api/v1/pedidos", tags=["Pedidos"])


@router.post("/", response_model=PedidoResponse, status_code=status.HTTP_201_CREATED)
def crear_pedido(
    data: PedidoCreate,
    db: Session = Depends(get_db),
    current_user: Usuario = Depends(require_cajero)
):
    """
    Crea un nuevo pedido calculando los precios DESDE LA BASE DE DATOS.
    Los precios se congelan en DetallePedido para integridad histórica.
    Un cajero NO puede manipular los precios desde el frontend.
    """
    # ── 1. Traer TODOS los productos y presas necesarios en bloque (sin N+1) ──
    producto_ids = {item.producto_id for item in data.items}
    presa_ids = {item.presa_id for item in data.items if item.presa_id}

    productos = {
        p.id: p for p in db.query(Producto).filter(
            Producto.id.in_(producto_ids),
            Producto.activo == True
        ).all()
    }
    presas = {
        pr.id: pr for pr in db.query(Presa).filter(
            Presa.id.in_(presa_ids),
            Presa.activo == True
        ).all()
    } if presa_ids else {}

    # ── 2. Validar y construir el pedido ──
    pedido = Pedido(cajero_id=current_user.id, total=Decimal("0.00"))
    db.add(pedido)
    db.flush()  # Obtener ID

    total_pedido = Decimal("0.00")
    detalles: List[DetallePedido] = []

    for item in data.items:
        producto = productos.get(item.producto_id)
        if not producto:
            db.rollback()
            raise HTTPException(
                status_code=404,
                detail=f"Producto ID {item.producto_id} no encontrado o inactivo"
            )

        precio_unitario = Decimal(str(producto.precio_base))
        nombre_presa = None

        if item.presa_id:
            if not producto.requiere_presa:
                db.rollback()
                raise HTTPException(
                    status_code=400,
                    detail=f"El producto '{producto.nombre}' no admite selección de presa"
                )
            presa = presas.get(item.presa_id)
            if not presa:
                db.rollback()
                raise HTTPException(
                    status_code=404,
                    detail=f"Presa ID {item.presa_id} no encontrada"
                )
            precio_unitario += Decimal(str(presa.recargo))
            nombre_presa = presa.nombre
        elif producto.requiere_presa:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail=f"El producto '{producto.nombre}' requiere seleccionar una presa"
            )

        subtotal = precio_unitario * item.cantidad
        total_pedido += subtotal

        detalles.append(DetallePedido(
            pedido_id=pedido.id,
            producto_id=producto.id,
            presa_id=item.presa_id,
            cantidad=item.cantidad,
            precio_unitario=precio_unitario,   # CONGELADO
            subtotal=subtotal,
            nombre_producto_snapshot=producto.nombre,  # SNAPSHOT
            nombre_presa_snapshot=nombre_presa
        ))

    db.add_all(detalles)
    pedido.total = total_pedido
    db.commit()

    return db.query(Pedido).options(
        selectinload(Pedido.detalles)
    ).filter(Pedido.id == pedido.id).first()


@router.get("/", response_model=List[PedidoResponse])
def listar_pedidos(
    estado: Optional[EstadoPedido] = None,
    limite: int = 50,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    q = db.query(Pedido).options(selectinload(Pedido.detalles))
    if estado:
        q = q.filter(Pedido.estado == estado)
    return q.order_by(Pedido.creado_en.desc()).limit(limite).all()


@router.get("/{pedido_id}", response_model=PedidoResponse)
def obtener_pedido(pedido_id: int, db: Session = Depends(get_db), _=Depends(require_cajero)):
    pedido = db.query(Pedido).options(
        selectinload(Pedido.detalles)
    ).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    return pedido


@router.patch("/{pedido_id}/estado", response_model=PedidoResponse)
def actualizar_estado_pedido(
    pedido_id: int,
    data: PedidoEstadoUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    pedido.estado = data.estado
    db.commit()
    return db.query(Pedido).options(
        selectinload(Pedido.detalles)
    ).filter(Pedido.id == pedido_id).first()
