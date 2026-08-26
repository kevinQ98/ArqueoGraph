# Iniciar Proyecto
## 1. Verifica que tienes Python instalado y accesible
```
python --version
```
### 2. Instala las dependencias necesarias (si no están)
```
pip install -r .\backend\requirements.txt
```

# Como agregar un sitio nuevo

## 1. Asegúrate de estar en el directorio correcto
Desde la raíz de tu proyecto, verifica que el entorno de Python está activo y que tienes las dependencias.

```
cd /ruta/a/ArqueoGraph
```

## 2. Crear un sitio vacío (sin clonar)
Crearemos un sitio llamado "Sitio Tutorial" con identificador sitio_tutorial:

```
$env:PYTHONPATH = "backend" python backend/scripts/site_package.py create --id sitio_tutorial --nombre "Sitio Tutorial" --area "Arica" --descripcion "Sitio creado para prueba desde cero" --lat -18.5 --lng -70.3 --overwrite
```
Esto crea:
  * Carpeta: backend/sample_data/sitio_tutorial/
  * 6 archivos CSV vacíos con las columnas correctas:
    * sitios.csv
    * individuos.csv
    * mediciones_quimicas.csv
    * paleopatologias.csv
    * dataciones.csv
    * imagenes.csv

## 3. Completar los CSVs con datos (3 individuos)
Abre tu explorador de archivos y ve a backend/sample_data/sitio_tutorial/. Allí encontrarás 6 archivos CSV. Edita cada uno con el siguiente contenido:

### 3.1 sitios.csv – 1 sitio
```csv
id_sitio,nombre,area,descripcion,lat,lng,view,estado
sitio_tutorial,Sitio Tutorial,Arica,Sitio creado para prueba desde cero,-18.5,-70.3,visualizacion,validado
```
### 3.2 individuos.csv – 3 individuos
```csv
id_individuo,id_documento,numero_cuerpo,sexo,edad,sitio,cementerio,cronologia,estilo_momificacion,referencia_bibliografica,fuente,estado,notas
tutorial_001,Caso-001,C001,femenino,adulto,Sitio Tutorial,Arica,500 d.C.,natural,Referencia 1,sitio_tutorial,validado,
tutorial_002,Caso-002,C002,masculino,subadulto,Sitio Tutorial,Arica,600 d.C.,natural,Referencia 2,sitio_tutorial,validado,
tutorial_003,Caso-003,C003,femenino,adulto,Sitio Tutorial,Arica,700 d.C.,natural,Referencia 3,sitio_tutorial,validado,
```
### 3.3 mediciones_quimicas.csv – 7 mediciones
```csv
id_medicion,id_individuo,tipo_muestra,elemento,concentracion,unidad,metodo,laboratorio,fecha,observaciones,fuente,estado
tutorial_001_mn_costilla,tutorial_001,costilla,Mn,12.5,ppm,ICP-MS,LabTest,2024-01-01,Medición de Mn,sitio_tutorial,validado
tutorial_001_as_costilla,tutorial_001,costilla,As,0.8,ppm,ICP-MS,LabTest,2024-01-01,Medición de As,sitio_tutorial,validado
tutorial_001_li_costilla,tutorial_001,costilla,Li,4.2,ppm,ICP-MS,LabTest,2024-01-01,Medición de Li,sitio_tutorial,validado
tutorial_002_mn_costilla,tutorial_002,costilla,Mn,8.3,ppm,ICP-MS,LabTest,2024-01-02,Medición de Mn,sitio_tutorial,validado
tutorial_002_as_costilla,tutorial_002,costilla,As,0.5,ppm,ICP-MS,LabTest,2024-01-02,Medición de As,sitio_tutorial,validado
tutorial_003_mn_costilla,tutorial_003,costilla,Mn,15.7,ppm,ICP-MS,LabTest,2024-01-03,Medición de Mn,sitio_tutorial,validado
tutorial_003_as_costilla,tutorial_003,costilla,As,1.2,ppm,ICP-MS,LabTest,2024-01-03,Medición de As,sitio_tutorial,validado
```
### 3.4. paleopatologias.csv – 3 registros (2 positivas, 1 negativa)
```csv
id_paleopatologia,id_individuo,patologia,valor,presente,fuente,estado
tutorial_001_periostitis,tutorial_001,periostitis,leve,1,sitio_tutorial,validado
tutorial_001_osteofitosis,tutorial_001,osteofitosis,moderada,1,sitio_tutorial,validado
tutorial_002_periostitis,tutorial_002,periostitis,ausente,0,sitio_tutorial,validado
```
### 3.5. dataciones.csv e imagenes.csv – vacío (solo encabezado)
```csv
id_datacion,id_individuo,muestra,fecha_bp,fecha_1sigma_ad,interceptos_ad,rango_calibrado_min,rango_calibrado_max,referencia_datos,fuente,estado
```
```csv
id_imagen,id_individuo,filename_original,filename_saved,relative_path,content_type,label,descripcion,fuente,estado
```
## 4. Validar el paquete
Ejecuta desde la raíz del proyecto:
```
$env:PYTHONPATH = "backend"; python backend/scripts/site_package.py validate --id sitio_tutorial
```
**Resultado esperado**: un JSON con "ok": true y conteos como "individuos": 3, "mediciones": 7, etc.

