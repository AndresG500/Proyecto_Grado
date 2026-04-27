from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum

class GeoPoint(BaseModel):
    """Representa una coordenada geográfica."""
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)

class LocalizationEntry(BaseModel):
    """Una entrada del historial de ubicaciones."""
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    recorded_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp de cuándo se registró esta ubicación")

class EstadoDispositivo(str, Enum):
    """Estado de conexión del dispositivo ESP32."""
    ONLINE  = "online"
    OFFLINE = "offline"
    UNKNOWN = "unknown"

class PacienteBase(BaseModel):
    nombre_paciente: str = Field(..., min_length=2, max_length=100, description="Nombre completo del paciente")
    edad_paciente: Optional[int] = Field(None, ge=0, description="Edad del paciente")
    enfermedad: Optional[str] = Field(None, max_length=500, description="Observaciones clínicas o personales del cuidador")

class CrearPaciente(PacienteBase):
    id_cuidador: str = Field(..., description="ObjectId del cuidador responsable")
    id_dispositivo: Optional[str] = Field(None, description="Identificador único del ESP32 asignado (MAC address o UUID)")

class RespuestaPaciente(PacienteBase):
    id_paciente: str = Field(..., description="ObjectId de MongoDB serializado como string")
    id_cuidador: str = Field(..., description="ObjectId del cuidador responsable")
    id_dispositivo: Optional[str] = Field(None, description="Identificador del ESP32 asignado")

    ultima_ubicacion: Optional[GeoPoint] = Field(None, description="Última coordenada recibida del dispositivo")
    ultima_señal: Optional[float] = Field(None, description="Último valor de señal recibido del dispositivo")

    estado_dispositivo: Optional[EstadoDispositivo] = Field(None, description="Estado de conexión del dispositivo ESP32")

    created_at: datetime = Field(..., description="Fecha de creación del registro")
    activo: bool = Field(True, description="Indica si el paciente está activo")

    class Config:
        from_attributes = True


class ActualizarPaciente(BaseModel):
    nombre_completo: Optional[str] = Field(None, min_length=2, max_length=100)
    edad_paciente: Optional[int] = Field(None, ge=0)
    enfermedad: Optional[str] = Field(None, max_length=500)
    id_dispositivo: Optional[str] = Field(None, description="Nuevo identificador del ESP32 asignado (MAC address o UUID)")

class ActaulizarUbicacion(BaseModel):
    patient_id: str = Field(..., description="ObjectId del paciente al que se le actualizará la ubicación")
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    device_id: Optional[str] = Field(None, description="Identificador del dispositivo que envía la ubicación")
    recorded_at: datetime = Field(default_factory=datetime.utcnow, description="Timestamp de cuándo se registró esta ubicación")