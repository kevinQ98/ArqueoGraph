from backend.app.graph_service import filter_individuos_by_patologia


def test_filter_individuos_by_patologia_matches_case_ids():
    individuos = [
        {"id_individuo": "Morro1_004", "id_documento": "M1T1C4"},
        {"id_individuo": "Morro1_005", "id_documento": "M1T1C5"},
    ]

    filtered = filter_individuos_by_patologia(
        individuos,
        "columna_vertebral_espondilosis_espondiloartrosis",
    )

    assert [item["id_individuo"] for item in filtered] == ["Morro1_004"]
