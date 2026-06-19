import React, { useState } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { CONNECTORS, WEBHOOK_MAP } from "../constants/connectors";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";

export default function Conectores() {
  const toast = useToast();

  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleExport() {
    if (!selected) return;
    const endpoint = WEBHOOK_MAP[selected.id];
    if (!endpoint) {
      toast("Conector no configurado", "warning");
      return;
    }

    setExporting(true);
    setResult(null);
    try {
      const currentYear = new Date().getFullYear();
      const res = await api.webhook(endpoint, {
        formato: "download",
        filtro_where: "(eliminada,neq,true)",
        ejercicio: currentYear,
      });
      setResult(res);
      toast("Exportación completada", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Conectores contables</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CONNECTORS.map((c) => (
          <button
            key={c.id}
            onClick={() => c.active && setSelected(c)}
            disabled={!c.active}
            className={`text-left border rounded-xl p-5 transition-all ${
              c.active
                ? "border-slate-200 hover:border-slate-300 hover:shadow-md cursor-pointer bg-white"
                : "border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{c.icon}</span>
              <div>
                <p className="text-sm font-semibold text-slate-700">{c.name}</p>
                <p className="text-xs text-slate-400">{c.description}</p>
              </div>
            </div>
            {c.active ? (
              <span className="inline-block text-xs font-medium text-teal-600 bg-teal-50 rounded-full px-2.5 py-0.5">
                Disponible
              </span>
            ) : (
              <span className="inline-block text-xs font-medium text-slate-400 bg-slate-100 rounded-full px-2.5 py-0.5">
                Próximamente
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Export modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setResult(null); }} title={selected ? `Exportar - ${selected.name}` : ""}>
        {selected && (
          <div>
            <p className="text-sm text-slate-600 mb-4">
              Se exportarán todas las facturas no eliminadas del ejercicio {new Date().getFullYear()} en formato {selected.name}.
            </p>

            {!result && (
              <Button onClick={handleExport} disabled={exporting} className="w-full justify-center">
                {exporting ? "Exportando..." : "Exportar"}
              </Button>
            )}

            {result && (
              <div className="mt-4 space-y-3">
                {result.url && (
                  <a
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                  >
                    <Icon name="download" size={16} /> Descargar archivo
                  </a>
                )}
                {result.contenido && (
                  <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 max-h-64 overflow-auto whitespace-pre-wrap">
                    {result.contenido}
                  </pre>
                )}
                {!result.url && !result.contenido && (
                  <p className="text-sm text-green-600">Exportación completada correctamente.</p>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
