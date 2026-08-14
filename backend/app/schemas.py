"""
Esquemas Pydantic — Validación y serialización de datos del Sistema POS.
Separados en Request (entrada) y Response (salida) para máxima seguridad.
"""
from decimal import Decimal
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator

from .models import RolUsuario, EstadoPedido, MetodoPago, EstadoPago


# ─── Auth / Usuarios ──────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str


class UsuarioCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    rol: RolUsuario = RolUsuario.CAJERO


class UsuarioResponse(BaseModel):
    id: int
    nombre: str
    username: str
    rol: RolUsuario
    activo: bool

    model_config = {"from_attributes": True}


class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    rol: Optional[RolUsuario] = None
    activo: Optional[bool] = None


class PasswordUpdate(BaseModel):
    nueva_password: str = Field(..., min_length=6)


# ─── Categorías ───────────────────────────────────────────────────────────────


class CategoriaCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    descripcion: Optional[str] = None


class CategoriaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    descripcion: Optional[str] = None
    activo: Optional[bool] = None


class CategoriaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str]
    activo: bool

    model_config = {"from_attributes": True}


# ─── Presas ───────────────────────────────────────────────────────────────────

class PresaCreate(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=50)
    recargo: Decimal = Field(default=Decimal("0.00"), ge=0)


class PresaUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=50)
    recargo: Optional[Decimal] = Field(None, ge=0)
    activo: Optional[bool] = None


class PresaResponse(BaseModel):
    id: int
    nombre: str
    recargo: Decimal
    activo: bool

    model_config = {"from_attributes": True}


# ─── Productos ────────────────────────────────────────────────────────────────

class ProductoCreate(BaseModel):
    categoria_id: int
    nombre: str = Field(..., min_length=2, max_length=150)
    precio_base: Decimal = Field(..., ge=0)
    requiere_presa: bool = False
    presa_ids: List[int] = []  # IDs de presas disponibles para este producto


class ProductoUpdate(BaseModel):
    categoria_id: Optional[int] = None
    nombre: Optional[str] = Field(None, min_length=2, max_length=150)
    precio_base: Optional[Decimal] = Field(None, ge=0)
    requiere_presa: Optional[bool] = None
    activo: Optional[bool] = None
    presa_ids: Optional[List[int]] = None


class ProductoResponse(BaseModel):
    id: int
    categoria_id: int
    nombre: str
    precio_base: Decimal
    requiere_presa: bool
    activo: bool
    categoria: CategoriaResponse
    presas_disponibles: List[PresaResponse] = []

    model_config = {"from_attributes": True}


class ProductoSimple(BaseModel):
    """Versión simplificada para el POS (sin relaciones anidadas complejas)."""
    id: int
    nombre: str
    precio_base: Decimal
    requiere_presa: bool
    categoria_id: int

    model_config = {"from_attributes": True}


# ─── Pedidos ──────────────────────────────────────────────────────────────────

class ItemCarrito(BaseModel):
    """Un ítem en el carrito al crear un pedido."""
    producto_id: int
    presa_id: Optional[int] = None
    cantidad: int = Field(..., ge=1, le=99)


class PedidoCreate(BaseModel):
    items: List[ItemCarrito] = Field(..., min_length=1)


class DetallePedidoResponse(BaseModel):
    id: int
    producto_id: int
    presa_id: Optional[int]
    cantidad: int
    precio_unitario: Decimal
    subtotal: Decimal
    nombre_producto_snapshot: str
    nombre_presa_snapshot: Optional[str]

    model_config = {"from_attributes": True}


class PedidoResponse(BaseModel):
    id: int
    estado: EstadoPedido
    metodo_pago: Optional[MetodoPago]
    total: Decimal
    comprobante_url: Optional[str]
    creado_en: datetime
    detalles: List[DetallePedidoResponse] = []

    model_config = {"from_attributes": True}


class PedidoEstadoUpdate(BaseModel):
    estado: EstadoPedido


# ─── Pagos ────────────────────────────────────────────────────────────────────

class PagoEfectivoRequest(BaseModel):
    monto_recibido: Decimal = Field(..., gt=0, description="Efectivo entregado por el cliente")


class PagoResponse(BaseModel):
    id: int
    pedido_id: int
    monto: Decimal
    metodo: MetodoPago
    estado: EstadoPago
    transaccion_id: Optional[str]
    creado_en: datetime

    model_config = {"from_attributes": True}


class QRPagoResponse(BaseModel):
    pedido_id: int
    total: Decimal
    qr_image_url: str  # URL a la imagen del QR estático


# ─── Webhook ──────────────────────────────────────────────────────────────────

class WebhookPayload(BaseModel):
    transaccion_id: str
    pedido_id: int
    estado_pago: str  # "SUCCESS" | "FAILED"
    monto: Decimal


# ─── Reportes ─────────────────────────────────────────────────────────────────

class ResumenVentasResponse(BaseModel):
    fecha: str
    total_pedidos: int
    pedidos_pagados: int
    pedidos_cancelados: int
    ingresos_total: Decimal
    ingresos_efectivo: Decimal
    ingresos_qr: Decimal

# ─── Configuración ──────────────────────────────────────────────────────────

class TicketConfig(BaseModel):
    nombre_local: str = Field(..., max_length=100)
    direccion: str = Field(..., max_length=200)
    telefono: str = Field(..., max_length=50)
    pie_pagina: str = Field(..., max_length=200)
    ancho_papel: str = Field(..., max_length=10)
