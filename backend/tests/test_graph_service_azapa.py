from pathlib import Path

from app.graph_service import build_azapa_element_graph, build_azapa_reference_graph, get_azapa_available_elements


def test_build_azapa_reference_graph_uses_reference_tumbas():
    reference_path = Path(__file__).resolve().parents[1] / "data" / "azapa140_referencia.json"

    graph = build_azapa_reference_graph(reference_path=reference_path)

    assert graph["mode"] == "relational"
    individuo_nodes = [node for node in graph["nodes"] if node.get("type") == "individuo"]
    assert len(individuo_nodes) == 140
    assert any(node.get("label") == "T1" for node in individuo_nodes)
    assert any(node.get("label") == "T2" for node in individuo_nodes)


def test_get_azapa_available_elements_includes_new_analysis_files():
    base_dir = Path(__file__).resolve().parents[1] / "data"
    analysis_paths = [
        base_dir / "azapa140_analisis_quimicos_As_cabello.json",
        base_dir / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
        base_dir / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
        base_dir / "azapa140_analisis_quimicos_Mn_costilla.json",
    ]

    elements = get_azapa_available_elements(analysis_paths=analysis_paths)

    assert "As" in elements
    assert "B" in elements
    assert "Li" in elements
    assert "Mn" in elements
    assert "Pb" in elements
    assert "S" in elements


def test_build_azapa_element_graph_excludes_measurements_without_real_values():
    base_dir = Path(__file__).resolve().parents[1] / "data"
    reference_path = base_dir / "azapa140_referencia.json"
    analysis_paths = [
        base_dir / "azapa140_analisis_quimicos_As_B_Li_costilla.json",
        base_dir / "azapa140_analisis_quimicos_Li_S_B_Pb_As_cabello_ref_dulasiri.json",
    ]

    graph = build_azapa_element_graph("As", reference_path=reference_path, analysis_paths=analysis_paths)

    assert graph["mode"] == "relational"
    assert graph["edges"]
    assert all(edge.get("concentracion") is not None for edge in graph["edges"])
    assert all(not str(edge.get("concentracion", "")).strip().lower() in {"nd", "n.d.", "n/d", "none", "null", "na", "nan"} for edge in graph["edges"])
