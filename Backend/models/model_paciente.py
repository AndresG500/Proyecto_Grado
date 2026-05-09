from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from enum import Enum
from utils.sanitizer import sanitize_string

class GeoPoint(BaseModel):
    latitud: float = Field(..., ge=-90.0, le=90.0)
    longitud: float = Field(..., ge=-180.0, le=180.0)
    recorded_at: datetime = Field(default_factory=datetime.utcnow)

class EstadoDispositivo(str, Enum):
    ONLINE  = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"

class PacienteBase(BaseModel):
    nombre_paciente: str = Field(..., min_length=2, max_length=100)
    edad_paciente: Optional[int] = Field(None, ge=0)
    enfermedad: Optional[str] = Field(None, max_length=500)
    fuera_de_zona: bool = False
    ultima_alerta_timestamp: Optional[datetime] = None

    @field_validator('nombre_paciente', 'enfermedad', mode='before')
    @classmethod
    def sanitize_fields(cls, v):
        if isinstance(v, str):
            return sanitize_string(v)
        return v

class CrearPaciente(PacienteBase):
    id_dispositivo: Optional[str] = Field(None)

class RespuestaPaciente(PacienteBase):
    id_paciente: str = Field(...)
    id_cuidador: str = Field(...)
    id_dispositivo: Optional[str] = Field(None)
    grupo_ids: list[str] = Field(default_factory=list)
    ultima_ubicacion: Optional[GeoPoint] = Field(None)
    estado_dispositivo: Optional[EstadoDispositivo] = Field(None)
    created_at: datetime = Field(...)
    activo: bool = Field(True)

    class Config:
        from_attributes = True

class ActualizarPaciente(BaseModel):
    nombre_paciente: Optional[str] = Field(None, min_length=2, max_length=100)
    edad_paciente: Optional[int] = Field(None, ge=0)
    enfermedad: Optional[str] = Field(None, max_length=500)
    id_dispositivo: Optional[str] = Field(None)

class ActualizarUbicacion(BaseModel):
    patient_id: str = Field(...)
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    device_id: Optional[str] = Field(None)
    recorded_at: datetime = Field(default_factory=datetime.utcnow)