**Si hay errores** (por ejemplo, "id_individuo no existe"), revisa que los id_individuo coincidan entre CSVs y que el fuente sea siempre sitio_tutorial.

## 5. Importar a SQLite
```
$env:PYTHONPATH = "backend"; python backend/scripts/site_package.py import --id sitio_tutorial --replace
```
Verás un resumen con "ok": true y los detalles de inserción.

## 6. Verificar en la aplicación
### 6.1 Activar el entorno virtual (si existe)
Dentro de la carpeta backend puede haber un entorno virtual llamado .venv Para activarlo:
```
# Si el entorno está en backend\.venv
backend\.venv\Scripts\Activate.ps1
```

### 6.2 Levantar el backend (API)
Desde la raíz del proyecto (ArqueoGraph), ejecuta:
```
$env:PYTHONPATH = "backend"; python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Deberías ver un mensaje como:
```text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```
### 6.3 Levantar el frontend (en otra terminal)
Abre una nueva terminal (sin cerrar la del backend) y navega a la carpeta del frontend:

```
cd frontend
npm run dev
```
Esto iniciará el servidor de desarrollo del frontend, normalmente en http://localhost:5173 (o el puerto que indique la salida).

### 6.4 Abrir la aplicación
Abre tu navegador en la dirección que muestra el frontend (ej. http://localhost:5173).

Recarga dura (Ctrl+Shift+R o Cmd+Shift+R) para limpiar caché.

En la barra superior deberías ver el nuevo sitio: "Sitio Tutorial". Haz clic en él.

### 6.5 Probar filtros y funcionalidades
1. Sexo: selecciona femenino → deberían aparecer 2 individuos.

2. Grupo etario: selecciona adulto → 2 individuos.

3. Elemento: selecciona Mn → 3 mediciones.

4. Patología: selecciona periostitis → 1 individuo (el tutorial_001).

5. Filtro cruzado: sexo = femenino y edad = adulto → 2 individuos (tutorial_001 y tutorial_003).

### 7. Borrar sitio
Ejecuta el siguiente comando
```
$env:PYTHONPATH = "backend"; python -c "from scripts.site_package import delete_site_data; print(delete_site_data('sitio_prueba'))"
```
Te mostrará algo como:
```
{'imagenes': 192, 'dataciones': 0, 'paleopatologias': 514, 'mediciones_quimicas': 169, 'individuos': 181, 'sitios': 1}
```
* Puedes eliminar la carpeta y los cvs creados en: /backend/sample_data/sitio_tutorial
