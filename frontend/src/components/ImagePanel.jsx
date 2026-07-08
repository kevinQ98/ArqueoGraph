import React, { useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCw } from "lucide-react";
import {
  absoluteImageUrl,
  getImagenesIndividuo,
} from "../lib/api";

export function ImagePanel({ individuo, onImagesChange }) {
  const [imagenes, setImagenes] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState("");
  const [status, setStatus] = useState("");

  async function loadImages() {
    if (!individuo?.id) return;
    setStatus("Cargando imágenes...");
    try {
      const imgsRaw = await getImagenesIndividuo(individuo.id);
      // Aceptar cualquier imagen registrada por la API (rutas relativas o url completas)
      const imgs = imgsRaw.filter((img) => {
        const u = (img.url || img.relative_path || "").toString();
        return Boolean(u);
      });
      setImagenes(imgs);
      onImagesChange?.(imgs);
      if (imgs.length > 0) {
        setSelectedImageId((prev) => prev || imgs[0].id_imagen);
      } else {
        setSelectedImageId("");
      }
      setStatus("");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  useEffect(() => {
    loadImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [individuo?.id]);

  if (!individuo) {
    return (
      <section className="panel">
        <h2><ImageIcon size={18} /> Imágenes</h2>
        <p className="hint">Selecciona un individuo en el grafo para visualizar sus imágenes asociadas.</p>
      </section>
    );
  }

  const selectedImage =
    imagenes.find((img) => img.id_imagen === selectedImageId) || imagenes[0] || null;

  return (
    <section className="panel">
      <div className="imagePanelHeader">
        <div>
          <h2><ImageIcon size={18} /> Imágenes</h2>
          <p className="hint">Caso seleccionado: <b>{individuo.label}</b></p>
        </div>
        <button className="secondary small" onClick={loadImages}><RefreshCw size={15} /> Actualizar</button>
      </div>

      {status && <p className="status">{status}</p>}

      {!imagenes.length ? (
        <p className="hint">Este individuo todavía no tiene imágenes asociadas.</p>
      ) : (
        <div className="imageViewer">
          <figure className="imageStage">
            <img src={absoluteImageUrl(selectedImage.url)} alt={selectedImage.titulo || selectedImage.filename_original} />
          </figure>

          <div className="imageMeta">
            <strong>{selectedImage.titulo || selectedImage.filename_original}</strong>
            <span>{selectedImage.tipo_imagen || "imagen"}</span>
            {selectedImage.descripcion && <p>{selectedImage.descripcion}</p>}
          </div>

          <div className="imageThumbs">
            {imagenes.map((img) => (
              <button
                key={img.id_imagen}
                className={img.id_imagen === selectedImage.id_imagen ? "thumbButton active" : "thumbButton"}
                onClick={() => setSelectedImageId(img.id_imagen)}
                title={img.titulo || img.filename_original}
              >
                <img src={absoluteImageUrl(img.url)} alt={img.titulo || img.filename_original} />
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
