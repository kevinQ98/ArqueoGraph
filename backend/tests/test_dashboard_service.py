from app.dashboard_service import build_dashboard_data


def test_dashboard_combines_both_sites():
    data = build_dashboard_data()

    assert data["version"] == "0.8.0"
    assert data["kpis"]["individuos"] == 338
    assert data["kpis"]["sitios"] == 2
    assert len(data["site_portals"]) == 2
    coordinates = {item["sitio"]: item["coordinates"] for item in data["site_portals"]}
    assert coordinates["Morro 1"] == {"lat": -18.508333, "lng": -70.266667}
    assert coordinates["Azapa 140"] == {"lat": -18.528267, "lng": -70.179785}
    assert {row["label"] for row in data["distributions"]["sitio"]} == {"Morro 1", "Azapa 140"}


def test_dashboard_cross_filters_age_sex_and_site():
    data = build_dashboard_data(sitio="Morro 1", sexo="femenino", edad="subadulto")

    assert data["kpis"]["individuos"] == 10
    assert all(row["sitio"] == "Morro 1" for row in data["cases"])
    assert all(row["sexo"] == "femenino" for row in data["cases"])
    assert all(row["edad"] == "subadulto" for row in data["cases"])


def test_dashboard_element_filter_keeps_cases_with_measurements():
    data = build_dashboard_data(elemento="Mn")

    assert data["kpis"]["individuos"] > 0
    assert all("Mn" in row["elementos"] for row in data["cases"])
    assert data["chemical_summary"]
