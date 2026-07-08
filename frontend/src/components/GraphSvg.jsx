import React, { useMemo } from "react";
import { absoluteImageUrl } from "../lib/api";
import { useGraphPathologyData } from "../hooks/useGraphPathologyData";

// const SHOW_ELEMENT_EDGES = false; // true = mostrar líneas hacia el elemento central

const sexoColor = (sexo) => {
  const s = String(sexo || "").toLowerCase();
  if (s.includes("masculino")) return "#2563eb";
  if (s.includes("femenino")) return "#dc2626";
  return "#737373";
};

const nodeTypeColor = (node) => {
  if (node?.type === "elemento") return "#7c3aed";
  if (node?.type === "patologia") return "#f59e0b";
  if (node?.type === "imagen") return "#ec4899";
  return sexoColor(node?.sexo);
};

function getNodeValue(node, elemento) {
  if (node.concentracion !== undefined && node.concentracion !== null) return Number(node.concentracion);
  if (node.mediciones && node.mediciones[elemento]) return Number(node.mediciones[elemento].valor || 0);
  return 0;
}

function lineKey(edge, idx) {
  return `${edge.source}-${edge.target}-${idx}`;
}

export function GraphSvg({
  graph,
  elemento,
  mode = "distancia",
  onSelect,
  selectedNodeId = "",
  imageNodes = [],
  showImages = false,
  hideElementCenter = false,
  showElementEdges = true, // nuevo prop, default true
}) {
  const width = 980;
  const height = 620;

  const people = graph.nodes.filter((n) => n.type === "individuo");
  const elementNodes = graph.nodes.filter(
    (n) => n.type === "elemento" && (!elemento || n.elemento === elemento || n.label === elemento)
  );
  const patologiaNodes = graph.nodes.filter((n) => n.type === "patologia");
  const nodeLookup = Object.fromEntries((graph.nodes || []).map((n) => [n.id, n]));
  // If requested, treat element nodes as not present for layout and rendering
  const visibleElementNodes = hideElementCenter ? [] : elementNodes;
  // Map concentrations from edges: { personId: concentration }
  const concentrationById = (graph.edges || []).reduce((acc, e) => {
    if (!e) return acc;
    // edges from person -> elemento include 'elemento' and 'concentracion'
    try {
      const person = e.source;
      const el = e.elemento || (typeof e.target === 'string' && e.target.startsWith('elemento:') ? e.target.split(':')[1] : null);
      const conc = e.concentracion !== undefined && e.concentracion !== null ? Number(e.concentracion) : null;
      if (person && el && conc !== null) {
        // only set if matches selected elemento (if provided)
        if (!elemento || String(el) === String(elemento)) acc[person] = conc;
      }
    } catch (err) {
      // ignore
    }
    return acc;
  }, {});

  const { patologiaColorMap, positivosPorIndividuo } = useGraphPathologyData(graph);

  const maxConc = Math.max(...Object.values(concentrationById).map(v => Number(v || 0)), 1);

  const layout = useMemo(() => {
    const pos = {};

    const hasRelationalGraph = graph?.mode === "relational";

    if (hasRelationalGraph) {
      const center = { x: width / 2, y: height / 2 };
      const topRadius = 170;
      const innerRadius = 210;
      const patologiaRadius = 180; // Radio para distribuir patologías alrededor del centro
      pos.__center = center;

      // If there are pathology nodes, they take precedence
      if (patologiaNodes.length > 0) {
        if (patologiaNodes.length === 1) {
          // Single pathology goes to center
          pos[patologiaNodes[0].id] = center;
          const otherNodes = graph.nodes.filter((n) => n.type !== "individuo" && n.type !== "patologia" && !(hideElementCenter && n.type === "elemento"));
          otherNodes.forEach((node, idx) => {
            const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1);
            pos[node.id] = {
              x: center.x + Math.cos(angle) * innerRadius,
              y: center.y + Math.sin(angle) * innerRadius,
            };
          });
        } else {
          // Multiple pathologies distributed around center
          patologiaNodes.forEach((node, idx) => {
            const angle = (2 * Math.PI * idx) / Math.max(patologiaNodes.length, 1);
            pos[node.id] = {
              x: center.x + Math.cos(angle) * patologiaRadius,
              y: center.y + Math.sin(angle) * patologiaRadius,
            };
          });

          // Other nodes (like elements) positioned centrally or distributed
          const otherNodes = graph.nodes.filter((n) => n.type !== "individuo" && n.type !== "patologia" && !(hideElementCenter && n.type === "elemento"));
          otherNodes.forEach((node, idx) => {
            const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1);
            pos[node.id] = {
              x: center.x + Math.cos(angle) * (innerRadius * 0.5),
              y: center.y + Math.sin(angle) * (innerRadius * 0.5),
            };
          });
        }

        // Position individuals around their associated pathologies
        const pathologyEdges = graph.edges.filter((e) => e.label === "presenta");
        const positionedIndividuals = new Set();

        patologiaNodes.forEach((patNode) => {
          const connectedIndividuos = pathologyEdges
            .filter((e) => e.source === patNode.id)
            .map((e) => e.target);

          const patPos = pos[patNode.id];
          connectedIndividuos.forEach((personId, idx) => {
            const angle = (2 * Math.PI * idx) / Math.max(connectedIndividuos.length, 1);
            const radius = patologiaNodes.length === 1 ? 320 : 100; // Smaller radius for multiple
            pos[personId] = {
              x: patPos.x + Math.cos(angle) * radius,
              y: patPos.y + Math.sin(angle) * radius,
            };
            positionedIndividuals.add(personId);
          });
        });

        // Position remaining individuals (not connected to any pathology) around center
        const unpositionedPeople = people.filter((p) => !positionedIndividuals.has(p.id));
        const n_unpositioned = Math.max(unpositionedPeople.length, 1);
        unpositionedPeople.forEach((p, idx) => {
          const angle = (2 * Math.PI * idx) / n_unpositioned;
          pos[p.id] = {
            x: center.x + Math.cos(angle) * 280,
            y: center.y + Math.sin(angle) * 280,
          };
        });
      } else if (mode === "distancia" && visibleElementNodes.length === 1) {
        pos[visibleElementNodes[0].id] = center;
        const otherNodes = graph.nodes.filter((n) => n.type !== "individuo" && n.type !== "elemento");
        otherNodes.forEach((node, idx) => {
          const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1);
          pos[node.id] = {
            x: center.x + Math.cos(angle) * innerRadius,
            y: center.y + Math.sin(angle) * innerRadius,
          };
        });
      } else if (mode === "distancia" && visibleElementNodes.length > 1) {
        const startAngle = -Math.PI * 0.9;
        const endAngle = -Math.PI * 0.1;
        const segmentCount = Math.max(visibleElementNodes.length, 1);

        visibleElementNodes.forEach((node, idx) => {
          const angle = startAngle + ((endAngle - startAngle) * idx) / Math.max(segmentCount - 1, 1);
          pos[node.id] = {
            x: center.x + Math.cos(angle) * topRadius,
            y: center.y + Math.sin(angle) * topRadius,
          };
        });

        const otherNodes = graph.nodes.filter((n) => n.type !== "individuo" && n.type !== "elemento");
        otherNodes.forEach((node, idx) => {
          const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1);
          pos[node.id] = {
            x: center.x + Math.cos(angle) * innerRadius,
            y: center.y + Math.sin(angle) * innerRadius,
          };
        });
      } else {
        const otherNodes = graph.nodes.filter((n) => n.type !== "individuo");
        otherNodes.forEach((node, idx) => {
          const angle = (2 * Math.PI * idx) / Math.max(otherNodes.length, 1);
          pos[node.id] = {
            x: center.x + Math.cos(angle) * 210,
            y: center.y + Math.sin(angle) * 210,
          };
        });
      }

      const n = Math.max(people.length, 1);
      // Position people depending on mode. For distancia, position according to concentration.
      // But skip if already positioned by pathology logic
      const alreadyPositioned = new Set(Object.keys(pos));

      if (mode === "distancia" && patologiaNodes.length === 0) {
        // MinMax normalize concentrations across visible people and map to radii
        const values = people.map(p => {
          const v = (concentrationById && concentrationById[p.id] !== undefined) ? concentrationById[p.id] : getNodeValue(p, elemento) || 0;
          return Number(v || 0);
        });
        const minVal = Math.min(...values);
        const maxVal = Math.max(...values);
        const minRadius_rel = 80;
        const maxRadius_rel = 320;
        people.forEach((p, idx) => {
          if (alreadyPositioned.has(p.id)) return; // Skip if already positioned by pathology
          const angle = (2 * Math.PI * idx) / n;
          const raw = (concentrationById && concentrationById[p.id] !== undefined) ? concentrationById[p.id] : null;
          // treat 0 or null as missing: place at outer radius
          if (raw === null || Number(raw) <= 0) {
            pos[p.id] = {
              x: center.x + Math.cos(angle) * maxRadius_rel,
              y: center.y + Math.sin(angle) * maxRadius_rel,
            };
            return;
          }
          const value = Number(raw);
          let scaled = 0;
          if (maxVal > minVal) scaled = (value - minVal) / (maxVal - minVal);
          scaled = Math.max(0, Math.min(1, scaled));
          const radius = minRadius_rel + scaled * (maxRadius_rel - minRadius_rel);
          pos[p.id] = {
            x: center.x + Math.cos(angle) * radius,
            y: center.y + Math.sin(angle) * radius,
          };
        });
      } else {
        people.forEach((p, idx) => {
          if (alreadyPositioned.has(p.id)) return; // Skip if already positioned by pathology
          const angle = (2 * Math.PI * idx) / n;
          pos[p.id] = {
            x: center.x + Math.cos(angle) * 320,
            y: center.y + Math.sin(angle) * 320,
          };
        });
      }
      return pos;
    }

    if (mode === "similitud") {
      const center = { x: width / 2, y: height / 2 };
      const n = Math.max(people.length, 1);
      const radius = Math.min(width, height) * 0.34;
      people.forEach((p, idx) => {
        const angle = (2 * Math.PI * idx) / n;
        pos[p.id] = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      });
      return pos;
    }

    // dentro del useMemo de `layout`, agrega este bloque ANTES del check de "distancia"
    if (mode === "disperso") {
      const pos = {};
      const margin = 60;
      const cols = Math.ceil(Math.sqrt(people.length * (width / height)));
      const rows = Math.ceil(people.length / cols);
      const cellW = (width - margin * 2) / cols;
      const cellH = (height - margin * 2) / rows;

      // jitter determinístico basado en el id (mismo layout siempre para el mismo dataset)
      function seededJitter(id, range) {
        let hash = 0;
        for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
        return ((hash % 1000) / 1000 - 0.5) * range;
      }

      people.forEach((p, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        pos[p.id] = {
          x: margin + cellW * (col + 0.5) + seededJitter(p.id + "x", cellW * 0.6),
          y: margin + cellH * (row + 0.5) + seededJitter(p.id + "y", cellH * 0.6),
        };
      });
      return pos;
    }

    if (mode === "distancia") {
      const center = { x: width / 2, y: height / 2 };
      pos.__center = center;
      const n = Math.max(people.length, 1);
      const minPpm = 50;
      const maxPpm = 350;
      const minRadius = 80;
      const maxRadius = 320;
      people.forEach((p, idx) => {
        const value = getNodeValue(p, elemento);
        const clamped = Math.max(minPpm, Math.min(Number(value) || 0, maxPpm));
        const radius = minRadius + ((clamped - minPpm) / (maxPpm - minPpm)) * (maxRadius - minRadius);
        const angle = (2 * Math.PI * idx) / n;
        pos[p.id] = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius,
        };
      });
      return pos;
    }

    const center = { x: width / 2, y: height / 2 };
    const n = Math.max(people.length, 1);
    const radius = Math.min(width, height) * 0.34;
    people.forEach((p, idx) => {
      const angle = (2 * Math.PI * idx) / n;
      pos[p.id] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });

    return pos;
  }, [graph, mode, elemento, maxConc]);

  const center = layout.__center;
  const selectedPos = selectedNodeId ? layout[selectedNodeId] : null;

  const imageLayout = useMemo(() => {
    if (!showImages || !selectedPos || !imageNodes?.length) return [];
    const radius = 92;
    return imageNodes.map((img, idx) => {
      const angle = (-Math.PI / 2) + (2 * Math.PI * idx) / Math.max(imageNodes.length, 1);
      return {
        ...img,
        x: selectedPos.x + Math.cos(angle) * radius,
        y: selectedPos.y + Math.sin(angle) * radius,
      };
    });
  }, [showImages, selectedPos, imageNodes]);

  function PositivoRings({ x, y, baseRadius, positivos }) {
    if (!positivos?.length) return null;
    return (
      <>
        {positivos.map((p, idx) => (
          <circle
            key={p.id}
            cx={x}
            cy={y}
            r={baseRadius + 6 + idx * 6}
            fill="none"
            stroke={p.color}
            strokeWidth="2.5"
          />
        ))}
      </>
    );
  }

  return (
    <svg id="arqueograph-svg" viewBox={`0 0 ${width} ${height}`} className="graph">
      <defs>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.18" />
        </filter>
        <clipPath id="imageNodeClip">
          <rect x="-22" y="-22" width="44" height="44" rx="8" ry="8" />
        </clipPath>
      </defs>

      {mode === "distancia" && center && !hideElementCenter && (
        <g>
          {[80, 160, 240, 320].map((r) => (
            <circle key={r} cx={center.x} cy={center.y} r={r} fill="none" stroke="#cbd5e1" strokeWidth="2" />
          ))}
          <circle cx={center.x} cy={center.y} r="42" fill="#0f172a" filter="url(#softShadow)" />
          <text x={center.x} y={center.y - 3} textAnchor="middle" className="catText">{elemento}</text>
          <text x={center.x} y={center.y + 14} textAnchor="middle" className="catText">centro</text>
          <text x={center.x} y={center.y + 64} textAnchor="middle" className="nodeSubText">
            más cerca = mayor concentración
          </text>
          {/* scale labels removed - visual rings only */}
        </g>
      )}


      {graph.edges.map((edge, idx) => {
        // Optionally hide edges that connect to element nodes when element center hidden
        const sourceNode = nodeLookup[edge.source];
        const targetNode = nodeLookup[edge.target];
        // if (hideElementCenter && (sourceNode?.type === "elemento" || targetNode?.type === "elemento")) {
        //   return null;
        // }
        if (!showElementEdges &&
          (sourceNode?.type === "elemento" || targetNode?.type === "elemento" ||
            sourceNode?.type === "patologia" || targetNode?.type === "patologia")) {
          return null;
        }

        // NUEVO: las imágenes se muestran solo vía imageLayout al seleccionar un caso,
        // nunca deberían pintarse como línea suelta en el grafo principal
        if (sourceNode?.type === "imagen" || targetNode?.type === "imagen" || edge.label === "tiene_imagen") {
          return null;
        }

        // Ignora aristas "mide" que no correspondan al elemento seleccionado
        if (edge.label === "mide" && elemento && edge.elemento && edge.elemento !== elemento) {
          return null;
        }

        // oculta aristas hacia el elemento central (ya sea por el prop o por la constante)
        // if ((hideElementCenter || !showElementEdges) &&
        //   (sourceNode?.type === "elemento" || targetNode?.type === "elemento")) {
        //   return null;
        // }

        const source = layout[edge.source];
        // const target = layout[edge.target] || (mode === "distancia" ? center : null);
        const target = layout[edge.target];
        if (!source || !target) return null;
        if (!sourceNode || !targetNode) return null;

        const isSimilarity = edge.label === "similitud_quimica";
        const color = isSimilarity ? "#334155" : "#64748b";
        const widthLine = isSimilarity
          ? 1 + Number(edge.similarity || 0) * 6
          : 1.5 + Math.min(5, Number(edge.concentracion || 0) / maxConc * 5);

        return (
          <g key={lineKey(edge, idx)}>
            <line
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={color}
              strokeWidth={widthLine}
              opacity={isSimilarity ? 0.38 : 0.42}
            />
            {isSimilarity && (
              <title>{`Similitud: ${edge.similarity} | Distancia: ${edge.distance}`}</title>
            )}
          </g>
        );
      })}

      {showImages && selectedPos && imageLayout.map((img) => (
        <g key={`image-edge-${img.id_imagen}`}>
          <line
            x1={selectedPos.x}
            y1={selectedPos.y}
            x2={img.x}
            y2={img.y}
            stroke="#7c3aed"
            strokeWidth="2.5"
            opacity="0.55"
            strokeDasharray="5 4"
          />
        </g>
      ))}

      {graph.nodes.map((node) => {
        const p = layout[node.id];
        if (!p) return null;

        if (node.type === "elemento") {
          if (hideElementCenter) return null;
          return (
            <g key={node.id}>
              <rect x={p.x - 34} y={p.y - 22} width="68" height="44" rx="10" fill={nodeTypeColor(node)} stroke="white" strokeWidth="2" filter="url(#softShadow)" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="catText">{node.label}</text>
            </g>
          );
        }

        if (node.type === "patologia") {
          return (
            <g key={node.id}>
              <rect x={p.x - 40} y={p.y - 24} width="80" height="48" rx="10" fill={nodeTypeColor(node)} stroke="white" strokeWidth="2" filter="url(#softShadow)" />
              <text x={p.x} y={p.y + 4} textAnchor="middle" className="catText" fontSize="12">{node.label}</text>
            </g>
          );
        }

        // No renderizamos nodos tipo "imagen" aquí para evitar los rectángulos
        // de marcador (rosas). Las imágenes visuales se muestran mediante
        // el layout de `imageLayout` cuando `showImages` está activado.
        if (node.type === "imagen") {
          return null;
        }

        const rawVal = (concentrationById && concentrationById[node.id] !== undefined) ? concentrationById[node.id] : null;
        const value = (rawVal === null || Number(rawVal) <= 0) ? 0 : Number(rawVal);
        const r = 11 + Math.min(20, (value || 0) / maxConc * 20);
        const label = node.label || node.id;
        const isSelected = node.id === selectedNodeId;

        return (
          <g key={node.id} onClick={() => onSelect?.(node)} className="personNode">
            {isSelected && <circle cx={p.x} cy={p.y} r={r + 10} fill="#7c3aed" opacity="0.18" />}
            <circle cx={p.x} cy={p.y} r={r + 4} fill="white" opacity="0.8" />
            <circle cx={p.x} cy={p.y} r={r} fill={sexoColor(node.sexo)} stroke="white" strokeWidth="2" filter="url(#softShadow)" />
            <PositivoRings
              x={p.x}
              y={p.y}
              baseRadius={r}
              positivos={positivosPorIndividuo[node.id]}
            />
            <text x={p.x} y={p.y + r + 14} textAnchor="middle" className="nodeText">{label}</text>
            {mode !== "similitud" && (
              <text x={p.x} y={p.y + r + 27} textAnchor="middle" className="nodeSubText">{rawVal === null || Number(rawVal) <= 0 ? 'n.d.' : `${value} ppm`}</text>
            )}
          </g>
        );
      })}

      {showImages && imageLayout.map((img, idx) => {
        if (!img?.url) return null;
        const imageHref = absoluteImageUrl(img.url);
        return (
          <g key={`image-node-${img.id_imagen}`} transform={`translate(${img.x}, ${img.y})`} className="imageGraphNode">
            <rect x="-25" y="-25" width="50" height="50" rx="10" fill="white" stroke="#7c3aed" strokeWidth="2" filter="url(#softShadow)" />
            <image
              href={imageHref}
              xlinkHref={imageHref}
              x="-22"
              y="-22"
              width="44"
              height="44"
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#imageNodeClip)"
            />
            <text x="0" y="40" textAnchor="middle" className="nodeSubText">Imagen {idx + 1}</text>
            <title>{img.titulo || img.filename_original}</title>
          </g>
        );
      })}
    </svg>
  );
}
