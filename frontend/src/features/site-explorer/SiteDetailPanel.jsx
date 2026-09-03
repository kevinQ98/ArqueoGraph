import {
  Beaker,
  Bone,
  BookOpen,
  CalendarDays,
  Download,
  ExternalLink,
  Image as ImageIcon,
  Info,
  Microscope,
  X,
} from "lucide-react";
import { absoluteImageUrl } from "../../lib/api";
import { checkAndFix } from "../../lib/utils";

function downloadDetail(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `arqueograph_${data?.sample?.codigo_muestra || data?.case?.id_individuo || "detalle"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function valueOrDash(value) {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function referenceUrl(analysis) {
  if (analysis?.url) return analysis.url;
  if (!analysis?.doi) return "";
  return analysis.doi.startsWith("http") ? analysis.doi : `https://doi.org/${analysis.doi}`;
}

export function SiteDetailPanel({ selected, detail, loading, onClose }) {
  if (!selected) {
    return (
      <aside className="explorerDetail explorerDetailEmpty">
        <Info size={34} />
        <h2>Detalle de individuo</h2>
        <p>Selecciona un nodo o una fila para consultar su ficha bioarqueológica.</p>
      </aside>
    );
  }

  const sample = detail?.sample || (selected.type === "muestra" ? selected : null);
  const individual = detail?.case || sample?.individuo || selected || {};
  const analyticalSamples = detail?.samples || (sample ? [sample] : []);
  const measurements = detail?.measurements || [];
  const pathologies = detail?.pathologies || [];
  const datings = detail?.datings || [];
  const images = detail?.images || [];
  const label = selected.label || sample?.codigo_muestra || individual.numero_cuerpo || individual.id_documento || individual.id_individuo;

  return (
    <aside className="explorerDetail">
      <header className="explorerDetailHeader">
        <div>
          <span>{sample ? "Muestra" : "ID"}</span>
          <h2>{label}</h2>
          <code>{sample?.id_muestra || individual.id_individuo || selected.id}</code>
        </div>
        <button type="button" onClick={onClose} title="Cerrar detalle"><X size={17} /></button>
      </header>

      {loading ? <p className="explorerDetailLoading">Cargando ficha...</p> : (
        <div className="explorerDetailScroll">
          <section>
            <h3><ImageIcon size={14} /> Registro fotográfico <span>{images.length}</span></h3>
            <div className="explorerImageGrid">
              {images.slice(0, 4).map((image) => (
                <a key={image.id_imagen} href={absoluteImageUrl(image.url)} target="_blank" rel="noreferrer">
                  <img src={absoluteImageUrl(image.url)} alt={image.label || image.titulo || image.filename_original || "Registro arqueológico"} />
                </a>
              ))}
              {!images.length && <p>Sin imágenes registradas.</p>}
            </div>
          </section>

          <section>
            <h3>Perfil biológico</h3>
            <dl className="explorerFacts">
              <div><dt>Sexo</dt><dd>{valueOrDash(individual.sexo || selected.sexo)}</dd></div>
              <div><dt>Edad</dt><dd>{valueOrDash(individual.edad || selected.edad)}</dd></div>
              <div><dt>Sitio</dt><dd>{valueOrDash(individual.sitio || selected.sitio)}</dd></div>
              <div><dt>Cementerio</dt><dd>{valueOrDash(individual.cementerio)}</dd></div>
              <div><dt>Muestras</dt><dd>{analyticalSamples.length || "—"}</dd></div>
              <div><dt>Estado</dt><dd>{valueOrDash(individual.estado || selected.estado)}</dd></div>
            </dl>
          </section>

          <section>
            <h3><Microscope size={14} /> Muestras y procedencia <span>{analyticalSamples.length}</span></h3>
            <div className="explorerSampleRecords">
              {analyticalSamples.map((item) => (
                <div key={item.id_muestra} className="explorerSampleRecord">
                  <header>
                    <strong>{item.codigo_muestra}</strong>
                    {/* <span className={item.es_inferida ? "inferred" : ""}>{item.es_inferida ? "Reconstruida" : "Registrada"}</span> */}
                  </header>
                  <dl>
                    <div><dt>Matriz biológica</dt><dd>{item.matriz?.nombre || "—"}</dd></div>
                    <div><dt>Nombre original</dt><dd>{item.tipo_muestra_original || "—"}</dd></div>
                    <div><dt>Elemento anatómico</dt><dd>{item.elemento_anatomico || "—"}</dd></div>
                  </dl>
                </div>
              ))}
              {!analyticalSamples.length && <p>Sin muestras normalizadas.</p>}
            </div>
          </section>

          <section>
            <h3><Beaker size={14} /> Análisis y mediciones <span>{measurements.length}</span></h3>
            <div className="explorerAnalysisGroups">
              {analyticalSamples.flatMap((item) => item.analisis_detalle || []).map((analysis) => (
                <div key={analysis.id_analisis} className="explorerAnalysisGroup">
                  <header>
                    <div><strong>{analysis.codigo_analisis}</strong><small>{analysis.dataset_origen || "Procedencia no declarada"}</small></div>
                    <span>{analysis.mediciones?.[0]?.unidad || analysis.unidad_declarada || "—"}</span>
                  </header>
                  <dl>
                    <div><dt>Método</dt><dd>{valueOrDash(analysis.metodo)}</dd></div>
                    <div><dt>Laboratorio</dt><dd>{valueOrDash(analysis.laboratorio)}</dd></div>
                    <div><dt>Fecha</dt><dd>{valueOrDash(analysis.fecha)}</dd></div>
                  </dl>
                  <div className="explorerMeasurements">
                    {(analysis.mediciones || []).map((row) => (
                      <div key={row.id_medicion || `${row.elemento}-${row.concentracion}`}>
                        <strong>{row.elemento}</strong>
                        <span>{checkAndFix(row.concentracion)} {row.unidad || "ppm"}</span>
                      </div>
                    ))}
                  </div>
                  {(analysis.referencia_titulo || analysis.cita) && (
                    <div className="explorerReferenceRecord">
                      <BookOpen size={13} />
                      <div><strong>{analysis.referencia_titulo}</strong><small>{analysis.cita || "Referencia sin cita extendida"}</small></div>
                      {referenceUrl(analysis) && <a href={referenceUrl(analysis)} target="_blank" rel="noreferrer" title="Abrir referencia"><ExternalLink size={13} /></a>}
                    </div>
                  )}
                </div>
              ))}
              {!analyticalSamples.some((item) => item.analisis_detalle?.length) && (
                <div className="explorerMeasurements">
                  {measurements.map((row) => (
                    <div key={row.id_medicion || `${row.elemento}-${row.concentracion}`}>
                      <strong>{row.elemento}</strong>
                      <span>{checkAndFix(row.concentracion)} {row.unidad || "ppm"}</span>
                    </div>
                  ))}
                  {!measurements.length && <p>Sin mediciones químicas.</p>}
                </div>
              )}
            </div>
          </section>

          <section>
            <h3><Bone size={14} /> Paleopatologías <span>{pathologies.length}</span></h3>
            <div className="explorerPathologies">
              {pathologies.map((row) => (
                <div key={row.id_paleopatologia || row.patologia}><Bone size={13} /> {String(row.patologia).replaceAll("_", " ")}</div>
              ))}
              {!pathologies.length && <p>Sin presencias registradas.</p>}
            </div>
          </section>

          <section>
            <h3><CalendarDays size={14} /> Dataciones <span>{datings.length}</span></h3>
            <div className="explorerDatings">
              {datings.map((row) => (
                <div key={row.id_datacion}>
                  <strong>{valueOrDash(row.fecha_bp)} BP</strong>
                  <span>{valueOrDash(row.muestra)}</span>
                </div>
              ))}
              {!datings.length && <p>Sin dataciones asociadas.</p>}
            </div>
          </section>
        </div>
      )}

      {detail && (
        <footer>
          <button type="button" onClick={() => downloadDetail(detail)}><Download size={14} /> Descargar ficha JSON</button>
        </footer>
      )}
    </aside>
  );
}
