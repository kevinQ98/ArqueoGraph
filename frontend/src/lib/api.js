const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function apiUrl(path = "") {
  return `${API_BASE}${path}`;
}

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

export async function getIndividuos(params = {}) {
  const url = new URL(`${API_BASE}/individuos`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando individuos");
  return res.json();
}

export async function getMediciones(params = {}) {
  const url = new URL(`${API_BASE}/mediciones`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando mediciones");
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

export async function getGraphAzapaReference(sexo = "", edad = "") {
  const url = new URL(`${API_BASE}/graph/azapa/reference`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de Azapa");
  return res.json();
}

export async function getGraphAzapaElemento(elemento, sexo = "", edad = "") {
  const value = encodeURIComponent(elemento || "ninguna");
  const url = new URL(`${API_BASE}/graph/azapa/elemento/${value}`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando grafo de Azapa por elemento");
  return res.json();
}

export async function getGraphAzapaElements(sexo = "", edad = "") {
  const url = new URL(`${API_BASE}/graph/azapa/elements`);
  if (sexo) url.searchParams.set("sexo", sexo);
  if (edad) url.searchParams.set("edad", edad);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Error cargando red completa de Azapa");
  return res.json();
}

export async function getAzapaSexOptions() {
  const res = await fetch(`${API_BASE}/graph/azapa/sex-options`);
  if (!res.ok) throw new Error("Error cargando opciones de sexo de Azapa");
  return res.json();
}

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
