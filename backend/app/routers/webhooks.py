"""
Webhook para confirmación de pagos QR desde pasarela externa.
En producción, DEBE validarse la firma HMAC enviada por la pasarela.
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pago, Pedido, EstadoPago, EstadoPedido
from ..schemas import WebhookPayload
from ..services.ws_manager import manager

router = APIRouter(prefix="/api/v1/webhooks", tags=["Webhooks — Pasarela"])


@router.post("/pagos/qr")
async def webhook_confirmacion_qr(
    payload: WebhookPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    # x_firma: str = Header(None, alias="X-Firma-Pasarela"),  # Activar en producción
):
    """
    Endpoint de confirmación de pago QR recibido desde la pasarela de pagos.
    
    SEGURIDAD:
    - En producción, descomentar y validar el header X-Firma-Pasarela con HMAC-SHA256.
    - Implementar idempotencia: ignorar si transaccion_id ya fue procesado.
    
    FLUJO:
    1. Busca el pago por transaccion_id.
    2. Actualiza estado del pago.
    3. Actualiza estado del pedido a PAGADO.
    4. Emite evento WebSocket al frontend del cajero y pantalla del cliente.
    5. Responde 200 a la pasarela inmediatamente (evitar reintentos).
    """
    # Idempotencia: si ya está completado, no reprocesar
    pago = db.query(Pago).filter(Pago.transaccion_id == payload.transaccion_id).first()
    if not pago:
        raise HTTPException(status_code=404, detail="Transacción no registrada")

    if pago.estado == EstadoPago.COMPLETADO:
        return {"status": "ok", "message": "Transacción ya procesada (idempotente)"}

    # Actualizar pago y pedido de forma atómica
    if payload.estado_pago == "SUCCESS":
        pago.estado = EstadoPago.COMPLETADO
        pedido = db.query(Pedido).filter(Pedido.id == pago.pedido_id).first()
        if pedido:
            pedido.estado = EstadoPedido.PAGADO

        db.commit()

        # Notificar en tiempo real (se ejecuta en background sin bloquear la respuesta)
        ws_data = {
            "evento": "pago_completado",
            "pedido_id": pago.pedido_id,
            "metodo": "QR",
            "transaccion_id": payload.transaccion_id
        }
        background_tasks.add_task(manager.broadcast, ws_data)
        background_tasks.add_task(manager.notify_pedido, pago.pedido_id, ws_data)

    elif payload.estado_pago == "FAILED":
        pago.estado = EstadoPago.FALLIDO
        db.commit()
        background_tasks.add_task(
            manager.broadcast,
            {"evento": "pago_fallido", "pedido_id": pago.pedido_id}
        )

    return {"status": "ok"}
