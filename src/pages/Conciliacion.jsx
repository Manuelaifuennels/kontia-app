import React, { useState, useRef } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmtCurrency, fmtDate } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Conciliacion() {
  const toast = useToast();
  const fileRef = useRef(null);

  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  async function handleProcess() {
    if (!file) {
      toast("Selecciona un archivo CSV", "warning");
      return;
    }
    setProcessing(true);
    setResult(null);
    try {
      const csv_base64 = await readFileAsBase64(file);
      const res = await api.webhook("conciliacion-bancaria", { csv_base64 });
      setResult(res);
      toast("Conciliación completada", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setProcessing(false);
    }
  }

  const matched = result?.matched || result?.conciliadas || [];
  const unmatchedCount = result?.unmatched_count ?? result?.no_conciliadas ?? 0;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Conciliación bancaria</h1>

      {/* Upload section */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 max-w-xl">
        <p className="text-sm text-slate-600 mb-4">
          Sube un extracto bancario en formato CSV para conciliar automáticamente los movimientos con las facturas registradas.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Icon name="file" size={16} /> Seleccionar CSV
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
          {file && (
            <span className="text-sm text-slate-600">
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>

        <Button onClick={handleProcess} disabled={processing || !file} className="w-full justify-center">
          {processing ? "Procesando..." : "Conciliar movimientos"}
        </Button>
      </div>

      {/* Results */}
      {result && (
        <div>
          <div className="flex items-center gap-4 mb-5">
            <div className="bg-green-50 text-green-700 rounded-xl px-4 py-3">
              <p className="text-xs font-medium opacity-70">Conciliadas</p>
              <p className="text-xl font-bold">{matched.length}</p>
            </div>
            <div className="bg-amber-50 text-amber-700 rounded-xl px-4 py-3">
              <p className="text-xs font-medium opacity-70">Sin conciliar</p>
              <p className="text-xl font-bold">{unmatchedCount}</p>
            </div>
          </div>

          {matched.length > 0 && (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Movimiento</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Factura</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {matched.map((m, i) => (
                    <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-700">{m.concepto || m.descripcion || `Movimiento ${i + 1}`}</td>
                      <td className="px-4 py-2.5 text-slate-600">{m.numero_factura || "—"}</td>
                      <td className="px-4 py-2.5 text-slate-600">{fmtDate(m.fecha)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmtCurrency(m.importe || m.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
