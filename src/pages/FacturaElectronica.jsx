import React, { useState } from "react";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import Field from "../components/ui/Field";

const DOC_TYPES = [
  { value: "facturas", label: "Facturas" },
  { value: "simplificadas", label: "F. Simplificadas" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "albaranes", label: "Albaranes" },
  { value: "proformas", label: "Proformas" },
];

const EMPTY_FORM = { num_factura: "", cliente: "", cif_cliente: "", fecha: "", importe: "" };

export default function FacturaElectronica() {
  const [tipoDoc, setTipoDoc] = useState("facturas");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">Factura Electrónica</h1>
          <select
            value={tipoDoc}
            onChange={(e) => setTipoDoc(e.target.value)}
            className="text-sm font-semibold border border-slate-200 rounded-lg px-3 py-1.5 bg-white text-teal-600 cursor-pointer"
          >
            {DOC_TYPES.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={14} /> Crear
          </Button>
          <Button variant="secondary" size="sm">
            <Icon name="filter" size={14} /> Filtros
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="bg-teal-50/50 rounded-xl p-8 text-center">
          <Icon name="zap" size={40} className="text-teal-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-teal-600 mb-2">Veri*Factu</h3>
          <p className="text-sm text-slate-500 mb-4 max-w-lg mx-auto">
            Emisión de facturas electrónicas conforme al reglamento Veri*Factu para envío a la AEAT.
            Requiere integración con proveedor certificado (Quaderno, InvoCash).
          </p>
          <div className="inline-block bg-white rounded-lg border border-slate-200 p-4">
            <table className="text-sm text-left">
              <thead>
                <tr>
                  {["Tipo", "Id", "Estado", "Núm. factura", "Cliente", "CIF", "Fecha", "Importe", "ID Contab."].map((h) => (
                    <th key={h} className="px-3 py-1 text-slate-400 font-medium text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
            </table>
            <div className="py-5 text-slate-400 text-sm">
              No hay {DOC_TYPES.find((d) => d.value === tipoDoc)?.label?.toLowerCase() || tipoDoc} registradas. Se activará cuando Veri*Factu esté configurado.
            </div>
          </div>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={`Crear ${DOC_TYPES.find((d) => d.value === tipoDoc)?.label || tipoDoc}`}>
        <Field label="Número factura" value={form.num_factura} onChange={(v) => setForm({ ...form, num_factura: v })} />
        <Field label="Cliente" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} />
        <Field label="CIF cliente" value={form.cif_cliente} onChange={(v) => setForm({ ...form, cif_cliente: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} />
          <Field label="Importe total" value={form.importe} onChange={(v) => setForm({ ...form, importe: v })} />
        </div>
        <div className="bg-teal-50 rounded-lg p-3 mb-4 text-xs text-slate-500">
          La factura se creará como borrador. Para enviarla a la AEAT vía Veri*Factu, necesitas tener configurado un proveedor certificado en Ajustes &gt; Emisor Facturas.
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button onClick={() => { setShowCreate(false); setForm(EMPTY_FORM); }}>Crear borrador</Button>
        </div>
      </Modal>
    </div>
  );
}
