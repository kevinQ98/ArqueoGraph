import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER = [-18.5183, -70.2232];

function markerClass(siteName, active) {
  const siteClass = siteName === "Morro 1" ? "morro" : "azapa";
  return `realMapPin ${siteClass} ${active ? "active" : ""}`;
}

function popupContent(site) {
  const container = document.createElement("div");
  container.className = "realMapPopup";

  const eyebrow = document.createElement("span");
  eyebrow.textContent = "Colección bioarqueológica";
  const title = document.createElement("strong");
  title.textContent = site.sitio;
  const metrics = document.createElement("p");
  metrics.textContent = `${site.individuos} individuos · ${site.con_quimica} analizados · ${site.con_imagenes} con imágenes`;
  const coordinates = document.createElement("small");
  coordinates.textContent = `${site.coordinates.lat.toFixed(6)}, ${site.coordinates.lng.toFixed(6)}`;

  container.append(eyebrow, title, metrics, coordinates);
  return container;
}

export function ArchaeologicalMap({ sites = [], selectedSite = "", onSelectSite }) {
  const containerRef = useRef(null);
  const layerRef = useRef(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const instance = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView(DEFAULT_CENTER, 12);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(instance);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(instance);
    layerRef.current = L.layerGroup().addTo(instance);
    setMap(instance);

    return () => {
      instance.remove();
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map || !layerRef.current) return;
    layerRef.current.clearLayers();
    const bounds = [];

    sites.filter((site) => site.coordinates).forEach((site) => {
      const active = selectedSite === site.sitio;
      const position = [site.coordinates.lat, site.coordinates.lng];
      bounds.push(position);
      const icon = L.divIcon({
        className: "realMapMarkerWrapper",
        html: `<div class="${markerClass(site.sitio, active)}"><span></span></div>`,
        iconSize: [34, 42],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38],
      });
      const marker = L.marker(position, { icon, title: site.sitio, alt: site.sitio })
        .bindPopup(popupContent(site), { closeButton: false, offset: [0, -2] })
        .on("click", () => onSelectSite?.(active ? "" : site.sitio));
      marker.addTo(layerRef.current);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [42, 42], maxZoom: 13 });
    }
  }, [map, sites, selectedSite, onSelectSite]);

  return (
    <section className="dashboardVisual realMapVisual">
      <div className="dashboardVisualHeader">
        <div>
          <h3>Mapa arqueológico interactivo</h3>
          <p>Selecciona un marcador para filtrar la colección por sitio.</p>
        </div>
      </div>
      <div ref={containerRef} className="archaeologicalMap" role="region" aria-label="Mapa de sitios arqueológicos" />
      <p className="realMapNote">Coordenadas proporcionadas por el equipo · Cartografía © OpenStreetMap contributors.</p>
    </section>
  );
}
