"""
Configuración central del Sistema POS.
Lee variables desde el archivo .env usando pydantic-settings.

NOTA: Este archivo fue reconstruido/mejorado. Los nombres de campo coinciden
(case-insensitive) con las claves de tu .env, por lo que es 100% compatible.
"""
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Base de Datos ─────────────────────────────────────────────
    database_url: str = "postgresql://postgres:postgres@localhost:5432/pos_pollo"

    # ── Seguridad JWT ─────────────────────────────────────────────
    secret_key: str = "CAMBIA_ESTO_POR_UNA_CLAVE_ALEATORIA_SEGURA_DE_64_CHARS"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # ── Archivos subidos (comprobantes) ───────────────────────────
    upload_dir: str = "./uploads"

    # ── App ───────────────────────────────────────────────────────
    app_name: str = "Sistema POS - Pollo & Salchipapas"
    debug: bool = True

    # ── QR estático de pago (imagen del negocio) ──────────────────
    static_qr_path: str = "./uploads/qr_pago.png"

    # ── CORS ──────────────────────────────────────────────────────
    # Coma-separado. "*" permite cualquier origen (modo desarrollo).
    # En producción, poner los dominios reales:
    #   CORS_ORIGINS=https://mi-pos.com,https://caja.mi-pos.com
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Ignora claves del .env que no estén declaradas aquí
    )

    @property
    def cors_origins_list(self) -> List[str]:
        """Convierte la cadena CORS_ORIGINS en una lista limpia."""
        raw = (self.cors_origins or "").strip()
        if raw in ("", "*"):
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Devuelve una instancia cacheada de Settings (una sola lectura del .env)."""
    return Settings()
