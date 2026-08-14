"""
Router de Reportes — Resumen de ventas del día e historial de pedidos.
Solo accesible para Administradores.

OPTIMIZADO:
- Se filtra por RANGO de fechas (creado_en >= inicio AND < fin) en lugar de
  cast(creado_en, Date) == fecha. El cast anulaba el índice y forzaba a
  escanear toda la tabla; el rango sí usa el índice idx_pedidos_creado_en.
- Los totales se calculan con agregación SQL (SUM/COUNT/CASE) en lugar de
  traer todas las filas a memoria y sumarlas en Python.
- selectinload en el historial para colecciones (detalles).
"""
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, case
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import Pedido, Pago, EstadoPedido, MetodoPago, EstadoPago
from ..schemas import ResumenVentasResponse, PedidoResponse
from ..services.auth_service import require_admin

router = APIRouter(prefix="/api/v1/reportes", tags=["Reportes y Estadísticas"])


def _rango_dia(fecha: date):
    """Devuelve (inicio, fin) del día para filtrar por rango usando el índice."""
    inicio = datetime.combine(fecha, time.min)
    fin = inicio + timedelta(days=1)
    return inicio, fin


@router.get("/ventas/dia", response_model=ResumenVentasResponse)
def resumen_ventas_dia(
    fecha: Optional[date] = Query(default=None, description="Fecha (YYYY-MM-DD). Por defecto: hoy"),
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    """Resumen de ventas de un día específico (calculado íntegramente en SQL)."""
    if fecha is None:
        fecha = date.today()
    inicio, fin = _rango_dia(fecha)

    # ── Conteos e ingresos por estado, en UNA sola consulta agregada ──
    Z = Decimal("0.00")
    resumen = db.query(
        func.count(Pedido.id).label("total"),
        func.coalesce(
            func.sum(case((Pedido.estado == EstadoPedido.PAGADO, 1), else_=0)), 0
        ).label("pagados"),
        func.coalesce(
            func.sum(case((Pedido.estado == EstadoPedido.CANCELADO, 1), else_=0)), 0
        ).label("cancelados"),
        func.coalesce(
            func.sum(case((Pedido.estado == EstadoPedido.PAGADO, Pedido.total), else_=0)), 0
        ).label("ingresos"),
    ).filter(
        Pedido.creado_en >= inicio,
        Pedido.creado_en < fin,
    ).one()

    # ── Ingresos por método de pago (pagos completados), agregado en SQL ──
    pagos = db.query(
        func.coalesce(
            func.sum(case((Pago.metodo == MetodoPago.EFECTIVO, Pago.monto), else_=0)), 0
        ).label("efectivo"),
        func.coalesce(
            func.sum(case((Pago.metodo == MetodoPago.QR, Pago.monto), else_=0)), 0
        ).label("qr"),
    ).join(Pedido, Pago.pedido_id == Pedido.id).filter(
        Pedido.creado_en >= inicio,
        Pedido.creado_en < fin,
        Pago.estado == EstadoPago.COMPLETADO,
    ).one()

    return ResumenVentasResponse(
        fecha=str(fecha),
        total_pedidos=int(resumen.total or 0),
        pedidos_pagados=int(resumen.pagados or 0),
        pedidos_cancelados=int(resumen.cancelados or 0),
        ingresos_total=Decimal(str(resumen.ingresos or Z)),
        ingresos_efectivo=Decimal(str(pagos.efectivo or Z)),
        ingresos_qr=Decimal(str(pagos.qr or Z)),
    )


@router.get("/pedidos/historial", response_model=List[PedidoResponse])
def historial_pedidos(
    fecha_inicio: Optional[date] = None,
    fecha_fin: Optional[date] = None,
    estado: Optional[EstadoPedido] = None,
    limite: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _=Depends(require_admin)
):
    """Historial de pedidos con filtros de fecha y estado (por rango, indexado)."""
    q = db.query(Pedido).options(selectinload(Pedido.detalles))
    if fecha_inicio:
        q = q.filter(Pedido.creado_en >= datetime.combine(fecha_inicio, time.min))
    if fecha_fin:
        # fin inclusivo: hasta el final del día indicado
        q = q.filter(Pedido.creado_en < datetime.combine(fecha_fin, time.min) + timedelta(days=1))
    if estado:
        q = q.filter(Pedido.estado == estado)
    return q.order_by(Pedido.creado_en.desc()).limit(limite).all()
