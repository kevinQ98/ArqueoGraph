// src/components/dashboard/DataTable.jsx
import { Table } from "lucide-react";

export default function DataTable({
    title,
    iconColor = "text-blue-500",
    headers,
    rows,
    renderRow,
    emptyMessage = "No hay datos disponibles.",
    maxHeight = "h-80",
}) {
    if (!rows || rows.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Table size={16} className={iconColor} />
                    {title}
                </h3>
                <p className="text-sm text-slate-500 text-center py-4">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-3">
                <Table size={16} className={iconColor} />
                {title}
            </h3>
            <div className={`overflow-y-auto mt-4 rounded-t-2xl ${maxHeight}`}>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                {headers.map((header, idx) => (
                                    <th
                                        key={idx}
                                        className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap"
                                    >
                                        {header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {rows.map((row, idx) => renderRow(row, idx))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}