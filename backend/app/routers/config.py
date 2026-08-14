"""
Router para la configuración global del sistema (ej. ticket de impresión).
"""
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException

from ..schemas import TicketConfig
from ..services.auth_service import require_admin, require_cajero

router = APIRouter(prefix="/api/v1/config", tags=["Configuración"])

CONFIG_FILE = Path("backend/data/ticket_config.json")

def _load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {
            "nombre_local": "Pollos Vivi",
            "direccion": "Av. Principal #123",
            "telefono": "70000000",
            "pie_pagina": "¡Gracias por su preferencia!",
            "ancho_papel": "58"
        }
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

@router.get("/ticket", response_model=TicketConfig)
def obtener_config_ticket(_=Depends(require_cajero)):
    """
    Obtiene la configuración del ticket. (Cajero puede leerlo para imprimir).
    """
    data = _load_config()
    return TicketConfig(**data)

@router.post("/ticket", response_model=TicketConfig)
def guardar_config_ticket(config: TicketConfig, _=Depends(require_admin)):
    """
    Guarda la configuración del ticket. (Solo admin).
    """
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)
    return config
