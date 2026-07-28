import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";

/**
 * AzapaTreeGraph
 * ------------------------------------------------------------------
 * Árbol navegable con d3-hierarchy (d3.tree). Reemplaza el layout
 * radial "de una vez todos los nodos" por una jerarquía real:
 *
 *   AZAPA (raíz)
 *    ├─ As
 *    │   ├─ individuo 1
 *    │   └─ individuo 2
 *    ├─ Li
 *    └─ ...
 *
 * - Clic en un nodo "elemento" -> colapsa/expande sus individuos.
 * - Clic en un nodo "individuo" -> onSelect(node) (igual que antes).
 * - Un individuo con mediciones en varios elementos cuelga del primer
 *   elemento pero muestra un badge "+N" con el resto en el tooltip.
 *
 * Props:
 *  - graph: grafo de "Red Completa" ({nodes, edges}) — necesita nodos
 *    type "elemento" e individuos conectados por aristas "mide".
 *  - focusElement: "" | "Red Completa" | nombre de elemento -> controla
 *    qué rama empieza expandida.
 *  - onSelect(node)
 *  - selectedNodeId
 *  - height
 */
export function AzapaTreeGraph({
    graph,
    focusElement = "Red Completa",
    onSelect,
    selectedNodeId = "",
    height = 620,
}) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const gRef = useRef(null);
    const zoomRef = useRef(null);
    const tooltipRef = useRef(null);
    const rootRef = useRef(null); // guarda el d3.hierarchy root entre renders (para expand/collapse persistente)

    // ---- construir estructura jerárquica a partir del grafo plano -------
    const hierarchyData = useMemo(() => {
        const nodes = graph?.nodes || [];
        const edges = graph?.edges || [];

        const elementNodes = nodes.filter((n) => n.type === "elemento");
        const individuoNodes = nodes.filter((n) => n.type === "individuo");
        const individuoById = new Map(individuoNodes.map((n) => [n.id, n]));

        // individuo -> lista de elementos que mide (para el badge "+N")
        const elementsByIndividuo = new Map();
        edges.forEach((e) => {
            if (e.label !== "mide") return;
            if (!individuoById.has(e.source)) return;
            const list = elementsByIndividuo.get(e.source) || [];
            list.push(e.elemento);
            elementsByIndividuo.set(e.source, list);
        });

        // asignar cada individuo a UN solo elemento padre (el primero que aparezca)
        const assignedTo = new Map(); // individuoId -> elementoLabel
        const childrenByElement = new Map(elementNodes.map((el) => [el.label, []]));

        edges
            .filter((e) => e.label === "mide")
            .forEach((e) => {
                const indiv = individuoById.get(e.source);
                if (!indiv) return;
                if (assignedTo.has(indiv.id)) return; // ya asignado a otro elemento
                assignedTo.set(indiv.id, e.elemento);
                const bucket = childrenByElement.get(e.elemento) || [];
                bucket.push({
                    ...indiv,
                    type: "individuo",
                    concentracion: e.concentracion,
                    unidad: e.unidad,
                    otrosElementos: (elementsByIndividuo.get(indiv.id) || []).filter((el) => el !== e.elemento),
                });
                childrenByElement.set(e.elemento, bucket);
            });

        const elementChildren = elementNodes
            .map((el) => ({
                id: el.id,
                label: el.label,
                type: "elemento",
                children: (childrenByElement.get(el.label) || []).sort((a, b) =>
                    String(a.label).localeCompare(String(b.label))
                ),
            }))
            .filter((el) => el.children.length > 0)
            .sort((a, b) => b.children.length - a.children.length); // elementos con más casos primero

        return {
            id: "azapa:root",
            label: "AZAPA",
            type: "root",
            children: elementChildren,
        };
    }, [graph]);

    // ---- setup zoom (una sola vez) --------------------------------------
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);
        const zoom = d3
            .zoom()
            .scaleExtent([0.3, 3])
            .on("zoom", (event) => g.attr("transform", event.transform));
        svg.call(zoom);
        zoomRef.current = zoom;
        return () => svg.on(".zoom", null);
    }, []);

    function resetView() {
        const svg = d3.select(svgRef.current);
        if (zoomRef.current) {
            const width = containerRef.current?.clientWidth || 980;
            svg
                .transition()
                .duration(400)
                .call(zoomRef.current.transform, d3.zoomIdentity.translate(80, height / 2).scale(1));
        }
    }
    useEffect(() => {
        if (containerRef.current) containerRef.current.__resetView = resetView;
    });

    // ---- construir jerarquía d3 + aplicar foco/colapso inicial ----------
    useEffect(() => {
        const root = d3.hierarchy(hierarchyData);
        root.x0 = height / 2;
        root.y0 = 0;

        const normalizedFocus = String(focusElement || "").trim();
        const focusOne =
            normalizedFocus && normalizedFocus !== "Red Completa" && normalizedFocus !== "Ninguna"
                ? normalizedFocus
                : null;

        root.children?.forEach((elementNode) => {
            const isFocused = !focusOne || elementNode.data.label === focusOne;
            if (!isFocused) {
                elementNode._children = elementNode.children;
                elementNode.children = null;
            }
        });

        rootRef.current = root;
        render();
    }, [hierarchyData, focusElement]);

    // ---- render imperativo (d3 general update pattern con transición) ---
    function render() {
        const root = rootRef.current;
        if (!root) return;

        const width = containerRef.current?.clientWidth || 980;
        const dx = 34; // separación vertical entre nodos hermanos
        const dy = (width - 260) / (maxDepth(root) || 1); // separación horizontal por nivel

        const treeLayout = d3.tree().nodeSize([dx, dy]);
        treeLayout(root);

        // reposicionar en horizontal: root a la izquierda
        root.each((d) => {
            d.y = d.depth * dy + 60;
        });

        const g = d3.select(gRef.current);
        g.selectAll("*").remove();
        g.attr("transform", `translate(80, ${height / 2})`);

        const nodesArr = root.descendants();
        const linksArr = root.links();

        const linkGen = d3
            .linkHorizontal()
            .x((d) => d.y)
            .y((d) => d.x);

        g.append("g")
            .attr("class", "tree-links")
            .selectAll("path")
            .data(linksArr)
            .join("path")
            .attr("fill", "none")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1.6)
            .attr("stroke-opacity", 0.6)
            .attr("d", linkGen);

        const nodeGroup = g.append("g").attr("class", "tree-nodes");
        const nodeSel = nodeGroup
            .selectAll("g.tnode")
            .data(nodesArr, (d) => d.data.id)
            .join("g")
            .attr("class", "tnode")
            .attr("transform", (d) => `translate(${d.y},${d.x})`)
            .style("cursor", (d) => (d.data.type === "individuo" ? "pointer" : "pointer"));

        nodeSel.each(function (d) {
            const el = d3.select(this);
            const isRoot = d.data.type === "root";
            const isElement = d.data.type === "elemento";
            const isSelected = d.data.id === selectedNodeId;

            const r = isRoot ? 30 : isElement ? 22 : 10;
            const fill = isRoot ? "#0f172a" : isElement ? "#7c3aed" : sexoColor(d.data.sexo);

            el.append("circle")
                .attr("r", r)
                .attr("fill", fill)
                .attr("stroke", isSelected ? "#f59e0b" : "white")
                .attr("stroke-width", isSelected ? 4 : 2);

            // indicador de colapsado (anillo punteado) si tiene _children
            if (d._children) {
                el.append("circle")
                    .attr("r", r + 6)
                    .attr("fill", "none")
                    .attr("stroke", "#7c3aed")
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", "3 3");
            }

            // badge "+N" si el individuo mide otros elementos además del padre
            if (d.data.otrosElementos?.length) {
                el.append("circle")
                    .attr("cx", r - 2)
                    .attr("cy", -r + 2)
                    .attr("r", 8)
                    .attr("fill", "#f59e0b");
                el.append("text")
                    .attr("x", r - 2)
                    .attr("y", -r + 5)
                    .attr("text-anchor", "middle")
                    .attr("font-size", 9)
                    .attr("font-weight", 800)
                    .attr("fill", "white")
                    .text(`+${d.data.otrosElementos.length}`);
            }

            el.append("text")
                .attr("dy", "0.32em")
                .attr("x", d.children || d._children ? -(r + 8) : r + 8)
                .attr("text-anchor", d.children || d._children ? "end" : "start")
                .attr("font-size", isRoot ? 13 : isElement ? 12 : 10)
                .attr("font-weight", isRoot || isElement ? 800 : 600)
                .attr("fill", "#1e293b")
                .text(d.data.label || d.data.id);

            if (d.data.type === "individuo" && d.data.concentracion != null) {
                el.append("text")
                    .attr("dy", "1.5em")
                    .attr("x", r + 8)
                    .attr("text-anchor", "start")
                    .attr("font-size", 9)
                    .attr("fill", "#64748b")
                    .text(`${d.data.concentracion} ${d.data.unidad || "ppm"}`);
            }
        });

        nodeSel
            .on("click", (event, d) => {
                event.stopPropagation();
                if (d.data.type === "individuo") {
                    onSelect?.(d.data);
                    return;
                }
                // elemento o raíz: expandir/colapsar
                if (d.children) {
                    d._children = d.children;
                    d.children = null;
                } else if (d._children) {
                    d.children = d._children;
                    d._children = null;
                }
                render();
            })
            .on("mouseenter", (event, d) => showTooltip(event, d))
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        function showTooltip(event, d) {
            const tt = tooltipRef.current;
            if (!tt) return;
            const isIndividuo = d.data.type === "individuo";
            const otros = d.data.otrosElementos?.length
                ? `<br/>También mide: ${d.data.otrosElementos.join(", ")}`
                : "";
            tt.innerHTML = `
        <strong>${d.data.label || d.data.id}</strong><br/>
        ${isIndividuo ? `Sexo: ${d.data.sexo || "s/d"} · Edad: ${d.data.edad || "s/d"}<br/>` : ""}
        ${isIndividuo && d.data.concentracion != null ? `${d.data.concentracion} ${d.data.unidad || "ppm"}<br/>` : ""}
        ${d.data.type === "elemento" ? `${(d.children || d._children || []).length} caso(s)` : ""}
        ${otros}
      `;
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
    }

    // re-pintar solo el resaltado cuando cambia la selección externa
    useEffect(() => {
        render();
    }, [selectedNodeId]);

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
            <div className="graphToolbar">
                <button type="button" className="secondary small" onClick={() => containerRef.current?.__resetView?.()}>
                    Reset vista
                </button>
                <span className="hint" style={{ margin: 0 }}>
                    Clic en un elemento para expandir/colapsar · clic en un caso para ver su detalle · rueda para zoom
                </span>
            </div>
            <svg ref={svgRef} viewBox={`0 0 ${containerRef.current?.clientWidth || 980} ${height}`} className="graph">
                <g ref={gRef} />
            </svg>
            <div ref={tooltipRef} className="graphTooltip" />
        </div>
    );
}

function sexoColor(sexo) {
    const s = String(sexo || "").toLowerCase();
    if (s.includes("masculino")) return "#2563eb";
    if (s.includes("femenino")) return "#dc2626";
    return "#737373";
}

function maxDepth(root) {
    let max = 0;
    root.each((d) => {
        if (d.depth > max) max = d.depth;
    });
    return Math.max(max, 1);
}