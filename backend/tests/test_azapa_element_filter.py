from pathlib import Path

from app.graph_service import build_azapa_element_graph


def test_build_azapa_element_graph_for_as_connects_cases_to_element_node():
    base_dir = Path(__file__).resolve().parents[1]
    graph = build_azapa_element_graph(
        "As",
        reference_path=base_dir / "data" / "azapa140_referencia.json",
        analysis_paths=[
            base_dir / "data" / "azapa140_analisis_quimicos_As_cabello.json",
            base_dir / "data" / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
        ],
    )

    node_ids = {node["id"] for node in graph["nodes"]}
    assert "elemento:As" in node_ids
    assert any(edge["target"] == "elemento:As" for edge in graph["edges"])
    assert any(edge["label"] == "mide" for edge in graph["edges"])
