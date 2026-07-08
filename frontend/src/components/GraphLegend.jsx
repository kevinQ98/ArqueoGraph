// components/GraphLegend.jsx
import React from "react";
import { Info } from "lucide-react";

export function GraphLegend({ mode, patologiaColorMap, patologiaNodes, stats }) {
    return (
        <div className="graphLegendCol">
            <section className="panel">
                <h2>Leyenda</h2>
                <div className="legendRow">
                    <span className="legendDot" style={{ background: "#2563eb" }} />
                    <span>Caso {mode === "disperso" ? "analizado" : ""}</span>
                </div>
                {mode === "distancia" && (
                    <div className="legendRow">
                        <span className="legendRing" style={{ borderColor: "#f59e0b" }} />
                        <span>Positivo a patología</span>
                    </div>
                )}
                {mode === "disperso" && patologiaNodes.map((p) => (
                    <div className="legendRow" key={p.id}>
                        <span className="legendRing" style={{ borderColor: patologiaColorMap[p.id] }} />
                        <span>Positivo a {p.label}</span>
                    </div>
                ))}
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
                    <div><strong>{stats.total}</strong><span>Casos totales</span></div>
                    {stats.byPatologia.map((s) => (
                        <div key={s.id}>
                            <strong style={{ color: s.color }}>{s.count}</strong>
                            <span>{s.label} ({s.pct}%)</span>
                        </div>
                    ))}
                </section>
            )}
        </div>
    );
}