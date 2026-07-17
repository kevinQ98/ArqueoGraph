import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { checkAndFix } from "../lib/utils";

/**
 * TreeGraph (genérico)
 * ------------------------------------------------------------------
 * Árbol navegable con d3-hierarchy. Sirve para AZAPA (raíz -> elementos
 * -> individuos) y MORRO1 (raíz -> elementos y/o patologías ->
 * individuos), agrupando por CUALQUIER arista "mide" (individuo ->
 * elemento) y "presenta" (patologia -> individuo) presente en el grafo.
 *
 * REDISEÑO clave respecto a la versión anterior:
 *
 * 1) SIN DUPLICADOS. Antes, un individuo con mediciones en varios
 *    elementos se dibujaba como una hoja distinta por cada rama abierta
 *    (mismo id, "clonado" N veces), lo que inflaba el árbol y generaba
 *    curvas larguísimas y una vista imposible de encuadrar.
 *    Ahora cada individuo se renderiza UNA sola vez: en la primera rama
 *    que abras que lo contenga. Si abres una segunda rama que también
 *    lo tiene, NO se crea un nodo nuevo — se traza una línea punteada
 *    desde esa segunda rama hacia el nodo único ya existente.
 *
 * 2) AUTO-FIT. Después de cada expand/collapse la cámara (zoom/pan) se
 *    reajusta sola para encuadrar todo el árbol visible, así nunca te
 *    quedas "perdido" mirando una esquina vacía.
 *
 * Props:
 *  - graph: { nodes, edges }
 *  - rootLabel: texto del nodo raíz (ej. "AZAPA", "MORRO1")
 *  - focusGroup: "" | "Red Completa" | nombre de rama -> qué rama
 *    empieza expandida (compara contra el `label` de la rama)
 *  - onSelect(node)
 *  - selectedNodeId
 *  - height
 */
