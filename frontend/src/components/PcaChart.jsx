import { useMemo } from "react";

const SEX_COLORS = {
  femenino: "#dc2626",
  masculino: "#2563eb",
  indeterminado: "#64748b",
};

const AGE_COLORS = {
  adulto: "#7c3aed",
  subadulto: "#059669",
  indeterminado: "#64748b",
};

const PATHOLOGY_COLORS = {
  presente: "#f6c445",
  ausente: "#2ba9cf",
  sin_registro: "#5f646d",
};

const ELEMENT_VECTOR_COLORS = [
  "#fb923c",
  "#e879f9",
  "#a3e635",
  "#facc15",
  "#a78bfa",
  "#fb7185",
  "#38bdf8",
];

const CATEGORY_LABELS = {
  femenino: "Femenino",
  masculino: "Masculino",
  indeterminado: "Indeterminado",
  adulto: "Adulto",
  subadulto: "Subadulto",
  presente: "Presente",
  ausente: "Ausente",
  sin_registro: "Sin registro",
};

function normalizedCategory(value) {
  return String(value || "indeterminado").trim().toLowerCase().replace(/\s+/g, "");
}

function formatPathology(value) {
  const text = String(value || "").replaceAll("_", " ").trim();
  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "Patología";
}

function pointCategory(point, colorBy, selectedPathology) {
  if (colorBy === "patologia") {
    return point.pathology_status?.[selectedPathology] || "sin_registro";
  }
  return normalizedCategory(point[colorBy]);
}

function extent(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const padding = (max - min) * 0.12;
  return [min - padding, max + padding];
}

