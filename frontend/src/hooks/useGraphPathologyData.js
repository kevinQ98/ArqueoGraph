import { useMemo } from "react";

const PATOLOGIA_COLORS = ["#f59e0b", "#16a34a", "#ec4899", "#6366f1", "#0ea5e9", "#dc2626", "#e5ff00", "#0d45fd"];

export function useGraphPathologyData(graph) {
    const patologiaNodes = useMemo(
        () => (graph?.nodes || []).filter((n) => n.type === "patologia"),
        [graph]
    );

    const patologiaColorMap = useMemo(() => {
        const map = {};
        patologiaNodes.forEach((p, idx) => {
            map[p.id] = PATOLOGIA_COLORS[idx % PATOLOGIA_COLORS.length];
        });
        return map;
    }, [patologiaNodes]);

    // { [individuoId]: [{ id, label, color }] }
    const positivosPorIndividuo = useMemo(() => {
        const nodeLookup = Object.fromEntries((graph?.nodes || []).map((n) => [n.id, n]));
        const result = {};
        (graph?.edges || []).forEach((e) => {
            if (e.label !== "presenta") return;
            const patNode = nodeLookup[e.source];
            if (!patNode || patNode.type !== "patologia") return;
            if (!result[e.target]) result[e.target] = [];
            result[e.target].push({
                id: patNode.id,
                label: patNode.label,
                color: patologiaColorMap[patNode.id] || "#f59e0b",
            });
        });
        return result;
    }, [graph, patologiaColorMap]);

    const stats = useMemo(() => {
        const people = (graph?.nodes || []).filter((n) => n.type === "individuo");
        const total = people.length;
        const byPatologia = patologiaNodes.map((p) => {
            const count = people.filter((person) =>
                (positivosPorIndividuo[person.id] || []).some((pos) => pos.id === p.id)
            ).length;
            return {
                id: p.id,
                label: p.label,
                color: patologiaColorMap[p.id],
                count,
                pct: total ? ((count / total) * 100).toFixed(1) : "0.0",
            };
        });
        return { total, byPatologia };
    }, [graph, patologiaNodes, patologiaColorMap, positivosPorIndividuo]);

    return { patologiaNodes, patologiaColorMap, positivosPorIndividuo, stats };
}