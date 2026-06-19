import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmtDate, fmtCurrency } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import Field from "../components/ui/Field";
import Collapse from "../components/ui/Collapse";

const DOC_TYPES = [
  { value: "facturas", label: "Facturas" },
  { value: "simplificadas", label: "F. Simplificadas" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "albaranes", label: "Albaranes" },
  { value: "proformas", label: "Proformas" },
];

const EMPTY_FORM = {
  numero: "",
  cliente: "",
  cif: "",
  fecha: "",
  importe: "",
};

export default function FacturaElectronica() {
  const toast = useToast();

  const [tipoDoc, setTipoDoc] = useState("facturas");
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords(`facturacion_${tipoDoc}`, { limit: 200, sort: "-fecha" });
      setRecords(Array.isArray(data) ? data : data?.list || []);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [tipoDoc]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!form.numero.trim() || !form.cliente.trim()) {
      toast("Número y cliente son obligatorios", "warning");
      return;
    }
    setSaving(true);
    try {
      await api.createRecord(`facturacion_${tipoDoc}`, {
        numero_factura: form.numero,
        nombre_cliente: form.cliente,
        cif_cliente: form.cif,
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        importe: Number(form.importe) || 0,
        estado: "borrador",
      });
      toast("Borrador creado correctamente", "success");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Factura electrónica</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Icon name="plus" size={16} /> Crear borrador
        </Button>
      </div>

      {/* Doc type selector */}
      <div className="mb-5">
        <Field
          label="Tipo de documento"
          value={tipoDoc}
          onChange={setTipoDoc}
          options={DOC_TYPES}
        />
      </div>

      {/* Data table */}
      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No hay documentos de este tipo</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">CIF</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Importe</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{r.numero_factura || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.nombre_cliente || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.cif_cliente || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.fecha)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmtCurrency(r.importe)}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600">
                      {r.estado || "borrador"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* VeriFACTu info */}
      <div className="mt-8">
        <Collapse title="Sobre VeriFACTu y la AEAT">
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              VeriFACTu es el sistema de facturación electrónica de la Agencia Tributaria (AEAT) que permite
              la emisión y recepción de facturas en formato estructurado, garantizando su autenticidad e integridad.
            </p>
            <p>
              Las facturas electrónicas se envían directamente a la AEAT, cumpliendo con el Reglamento de
              facturación (RD 1619/2012) y las especificaciones técnicas del SII (Suministro Inmediato de Información).
            </p>
            <p>
              Desde Kontia puedes generar borradores de facturas electrónicas que posteriormente se firmarán
              y enviarán a la AEAT a través de los servicios web habilitados.
            </p>
          </div>
        </Collapse>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear borrador de factura">
        <Field label="Número de factura" value={form.numero} onChange={(v) => setForm({ ...form, numero: v })} placeholder="Ej: FE-2026-001" />
        <Field label="Cliente" value={form.cliente} onChange={(v) => setForm({ ...form, cliente: v })} placeholder="Nombre o razón social" />
        <Field label="CIF" value={form.cif} onChange={(v) => setForm({ ...form, cif: v })} placeholder="Identificación fiscal" />
        <Field label="Fecha" type="date" value={form.fecha} onChange={(v) => setForm({ ...form, fecha: v })} />
        <Field label="Importe" type="number" value={form.importe} onChange={(v) => setForm({ ...form, importe: v })} placeholder="0.00" />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Guardando..." : "Crear borrador"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
