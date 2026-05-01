from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from security.jwt_handler import verificar_token
from database.database import get_database

# ─── Configuración ───────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/cuidadores/verificar")


# ─── Dependencia principal ───────────────────────────────────────────────────
async def get_cuidador_actual(token: str = Depends(oauth2_scheme)):
    credenciales_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1. Verificar token
    token_data = verificar_token(token)
    if token_data is None:
        raise credenciales_exception

    # 2. Buscar cuidador en la base de datos
    db = get_database()
    cuidador = await db["Cuidadores"].find_one(
        {"email": token_data["email"]},
        {"password": 0}  # nunca retornar el hash
    )

    if cuidador is None:
        raise credenciales_exception

    return cuidador