function signedValue(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

/**
 * Gráfico de PCA con proyección de puntos y vectores de carga.
 * @param {Object} props
 * @param {Object} props.data - Datos del PCA (points, loadings, explained_variance).
 * @param {Function} props.onSelect - Callback al seleccionar un punto.
 * @param {string} props.colorBy - "sexo" | "edad" | "patologia".
 * @param {string} props.selectedPathology - Patología seleccionada para color.
 * @returns {JSX.Element}
 */
export function PcaChart({ data, onSelect, colorBy = "sexo", selectedPathology = "" }) {
  const model = useMemo(() => {
    const points = data?.points || [];
    if (!points.length) return null;
    const width = 900;
    const height = 500;
    const margin = { top: 28, right: 32, bottom: 62, left: 72 };
    const [xMin, xMax] = extent(points.map((point) => point.pc1));
    const [yMin, yMax] = extent(points.map((point) => point.pc2));
    const x = (value) => margin.left + ((value - xMin) / (xMax - xMin)) * (width - margin.left - margin.right);
    const y = (value) => height - margin.bottom - ((value - yMin) / (yMax - yMin)) * (height - margin.top - margin.bottom);
    const ticks = Array.from({ length: 5 }, (_, index) => index / 4);
    const origin = { x: x(0), y: y(0) };
    const plotRight = width - margin.right;
    const plotBottom = height - margin.bottom;
    const loadings = (data?.loadings || []).map((loading, index) => ({
      ...loading,
      pc1: Number(loading.pc1) || 0,
      pc2: Number(loading.pc2) || 0,
      color: ELEMENT_VECTOR_COLORS[index % ELEMENT_VECTOR_COLORS.length],
      magnitude: Math.hypot(Number(loading.pc1) || 0, Number(loading.pc2) || 0),
      markerId: `pca-vector-arrow-${index}`,
    }));
    const maxMagnitude = Math.max(...loadings.map((loading) => loading.magnitude), 1);
    const desiredScale = Math.min(plotRight - margin.left, plotBottom - margin.top) * 0.34 / maxMagnitude;
    const fitScale = loadings.reduce((limit, loading) => {
      const constraints = [];
      if (loading.pc1 > 0) constraints.push((plotRight - origin.x - 24) / loading.pc1);
      if (loading.pc1 < 0) constraints.push((origin.x - margin.left - 24) / Math.abs(loading.pc1));
      if (loading.pc2 > 0) constraints.push((origin.y - margin.top - 24) / loading.pc2);
      if (loading.pc2 < 0) constraints.push((plotBottom - origin.y - 24) / Math.abs(loading.pc2));
      return Math.min(limit, ...constraints.filter((value) => Number.isFinite(value) && value > 0));
    }, Number.POSITIVE_INFINITY);
    const vectorScale = Math.min(desiredScale, fitScale);
    const occupiedLabels = [];
    const vectors = loadings.map((loading) => {
      const endX = origin.x + loading.pc1 * vectorScale;
      const endY = origin.y - loading.pc2 * vectorScale;
      const unitX = loading.magnitude ? loading.pc1 / loading.magnitude : 0;
      const unitY = loading.magnitude ? -loading.pc2 / loading.magnitude : 0;
      const labelX = Math.min(plotRight - 8, Math.max(margin.left + 8, endX + unitX * 12));
      const baseLabelY = Math.min(plotBottom - 8, Math.max(margin.top + 10, endY + unitY * 12));
      const textAnchor = unitX > 0.18 ? "start" : unitX < -0.18 ? "end" : "middle";
      const labelWidth = Math.max(16, String(loading.elemento || "").length * 8);
      const labelLeft = textAnchor === "start" ? labelX : textAnchor === "end" ? labelX - labelWidth : labelX - labelWidth / 2;
      let labelY = baseLabelY;
      for (const offset of [0, -16, 16, -32, 32, -48, 48]) {
        const candidateY = Math.min(plotBottom - 8, Math.max(margin.top + 12, baseLabelY + offset));
        const candidate = { left: labelLeft - 4, right: labelLeft + labelWidth + 4, top: candidateY - 15, bottom: candidateY + 4 };
        const overlaps = occupiedLabels.some((box) => (
          candidate.left < box.right
          && candidate.right > box.left
          && candidate.top < box.bottom
          && candidate.bottom > box.top
        ));
        labelY = candidateY;
        if (!overlaps) {
          occupiedLabels.push(candidate);
          break;
        }
      }
      return {
        ...loading,
        endX,
        endY,
        labelX,
        labelY,
        textAnchor,
        labelAdjusted: Math.abs(labelY - baseLabelY) > 1,
      };
    });
    return { points, vectors, origin, width, height, margin, xMin, xMax, yMin, yMax, x, y, ticks };
  }, [data]);

  if (!model) return null;
  const variance = data.explained_variance || {};
  const palette = colorBy === "patologia" ? PATHOLOGY_COLORS : colorBy === "edad" ? AGE_COLORS : SEX_COLORS;
  const colorLabel = colorBy === "patologia" ? formatPathology(selectedPathology) : colorBy === "edad" ? "edad" : "sexo";
  const pc1Label = `PC1 (${((variance.pc1 || 0) * 100).toFixed(1)}%)`;
  const pc2Label = `PC2 (${((variance.pc2 || 0) * 100).toFixed(1)}%)`;

  return (
    <div className="pcaChartWrap">
      <svg className="pcaChart" viewBox={`0 0 ${model.width} ${model.height}`} role="img" aria-label="Gráfico PCA del sitio">
        <defs>
          {model.vectors.map((vector) => (
            <marker key={vector.markerId} id={vector.markerId} markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M 0 0 L 9 4.5 L 0 9 z" fill={vector.color} />
            </marker>
          ))}
        </defs>
        {model.ticks.map((ratio) => {
          const xValue = model.xMin + ratio * (model.xMax - model.xMin);
          const xPos = model.x(xValue);
          return (
            <g key={`x-${ratio}`}>
              <line x1={xPos} x2={xPos} y1={model.margin.top} y2={model.height - model.margin.bottom} className="pcaGridLine" />
              <text x={xPos} y={model.height - model.margin.bottom + 24} textAnchor="middle" className="pcaTick">{xValue.toFixed(1)}</text>
            </g>
          );
        })}
        {model.ticks.map((ratio) => {
          const yValue = model.yMin + ratio * (model.yMax - model.yMin);
          const yPos = model.y(yValue);
          return (
            <g key={`y-${ratio}`}>
              <line x1={model.margin.left} x2={model.width - model.margin.right} y1={yPos} y2={yPos} className="pcaGridLine" />
              <text x={model.margin.left - 14} y={yPos + 4} textAnchor="end" className="pcaTick">{yValue.toFixed(1)}</text>
            </g>
          );
        })}
        {model.xMin <= 0 && model.xMax >= 0 && <line x1={model.x(0)} x2={model.x(0)} y1={model.margin.top} y2={model.height - model.margin.bottom} className="pcaZeroLine" />}
        {model.yMin <= 0 && model.yMax >= 0 && <line x1={model.margin.left} x2={model.width - model.margin.right} y1={model.y(0)} y2={model.y(0)} className="pcaZeroLine" />}
        <g className="pcaVectors" aria-label="Vectores de carga de los elementos">
          {model.vectors.map((vector) => (
            <g key={vector.elemento}>
              <line
                x1={model.origin.x}
                y1={model.origin.y}
                x2={vector.endX}
                y2={vector.endY}
                stroke={vector.color}
                markerEnd={`url(#${vector.markerId})`}
                className="pcaVectorLine"
              >
                <title>{`${vector.elemento}\nPC1 ${signedValue(vector.pc1)} · PC2 ${signedValue(vector.pc2)} · |v| ${vector.magnitude.toFixed(2)}`}</title>
              </line>
              {vector.labelAdjusted && (
                <line x1={vector.endX} y1={vector.endY} x2={vector.labelX} y2={vector.labelY - 4} stroke={vector.color} className="pcaVectorLabelGuide" />
              )}
              <text x={vector.labelX} y={vector.labelY} textAnchor={vector.textAnchor} fill={vector.color} className="pcaVectorLabel">
                {vector.elemento}
              </text>
            </g>
          ))}
          {model.vectors.length > 0 && <circle cx={model.origin.x} cy={model.origin.y} r="3" className="pcaVectorOrigin" />}
        </g>
        {model.points.map((point) => {
          const category = pointCategory(point, colorBy, selectedPathology);
          const pathologyLine = colorBy === "patologia"
            ? `\n${formatPathology(selectedPathology)}: ${CATEGORY_LABELS[category] || category}`
            : "";
          return (
            <circle
              key={point.id}
              cx={model.x(point.pc1)}
              cy={model.y(point.pc2)}
              r="7"
              fill={palette[category] || palette.indeterminado || PATHOLOGY_COLORS.sin_registro}
              className="pcaPoint"
              tabIndex="0"
              onClick={() => onSelect?.(point)}
            >
              <title>{`${point.label} · ${point.sexo} · ${point.edad}${pathologyLine}\nPC1 ${point.pc1.toFixed(2)} · PC2 ${point.pc2.toFixed(2)}`}</title>
            </circle>
          );
        })}
        <text x={(model.margin.left + model.width - model.margin.right) / 2} y={model.height - 14} textAnchor="middle" className="pcaAxisLabel">{pc1Label}</text>
        <text transform={`translate(20 ${(model.margin.top + model.height - model.margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="pcaAxisLabel">{pc2Label}</text>
      </svg>
      <div className="pcaLegend" aria-label={`Leyenda de ${colorLabel}`}>
        <strong>Color por {colorLabel}:</strong>
        {Object.entries(palette).map(([label, color]) => (
          <span key={label}><i style={{ background: color }} />{CATEGORY_LABELS[label] || label}</span>
        ))}
      </div>
      {model.vectors.length > 0 && (
        <div className="pcaVectorLegend" aria-label="Leyenda de vectores de elementos">
          <strong>Vectores de elementos</strong>
          <span className="pcaVectorLegendMeaning">Dirección PC1/PC2 · longitud relativa |v|</span>
          <div>
            {model.vectors.map((vector) => (
              <span key={vector.elemento} className="pcaVectorLegendItem">
                <i style={{ color: vector.color }} />
                <b>{vector.elemento}</b>
                <small>PC1 {signedValue(vector.pc1)} · PC2 {signedValue(vector.pc2)} · |v| {vector.magnitude.toFixed(2)}</small>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
