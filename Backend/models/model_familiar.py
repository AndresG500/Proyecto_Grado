from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CrearFamiliar(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(...)
    password: str = Field(..., min_length=8)
    phone: Optional[str] = Field(None)
    codigo_grupo: Optional[str] = Field(None)

class VerificarFamiliar(BaseModel):
    email: str = Field(...)
    password: str = Field(...)

class RespuestaFamiliar(BaseModel):
    id: str = Field(...)
    name: str = Field(...)
    email: str = Field(...)
    phone: Optional[str] = Field(None)
    grupo_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(...)

    class Config:
        from_attributes = True
