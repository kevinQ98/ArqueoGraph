// components/GraphLegend.jsx
import React from "react";
import { Info } from "lucide-react";
import { formatLabel } from "../lib/utils";

/**
 * CircleDotCase - Representa un caso (individuo) en la leyenda.
 * 
 * @param {string} borderColor - Color del borde (opcional). Si se proporciona, se añade un anillo alrededor.
 * @param {number} borderWidth - Grosor del borde (por defecto 3).
 * @param {string} className - Clases adicionales de Tailwind.
 * @param {string} innerColor - Color de relleno interior (por defecto "from-blue-500 from-50% to-red-500 to-50%").
 */
export function CircleDotCase({
    borderColor = null,
    borderWidth = 3,
    gap = 2,
    className = "",
    innerColor = "from-blue-500 from-50% to-red-500 to-50%",
    size = 4, // tamaño del círculo interior
}) {
    const containerSize = size + 2 * gap; // tamaño total incluyendo padding
    const containerClasses = `rounded-full ${className} shrink-0`;
    const containerStyle = {
        width: `${containerSize * 4}px`, // porque size=6 son 6*4=24px, necesitamos calcular en px
        height: `${containerSize * 4}px`,
        padding: `${gap}px`,
        border: borderColor ? `${borderWidth}px solid ${borderColor}` : 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const innerClasses = `w-full h-full rounded-full bg-linear-to-r ${innerColor}`;

    return (
        <div style={containerStyle} className={containerClasses}>
            <div className={innerClasses} />
        </div>
    );
}

export function GraphLegend({ mode, patologiaColorMap, patologiaNodes, stats }) {
    return (
        <div className="graphLegendCol">
            <section className="panel">
                <h2>Leyenda</h2>
                <div className="flex items-center gap-1.5 text-xs">
                    <CircleDotCase />
                    <span>Caso {mode === "disperso" ? "analizado" : ""}</span>
                </div>
                {mode === "distancia" && (
                    <div className="flex items-center gap-1.5 text-xs">
                        <CircleDotCase borderColor="#f59e0b" />
                        <span>Positivo a patología</span>
                    </div>
                )}
                {mode === "disperso" && patologiaNodes && (
                    <div className="space-y-2 mt-3">
                        {mode === "disperso" && patologiaNodes.map((p) => (
                            <div className="flex items-center gap-1.5 text-xs" key={p.id}>
                                <CircleDotCase borderColor={patologiaColorMap[p.id]} />
                                <span className="text-wrap">Positivo a <span className="italic font-semibold">{formatLabel(p.label, 'sentence')}</span></span>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="panel">
                <h2><Info size={16} /> Información</h2>
                <p className="hint">
                    {mode === "distancia"
                        ? "Cada punto representa un caso analizado. La posición radial indica la concentración relativa del elemento estudiado en ese caso."
                        : "Cada punto representa un caso del dataset analizado. Los anillos de color identifican los casos positivos según la patología asociada."}
                </p>
            </section>

            {stats && (
                <section className="panel legendStats">
                    <div className="flex justify-between items-center"><strong>{stats.total}</strong><span>Casos totales</span></div>
                    {stats.byPatologia.map((s) => (
                        <div key={s.id} className="flex items-center justify-between">
                            <strong style={{ color: s.color }}>{s.count}</strong>
                            <span className="text-wrap text-right text-xs">{formatLabel(s.label)} ({s.pct}%)</span>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}