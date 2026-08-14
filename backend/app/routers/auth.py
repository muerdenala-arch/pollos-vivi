from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Usuario
from ..schemas import Token, UsuarioCreate, UsuarioResponse
from ..services.auth_service import (
    verify_password, create_access_token, hash_password,
    get_current_user, require_admin
)

router = APIRouter(prefix="/api/v1/auth", tags=["Autenticación"])


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(
        Usuario.username == form_data.username,
        Usuario.activo == True
    ).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
    token = create_access_token(data={"sub": user.username, "rol": user.rol.value})
    return Token(access_token=token, token_type="bearer", rol=user.rol.value, nombre=user.nombre)


@router.post("/usuarios", response_model=UsuarioResponse, dependencies=[Depends(require_admin)])
def crear_usuario(data: UsuarioCreate, db: Session = Depends(get_db)):
    """Solo administradores pueden crear usuarios."""
    existing = db.query(Usuario).filter(Usuario.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="El username ya existe")
    user = Usuario(
        nombre=data.nombre,
        username=data.username,
        hashed_password=hash_password(data.password),
        rol=data.rol
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UsuarioResponse)
def get_me(current_user: Usuario = Depends(get_current_user)):
    return current_user
