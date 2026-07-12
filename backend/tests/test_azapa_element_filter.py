from pathlib import Path

from app.graph_service import build_azapa_element_graph, build_azapa_reference_graph


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


def test_build_azapa_reference_graph_filters_by_sexo_from_reference_json():
    base_dir = Path(__file__).resolve().parents[1]
    graph = build_azapa_reference_graph(
        reference_path=base_dir / "data" / "azapa140_referencia.json",
        sexo="femenino",
    )

    individual_nodes = [node for node in graph["nodes"] if node.get("type") == "individuo"]
    assert individual_nodes
    assert all((node.get("sexo") or "").lower() == "femenino" for node in individual_nodes)


def test_build_azapa_reference_graph_filters_by_edad_from_reference_json():
    base_dir = Path(__file__).resolve().parents[1]
    graph = build_azapa_reference_graph(
        reference_path=base_dir / "data" / "azapa140_referencia.json",
        edad="adulto",
    )

    individual_nodes = [node for node in graph["nodes"] if node.get("type") == "individuo"]
    assert individual_nodes
    assert all((node.get("edad") or "").lower() == "adulto" for node in individual_nodes)


def test_build_azapa_reference_graph_filters_by_matriz_from_analysis_json():
    base_dir = Path(__file__).resolve().parents[1]
    graph = build_azapa_reference_graph(
        reference_path=base_dir / "data" / "azapa140_referencia.json",
        matriz="cabello",
    )

    individual_nodes = [node for node in graph["nodes"] if node.get("type") == "individuo"]
    assert individual_nodes
    assert all(node.get("id") in {"azapa:site"} or node.get("id") for node in individual_nodes)
