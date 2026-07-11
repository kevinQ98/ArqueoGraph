from pathlib import Path

from app.graph_service import build_azapa_reference_graph


def test_build_azapa_reference_graph_uses_reference_tumbas():
    reference_path = Path(__file__).resolve().parents[1] / "data" / "azapa140_referencia.json"

    graph = build_azapa_reference_graph(reference_path=reference_path)

    assert graph["mode"] == "relational"
    individuo_nodes = [node for node in graph["nodes"] if node.get("type") == "individuo"]
    assert len(individuo_nodes) == 140
    assert any(node.get("label") == "T1" for node in individuo_nodes)
    assert any(node.get("label") == "T2" for node in individuo_nodes)
