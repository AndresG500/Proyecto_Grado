from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from enum import Enum

class EstadoAlerta(str, Enum):
    ACTIVA    = "activa"
    ATENDIDA  = "atendida"   # Un cuidador marcó "voy en camino"
    RESUELTA  = "resuelta"   # El paciente volvió a la zona segura

class CrearAlerta(BaseModel):
    paciente_id: str = Field(...)
    grupo_id:    str = Field(...)
    coordenadas: dict = Field(..., description="Última ubicación del paciente al salir de la zona")
    zona_nombre: str = Field(..., description="Nombre de la zona segura que abandonó")

class RespuestaAlerta(BaseModel):
    id:              str = Field(...)
    paciente_id:     str = Field(...)
    grupo_id:        str = Field(...)
    coordenadas:     dict = Field(...)
    zona_nombre:     str = Field(...)
    estado:          EstadoAlerta = Field(...)
    atendida_por:    Optional[str] = Field(None, description="ID del cuidador que atendió")
    created_at:      datetime = Field(...)
    ultima_notif:    datetime = Field(..., description="Última vez que se envió la notificación")

    class Config:
        from_attributes = True

class AtenderAlerta(BaseModel):
    cuidador_id: str = Field(..., description="Cuidador que marca voy en camino")