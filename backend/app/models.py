"""
Modelos ORM SQLAlchemy — Sistema POS Pollo & Salchipapas
Relacional estricto, listo para PostgreSQL en la nube.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index,
    Integer, Numeric, String, Text, CheckConstraint
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ─── Enumeraciones ────────────────────────────────────────────────────────────

class RolUsuario(str, enum.Enum):
    ADMIN = "admin"
    CAJERO = "cajero"


class EstadoPedido(str, enum.Enum):
    PENDIENTE = "Pendiente"
    PAGADO = "Pagado"
    PREPARANDO = "Preparando"
    ENTREGADO = "Entregado"
    CANCELADO = "Cancelado"


class MetodoPago(str, enum.Enum):
    EFECTIVO = "Efectivo"
    QR = "QR"


class EstadoPago(str, enum.Enum):
    PENDIENTE = "Pendiente"
    COMPLETADO = "Completado"
    FALLIDO = "Fallido"
    ANULADO = "Anulado"


# ─── Modelos ──────────────────────────────────────────────────────────────────

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    rol = Column(Enum(RolUsuario), nullable=False, default=RolUsuario.CAJERO)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())


class Categoria(Base):
    __tablename__ = "categorias"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    productos = relationship("Producto", back_populates="categoria", cascade="all, delete-orphan")


class Producto(Base):
    __tablename__ = "productos"

    id = Column(Integer, primary_key=True, index=True)
    categoria_id = Column(Integer, ForeignKey("categorias.id", ondelete="RESTRICT"), nullable=False, index=True)
    nombre = Column(String(150), nullable=False)
    precio_base = Column(Numeric(10, 2), nullable=False, default=0.00)
    requiere_presa = Column(Boolean, default=False)  # True para productos de pollo
    activo = Column(Boolean, default=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    categoria = relationship("Categoria", back_populates="productos")
    # Presas disponibles para este producto
    presas_disponibles = relationship("Presa", secondary="producto_presas", back_populates="productos")


class Presa(Base):
    __tablename__ = "presas"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False, unique=True)  # Pierna, Pecho, Ala, Mixto
    recargo = Column(Numeric(10, 2), nullable=False, default=0.00)
    activo = Column(Boolean, default=True)

    productos = relationship("Producto", secondary="producto_presas", back_populates="presas_disponibles")


class ProductoPresa(Base):
    """Tabla de asociación Producto ↔ Presa (qué presas admite cada producto)."""
    __tablename__ = "producto_presas"

    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True)
    presa_id = Column(Integer, ForeignKey("presas.id", ondelete="CASCADE"), primary_key=True)


class Pedido(Base):
    __tablename__ = "pedidos"

    id = Column(Integer, primary_key=True, index=True)
    cajero_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True, index=True)
    estado = Column(Enum(EstadoPedido), default=EstadoPedido.PENDIENTE, nullable=False, index=True)
    metodo_pago = Column(Enum(MetodoPago), nullable=True)  # Se asigna al cobrar
    total = Column(Numeric(12, 2), nullable=False, default=0.00)
    comprobante_url = Column(String(500), nullable=True)  # Foto comprobante fallback
    creado_en = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    actualizado_en = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Índice compuesto para los reportes (filtro por estado + rango de fecha)
    __table_args__ = (
        Index("idx_pedidos_estado_fecha", "estado", "creado_en"),
    )

    cajero = relationship("Usuario")
    detalles = relationship("DetallePedido", back_populates="pedido", cascade="all, delete-orphan")
    pagos = relationship("Pago", back_populates="pedido", cascade="all, delete-orphan")


class DetallePedido(Base):
    """
    Línea de detalle de un pedido.
    Los precios se CONGELAN al momento de crear el pedido
    para preservar la integridad histórica ante futuros cambios de precios.
    """
    __tablename__ = "detalle_pedidos"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, index=True)
    producto_id = Column(Integer, ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False, index=True)
    presa_id = Column(Integer, ForeignKey("presas.id", ondelete="RESTRICT"), nullable=True, index=True)
    cantidad = Column(Integer, nullable=False)
    precio_unitario = Column(Numeric(10, 2), nullable=False)  # Precio congelado (base + recargo)
    subtotal = Column(Numeric(12, 2), nullable=False)
    nombre_producto_snapshot = Column(String(200), nullable=False)  # Snapshot nombre producto
    nombre_presa_snapshot = Column(String(100), nullable=True)       # Snapshot nombre presa

    __table_args__ = (
        CheckConstraint("cantidad > 0", name="check_cantidad_positiva"),
    )

    pedido = relationship("Pedido", back_populates="detalles")
    producto = relationship("Producto")
    presa = relationship("Presa")


class Pago(Base):
    __tablename__ = "pagos"

    id = Column(Integer, primary_key=True, index=True)
    pedido_id = Column(Integer, ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False, index=True)
    monto = Column(Numeric(12, 2), nullable=False)
    metodo = Column(Enum(MetodoPago), nullable=False)
    estado = Column(Enum(EstadoPago), default=EstadoPago.PENDIENTE)
    transaccion_id = Column(String(255), unique=True, index=True, nullable=True)
    creado_en = Column(DateTime(timezone=True), server_default=func.now())

    pedido = relationship("Pedido", back_populates="pagos")
