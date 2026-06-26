import React, { useState, useRef } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { fmt } from "../utils/format";
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
  const { user } = useAuth();
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
      const file_base64 = await readFileAsBase64(file);
      const res = await api.webhook("conciliacion-bancaria", {
        csv_base64: file_base64,
        file_base64,
        nombre_archivo: file.name,
        media_type: file.type,
        empresa_id: user.empresa_id,
      });
      setResult(res);
      toast(`Conciliación completada: ${res?.matches?.length || 0} coincidencias`, "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setProcessing(false);
    }
  }

  const matches = result?.matches || [];

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Conciliación Bancaria</h1>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          Sube un archivo con los movimientos de tu banco (CSV, Excel o PDF). Kontia comparará los importes con tus facturas y conciliará automáticamente.
        </p>

        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-teal-300 rounded-xl p-8 text-center cursor-pointer mb-4 bg-teal-50/30 hover:bg-teal-50/60 transition-colors"
        >
          <Icon name="upload" size={28} className="text-teal-600 mx-auto mb-2" />
          <div className="text-sm text-slate-500">{file ? file.name : "Seleccionar archivo del banco (CSV, Excel, PDF)"}</div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xls,.xlsx,.pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files[0] || null)}
          />
        </div>

        <Button onClick={handleProcess} disabled={processing || !file}>
          {processing ? "Conciliando..." : "Conciliar"}
        </Button>
      </div>

      {result && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold mb-3">Resultado: {matches.length} coincidencias</h3>
          {matches.map((m, i) => (
            <div key={i} className="flex justify-between items-center py-2 border-b border-slate-100 text-sm">
              <span>Factura #{m.factura_id} — {m.concepto || "Movimiento"}</span>
              <span className="font-semibold">{fmt(m.importe)} €</span>
            </div>
          ))}
          {result.unmatched_count > 0 && (
            <div className="pt-3 text-amber-600 text-sm">{result.unmatched_count} movimientos sin coincidencia</div>
          )}
        </div>
      )}
    </div>
  );
}
