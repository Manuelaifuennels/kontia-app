import React, { useState } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { CONNECTORS, WEBHOOK_MAP } from "../constants/connectors";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";

export default function Conectores() {
  const toast = useToast();
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  async function handleExport() {
    if (!selected) return;
    const conector = selected;
    const endpoint = WEBHOOK_MAP[conector.id];
    if (!endpoint) {
      toast("Conector no configurado", "warning");
      return;
    }

    setExporting(true);
    setResult(null);
    try {
      const res = await api.webhookDownload(endpoint, {
        formato: "download",
        filtro_where: "(eliminada,neq,true)",
        empresa_id: user.empresa_id,
        ejercicio: new Date().getFullYear().toString(),
      });
      // descartar respuestas obsoletas si el usuario cambió de conector a mitad
      setSelected((s) => {
        if (s?.id !== conector.id) return s;
        setResult(res);
        toast(res.downloaded ? `Descargado ${res.filename}` : "Exportación completada", "success");
        return s;
      });
    } catch (err) {
      setSelected((s) => {
        if (s?.id !== conector.id) return s;
        setResult({ error: err.message });
        toast("Error exportando", "error");
        return s;
      });
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
              <span className="inline-block text-xs font-medium text-green-700 bg-green-50 rounded-full px-2.5 py-0.5">
                Activo
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
      <Modal open={!!selected} onClose={() => { setSelected(null); setResult(null); }} title={selected ? `Exportar — ${selected.name}` : ""}>
        {selected && (
          <div>
            {result ? (
              <div>
                {result.error ? (
                  <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{result.error}</div>
                ) : (
                  <div>
                    <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-3">
                      {result.downloaded ? `Archivo descargado: ${result.filename}` : "Exportación completada"}
                    </div>
                    {result.download_url && /^(https?:\/\/|\/)/i.test(result.download_url) && (
                      <a href={result.download_url} download className="text-teal-600 font-medium text-sm">
                        ⬇ Descargar archivo
                      </a>
                    )}
                    {result.contenido && (
                      <pre className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 max-h-64 overflow-auto whitespace-pre-wrap mt-3">
                        {typeof result.contenido === "string" ? result.contenido : JSON.stringify(result.contenido, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500 mb-4">
                  Se exportarán las facturas contabilizadas del ejercicio {new Date().getFullYear()} en formato {selected.name}.
                </p>
                <Button onClick={handleExport} disabled={exporting}>
                  {exporting ? "Exportando..." : "Exportar ahora"}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
