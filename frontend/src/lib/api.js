/**
 * Base URL de la API. Se puede sobrescribir con VITE_API_BASE.
 * @constant {string}
 */
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/**
 * Construye una URL absoluta para un path de la API.
 * @param {string} [path=""] - Ruta relativa (ej. "/dashboard/overview").
 * @returns {string} URL completa.
 */
export function apiUrl(path = "") {
  return `${API_BASE}${path}`;
}

/**
 * Obtiene los datos del dashboard con los filtros aplicados.
 * @param {Object} params - Parámetros de consulta.
 * @param {string} [params.sitio] - Nombre del sitio.
 * @param {string} [params.sexo] - Sexo (femenino/masculino/indeterminado).
 * @param {string} [params.edad] - Grupo etario (adulto/subadulto/indeterminado).
 * @param {string} [params.elemento] - Elemento químico.
 * @param {string} [params.patologia] - Nombre de patología.
 * @returns {Promise<Object>} Datos del dashboard (KPIs, distribuciones, portales, etc.).
 */
export async function getDashboardOverview(params = {}) {
  const url = new URL(`${API_BASE}/dashboard/overview`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando el dashboard arqueológico");
  return res.json();
}

/**
 * Realiza una petición HTTP con manejo de errores unificado.
 * @param {string} path - Ruta de la API.
 * @param {Object} options - Opciones de fetch (method, headers, body, etc.).
 * @returns {Promise<Object>} Respuesta JSON.
 */
async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Error HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Obtiene la lista de individuos con filtros opcionales.
 * @param {Object} params - Filtros (sexo, sitio, estilo, estado, q).
 * @returns {Promise<Array>} Lista de individuos.
 */
export async function getIndividuos(params = {}) {
  const url = new URL(`${API_BASE}/individuos`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando individuos");
  return res.json();
}

/**
 * Obtiene las mediciones químicas con filtros.
 * @param {Object} params - Filtros (elemento, sexo, edad, patologia, fuente, q).
 * @returns {Promise<Array>} Lista de mediciones con datos del individuo.
 */
export async function getMediciones(params = {}) {
  const url = new URL(`${API_BASE}/mediciones`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando mediciones");
  return res.json();
}

/**
 * Obtiene el grafo relacional (red) con filtros.
 * @param {Object} params - Filtros (edad, sexo, patologia, fuente).
 * @returns {Promise<Object>} Grafo con nodos y aristas.
 */
export async function getGraphRelational({
  edad = "",
  sexo = "",
  patologia = "",
  fuente = "",
} = {}) {
  const url = new URL(`${API_BASE}/graph/relational`);
  if (edad) url.searchParams.set("edad", edad);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (patologia) url.searchParams.set("patologia", patologia);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo relacional");
  return res.json();
}

/**
 * Obtiene el grafo de referencia de Morro 1 (nodo central + individuos).
 * @param {string} sexo - Filtro de sexo.
 * @param {string} edad - Filtro de edad.
 * @param {string} patologia - Filtro de patología.
 * @param {string} fuente - Fuente del sitio.
 * @returns {Promise<Object>} Grafo de referencia.
 */
export async function getGraphMorroReference(sexo = "", edad = "", patologia = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/morro1/reference`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (patologia) url.searchParams.set("patologia", patologia);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de referencia de Morro1");
  return res.json();
}

/**
 * Construye una URL para los endpoints de grafos de un sitio genérico.
 * @param {string} fuente - ID del sitio.
 * @param {string} suffix - Sufijo de la ruta (ej. "/reference", "/elements").
 * @returns {URL} Objeto URL.
 */
function siteApiUrl(fuente, suffix = "") {
  return new URL(`${API_BASE}/graph/site/${encodeURIComponent(fuente)}${suffix}`);
}

/**
 * Agrega parámetros de consulta a una URL.
 * @param {URL} url - Objeto URL.
 * @param {Object} params - Mapa de parámetros (valor vacío se omite).
 * @returns {URL} URL con los parámetros añadidos.
 */
function addSearchParams(url, params = {}) {
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  return url;
}

/**
 * Obtiene el grafo de referencia de un sitio genérico.
 * @param {string} fuente - ID del sitio.
 * @param {Object} filters - Filtros (sexo, edad, patologia, matriz, referencia).
 * @returns {Promise<Object>} Grafo de referencia.
 */
export async function getSiteGraphReference(
  fuente,
  { sexo = "", edad = "", patologia = "", matriz = "", referencia = "" } = {},
) {
  const url = addSearchParams(siteApiUrl(fuente, "/reference"), { sexo, edad, patologia, matriz, referencia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de sitio");
  return res.json();
}

/**
 * Obtiene el grafo de un elemento químico para un sitio genérico.
 * @param {string} fuente - ID del sitio.
 * @param {string} elemento - Nombre del elemento.
 * @param {Object} filters - Filtros (sexo, edad, matriz, referencia).
 * @returns {Promise<Object>} Grafo del elemento.
 */
export async function getSiteGraphElemento(
  fuente,
  elemento,
  { sexo = "", edad = "", matriz = "", referencia = "" } = {},
) {
  const url = addSearchParams(siteApiUrl(fuente, `/elemento/${encodeURIComponent(elemento)}`), { sexo, edad, matriz, referencia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de sitio por elemento");
  return res.json();
}

/**
 * Obtiene el grafo de "Red Completa" (todos los elementos) para un sitio.
 * @param {string} fuente - ID del sitio.
 * @param {Object} filters - Filtros (sexo, edad, matriz, referencia).
 * @returns {Promise<Object>} Grafo completo.
 */
export async function getSiteGraphElements(
  fuente,
  { sexo = "", edad = "", matriz = "", referencia = "" } = {},
) {
  const url = addSearchParams(siteApiUrl(fuente, "/elements"), { sexo, edad, matriz, referencia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando red completa del sitio");
  return res.json();
}

/**
 * Obtiene el grafo de todas las patologías (nodos centrales).
 * @param {string} fuente - ID del sitio.
 * @param {Object} filters - Filtros (sexo, edad, matriz, referencia).
 * @returns {Promise<Object>} Grafo de patologías.
 */
export async function getSiteGraphPatologias(
  fuente,
  { sexo = "", edad = "", matriz = "", referencia = "" } = {},
) {
  const url = addSearchParams(siteApiUrl(fuente, "/patologias"), { sexo, edad, matriz, referencia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando patologías del sitio");
  return res.json();
}

/**
 * Obtiene el grafo de una patología específica.
 * @param {string} fuente - ID del sitio.
 * @param {string} patologia - Nombre de la patología.
 * @param {Object} filters - Filtros (sexo, edad, matriz, referencia).
 * @returns {Promise<Object>} Grafo de la patología.
 */
export async function getSiteGraphPatologia(
  fuente,
  patologia,
  { sexo = "", edad = "", matriz = "", referencia = "" } = {},
) {
  const url = addSearchParams(siteApiUrl(fuente, `/patologia/${encodeURIComponent(patologia)}`), { sexo, edad, matriz, referencia });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando patología del sitio");
  return res.json();
}

/**
 * Obtiene las filas de la tabla de datos de un sitio (mediciones + metadatos).
 * @param {string} fuente - ID del sitio.
 * @param {Object} params - Filtros (sexo, edad, matriz, referencia, elemento, patologia).
 * @returns {Promise<Array>} Filas de la tabla.
 */
export async function getSiteTableRows(fuente, params = {}) {
  const url = addSearchParams(siteApiUrl(fuente, "/table"), params);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando tabla del sitio");
  return res.json();
}

/**
 * Calcula el PCA de un sitio.
 * @param {string} fuente - ID del sitio.
 * @param {Object} params - Parámetros.
 * @param {string[]} params.elements - Lista de elementos.
 * @param {string} params.sexo - Filtro de sexo.
 * @param {string} params.edad - Filtro de edad.
 * @param {string} params.matriz - Filtro de matriz.
 * @param {string} params.referencia - Filtro de referencia.
 * @param {string} params.patologia - Filtro de patología.
 * @returns {Promise<Object>} Resultado del PCA (puntos, loadings, varianza).
 */
export async function getSitePca(
  fuente,
  { elements = [], sexo = "", edad = "", matriz = "", referencia = "", patologia = "" } = {},
) {
  const url = new URL(`${API_BASE}/analysis/site/${encodeURIComponent(fuente)}/pca`);
  url.searchParams.set("elements", elements.join(","));
  addSearchParams(url, { sexo, edad, matriz, referencia, patologia });
  const res = await fetch(url);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error calculando PCA del sitio");
  }
  return res.json();
}

/**
 * Obtiene la relación completa de un caso (individuo + imágenes + mediciones + muestras + patologías + dataciones).
 * @param {string} fuente - ID del sitio.
 * @param {string} caseId - ID del individuo.
 * @returns {Promise<Object>} Datos completos del caso.
 */
export async function getSiteCaseRelation(fuente, caseId) {
  const res = await fetch(`${API_BASE}/graph/site/${encodeURIComponent(fuente)}/case/${encodeURIComponent(caseId)}/relation`);
  if (!res.ok) throw new Error("Error cargando relación del sitio");
  return res.json();
}

export async function getSiteMatrixOptions(fuente) {
  const res = await fetch(`${API_BASE}/graph/site/${encodeURIComponent(fuente)}/matrix-options`);
  if (!res.ok) throw new Error("Error cargando opciones de matriz del sitio");
  return res.json();
}

/**
 * Obtiene el contexto analítico de un sitio (matrices, referencias, elementos disponibles).
 * @param {string} fuente - ID del sitio.
 * @param {Object} params - Filtros (matriz, referencia, sexo, edad, elemento, patologia).
 * @returns {Promise<Object>} Contexto analítico.
 */
export async function getSiteAnalysisContext(fuente, params = {}) {
  const url = new URL(`${API_BASE}/analysis/site/${encodeURIComponent(fuente)}/context`);
  addSearchParams(url, params);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando el contexto analítico del sitio");
  return res.json();
}

/**
 * Obtiene la lista de muestras de un sitio con filtros.
 * @param {string} fuente - ID del sitio.
 * @param {Object} params - Filtros (matriz, referencia, sexo, edad, elemento, patologia, limit).
 * @returns {Promise<Object>} Objeto con total y items (muestras).
 */
export async function getSiteSamples(fuente, params = {}) {
  const url = new URL(`${API_BASE}/analysis/site/${encodeURIComponent(fuente)}/samples`);
  addSearchParams(url, params);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando las muestras del sitio");
  return res.json();
}

/**
 * Obtiene el detalle completo de una muestra (incluye análisis y mediciones).
 * @param {string} fuente - ID del sitio.
 * @param {string} sampleId - ID de la muestra.
 * @returns {Promise<Object>} Detalle de la muestra.
 */
export async function getSiteSampleDetail(fuente, sampleId) {
  const res = await fetch(
    `${API_BASE}/analysis/site/${encodeURIComponent(fuente)}/sample/${encodeURIComponent(sampleId)}`,
  );
  if (!res.ok) throw new Error("Error cargando el detalle de la muestra");
  return res.json();
}

export async function getGraphElemento(elemento, edad, sexo = "", patologia = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/elemento/${elemento}`);
  if (edad) url.searchParams.set("edad", edad);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (patologia) url.searchParams.set("patologia", patologia);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo");
  return res.json();
}

export async function getGraphPatologia(patologia, edad = "", sexo = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/patologia/${patologia}`);
  if (edad) url.searchParams.set("edad", edad);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo por patología");
  return res.json();
}

export async function getGraphAllPatologias(edad = "", sexo = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/patologias`);
  if (edad) url.searchParams.set("edad", edad);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de patologías");
  return res.json();
}

export async function getGraphSimilarity({ elements = "Mn,As,Ba", min_similarity = 0.55, sexo = "", edad = "", patologia = "", fuente = "" } = {}) {
  const url = new URL(`${API_BASE}/graph/similarity`);
  if (elements) url.searchParams.set("elements", elements);
  if (min_similarity) url.searchParams.set("min_similarity", String(min_similarity));
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (patologia) url.searchParams.set("patologia", patologia);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando similitud química");
  return res.json();
}

export async function getGraphAzapaReference(sexo = "", edad = "", matriz = "") {
  const url = new URL(`${API_BASE}/graph/azapa/reference`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de Azapa");
  return res.json();
}

export async function getGraphAzapaElemento(elemento, sexo = "", edad = "", matriz = "") {
  const value = encodeURIComponent(elemento || "ninguna");
  const url = new URL(`${API_BASE}/graph/azapa/elemento/${value}`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de Azapa por elemento");
  return res.json();
}

export async function getGraphAzapaElements(sexo = "", edad = "", matriz = "") {
  const url = new URL(`${API_BASE}/graph/azapa/elements`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando red completa de Azapa");
  return res.json();
}

export async function getAzapaMatrixOptions() {
  const res = await fetch(`${API_BASE}/graph/azapa/matrix-options`);
  if (!res.ok) throw new Error("Error cargando opciones de matriz de Azapa");
  return res.json();
}

export async function getAzapaSexOptions() {
  const res = await fetch(`${API_BASE}/graph/azapa/sex-options`);
  if (!res.ok) throw new Error("Error cargando opciones de sexo de Azapa");
  return res.json();
}

export async function getAzapaTableRows(params = {}) {
  const url = new URL(`${API_BASE}/graph/azapa/table`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando tabla de Azapa");
  return res.json();
}

export async function getAzapaCaseRelation(caseId) {
  const res = await fetch(`${API_BASE}/graph/azapa/case/${encodeURIComponent(caseId)}/relation`);
  if (!res.ok) throw new Error("Error cargando relación de Azapa");
  return res.json();
}

/**
 * Obtiene las opciones de filtros (sexos, edades, elementos, patologías, etc.) para un sitio.
 * @param {Object} params - Filtro fuente.
 * @param {string} [params.fuente] - ID del sitio.
 * @returns {Promise<Object>} Opciones de filtros.
 */
export async function getFilterOptions(params = {}) {
  const url = new URL(`${API_BASE}/filters/options`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando opciones de filtros");
  return res.json();
}

export async function getAppOverview() {
  return request("/app/overview");
}

export async function loadDemoGuided({ syncImages = true } = {}) {
  return request(`/app/actions/load-demo?sync_images=${syncImages ? "true" : "false"}`, {
    method: "POST",
  });
}

export async function getAppCasos(params = {}) {
  const url = new URL(`${API_BASE}/app/casos`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando casos guiados");
  return res.json();
}

export async function syncImagenes(id_individuo = "") {
  const suffix = id_individuo ? `?id_individuo=${encodeURIComponent(id_individuo)}` : "";
  return request(`/admin/imagenes/sync${suffix}`, { method: "POST" });
}

export function getDatasetExportUrl() {
  return `${API_BASE}/admin/export/dataset.json`;
}

export async function getAuditoria() {
  return request("/admin/auditoria");
}

export async function updateIndividuo(id, payload) {
  return request(`/admin/individuos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function updateMedicion(id, payload) {
  return request(`/admin/mediciones/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteIndividuo(id) {
  return request(`/admin/individuos/${id}`, { method: "DELETE" });
}

export async function deleteMedicion(id) {
  return request(`/admin/mediciones/${id}`, { method: "DELETE" });
}

export async function importDemo() {
  return loadDemoGuided();
}

/**
 * Crea un respaldo de la base de datos SQLite.
 * @returns {Promise<Object>} { archivo, ruta }.
 */
export async function createBackup() {
  const res = await fetch(`${API_BASE}/admin/backup`, { method: "POST" });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error generando el respaldo");
  }
  return res.json();
}

export async function uploadMorro1Json(tipo, file) {
  const formData = new FormData();
  formData.append("tipo", tipo);
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import/morro1/json`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error subiendo el archivo JSON");
  }
  return res.json();
}

export async function uploadAzapaJson(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/admin/import/azapa/json`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error subiendo el archivo JSON");
  }
  return res.json();
}

export async function resetDb() {
  return request("/admin/reset-db", { method: "POST" });
}


export async function getProfiles({ elements = "Mn,As,Ba", sexo = "", estado = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/profiles`);
  if (elements) url.searchParams.set("elements", elements);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (estado) url.searchParams.set("estado", estado);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando perfiles químicos");
  return res.json();
}

export async function getDistanceMatrix({ elements = "Mn,As,Ba", sexo = "", estado = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/distance-matrix`);
  if (elements) url.searchParams.set("elements", elements);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (estado) url.searchParams.set("estado", estado);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando matriz de distancia");
  return res.json();
}

export async function getClusters({ elements = "Mn,As,Ba", k = 3, linkage = "average", sexo = "", estado = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/clusters`);
  if (elements) url.searchParams.set("elements", elements);
  if (k) url.searchParams.set("k", String(k));
  if (linkage) url.searchParams.set("linkage", linkage);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (estado) url.searchParams.set("estado", estado);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando clusters");
  return res.json();
}

export async function getGraphmlUrl({ mode = "similarity", elements = "Mn,As,Ba", min_similarity = 0.55, k = 3, sexo = "", estado = "" } = {}) {
  const url = new URL(`${API_BASE}/export/graphml`);
  url.searchParams.set("mode", mode);
  if (elements) url.searchParams.set("elements", elements);
  if (min_similarity) url.searchParams.set("min_similarity", String(min_similarity));
  if (k) url.searchParams.set("k", String(k));
  if (sexo) url.searchParams.set("sexo", sexo);
  if (estado) url.searchParams.set("estado", estado);
  return url.toString();
}


export function absoluteImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE}${url}`;
}

export async function getImagenesIndividuo(id_individuo) {
  const res = await fetch(`${API_BASE}/individuos/${id_individuo}/imagenes`);
  if (!res.ok) throw new Error("Error cargando imágenes del individuo");
  return res.json();
}

export async function getAllImagenes(params = {}) {
  const url = new URL(`${API_BASE}/admin/imagenes`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando imágenes");
  return res.json();
}

export async function uploadImagenesIndividuo(id_individuo, files, metadata = {}) {
  const form = new FormData();
  Array.from(files || []).forEach((file) => form.append("files", file));
  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") form.append(key, value);
  });

  const res = await fetch(`${API_BASE}/admin/individuos/${id_individuo}/imagenes`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Error subiendo imágenes");
  }
  return res.json();
}

export async function deleteImagen(id_imagen) {
  return request(`/admin/imagenes/${id_imagen}`, { method: "DELETE" });
}

export async function getMorroSexOptions() {
  const res = await fetch(`${API_BASE}/graph/morro1/sex-options`);
  if (!res.ok) throw new Error("Error cargando opciones de sexo de Morro1");
  return res.json();
}

export async function getMorroMatrixOptions() {
  const res = await fetch(`${API_BASE}/graph/morro1/matrix-options`);
  if (!res.ok) throw new Error("Error cargando opciones de matriz de Morro1");
  return res.json();
}

export async function getMorroTableRows(params = {}) {
  const url = new URL(`${API_BASE}/graph/morro1/table`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando tabla de Morro1");
  return res.json();
}

export async function getGraphMorroElemento(elemento, sexo = "", edad = "", matriz = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/morro1/elemento/${encodeURIComponent(elemento)}`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de Morro1 por elemento");
  return res.json();
}

export async function getGraphMorroElements(sexo = "", edad = "", matriz = "", fuente = "") {
  const url = new URL(`${API_BASE}/graph/morro1/elements`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando red completa de Morro1");
  return res.json();
}

export async function getMorroPca({ elements = [], sexo = "", edad = "", fuente = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/morro1/pca`);
  url.searchParams.set("elements", elements.join(","));
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error calculando PCA de Morro1");
  }
  return res.json();
}

export async function getAzapaPca({ elements = [], sexo = "", edad = "", matriz = "" } = {}) {
  const url = new URL(`${API_BASE}/analysis/azapa/pca`);
  url.searchParams.set("elements", elements.join(","));
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  if (matriz) url.searchParams.set("matriz", matriz);
  const res = await fetch(url);
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(payload?.detail || "Error calculando PCA de Azapa");
  }
  return res.json();
}

export async function getMorroCaseRelation(caseId, fuente = "") {
  const url = new URL(`${API_BASE}/graph/morro1/case/${encodeURIComponent(caseId)}/relation`);
  if (fuente) url.searchParams.set("fuente", fuente);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando relación de Morro1");
  return res.json();
}
