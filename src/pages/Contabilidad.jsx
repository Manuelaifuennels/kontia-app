import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { can } from "../constants/permissions";
import { fmt, fmtDate, fmtCurrency } from "../utils/format";
import { ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from "../constants/columns";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import SubirDocs from "./SubirDocs";

const TABS = [
  { key: "todos", label: "Todos" },
  { key: "en_proceso", label: "En proceso" },
  { key: "error", label: "Errores" },
  { key: "pendiente", label: "Pendiente" },
  { key: "contabilizando", label: "Contabilizando" },
  { key: "contabilizada", label: "Contabilizados" },
];

function cellValue(col, f) {
  const map = {
    estado: () => <StatusBadge status={f.estado} />,
    tipo: () => f.tipo_documento || "—",
    numero: () => f.numero_factura || "—",
    fecha: () => fmtDate(f.fecha_factura),
    emisor: () => f.nombre_emisor || f.nombre_proveedor || "—",
    nif: () => f.nif_emisor || f.nif_proveedor || "—",
    base21: () => fmt(f.base_iva_21),
    iva21: () => fmt(f.cuota_iva_21),
    base12: () => fmt(f.base_iva_12),
    iva12: () => fmt(f.cuota_iva_12),
    base10_5: () => fmt(f.base_iva_10_5),
    iva10_5: () => fmt(f.cuota_iva_10_5),
    base10: () => fmt(f.base_iva_10),
    iva10: () => fmt(f.cuota_iva_10),
    base5: () => fmt(f.base_iva_5),
    iva5: () => fmt(f.cuota_iva_5),
    base4: () => fmt(f.base_iva_4),
    iva4: () => fmt(f.cuota_iva_4),
    base0: () => fmt(f.base_iva_0),
    base0ne: () => fmt(f.base_iva_0_ne),
    iva0ne: () => fmt(f.cuota_iva_0_ne),
    base0ns: () => fmt(f.base_iva_0_ns),
    iva0ns: () => fmt(f.cuota_iva_0_ns),
    metpago: () => f.metodo_pago || "—",
    pctret: () => f.porcentaje_retencion ? `${f.porcentaje_retencion}%` : "—",
    ret: () => fmt(f.cuota_retencion || f.retencion),
    total: () => fmtCurrency(f.total_factura),
    cuenta: () => f.cuenta_contable || "—",
    confianza: () => f.confianza ? `${Math.round(f.confianza * 100)}%` : "—",
  };
  const fn = map[col];
  return fn ? fn() : "—";
}

export default function Contabilidad() {
  const { user } = useAuth();
  const toast = useToast();

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("todos");
  const [sel, setSel] = useState(new Set());
  const [selAll, setSelAll] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [showColConfig, setShowColConfig] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("kontia_cols");
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" });
      setFacturas(Array.isArray(data) ? data : data?.list || []);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadFacturas(); }, [loadFacturas]);

  const filtered = useMemo(() => {
    const active = facturas.filter((f) => !f.eliminada);
    if (filtro === "todos") return active;
    if (filtro === "contabilizada") return active.filter((f) => f.estado === "contabilizada" || f.estado === "completada");
    return active.filter((f) => f.estado === filtro);
  }, [facturas, filtro]);

  const columns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  function toggleCol(key) {
    const next = visibleColumns.includes(key)
      ? visibleColumns.filter((k) => k !== key)
      : [...visibleColumns, key];
    setVisibleColumns(next);
    localStorage.setItem("kontia_cols", JSON.stringify(next));
  }

  function toggleSel(id) {
    const next = new Set(sel);
    next.has(id) ? next.delete(id) : next.add(id);
    setSel(next);
    setSelAll(next.size === filtered.length && filtered.length > 0);
  }

  function toggleAll() {
    if (selAll) {
      setSel(new Set());
      setSelAll(false);
    } else {
      setSel(new Set(filtered.map((f) => f.Id)));
      setSelAll(true);
    }
  }

  async function bulkAction(action) {
    if (sel.size === 0) return;
    setShowBulk(false);
    const ids = [...sel];
    try {
      for (const id of ids) {
        const payload = { Id: id };
        if (action === "contabilizar") payload.estado = "contabilizada";
        else if (action === "pendiente") payload.estado = "pendiente";
        else if (action === "error") payload.estado = "error";
        else if (action === "papelera") payload.eliminada = true;
        await api.updateRecord("facturas", payload);
      }
      toast(`${ids.length} factura(s) actualizadas`, "success");
      setSel(new Set());
      setSelAll(false);
      loadFacturas();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (showUpload) {
    return <SubirDocs onBack={() => { setShowUpload(false); loadFacturas(); }} />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Contabilidad</h1>
        <div className="flex items-center gap-2">
          {/* Column config */}
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowColConfig(!showColConfig)}>
              <Icon name="columns" size={16} /> Columnas
            </Button>
            {showColConfig && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 w-56 max-h-80 overflow-y-auto">
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-slate-700 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={visibleColumns.includes(c.key)}
                      onChange={() => toggleCol(c.key)}
                      className="accent-teal-500"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Bulk actions */}
          {sel.size > 0 && (
            <div className="relative">
              <Button variant="secondary" size="sm" onClick={() => setShowBulk(!showBulk)}>
                Acciones ({sel.size}) <Icon name="chevronDown" size={14} />
              </Button>
              {showBulk && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 w-48">
                  {can(user, "contabilizar") && (
                    <button onClick={() => bulkAction("contabilizar")} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                      Contabilizar
                    </button>
                  )}
                  {can(user, "edit") && (
                    <>
                      <button onClick={() => bulkAction("pendiente")} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                        Marcar pendiente
                      </button>
                      <button onClick={() => bulkAction("error")} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50">
                        Marcar error
                      </button>
                    </>
                  )}
                  {can(user, "delete") && (
                    <button onClick={() => bulkAction("papelera")} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      Mover a papelera
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {can(user, "upload") && (
            <Button onClick={() => setShowUpload(true)}>
              <Icon name="upload" size={16} /> Subir documentos
            </Button>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setFiltro(tab.key); setSel(new Set()); setSelAll(false); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              filtro === tab.key
                ? "border-teal-500 text-teal-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Data table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando facturas...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No hay facturas en esta vista</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2.5 text-left w-10">
                  <input type="checkbox" checked={selAll} onChange={toggleAll} className="accent-teal-500" />
                </th>
                {columns.map((col) => (
                  <th key={col.key} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide" style={{ minWidth: col.width }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr
                  key={f.Id}
                  onClick={() => setDetailInvoice(f)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={sel.has(f.Id)}
                      onChange={() => toggleSel(f.Id)}
                      className="accent-teal-500"
                    />
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className="px-3 py-2 text-slate-700 whitespace-nowrap">
                      {cellValue(col.key, f)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-xs text-slate-400">
        {filtered.length} factura(s) mostradas
      </div>

      {/* Detail modal */}
      <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title="Detalle de factura" width="max-w-2xl">
        {detailInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-slate-400">Estado</span>
                <div className="mt-1"><StatusBadge status={detailInvoice.estado} /></div>
              </div>
              <div>
                <span className="text-xs text-slate-400">Tipo</span>
                <p className="text-sm text-slate-700">{detailInvoice.tipo_documento || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Numero</span>
                <p className="text-sm text-slate-700">{detailInvoice.numero_factura || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Fecha</span>
                <p className="text-sm text-slate-700">{fmtDate(detailInvoice.fecha_factura)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Emisor</span>
                <p className="text-sm text-slate-700">{detailInvoice.nombre_emisor || detailInvoice.nombre_proveedor || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">NIF</span>
                <p className="text-sm text-slate-700">{detailInvoice.nif_emisor || detailInvoice.nif_proveedor || "—"}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Total</span>
                <p className="text-sm font-semibold text-slate-800">{fmtCurrency(detailInvoice.total_factura)}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Cuenta contable</span>
                <p className="text-sm text-slate-700">{detailInvoice.cuenta_contable || "—"}</p>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <h3 className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Desglose IVA</h3>
              <div className="grid grid-cols-3 gap-2 text-sm text-slate-600">
                {[21, 12, 10, 5, 4, 0].map((pct) => {
                  const base = detailInvoice[`base_iva_${pct}`];
                  const cuota = detailInvoice[`cuota_iva_${pct}`];
                  if (!base && !cuota) return null;
                  return (
                    <div key={pct} className="bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-slate-400">IVA {pct}%</span>
                      <p>Base: {fmt(base)} | Cuota: {fmt(cuota)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {(detailInvoice.cuota_retencion || detailInvoice.retencion) && (
              <div className="bg-amber-50 rounded-lg px-3 py-2 text-sm text-amber-800">
                Retención: {fmt(detailInvoice.cuota_retencion || detailInvoice.retencion)}
                {detailInvoice.porcentaje_retencion && ` (${detailInvoice.porcentaje_retencion}%)`}
              </div>
            )}

            {detailInvoice.documento_url && (
              <div className="border-t border-slate-100 pt-3">
                <a
                  href={detailInvoice.documento_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-teal-600 hover:text-teal-700"
                >
                  <Icon name="download" size={16} /> Descargar documento
                </a>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
