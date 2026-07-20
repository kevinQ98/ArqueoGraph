from app.graph_service import (
    build_morro1_reference_graph,
    get_morro1_reference_age_options,
    get_morro1_reference_sex_options,
    build_morro1_pca,
)


def _individual_nodes(graph):
    return [node for node in graph["nodes"] if node.get("type") == "individuo"]


def test_morro1_subadulto_filter_accepts_compact_label():
    nodes = _individual_nodes(build_morro1_reference_graph(edad="subadulto"))

    assert nodes
    assert all(node["edad"] == "subadulto" for node in nodes)


def test_morro1_sex_filter_uses_canonical_values():
    nodes = _individual_nodes(build_morro1_reference_graph(sexo="indeterminado"))

    assert nodes
    assert all(node["sexo"] == "indeterminado" for node in nodes)


def test_morro1_filter_options_are_available_without_sqlite_data():
    assert get_morro1_reference_age_options() == ["adulto", "subadulto", "indeterminado"]
    assert get_morro1_reference_sex_options() == ["femenino", "indeterminado", "masculino"]


def test_morro1_pca_returns_two_components_for_three_elements():
    result = build_morro1_pca(["As", "B", "Li"])

    assert result["summary"]["complete_cases"] >= 3
    assert result["points"]
    assert len(result["loadings"]) == 3
    assert all("pc1" in point and "pc2" in point for point in result["points"])
    assert result["explained_variance"]["pc1"] > 0


def test_morro1_pca_requires_at_least_three_elements():
    try:
        build_morro1_pca(["As", "B"])
    except ValueError as exc:
        assert "al menos tres" in str(exc)
    else:
        raise AssertionError("PCA should reject fewer than three elements")
