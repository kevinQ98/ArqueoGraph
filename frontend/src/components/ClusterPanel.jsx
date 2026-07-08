import React, { useEffect, useMemo, useState } from "react";
import { Download, GitBranch, Network, RefreshCw, Table2 } from "lucide-react";
import { getClusters, getDistanceMatrix, getGraphmlUrl } from "../lib/api";

const clusterColors = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#f97316",
  "#0891b2",
  "#be123c",
  "#64748b"
];

function colorForCluster(id) {
  return clusterColors[(Number(id) - 1) % clusterColors.length];
}

function sexoColor(sexo) {
  const s = String(sexo || "").toLowerCase();
  if (s.includes("masculino")) return "#2563eb";
  if (s.includes("femenino")) return "#dc2626";
  return "#737373";
}

function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const s = value === null || value === undefined ? "" : String(value);
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
}

function Heatmap({ matrix, labels }) {
  if (!matrix?.length) return <p className="hint">No hay matriz disponible.</p>;
  const max = Math.max(...matrix.flat(), 1);
  return (
    <div className="heatmapWrap">
      <div className="heatmapGrid" style={{ gridTemplateColumns: `120px repeat(${labels.length}, 34px)` }}>
        <div />
        {labels.map((label, i) => <div key={`h-${i}`} className="heatLabel rotate">{label.replace("Caso ", "C")}</div>)}
        {matrix.map((row, i) => (
          <React.Fragment key={`row-${i}`}>
            <div className="heatLabel">{labels[i].replace("Caso ", "C")}</div>
            {row.map((value, j) => {
              const opacity = value === 0 ? 0.08 : 0.15 + (value / max) * 0.75;
              return (
                <div
                  key={`${i}-${j}`}
                  className="heatCell"
                  title={`${labels[i]} ↔ ${labels[j]}: ${value}`}
                  style={{ background: `rgba(15, 23, 42, ${opacity})` }}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function ClusterGraph({ clusters }) {
  const width = 960;
  const height = 580;
  const centerX = width / 2;
  const centerY = height / 2;

  const clusterPositions = {};
  const peoplePositions = {};
  const totalClusters = Math.max(clusters.length, 1);
  const clusterRadius = 190;

  clusters.forEach((cluster, idx) => {
    const angle = (2 * Math.PI * idx) / totalClusters - Math.PI / 2;
    const cx = centerX + Math.cos(angle) * clusterRadius;
    const cy = centerY + Math.sin(angle) * clusterRadius;
    clusterPositions[cluster.cluster_id] = { x: cx, y: cy };

    const members = cluster.members || [];
    members.forEach((m, mIdx) => {
      const localAngle = (2 * Math.PI * mIdx) / Math.max(members.length, 1);
      const localRadius = 62 + Math.min(30, members.length * 5);
      peoplePositions[m.id_individuo] = {
        x: cx + Math.cos(localAngle) * localRadius,
        y: cy + Math.sin(localAngle) * localRadius,
      };
    });
  });

  return (
    <svg id="cluster-svg" viewBox={`0 0 ${width} ${height}`} className="graph">
      <defs>
        <filter id="clusterShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
        </filter>
      </defs>

      {clusters.map((cluster) => {
        const cpos = clusterPositions[cluster.cluster_id];
        const color = colorForCluster(cluster.cluster_id);
        return (
          <g key={`cluster-${cluster.cluster_id}`}>
            {(cluster.members || []).map((m) => {
              const p = peoplePositions[m.id_individuo];
              return (
                <line
                  key={`edge-${cluster.cluster_id}-${m.id_individuo}`}
                  x1={cpos.x}
                  y1={cpos.y}
                  x2={p.x}
                  y2={p.y}
                  stroke={color}
                  strokeWidth="2"
                  opacity="0.35"
                />
              );
            })}
            <circle cx={cpos.x} cy={cpos.y} r="42" fill={color} filter="url(#clusterShadow)" />
            <text x={cpos.x} y={cpos.y - 4} textAnchor="middle" className="catText">Cluster</text>
            <text x={cpos.x} y={cpos.y + 15} textAnchor="middle" className="catText">{cluster.cluster_id}</text>
          </g>
        );
      })}

      {clusters.flatMap((cluster) => (cluster.members || []).map((m) => {
        const p = peoplePositions[m.id_individuo];
        return (
          <g key={m.id_individuo}>
            <circle
              cx={p.x}
              cy={p.y}
              r="16"
              fill={sexoColor(m.sexo)}
              stroke="white"
              strokeWidth="2"
              filter="url(#clusterShadow)"
            />
            <circle
              cx={p.x + 12}
              cy={p.y - 12}
              r="6"
              fill={colorForCluster(cluster.cluster_id)}
              stroke="white"
              strokeWidth="1"
            />
            <text x={p.x} y={p.y + 30} textAnchor="middle" className="nodeText">
              {m.id_documento}
            </text>
            <text x={p.x} y={p.y + 43} textAnchor="middle" className="nodeSubText">
              {m.numero_cuerpo}
            </text>
          </g>
        );
      }))}
    </svg>
  );
}

function SimpleDendrogram({ merges, labels }) {
  if (!merges?.length) return <p className="hint">No hay dendrograma suficiente para mostrar.</p>;

  const width = 960;
  const height = 420;
  const leafCount = labels.length;
  const leafGap = width / Math.max(leafCount + 1, 2);
  const maxDistance = Math.max(...merges.map(m => m.distance), 1);

  const nodePos = {};
  labels.forEach((label, idx) => {
    nodePos[idx] = {
      x: leafGap * (idx + 1),
      y: height - 50,
      label
    };
  });

  const lines = [];
  merges.forEach((merge) => {
    const left = nodePos[merge.left];
    const right = nodePos[merge.right];
    if (!left || !right) return;
    const y = height - 50 - (merge.distance / maxDistance) * (height - 115);
    const x = (left.x + right.x) / 2;
    lines.push({ x1: left.x, y1: left.y, x2: left.x, y2: y });
    lines.push({ x1: right.x, y1: right.y, x2: right.x, y2: y });
    lines.push({ x1: left.x, y1: y, x2: right.x, y2: y });
    nodePos[merge.new_cluster] = { x, y, label: `C${merge.new_cluster}` };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="dendrogram">
      {lines.map((l, idx) => (
        <line key={idx} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#334155" strokeWidth="2" opacity="0.72" />
      ))}
      {labels.map((label, idx) => (
        <g key={idx}>
          <circle cx={nodePos[idx].x} cy={nodePos[idx].y} r="5" fill="#0f172a" />
          <text x={nodePos[idx].x} y={nodePos[idx].y + 20} textAnchor="middle" className="nodeSubText">
            {label.replace("Caso ", "C")}
          </text>
        </g>
      ))}
      <text x="20" y="28" className="nodeText">Dendrograma simple por distancia química</text>
      <text x="20" y="46" className="nodeSubText">Más arriba = unión a mayor distancia</text>
    </svg>
  );
}

export function ClusterPanel({ options }) {
  const [elements, setElements] = useState("Mn,As,Ba");
  const [k, setK] = useState(3);
  const [linkage, setLinkage] = useState("average");
  const [sexo, setSexo] = useState("");
  const [estado, setEstado] = useState("");
  const [clusters, setClusters] = useState({ clusters: [], merges: [], matrix: [], labels: [], elements: [] });
  const [matrix, setMatrix] = useState({ matrix: [], labels: [] });
  const [status, setStatus] = useState("");

  async function load() {
    setStatus("Calculando clusters...");
    try {
      const [c, m] = await Promise.all([
        getClusters({ elements, k, linkage, sexo, estado }),
        getDistanceMatrix({ elements, sexo, estado })
      ]);
      setClusters(c);
      setMatrix(m);
      setStatus("");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const assignmentRows = useMemo(() => {
    return (clusters.clusters || []).flatMap(cluster =>
      (cluster.members || []).map(member => ({
        cluster: cluster.cluster_id,
        id_individuo: member.id_individuo,
        caso: member.id_documento,
        numero_cuerpo: member.numero_cuerpo,
        sexo: member.sexo,
        edad: member.edad,
        estilo_momificacion: member.estilo_momificacion,
      }))
    );
  }, [clusters]);

  function exportAssignments() {
    downloadText("arqueograph_clusters.csv", rowsToCsv(assignmentRows), "text/csv");
  }

  function exportClusterSvg() {
    const svg = document.getElementById("cluster-svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    downloadText("arqueograph_clusters.svg", clone.outerHTML, "image/svg+xml");
  }

  function exportGraphml(mode = "cluster") {
    const url = getGraphmlUrl({ mode, elements, k, sexo, estado });
    window.open(url, "_blank");
  }

  return (
    <div className="clustersPage">
      <section className="panel">
        <div className="clusterHeader">
          <div>
            <h2><GitBranch size={18} /> Clustering jerárquico</h2>
            <p className="hint">Agrupa individuos según similitud química normalizada.</p>
          </div>
          <button className="secondary small" onClick={load}><RefreshCw size={15} /> Recalcular</button>
        </div>

        <div className="clusterControls">
          <label>Elementos<input value={elements} onChange={e => setElements(e.target.value)} placeholder="Mn,As,Ba" /></label>
          <label>Número de clusters<input type="number" min="1" max="12" value={k} onChange={e => setK(Number(e.target.value))} /></label>
          <label>Linkage<select value={linkage} onChange={e => setLinkage(e.target.value)}><option value="average">average</option><option value="single">single</option><option value="complete">complete</option></select></label>
          <label>Sexo<select value={sexo} onChange={e => setSexo(e.target.value)}><option value="">Todos</option>{(options.sexos || []).map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Estado<select value={estado} onChange={e => setEstado(e.target.value)}><option value="">Todos</option><option value="borrador">borrador</option><option value="revisar">revisar</option><option value="validado">validado</option><option value="descartado">descartado</option></select></label>
        </div>

        {status && <p className="status">{status}</p>}

        <div className="exportRow">
          <button className="secondary small" onClick={exportAssignments}><Download size={15} /> CSV clusters</button>
          <button className="secondary small" onClick={exportClusterSvg}><Download size={15} /> SVG clusters</button>
          <button className="secondary small" onClick={() => exportGraphml("cluster")}><Download size={15} /> GraphML cluster</button>
          <button className="secondary small" onClick={() => exportGraphml("similarity")}><Download size={15} /> GraphML similitud</button>
        </div>
      </section>

      <section className="panel">
        <h2><Network size={18} /> Grafo por cluster</h2>
        <ClusterGraph clusters={clusters.clusters || []} />
      </section>

      <section className="panel">
        <h2><GitBranch size={18} /> Dendrograma</h2>
        <SimpleDendrogram merges={clusters.merges || []} labels={clusters.labels || []} />
      </section>

      <section className="panel">
        <h2><Table2 size={18} /> Matriz de distancia química</h2>
        <Heatmap matrix={matrix.matrix || []} labels={matrix.labels || []} />
      </section>

      <section className="panel">
        <h2>Asignación de clusters</h2>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Cluster</th>
                <th>ID</th>
                <th>Caso</th>
                <th>Cuerpo</th>
                <th>Sexo</th>
                <th>Edad</th>
                <th>Estilo</th>
              </tr>
            </thead>
            <tbody>
              {assignmentRows.map(row => (
                <tr key={row.id_individuo}>
                  <td><span className="clusterBadge" style={{ background: colorForCluster(row.cluster) }}>{row.cluster}</span></td>
                  <td>{row.id_individuo}</td>
                  <td>{row.caso}</td>
                  <td>{row.numero_cuerpo}</td>
                  <td>{row.sexo}</td>
                  <td>{row.edad}</td>
                  <td>{row.estilo_momificacion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
