import React, { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { absoluteImageUrl } from "../lib/api";
import { checkAndFix } from "../lib/utils";

/**
 * InteractiveGraph
 * ------------------------------------------------------------------
 * Reemplazo de GraphSvg.jsx. Usa d3-force para el layout, d3-zoom
 * para pan/zoom y d3-drag para mover nodos. Todo se pinta de forma
 * imperativa (selection.join) en cada "tick" de la simulación, así
 * que no depende de re-renders de React durante el drag/zoom.
 *
 * Reglas de diseño (ajustes pedidos):
 * 1) La concentración SOLO se codifica con la posición radial
 *    (distancia al centro). El tamaño del círculo ya NO depende de
 *    la concentración (es fijo, o depende de nº de mediciones si
 *    se pasa `sizeBy="mediciones"`).
 * 2) La escala radial es logarítmica (d3.scaleLog) sobre percentiles
 *    reales de los datos, así un outlier no aplasta al resto contra
 *    el centro.
 * 3) La patología NUNCA es un nodo-centro que compite por el layout.
 *    Se representa como anillo(s) de color alrededor del individuo,
 *    igual en todos los modos. El "centro" del layout radial es
 *    siempre el elemento químico (o la referencia, en Azapa).
 *
 * Props:
 *  - graph: { nodes, edges, mode, summary }
 *  - elemento: string (elemento activo, para "distancia")
 *  - mode: "distancia" | "similitud" | "disperso"
 *  - onSelect(node)
 *  - selectedNodeId
 *  - imageNodes, showImages
 *  - showElementEdges
 *  - sizeBy: "fixed" | "mediciones"  (default "fixed")
 *  - height (default 620)
 */
export function InteractiveGraph({
    graph,
    elemento,
    mode = "distancia",
    onSelect,
    selectedNodeId = "",
    imageNodes = [],
    showImages = false,
    showElementEdges = true,
    sizeBy = "fixed",
    height = 620,
    hideElementNodes = false,
}) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const gRef = useRef(null);
    const simRef = useRef(null);
    const zoomRef = useRef(null);
    const tooltipRef = useRef(null);

    // ---- datos derivados (memo, no dependen del layout) ----------------
    const { nodesData, edgesData, concentrationById, maxConc, radiusScale } = useMemo(() => {
        const rawNodes = graph?.nodes || [];
        const rawEdges = graph?.edges || [];

        // Filtrar nodos de tipo elemento si hideElementNodes es true
        let filteredNodes = rawNodes;
        if (hideElementNodes) {
            filteredNodes = filteredNodes.filter(n => n.type !== "elemento");
        }

        // patologías: convertir aristas "presenta" (patologia -> individuo)
        // en un atributo `patologias` dentro de cada nodo individuo, y quitar
        // los nodos tipo "patologia" del layout (nunca deben ser centro).
        const patologiaNodesRaw = rawNodes.filter((n) => n.type === "patologia");
        const patologiaColor = d3.scaleOrdinal(
            patologiaNodesRaw.map((p) => p.id),
            d3.quantize(d3.interpolateRainbow, Math.max(patologiaNodesRaw.length, 1))
        );

        const patologiasByIndividuo = {};
        rawEdges.forEach((e) => {
            if (e.label !== "presenta") return;
            if (!patologiaNodesRaw.some((p) => p.id === e.source)) return;
            patologiasByIndividuo[e.target] = patologiasByIndividuo[e.target] || [];
            patologiasByIndividuo[e.target].push({
                id: e.source,
                color: patologiaColor(e.source),
            });
        });

        const nodes = rawNodes
            .filter((n) => n.type !== "patologia") // nunca nodo-centro
            .map((n) => ({
                ...n,
                patologias: patologiasByIndividuo[n.id] || [],
            }));

        // concentración por individuo (para el elemento activo, o cualquiera si no hay filtro)
        const concentrationById = {};
        rawEdges.forEach((e) => {
            if (e.label !== "mide") return;
            const val = e.concentracion !== undefined && e.concentracion !== null ? Number(e.concentracion) : null;
            if (val === null) return;
            if (elemento && e.elemento && String(e.elemento) !== String(elemento)) return;
            concentrationById[e.source] = val;
        });

        const values = Object.values(concentrationById).filter((v) => v > 0);
        const maxConc = values.length ? Math.max(...values) : 1;

        // Escala LOG: evita que un outlier absorba todo el rango.
        const minV = values.length ? Math.min(...values) : 1;
        const maxV = values.length ? Math.max(...values) : 10;
        const radiusScale = d3
            .scaleLog()
            .domain([Math.max(minV, 0.01), Math.max(maxV, minV + 1)])
            .range([0, 320])
            .clamp(true);

        const validIds = new Set(filteredNodes.map(n => n.id));
        const filteredEdges = rawEdges.filter(
            e => validIds.has(e.source) && validIds.has(e.target)
        );

        return {
            nodesData: filteredNodes,
            edgesData: filteredEdges,
            concentrationById,
            maxConc,
            radiusScale,
        };
    }, [graph, elemento, hideElementNodes]);

    const sexoColor = (sexo) => {
        const s = String(sexo || "").toLowerCase();
        if (s.includes("masculino")) return "#2563eb";
        if (s.includes("femenino")) return "#dc2626";
        return "#737373";
    };

    const nodeFill = (d) => {
        if (d.type === "elemento") return "#7c3aed";
        if (d.isCentral) return "#7c3aed"; // central se ve como elemento
        if (d.type === "imagen") return "#ec4899";
        if (d.type === "sitio") return "#2d3748";
        return sexoColor(d.sexo);
    };

    const nodeRadius = (d) => {
        if (d.type === "elemento") return 26;
        if (d.isCentral) return 42; // central también grande
        if (d.type === "imagen") return 20;
        if (sizeBy === "mediciones" && typeof d.mediciones === "object") {
            const n = Object.keys(d.mediciones || {}).length;
            return 10 + Math.min(10, n * 2);
        }
        return 12;
    };

    // ---------------------------------------------------------------
    // Setup inicial de svg / zoom (una sola vez)
    // ---------------------------------------------------------------
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);

        const zoom = d3
            .zoom()
            .scaleExtent([0.15, 5])
            .on("start", () => {
                svg.style("cursor", "grabbing");
            })
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            })
            .on("end", () => {
                svg.style("cursor", "grab");
            });

        svg.call(zoom);
        zoomRef.current = zoom;

        return () => {
            svg.on(".zoom", null);
        };
    }, []);

    function resetView() {
        const svg = d3.select(svgRef.current);
        if (zoomRef.current) {
            svg.transition().duration(400).call(zoomRef.current.transform, d3.zoomIdentity);
        }
    }
    // expuesto para el botón externo (ver GraphToolbar más abajo)
    useEffect(() => {
        if (containerRef.current) containerRef.current.__resetView = resetView;
    });

    // ---------------------------------------------------------------
    // Simulación de fuerzas + render imperativo
    // ---------------------------------------------------------------
    useEffect(() => {
        const width = containerRef.current?.clientWidth || 980;
        const center = { x: width / 2, y: height / 2 };

        const nodes = nodesData.map((d) => ({ ...d }));
        const nodeById = new Map(nodes.map((d) => [d.id, d]));
        const links = edgesData
            .map((e) => ({ ...e, source: nodeById.get(e.source), target: nodeById.get(e.target) }))
            .filter((e) => e.source && e.target);

        // ---- fuerza radial custom: SOLO codifica concentración/posición ----
        function forceRadialConcentration(strength = 0.65) {
            let nodesRef;
            function force(alpha) {
                for (const n of nodesRef) {
                    if (n.type !== "individuo") continue;
                    const val = concentrationById[n.id];
                    const targetR = val && val > 0 ? radiusScale(val) : 340; // sin dato -> al borde
                    const dx = n.x - center.x || 0.001;
                    const dy = n.y - center.y || 0.001;
                    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                    const k = ((targetR - dist) / dist) * alpha * strength;
                    n.vx += dx * k;
                    n.vy += dy * k;
                }
            }
            force.initialize = (ns) => (nodesRef = ns);
            return force;
        }

        // Detectar si hay nodo elemento visible
        const hasElementNode = nodes.some(n => n.type === "elemento");
        // Buscar un nodo central (sitio) cuando no hay elemento
        let centralNode = null;
        if (!hasElementNode) {
            // Buscar el nodo que representa el sitio (label MORRO1 o AZAPA)
            centralNode = nodes.find(n =>
                n.type === "patologia" &&
                (n.label === "MORRO1" || n.label === "AZAPA140" || n.label?.includes("MORRO1") || n.label?.includes("AZAPA140"))
            );
            if (centralNode) {
                centralNode.isCentral = true;
            }
        }

        // Si hay elemento visible, fijarlo en el centro
        if (hasElementNode) {
            const elementNode = nodes.find(n => n.type === "elemento");
            if (elementNode) {
                elementNode.fx = center.x;
                elementNode.fy = center.y;
            }
        } else if (centralNode) {
            // Si no hay elemento, fijar el nodo central (sitio) en el centro
            centralNode.fx = center.x;
            centralNode.fy = center.y;
        }

        const isRadialMode = mode === "distancia" && (hasElementNode || centralNode);

        const sim = d3
            .forceSimulation(nodes)
            .force(
                "link",
                d3
                    .forceLink(links)
                    .id((d) => d.id)
                    .distance((l) => (l.label === "mide" ? 140 : 90))
                    .strength(0.25)
            )
            .force("charge", d3.forceManyBody().strength(-90))
            .force("collide", d3.forceCollide((d) => nodeRadius(d) + 14))
            .force("center", d3.forceCenter(center.x, center.y).strength(isRadialMode ? 0 : 0.06));

        if (isRadialMode) {
            sim.force("radial", forceRadialConcentration());
        } else {
            sim.force(
                "x",
                d3.forceX(center.x).strength(0.03)
            ).force("y", d3.forceY(center.y).strength(0.03));
        }

        simRef.current = sim;

        const g = d3.select(gRef.current);
        g.selectAll("*").remove();

        // guías radiales (solo modo distancia)
        const guides = g.append("g").attr("class", "radial-guides");
        if (isRadialMode) {
            [90, 160, 230, 300].forEach((r) => {
                guides
                    .append("circle")
                    .attr("cx", center.x)
                    .attr("cy", center.y)
                    .attr("r", r)
                    .attr("fill", "none")
                    .attr("stroke", "#cbd5e1")
                    .attr("stroke-width", 1.5);
            });
        }

        const linkSel = g
            .append("g")
            .attr("class", "links")
            .selectAll("line")
            .data(
                links.filter((l) => {
                    if (l.source.type === "imagen" || l.target.type === "imagen") return false;
                    if (!showElementEdges && (l.source.type === "elemento" || l.target.type === "elemento")) return false;
                    return true;
                })
            )
            .join("line")
            .attr("stroke", (d) => (d.label === "similitud_quimica" ? "#334155" : "#94a3b8"))
            .attr("stroke-opacity", (d) => (d.label === "similitud_quimica" ? 0.4 : 0.5))
            .attr("stroke-width", (d) =>
                d.label === "similitud_quimica" ? 1 + Number(d.similarity || 0) * 5 : 1.6
            );

        const nodeGroup = g.append("g").attr("class", "nodes");
        const nodeSel = nodeGroup
            .selectAll("g.node")
            .data(nodes, (d) => d.id)
            .join((enter) => {
                const grp = enter.append("g").attr("class", "node");

                // anillos de patología (debajo del círculo principal, alrededor)
                grp.each(function (d) {
                    const el = d3.select(this);
                    (d.patologias || []).forEach((p, i) => {
                        el.append("circle")
                            .attr("class", "pat-ring")
                            .attr("r", nodeRadius(d) + 6 + i * 6)
                            .attr("fill", "none")
                            .attr("stroke", p.color)
                            .attr("stroke-width", 2.5);
                    });
                });

                grp
                    .append("circle")
                    .attr("class", "main-circle")
                    .attr("r", (d) => nodeRadius(d))
                    .attr("fill", (d) => nodeFill(d))
                    .attr("stroke", "white")
                    .attr("stroke-width", 2);

                // Texto del nodo: si es elemento o central, dentro del círculo
                grp
                    .append("text")
                    .attr("class", "node-label")
                    .attr("y", (d) => (d.type === "elemento" || d.isCentral) ? 4 : nodeRadius(d) + 14)
                    .attr("text-anchor", "middle")
                    .attr("font-size", (d) => (d.type === "elemento" || d.isCentral) ? 14 : 10)
                    .attr("font-weight", 700)
                    .attr("fill", (d) => (d.type === "elemento" || d.isCentral) ? "white" : "#334155")
                    .text((d) => d.numero_cuerpo || d.label || d.id);

                return grp;
            });

        nodeSel
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                event.stopPropagation();
                onSelect?.(d);
            })
            .on("mouseenter", (event, d) => {
                showTooltip(event, d);
            })
            .on("mousemove", (event) => {
                moveTooltip(event);
            })
            .on("mouseleave", hideTooltip)
            .call(
                d3
                    .drag()
                    .on("start", (event, d) => {
                        if (!event.active) sim.alphaTarget(0.25).restart();
                        d.fx = d.x;
                        d.fy = d.y;
                        d3.select(svgRef.current).style("cursor", "grabbing");
                    })
                    .on("drag", (event, d) => {
                        d.fx = event.x;
                        d.fy = event.y;
                    })
                    .on("end", (event, d) => {
                        if (!event.active) sim.alphaTarget(0);
                        if (d.type !== "elemento" && !d.isCentral) {
                            d.fx = null;
                            d.fy = null;
                        }
                        d3.select(svgRef.current).style("cursor", "grab");
                    })
            );

        function showTooltip(event, d) {
            const tt = tooltipRef.current;
            if (!tt) return;
            const conc = concentrationById[d.id];
            const patos = (d.patologias || []).map((p) => p.id.replace("patologia:", "")).join(", ");

            // Determinar si hay un elemento activo
            const hasElement = elemento && elemento.trim() !== "";   // <-- nuevo

            let html = `<strong>${d.numero_cuerpo || d.label || d.id}</strong><br/>`;
            if (d.type === "individuo") {
                html += `Sexo: ${d.sexo || "s/d"} · Edad: ${d.edad || "s/d"}<br/>`;
                if (conc) html += `Concentración: ${checkAndFix(conc)} ppm<br/>`;
                // Solo mostrar matriz y referencia si hay elemento activo
                if (hasElement) {
                    html += `Matriz: ${d.matriz || "s/d"}<br/>Referencia: ${d.referencia_datos || "s/d"}<br/>`;
                }
            }
            if (patos) html += `Patologías: ${patos}`;

            tt.innerHTML = html;
            tt.style.opacity = "1";
            moveTooltip(event);
        }

        function moveTooltip(event) {
            const tt = tooltipRef.current;
            if (!tt) return;
            const bounds = containerRef.current.getBoundingClientRect();
            tt.style.left = `${event.clientX - bounds.left + 14}px`;
            tt.style.top = `${event.clientY - bounds.top + 14}px`;
        }

        function hideTooltip() {
            if (tooltipRef.current) tooltipRef.current.style.opacity = "0";
        }

        // click en fondo = deseleccionar
        d3.select(svgRef.current).on("click", () => onSelect?.(null));

        sim.on("tick", () => {
            linkSel
                .attr("x1", (d) => d.source.x)
                .attr("y1", (d) => d.source.y)
                .attr("x2", (d) => d.target.x)
                .attr("y2", (d) => d.target.y);

            nodeSel.attr("transform", (d) => `translate(${d.x},${d.y})`);
        });

        return () => {
            sim.stop();
        };
    }, [nodesData, edgesData, mode, showElementEdges, sizeBy, height, concentrationById, radiusScale]);

    // resaltar selección sin reiniciar la simulación
    useEffect(() => {
        const g = d3.select(gRef.current);
        g.selectAll("g.node .main-circle")
            .attr("stroke", (d) => (d.id === selectedNodeId ? "#0f172a" : "white"))
            .attr("stroke-width", (d) => (d.id === selectedNodeId ? 4 : 2));
    }, [selectedNodeId]);

    // ---------------------------------------------------------------
    // imágenes flotantes alrededor del nodo seleccionado (overlay simple)
    // ---------------------------------------------------------------
    const selectedSimNode = useMemo(() => {
        if (!simRef.current || !selectedNodeId) return null;
        return simRef.current.nodes().find((n) => n.id === selectedNodeId) || null;
    }, [selectedNodeId, nodesData]);

    return (
        <div ref={containerRef} className="" style={{ position: "relative", width: "100%", cursor: "default" }}>
            <div className="graphToolbar">
                <button
                    type="button"
                    className="bg-slate-500/50 px-3 py-1 text-xs rounded-md text-white"
                    onClick={() => containerRef.current?.__resetView?.()}
                >
                    Reset vista
                </button>
                <span className="text-xs text-gray-600" style={{ margin: 0 }}>
                    Arrastra para mover · rueda para zoom · click en nodo para ver detalle
                </span>
            </div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${containerRef.current?.clientWidth || 980} ${height}`}
                className="graph"
                style={{ cursor: "grab", touchAction: "none" }}
            >
                <g ref={gRef} />
            </svg>

            <div ref={tooltipRef} className="graphTooltip" />
        </div>
    );
}

function ImageOverlay({ node, images }) {
    // Overlay HTML simple posicionado sobre el nodo seleccionado.
    // Se mantiene fuera del SVG para poder usar <img> normal (mejor caching / lazy loading).
    return (
        <div
            style={{
                position: "absolute",
                left: node.x,
                top: node.y,
                display: "flex",
                gap: 6,
                transform: "translate(20px, -50%)",
                pointerEvents: "none",
            }}
        >
            {images.slice(0, 6).map((img) => (
                <div
                    key={img.id_imagen}
                    style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "2px solid #7c3aed",
                        background: "white",
                        boxShadow: "0 4px 10px rgba(15,23,42,0.18)",
                    }}
                >
                    <img
                        src={absoluteImageUrl(img.url)}
                        alt={img.titulo || img.filename_original}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                </div>
            ))}
        </div>
    );
}