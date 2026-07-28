# Entrega de cambios: filtros y visualización PCA

Esta carpeta documenta los cambios realizados en ArqueoGraph para que otro
desarrollador pueda identificarlos e integrarlos en otra copia de la aplicación.

La implementación tiene tres objetivos:

1. Corregir los filtros de edad y sexo de Morro 1.
2. Permitir seleccionar tres o más elementos químicos y calcular un PCA.
3. Colorear el PCA por sexo o por edad mediante botones tipo dashboard.

## Contenido de esta carpeta

- `MANIFIESTO_ARCHIVOS.md`: lista exacta de archivos creados y modificados.
- `GUIA_INTEGRACION.md`: orden recomendado para trasladar los cambios.
- `CONTRATO_API_PCA.md`: parámetros y respuesta del endpoint PCA.
- `PRUEBAS_Y_VALIDACION.md`: comandos de verificación y resultados conocidos.

## Resumen rápido

Se crearon dos archivos de código:

- `frontend/src/components/PcaChart.jsx`
- `backend/tests/test_morro1_filters.py`

Se modificaron seis archivos existentes:

- `backend/app/graph_service.py`
- `backend/app/main.py`
- `backend/requirements.txt`
- `frontend/src/App.jsx`
- `frontend/src/lib/api.js`
- `frontend/src/style.css`

No se modificaron los JSON originales, las imágenes ni la base SQLite.

## Recomendación para el colega

No debe reemplazar archivos completos si su copia contiene otros cambios. Debe
comparar e integrar las funciones indicadas en esta documentación. Los nombres
de funciones y clases CSS permiten localizar cada bloque con una búsqueda de
texto.

