"""
Router de Pagos — Flujos: QR estático, Efectivo, y Comprobante manual.
"""
import os
import uuid
import shutil
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Pedido, Pago, EstadoPedido, EstadoPago, MetodoPago
from ..schemas import PagoEfectivoRequest, PagoResponse, QRPagoResponse
from ..services.auth_service import require_cajero
from ..services.qr_service import build_qr_response
from ..services.ws_manager import manager
from ..config import get_settings

settings = get_settings()
router = APIRouter(prefix="/api/v1/pagos", tags=["Cobros y Pagos"])


def _obtener_pedido_pendiente(pedido_id: int, db: Session) -> Pedido:
    pedido = db.query(Pedido).filter(Pedido.id == pedido_id).first()
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
    if pedido.estado != EstadoPedido.PENDIENTE:
        raise HTTPException(status_code=400, detail=f"El pedido ya está en estado: {pedido.estado.value}")
    return pedido


@router.post("/qr/{pedido_id}", response_model=QRPagoResponse)
def iniciar_pago_qr(
    pedido_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    """
    Inicia el flujo de pago QR.
    Retorna la URL del QR estático del negocio (Yape/Plin/BCP) y el total a pagar.
    La pantalla del cliente mostrará este QR.
    """
    pedido = _obtener_pedido_pendiente(pedido_id, db)

    # Registrar intento de pago QR
    pago = Pago(
        pedido_id=pedido.id,
        monto=pedido.total,
        metodo=MetodoPago.QR,
        estado=EstadoPago.PENDIENTE,
        transaccion_id=f"QR-{pedido_id}-{uuid.uuid4().hex[:8].upper()}"
    )
    pedido.metodo_pago = MetodoPago.QR
    db.add(pago)
    db.commit()

    qr_data = build_qr_response(pedido.id, pedido.total)
    return QRPagoResponse(
        pedido_id=pedido.id,
        total=pedido.total,
        qr_image_url=qr_data["qr_image_url"]
    )


@router.post("/efectivo/{pedido_id}", response_model=PagoResponse)
async def registrar_pago_efectivo(
    pedido_id: int,
    data: PagoEfectivoRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    """Registra un pago en efectivo y marca el pedido como PAGADO."""
    pedido = _obtener_pedido_pendiente(pedido_id, db)

    if Decimal(str(data.monto_recibido)) < pedido.total:
        raise HTTPException(
            status_code=400,
            detail=f"Monto insuficiente. Total: Bs. {pedido.total:.2f}"
        )

    pago = Pago(
        pedido_id=pedido.id,
        monto=pedido.total,
        metodo=MetodoPago.EFECTIVO,
        estado=EstadoPago.COMPLETADO,
        transaccion_id=f"EFE-{pedido_id}-{uuid.uuid4().hex[:8].upper()}"
    )
    pedido.estado = EstadoPedido.PAGADO
    pedido.metodo_pago = MetodoPago.EFECTIVO
    db.add(pago)
    db.commit()
    db.refresh(pago)

    # Notificar en tiempo real al frontend del cajero
    background_tasks.add_task(
        manager.broadcast,
        {"evento": "pago_completado", "pedido_id": pedido_id, "metodo": "Efectivo"}
    )

    return pago


@router.post("/comprobante/{pedido_id}", response_model=PagoResponse)
async def subir_comprobante(
    pedido_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_cajero)
):
    """
    Flujo de contingencia: sube imagen de comprobante físico (JPG/PNG).
    La URL se guarda en PostgreSQL. Marcar pago como completado manual.
    """
    pedido = _obtener_pedido_pendiente(pedido_id, db)

    # Validar tipo de archivo
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(status_code=400, detail="Solo se aceptan imágenes JPG o PNG")

    # Guardar archivo
    upload_path = Path(settings.upload_dir) / "comprobantes"
    upload_path.mkdir(parents=True, exist_ok=True)
    filename = f"comprobante_{pedido_id}_{uuid.uuid4().hex[:8]}.{file.content_type.split('/')[-1]}"
    file_path = upload_path / filename

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    comprobante_url = f"/uploads/comprobantes/{filename}"

    pago = Pago(
        pedido_id=pedido.id,
        monto=pedido.total,
        metodo=MetodoPago.QR,
        estado=EstadoPago.COMPLETADO,
        transaccion_id=f"COMP-{pedido_id}-{uuid.uuid4().hex[:8].upper()}"
    )
    pedido.estado = EstadoPedido.PAGADO
    pedido.comprobante_url = comprobante_url
    db.add(pago)
    db.commit()
    db.refresh(pago)

    background_tasks.add_task(
        manager.broadcast,
        {"evento": "pago_completado", "pedido_id": pedido_id, "metodo": "Comprobante"}
    )

    return pago
