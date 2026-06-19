import React, { useState, useEffect, useCallback, useMemo } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { can } from "../constants/permissions";
import { fmt, fmtDate } from "../utils/format";
import { ALL_COLUMNS, DEFAULT_VISIBLE_COLUMNS } from "../constants/columns";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import StatusBadge from "../components/ui/StatusBadge";
import SubirDocs from "./SubirDocs";

const TABS = [
  { key: "all", label: "Todos" },
  { key: "procesando", label: "En proceso" },
  { key: "error", label: "Errores" },
  { key: "revision", label: "Pendiente" },
  { key: "contabilizando", label: "Contabilizando" },
  { key: "completada", label: "Contabilizados" },
];

function cellValue(col, f) {
  const map = {
    estado: () => <StatusBadge status={f.estado} />,
    tipo: () => (
      <span className={`text-xs px-1.5 py-0.5 rounded ${f.tipo_documento === "venta" ? "bg-blue-100 text-blue-700" : "bg-purple-50 text-purple-700"}`}>
        {f.tipo_documento || "—"}
      </span>
    ),
    numero: () => f.numero_factura || "—",
    fecha: () => fmtDate(f.fecha_factura),
    emisor: () => f.nombre_emisor || f.proveedor_nombre || "—",
    nif: () => f.nif_emisor || "—",
    base21: () => f.base_iva_21 ? fmt(f.base_iva_21) : "—",
    iva21: () => f.cuota_iva_21 ? fmt(f.cuota_iva_21) : "—",
    base12: () => f.base_iva_12 ? fmt(f.base_iva_12) : "—",
    iva12: () => f.cuota_iva_12 ? fmt(f.cuota_iva_12) : "—",
    base10_5: () => f.base_iva_10_5 ? fmt(f.base_iva_10_5) : "—",
    iva10_5: () => f.cuota_iva_10_5 ? fmt(f.cuota_iva_10_5) : "—",
    base10: () => f.base_iva_10 ? fmt(f.base_iva_10) : "—",
    iva10: () => f.cuota_iva_10 ? fmt(f.cuota_iva_10) : "—",
    base5: () => f.base_iva_5 ? fmt(f.base_iva_5) : "—",
    iva5: () => f.cuota_iva_5 ? fmt(f.cuota_iva_5) : "—",
    base4: () => f.base_iva_4 ? fmt(f.base_iva_4) : "—",
    iva4: () => f.cuota_iva_4 ? fmt(f.cuota_iva_4) : "—",
    base0: () => f.base_iva_0 ? fmt(f.base_iva_0) : "—",
    base0ne: () => f.base_iva_0_no_ex ? fmt(f.base_iva_0_no_ex) : "—",
    iva0ne: () => f.cuota_iva_0_no_ex ? fmt(f.cuota_iva_0_no_ex) : "—",
    base0ns: () => f.base_iva_0_no_sujeto ? fmt(f.base_iva_0_no_sujeto) : "—",
    iva0ns: () => f.cuota_iva_0_no_sujeto ? fmt(f.cuota_iva_0_no_sujeto) : "—",
    metpago: () => f.metodo_pago || "—",
    pctret: () => f.pct_retencion ? `${f.pct_retencion}%` : "—",
    ret: () => f.retencion ? fmt(f.retencion) : (f.cuota_retencion ? fmt(f.cuota_retencion) : "—"),
    total: () => f.total_factura ? fmt(f.total_factura) : (f.total ? fmt(f.total) : "—"),
    cuenta: () => f.cuenta_gasto || "—",
    confianza: () => f.confianza_ia || f.confianza || "—",
  };
  const fn = map[col];
  return fn ? fn() : "—";
}

