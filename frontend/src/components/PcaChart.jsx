import React, { useMemo } from "react";

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

function normalizedCategory(value) {
  return String(value || "indeterminado").trim().toLowerCase().replace(/\s+/g, "");
}

function extent(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [min - 1, max + 1];
  const padding = (max - min) * 0.12;
  return [min - padding, max + padding];
}

export function PcaChart({ data, onSelect, colorBy = "sexo" }) {
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
    return { points, width, height, margin, xMin, xMax, yMin, yMax, x, y, ticks };
  }, [data]);

  if (!model) return null;
  const variance = data.explained_variance || {};
  const palette = colorBy === "edad" ? AGE_COLORS : SEX_COLORS;
  const colorLabel = colorBy === "edad" ? "edad" : "sexo";
  const pc1Label = `PC1 (${((variance.pc1 || 0) * 100).toFixed(1)}%)`;
  const pc2Label = `PC2 (${((variance.pc2 || 0) * 100).toFixed(1)}%)`;

  return (
    <div className="pcaChartWrap">
      <svg className="pcaChart" viewBox={`0 0 ${model.width} ${model.height}`} role="img" aria-label="Gráfico PCA de Morro 1">
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
        {model.points.map((point) => (
          <circle
            key={point.id}
            cx={model.x(point.pc1)}
            cy={model.y(point.pc2)}
            r="7"
            fill={palette[normalizedCategory(point[colorBy])] || palette.indeterminado}
            className="pcaPoint"
            tabIndex="0"
            onClick={() => onSelect?.(point)}
          >
            <title>{`${point.label} · ${point.sexo} · ${point.edad}\nPC1 ${point.pc1.toFixed(2)} · PC2 ${point.pc2.toFixed(2)}`}</title>
          </circle>
        ))}
        <text x={(model.margin.left + model.width - model.margin.right) / 2} y={model.height - 14} textAnchor="middle" className="pcaAxisLabel">{pc1Label}</text>
        <text transform={`translate(20 ${(model.margin.top + model.height - model.margin.bottom) / 2}) rotate(-90)`} textAnchor="middle" className="pcaAxisLabel">{pc2Label}</text>
      </svg>
      <div className="pcaLegend" aria-label={`Leyenda de ${colorLabel}`}>
        <strong>Color por {colorLabel}:</strong>
        {Object.entries(palette).map(([label, color]) => (
          <span key={label}><i style={{ background: color }} />{label}</span>
        ))}
      </div>
    </div>
  );
}
