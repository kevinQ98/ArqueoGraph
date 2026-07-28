// src/components/ImagePanel.jsx
import { useEffect, useState } from "react";
import { Image as ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { absoluteImageUrl } from "../lib/api";

export function ImagePanel({
  individuo,
  images: imagesProp,
  title = "Imágenes",
  emptyMessage = "Este individuo todavía no tiene imágenes asociadas.",
  emptyHint = "Selecciona un individuo en el grafo para visualizar sus imágenes asociadas.",
  caseLabelPrefix = "Caso:",
}) {
  const [imagenes, setImagenes] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cargar imágenes
  useEffect(() => {
    let imgs = [];
    if (Array.isArray(imagesProp)) {
      imgs = imagesProp.filter((img) => {
        const u = (img.url || img.relative_path || "").toString();
        return Boolean(u);
      });
    }
    setImagenes(imgs);
    setSelectedIndex(0);
    setStatus("");
  }, [imagesProp]);

  // Si no hay imágenes y no hay individuo, mostrar mensaje
  if (!imagenes.length && !individuo?.id) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <ImageIcon size={32} className="text-slate-300 mb-2" />
          <p className="text-sm text-slate-500">{emptyHint}</p>
        </div>
      </div>
    );
  }

  // Si no hay imágenes pero hay individuo
  if (!imagenes.length) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{title}</h3>
        </div>
        <p className="text-sm text-slate-500">
          No hay imagenes para el nodo seleccionado
        </p>
      </div>
    );
  }

  const selectedImage = imagenes[selectedIndex];

  const handlePrev = () => {
    setSelectedIndex((prev) => (prev === 0 ? imagenes.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setSelectedIndex((prev) => (prev === imagenes.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3">
      {/* Cabecera */}
      <div className=" mb-3">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700 tracking-wider">
            {title}
          </h3>
          {individuo?.label && (
            <span className="text-xs text-slate-500 truncate max-w-[120px]">
              ({individuo.label})
            </span>
          )}
          <span className="text-xs text-slate-400 font-normal">
            ({imagenes.length} {imagenes.length === 1 ? "imagen" : "imágenes"})
          </span>
        </div>
      </div>

      {/* Vista previa principal */}
      <div
        className="relative rounded-lg overflow-hidden bg-slate-100 cursor-pointer aspect-video"
        onClick={() => setIsModalOpen(true)}
      >
        <img
          src={absoluteImageUrl(selectedImage.url)}
          alt={selectedImage.titulo || selectedImage.filename_original}
          className="w-full h-full object-contain"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            className="bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition"
          >
            <ChevronLeft size={12} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            className="bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition"
          >
            <ChevronRight size={12} />
          </button>
        </div>
        <div className="absolute bottom-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
          {selectedIndex + 1} / {imagenes.length}
        </div>
      </div>

      {/* Miniaturas (scroll horizontal) */}
      {imagenes.length > 1 && (
        <div className="mt-3 overflow-x-auto scrollbar-thin flex gap-2 pb-1">
          {imagenes.map((img, idx) => (
            <button
              key={img.id_imagen || idx}
              onClick={() => setSelectedIndex(idx)}
              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${idx === selectedIndex
                ? "border-amber-500 ring-2 ring-amber-200"
                : "border-slate-200 hover:border-amber-300"
                }`}
            >
              <img
                src={absoluteImageUrl(img.url)}
                alt={img.titulo || img.filename_original}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {/* Metadatos (opcional) */}
      {selectedImage.titulo || selectedImage.descripcion ? (
        <div className="mt-2 text-xs text-slate-500">
          {selectedImage.titulo && <span className="font-medium text-slate-700">{selectedImage.titulo}</span>}
          {selectedImage.descripcion && <span className="ml-1">{selectedImage.descripcion}</span>}
        </div>
      ) : null}

      {/* Modal para imagen ampliada */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white p-1 rounded-full transition"
            >
              <X size={24} />
            </button>
            <div className="relative">
              <img
                src={absoluteImageUrl(selectedImage.url)}
                alt={selectedImage.titulo || selectedImage.filename_original}
                className="max-w-full max-h-[85vh] object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-between px-2">
                <button
                  onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                  className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleNext(); }}
                  className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition"
                >
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>
            {/* {selectedImage.titulo && (
              <div className="p-3 bg-white border-t border-slate-200 text-sm text-slate-700">
                {selectedImage.titulo}
                {selectedImage.descripcion && <span className="text-slate-500 ml-2">{selectedImage.descripcion}</span>}
              </div>
            )} */}
          </div>
        </div>
      )}
    </div>
  );
}