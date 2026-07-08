import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X
} from "lucide-react";
import {
  deleteIndividuo,
  deleteMedicion,
  getAuditoria,
  getIndividuos,
  getMediciones,
  updateIndividuo,
  updateMedicion
} from "../lib/api";

const ESTADOS = ["borrador", "revisar", "validado", "descartado"];

function EstadoBadge({ estado }) {
  const cls = {
    borrador: "badge gray",
    revisar: "badge amber",
    validado: "badge green",
    descartado: "badge red",
  }[estado] || "badge gray";
  return <span className={cls}>{estado || "sin estado"}</span>;
}

function IssueBadge({ severidad }) {
  const cls = {
    alta: "badge red",
    media: "badge amber",
    baja: "badge gray",
  }[severidad] || "badge gray";
  return <span className={cls}>{severidad}</span>;
}

export function AdminPanel() {
  const [tab, setTab] = useState("auditoria");
  const [individuos, setIndividuos] = useState([]);
  const [mediciones, setMediciones] = useState([]);
  const [auditoria, setAuditoria] = useState({ total_issues: 0, issues: [] });
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [message, setMessage] = useState("");

  async function loadAll() {
    setMessage("Cargando administración...");
    const [inds, meds, aud] = await Promise.all([
      getIndividuos({ estado, q }),
      getMediciones({ estado, q }),
      getAuditoria(),
    ]);
    setIndividuos(inds);
    setMediciones(meds);
    setAuditoria(aud);
    setMessage("");
  }

  useEffect(() => {
    loadAll().catch((err) => setMessage(`Error: ${err.message}`));
  }, [estado]);

  const visibleIndividuos = useMemo(() => individuos, [individuos]);
  const visibleMediciones = useMemo(() => mediciones, [mediciones]);

  function startEdit(type, row) {
    setEditing({ type, id: type === "individuo" ? row.id_individuo : row.id_medicion });
    setEditData({ ...row });
  }

  function cancelEdit() {
    setEditing(null);
    setEditData({});
  }

  async function saveEdit() {
    if (!editing) return;

    if (editing.type === "individuo") {
      await updateIndividuo(editing.id, {
        id_documento: editData.id_documento,
        numero_cuerpo: editData.numero_cuerpo,
        sexo: editData.sexo,
        edad: editData.edad,
        sitio: editData.sitio,
        cementerio: editData.cementerio,
        cronologia: editData.cronologia,
        estilo_momificacion: editData.estilo_momificacion,
        referencia_bibliografica: editData.referencia_bibliografica,
        estado: editData.estado,
        notas: editData.notas,
      });
    } else {
      await updateMedicion(editing.id, {
        id_individuo: editData.id_individuo,
        tipo_muestra: editData.tipo_muestra,
        elemento: editData.elemento,
        concentracion: Number(editData.concentracion),
        unidad: editData.unidad,
        metodo: editData.metodo,
        laboratorio: editData.laboratorio,
        fecha: editData.fecha,
        observaciones: editData.observaciones,
        estado: editData.estado,
      });
    }

    cancelEdit();
    await loadAll();
    setMessage("Registro actualizado.");
  }

  async function remove(type, id) {
    const ok = window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.");
    if (!ok) return;
    if (type === "individuo") {
      await deleteIndividuo(id);
    } else {
      await deleteMedicion(id);
    }
    await loadAll();
    setMessage("Registro eliminado.");
  }

  async function applySearch() {
    await loadAll();
  }

  return (
    <div className="admin">
      <div className="adminHeader">
        <div>
          <h2><ClipboardList size={18} /> Administración y curaduría</h2>
          <p className="hint">Revisa, edita, valida o descarta datos antes de visualizarlos.</p>
        </div>
        <button className="secondary small" onClick={loadAll}><RefreshCw size={15} /> Actualizar</button>
      </div>

      <div className="adminToolbar">
        <button className={tab === "auditoria" ? "tab active" : "tab"} onClick={() => setTab("auditoria")}>Auditoría</button>
        <button className={tab === "individuos" ? "tab active" : "tab"} onClick={() => setTab("individuos")}>Individuos</button>
        <button className={tab === "mediciones" ? "tab active" : "tab"} onClick={() => setTab("mediciones")}>Mediciones</button>

        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." />
        <select value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
        </select>
        <button className="secondary small" onClick={applySearch}>Filtrar</button>
      </div>

      {message && <p className="status">{message}</p>}

      {tab === "auditoria" && (
        <section className="panel adminPanel">
          <div className="auditSummary">
            <div className="auditCard">
              <AlertTriangle size={20} />
              <strong>{auditoria.total_issues}</strong>
              <span>advertencias</span>
            </div>
            <div className="auditCard">
              <CheckCircle2 size={20} />
              <strong>{individuos.filter(i => i.estado === "validado").length}</strong>
              <span>individuos validados</span>
            </div>
            <div className="auditCard">
              <CheckCircle2 size={20} />
              <strong>{mediciones.filter(m => m.estado === "validado").length}</strong>
              <span>mediciones validadas</span>
            </div>
          </div>

          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Severidad</th>
                  <th>Tipo</th>
                  <th>ID</th>
                  <th>Mensaje</th>
                </tr>
              </thead>
              <tbody>
                {auditoria.issues.map((issue, idx) => (
                  <tr key={`${issue.id}-${idx}`}>
                    <td><IssueBadge severidad={issue.severidad} /></td>
                    <td>{issue.tipo}</td>
                    <td>{issue.id}</td>
                    <td>{issue.mensaje}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "individuos" && (
        <section className="panel adminPanel">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>ID</th>
                  <th>Caso</th>
                  <th>Cuerpo</th>
                  <th>Sexo</th>
                  <th>Edad</th>
                  <th>Sitio</th>
                  <th>Estilo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleIndividuos.map((row) => (
                  <tr key={row.id_individuo}>
                    <td><EstadoBadge estado={row.estado} /></td>
                    <td>{row.id_individuo}</td>
                    <td>{row.id_documento}</td>
                    <td>{row.numero_cuerpo}</td>
                    <td>{row.sexo}</td>
                    <td>{row.edad}</td>
                    <td>{row.sitio}</td>
                    <td>{row.estilo_momificacion}</td>
                    <td className="actions">
                      <button className="iconBtn" onClick={() => startEdit("individuo", row)}><Pencil size={15} /></button>
                      <button className="iconBtn danger" onClick={() => remove("individuo", row.id_individuo)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "mediciones" && (
        <section className="panel adminPanel">
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>ID</th>
                  <th>Caso</th>
                  <th>Cuerpo</th>
                  <th>Elemento</th>
                  <th>ppm</th>
                  <th>Muestra</th>
                  <th>Método</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleMediciones.map((row) => (
                  <tr key={row.id_medicion}>
                    <td><EstadoBadge estado={row.estado} /></td>
                    <td>{row.id_medicion}</td>
                    <td>{row.id_documento}</td>
                    <td>{row.numero_cuerpo}</td>
                    <td>{row.elemento}</td>
                    <td>{row.concentracion}</td>
                    <td>{row.tipo_muestra}</td>
                    <td>{row.metodo}</td>
                    <td className="actions">
                      <button className="iconBtn" onClick={() => startEdit("medicion", row)}><Pencil size={15} /></button>
                      <button className="iconBtn danger" onClick={() => remove("medicion", row.id_medicion)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <div className="modalBackdrop">
          <div className="modal">
            <div className="modalHeader">
              <h3>Editar {editing.type}</h3>
              <button className="iconBtn" onClick={cancelEdit}><X size={18} /></button>
            </div>

            {editing.type === "individuo" ? (
              <div className="formGrid">
                <label>Caso<input value={editData.id_documento || ""} onChange={e => setEditData({...editData, id_documento: e.target.value})} /></label>
                <label>Número cuerpo<input value={editData.numero_cuerpo || ""} onChange={e => setEditData({...editData, numero_cuerpo: e.target.value})} /></label>
                <label>Sexo<input value={editData.sexo || ""} onChange={e => setEditData({...editData, sexo: e.target.value})} /></label>
                <label>Edad<input value={editData.edad || ""} onChange={e => setEditData({...editData, edad: e.target.value})} /></label>
                <label>Sitio<input value={editData.sitio || ""} onChange={e => setEditData({...editData, sitio: e.target.value})} /></label>
                <label>Cementerio<input value={editData.cementerio || ""} onChange={e => setEditData({...editData, cementerio: e.target.value})} /></label>
                <label>Cronología<input value={editData.cronologia || ""} onChange={e => setEditData({...editData, cronologia: e.target.value})} /></label>
                <label>Estilo<input value={editData.estilo_momificacion || ""} onChange={e => setEditData({...editData, estilo_momificacion: e.target.value})} /></label>
                <label className="wide">Referencia<input value={editData.referencia_bibliografica || ""} onChange={e => setEditData({...editData, referencia_bibliografica: e.target.value})} /></label>
                <label>Estado<select value={editData.estado || "borrador"} onChange={e => setEditData({...editData, estado: e.target.value})}>{ESTADOS.map(e => <option key={e}>{e}</option>)}</select></label>
              </div>
            ) : (
              <div className="formGrid">
                <label>Individuo ID<input value={editData.id_individuo || ""} onChange={e => setEditData({...editData, id_individuo: e.target.value})} /></label>
                <label>Elemento<input value={editData.elemento || ""} onChange={e => setEditData({...editData, elemento: e.target.value})} /></label>
                <label>Concentración<input type="number" value={editData.concentracion || ""} onChange={e => setEditData({...editData, concentracion: e.target.value})} /></label>
                <label>Unidad<input value={editData.unidad || ""} onChange={e => setEditData({...editData, unidad: e.target.value})} /></label>
                <label>Tipo muestra<input value={editData.tipo_muestra || ""} onChange={e => setEditData({...editData, tipo_muestra: e.target.value})} /></label>
                <label>Método<input value={editData.metodo || ""} onChange={e => setEditData({...editData, metodo: e.target.value})} /></label>
                <label>Laboratorio<input value={editData.laboratorio || ""} onChange={e => setEditData({...editData, laboratorio: e.target.value})} /></label>
                <label>Fecha<input value={editData.fecha || ""} onChange={e => setEditData({...editData, fecha: e.target.value})} /></label>
                <label>Estado<select value={editData.estado || "borrador"} onChange={e => setEditData({...editData, estado: e.target.value})}>{ESTADOS.map(e => <option key={e}>{e}</option>)}</select></label>
                <label className="wide">Observaciones<input value={editData.observaciones || ""} onChange={e => setEditData({...editData, observaciones: e.target.value})} /></label>
              </div>
            )}

            <div className="modalActions">
              <button className="secondary" onClick={cancelEdit}>Cancelar</button>
              <button className="primary" onClick={saveEdit}><Save size={16} /> Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
