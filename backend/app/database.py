from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from .config import get_settings

settings = get_settings()

# psycopg v3: reemplazar "postgresql://" por "postgresql+psycopg://"
# si la URL viene con psycopg2, la convertimos automáticamente
_db_url = settings.database_url
if _db_url.startswith("postgresql://") and "+psycopg" not in _db_url:
    _db_url = _db_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    _db_url,
    pool_pre_ping=True,   # Verifica conexión antes de usar del pool
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,    # Recicla conexiones cada 30 min (evita cortes por inactividad)
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """Dependency injection para obtener sesión de BD en cada request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
