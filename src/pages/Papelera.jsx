import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmtDate, fmtCurrency } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import StatusBadge from "../components/ui/StatusBadge";
import ConfirmDialog from "../components/ui/ConfirmDialog";

export default function Papelera() {
  const toast = useToast();

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState(new Set());
  const [selAll, setSelAll] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" });
      const all = Array.isArray(data) ? data : data?.list || [];
      setFacturas(all.filter((f) => f.eliminada));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  function toggleSel(id) {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setSel(next);
    setSelAll(next.size === facturas.length && facturas.length > 0);
  }

  function toggleAll() {
    if (selAll) {
      setSel(new Set());
      setSelAll(false);
    } else {
      setSel(new Set(facturas.map((f) => f.Id)));
      setSelAll(true);
    }
  }

  async function handleRestore() {
    if (sel.size === 0) return;
    setRestoring(true);
    try {
      const ids = [...sel];
      for (const id of ids) {
        await api.updateRecord("facturas", { Id: id, eliminada: false });
      }
      toast(`${ids.length} factura(s) restauradas`, "success");
      setSel(new Set());
      setSelAll(false);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Papelera</h1>
          <p className="text-sm text-slate-400 mt-1">Facturas eliminadas que pueden ser restauradas</p>
        </div>
        {sel.size > 0 && (
          <Button onClick={() => setShowConfirm(true)} disabled={restoring}>
            <Icon name="undo" size={16} />
            {restoring ? "Restaurando..." : `Restaurar (${sel.size})`}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : facturas.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Icon name="trash" size={32} className="mx-auto mb-3 opacity-40" />
          <p>La papelera está vacía</p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left w-10">
                  <input type="checkbox" checked={selAll} onChange={toggleAll} className="accent-teal-500" />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Emisor</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">NIF</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={sel.has(f.Id)} onChange={() => toggleSel(f.Id)} className="accent-teal-500" />
                  </td>
                  <td className="px-4 py-2.5"><StatusBadge status={f.estado} /></td>
                  <td className="px-4 py-2.5 text-slate-700">{f.numero_factura || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(f.fecha_factura)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.nombre_emisor || f.nombre_proveedor || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.nif_emisor || f.nif_proveedor || "—"}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmtCurrency(f.total_factura)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleRestore}
        title="Restaurar facturas"
        message={`¿Restaurar ${sel.size} factura(s) seleccionada(s)? Volverán a aparecer en la vista de contabilidad.`}
        confirmText="Restaurar"
        variant="primary"
      />
    </div>
  );
}
