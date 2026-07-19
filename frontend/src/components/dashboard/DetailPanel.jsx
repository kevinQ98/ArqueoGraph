// src/components/dashboard/DetailPanel.jsx
import { Info } from "lucide-react";
import React from "react";
import { checkAndFix } from "../../lib/utils";

export default function DetailPanel({ data, accentColor = "blue", emptyMessage }) {
    if (!data) {
        const msg = emptyMessage || "Selecciona un nodo en el grafo para ver su información detallada.";
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Detalle</h2>
                </div>
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Info size={32} className="text-slate-300 mb-2" />
                    <p className="text-sm text-slate-500">{msg}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2 mb-1">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                    Detalle <span className="text-base font-bold text-slate-800 truncate">{data.label}</span>
                </h2>
            </div>

            <div className="space-y-3">
                {data.type === "imagen" ? (
                    <p className="text-sm text-slate-500">Tipo: imagen asociada a un caso</p>
                ) : (
                    <>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            {data.sexo !== undefined && (
                                <>
                                    <span className="text-slate-500">Sexo:</span>
                                    <span className="font-medium text-slate-800">{data.sexo || "—"}</span>
                                </>
                            )}
                            {data.edad !== undefined && (
                                <>
                                    <span className="text-slate-500">Edad:</span>
                                    <span className="font-medium text-slate-800">{data.edad || "—"}</span>
                                </>
                            )}
                            {data.estilo !== undefined && (
                                <>
                                    <span className="text-slate-500">Estilo:</span>
                                    <span className="font-medium text-slate-800">{data.estilo || "—"}</span>
                                </>
                            )}
                            {data.estado !== undefined && (
                                <>
                                    <span className="text-slate-500">Estado:</span>
                                    <span className="font-medium text-slate-800">{data.estado || "—"}</span>
                                </>
                            )}
                            {data.referencia_datos && (
                                <>
                                    <span className="text-slate-500">Referencia datos:</span>
                                    <span className="font-medium text-slate-800 truncate">{data.referencia_datos}</span>
                                </>
                            )}
                            {data.matriz && (
                                <>
                                    <span className="text-slate-500">Matriz:</span>
                                    <span className="font-medium text-slate-800">{data.matriz}</span>
                                </>
                            )}
                            {data.extraFields?.map((field) => (
                                <React.Fragment key={field.label}>
                                    <span className="text-slate-500">{field.label}:</span>
                                    <span className="font-medium text-slate-800">{field.value}</span>
                                </React.Fragment>
                            ))}
                        </div>

                        {data.mediciones && Object.keys(data.mediciones).length > 0 && (
                            <div className="pt-3 mt-2 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mediciones</p>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm mt-2">
                                    {Object.entries(data.mediciones).map(([e, m]) => (
                                        <div key={e} className="flex justify-between">
                                            <span className="text-slate-600 font-medium">{e}:</span>
                                            <span className="text-slate-800">{checkAndFix(m.valor)} ppm</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {data.relations && data.relations.length > 0 && (
                            <div className="pt-3 mt-2 border-t border-slate-200">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Relaciones</p>
                                <div className="space-y-0.5 text-sm mt-2">
                                    {data.relations.map((rel, idx) => (
                                        <div key={idx} className="flex justify-between">
                                            <span className="text-slate-600">{rel.label}</span>
                                            <span className="text-slate-800 truncate max-w-[120px]">{rel.target}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}