"""
Servicio de QR de pago.

Modelo de negocio: el administrador sube UNA imagen QR estática (Yape/Plin/BCP/
transferencia) que se muestra al cliente junto con el total a pagar. La
confirmación real llega por webhook de la pasarela o por comprobante manual.

NOTA: Este archivo fue reconstruido/mejorado a partir del uso que hace
routers/pagos.py -> build_qr_response(pedido_id, total) -> {"qr_image_url": ...}.
Verifica que la ruta del QR coincida con tu configuración (STATIC_QR_PATH en .env).
"""
from decimal import Decimal
from pathlib import Path

from ..config import get_settings

settings = get_settings()


def _qr_public_url() -> str:
    """
    Convierte la ruta local del QR (STATIC_QR_PATH) en una URL pública
    servida bajo /uploads. Si el archivo no existe, igual devuelve la URL
    esperada para que el frontend muestre un placeholder controlado.
    """
    qr_path = Path(settings.static_qr_path)
    # El nombre del archivo se sirve desde el montaje estático /uploads
    filename = qr_path.name or "qr_pago.png"
    return f"/uploads/{filename}"


def qr_exists() -> bool:
    """Indica si la imagen del QR estático está disponible en disco."""
    return Path(settings.static_qr_path).exists()


def build_qr_response(pedido_id: int, total: Decimal) -> dict:
    """
    Construye la información del QR de pago para un pedido.
    Devuelve un dict compatible con el schema QRPagoResponse.
    """
    return {
        "pedido_id": pedido_id,
        "total": total,
        "qr_image_url": _qr_public_url(),
        "qr_disponible": qr_exists(),
    }
