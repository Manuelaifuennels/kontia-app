import React, { useState } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmt, fmtDate } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import StatusBadge from "../components/ui/StatusBadge";

export default function Papelera({ facturas = [], onReload }) {
  const toast = useToast();
  const [sel, setSel] = useState({});
  const [restoring, setRestoring] = useState(false);

  async function handleRestore() {
    const ids = Object.keys(sel).filter((k) => sel[k]).map(Number);
    if (!ids.length) return toast("Selecciona facturas", "warning");
    setRestoring(true);
    let ok = 0;
    const errores = [];
    const fallidas = {};
    for (const id of ids) {
      try {
        await api.updateRecord("facturas", { Id: id, eliminada: false });
        ok++;
      } catch (err) {
        errores.push(err.message);
        fallidas[id] = true;
      }
    }
    // conservar seleccionadas solo las que fallaron, para reintentarlas
    setSel(fallidas);
    setRestoring(false);
    if (errores.length === 0) {
      toast(`${ok} facturas restauradas`, "success");
    } else {
      toast(`${ok} restauradas, ${errores.length} con error: ${errores[0]}`, ok > 0 ? "warning" : "error");
    }
    if (onReload) onReload();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">Papelera</h2>
        <Button variant="secondary" onClick={handleRestore} disabled={restoring}>
          <Icon name="undo" size={14} /> {restoring ? "Restaurando..." : "Restaurar seleccionadas"}
        </Button>
      </div>

      {facturas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Icon name="trash" size={40} className="text-slate-300 mx-auto mb-3" />
          <div className="text-slate-400">Papelera vacía</div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="bg-slate-50">
                <th className="px-3 py-2.5 w-10"></th>
                {["Estado", "Tipo", "Nº Factura", "Emisor", "Total", "Fecha", "Cuenta"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 border-b border-slate-200">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.Id} className="border-b border-slate-100">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={!!sel[f.Id]} onChange={(e) => setSel((p) => ({ ...p, [f.Id]: e.target.checked }))} />
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={f.estado} /></td>
                  <td className="px-3 py-2.5">{f.tipo_documento || "—"}</td>
                  <td className="px-3 py-2.5">{f.numero_factura || "—"}</td>
                  <td className="px-3 py-2.5">{f.nombre_emisor || f.proveedor_nombre || "—"}</td>
                  <td className="px-3 py-2.5 font-semibold">{fmt(f.total_factura || f.total)}</td>
                  <td className="px-3 py-2.5">{fmtDate(f.fecha_factura)}</td>
                  <td className="px-3 py-2.5">{f.cuenta_gasto || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