export default function Contabilidad() {
  const { user } = useAuth();
  const toast = useToast();

  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState("all");
  const [sel, setSel] = useState({});
  const [selAll, setSelAll] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [showColConfig, setShowColConfig] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(() => {
    try {
      const saved = localStorage.getItem("kontia_cols");
      return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  useEffect(() => {
    localStorage.setItem("kontia_cols", JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  const loadFacturas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" });
      setFacturas(data?.list || (Array.isArray(data) ? data : []));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadFacturas(); }, [loadFacturas]);

  const facActivas = useMemo(() => facturas.filter((f) => !f.eliminada), [facturas]);

  const filtered = useMemo(() => {
    if (filtro === "all") return facActivas;
    if (filtro === "completada") return facActivas.filter((f) => f.estado === "completada" || f.estado === "contabilizada");
    return facActivas.filter((f) => f.estado === filtro);
  }, [facActivas, filtro]);

  const columns = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns]
  );

  function toggleCol(key) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function doMasivo(action) {
    const ids = Object.keys(sel).filter((k) => sel[k]).map(Number);
    if (!ids.length) return toast("Selecciona facturas", "warning");
    for (const id of ids) {
      if (action === "papelera") await api.updateRecord("facturas", { Id: id, eliminada: true });
      else await api.updateRecord("facturas", { Id: id, estado: action });
    }
    setSel({});
    toast(`${ids.length} facturas actualizadas`, "success");
    loadFacturas();
  }

  if (showUpload) {
    return <SubirDocs onBack={() => { setShowUpload(false); loadFacturas(); }} />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">Contabilidad de facturas</h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={loadFacturas}>
            <Icon name="refresh" size={14} />
          </Button>
          {can(user, "upload") && (
            <Button onClick={() => setShowUpload(true)}>
              <Icon name="upload" size={14} /> Subir facturas
            </Button>
          )}
          <div className="relative">
            <Button variant="secondary" size="sm" onClick={() => setShowColConfig(!showColConfig)}>
              <Icon name="columns" size={14} />
            </Button>
            {showColConfig && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg p-3 z-30 w-56 max-h-96 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-400 mb-2">Columnas visibles</div>
                {ALL_COLUMNS.map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                    <input type="checkbox" checked={visibleColumns.includes(c.key)} onChange={() => toggleCol(c.key)} />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          {(can(user, "edit") || can(user, "contabilizar")) && (
            <select
              onChange={(e) => { if (e.target.value) doMasivo(e.target.value); e.target.value = ""; }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer"
            >
              <option value="">Acciones</option>
              {can(user, "contabilizar") && <option value="completada">Contabilizar</option>}
              {can(user, "edit") && <option value="pendiente">Marcar pendiente</option>}
              {can(user, "edit") && <option value="error">Marcar error</option>}
              {can(user, "delete") && <option value="papelera">Mover a papelera</option>}
            </select>
          )}
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map((tab) => {
          const cnt = tab.key === "all"
            ? facActivas.length
            : facActivas.filter((f) => f.estado === tab.key || (tab.key === "completada" && f.estado === "contabilizada")).length;
          return (
            <button
              key={tab.key}
              onClick={() => setFiltro(tab.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filtro === tab.key
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {tab.label} <span className="opacity-70">{cnt}</span>
            </button>
          );
        })}
      </div>

      {/* Data table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs whitespace-nowrap" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="bg-slate-50">
                <th className="px-2 py-2.5 w-8">
                  <input
                    type="checkbox"
                    checked={selAll}
                    onChange={(e) => {
                      setSelAll(e.target.checked);
                      const n = {};
                      filtered.forEach((f) => (n[f.Id] = e.target.checked));
                      setSel(n);
                    }}
                  />
                </th>
                {columns.map((c) => (
                  <th key={c.key} className="px-2 py-2.5 text-left font-semibold text-slate-500 border-b border-slate-200" style={{ minWidth: c.width }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-4 py-12 text-center text-slate-400 text-sm">
                    {facActivas.length === 0 ? "Cargando facturas..." : "No hay facturas con este filtro"}
                  </td>
                </tr>
              )}
              {filtered.map((f) => (
                <tr
                  key={f.Id}
                  onClick={() => setDetailInvoice(f)}
                  className="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={!!sel[f.Id]} onChange={(e) => setSel((p) => ({ ...p, [f.Id]: e.target.checked }))} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-2">{cellValue(c.key, f)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-200 flex justify-between text-xs text-slate-400">
          <span>Mostrando {filtered.length} de {facActivas.length} facturas</span>
          <span>Facturas por página: 500</span>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      {detailInvoice && (
        <Modal open={!!detailInvoice} onClose={() => setDetailInvoice(null)} title={`Factura ${detailInvoice.numero_factura || detailInvoice.Id}`}>
          {detailInvoice.archivo_url && (
            <div className="mb-4 text-center">
              {(detailInvoice.archivo_nombre || "").match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img src={detailInvoice.archivo_url} alt="Factura" className="max-w-full max-h-72 rounded-lg border border-slate-200 mx-auto" />
              ) : (
                <a href={detailInvoice.archivo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-5 py-3 bg-teal-50 rounded-lg text-teal-600 font-semibold text-sm">
                  <Icon name="eye" size={18} /> Ver documento ({detailInvoice.archivo_nombre || "PDF"})
                </a>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Estado", detailInvoice.estado],
              ["Tipo", detailInvoice.tipo_documento],
              ["Nº Factura", detailInvoice.numero_factura],
              ["Fecha", fmtDate(detailInvoice.fecha_factura)],
              ["Emisor", detailInvoice.nombre_emisor],
              ["NIF", detailInvoice.nif_emisor],
              ["Base imponible", (detailInvoice.base_imponible ? fmt(detailInvoice.base_imponible) + " €" : "—")],
              ["IVA", `${detailInvoice.tipo_iva || ""}% → ${fmt(detailInvoice.cuota_iva)} €`],
              ["Total", (detailInvoice.total_factura ? fmt(detailInvoice.total_factura) + " €" : "—")],
              ["Cuenta gasto", detailInvoice.cuenta_gasto],
              ["Retención", detailInvoice.cuota_retencion ? fmt(detailInvoice.cuota_retencion) + " €" : "—"],
              ["Método pago", detailInvoice.metodo_pago || "—"],
              ["Confianza IA", detailInvoice.confianza_ia || "—"],
              ["Fecha subida", fmtDate(detailInvoice.CreatedAt)],
            ].map(([k, v], i) => (
              <div key={i}>
                <span className="text-xs text-slate-400 font-semibold">{k}</span>
                <div className="font-medium text-slate-700">{v || "—"}</div>
              </div>
            ))}
          </div>
          {detailInvoice.archivo_url && (
            <div className="mt-4 text-center">
              <a href={detailInvoice.archivo_url} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium">
                <Icon name="download" size={14} /> Descargar
              </a>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
