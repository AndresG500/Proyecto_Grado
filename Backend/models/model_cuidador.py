from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime

class CuidadoBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=100, description="Nombre del cuidado")
    email: EmailStr = Field(..., description="Correo electrónico del cuidado")
    phone: Optional[str] = Field(None, pattern=r"^\+?[0-9]{7,15}$", description="Teléfono de contacto")

class CrearCuidador(CuidadoBase):
    password: str = Field(..., min_length=8, description="Contraseña del usuario")

class RespuestaCuidador(CuidadoBase):
    id: str = Field(..., description="ObjectId de MongoDB serializado como string")
    id_paciente: list[str] = Field(default_factory=list, description="IDs de los pacientes asignados")
    fecha_creacion: datetime = Field(..., description="Fecha de creación del registro")
    activo: bool = Field(True, description="Indica si la cuenta está activa")

    class Config:
        from_attributes = True

class ActualizarCuidador(BaseModel):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)
    telefono: Optional[str] = Field(None, pattern=r"^\+?[0-9]{7,15}$")
    password: Optional[str] = Field(None, min_length=8, description="Nueva contraseña en texto plano")
