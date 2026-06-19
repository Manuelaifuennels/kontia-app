import React from "react";
import { fmtDate } from "../../utils/format";

export default function HistorialTab({ historial }) {
  const rows = Array.isArray(historial) ? historial : historial?.list || [];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Historial de correos</h3>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Destinatario</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Asunto</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <tr key={h.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-600 text-xs">{fmtDate(h.fecha) || "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">{h.destinatario || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{h.asunto || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    h.estado === "enviado" ? "bg-green-100 text-green-700"
                    : h.estado === "error" ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                  }`}>
                    {h.estado || "—"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin historial de correos</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