export function TreeGraph({
    graph,
    rootLabel = "Datos",
    focusGroup = "",
    onSelect,
    selectedNodeId = "",
    height = 620,
}) {
    const containerRef = useRef(null);
    const svgRef = useRef(null);
    const gRef = useRef(null);
    const zoomRef = useRef(null);
    const tooltipRef = useRef(null);
    const openBranchIdsRef = useRef(new Set());

    // ---- ramas con su lista COMPLETA de miembros (sin anidar todavía) ---
    const branches = useMemo(() => {
        const nodes = graph?.nodes || [];
        const edges = graph?.edges || [];

        const individuoById = new Map(nodes.filter((n) => n.type === "individuo").map((n) => [n.id, n]));
        const elementNodes = nodes.filter((n) => n.type === "elemento");
        const patologiaNodes = nodes.filter((n) => n.type === "patologia");

        // --- Construir mapa de elementos por individuo ---
        const elementosPorIndividuo = new Map();
        const medicionesPorIndividuo = new Map();
        edges.forEach((e) => {
            if (e.label === "mide") {
                const sourceId = e.source;
                const elemento = e.elemento;
                if (sourceId && elemento) {
                    // elementos (solo nombres)
                    if (!elementosPorIndividuo.has(sourceId)) {
                        elementosPorIndividuo.set(sourceId, new Set());
                    }
                    elementosPorIndividuo.get(sourceId).add(elemento);

                    // mediciones (con concentración y unidad)
                    if (!medicionesPorIndividuo.has(sourceId)) {
                        medicionesPorIndividuo.set(sourceId, {});
                    }
                    medicionesPorIndividuo.get(sourceId)[elemento] = {
                        concentracion: e.concentracion,
                        unidad: e.unidad || "ppm",
                    };
                }
            }
        });

        const elementBranches = elementNodes.map((el) => ({
            id: `grupo:elemento:${el.label}`,
            label: el.label,
            type: "grupo_elemento",
            referencia_datos: el.referencia_datos || null,
            matriz: el.matriz || null,
            members: edges
                .filter((e) => e.label === "mide" && e.elemento === el.label)
                .map((e) => {
                    console.log('QUE MIDEEES', e)
                    const indiv = individuoById.get(e.source);
                    if (!indiv) return null;
                    // Añadir la lista de elementos al individuo
                    const elementosSet = elementosPorIndividuo.get(indiv.id) || new Set();
                    const medicionesObj = medicionesPorIndividuo.get(indiv.id) || {};
                    return {
                        ...indiv,
                        type: "individuo",
                        concentracion: e.concentracion,
                        unidad: e.unidad,
                        elementos: Array.from(elementosSet).sort(), // orden alfabético
                        mediciones: medicionesObj,        // <-- NUEVO: todas las mediciones
                    };
                })
                .filter(Boolean)
                .sort((a, b) => String(a.label).localeCompare(String(b.label))),
        }));

        // Similar para patologías (no tienen elementos, pero por si acaso)
        const patologiaBranches = patologiaNodes.map((pat) => ({
            id: `grupo:patologia:${pat.label}`,
            label: pat.label,
            type: "grupo_patologia",
            members: edges
                .filter((e) => e.label === "presenta" && e.source === pat.id)
                .map((e) => {
                    const indiv = individuoById.get(e.target);
                    if (!indiv) return null;
                    // También podríamos agregar elementos aquí, pero no es necesario
                    return { ...indiv, type: "individuo" };
                })
                .filter(Boolean)
                .sort((a, b) => String(a.label).localeCompare(String(b.label))),
        }));

        return [...elementBranches, ...patologiaBranches]
            .filter((b) => b.members.length > 0)
            .sort((a, b) => b.members.length - a.members.length);
    }, [graph]);

    // ---- setup zoom (una sola vez) --------------------------------------
    useEffect(() => {
        const svg = d3.select(svgRef.current);
        const g = d3.select(gRef.current);
        const zoom = d3
            .zoom()
            .scaleExtent([0.15, 4])
            .on("zoom", (event) => g.attr("transform", event.transform));
        svg.call(zoom);
        zoomRef.current = zoom;
        return () => svg.on(".zoom", null);
    }, []);

    // ---- estado inicial de ramas abiertas (colapsado salvo focusGroup) --
    useEffect(() => {
        openBranchIdsRef.current = new Set();
        const normalizedFocus = String(focusGroup || "").trim();
        const isSpecific = normalizedFocus && normalizedFocus !== "Red Completa" && normalizedFocus !== "Ninguna";
        if (isSpecific) {
            const target = branches.find((b) => b.label === normalizedFocus);
            if (target) openBranchIdsRef.current.add(target.id);
        }
        buildAndRender(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branches, focusGroup]);

    useEffect(() => {
        buildAndRender(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedNodeId]);

    function toggleBranch(branchId) {
        const set = openBranchIdsRef.current;
        if (set.has(branchId)) set.delete(branchId);
        else set.add(branchId);
        buildAndRender(true);
    }

    // ---- construir jerarquía SIN duplicados + resolver cross-links ------
    function buildAndRender(shouldFit) {
        const width = containerRef.current?.clientWidth || 980;
        const openSet = openBranchIdsRef.current;

        const individualHomeUid = new Map(); // individuoId -> __uid del nodo ya renderizado
        const pendingCrossLinks = []; // { fromUid, individualId }

        // ---- INTERSECCIÓN: con 2+ ramas abiertas, solo se muestran los
        // individuos que están presentes en TODAS las ramas abiertas a la
        // vez ("match" entre elementos/patologías), no la unión de todos.
        // Con 1 sola rama abierta, se comporta como antes (todos sus casos).
        const openBranches = branches.filter((b) => openSet.has(b.id));
        let intersectionIds = null;
        if (openBranches.length > 1) {
            intersectionIds = openBranches
                .map((b) => new Set(b.members.map((m) => m.id)))
                .reduce((acc, set) => new Set([...acc].filter((id) => set.has(id))));
        }

        const branchNodes = branches.map((b) => {
            const node = {
                id: b.id,
                label: b.label,
                type: b.type,
                __uid: b.id,
                memberCount: b.members.length,
                children: null,
            };
            // Copiar metadatos desde el objeto branch original
            if (b.referencia_datos) node.referencia_datos = b.referencia_datos;
            if (b.matriz) node.matriz = b.matriz;

            if (openSet.has(b.id)) {
                const visibleMembers = intersectionIds ? b.members.filter((m) => intersectionIds.has(m.id)) : b.members;
                const children = [];
                visibleMembers.forEach((m) => {
                    if (!individualHomeUid.has(m.id)) {
                        const uid = `${b.id}::${m.id}`;
                        individualHomeUid.set(m.id, uid);
                        children.push({ ...m, __uid: uid });
                    } else {
                        pendingCrossLinks.push({ fromUid: b.id, individualId: m.id });
                    }
                });
                node.children = children;
                // solo se usa para la etiqueta cuando hay intersección activa
                node.matchedCount = intersectionIds ? visibleMembers.length : null;
            }
            return node;
        });

        const rootData = { id: "root", label: rootLabel, type: "root", __uid: "root", children: branchNodes };
        const root = d3.hierarchy(rootData);

        const dx = 30;
        const depth = maxDepth(root);
        const dy = Math.max(160, (width - 260) / depth);
        d3.tree().nodeSize([dx, dy])(root);
        root.each((d) => {
            d.y = d.depth * dy;
        });

        const g = d3.select(gRef.current);
        g.selectAll("*").remove();

        const nodesArr = root.descendants();
        const linksArr = root.links();
        const uidToNode = new Map(nodesArr.map((d) => [d.data.__uid, d]));

        const linkGen = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);

        g.append("g")
            .attr("class", "tree-links")
            .selectAll("path")
            .data(linksArr, (d) => d.target.data.__uid)
            .join("path")
            .attr("fill", "none")
            .attr("stroke", "#94a3b8")
            .attr("stroke-width", 1.6)
            .attr("stroke-opacity", 0.6)
            .attr("d", linkGen);

        // ---- cross-links: rama abierta -> nodo único ya existente ----------
        const crossLinks = pendingCrossLinks
            .map((cl) => {
                const source = uidToNode.get(cl.fromUid);
                const homeUid = individualHomeUid.get(cl.individualId);
                const target = homeUid ? uidToNode.get(homeUid) : null;
                return source && target ? { source, target } : null;
            })
            .filter(Boolean);

        const crossLinkGen = d3.linkHorizontal().x((d) => d.y).y((d) => d.x);

        g.append("g")
            .attr("class", "cross-links")
            .selectAll("path")
            .data(crossLinks, (d) => `${d.source.data.__uid}->${d.target.data.__uid}`)
            .join("path")
            .attr("fill", "none")
            .attr("stroke", "#f59e0b")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4 4")
            .attr("stroke-opacity", 0.8)
            .attr("pointer-events", "none")
            .attr("d", crossLinkGen);

        const nodeSel = g
            .append("g")
            .attr("class", "tree-nodes")
            .selectAll("g.tnode")
            .data(nodesArr, (d) => d.data.__uid)
            .join("g")
            .attr("class", "tnode")
            .attr("transform", (d) => `translate(${d.y},${d.x})`)
            .style("cursor", "pointer");

        nodeSel.each(function (d) {
            const el = d3.select(this);
            const isRoot = d.data.type === "root";
            const isGroup = d.data.type === "grupo_elemento" || d.data.type === "grupo_patologia";
            const isPatGroup = d.data.type === "grupo_patologia";
            const isSelected = d.data.id === selectedNodeId;
            const isOpenGroup = isGroup && openBranchIdsRef.current.has(d.data.id);

            const r = isRoot ? 30 : isGroup ? 22 : 10;
            const fill = isRoot ? "#0f172a" : isGroup ? (isPatGroup ? "#f59e0b" : "#7c3aed") : sexoColor(d.data.sexo);

            el.append("circle")
                .attr("r", r)
                .attr("fill", fill)
                .attr("stroke", isSelected ? "#f59e0b" : "white")
                .attr("stroke-width", isSelected ? 4 : 2);

            // anillo punteado si la rama tiene miembros pero está colapsada
            if (isGroup && !isOpenGroup && d.data.memberCount > 0) {
                el.append("circle")
                    .attr("r", r + 6)
                    .attr("fill", "none")
                    .attr("stroke", fill)
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", "3 3");
            }

            const labelText = isGroup
                ? d.data.matchedCount != null
                    ? `${d.data.label} (${d.data.matchedCount} en común)`
                    : `${d.data.label} (${d.data.memberCount})`
                : d.data.label || d.data.id;

            el.append("text")
                .attr("dy", "0.32em")
                .attr("x", d.children ? -(r + 8) : r + 8)
                .attr("text-anchor", d.children ? "end" : "start")
                .attr("font-size", isRoot ? 13 : isGroup ? 12 : 10)
                .attr("font-weight", isRoot || isGroup ? 800 : 600)
                .attr("fill", "#1e293b")
                .text(labelText);

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
                    const { __uid, ...clean } = d.data;
                    onSelect?.(clean);
                    return;
                }
                if (d.data.type === "grupo_elemento" || d.data.type === "grupo_patologia") {
                    toggleBranch(d.data.id);
                }
            })
            .on("mouseenter", (event, d) => showTooltip(event, d))
            .on("mousemove", moveTooltip)
            .on("mouseleave", hideTooltip);

        function showTooltip(event, d) {
            const tt = tooltipRef.current;
            if (!tt) return;
            const isIndividuo = d.data.type === "individuo";
            const isGroupNode = d.data.type === "grupo_elemento" || d.data.type === "grupo_patologia";

            let extraInfo = "";
            if (isGroupNode) {
                const memberInfo = d.data.matchedCount != null
                    ? `${d.data.matchedCount} caso(s) en común con las otras ramas abiertas (de ${d.data.memberCount} en total) · clic para colapsar`
                    : `${d.data.memberCount} caso(s) · clic para expandir <br/>`;
                extraInfo += memberInfo;

                if (d.data.type === "grupo_elemento") {
                    const ref = d.data.referencia_datos || "s/d";
                    // const mat = d.data.matriz || "s/d";
                    extraInfo += `<strong>Referencia:</strong> ${ref}<br/>`;
                }
            }

            if (isIndividuo) {
                // const ref = d.data.referencia_datos || "s/d";
                const mat = d.data.matriz || "s/d";
                const mediciones = d.data.mediciones || {};
                const listaMediciones = Object.entries(mediciones)
                    .map(([el, val]) => `${el}: ${checkAndFix(val.concentracion) ?? "—"} ${val.unidad || "ppm"}`)
                    .join("<br/>");
                const elementosStr = d.data.elementos?.length
                    ? d.data.elementos.join(", ")
                    : "ninguno";
                extraInfo += `<strong>Elementos:</strong> ${elementosStr}<br/>`;
                extraInfo += `<strong>Mediciones:</strong><br/>${listaMediciones || "—"}<br/>`;
                extraInfo += `<strong>Matriz:</strong> ${mat}<br/>`;
            }

            tt.innerHTML = `
        <strong>${d.data.label || d.data.id}</strong><br/>
        ${isIndividuo ? `Sexo: ${d.data.sexo || "s/d"} · Edad: ${d.data.edad || "s/d"}<br/>` : ""}
        ${isIndividuo && d.data.concentracion != null ? `${checkAndFix(d.data.concentracion)} ${d.data.unidad || "ppm"}<br/>` : ""}
        ${extraInfo}
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

        d3.select(svgRef.current).on("click", () => onSelect?.(null));

        if (shouldFit) fitToView(nodesArr, width);
    }

    // ---- encuadra automáticamente todo el contenido visible --------------
    function fitToView(nodesArr, containerWidth) {
        if (!zoomRef.current || !nodesArr.length) return;
        const xs = nodesArr.map((d) => d.y);
        const ys = nodesArr.map((d) => d.x);
        const padding = 60;
        const minX = Math.min(...xs) - padding;
        const maxX = Math.max(...xs) + 220; // espacio para las etiquetas a la derecha
        const minY = Math.min(...ys) - padding;
        const maxY = Math.max(...ys) + padding;
        const contentW = Math.max(maxX - minX, 1);
        const contentH = Math.max(maxY - minY, 1);

        const scale = Math.min(1.4, containerWidth / contentW, height / contentH);
        const translateX = (containerWidth - contentW * scale) / 2 - minX * scale;
        const translateY = (height - contentH * scale) / 2 - minY * scale;

        const svg = d3.select(svgRef.current);
        svg
            .transition()
            .duration(450)
            .call(zoomRef.current.transform, d3.zoomIdentity.translate(translateX, translateY).scale(scale));
    }

    return (
        <div ref={containerRef} style={{ position: "relative", width: "100%", cursor: "default" }}>
            <div className="graphToolbar">
                <button
                    type="button"
                    className="secondary small"
                    onClick={() => {
                        const g = d3.select(gRef.current);
                        const nodesArr = g.selectAll("g.tnode").data();
                        fitToView(nodesArr, containerRef.current?.clientWidth || 980);
                    }}
                >
                    Encuadrar vista
                </button>
                <span className="hint" style={{ margin: 0 }}>
                    Clic en una rama para expandir/colapsar · con 1 rama abierta ves todos sus casos · con 2+ ramas
                    abiertas solo se muestran los casos EN COMÚN entre ellas · rueda para zoom
                </span>
            </div>
            <svg
                ref={svgRef}
                viewBox={`0 0 ${containerRef.current?.clientWidth || 980} ${height}`}
                className="graph"
                style={{ cursor: "default" }}
            >
                <g ref={gRef} />
            </svg>
            <div ref={tooltipRef} className="graphTooltip" />
        </div>
    );
}

// Alias de compatibilidad con el nombre anterior.
export function AzapaTreeGraph({ graph, focusElement, onSelect, selectedNodeId, height }) {
    return (
        <TreeGraph
            graph={graph}
            rootLabel="AZAPA"
            focusGroup={focusElement}
            onSelect={onSelect}
            selectedNodeId={selectedNodeId}
            height={height}
        />
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