from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class Individuo(BaseModel):
    id_individuo: str
    id_documento: str
    numero_cuerpo: Optional[str] = None
    sexo: Optional[str] = None
    edad: Optional[str] = None
    sitio: Optional[str] = None
    cementerio: Optional[str] = None
    cronologia: Optional[str] = None
    estilo_momificacion: Optional[str] = None
    referencia_bibliografica: Optional[str] = None
    estado: str = "borrador"
    notas: Optional[str] = None


class IndividuoUpdate(BaseModel):
    id_documento: Optional[str] = None
    numero_cuerpo: Optional[str] = None
    sexo: Optional[str] = None
    edad: Optional[str] = None
    sitio: Optional[str] = None
    cementerio: Optional[str] = None
    cronologia: Optional[str] = None
    estilo_momificacion: Optional[str] = None
    referencia_bibliografica: Optional[str] = None
    estado: Optional[str] = None
    notas: Optional[str] = None


class MedicionQuimica(BaseModel):
    id_medicion: str
    id_individuo: str
    tipo_muestra: Optional[str] = None
    elemento: str
    concentracion: float
    unidad: str = "ppm"
    metodo: Optional[str] = None
    laboratorio: Optional[str] = None
    fecha: Optional[str] = None
    observaciones: Optional[str] = None
    estado: str = "borrador"


class MedicionQuimicaUpdate(BaseModel):
    id_individuo: Optional[str] = None
    tipo_muestra: Optional[str] = None
    elemento: Optional[str] = None
    concentracion: Optional[float] = None
    unidad: Optional[str] = None
    metodo: Optional[str] = None
    laboratorio: Optional[str] = None
    fecha: Optional[str] = None
    observaciones: Optional[str] = None
    estado: Optional[str] = None


class EstadoUpdate(BaseModel):
    estado: str = Field(pattern="^(borrador|revisar|validado|descartado)$")


class ImportResult(BaseModel):
    inserted: int = 0
    updated: int = 0
    errors: list[str] = Field(default_factory=list)
